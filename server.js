const express = require('express');
const { Pool }  = require('pg');
const cors      = require('cors');
const path      = require('path');

const app    = express();
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const SECRET = process.env.API_SECRET;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Create table on first boot
pool.query(`
  CREATE TABLE IF NOT EXISTS tayfinance (
    id         TEXT PRIMARY KEY,
    payload    JSONB        NOT NULL,
    updated_at TIMESTAMPTZ  DEFAULT NOW()
  )
`).catch(console.error);

function auth(req, res, next) {
  if (!SECRET || req.headers['x-api-key'] === SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// GET /data — load all data
app.get('/data', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT payload FROM tayfinance WHERE id = $1', ['main']);
    res.json(r.rows[0]?.payload ?? {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /data — save all data
app.post('/data', auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO tayfinance(id, payload) VALUES('main', $1)
       ON CONFLICT(id) DO UPDATE SET payload = $1, updated_at = NOW()`,
      [req.body]
    );
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TayFinance API on :${PORT}`));
