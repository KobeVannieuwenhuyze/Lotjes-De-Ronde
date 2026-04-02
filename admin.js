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
  const rennersRef = ref(db, 'renners');
 
  // Lokale staat: array van { id, naam, positie }
  // id = firebase key (null voor de lege rij onderaan)
  let renners = [];
  let ignoreNextSnapshot = false;
 
  // ── Firebase live listener ──
  onValue(rennersRef, snap => {
    if (ignoreNextSnapshot) { ignoreNextSnapshot = false; return; }
    const data = snap.val() || {};
    renners = Object.entries(data)
      .map(([id, r]) => ({ id, naam: r.naam || '', positie: r.positie ?? '' }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
    renderTable();
  });
 
  // ── Render ──
  function renderTable() {
    const tbody = document.getElementById('renners-body');
    // Bewaar focus
    const focusId  = document.activeElement?.dataset?.id;
    const focusCol = document.activeElement?.dataset?.col;
 
    tbody.innerHTML = '';
 
    renners.forEach((r, i) => {
      tbody.appendChild(makeRow(r, i + 1));
    });
 
    // Lege rij onderaan
    tbody.appendChild(makeEmptyRow());
 
    // Herstel focus
    if (focusId && focusCol) {
      const el = tbody.querySelector(`[data-id="${focusId}"][data-col="${focusCol}"]`);
      if (el) { el.focus(); moveCursorToEnd(el); }
    }
  }
 
  function makeRow(r, num) {
    const tr = document.createElement('tr');
 
    // Positie badge klasse
    const p = parseInt(r.positie);
    let badgeClass = 'pos-badge';
    if (p === 1) badgeClass += ' p1';
    else if (p === 2) badgeClass += ' p2';
    else if (p === 3) badgeClass += ' p3';
    else if (p >= 4 && p <= 15) badgeClass += ' top';
 
    tr.innerHTML = `
      <td class="row-num">${num}</td>
      <td>
        <input class="cell-input" type="text"
          value="${esc(r.naam)}"
          placeholder="Naam renner"
          data-id="${r.id}" data-col="naam">
      </td>
      <td class="pos-cell">
        ${r.positie !== ''
          ? `<span class="${badgeClass}">${r.positie}</span>`
          : `<input class="pos-input" type="number" min="1" max="200"
               value=""
               placeholder="—"
               data-id="${r.id}" data-col="positie">`
        }
      </td>
      <td>
        <button class="btn-del" data-id="${r.id}" title="Verwijderen">✕</button>
      </td>
    `;
 
    // Naam input events
    const naamInput = tr.querySelector('[data-col="naam"]');
    naamInput.addEventListener('change', () => onNaamChange(r.id, naamInput.value.trim()));
    naamInput.addEventListener('blur',   () => onNaamChange(r.id, naamInput.value.trim()));
 
    // Positie input events (enkel als het een input is, niet een badge)
    const posInput = tr.querySelector('[data-col="positie"]');
    if (posInput) {
      posInput.addEventListener('change', () => onPositieChange(r.id, posInput.value));
      posInput.addEventListener('blur',   () => onPositieChange(r.id, posInput.value));
    }
 
    // Delete
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
          placeholder="Nieuwe renner toevoegen…"
          data-col="naam-new">
      </td>
      <td class="pos-cell">
        <input class="pos-input" type="number" min="1" max="200"
          placeholder="—" disabled data-col="positie-new">
      </td>
      <td></td>
    `;
 
    const naamInput = tr.querySelector('[data-col="naam-new"]');
    naamInput.addEventListener('change', () => {
      const naam = naamInput.value.trim();
      if (naam) addRenner(naam);
    });
    naamInput.addEventListener('blur', () => {
      const naam = naamInput.value.trim();
      if (naam) addRenner(naam);
    });
 
    return tr;
  }
 
  // ── Firebase operaties ──
  async function addRenner(naam) {
    // Controleer duplicaat
    if (renners.some(r => r.naam.toLowerCase() === naam.toLowerCase())) {
      setStatus('⚠ Naam bestaat al.', 'error');
      return;
    }
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      const newId = 'r_' + Date.now();
      await set(ref(db, `renners/${newId}`), { naam, positie: '' });
      renners.push({ id: newId, naam, positie: '' });
      renners.sort((a, b) => a.naam.localeCompare(b.naam));
      setStatus('✓ Opgeslagen', 'saved');
      renderTable();
    } catch(e) {
      setStatus('⚠ Fout bij opslaan', 'error');
      ignoreNextSnapshot = false;
    }
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
      renderTable();
    } catch(e) {
      setStatus('⚠ Fout bij opslaan', 'error');
      ignoreNextSnapshot = false;
    }
  }
 
  async function onPositieChange(id, val) {
    const r = renners.find(x => x.id === id);
    const positie = val === '' ? '' : parseInt(val);
    if (!r || r.positie === positie) return;
    setStatus('Opslaan…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await update(ref(db, `renners/${id}`), { positie });
      r.positie = positie;
      setStatus('✓ Opgeslagen', 'saved');
      renderTable();
    } catch(e) {
      setStatus('⚠ Fout bij opslaan', 'error');
      ignoreNextSnapshot = false;
    }
  }
 
  async function deleteRenner(id) {
    setStatus('Verwijderen…', 'saving');
    ignoreNextSnapshot = true;
    try {
      await remove(ref(db, `renners/${id}`));
      renners = renners.filter(r => r.id !== id);
      setStatus('✓ Verwijderd', 'saved');
      renderTable();
    } catch(e) {
      setStatus('⚠ Fout bij verwijderen', 'error');
      ignoreNextSnapshot = false;
    }
  }
 
  // ── Helpers ──
  let statusTimer;
  function setStatus(msg, type) {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.className = 'save-status ' + type;
    clearTimeout(statusTimer);
    if (type !== 'saving') {
      statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 2500);
    }
  }
 
  function esc(s = '') {
    return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }
 
  function moveCursorToEnd(el) {
    if (el.setSelectionRange) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }