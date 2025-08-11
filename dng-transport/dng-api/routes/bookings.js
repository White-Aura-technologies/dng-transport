// routes/bookings.js
const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBookingByCode,
  confirmPayment
} = require('../controllers/bookingsController');

// Mount under /api to sit alongside your existing admin routes
// Add in server.js: app.use(require('./routes/bookings'));

router.post('/api/bookings', createBooking);
router.get('/api/bookings/:code', getBookingByCode);
router.post('/api/payments/confirm', confirmPayment);

module.exports = router;
