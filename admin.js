import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getDatabase, ref, onValue, set, remove, update }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
 
  // ============================================================
  //  !! VERVANG DEZE WAARDEN MET JOUW FIREBASE CONFIG !!
  // ============================================================
  const firebaseConfig = {
    apiKey: "AIzaSyAtsDa9suC6FHkG1xeLYuKKzp-0lSsNkSg",
    authDomain: "pronostiek-de-rond-2026.firebaseapp.com",
    databaseURL: "https://pronostiek-de-rond-2026-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "pronostiek-de-rond-2026",
    storageBucket: "pronostiek-de-rond-2026.firebasestorage.app",
    messagingSenderId: "590059650028",
    appId: "1:590059650028:web:1ca0960179ac1229071ec9",
    measurementId: "G-N75Y10CY9H"
  };
  // ============================================================
 
  const app = initializeApp(firebaseConfig);
  const db  = getDatabase(app);
 
  let renners      = [];
  let inzendingen  = {};
  let aankomsttijd = '';
  let ignoreNextSnapshot = false;
 
  // ── Live listeners ──
  onValue(ref(db, 'renners'), snap => {
    if (ignoreNextSnapshot) { ignoreNextSnapshot = false; return; }
    const data = snap.val() || {};
    renners = Object.entries(data)
      .map(([id, r]) => ({ id, naam: r.naam || '', punten: r.punten ?? 0 }))
      .sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam));
    renderTable();
    renderRang();
  });
 
  onValue(ref(db, 'inzendingen'), snap => {
    inzendingen = snap.val() || {};
    renderRang();
  });
 
  onValue(ref(db, 'instellingen/aankomsttijd'), snap => {
    aankomsttijd = snap.val() || '';
    const el = document.getElementById('aankomsttijd');
    if (el !== document.activeElement) el.value = aankomsttijd;
    renderRang();
  });
 
  // ── Aankomsttijd input ──
  const tijdEl = document.getElementById('aankomsttijd');
 
  tijdEl.addEventListener('change', saveTijd);
  tijdEl.addEventListener('blur',   saveTijd);
 
  async function saveTijd() {
    const val = tijdEl.value.trim();
    if (val === aankomsttijd) return;
    if (val && !/^\d{2}:\d{2}:\d{2}$/.test(val)) return;
    aankomsttijd = val;
    await set(ref(db, 'instellingen/aankomsttijd'), val);
    const savedEl = document.getElementById('tijd-saved');
    savedEl.classList.add('show');
    setTimeout(() => savedEl.classList.remove('show'), 2000);
    renderRang();
  }
 
  // ── Punten berekening ──
  // Zet "hh:mm" of "hh:mm:ss" om naar seconden
  function tijdNaarSec(t) {
    if (!t) return null;
    const parts = t.split(':').map(Number);
    if (parts.length < 2 || parts.some(isNaN)) return null;
    const [h, m, s = 0] = parts;
    return h * 3600 + m * 60 + s;
  }
 
  // ── Rangschikking berekenen ──
  function berekenRang() {
    // Bouw puntentabel renner -> punten
    const rennerPtn = {};
    renners.forEach(r => {
      if (r.naam) rennerPtn[r.naam] = r.punten ?? 0;
    });
 
    const aankomstSec = tijdNaarSec(aankomsttijd);
 
    return Object.entries(inzendingen).map(([id, inz]) => {
      const gekozen = [inz.renner1, inz.renner2, inz.renner3];
      const score = gekozen.reduce((s, naam) => s + (rennerPtn[naam] ?? 0), 0);
 
      // Schifting: verschil in seconden met aankomsttijd
      const inzSec = tijdNaarSec(inz.tijd);
      const diff = (aankomstSec !== null && inzSec !== null)
        ? Math.abs(aankomstSec - inzSec)
        : null;
 
      return { id, naam: inz.naam, gsm: inz.gsm, gekozen, score, diff, tijd: inz.tijd };
    }).sort((a, b) => {
      // 1. Hoogste score eerst
      if (b.score !== a.score) return b.score - a.score;
      // 2. Bij gelijkstand: kleinste tijdsverschil
      if (a.diff === null && b.diff === null) return 0;
      if (a.diff === null) return 1;
      if (b.diff === null) return -1;
      return a.diff - b.diff;
    });
  }
 
  // ── Render rangschikking ──
  function renderRang() {
    const tbody = document.getElementById('rang-body');
    const gesorteerd = berekenRang();
 
    if (!gesorteerd.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="geen-data">Nog geen inzendingen.</td></tr>';
      return;
    }
 
    tbody.innerHTML = gesorteerd.map((d, i) => {
      const rang = i + 1;
      let posClass = '';
      if (rang === 1) posClass = 'r1';
      else if (rang === 2) posClass = 'r2';
      else if (rang === 3) posClass = 'r3';
 
      const schifting = d.tijd ? esc(d.tijd) : '—';
 
      return `<tr class="rang-row">
        <td class="rang-pos ${posClass}">${rang}</td>
        <td class="rang-naam">${esc(d.naam)}</td>
        <td class="rang-gsm">${esc(d.gsm || '—')}</td>
        <td class="rang-score">${d.score} ptn</td>
        <td class="rang-schifting">${schifting}</td>
      </tr>`;
    }).join('');
  }
 
  // ── Render rennerstabel ──
  function renderTable() {
    const tbody = document.getElementById('renners-body');
    const focusId  = document.activeElement?.dataset?.id;
    const focusCol = document.activeElement?.dataset?.col;
 
    tbody.innerHTML = '';
    renners.forEach((r, i) => tbody.appendChild(makeRow(r, i + 1)));
    tbody.appendChild(makeEmptyRow());
 
    if (focusId && focusCol) {
      const el = tbody.querySelector(`[data-id="${focusId}"][data-col="${focusCol}"]`);
      if (el) { el.focus(); moveCursorToEnd(el); }
    }
  }
 
  function makeRow(r, num) {
    const tr = document.createElement('tr');
 
    tr.innerHTML = `
      <td class="row-num">${num}</td>
      <td>
        <input class="cell-input" type="text"
          value="${esc(r.naam)}" placeholder="Naam renner"
          data-id="${r.id}" data-col="naam">
      </td>
      <td class="pos-cell">
        <input class="pos-input" type="number" min="0" max="999"
          value="${r.punten ?? 0}"
          data-id="${r.id}" data-col="punten">
      </td>
      <td><button class="btn-del" data-id="${r.id}" title="Verwijderen">✕</button></td>
    `;
 
    const naamInput = tr.querySelector('[data-col="naam"]');
    naamInput.addEventListener('change', () => onNaamChange(r.id, naamInput.value.trim()));
    naamInput.addEventListener('blur',   () => onNaamChange(r.id, naamInput.value.trim()));
 
    const ptnInput = tr.querySelector('[data-col="punten"]');
    ptnInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ptnInput.blur(); } });
    ptnInput.addEventListener('change', () => onPuntenChange(r.id, ptnInput.value));
    ptnInput.addEventListener('blur',   () => onPuntenChange(r.id, ptnInput.value));
 
    tr.querySelector('.btn-del').addEventListener('click', () => deleteRenner(r.id));
    return tr;
  }
 
  function makeEmptyRow() {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `
      <td class="row-num"></td>
      <td>
        <input class="cell-input" type="text"
          placeholder="Nieuwe renner toevoegen…" data-col="naam-new">
      </td>
      <td class="pos-cell">
        <input class="pos-input" type="number" min="0" max="999"
          value="0" disabled data-col="punten-new">
      </td>
      <td></td>
    `;
    const naamInput = tr.querySelector('[data-col="naam-new"]');
    let bezig = false;
    const probeerToevoegen = () => {
      const naam = naamInput.value.trim();
      if (!naam || bezig) return;
      bezig = true;
      addRenner(naam);
    };
    naamInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); probeerToevoegen(); } });
    naamInput.addEventListener('blur', probeerToevoegen);
    return tr;
  }
 
  // ── Firebase operaties ──
  async function addRenner(naam) {
    if (renners.some(r => r.naam.toLowerCase() === naam.toLowerCase())) {
      setStatus('⚠ Naam bestaat al.', 'error'); return;
    }
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      const newId = 'r_' + Date.now();
      await set(ref(db, `renners/${newId}`), { naam, punten: 0 });
      renners.push({ id: newId, naam, punten: 0 });
      renners.sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam));
      setStatus('✓ Opgeslagen', 'saved');
      renderTable(); renderRang();
    } catch(e) { setStatus('⚠ Fout bij opslaan', 'error'); ignoreNextSnapshot = false; }
  }
 
  async function onNaamChange(id, naam) {
    const r = renners.find(x => x.id === id);
    if (!r || r.naam === naam) return;
    if (!naam) { deleteRenner(id); return; }
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await update(ref(db, `renners/${id}`), { naam });
      r.naam = naam;
      renners.sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam));
      setStatus('✓ Opgeslagen', 'saved');
      renderTable(); renderRang();
    } catch(e) { setStatus('⚠ Fout bij opslaan', 'error'); ignoreNextSnapshot = false; }
  }
 
  async function onPuntenChange(id, val) {
    const r = renners.find(x => x.id === id);
    if (!r) return;
    const punten = val === '' ? 0 : parseInt(val);
    if (String(r.punten) === String(punten)) return;
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await update(ref(db, `renners/${id}`), { punten });
      r.punten = punten;
      setStatus('✓ Opgeslagen', 'saved');
      renderTable(); renderRang();
    } catch(e) { setStatus('⚠ Fout bij opslaan', 'error'); ignoreNextSnapshot = false; }
  }
 
  async function deleteRenner(id) {
    setStatus('Verwijderen…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await remove(ref(db, `renners/${id}`));
      renners = renners.filter(r => r.id !== id);
      setStatus('✓ Verwijderd', 'saved');
      renderTable(); renderRang();
    } catch(e) { setStatus('⚠ Fout bij verwijderen', 'error'); ignoreNextSnapshot = false; }
  }
 
  let statusTimer;
  function setStatus(msg, type) {
    const el = document.getElementById('save-status');
    el.textContent = msg; el.className = 'save-status ' + type;
    clearTimeout(statusTimer);
    if (type !== 'saving') statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 2500);
  }
 
  function esc(s = '') {
    return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }
 
  function moveCursorToEnd(el) {
    if (el.setSelectionRange) { const l = el.value.length; el.setSelectionRange(l, l); }
  }