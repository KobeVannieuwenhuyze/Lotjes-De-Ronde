import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
 
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
 
  // Staat
  let alleRenners = []; // [{ naam, freq }] gesorteerd op populariteit
  let gekozen = ['', '', '']; // geselecteerde geldige renners per slot
 
  // ── Firebase listeners ──
  let inzSnap = {};
  let rennerSnap = {};
 
  onValue(ref(db, 'renners'), snap => {
    rennerSnap = snap.val() || {};
    bouwRennerLijst();
  });
 
  onValue(ref(db, 'inzendingen'), snap => {
    inzSnap = snap.val() || {};
    bouwRennerLijst();
  });
 
  function bouwRennerLijst() {
    const freq = {};
    Object.values(inzSnap).forEach(inz => {
      [inz.renner1, inz.renner2, inz.renner3].forEach(r => {
        if (r) freq[r] = (freq[r] || 0) + 1;
      });
    });
    alleRenners = Object.values(rennerSnap)
      .filter(r => r.naam)
      .map(r => ({ naam: r.naam, freq: freq[r.naam] || 0 }))
      .sort((a, b) => b.freq - a.freq || a.naam.localeCompare(b.naam));
  }
 
  // ── Autocomplete setup voor elk slot ──
  const slots = [1, 2, 3].map(n => {
    const input = document.getElementById(`renner${n}`);
    const drop  = document.getElementById(`drop${n}`);
    return { n: n - 1, input, drop };
  });
 
  slots.forEach(({ n, input, drop }) => {
 
    // Toon dropdown bij focus
    input.addEventListener('focus', () => {
      renderDropdown(n, input.value);
    });
 
    // Filter bij typen
    input.addEventListener('input', () => {
      gekozen[n] = ''; // waarde reset want gebruiker typt opnieuw
      input.classList.remove('selected');
      renderDropdown(n, input.value);
    });
 
    // Sluit dropdown bij blur (na klein delay zodat klik op item werkt)
    input.addEventListener('blur', () => {
      setTimeout(() => {
        drop.classList.remove('open');
        // Als getypte naam niet geldig is: leegmaken
        if (!gekozen[n]) {
          const match = alleRenners.find(r => r.naam.toLowerCase() === input.value.trim().toLowerCase());
          if (match && !andereGekozen(n, match.naam)) {
            kiesRenner(n, match.naam);
          } else if (!match || andereGekozen(n, match.naam)) {
            input.value = '';
            input.classList.remove('selected');
            gekozen[n] = '';
          }
        }
      }, 150);
    });
 
    // Keyboard navigatie
    input.addEventListener('keydown', e => {
      const items = drop.querySelectorAll('.ac-item');
      const active = drop.querySelector('.ac-item.active');
      let idx = Array.from(items).indexOf(active);
 
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, items.length - 1);
        items.forEach(i => i.classList.remove('active'));
        items[idx]?.classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        items.forEach(i => i.classList.remove('active'));
        items[idx]?.classList.add('active');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active) active.click();
        else drop.classList.remove('open');
      } else if (e.key === 'Escape') {
        drop.classList.remove('open');
      }
    });
  });
 
  function andereGekozen(n, naam) {
    return gekozen.some((g, i) => i !== n && g === naam);
  }
 
  function renderDropdown(n, zoek) {
    const drop  = slots[n].drop;
    const input = slots[n].input;
 
    const gefilterd = alleRenners.filter(r => {
      const matchZoek = r.naam.toLowerCase().includes(zoek.trim().toLowerCase());
      const nietGekozen = !andereGekozen(n, r.naam);
      return matchZoek && nietGekozen;
    });
 
    if (!gefilterd.length) {
      drop.innerHTML = `<div class="ac-no-results">${zoek.trim() ? '⚠ Geen renner gevonden' : 'Geen renners beschikbaar'}</div>`;
    } else {
      drop.innerHTML = gefilterd.map(r => {
        // Highlight op originele naam, daarna pas escapen per segment
        const z = zoek.trim();
        let naam;
        if (z) {
          const re = new RegExp(`(${z.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
          naam = r.naam.replace(re, '|||$1|||').split('|||').map((seg, i) =>
            i % 2 === 1
              ? `<span class="ac-match">${esc(seg)}</span>`
              : esc(seg)
          ).join('');
        } else {
          naam = esc(r.naam);
        }
        const freqTxt = r.freq > 0 ? `<span class="freq">${r.freq}×</span>` : '';
        return `<div class="ac-item" data-naam="${esc(r.naam)}">${naam}${freqTxt}</div>`;
      }).join('');
 
      drop.querySelectorAll('.ac-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault(); // prevent blur
          kiesRenner(n, item.dataset.naam);
          drop.classList.remove('open');
        });
      });
    }
 
    drop.classList.add('open');
  }
 
  function kiesRenner(n, naam) {
    gekozen[n] = naam;
    slots[n].input.value = naam;
    slots[n].input.classList.add('selected');
    slots[n].drop.classList.remove('open');
  }
 
  // Sluit dropdown bij klik buiten
  document.addEventListener('click', e => {
    slots.forEach(({ input, drop }) => {
      if (!input.contains(e.target) && !drop.contains(e.target)) {
        drop.classList.remove('open');
      }
    });
  });
 
  // ── Submit ──
  document.getElementById('toevoegen').addEventListener('click', async () => {
    const naam = document.getElementById('naam').value.trim();
    const gsm  = document.getElementById('gsm').value.trim();
    const tijd = document.getElementById('tijd').value;
    const errEl = document.getElementById('error-msg');
 
    const r1 = gekozen[0], r2 = gekozen[1], r3 = gekozen[2];
 
    if (!naam || !gsm || !r1 || !r2 || !r3 || !tijd) {
      errEl.textContent = '⚠ Niet alles is ingevuld!';
      errEl.classList.add('show'); return;
    }
    if (new Set([r1, r2, r3]).size < 3) {
      errEl.textContent = '⚠ Kies 3 verschillende renners!';
      errEl.classList.add('show'); return;
    }
    errEl.classList.remove('show');
 
    const btn = document.getElementById('toevoegen');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Opslaan…';
 
    try {
      await push(ref(db, 'inzendingen'), {
        naam, gsm, renner1: r1, renner2: r2, renner3: r3,
        tijd, datum: new Date().toISOString()
      });
      document.getElementById('form-wrap').style.display = 'none';
      document.getElementById('success-naam').textContent =
        `Bedankt, ${naam}! Jouw keuze: ${r1}, ${r2} & ${r3}.`;
      document.getElementById('success-screen').classList.add('show');
    } catch(e) {
      errEl.textContent = '⚠ Fout bij opslaan. Probeer opnieuw.';
      errEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Inzending indienen';
    }
  });
 
  // ── Reset ──
  window.resetForm = () => {
    document.getElementById('naam').value = '';
    document.getElementById('gsm').value  = '';
    document.getElementById('tijd').value = '';
    gekozen = ['', '', ''];
    slots.forEach(({ input, drop }) => {
      input.value = '';
      input.classList.remove('selected', 'invalid');
      drop.classList.remove('open');
    });
    document.getElementById('form-wrap').style.display = '';
    document.getElementById('success-screen').classList.remove('show');
    document.getElementById('toevoegen').disabled = false;
    document.getElementById('toevoegen').textContent = 'Inzending indienen';
  };
 
  function esc(s = '') {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }