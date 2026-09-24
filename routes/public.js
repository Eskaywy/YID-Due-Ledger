const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

// ── Public, unauthenticated content for the landing page ─────────────────────
// The landing page (Flutter Web) fetches the next published event to drive the
// countdown timer. We return server time alongside the event so the client can
// correct for a skewed device clock (approved plan §2.2).

// GET /api/public/events/next
// → { event: {...} | null, server_time_utc: ISO string }
router.get('/events/next', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1);

    if (error) throw error;

    // Cache briefly at the CDN/edge; the countdown only changes each second.
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      event: data?.[0] || null,
      server_time_utc: new Date().toISOString(),
    });
  } catch (err) {
    console.error('public/events/next failed:', err);
    // Never fail the landing page outright — return an empty payload so the
    // hero still renders without a countdown.
    res.set('Cache-Control', 'public, max-age=10');
    res.json({ event: null, server_time_utc: new Date().toISOString() });
  }
});

module.exports = router;
