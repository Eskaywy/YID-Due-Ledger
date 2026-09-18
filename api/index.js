// Vercel Serverless Function wrapper for the Express app
//
// This file bridges the Express app (in server.js) to Vercel's
// serverless function runtime. Vercel @vercel/node expects a
// function with signature: (req, res) => void
//
// The Express app is exported from server.js as `module.exports = app;`
// and we create a lightweight HTTP listener adapter for Vercel.

const app = require('../server.js');

// Vercel provides req as an object with method, url, headers, body, etc.
// We convert it to what Express expects and pipe the response back.

module.exports = (req, res) => {
  // Vercel already parses JSON bodies; forward them to Express
  app(req, res);
};
