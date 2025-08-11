// DNG Booking Logic + MoMo Confirmation + Backend Save
document.addEventListener('DOMContentLoaded', () => {
  const API_BOOKINGS_URL = '/api/bookings'; // backend endpoint
  const MOMO_NUMBER_DISPLAY = '0598106751';
  const MOMO_NUMBER_INTL = '233598106751';
  const MOMO_NAME = 'EMMANUEL ODURO WOOD';
  const WHATSAPP_NUMBER_LINK = `https://wa.me/${MOMO_NUMBER_INTL}`;

  // Elements
  const form = document.getElementById('bookingForm');
  const destinationSelect = document.getElementById('destination');
  const pickupSelect = document.getElementById('pickupPoint');
  const priceEl = document.getElementById('price');
  const sprinterCard = document.getElementById('sprinterOption');
  const vipCard = document.getElementById('vipOption');

  const currency = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2
  });

  const destinationCodes = {
    'Kumasi': 'KUM',
    'Tema': 'TM',
    'Ashaiman': 'ASH',
    'Madina/Adenta': 'MAD',
    'Kaneshie': 'KAN',
    'Koforidua': 'KOF',
    'Akim Oda': 'AOD',
    'Pokuase': 'POK'
  };

  const lsGet = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const defaultCounters = Object.fromEntries(Object.keys(destinationCodes).map(d => [d, { sprinter: 0, vip: 0 }]));
  const bookingCounters = lsGet('dng_booking_counters', defaultCounters);

  const getCheckedBusType = () => document.querySelector('input[name="busType"]:checked')?.value || 'sprinter';

  const selectCard = (card) => {
    document.querySelectorAll('.bus-type-option').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const input = card.querySelector('input[name="busType"]');
    if (input) input.checked = true;
  };

  const isVipAvailableFor = (opt) =>
    !!opt && opt.dataset && opt.dataset.priceVip !== undefined && opt.dataset.priceVip !== '';

  function updateBusTypeAvailability() {
    const opt = destinationSelect?.selectedOptions?.[0];
    const hasVIP = isVipAvailableFor(opt);
    if (vipCard) {
      vipCard.style.display = hasVIP ? '' : 'none';
      const vipInput = vipCard.querySelector('input[name="busType"]');
      if (vipInput) vipInput.disabled = !hasVIP;
      if (!hasVIP && vipInput?.checked) selectCard(sprinterCard);
    }
  }

  function updatePrice() {
    const opt = destinationSelect?.selectedOptions?.[0];
    if (!opt || !opt.value) {
      priceEl.textContent = 'Price: GHS 0.00';
      return;
    }
    const busType = getCheckedBusType();

    let price = 0;
    if (busType === 'vip' && opt.dataset.priceVip) {
      price = Number(opt.dataset.priceVip);
    } else if (busType === 'sprinter' && opt.dataset.priceSprinter) {
      price = Number(opt.dataset.priceSprinter);
    } else if (opt.dataset.price) {
      price = Number(opt.dataset.price);
    }
    if (!Number.isFinite(price)) price = 0;

    priceEl.textContent = `Price: ${currency.format(price)}`;
    return price;
  }

  function validatePhoneGH(phoneRaw) {
    const p = (phoneRaw || '').replace(/\s+/g, '');
    return /^0\d{9}$/.test(p) || /^233\d{9}$/.test(p);
  }

  function nextBookingNumber(destination, busType) {
    bookingCounters[destination] ||= { sprinter: 0, vip: 0 };
    bookingCounters[destination][busType] = (bookingCounters[destination][busType] || 0) + 1;
    const count = bookingCounters[destination][busType];
    const prefix = busType === 'vip' ? '50' : '10';
    const seatIndex = Math.min(count, busType === 'vip' ? 50 : 21);
    const code = `${destinationCodes[destination]}/${prefix}${seatIndex}-${Date.now().toString().slice(-5)}`;
    lsSet('dng_booking_counters', bookingCounters);
    return code;
  }

  function buildWaMessage(b) {
    const lines = [
      `Hello, I just made a booking and will send my MoMo screenshot.`,
      `Name: ${b.fullName}`,
      `Phone: ${b.phone}`,
      `Destination: ${b.destination}`,
      `Pickup: ${b.pickupPoint}`,
      `Bus: ${b.busType === 'vip' ? 'VIP' : 'Sprinter'}`,
      `Amount: ${currency.format(b.price)}`,
      `Reference: ${b.bookingNumber}`,
      ``,
      `I’ll attach the payment screenshot here.`
    ];
    return encodeURIComponent(lines.join('\n'));
  }


