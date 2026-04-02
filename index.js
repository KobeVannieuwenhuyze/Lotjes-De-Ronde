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
 
  const rennerSels = ['renner1','renner2','renner3'].map(id => document.getElementById(id));
 
  // ── Laad renners + populariteit live ──
  function buildOptions(renners, inzendingen) {
    // Tel hoe vaak elke renner gekozen is
    const freq = {};
    Object.values(inzendingen || {}).forEach(inz => {
      [inz.renner1, inz.renner2, inz.renner3].forEach(r => {
        if (r) freq[r] = (freq[r] || 0) + 1;
      });
    });
 
    // Sorteer renners op populariteit (meest gekozen eerst)
    const gesorteerd = Object.entries(renners || {})
      .map(([id, r]) => ({ id, naam: r.naam, freq: freq[r.naam] || 0 }))
      .sort((a, b) => b.freq - a.freq || a.naam.localeCompare(b.naam));
 
    const maxFreq = gesorteerd[0]?.freq || 1;
 
    rennerSels.forEach((sel, idx) => {
      const gekozen = sel.value; // bewaar huidige keuze
      sel.innerHTML = '<option value="">— Kies een renner —</option>';
 
      gesorteerd.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.naam;
        opt.textContent = r.naam + (r.freq > 0 ? ` (${r.freq}×)` : '');
        sel.appendChild(opt);
      });
 
      if (gekozen) sel.value = gekozen;
    });
 
    // Verwijder opties die al gekozen zijn in andere dropdowns (vermijd duplicaten)
    updateSelectOptions();
  }
 
  function updateSelectOptions() {
    const gekozen = rennerSels.map(s => s.value).filter(Boolean);
    rennerSels.forEach(sel => {
      const eigen = sel.value;
      Array.from(sel.options).forEach(opt => {
        if (!opt.value) return;
        // Disable als gekozen in andere dropdown
        const inAnder = gekozen.includes(opt.value) && opt.value !== eigen;
        opt.disabled = inAnder;
        opt.style.color = inAnder ? '#3a4a60' : '';
      });
    });
  }
 
  rennerSels.forEach(sel => sel.addEventListener('change', updateSelectOptions));
 
  // ── Tijd auto-formattering (hh:mm:ss) ──
  const tijdInput = document.getElementById('tijd');
  tijdInput.addEventListener('input', e => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    let fmt = '';
    if (digits.length > 0) fmt = digits.slice(0, 2);
    if (digits.length > 2) fmt += ':' + digits.slice(2, 4);
    if (digits.length > 4) fmt += ':' + digits.slice(4, 6);
    e.target.value = fmt;
  });
 
  // Live listener — herlaad bij wijziging renners of inzendingen
  let rennerSnap = {};
  let inzSnap    = {};
 
  onValue(ref(db, 'renners'), snap => {
    rennerSnap = snap.val() || {};
    buildOptions(rennerSnap, inzSnap);
  });
 
  onValue(ref(db, 'inzendingen'), snap => {
    inzSnap = snap.val() || {};
    buildOptions(rennerSnap, inzSnap);
  });
 
  // ── Submit ──
  document.getElementById('toevoegen').addEventListener('click', async () => {
    const naam   = document.getElementById('naam').value.trim();
    const gsm    = document.getElementById('gsm').value.trim();
    const r1     = document.getElementById('renner1').value;
    const r2     = document.getElementById('renner2').value;
    const r3     = document.getElementById('renner3').value;
    const tijd   = document.getElementById('tijd').value;
    const errEl  = document.getElementById('error-msg');
 
    // Validatie
    if (!naam || !gsm || !r1 || !r2 || !r3 || !tijd) {
      errEl.textContent = '⚠ Niet alles is ingevuld!';
      errEl.classList.add('show');
      return;
    }
    // Tijdformaat validatie (hh:mm:ss)
    if (!/^\d{2}:\d{2}:\d{2}$/.test(tijd)) {
      errEl.textContent = '⚠ Vul een geldige tijd in (hh:mm:ss)!';
      errEl.classList.add('show');
      return;
    }
    // Unieke renners
    if (new Set([r1,r2,r3]).size < 3) {
      errEl.textContent = '⚠ Kies 3 verschillende renners!';
      errEl.classList.add('show');
      return;
    }
    errEl.classList.remove('show');
 
    // Disable knop + toon spinner
    const btn = document.getElementById('toevoegen');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Opslaan…';
 
    try {
      await push(ref(db, 'inzendingen'), {
        naam, gsm, renner1: r1, renner2: r2, renner3: r3,
        tijd,
        datum: new Date().toISOString()
      });
 
      // Toon success
      document.getElementById('form-wrap').style.display = 'none';
      const sc = document.getElementById('success-screen');
      document.getElementById('success-naam').textContent =
        `Bedankt, ${naam}! Jouw keuze: ${r1}, ${r2} & ${r3}.`;
      sc.classList.add('show');
 
    } catch(e) {
      errEl.textContent = '⚠ Fout bij opslaan. Probeer opnieuw.';
      errEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Inzending indienen';
    }
  });
 
  // ── Reset form ──
  window.resetForm = () => {
    document.getElementById('naam').value  = '';
    document.getElementById('gsm').value   = '';
    document.getElementById('tijd').value  = '';
    rennerSels.forEach(s => s.value = '');
    updateSelectOptions();
    document.getElementById('form-wrap').style.display = '';
    document.getElementById('success-screen').classList.remove('show');
    document.getElementById('toevoegen').disabled = false;
    document.getElementById('toevoegen').textContent = 'Inzending indienen';
  };