// ===============================================
//  Fichier : init_db.js
//  Rôle : Script d'initialisation de la base SQLite pour sauvegarder toutes les données du site
//  Crée les tables principales : config, welcome_messages, events, files
// ===============================================
const db = new sqlite3.Database('calendar.db');

// -------------------------------------------------
// Création des tables principales
// -------------------------------------------------
// Table configuration générale
const configTable = `CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY,
  primaryColor TEXT,
  secondaryColor TEXT,
  fontFamily TEXT,
  eventBgColor TEXT,
  eventTextColor TEXT
);`;

// Table messages d'accueil dynamiques
const welcomeTable = `CREATE TABLE IF NOT EXISTS welcome_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  slot TEXT,
  message TEXT
);`;

// Table événements (Google Calendar ou manuels)
const eventsTable = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT,
  start TEXT,
  description TEXT,
  location TEXT
);`;

// Table fichiers (logo, etc.)
const filesTable = `CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  path TEXT
);`;

// -------------------------------------------------
// Exécution de la création des tables
// -------------------------------------------------
db.serialize(() => {
  db.run(configTable);
  db.run(welcomeTable);
  db.run(eventsTable);
  db.run(filesTable);
  console.log('Base de données initialisée avec succès.');
});

// -------------------------------------------------
// Fermeture de la connexion à la base
// -------------------------------------------------
db.close();
