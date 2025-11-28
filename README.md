# 📅 Dashboard Calendrier

Dashboard de calendrier avec backend Node.js et frontend simple, optimisé pour Raspberry Pi.

## 🚀 Démarrage rapide

### Serveur (Mac/Linux)
```bash
cd backend
npm install
node index.js
```
Dashboard accessible sur : `http://192.168.205.75:3001/`

### Raspberry Pi
```bash
# Transférer le package
./transfer-fixed-to-pi.sh

# Sur le Pi
tar -xzf raspberry-pi-dashboard-IP-FIXED-*.tar.gz
cd raspberry-pi/
chmod +x *.sh
./install-pi.sh
```

## 📁 Structure

```
├── backend/           # Serveur Node.js (port 3001)
│   ├── index.js      # Serveur principal
│   ├── calendar.db   # Base SQLite
│   └── uploads/      # Assets (logo)
├── frontend/          # Interface web
│   ├── index.html    # Page principale
│   ├── config.js     # Configuration
│   └── main.js       # Logique frontend
└── raspberry-pi/      # Scripts Raspberry Pi
    ├── install-pi.sh # Installation automatique
    └── README.md     # Guide Pi
```

## 🔧 Configuration

- **Backend URL** : Configuré automatiquement via `window.location.origin`
- **Port** : 3001 (HTTP)
- **Base de données** : SQLite avec sync Google Calendar
- **Admin** : `http://192.168.205.75:3001/admin`

## 📋 API

- `GET /api/welcome-message` - Message d'accueil
- `GET /api/events` - Événements du jour
- `POST /api/welcome-message` - Modifier le message

## 🎯 Production (Raspberry Pi)

Le script `install-pi.sh` configure :
- Chromium en mode kiosk
- Autostart au démarrage
- Dashboard en plein écran

---
*Dernière mise à jour : 27 octobre 2025*