function showConfirmation(booking) {
    const overlay = document.getElementById('confirmOverlay');
    const title = document.getElementById('bookingRefTitle');
    const details = document.getElementById('bookingDetails');
    const whatsappLink = document.getElementById('whatsappLink');

    if (!overlay || !title || !details || !whatsappLink) return;

    title.textContent = `Booking Created • ${booking.bookingNumber}`;
    details.innerHTML = `
      <p>Hi ${booking.fullName}, your booking has been recorded.</p>
      <ul>
        <li><strong>Destination:</strong> ${booking.destination}</li>
        <li><strong>Pickup Point:</strong> ${booking.pickupPoint}</li>
        <li><strong>Bus Type:</strong> ${booking.busType === 'vip' ? 'VIP Bus' : 'Sprinter Bus'}</li>
        <li><strong>Amount:</strong> ${currency.format(booking.price)}</li>
        <li><strong>Reference:</strong> <code>${booking.bookingNumber}</code></li>
        <li><strong>Payer:</strong> ${booking.payerName}</li>
      </ul>
      <div style="background:#f9fbff; border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-top:12px;">
        <p><strong>Mobile Money Payment (Manual)</strong></p>
        <ol>
          <li>Send ${currency.format(booking.price)} to <strong>${MOMO_NUMBER_DISPLAY}</strong> (${MOMO_NAME}).</li>
          <li>Please use: <strong>${booking.payerName}</strong> as the payer name.</li>
          <li>Keep the MoMo SMS as receipt. Then send the screenshot of MoMo confirmation message on WhatsApp.</li>
        </ol>
        <p style="color:#6b7280; font-size:0.9rem;">Support: 0598106751 • 0595223640 • 0246962314</p>
      </div>
    `;

    whatsappLink.href = `${WHATSAPP_NUMBER_LINK}?text=${buildWaMessage(booking)}`;
  overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  document.querySelectorAll('.bus-type-option').forEach(card => {
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
    const activate = () => { selectCard(card); updatePrice(); };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  destinationSelect.addEventListener('change', () => {
    updateBusTypeAvailability();
    updatePrice();
  });

  // Initial state
  const initiallyChecked = document.querySelector('.bus-type-option input[name="busType"]:checked');
  if (initiallyChecked) selectCard(initiallyChecked.closest('.bus-type-option'));
  updateBusTypeAvailability();
  updatePrice();

  // Submit: validate, save to backend, then show MoMo instructions
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = (document.getElementById('fullName').value || '').trim();
    const phone = (document.getElementById('phone').value || '').trim();
    const payerName = (document.getElementById('payerName').value || '').trim();
    const destination = destinationSelect.value;
    const pickupPoint = pickupSelect.value;
    const busType = getCheckedBusType();
    const price = updatePrice() || 0;

    if (!fullName || !phone || !payerName || !destination || !pickupPoint) {
      alert('Please complete all required fields.');
      return;
    }

    if (!validatePhoneGH(phone)) {
      alert('Enter a valid Ghana phone number (e.g., 059XXXXXXX or 23359XXXXXXX).');
      return;
    }

    if (price <= 0) {
      alert('Please select a valid destination to get the correct price.');
      return;
    }

    const bookingNumber = nextBookingNumber(destination, busType);
    const booking = {
      fullName,
      phone,
      payerName,
      destination,
      pickupPoint,
      busType,
      price,
      bookingNumber,
      createdAt: new Date().toISOString(),
      source: 'web'
    };

    // Try to persist server-side (non-blocking UX)
    try {
      await fetch(API_BOOKINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });
    } catch (err) {
      console.warn('Booking not saved to server:', err);
    }

    // Clear the form & show confirmation modal
    form.reset();
    selectCard(sprinterCard);
    updateBusTypeAvailability();
    updatePrice();
    showConfirmation(booking);
  });
});