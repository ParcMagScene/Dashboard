// ===============================================
//  Fichier : server.js (frontend)
//  Rôle : Sert le frontend en HTTPS (Express statique)
//  Utilise les certificats du backend
// ===============================================

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Options SSL : lecture des certificats
const options = {
  key: fs.readFileSync(path.join(__dirname, '../backend/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../backend/cert.pem'))
};

// Sert le dossier courant (frontend) en statique
app.use(express.static(__dirname));

// Démarrage du serveur HTTPS
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend HTTPS lancé sur https://localhost:${PORT}`);
});