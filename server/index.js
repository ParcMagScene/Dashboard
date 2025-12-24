// ===============================================
//  Backend principal du dashboard calendrier
//  - API Express (HTTP)
//  - SQLite pour la persistance
//  - Synchronisation iCalendar
//  - Intégration Sonos
// ===============================================

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = path.join(__dirname, 'calendar.db');
let db = new sqlite3.Database(DB_PATH);

// Créer la table des événements terminés si elle n'existe pas
db.run(`
  CREATE TABLE IF NOT EXISTS completed_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, event_date)
  )
`);

// Ajouter la colonne uid à la table events si elle n'existe pas
db.run(`ALTER TABLE events ADD COLUMN uid TEXT`, (err) => {
  // Ignore l'erreur si la colonne existe déjà
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const axios = require('axios');
const { DeviceDiscovery } = require('sonos');
const app = express();
const PORT = process.env.PORT || 3001;

// Variables globales Sonos
let sonosDevice = null;

// Helper: Fonction générique pour remplacer toutes les données d'une table
function bulkReplaceInDB(tableName, rows, insertSQL, extractValues) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM ${tableName}`, (err) => {
      if (err) return reject(err);
      
      const insertPromises = rows.map(row => {
        return new Promise((resolveInsert, rejectInsert) => {
          const values = extractValues(row);
          db.run(insertSQL, values, function(err) {
            if (err) rejectInsert(err);
            else resolveInsert(this.lastID);
          });
        });
      });
      
      Promise.all(insertPromises).then(resolve).catch(reject);
    });
  });
}

app.use(cors());
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, 'config.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const GIFS_DIR = path.join(__dirname, '..', 'GIFS');
const LOGO_PATH = path.join(UPLOAD_DIR, 'logo.png');
const SNEAKY_PHOTO_PATH = path.join(UPLOAD_DIR, 'sneaky-photo.jpg');
const SNEAKY_PHOTO_CONFIG = path.join(UPLOAD_DIR, 'sneaky-photo.json');
const SNEAKY_MESSAGE_CONFIG = path.join(UPLOAD_DIR, 'sneaky-message.json');
const LOCATION_ICONS_CONFIG = path.join(UPLOAD_DIR, 'location-icons.json');
const upload = multer({ dest: UPLOAD_DIR });
const gifUpload = multer({ 
  dest: GIFS_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/gif' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers GIF et PNG sont autorisés'), false);
    }
  }
});

app.use(express.static(path.join(__dirname, '../client')));
app.use('/gifs', express.static(GIFS_DIR));

// ===============================================
//  ROUTES API - PHOTO FURTIVE
// ===============================================

// Upload et activation de la photo furtive
app.post('/api/sneaky-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo fournie' });
    }
    
    // Déplacer le fichier uploadé
    await fs.move(req.file.path, SNEAKY_PHOTO_PATH, { overwrite: true });
    
    // Calculer la date d'expiration
    const duration = req.body.duration;
    let expiresAt;
    const now = new Date();
    
    if (duration === 'endOfDay') {
      expiresAt = new Date(now);
      expiresAt.setHours(23, 59, 59, 999);
    } else if (duration === 'endOfWeek') {
      expiresAt = new Date(now);
      const daysUntilSunday = 7 - now.getDay();
      expiresAt.setDate(now.getDate() + daysUntilSunday);
      expiresAt.setHours(23, 59, 59, 999);
    } else {
      const minutes = parseInt(duration) || 15;
      expiresAt = new Date(now.getTime() + minutes * 60 * 1000);
    }
    
    // Sauvegarder la configuration
    const config = {
      active: true,
      uploadedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    fs.writeFileSync(SNEAKY_PHOTO_CONFIG, JSON.stringify(config, null, 2));
    
    console.log(`📸 Photo furtive activée jusqu'à ${expiresAt.toLocaleString()}`);
    res.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Erreur upload photo furtive:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Récupérer le statut de la photo furtive
app.get('/api/sneaky-photo/status', (req, res) => {
  try {
    if (!fs.existsSync(SNEAKY_PHOTO_CONFIG)) {
      return res.json({ active: false });
    }
    
    const config = JSON.parse(fs.readFileSync(SNEAKY_PHOTO_CONFIG, 'utf8'));
    const now = new Date();
    const expiresAt = new Date(config.expiresAt);
    
    if (!config.active || now > expiresAt) {
      return res.json({ active: false });
    }
    
    res.json({
      active: true,
      uploadedAt: config.uploadedAt,
      expiresAt: config.expiresAt
    });
  } catch (error) {
    res.json({ active: false });
  }
});

// Récupérer l'image de la photo furtive
app.get('/api/sneaky-photo/image', (req, res) => {
  try {
    if (!fs.existsSync(SNEAKY_PHOTO_CONFIG) || !fs.existsSync(SNEAKY_PHOTO_PATH)) {
      return res.status(404).json({ error: 'Aucune photo active' });
    }
    
    const config = JSON.parse(fs.readFileSync(SNEAKY_PHOTO_CONFIG, 'utf8'));
    const now = new Date();
    const expiresAt = new Date(config.expiresAt);
    
    if (!config.active || now > expiresAt) {
      return res.status(404).json({ error: 'Photo expirée' });
    }
    
    res.sendFile(SNEAKY_PHOTO_PATH);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Désactiver la photo furtive
app.delete('/api/sneaky-photo', (req, res) => {
  try {
    if (fs.existsSync(SNEAKY_PHOTO_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(SNEAKY_PHOTO_CONFIG, 'utf8'));
      config.active = false;
      fs.writeFileSync(SNEAKY_PHOTO_CONFIG, JSON.stringify(config, null, 2));
    }
    console.log('📸 Photo furtive désactivée');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===============================================
//  ROUTES API - MESSAGE FURTIF
// ===============================================

// Activer un message d'accueil furtif
app.post('/api/sneaky-message', (req, res) => {
  try {
    const { message, duration } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message requis' });
    }
    
    // Calculer la date d'expiration
    const now = new Date();
    let expiresAt;
    
    if (duration === 'endOfDay') {
      expiresAt = new Date(now);
      expiresAt.setHours(23, 59, 59, 999);
    } else if (duration === 'endOfWeek') {
      expiresAt = new Date(now);
      const daysUntilSunday = 7 - now.getDay();
      expiresAt.setDate(now.getDate() + daysUntilSunday);
      expiresAt.setHours(23, 59, 59, 999);
    } else {
      const minutes = parseInt(duration) || 15;
      expiresAt = new Date(now.getTime() + minutes * 60 * 1000);
    }
    
    // Sauvegarder la configuration
    const config = {
      active: true,
      message: message.trim(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    fs.writeFileSync(SNEAKY_MESSAGE_CONFIG, JSON.stringify(config, null, 2));
    
    console.log(`💬 Message furtif activé jusqu'à ${expiresAt.toLocaleString()}: "${message.trim()}"`);
    res.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Erreur activation message furtif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer le statut du message furtif
app.get('/api/sneaky-message/status', (req, res) => {
  try {
    if (!fs.existsSync(SNEAKY_MESSAGE_CONFIG)) {
      return res.json({ active: false });
    }
    
    const config = JSON.parse(fs.readFileSync(SNEAKY_MESSAGE_CONFIG, 'utf8'));
    const now = new Date();
    const expiresAt = new Date(config.expiresAt);
    
    if (!config.active || now > expiresAt) {
      return res.json({ active: false });
    }
    
    res.json({
      active: true,
      message: config.message,
      createdAt: config.createdAt,
      expiresAt: config.expiresAt
    });
  } catch (error) {
    res.json({ active: false });
  }
});

// Désactiver le message furtif
app.delete('/api/sneaky-message', (req, res) => {
  try {
    if (fs.existsSync(SNEAKY_MESSAGE_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(SNEAKY_MESSAGE_CONFIG, 'utf8'));
      config.active = false;
      fs.writeFileSync(SNEAKY_MESSAGE_CONFIG, JSON.stringify(config, null, 2));
    }
    console.log('💬 Message furtif désactivé');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===============================================
//  ROUTES API
// ===============================================

app.post('/api/sync', async (req, res) => {
  try {
    console.log('🔄 Synchronisation forcée demandée...');
    await syncICalendar();
    res.json({ 
      success: true, 
      message: 'Synchronisation effectuée avec succès',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation forcée:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Message d'accueil dynamique selon jour et créneau horaire
app.get('/api/welcome-message', (req, res) => {
  // Vérifier d'abord s'il y a un message furtif actif
  try {
    if (fs.existsSync(SNEAKY_MESSAGE_CONFIG)) {
      const sneakyConfig = JSON.parse(fs.readFileSync(SNEAKY_MESSAGE_CONFIG, 'utf8'));
      const now = new Date();
      const expiresAt = new Date(sneakyConfig.expiresAt);
      
      if (sneakyConfig.active && now <= expiresAt) {
        // Retourner le message furtif avec un flag pour indiquer que c'est un message furtif
        return res.json({ message: sneakyConfig.message, isSneaky: true });
      }
    }
  } catch (error) {
    // Ignorer les erreurs et continuer avec le message normal
  }
  
  // Détermine le jour et le créneau horaire actuel
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const now = new Date();
  const jour = jours[now.getDay()];
  const heure = now.getHours();
  
  // Définit les créneaux selon le système actuel
  let slot = '';
  if (heure >= 6 && heure < 9) {
    slot = 'matin';
  } else if (heure >= 9 && heure < 12) {
    slot = 'matinee';
  } else if (heure >= 12 && heure < 14) {
    slot = 'midi';
  } else if (heure >= 14 && heure < 18) {
    slot = 'apres_midi';
  } else {
    slot = 'soir';
  }

  // Récupère le message depuis la base de données
  db.get('SELECT message FROM welcome_messages WHERE day = ? AND slot = ?', [jour, slot], (err, row) => {
    if (err) {
      console.error('Erreur lors de la récupération du message:', err);
      return res.json({ message: 'Bonne journée !', isSneaky: false });
    }
    
    const message = row ? row.message : 'Bonne journée !';
    res.json({ message, isSneaky: false });
  });
});

app.get('/api/welcome-messages', (req, res) => {
  db.all('SELECT day, slot, message FROM welcome_messages', (err, rows) => {
    if (err || !rows) return res.json({ welcomeMessages: {} });
    // Transforme en objet imbriqué { day: { slot: message } }
    const result = {};
    rows.forEach(row => {
      if (!result[row.day]) result[row.day] = {};
      result[row.day][row.slot] = row.message;
    });
    res.json({ welcomeMessages: result });
  });
});

app.get('/api/config', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    res.json(config);
  } catch (error) {
    console.error('Erreur lors de la lecture de config.json:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture de la configuration' });
  }
});

app.post('/api/welcome-messages', async (req, res) => {
  const { welcomeMessages } = req.body;
  
  if (!welcomeMessages) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  try {
    const rows = [];
    for (const day in welcomeMessages) {
      for (const slot in welcomeMessages[day]) {
        const message = welcomeMessages[day][slot];
        if (message && message.trim()) {
          rows.push({ day, slot, message: message.trim() });
        }
      }
    }
    
    await bulkReplaceInDB(
      'welcome_messages',
      rows,
      'INSERT INTO welcome_messages (day, slot, message) VALUES (?, ?, ?)',
      (row) => [row.day, row.slot, row.message]
    );
    
    res.json({ success: true, message: 'Messages d\'accueil sauvegardés avec succès' });
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des messages:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des messages' });
  }
});

// Règles de couleurs des événements
app.get('/api/event-color-rules', (req, res) => {
  db.all('SELECT * FROM event_color_rules ORDER BY keyword', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de récupérer les règles de couleurs' });
    }
    res.json({ rules: rows || [] });
  });
});

app.post('/api/event-color-rules', async (req, res) => {
  const { rules } = req.body;
  
  if (!rules || !Array.isArray(rules)) {
    return res.status(400).json({ error: 'Format de données invalide' });
  }

  try {
    const validRules = rules.filter(rule => rule.keyword && rule.color);
    
    await bulkReplaceInDB(
      'event_color_rules',
      validRules,
      'INSERT INTO event_color_rules (keyword, color, description) VALUES (?, ?, ?)',
      (rule) => [rule.keyword.trim(), rule.color.trim(), rule.description || '']
    );
    
    res.json({ success: true, message: 'Règles de couleurs sauvegardées avec succès' });
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des règles:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des règles' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor, showWeather } = req.body;
    
    // Mettre à jour la base de données SQLite
    db.run(
      'INSERT INTO config (primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor) VALUES (?, ?, ?, ?, ?)',
      [primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor],
      function (err) {
        if (err) return res.status(500).json({ error: "Impossible d'enregistrer la configuration" });
      }
    );
    
    // Mettre à jour le fichier config.json pour showWeather
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.showWeather = showWeather;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    res.status(500).json({ error: "Impossible d'enregistrer la configuration" });
  }
});

// Upload et lecture du logo
app.post('/api/logo', upload.single('logo'), async (req, res) => {
  try {
    await fs.move(req.file.path, LOGO_PATH, { overwrite: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Échec de l\'upload du logo' });
  }
});

app.get('/api/logo', (req, res) => {
  if (fs.existsSync(LOGO_PATH)) {
    res.sendFile(LOGO_PATH);
  } else if (fs.existsSync(path.join(__dirname, 'assets', 'logo.png'))) {
    res.sendFile(path.join(__dirname, 'assets', 'logo.png'));
  } else {
    res.status(404).json({ error: 'Logo introuvable' });
  }
});

// ===============================================
//  ROUTES API - ICÔNES DE LIEUX (GIFs)
// ===============================================

// Récupérer la liste des GIFs disponibles
app.get('/api/location-gifs', (req, res) => {
  try {
    if (!fs.existsSync(GIFS_DIR)) {
      fs.ensureDirSync(GIFS_DIR);
    }
    const files = fs.readdirSync(GIFS_DIR).filter(f => {
      const lower = f.toLowerCase();
      return lower.endsWith('.gif') || lower.endsWith('.png');
    });
    res.json({ gifs: files });
  } catch (error) {
    console.error('Erreur lecture dossier GIFS:', error);
    res.status(500).json({ error: 'Impossible de lire le dossier GIFS' });
  }
});

// Upload d'un nouveau GIF
app.post('/api/location-gifs', gifUpload.single('gif'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    // Renommer le fichier avec son nom original
    const originalName = req.file.originalname.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
    const finalPath = path.join(GIFS_DIR, originalName);
    
    await fs.move(req.file.path, finalPath, { overwrite: true });
    
    console.log(`🎨 Nouveau GIF ajouté: ${originalName}`);
    res.json({ success: true, filename: originalName });
  } catch (error) {
    console.error('Erreur upload GIF:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload du GIF' });
  }
});

// Supprimer un GIF
app.delete('/api/location-gifs/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(GIFS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath);
      console.log(`🗑️ GIF supprimé: ${filename}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Fichier non trouvé' });
    }
  } catch (error) {
    console.error('Erreur suppression GIF:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Récupérer les associations lieu -> icône
app.get('/api/location-icons', (req, res) => {
  try {
    if (!fs.existsSync(LOCATION_ICONS_CONFIG)) {
      return res.json({ rules: [] });
    }
    const config = JSON.parse(fs.readFileSync(LOCATION_ICONS_CONFIG, 'utf8'));
    res.json({ rules: config.rules || [] });
  } catch (error) {
    console.error('Erreur lecture config icônes:', error);
    res.json({ rules: [] });
  }
});

// Sauvegarder les associations lieu -> icône
app.post('/api/location-icons', (req, res) => {
  try {
    const { rules } = req.body;
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'Format de données invalide' });
    }
    
    const config = { rules };
    fs.writeFileSync(LOCATION_ICONS_CONFIG, JSON.stringify(config, null, 2));
    
    console.log(`🎨 ${rules.length} règle(s) d'icônes sauvegardée(s)`);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur sauvegarde config icônes:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
  }
});


// ===============================
//         ROUTE EVENTS           
//   - Retourne la liste des événements du jour depuis SQLite
// ===============================
app.get('/api/events', (req, res) => {
  // Récupère tous les événements dont la date commence par AAAA-MM-JJ (jour courant)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${yyyy}-${mm}-${dd}`;
  
  db.all('SELECT * FROM events WHERE start LIKE ? ORDER BY is_recurrent ASC, start ASC', [`${datePrefix}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Impossible de récupérer les événements' });
    
    // Séparer les événements en deux catégories
    const regularEvents = rows.filter(event => !event.is_recurrent);
    const recurrentEvents = rows.filter(event => event.is_recurrent);
    
    res.json({
      regular: regularEvents,
      recurrent: recurrentEvents,
      all: rows // Compatibility avec l'ancien format
    });
  });
});

// ===============================
//    ÉVÉNEMENTS TERMINÉS        
// ===============================

// Récupérer les événements terminés du jour
app.get('/api/completed-events', (req, res) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  db.all('SELECT event_id FROM completed_events WHERE event_date = ?', [dateStr], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur lors de la récupération' });
    const completedIds = rows.map(r => r.event_id);
    res.json({ completed: completedIds });
  });
});

// Marquer un événement comme terminé
app.post('/api/complete-event', (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId requis' });
  
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  db.run(
    'INSERT OR IGNORE INTO completed_events (event_id, event_date) VALUES (?, ?)',
    [eventId, dateStr],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
      res.json({ success: true, eventId });
    }
  );
});

// Démarquer un événement comme terminé
app.post('/api/uncomplete-event', (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId requis' });
  
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  db.run(
    'DELETE FROM completed_events WHERE event_id = ? AND event_date = ?',
    [eventId, dateStr],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erreur lors de la suppression' });
      res.json({ success: true, eventId });
    }
  );
});

// ===============================
//         ROUTE MÉTÉO            
//   - Retourne les données météo via OpenWeather API
// ===============================
app.get('/api/weather', async (req, res) => {
  const OPENWEATHER_API_KEY = '888408bd4f11cb2d7ae35c7398fd6a14';
  const CITY = 'Saint-Denis,RE,FR'; // Saint-Denis, La Réunion
  const WEATHER_URL = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=fr`;
  
  try {
    const response = await axios.get(WEATHER_URL);
    const weatherData = response.data;
    
    const weatherInfo = {
      temperature: Math.round(weatherData.main.temp),
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      humidity: weatherData.main.humidity,
      windSpeed: Math.round(weatherData.wind.speed * 3.6), // Conversion m/s vers km/h
      city: weatherData.name
    };
    
    res.json(weatherInfo);
  } catch (error) {
    console.error('Erreur météo OpenWeather:', error.message);
    res.status(500).json({ 
      error: 'Impossible de récupérer les données météo',
      temperature: '--',
      description: 'Non disponible'
    });
  }
});

// ===============================
//         ROUTES ADMIN           
//   - Route pour accéder à l'interface d'administration
// ===============================

// Route pour accéder à l'interface d'administration
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Route alternative pour admin.html
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Redirection des routes non-API vers le frontend (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ===============================
//         FONCTIONS UTILES       
//   - Import des fonctions utilitaires et synchronisation Google Calendar
// ===============================

const os = require('os');

// ...existing code...
// (La route POST /api/welcome-messages est déjà correctement définie plus haut)

// ===============================
//   INTÉGRATION SONOS           
//   - Utilisation du package sonos
//   - Récupération lecture en cours
// ===============================

const SONOS_CONFIG_PATH = path.join(__dirname, 'sonos-config.json');

// Lire la config Sonos
function getSonosConfig() {
  try {
    if (fs.existsSync(SONOS_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SONOS_CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Erreur lecture config Sonos:', err);
  }
  return { sonosIP: '192.168.205.58' };
}

// Initialiser le device Sonos avec découverte
async function initSonosDevice() {
  if (sonosDevice) return sonosDevice;
  
  const config = getSonosConfig();
  if (!config.sonosIP) return null;
  
  try {
    const DeviceDiscovery = require('sonos').DeviceDiscovery;
    const discovery = new DeviceDiscovery();
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️  Timeout découverte Sonos');
        resolve(null);
      }, 3000);
      
      discovery.once('DeviceAvailable', (device) => {
        clearTimeout(timeout);
        // Filtrer par IP si configurée
        if (device.host === config.sonosIP) {
          console.log(`🔊 Sonos trouvé: ${device.host}`);
          sonosDevice = device;
          resolve(device);
        }
      });
    });
  } catch (err) {
    console.error('Erreur init Sonos:', err);
    return null;
  }
}

// Route API pour obtenir/définir l'IP Sonos
app.get('/api/sonos-config', (req, res) => {
  res.json(getSonosConfig());
});

app.post('/api/sonos-config', (req, res) => {
  try {
    const { sonosIP } = req.body;
    fs.writeFileSync(SONOS_CONFIG_PATH, JSON.stringify({ sonosIP }, null, 2));
    sonosDevice = null; // Reset device
    res.json({ success: true, sonosIP });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route API pour récupérer la lecture en cours sur Sonos
app.get('/api/sonos-now-playing', async (req, res) => {
  try {
    const device = await initSonosDevice();
    
    if (!device) {
      return res.json({ 
        playing: false, 
        title: '', 
        artist: '', 
        album: '', 
        albumArt: ''
      });
    }
    
    // Récupérer les infos de lecture
    const track = await device.currentTrack();
    const state = await device.getCurrentState();
    
    if (state === 'playing' && track) {
      res.json({
        playing: true,
        title: track.title || 'Titre inconnu',
        artist: track.artist || 'Artiste inconnu',
        album: track.album || '',
        albumArt: track.albumArtURL || ''
      });
    } else {
      res.json({ 
        playing: false, 
        title: '', 
        artist: '', 
        album: '', 
        albumArt: '' 
      });
    }
  } catch (error) {
    console.error('❌ Erreur Sonos:', error.message);
    res.json({ 
      playing: false, 
      title: '', 
      artist: '', 
      album: '', 
      albumArt: '' 
    });
  }
});

// ===============================
//   SYNCHRONISATION AUTOMATIQUE  
// ===============================
const { syncICalendar } = require('./sync_ical.js');

// Synchronisation au démarrage
console.log('🔄 Synchronisation initiale des événements...');
syncICalendar()
  .then(count => console.log(`✅ ${count} événement(s) synchronisé(s) au démarrage`))
  .catch(err => console.error('❌ Erreur sync initiale:', err.message));

// Synchronisation automatique toutes les minutes
setInterval(async () => {
  try {
    console.log('🔄 Synchronisation automatique des événements...');
    const count = await syncICalendar();
    console.log(`✅ ${count} événement(s) synchronisé(s)`);
  } catch (error) {
    console.error('❌ Erreur sync automatique:', error.message);
  }
}, 60 * 1000); // 1 minute

// 🚀 Démarrage du serveur en IPv4
//   - Lance le serveur HTTPS (activé pour Tidal OAuth)
const USE_HTTPS = true; // Forcer HTTPS

// Lancer le serveur HTTP sur le port 3001
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur HTTP lancé sur http://dashboard.local:${PORT}`);
  console.log(`Accès direct IP: http://192.168.205.75:${PORT}`);
});

httpServer.on('error', (err) => {
  console.error('Erreur serveur HTTP:', err);
});

