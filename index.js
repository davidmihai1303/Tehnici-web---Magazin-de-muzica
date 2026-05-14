const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Servire fișiere statice din rădăcina proiectului
app.use(express.static(path.join(__dirname)));

// Rută principală
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Pornire server
app.listen(PORT, () => {
  console.log(`Serverul rulează la http://localhost:${PORT}`);
});
