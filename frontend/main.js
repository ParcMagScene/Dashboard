// Variable globale pour l'intervalle de scroll des événements
let scrollInterval = null;

// ===============================================
//  Fichier : main.js (frontend)
//  Rôle : Affichage dynamique du dashboard calendrier
//  - Lecture Spotify en cours
//  - Affichage date/heure
//  - Application de la configuration
//  - Affichage des événements du jour
//  Toutes les fonctions sont commentées pour faciliter la maintenance
// ===============================================
// ===============================
//   FONCTION : Lecture Spotify   
// ===============================
// Récupère et affiche la lecture Spotify en cours dans le footer
async function fetchSpotifyCurrent() {
  try {
    const res = await fetch(`${backendUrl}/api/spotify/current`);
    const data = await res.json();
    const div = document.getElementById('spotify-current');
    if (data && data.name) {
      let txt = ` ${data.name}`;
      if (data.artist) txt += ` — ${data.artist}`;
      if (data.album) txt += ` (${data.album})`;
      // Affichage de la pochette si disponible
      div.innerHTML = '';
      if (data.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.alt = 'Pochette album';
        img.style.height = '2em';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '0.7em';
        div.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = txt;
      span.style.color = getComputedStyle(document.body).getPropertyValue('--primary-color') || '#1976d2';
      div.appendChild(span);
    } else {
      div.textContent = '';
    }
  } catch (err) {
    document.getElementById('spotify-current').textContent = '';
  }
}
// ...existing code...

// ===============================
//   FONCTION : Date & Heure      
// ===============================
// Met à jour la date et l'heure dans le header
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('date').textContent = dateStr;
  document.getElementById('heure').textContent = heureStr;
}

// ===============================
//   CONFIGURATION BACKEND        
// ===============================
// URL du backend (modifiez si besoin)
const backendUrl = 'https://192.168.205.56:3001';

// Récupère la configuration du backend
async function fetchConfig() {
  const res = await fetch(`${backendUrl}/api/config`);
  return res.json();
}

// Récupère et affiche le logo entreprise
async function fetchLogo() {
  const res = await fetch(`${backendUrl}/api/events`);
  if (res.ok) {
    document.getElementById('logo').src = `${backendUrl}/api/logo`;
  }
}

// Applique la configuration (couleurs, police) et affiche le message d'accueil dynamique
async function applyConfig() {
  const config = await fetchConfig();
  const welcome = document.getElementById('welcome');
  welcome.innerHTML = '';
  // Récupère le message d'accueil dynamique via l'API dédiée
  try {
    const res = await fetch(`${backendUrl}/api/welcome-message`);
    const data = await res.json();
    if (data && data.message) {
      const span = document.createElement('span');
      span.textContent = data.message;
      welcome.appendChild(span);
    }
  } catch {
    // En cas d'erreur, on affiche le message statique de config
    if (config.welcomeMessage) {
      const span = document.createElement('span');
      span.textContent = config.welcomeMessage;
      welcome.appendChild(span);
    }
  }
  document.body.style.setProperty('--primary-color', config.primaryColor || '#1976d2');
  document.body.style.setProperty('--secondary-color', config.secondaryColor || '#fff');
  document.body.style.setProperty('--font-family', config.fontFamily || 'Arial, sans-serif');
  document.body.style.setProperty('--event-bg-color', config.eventBgColor || '#000000');
  document.body.style.setProperty('--event-text-color', config.eventTextColor || '#ffffff');
}

