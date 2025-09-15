// Utilitaire d’insertion d’événements dans la table events
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, 'calendar.db');
const db = new sqlite3.Database(DB_PATH);

function insertEvents(events) {
  const stmt = db.prepare('INSERT INTO events (summary, start, description, location) VALUES (?, ?, ?, ?)');
  events.forEach(ev => {
    const summary = ev.summary || '';
    const start = ev.start?.dateTime || ev.start?.date || ev.start || '';
    const description = ev.description || '';
    const location = ev.location || '';
    stmt.run(summary, start, description, location);
  });
  stmt.finalize();
}

module.exports = { insertEvents };
