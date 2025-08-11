// ==== CONFIG ====
const API_BASE = 'https://api.yourdomain.com'; // CHANGE ME to your Cloudzy API base (without trailing slash)
// ===============

const qs = {
  q: '', destination: '', status: '', page: 1, limit: 20, sort: 'created_at', dir: 'desc'
};

const state = {
  total: 0, rows: [], loading: false, destinations: new Set()
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function fmtMoney(n){ return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtTime(s){
  const d = new Date(s);
  // Display in Africa/Accra
  return d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', hour12:false });
}
function badge(status){
  const s = String(status || '').toLowerCase();
  const cls = s === 'pending' ? 'pending' : s === 'paid' ? 'paid' : s === 'confirmed' ? 'confirmed' : 'cancelled';
  return `<span class="badge ${cls}">${status}</span>`;
}
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

async function fetchBookings(showLoading=true){
  try{
    state.loading = true;
    if(showLoading) $('#tbody').innerHTML = `<tr><td colspan="10" class="muted">Loading…</td></tr>`;
    const url = new URL('/api/admin/bookings', API_BASE);
    Object.entries(qs).forEach(([k,v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if(!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    state.rows = data.rows || [];
    state.total = data.total || 0;

    // collect destinations for filter
    state.destinations = new Set([...state.destinations, ...state.rows.map(r => r.destination).filter(Boolean)]);
    renderDestinations();
    renderTable();
    renderPagination();
  }catch(e){
    console.error(e);
    $('#tbody').innerHTML = `<tr><td colspan="10" class="muted">Error loading data</td></tr>`;
  }finally{
    state.loading = false;
  }
}

function renderDestinations(){
  const sel = $('#destination');
  const current = sel.value;
  const options = [''].concat([...state.destinations].sort());
  sel.innerHTML = options.map(v => `<option value="${v}">${v || 'All destinations'}</option>`).join('');
  sel.value = current;
}

function renderTable(){
  const tbody = $('#tbody');
  if(state.rows.length === 0){
    tbody.innerHTML = `<tr><td colspan="10" class="muted">No results</td></tr>`;
    return;
  }
  tbody.innerHTML = state.rows.map(r => {
    return `
      <tr data-id="${r.id}">
        <td class="muted">${fmtTime(r.created_at)}</td>
        <td><strong>${r.booking_number}</strong></td>
        <td>${r.full_name}</td>
        <td>${r.phone}</td>
        <td>${r.payer_name}</td>
        <td>${r.pickup_point} → ${r.destination}</td>
        <td>${r.bus_type}</td>
        <td class="num">${fmtMoney(r.price)}</td>
        <td>${badge(r.status)}</td>
        <td class="actions">
          <div class="row-actions">
            <select class="status-select">
              ${['Pending','Paid','Confirmed','Cancelled'].map(s => `<option ${s===r.status?'selected':''}>${s}</option>`).join('')}
            </select>
            <button class="btn secondary btn-save">Save</button>
            <button class="btn ghost btn-copy">Copy</button>
            <button class="btn ghost btn-delete">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // bind actions
  $$('#tbody .btn-save').forEach(btn => btn.addEventListener('click', onSaveStatus));
  $$('#tbody .btn-copy').forEach(btn => btn.addEventListener('click', onCopy));
  $$('#tbody .btn-delete').forEach(btn => btn.addEventListener('click', onDelete));
}

function renderPagination(){
  const pages = Math.max(1, Math.ceil(state.total / qs.limit));
  $('#pageInfo').textContent = `Page ${qs.page} of ${pages} — ${state.total} total`;
  $('#prev').disabled = qs.page <= 1;
  $('#next').disabled = qs.page >= pages;
}

async function onSaveStatus(e){
  const tr = e.target.closest('tr');
  const id = tr.getAttribute('data-id');
  const status = tr.querySelector('.status-select').value;
  const res = await fetch(`${API_BASE}/api/admin/bookings/${id}/status`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ status })
  });
  if(!res.ok){ toast('Failed to update'); return; }
  toast('Status updated');
  // update badge inline
  tr.querySelector('td:nth-child(9)').innerHTML = badge(status);
}

async function onDelete(e){
  const tr = e.target.closest('tr');
  const id = tr.getAttribute('data-id');
  const bnum = tr.querySelector('td:nth-child(2)').innerText.trim();
  if(!confirm(`Delete booking ${bnum}? This cannot be undone.`)) return;
  const res = await fetch(`${API_BASE}/api/admin/bookings/${id}`, { method: 'DELETE' });
  if(!res.ok){ toast('Delete failed'); return; }
  toast('Deleted');
  // refetch current page (or remove row)
  tr.remove();
  if($('#tbody').children.length === 0) fetchBookings(false);
}

async function onCopy(e){
  const tr = e.target.closest('tr');
  const cols = tr.querySelectorAll('td');
  const payload = [
    `Booking: ${cols[1].innerText.trim()}`,
    `Time: ${cols[0].innerText.trim()}`,
    `Name: ${cols[2].innerText.trim()}`,
    `Phone: ${cols[3].innerText.trim()}`,
    `Payer: ${cols[4].innerText.trim()}`,
    `Route: ${cols[5].innerText.trim()}`,
    `Bus: ${cols[6].innerText.trim()}`,
    `Price: ${cols[7].innerText.trim()}`,
    `Status: ${cols[8].innerText.trim()}`
  ].join('\n');
  try{
    await navigator.clipboard.writeText(payload);
    toast('Copied');
  }catch{
    toast('Copy failed');
  }
}

function bindUI(){
  $('#search').addEventListener('input', debounce(() => {
    qs.q = $('#search').value.trim(); qs.page = 1; fetchBookings();
  }, 300));

  $('#destination').addEventListener('change', () => { qs.destination = $('#destination').value; qs.page = 1; fetchBookings(); });
  $('#status').addEventListener('change', () => { qs.status = $('#status').value; qs.page = 1; fetchBookings(); });
  $('#limit').addEventListener('change', () => { qs.limit = parseInt($('#limit').value, 10); qs.page = 1; fetchBookings(); });
  $('#sort').addEventListener('change', () => {
    const [sort, dir] = $('#sort').value.split(':');
    qs.sort = sort; qs.dir = dir; qs.page = 1; fetchBookings();
  });

  $('#prev').addEventListener('click', () => { if(qs.page > 1){ qs.page--; fetchBookings(); }});
  $('#next').addEventListener('click', () => { qs.page++; fetchBookings(); });
  $('#reset').addEventListener('click', () => {
    qs.q=''; qs.destination=''; qs.status=''; qs.page=1; qs.limit=20; qs.sort='created_at'; qs.dir='desc';
    $('#search').value=''; $('#destination').value=''; $('#status').value=''; $('#limit').value='20'; $('#sort').value='created_at:desc';
    fetchBookings();
  });

  $('#exportCsv').addEventListener('click', () => {
    const url = new URL('/api/admin/export', API_BASE);
    ['q','destination','status'].forEach(k => url.searchParams.set(k, qs[k] || ''));
    window.location.href = url.toString();
  });
}

function debounce(fn, ms){
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

window.addEventListener('DOMContentLoaded', () => {
  bindUI();
  fetchBookings();
});
