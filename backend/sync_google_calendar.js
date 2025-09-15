// ===============================================
//  Fichier : sync_google_calendar.js
//  Rôle : Synchronisation automatique Google Calendar → SQLite
//  Ce script interroge l’API Google Calendar et insère les événements du jour dans la table events
//  Toutes les fonctions sont commentées pour faciliter la maintenance
// ===============================================
const axios = require('axios');
require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { insertEvents } = require('./utils');
const DB_PATH = path.join(__dirname, 'calendar.db');
const db = new sqlite3.Database(DB_PATH);
const CALENDAR_ID = process.env.CALENDAR_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

async function fetchGoogleEvents() {
// -------------------------------------------------
// Fonction : fetchGoogleEvents
// Récupère les événements du jour depuis Google Calendar
// Retourne un tableau d'événements (format Google API)
// -------------------------------------------------
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?key=${API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
  try {
    const res = await axios.get(url);
    return res.data.items || [];
  } catch (err) {
    console.error('Erreur Google Calendar:', err.response?.data || err.message);
    return [];
  }
}

function clearEventsForToday() {
// -------------------------------------------------
// Fonction : clearEventsForToday
// Supprime tous les événements du jour dans la table events
// Permet d'éviter les doublons lors de la synchronisation
// -------------------------------------------------
  // Supprime tous les événements dont la date commence par AAAA-MM-JJ
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${yyyy}-${mm}-${dd}`;
  db.run('DELETE FROM events WHERE start LIKE ?', [`${datePrefix}%`]);
}

// Utilise la fonction utilitaire partagée

async function syncGoogleCalendar() {
// -------------------------------------------------
// Fonction principale : syncGoogleCalendar
// Lance la suppression des événements du jour puis la récupération et l'insertion des nouveaux événements
// -------------------------------------------------
  clearEventsForToday();
  const events = await fetchGoogleEvents();
  insertEvents(events);
  console.log(`Synchronisation Google Calendar terminée. ${events.length} évènement(s) importé(s).`);
}

module.exports = { syncGoogleCalendar };
