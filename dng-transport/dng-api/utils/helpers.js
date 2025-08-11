// utils/helpers.js

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid 0/O/1/I for readability

function generateBookingNumber(len = 16) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  }
  return out;
}

function toMoneyString(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

module.exports = {
  generateBookingNumber,
  toMoneyString
};
