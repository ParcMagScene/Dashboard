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

// Parser simple pour iCalendar avec génération des occurrences récurrentes
function parseICalendar(icalData) {
  const events = [];
  const lines = icalData.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = { is_recurrent: 0, rrule: null, uid: null };
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.summary) {
        // Si l'événement est récurrent, générer les occurrences
        if (currentEvent.is_recurrent && currentEvent.rrule) {
          const occurrences = generateRecurrentOccurrences(currentEvent);
          events.push(...occurrences);
        } else {
          // Générer un UID stable basé sur summary + start
          currentEvent.uid = generateStableUID(currentEvent.summary, currentEvent.start);
          events.push(currentEvent);
        }
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
      } else if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4);
      } else if (line.startsWith('RRULE')) {
        currentEvent.is_recurrent = 1;
        currentEvent.rrule = line.substring(line.indexOf(':') + 1);
      }
    }
  }

  return events;
}

// Générer un UID stable basé sur le summary et la date
function generateStableUID(summary, start) {
  const str = `${summary}_${start}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `evt_${Math.abs(hash)}`;
}

// Générer les occurrences pour aujourd'hui et les 7 prochains jours
function generateRecurrentOccurrences(event) {
  const occurrences = [];
  const originalStartStr = event.start; // Chaîne ISO avec l'heure correcte
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Fenêtre de 30 jours (aujourd'hui + 29 jours)
  const endWindow = new Date(today);
  endWindow.setDate(endWindow.getDate() + 30);
  
  // Parser la règle RRULE
  const rrule = event.rrule;
  let freq = null;
  let byDay = null;
  
  if (rrule.includes('FREQ=DAILY')) {
    freq = 'DAILY';
  } else if (rrule.includes('FREQ=WEEKLY')) {
    freq = 'WEEKLY';
    const byDayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
    if (byDayMatch) {
      byDay = byDayMatch[1].split(',');
    }
  }
  
  // Générer les occurrences
  const currentDate = new Date(today);
  
  while (currentDate <= endWindow) {
    let shouldInclude = false;
    
    if (freq === 'DAILY') {
      shouldInclude = true;
    } else if (freq === 'WEEKLY' && byDay) {
      const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
      const currentDay = currentDate.getDay();
      shouldInclude = byDay.some(day => dayMap[day] === currentDay);
    }
    
    if (shouldInclude) {
      const startStr = formatDateFromDate(currentDate, originalStartStr);
      const occurrence = {
        summary: event.summary,
        start: startStr,
        location: event.location || '',
        description: event.description || '',
        is_recurrent: 1,
        uid: generateStableUID(event.summary, startStr)
      };
      occurrences.push(occurrence);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return occurrences;
}

// Formater une date JavaScript en ISO avec l'heure de l'événement original
function formatDateFromDate(date, originalStartStr) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Extraire l'heure depuis la chaîne ISO originale (format: 2025-12-12T09:00:00+01:00)
  const timeMatch = originalStartStr.match(/T(\d{2}):(\d{2}):(\d{2})/);
  const hour = timeMatch ? timeMatch[1] : '00';
  const minute = timeMatch ? timeMatch[2] : '00';
  const second = timeMatch ? timeMatch[3] : '00';
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+01:00`;
}

// Formater une date iCalendar en ISO (heure locale Paris)
function formatDate(dateStr) {
  // Format avec heure: 20251201T080000 ou 20251201T080000Z (UTC)
  if (dateStr.length >= 15) {
    let year = parseInt(dateStr.substring(0, 4));
    let month = parseInt(dateStr.substring(4, 6)) - 1;
    let day = parseInt(dateStr.substring(6, 8));
    let hour = parseInt(dateStr.substring(9, 11));
    let minute = parseInt(dateStr.substring(11, 13));
    let second = parseInt(dateStr.substring(13, 15));
    
    if (dateStr.endsWith('Z')) {
      // Date UTC - convertir en heure Paris (UTC+1)
      hour += 1;
      // Gérer le dépassement d'heure
      if (hour >= 24) {
        hour -= 24;
        day += 1;
      }
    }
    
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const h = String(hour).padStart(2, '0');
    const min = String(minute).padStart(2, '0');
    const sec = String(second).padStart(2, '0');
    
    return `${year}-${m}-${d}T${h}:${min}:${sec}+01:00`;
  }
  
  // Format "toute la journée": 20251222 (8 caractères, sans heure)
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    // Mettre à 00:00:00 pour les événements toute la journée
    return `${year}-${month}-${day}T00:00:00+01:00`;
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

    // NOTE: Les événements terminés sont stockés dans la table completed_events
    // avec l'UID stable comme identifiant. Ils sont préservés automatiquement
    // car on ne touche pas à cette table lors de la synchro.

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
          'INSERT INTO events (summary, start, location, description, is_recurrent, uid) VALUES (?, ?, ?, ?, ?, ?)',
          [
            event.summary || '',
            event.start || '',
            event.location || '',
            event.description || '',
            event.is_recurrent || 0,
            event.uid || ''
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
