// ===============================================
//  Module de synchronisation iCalendar
//  Synchronise les événements depuis Google Calendar
// ===============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'calendar.db');
const db = new sqlite3.Database(DB_PATH);

// Fonction pour récupérer les événements depuis iCalendar
async function fetchICalendar(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Parser simple pour iCalendar
function parseICalendar(icalData) {
  const events = [];
  const lines = icalData.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = { is_recurrent: 0 };
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.summary) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('DTSTART')) {
        const match = line.match(/:(.*)/);
        if (match) {
          const dateStr = match[1];
          currentEvent.start = formatDate(dateStr);
        }
      } else if (line.startsWith('DTEND')) {
        const match = line.match(/:(.*)/);
        if (match) {
          const dateStr = match[1];
          currentEvent.end = formatDate(dateStr);
        }
      } else if (line.startsWith('SUMMARY')) {
        currentEvent.summary = line.substring(line.indexOf(':') + 1);
      } else if (line.startsWith('LOCATION')) {
        currentEvent.location = line.substring(line.indexOf(':') + 1);
      } else if (line.startsWith('DESCRIPTION')) {
        currentEvent.description = line.substring(line.indexOf(':') + 1);
      } else if (line.startsWith('RRULE')) {
        currentEvent.is_recurrent = 1;
      }
    }
  }

  return events;
}

// Formater une date iCalendar en ISO
function formatDate(dateStr) {
  // Format: 20251201T080000 ou 20251201T080000Z
  if (dateStr.length >= 15) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const minute = dateStr.substring(11, 13);
    const second = dateStr.substring(13, 15);
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+01:00`;
  }
  return dateStr;
}

// Synchroniser les événements
async function syncICalendar() {
  try {
    // Récupérer l'URL du calendrier depuis les variables d'environnement
    const calendarId = process.env.CALENDAR_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!calendarId || !apiKey) {
      console.log('⚠️  Variables d\'environnement CALENDAR_ID ou GOOGLE_API_KEY manquantes');
      return 0;
    }

    // URL iCalendar de Google Calendar
    const icalUrl = `https://calendar.google.com/calendar/ical/${calendarId}/public/basic.ics`;
    
    console.log('📥 Récupération du calendrier...');
    const icalData = await fetchICalendar(icalUrl);
    
    const events = parseICalendar(icalData);
    console.log(`📋 ${events.length} événement(s) trouvé(s)`);

    // Supprimer les anciens événements
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM events', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Insérer les nouveaux événements
    let insertCount = 0;
    for (const event of events) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO events (summary, start, location, description, is_recurrent) VALUES (?, ?, ?, ?, ?)',
          [
            event.summary || '',
            event.start || '',
            event.location || '',
            event.description || '',
            event.is_recurrent || 0
          ],
          (err) => {
            if (err) {
              console.error('❌ Erreur insertion:', err);
              reject(err);
            } else {
              insertCount++;
              resolve();
            }
          }
        );
      });
    }

    return insertCount;
  } catch (error) {
    console.error('❌ Erreur de synchronisation:', error.message);
    throw error;
  }
}

module.exports = { syncICalendar };
