const { fdb } = require('../database/db');

async function listEvents(req, res) {
  const requested = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 50, 1), 500);

  try {
    const events = await fdb.getAll(
      'events',
      [{ field: 'store_id', value: req.user.storeId }],
      { orderBy: 'timestamp', orderDir: 'desc', limit }
    );
    res.json(events);
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({ error: 'Impossible de charger le journal des événements.' });
  }
}

module.exports = {
  listEvents
};
