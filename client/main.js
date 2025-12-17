// ===============================================
//  Dashboard Calendrier - Frontend JavaScript
//  Fonctions principales pour l'affichage
// ===============================================

// Configuration de base
const API_BASE = window.location.origin;

// Règles de couleurs chargées depuis l'API
let colorRules = [];

// Événements terminés
let completedEvents = [];

// ===============================================
//  FONCTIONS UTILITAIRES
// ===============================================

// Formatage de la date
function formatDate(date) {
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('fr-FR', options);
}

// Formatage de l'heure
function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// ===============================================
//  AFFICHAGE DATE/HEURE
// ===============================================
function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('date');
  const heureElement = document.getElementById('heure');
  
  if (dateElement) {
    dateElement.textContent = formatDate(now);
  }
  
  if (heureElement) {
    heureElement.textContent = formatTime(now);
  }
}

// ===============================================
//  GESTION DU MESSAGE D'ACCUEIL
// ===============================================
async function loadWelcomeMessage() {
  try {
    const response = await fetch(`${API_BASE}/api/welcome-message`);
    const data = await response.json();
    
    const welcomeElement = document.getElementById('welcome');
    if (welcomeElement && data.message) {
      // Utiliser innerHTML avec span pour activer l'animation marquee
      welcomeElement.innerHTML = `<span>${data.message}</span>`;
    }
  } catch (error) {
    console.error('Erreur lors du chargement du message:', error);
    const welcomeElement = document.getElementById('welcome');
    if (welcomeElement) {
      // Message par défaut avec animation
      welcomeElement.innerHTML = '<span>Bienvenue !</span>';
    }
  }
}

// ===============================================
//  GESTION DES ÉVÉNEMENTS
// ===============================================

// Charger les événements terminés
async function loadCompletedEvents() {
  try {
    const response = await fetch(`${API_BASE}/api/completed-events`);
    const data = await response.json();
    completedEvents = data.completed || [];
  } catch (error) {
    console.error('Erreur chargement événements terminés:', error);
    completedEvents = [];
  }
}

// Basculer l'état terminé d'un événement
async function toggleEventComplete(eventId, li) {
  const strEventId = String(eventId);
  const isCompleted = completedEvents.includes(strEventId);
  const endpoint = isCompleted ? '/api/uncomplete-event' : '/api/complete-event';
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: strEventId })
    });
    
    if (response.ok) {
      if (isCompleted) {
        completedEvents = completedEvents.filter(id => id !== strEventId);
        li.classList.remove('event-completed');
      } else {
        completedEvents.push(strEventId);
        li.classList.add('event-completed');
      }
    }
  } catch (error) {
    console.error('Erreur toggle événement:', error);
  }
}

async function loadEvents() {
  try {
    // Charger d'abord les événements terminés
    await loadCompletedEvents();
    
    const response = await fetch(`${API_BASE}/api/events`);
    const data = await response.json();
    
    // Support de l'ancien et nouveau format
    const regularEvents = data.regular || (Array.isArray(data) ? data.filter(e => !e.is_recurrent) : []);
    const recurrentEvents = data.recurrent || (Array.isArray(data) ? data.filter(e => e.is_recurrent) : []);
    
    // Gestion des événements réguliers
    const regularEventsList = document.getElementById('regular-events-list');
    const recurrentEventsList = document.getElementById('recurrent-events-list');
    
    if (regularEventsList) {
      if (regularEvents.length === 0) {
        regularEventsList.innerHTML = '<li>Aucun événement ponctuel aujourd\'hui</li>';
      } else {
        regularEventsList.innerHTML = '';
        regularEvents.forEach(event => {
          const li = createEventElement(event);
          regularEventsList.appendChild(li);
        });
      }
    }
    
    // Gestion des événements récurrents
    if (recurrentEventsList) {
      if (recurrentEvents.length === 0) {
        recurrentEventsList.innerHTML = '<li>Aucun événement récurrent aujourd\'hui</li>';
      } else {
        recurrentEventsList.innerHTML = '';
        recurrentEvents.forEach(event => {
          const li = createEventElement(event);
          recurrentEventsList.appendChild(li);
        });
      }
    }
    
  } catch (error) {
    console.error('Erreur lors du chargement des événements:', error);
    const regularEventsList = document.getElementById('regular-events-list');
    const recurrentEventsList = document.getElementById('recurrent-events-list');
    if (regularEventsList) {
      regularEventsList.innerHTML = '<li>Erreur de chargement des événements</li>';
    }
    if (recurrentEventsList) {
      recurrentEventsList.innerHTML = '<li>Erreur de chargement des événements récurrents</li>';
    }
  }
}

