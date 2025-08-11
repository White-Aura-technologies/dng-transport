// controllers/bookingsController.js
const pool = require('../db/db');
const { generateBookingNumber, toMoneyString } = require('../utils/helpers');

// POST /api/bookings
// Creates a booking from the public/client side.
// Inserts values your admin endpoints expect to list/export.
exports.createBooking = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      destination,
      pickup_point,
      bus_type,
      price,
      payer_name // optional; will default to full_name
    } = req.body || {};

    // Basic validation (keep UI/UX unchanged; just server-side guardrails)
    if (!full_name || !phone || !destination || !pickup_point || !bus_type || price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const priceStr = toMoneyString(price);
    if (priceStr == null) return res.status(400).json({ error: 'Invalid price' });

    // Generate unique booking_number with a few retries on collision
    let booking_number, insertResult;
    for (let attempt = 0; attempt < 5; attempt++) {
      booking_number = generateBookingNumber(16);
      const tryPayer = (payer_name && String(payer_name).trim()) || String(full_name).trim();
      try {
        const [result] = await pool.execute(
          `INSERT INTO bookings
            (full_name, phone, payer_name, destination, pickup_point, bus_type, price, booking_number, status, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'client')`,
          [
            String(full_name).trim(),
            String(phone).trim(),
            tryPayer,
            String(destination).trim(),
            String(pickup_point).trim(),
            String(bus_type).trim(),
            priceStr,
            booking_number
          ]
        );
        insertResult = result;
        break;
      } catch (e) {
        // Retry only on duplicate booking_number collisions
        if (e && e.code === 'ER_DUP_ENTRY') continue;
        throw e;
      }
    }

    if (!insertResult || !insertResult.insertId) {
      return res.status(500).json({ error: 'Could not create booking' });
    }

    return res.status(201).json({
      id: insertResult.insertId,
      booking_number,
      status: 'Pending'
    });
  } catch (err) {
    console.error('createBooking error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/bookings/:code
// Fetch a single booking by booking_number (used by client to check status).
exports.getBookingByCode = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Invalid code' });

    const [rows] = await pool.execute(
      `SELECT id, full_name, phone, payer_name, destination, pickup_point, bus_type,
              price, booking_number, status, source, created_at, transaction_ref
         FROM bookings
        WHERE booking_number = ?
        LIMIT 1`,
      [code]
    );

    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('getBookingByCode error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/payments/confirm
// Client submits MoMo transaction reference; we store it and move to 'Paid'.
exports.confirmPayment = async (req, res) => {
  try {
    const { booking_number, transaction_ref, payer_name } = req.body || {};
    const code = String(booking_number || '').trim().toUpperCase();
    const ref = String(transaction_ref || '').trim();

    if (!code || !ref) {
      return res.status(400).json({ error: 'booking_number and transaction_ref are required' });
    }

    // Update transaction_ref and set status to 'Paid'. Keep payer_name if provided for admin search.
    const [result] = await pool.execute(
      `UPDATE bookings
          SET transaction_ref = ?,
              status = 'Paid',
              payer_name = COALESCE(?, payer_name)
        WHERE booking_number = ?`,
      [ref, payer_name ? String(payer_name).trim() : null, code]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Booking not found' });

    return res.json({ ok: true, status: 'Paid' });
  } catch (err) {
    console.error('confirmPayment error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
