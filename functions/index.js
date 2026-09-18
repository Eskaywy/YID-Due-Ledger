/**
 * Firebase Cloud Functions entry-point for the YID Due Ledger API.
 *
 * The entire Express app (server.js) is reused as a single HTTPS function.
 * Firebase Hosting rewrites /api/* requests to this function, so the API
 * and static frontend share the same domain in production.
 */
const { onRequest } = require("firebase-functions/v2/https");
const app = require("../server.js");

exports.api = onRequest(app);