// Fonction pour créer un élément d'événement
function createEventElement(event) {
  const li = document.createElement('li');
  li.className = 'event-item';
  
  // Générer un ID unique pour l'événement - TOUJOURS en string pour cohérence avec l'API
  const eventId = String(event.id || `${event.title || event.summary}_${event.start}`);
  li.dataset.eventId = eventId;
  
  // Parsing de la date selon différents formats possibles
  let startTime;
  const dateValue = event.start_time || event.start || event.startTime;
  
  if (dateValue) {
    startTime = new Date(dateValue);
    if (isNaN(startTime.getTime())) {
      startTime = new Date();
    }
  } else {
    startTime = new Date();
  }
  
  const timeStr = formatTime(startTime);
  
  // Récupérer le titre selon différents champs possibles
  const eventTitle = event.title || event.summary || event.name || 'Sans titre';
  
  // Récupérer le lieu et la description
  const eventLocation = event.location || '';
  const eventDescription = event.description || '';
  
  // Vérifier si terminé
  const isCompleted = completedEvents.includes(eventId);
  
  // Construire l'affichage en colonnes séparées (coche dans le titre uniquement si terminé)
  li.innerHTML = `
    <div class="event-columns">
      <div class="col-time">${timeStr}</div>
      <div class="col-title">${isCompleted ? '<span class="completed-icon">✅</span>' : ''}${eventTitle}</div>
      <div class="col-location">${eventLocation}</div>
      <div class="col-description">${eventDescription}</div>
    </div>
  `;
  
  // Marquer comme terminé si c'est le cas
  if (isCompleted) {
    li.classList.add('event-completed');
  }
  
  // Ajouter le gestionnaire de clic
  li.style.cursor = 'pointer';
  li.addEventListener('click', () => {
    toggleEventComplete(eventId, li);
    // Mettre à jour l'affichage après le toggle
    const titleDiv = li.querySelector('.col-title');
    if (titleDiv) {
      const hasIcon = titleDiv.querySelector('.completed-icon');
      if (li.classList.contains('event-completed')) {
        // On vient de démarquer -> retirer l'icône
        if (hasIcon) hasIcon.remove();
      } else {
        // On vient de marquer -> ajouter l'icône
        if (!hasIcon) {
          titleDiv.insertAdjacentHTML('afterbegin', '<span class="completed-icon">✅</span>');
        }
      }
    }
  });
  
  // Application des couleurs personnalisées depuis les règles de l'API
  const searchText = `${eventTitle} ${eventLocation}`.toLowerCase();
  
  for (const rule of colorRules) {
    if (searchText.includes(rule.keyword.toLowerCase())) {
      li.style.setProperty('--event-color', rule.color);
      if (!li.classList.contains('event-completed')) {
        li.style.color = rule.color;
      }
      break;
    }
  }
  
  // Clignotement pour les événements urgents (contenant !)
  if (eventTitle.includes('!') && !isCompleted) {
    li.classList.add('event-urgent');
  }
  
  return li;
}

