// ===============================================
//  Fichier : migrate_to_sqlite.js
//  Rôle : Script de migration des données existantes (config.json, events.json) vers SQLite
//  Permet d'importer la configuration et les événements dans la base calendar.db
// ===============================================
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { insertEvents } = require('./utils');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DB_PATH = path.join(__dirname, 'calendar.db');
const db = new sqlite3.Database(DB_PATH);

// -------------------------------------------------
// Fonction : migrateConfig
// Importe la configuration générale et les messages dynamiques depuis config.json vers SQLite
// -------------------------------------------------
async function migrateConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return;
  const config = await fs.readJson(CONFIG_PATH);
  db.run(
    'INSERT INTO config (primaryColor, secondaryColor, fontFamily, eventBgColor, eventTextColor) VALUES (?, ?, ?, ?, ?)',
    [config.primaryColor, config.secondaryColor, config.fontFamily, config.eventBgColor, config.eventTextColor]
  );
  if (config.welcomeMessages) {
    const stmt = db.prepare('INSERT INTO welcome_messages (day, slot, message) VALUES (?, ?, ?)');
    Object.entries(config.welcomeMessages).forEach(([day, slots]) => {
      Object.entries(slots).forEach(([slot, message]) => {
        stmt.run(day, slot, message);
      });
    });
    stmt.finalize();
  }
}

// -------------------------------------------------
// Fonction : migrateEvents
// Importe les événements depuis events.json vers la table events de SQLite
// -------------------------------------------------
async function migrateEvents() {
  // Si vous avez un fichier d'événements, adaptez ici
  // Exemple : events.json
  const EVENTS_PATH = path.join(__dirname, 'events.json');
  if (!fs.existsSync(EVENTS_PATH)) return;
  const events = await fs.readJson(EVENTS_PATH);
  insertEvents(events);
}

// -------------------------------------------------
// Exécution du script de migration
// -------------------------------------------------
(async () => {
  await migrateConfig();
  await migrateEvents();
  db.close();
  console.log('Migration terminée.');
})();
