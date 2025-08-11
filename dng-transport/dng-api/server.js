// admin-api/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS: allow your admin subdomain(s) BEFORE routes
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: false,
}));

// Use the shared MySQL pool (unified with controllers)
const pool = require('./db/db');

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// List bookings with filters + pagination + sorting
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const {
      q = '', destination = '', status = '',
      page = '1', limit = '20', sort = 'created_at', dir = 'desc'
    } = req.query;

    const allowedSort = new Set(['created_at','price','full_name','destination','status','booking_number']);
    const allowedDir = new Set(['asc','desc']);
    const sortCol = allowedSort.has(String(sort)) ? String(sort) : 'created_at';
    const sortDir = allowedDir.has(String(dir).toLowerCase()) ? String(dir).toLowerCase() : 'desc';

    const where = [];
    const params = [];

    if (q) {
      where.push(`(full_name LIKE ? OR phone LIKE ? OR booking_number LIKE ? OR payer_name LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (destination) {
      where.push(`destination = ?`);
      params.push(destination);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT id, full_name, phone, payer_name, destination, pickup_point, bus_type, price, booking_number, status, source, created_at
         FROM bookings
         ${whereSql}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      const [[{ total }]] = await conn.query(
        `SELECT COUNT(*) as total FROM bookings ${whereSql}`,
        params
      );

      res.json({ rows, total, page: pageNum, limit: limitNum });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update status
app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = new Set(['Pending', 'Paid', 'Confirmed', 'Cancelled']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' });

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    } finally {
      conn.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete booking
app.delete('/api/admin/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(`DELETE FROM bookings WHERE id = ?`, [id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    } finally {
      conn.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CSV export (applies same filters)
app.get('/api/admin/export', async (req, res) => {
  try {
    const { q = '', destination = '', status = '' } = req.query;

    const where = [];
    const params = [];

    if (q) {
      where.push(`(full_name LIKE ? OR phone LIKE ? OR booking_number LIKE ? OR payer_name LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (destination) {
      where.push(`destination = ?`);
      params.push(destination);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT booking_number, created_at, full_name, phone, payer_name, destination, pickup_point, bus_type, price, status, source
         FROM bookings
         ${whereSql}
         ORDER BY created_at DESC`,
        params
      );

     res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');

const header = 'BookingNumber,CreatedAt,FullName,Phone,PayerName,Destination,PickupPoint,BusType,Price,Status,Source\n';
const csv = rows.map(r => [
  r.booking_number,
  new Date(r.created_at).toISOString().replace('T',' ').slice(0,19),
  r.full_name,
  r.phone,
  r.payer_name,
  r.destination,
  r.pickup_point,
  r.bus_type,
  Number(r.price).toFixed(2),
  r.status,
  r.source
].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');

res.send(header + csv);

    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mount public booking routes once (after CORS)
app.use(require('./routes/bookings'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Admin API listening on :${PORT}`));