// ===============================================
//  GESTION DE LA MÉTÉO
// ===============================================
async function loadWeather() {
  try {
    // Charger la configuration pour vérifier si la météo doit être affichée
    const configResponse = await fetch(`${API_BASE}/api/config`);
    const config = await configResponse.json();
    
    const weatherElement = document.getElementById('weather');
    
    // Si showWeather est false, masquer l'élément météo
    if (!config.showWeather) {
      if (weatherElement) {
        weatherElement.style.display = 'none';
      }
      return;
    }
    
    // Sinon, afficher la météo normalement
    if (weatherElement) {
      weatherElement.style.display = 'block';
    }
    
    const response = await fetch(`${API_BASE}/api/weather`);
    const weatherData = await response.json();
    
    if (weatherElement && weatherData && !weatherData.error) {
      let weatherText = `${weatherData.temperature}°C`;
      
      if (weatherData.description) {
        weatherText += ` • ${weatherData.description}`;
      }
      
      if (weatherData.windSpeed) {
        weatherText += ` • ${weatherData.windSpeed} km/h`;
      }
      
      // Ajouter une icône météo selon le code
      const weatherIcon = getWeatherIcon(weatherData.icon);
      weatherText = `${weatherIcon} ${weatherText}`;
      
      weatherElement.textContent = weatherText;
    } else {
      const weatherElement = document.getElementById('weather');
      if (weatherElement) {
        weatherElement.textContent = '🌡️ Météo indisponible';
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la météo:', error);
    const weatherElement = document.getElementById('weather');
    if (weatherElement) {
      weatherElement.textContent = '';
    }
  }
}

// ===============================================
//  ICÔNES MÉTÉO
// ===============================================
function getWeatherIcon(iconCode) {
  const iconMap = {
    '01d': '☀️', // clear sky day
    '01n': '🌙', // clear sky night
    '02d': '🌤️', // few clouds day
    '02n': '☁️', // few clouds night
    '03d': '☁️', // scattered clouds
    '03n': '☁️',
    '04d': '☁️', // broken clouds
    '04n': '☁️',
    '09d': '🌧️', // shower rain
    '09n': '🌧️',
    '10d': '🌦️', // rain day
    '10n': '🌧️', // rain night
    '11d': '⛈️', // thunderstorm
    '11n': '⛈️',
    '13d': '❄️', // snow
    '13n': '❄️',
    '50d': '🌫️', // mist
    '50n': '🌫️'
  };
  
  return iconMap[iconCode] || '🌡️';
}

// ===============================================
//  GESTION DES RÈGLES DE COULEURS
// ===============================================
async function loadColorRules() {
  try {
    const response = await fetch(`${API_BASE}/api/event-color-rules`);
    const data = await response.json();
    colorRules = data.rules || [];
    console.log('Règles de couleurs chargées:', colorRules);
  } catch (error) {
    console.error('Erreur lors du chargement des règles de couleurs:', error);
  }
}

// ===============================================
//  INITIALISATION
// ===============================================
async function init() {
  console.log('🚀 Dashboard Calendrier - Initialisation...');
  
  // Charger d'abord les règles de couleurs (nécessaire avant les événements)
  await loadColorRules();
  
  // Mise à jour immédiate
  updateDateTime();
  loadWelcomeMessage();
  loadEvents();
  loadWeather();
  loadSonosNowPlaying();
  
  // Mise à jour périodique
  setInterval(updateDateTime, 1000); // Chaque seconde pour l'heure
  setInterval(loadWelcomeMessage, 300000); // Toutes les 5 minutes pour le message
  setInterval(loadEvents, 60000); // Chaque minute pour les événements
  setInterval(loadWeather, 600000); // Toutes les 10 minutes pour la météo
  setInterval(loadSonosNowPlaying, 5000); // Toutes les 5 secondes pour Sonos
  
  // Démarrer le défilement automatique des événements
  startAutoScroll();
  
  console.log('✅ Dashboard initialisé avec succès');
}

// ===============================================
//  INTÉGRATION SONOS
// ===============================================
async function loadSonosNowPlaying() {
  try {
    const response = await fetch(`${API_BASE}/api/sonos-now-playing`);
    const data = await response.json();
    
    const widget = document.getElementById('sonos-widget');
    const albumArt = document.getElementById('sonos-album-art');
    const title = document.getElementById('sonos-title');
    const artist = document.getElementById('sonos-artist');
    
    if (data.playing && data.title) {
      // Afficher le widget
      widget.style.display = 'flex';
      albumArt.src = data.albumArt || '/api/logo';
      title.textContent = data.title;
      artist.textContent = data.artist;
    } else {
      // Masquer le widget
      widget.style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur lors du chargement de Sonos:', error);
    const widget = document.getElementById('sonos-widget');
    if (widget) widget.style.display = 'none';
  }
}

// ===============================================
//  DÉFILEMENT AUTOMATIQUE DES ÉVÉNEMENTS
// ===============================================
function startAutoScroll() {
  const mainElement = document.querySelector('main');
  if (!mainElement) return;
  
  let scrollPosition = 0;
  const scrollSpeed = 0.5; // Vitesse de défilement (pixels par frame)
  const pauseAtBottom = 3000; // Pause en bas (ms)
  const pauseAtTop = 2000; // Pause en haut (ms)
  let isPaused = false;
  
  function scroll() {
    if (isPaused) return;
    
    const maxScroll = mainElement.scrollHeight - mainElement.clientHeight;
    
    // Si on peut scroller
    if (maxScroll > 0) {
      scrollPosition += scrollSpeed;
      
      // Si on atteint le bas
      if (scrollPosition >= maxScroll) {
        scrollPosition = maxScroll;
        isPaused = true;
        setTimeout(() => {
          scrollPosition = 0;
          mainElement.scrollTop = 0;
          isPaused = true;
          setTimeout(() => {
            isPaused = false;
          }, pauseAtTop);
        }, pauseAtBottom);
      }
      
      mainElement.scrollTop = scrollPosition;
    }
  }
  
  // Démarrer l'animation
  setInterval(scroll, 16); // ~60 FPS
}

// ===============================================
//  RAFRAÎCHISSEMENT AUTOMATIQUE
// ===============================================
// Rafraîchir les événements toutes les 10 secondes pour synchroniser avec l'admin
setInterval(() => {
  loadEvents();
}, 10000);


// ===============================================
//  DÉMARRAGE AUTOMATIQUE
// ===============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}