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
      .map(([id, r]) => ({ id, naam: r.naam || '', positie: r.positie ?? '' }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
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
  function ptnFromPos(pos) {
    const p = parseInt(pos);
    if (!p || p < 1 || p > 15) return 0;
    return 80 - p * 5;
  }
 
  // Zet "hh:mm:ss" om naar seconden
  function tijdNaarSec(t) {
    if (!t || !/^\d{2}:\d{2}:\d{2}$/.test(t)) return null;
    const [h, m, s] = t.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }
 
  // ── Rangschikking berekenen ──
  function berekenRang() {
    // Bouw puntentabel renner -> punten
    const rennerPtn = {};
    renners.forEach(r => {
      if (r.naam) rennerPtn[r.naam] = ptnFromPos(r.positie);
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
    const p   = parseInt(r.positie);
    const ptn = ptnFromPos(p);
 
    let badgeClass = 'pos-badge';
    if (p === 1) badgeClass += ' p1';
    else if (p === 2) badgeClass += ' p2';
    else if (p === 3) badgeClass += ' p3';
    else if (p >= 4 && p <= 15) badgeClass += ' top';
 
    const positieCell = r.positie !== ''
      ? `<span class="${badgeClass} clickable-badge" title="Klik om aan te passen"
             data-id="${r.id}" data-col="positie-badge">
           ${p} <small>(${ptn}ptn)</small>
         </span>`
      : `<input class="pos-input" type="number" min="1" max="200"
             value="" placeholder="pos"
             data-id="${r.id}" data-col="positie">`;
 
    tr.innerHTML = `
      <td class="row-num">${num}</td>
      <td>
        <input class="cell-input" type="text"
          value="${esc(r.naam)}" placeholder="Naam renner"
          data-id="${r.id}" data-col="naam">
      </td>
      <td class="pos-cell">${positieCell}</td>
      <td><button class="btn-del" data-id="${r.id}" title="Verwijderen">✕</button></td>
    `;
 
    const naamInput = tr.querySelector('[data-col="naam"]');
    naamInput.addEventListener('change', () => onNaamChange(r.id, naamInput.value.trim()));
    naamInput.addEventListener('blur',   () => onNaamChange(r.id, naamInput.value.trim()));
 
    const badge = tr.querySelector('.clickable-badge');
    if (badge) {
      badge.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'pos-input';
        input.type = 'number'; input.min = 1; input.max = 200;
        input.value = p;
        input.dataset.id = r.id; input.dataset.col = 'positie';
        badge.replaceWith(input);
        input.focus(); input.select();
 
        // Forceer opslaan — zet r.positie tijdelijk op '' zodat de check altijd doorgaat
        const slaOp = () => {
          const oudePositie = r.positie;
          r.positie = ''; // reset zodat de gelijkheidscheck niet blokkeert
          onPositieChange(r.id, input.value).catch(() => { r.positie = oudePositie; });
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
        input.addEventListener('blur', slaOp);
      });
    }
 
    const posInput = tr.querySelector('[data-col="positie"]');
    if (posInput) {
      posInput.addEventListener('change', () => onPositieChange(r.id, posInput.value));
      posInput.addEventListener('blur',   () => onPositieChange(r.id, posInput.value));
    }
 
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
        <input class="pos-input" type="number" min="1" max="200"
          placeholder="—" disabled data-col="positie-new">
      </td>
      <td></td>
    `;
    const naamInput = tr.querySelector('[data-col="naam-new"]');
    naamInput.addEventListener('change', () => { if (naamInput.value.trim()) addRenner(naamInput.value.trim()); });
    naamInput.addEventListener('blur',   () => { if (naamInput.value.trim()) addRenner(naamInput.value.trim()); });
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
      await set(ref(db, `renners/${newId}`), { naam, positie: '' });
      renners.push({ id: newId, naam, positie: '' });
      renners.sort((a, b) => a.naam.localeCompare(b.naam));
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
      renners.sort((a, b) => a.naam.localeCompare(b.naam));
      setStatus('✓ Opgeslagen', 'saved');
      renderTable(); renderRang();
    } catch(e) { setStatus('⚠ Fout bij opslaan', 'error'); ignoreNextSnapshot = false; }
  }
 
  async function onPositieChange(id, val) {
    const r = renners.find(x => x.id === id);
    if (!r) return;
    const positie = val === '' ? '' : parseInt(val);
    // Sla altijd op — vergelijk als string om type mismatch te vermijden
    if (String(r.positie) === String(positie)) return;
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await update(ref(db, `renners/${id}`), { positie });
      r.positie = positie;
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