// ===============================
//   FONCTION : Événements        
// ===============================
// Récupère et affiche la liste des événements du jour
async function fetchEvents() {
  try {
    const res = await fetch(`${backendUrl}/api/events`);
    if (!res.ok) throw new Error('Erreur API');
    const events = await res.json();
    const list = document.getElementById('events-list');
  list.innerHTML = '';
  list.classList.remove('scrolling');
    if (!events || events.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Aucun événement à afficher.';
      li.style.color = 'red';
      li.style.fontWeight = 'bold';
      list.appendChild(li);
    } else {
      // Séparation des événements "Fermeture du dépôt" à 18h00
      const staticEvents = [];
      const normalEvents = [];
      events.forEach(ev => {
        let heure = '';
        if (ev.start) {
          const dateObj = new Date(ev.start);
          heure = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
        let isFermetureDepot = ev.summary && /fermeture du dépôt/i.test(ev.summary) && heure === '18:00';
        if (isFermetureDepot) {
          staticEvents.push(ev);
        } else {
          normalEvents.push(ev);
        }
      });

      // Fonction utilitaire pour générer un <li> événement
      function createEventLi(ev, isStatic = false) {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        let heure = '';
        if (ev.start) {
          const dateObj = new Date(ev.start);
          heure = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
        let lieu = ev.location || ev.lieu || '';
        let color = isStatic ? (getComputedStyle(document.body).getPropertyValue('--primary-color') || '#1976d2') : '#fff';
        if (!isStatic) {
          if (lieu && /presta/i.test(lieu)) color = '#0074d9';
          else if (lieu && /loc/i.test(lieu)) color = '#2ecc40';
        }
        li.style.color = color;
        li.style.borderRadius = '0';
        li.style.marginBottom = '0.5em';
        if (isStatic) li.style.background = '#000';
        const pastille = document.createElement('span');
        pastille.style.display = 'inline-block';
        pastille.style.width = '0.6em';
        pastille.style.height = '0.6em';
        pastille.style.borderRadius = '50%';
        pastille.style.background = color;
        pastille.style.marginRight = '0.7em';
        pastille.style.border = '1px solid #ccc';
        const left = document.createElement('span');
        left.appendChild(pastille);
        left.appendChild(document.createTextNode(isStatic ? `18:00 - Fermeture du dépôt` : `${heure} - ${ev.summary}`));
        const right = document.createElement('span');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        if (lieu && lieu.trim() !== '') {
          const lieuSpan = document.createElement('span');
          lieuSpan.textContent = lieu;
          lieuSpan.style.color = color;
          lieuSpan.style.fontWeight = 'bold';
          lieuSpan.style.marginRight = '1em';
          right.appendChild(lieuSpan);
        }
        const descriptionSpan = document.createElement('span');
        descriptionSpan.textContent = ev.description || '';
        descriptionSpan.style.color = color;
        right.appendChild(descriptionSpan);
        li.appendChild(left);
        li.appendChild(right);
        return li;
      }

      // Affichage des événements normaux (avec scroll)
      normalEvents.forEach(ev => {
        list.appendChild(createEventLi(ev));
      });
      // Affichage statique en bas de liste des "Fermeture du dépôt" à 18h00
      staticEvents.forEach(ev => {
        list.appendChild(createEventLi(ev, true));
      });
      // Scroll JS cyclique : déplace le premier événement en bas avec animation
      const scrollEnabled = localStorage.getItem('scrollEnabled') !== 'false';
      if (events.length > 3 && scrollEnabled) {
        if (scrollInterval) clearInterval(scrollInterval);
        scrollInterval = setInterval(() => {
          if (list.children.length > 0) {
            const first = list.children[0];
            first.classList.add('event-scroll');
            first.addEventListener('transitionend', function handler() {
              first.classList.remove('event-scroll');
              list.appendChild(first);
              first.removeEventListener('transitionend', handler);
            });
          }
        }, 5000);
      } else {
        if (scrollInterval) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      }
    }
  } catch (err) {
    console.error('Erreur lors de la récupération des événements:', err);
    document.getElementById('events-list').innerHTML = '<li>Impossible de charger les événements.</li>';
  }
}

// ===============================
//   INITIALISATION DE LA PAGE    
// ===============================
// Lance tous les fetch et timers au chargement
window.addEventListener('DOMContentLoaded', () => {
  fetchLogo(); // Affiche le logo
  applyConfig(); // Applique la config (couleurs, message)
  fetchEvents(); // Affiche les événements
  updateDateTime(); // Affiche la date/heure
  setInterval(updateDateTime, 1000); // Met à jour la date/heure chaque seconde
  fetchSpotifyCurrent(); // Affiche la lecture Spotify
  setInterval(fetchSpotifyCurrent, 10000); // Met à jour Spotify toutes les 10s
  // Rafraîchissement automatique de la page toutes les minutes
  setInterval(() => { window.location.reload(); }, 60000);
});