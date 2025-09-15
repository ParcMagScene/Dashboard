// ===============================================
//  Fichier : index.js
//  Rôle : Backend principal du dashboard calendrier
//  - API Express (HTTPS)
//  - Sauvegarde et lecture des données en SQLite
//  - Synchronisation Google Calendar
//  - Authentification et lecture Spotify
//  - Gestion des fichiers (logo)
//  - Configuration et messages dynamiques
//  Toutes les routes et fonctions sont commentées pour faciliter la maintenance
// ===============================================
// Les routes POST sont déplacées après l'initialisation d'Express et des middlewares.
// Fonction pour rafraîchir le token Spotify
async function refreshSpotifyToken() {
  if (!spotifyRefreshToken) return;
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  try {
    const response = await axios.post(tokenUrl, querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: spotifyRefreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    spotifyAccessToken = response.data.access_token;
  } catch (err) {
    console.error('Erreur lors du refresh du token Spotify');
  }
}
// ...existing code...

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = path.join(__dirname, 'calendar.db');
let db = new sqlite3.Database(DB_PATH);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const axios = require('axios');
const querystring = require('querystring');
const https = require('https');
const fsNative = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
//         MIDDLEWARES            
//  - CORS : autorise les requêtes cross-origin
//  - express.json : parse le JSON des requêtes
// ===============================
app.use(cors()); // Autorise les requêtes cross-origin

// ===============================
//         CONFIGURATION SSL      
//  - Lecture des certificats pour HTTPS
// ===============================
const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// ===============================
//         CHEMINS UTILES         
//  - Chemins des fichiers de config, uploads, logo
// ===============================
const CONFIG_PATH = path.join(__dirname, 'config.json'); // Fichier de config
const UPLOAD_DIR = path.join(__dirname, 'uploads');      // Dossier uploads
const LOGO_PATH = path.join(UPLOAD_DIR, 'logo.png');     // Logo entreprise
const upload = multer({ dest: UPLOAD_DIR });             // Middleware upload

// ===============================
//         FRONTEND STATIC        
//  - Sert le dossier frontend en statique
// ===============================
app.use(express.static(path.join(__dirname, '../frontend'))); // Sert le frontend

// ===============================
//         ROUTES API             
//  - Toutes les routes API sont regroupées et commentées
// ===============================
// ===============================
//   MESSAGE DYNAMIQUE DU JOUR   
//   - Retourne le message d'accueil dynamique selon le jour et le créneau horaire
// ===============================
app.get('/api/welcome-message', (req, res) => {
  // Détermine le jour et le créneau horaire actuel
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const now = new Date();
  const jour = jours[now.getDay()];
  const heure = now.getHours();
  const minute = now.getMinutes();
  let slot = '';
  if (heure >= 6 && (heure < 9 || (heure === 9 && minute < 30))) slot = '06:00-09:30';
  else if ((heure > 9 || (heure === 9 && minute >= 30)) && (heure < 12 || (heure === 12 && minute === 0))) slot = '09:30-12:00';
  else if (heure === 12 && minute > 0 && heure < 13) slot = '12:00-13:00';
  else if (heure >= 13 && heure < 18) slot = '13:00-18:00';

  else slot = '18:00-06:00';
  db.get('SELECT message FROM welcome_messages WHERE day = ? AND slot = ?', [jour, slot], (err, row) => {
    if (err || !row) return res.json({ message: '' });
    res.json({ message: row ? row.message : '' });
  });
});

// ===============================
//   TOUS LES MESSAGES DYNAMIQUES
//   - Retourne tous les messages dynamiques sous forme d'objet imbriqué
// ===============================
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

// --- Configuration générale ---
//   - Lecture et écriture de la configuration générale du dashboard
app.get('/api/config', async (req, res) => {
  db.get('SELECT * FROM config ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) return res.status(500).json({ error: 'Impossible de lire la configuration' });
    if (!row) return res.json({});
    res.json(row);
  });
});

app.post('/api/config', async (req, res) => {
  const { primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor } = req.body;
  db.run(
    'INSERT INTO config (primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor) VALUES (?, ?, ?, ?, ?)',
    [primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor],
    function (err) {
      if (err) return res.status(500).json({ error: "Impossible d'enregistrer la configuration" });
      res.json({ success: true });
    }
  );
});

// --- Logo entreprise ---
//   - Upload et lecture du logo entreprise
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
  db.all('SELECT * FROM events WHERE start LIKE ?', [`${datePrefix}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Impossible de récupérer les événements' });
    res.json(rows);
  });
});


// ===============================
//         ROUTES ADMIN           
//   - Route pour accéder à l'interface d'administration
// ===============================

// Route pour accéder à l'interface d'administration
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Redirection des routes non-API vers le frontend (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ===============================
//         FONCTIONS UTILES       
//   - Import des fonctions utilitaires et synchronisation Google Calendar
// ===============================

const os = require('os');
// Synchronisation Google Calendar → SQLite
const { syncGoogleCalendar } = require('./sync_google_calendar');

// ...existing code...
// (La route POST /api/welcome-messages est déjà correctement définie plus haut)

// Variables pour Spotify OAuth
let spotifyAccessToken = '';
let spotifyRefreshToken = '';

// Route pour démarrer l'auth Spotify
//   - Redirige vers la page d'authentification Spotify
app.get('/spotify-login', (req, res) => {
  const scopes = 'user-read-currently-playing user-read-playback-state';
  const authUrl = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    });
  res.redirect(authUrl);
});

// Route de callback Spotify pour récupérer le code et obtenir les tokens
//   - Récupère le code d'auth, échange contre les tokens, sauvegarde en mémoire
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Code manquant');
  try {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const params = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    };
    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    spotifyAccessToken = response.data.access_token;
    spotifyRefreshToken = response.data.refresh_token;
    res.send('<h2>Authentification Spotify réussie !</h2><p>Vous pouvez fermer cette fenêtre.</p>');
  } catch (err) {
    res.status(500).send('Erreur lors de la récupération du token Spotify');
  }
});

// Rafraîchir toutes les 50 minutes
//   - Permet de garder le token Spotify valide
setInterval(refreshSpotifyToken, 50 * 60 * 1000);

// Route API pour le morceau Spotify en cours
//   - Retourne les infos du morceau en cours de lecture sur Spotify
app.get('/api/spotify/current', async (req, res) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${spotifyAccessToken}` }
    });
    if (response.data && response.data.item) {
      const track = response.data.item;
      res.json({
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        url: track.external_urls.spotify,
        image: track.album.images[0]?.url || ''
      });
    } else {
      res.json({ name: 'Aucune lecture en cours', artist: '', album: '', url: '', image: '' });
    }
  } catch (e) {
    res.json({ name: 'Aucune lecture en cours', artist: '', album: '', url: '', image: '' });
  }
});

// Route API pour vérifier l'état d'authentification Spotify
//   - Indique si l'utilisateur est authentifié Spotify
app.get('/api/spotify-auth-status', (req, res) => {
  if (!spotifyAccessToken || !spotifyRefreshToken) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true });
});

// Synchronisation Google Calendar au démarrage
//   - Lance la synchronisation au démarrage et toutes les heures
syncGoogleCalendar();
// Synchronisation toutes les 30 secondes
setInterval(syncGoogleCalendar, 30 * 1000);

// 🚀 Démarrage du serveur en IPv4
//   - Lance le serveur HTTPS sur l'adresse locale
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur HTTPS lancé sur https://192.168.205.56:${PORT}`);
});

