// server/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Main entry point for the Tab Out server.
//
// This file:
//   1. Creates the web server (Express)
//   2. Serves the dashboard HTML/CSS/JS files
//   3. Hooks up all the API routes (defined in routes.js)
//   4. Starts listening on the configured port
//
// The server does NOT call the LLM on startup or on a schedule.
// LLM calls only happen when the user explicitly clicks "Organize with AI"
// on the dashboard. This keeps token costs at zero unless the user asks for it.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const path    = require('path');
const config  = require('./config');

// The update checker polls GitHub every 6 hours for new commits.
// We import it here so we can start it after the server is ready.
const { startUpdateChecker } = require('./updater');

const app = express();

// Allow requests from the Chrome extension.
// The extension's background script runs on the "chrome-extension://..." origin,
// which is different from "http://localhost:3456". Without these headers, Chrome
// blocks those cross-origin requests (CORS error).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse JSON request bodies (for POST endpoints)
app.use(express.json());

// Serve the dashboard's static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// Mount API routes under /api
const apiRouter = require('./routes');
app.use('/api', apiRouter);

// Start the server
app.listen(config.port, () => {
  console.log(`Tab Out running at http://localhost:${config.port}`);

  // Kick off the update checker AFTER the server is listening.
  // This way, even if the first GitHub check takes a few seconds,
  // the server is already ready to handle requests.
  startUpdateChecker();
});
