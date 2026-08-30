'use strict';

/* ---------- State & persistence ---------- */

const STORAGE_KEY = 'aquariumTracker.v1';

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function defaultTargets() {
  return {
    tempMin: 72, tempMax: 80, tempUnit: 'F',
    phMin: 6.5, phMax: 7.5,
    ghMin: 4, ghMax: 8,
    khMin: 3, khMax: 8,
    nitrateMax: 40,
    ammoniaMax: 0,
    nitriteMax: 0
  };
}

function newTank(name) {
  return {
    id: uid(),
    name: name || 'New Tank',
    createdDate: '',
    sizeValue: null,
    sizeUnit: 'gal',
    filter: { present: true, type: '' },
    co2: { present: false, type: '' },
    substrate: '',
    plants: [],
    stocking: [],
    targets: defaultTargets(),
    tests: [],
    waterChanges: [],
    notes: ''
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tanks: [], activeTankId: null };
    const parsed = JSON.parse(raw);
    if (!parsed.tanks) return { tanks: [], activeTankId: null };
    return parsed;
  } catch (e) {
    console.error('Failed to load state', e);
    return { tanks: [], activeTankId: null };
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  flashSaved();
}

let saveFlashTimer = null;
function flashSaved() {
  const el = document.getElementById('saveIndicator');
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => el.classList.remove('show'), 900);
}

function getActiveTank() {
  return state.tanks.find(t => t.id === state.activeTankId) || null;
}

/* ---------- Init / top-level render ---------- */

function init() {
  bindTopbar();
  bindTabs();
  bindProfileForm();
  bindTestsTab();
  bindWaterChangesTab();
  bindAskTab();
  renderAll();
}

function renderAll() {
  renderTankSelect();
  const tank = getActiveTank();
  document.getElementById('appMain').hidden = !tank;
  document.getElementById('emptyState').hidden = !!tank;
  if (!tank) return;
  renderProfileForm(tank);
  renderOverview(tank);
  renderTestsTab(tank);
  renderWaterChangesTab(tank);
}

/* ---------- Topbar ---------- */

function bindTopbar() {
  document.getElementById('newTankBtn').addEventListener('click', createTankFlow);
  document.getElementById('emptyNewTankBtn').addEventListener('click', createTankFlow);
  document.getElementById('deleteTankBtn').addEventListener('click', deleteActiveTank);
  document.getElementById('tankSelect').addEventListener('change', e => {
    state.activeTankId = e.target.value;
    saveState();
    renderAll();
  });
  document.getElementById('exportAllBtn').addEventListener('click', exportAllData);
  document.getElementById('importAllInput').addEventListener('change', importAllData);
}

function createTankFlow() {
  const name = prompt('Tank name?', 'New Tank');
  if (name === null) return;
  const tank = newTank(name.trim() || 'New Tank');
  state.tanks.push(tank);
  state.activeTankId = tank.id;
  saveState();
  renderAll();
}

function deleteActiveTank() {
  const tank = getActiveTank();
  if (!tank) return;
  if (!confirm(`Delete "${tank.name}" and all its logged data? This cannot be undone.`)) return;
  state.tanks = state.tanks.filter(t => t.id !== tank.id);
  state.activeTankId = state.tanks.length ? state.tanks[0].id : null;
  saveState();
  renderAll();
}

function renderTankSelect() {
  const sel = document.getElementById('tankSelect');
  sel.innerHTML = '';
  state.tanks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name || 'Untitled tank';
    sel.appendChild(opt);
  });
  if (!state.activeTankId && state.tanks.length) state.activeTankId = state.tanks[0].id;
  sel.value = state.activeTankId || '';
}

function exportAllData() {
  downloadFile('aquarium-tracker-backup.json', JSON.stringify(state, null, 2), 'application/json');
}

function importAllData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.tanks) throw new Error('Not a valid backup file');
      if (!confirm('This will replace all current data with the imported backup. Continue?')) return;
      state = parsed;
      state.activeTankId = state.activeTankId || (state.tanks[0] && state.tanks[0].id) || null;
      saveState();
      renderAll();
    } catch (err) {
      alert('Could not import file: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Tabs ---------- */

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).hidden = false;
    });
  });
}

/* ---------- Profile tab ---------- */

function bindProfileForm() {
  const ids = [
    'f-name', 'f-createdDate', 'f-sizeValue', 'f-sizeUnit', 'f-substrate', 'f-notes',
    'f-filterPresent', 'f-filterType', 'f-co2Present', 'f-co2Type',
    'f-tempMin', 'f-tempMax', 'f-tempUnit', 'f-phMin', 'f-phMax',
    'f-ghMin', 'f-ghMax', 'f-khMin', 'f-khMax', 'f-nitrateMax', 'f-ammoniaMax', 'f-nitriteMax'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, onProfileFieldChange);
  });

  document.getElementById('addPlantBtn').addEventListener('click', addPlant);
  document.getElementById('newPlantInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addPlant(); }
  });
  document.getElementById('addStockBtn').addEventListener('click', addStocking);
}

function onProfileFieldChange() {
  const tank = getActiveTank();
  if (!tank) return;
  tank.name = document.getElementById('f-name').value.trim() || 'Untitled tank';
  tank.createdDate = document.getElementById('f-createdDate').value;
  tank.sizeValue = numOrNull(document.getElementById('f-sizeValue').value);
  tank.sizeUnit = document.getElementById('f-sizeUnit').value;
  tank.substrate = document.getElementById('f-substrate').value;
  tank.notes = document.getElementById('f-notes').value;
  tank.filter.present = document.getElementById('f-filterPresent').checked;
  tank.filter.type = document.getElementById('f-filterType').value;
  tank.co2.present = document.getElementById('f-co2Present').checked;
  tank.co2.type = document.getElementById('f-co2Type').value;

  tank.targets.tempMin = numOrNull(document.getElementById('f-tempMin').value);
  tank.targets.tempMax = numOrNull(document.getElementById('f-tempMax').value);
  tank.targets.tempUnit = document.getElementById('f-tempUnit').value;
  tank.targets.phMin = numOrNull(document.getElementById('f-phMin').value);
  tank.targets.phMax = numOrNull(document.getElementById('f-phMax').value);
  tank.targets.ghMin = numOrNull(document.getElementById('f-ghMin').value);
  tank.targets.ghMax = numOrNull(document.getElementById('f-ghMax').value);
  tank.targets.khMin = numOrNull(document.getElementById('f-khMin').value);
  tank.targets.khMax = numOrNull(document.getElementById('f-khMax').value);
  tank.targets.nitrateMax = numOrNull(document.getElementById('f-nitrateMax').value);
  tank.targets.ammoniaMax = numOrNull(document.getElementById('f-ammoniaMax').value);
  tank.targets.nitriteMax = numOrNull(document.getElementById('f-nitriteMax').value);

  saveState();
  renderTankSelect();
  renderAgeDisplay(tank);
  renderOverview(tank);
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function renderProfileForm(tank) {
  document.getElementById('f-name').value = tank.name || '';
  document.getElementById('f-createdDate').value = tank.createdDate || '';
  document.getElementById('f-sizeValue').value = tank.sizeValue ?? '';
  document.getElementById('f-sizeUnit').value = tank.sizeUnit || 'gal';
  document.getElementById('f-substrate').value = tank.substrate || '';
  document.getElementById('f-notes').value = tank.notes || '';
  document.getElementById('f-filterPresent').checked = !!tank.filter.present;
  document.getElementById('f-filterType').value = tank.filter.type || '';
  document.getElementById('f-co2Present').checked = !!tank.co2.present;
  document.getElementById('f-co2Type').value = tank.co2.type || '';

  const t = tank.targets;
  document.getElementById('f-tempMin').value = t.tempMin ?? '';
  document.getElementById('f-tempMax').value = t.tempMax ?? '';
  document.getElementById('f-tempUnit').value = t.tempUnit || 'F';
  document.getElementById('f-phMin').value = t.phMin ?? '';
  document.getElementById('f-phMax').value = t.phMax ?? '';
  document.getElementById('f-ghMin').value = t.ghMin ?? '';
  document.getElementById('f-ghMax').value = t.ghMax ?? '';
  document.getElementById('f-khMin').value = t.khMin ?? '';
  document.getElementById('f-khMax').value = t.khMax ?? '';
  document.getElementById('f-nitrateMax').value = t.nitrateMax ?? '';
  document.getElementById('f-ammoniaMax').value = t.ammoniaMax ?? '';
  document.getElementById('f-nitriteMax').value = t.nitriteMax ?? '';

  renderAgeDisplay(tank);
  renderPlants(tank);
  renderStocking(tank);
}

function renderAgeDisplay(tank) {
  const el = document.getElementById('ageDisplay');
  if (!tank.createdDate) { el.textContent = ''; return; }
  const days = Math.floor((Date.now() - new Date(tank.createdDate + 'T00:00:00')) / 86400000);
  if (days < 0) { el.textContent = 'Setup date is in the future'; return; }
  if (days < 14) el.textContent = `${days} day(s) old`;
  else if (days < 365) el.textContent = `${Math.floor(days / 7)} week(s) old`;
  else el.textContent = `${(days / 365).toFixed(1)} year(s) old`;
}

function addPlant() {
  const tank = getActiveTank();
  if (!tank) return;
  const input = document.getElementById('newPlantInput');
  const val = input.value.trim();
  if (!val) return;
  tank.plants.push(val);
  input.value = '';
  saveState();
  renderPlants(tank);
}

function renderPlants(tank) {
  const wrap = document.getElementById('plantsList');
  wrap.innerHTML = '';
  tank.plants.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = p;
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.title = 'Remove';
    rm.addEventListener('click', () => {
      tank.plants.splice(i, 1);
      saveState();
      renderPlants(tank);
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  });
}

function addStocking() {
  const tank = getActiveTank();
  if (!tank) return;
  const species = document.getElementById('newStockSpecies').value.trim();
  const qty = parseInt(document.getElementById('newStockQty').value, 10) || 1;
  const notes = document.getElementById('newStockNotes').value.trim();
  if (!species) return;
  tank.stocking.push({ species, qty, notes });
  document.getElementById('newStockSpecies').value = '';
  document.getElementById('newStockQty').value = '1';
  document.getElementById('newStockNotes').value = '';
  saveState();
  renderStocking(tank);
}

function renderStocking(tank) {
  const tbody = document.querySelector('#stockingTable tbody');
  tbody.innerHTML = '';
  tank.stocking.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(s.species)}</td><td>${s.qty}</td><td>${escapeHtml(s.notes || '')}</td><td></td>`;
    const rmBtn = document.createElement('button');
    rmBtn.className = 'row-remove-btn';
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', () => {
      tank.stocking.splice(i, 1);
      saveState();
      renderStocking(tank);
    });
    tr.lastElementChild.appendChild(rmBtn);
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- Overview & feedback engine ---------- */

function renderOverview(tank) {
  const latestEl = document.getElementById('latestReading');
  const tests = [...tank.tests].sort((a, b) => a.date.localeCompare(b.date));
  const latest = tests[tests.length - 1];
  latestEl.innerHTML = '';
  if (!latest) {
    latestEl.innerHTML = '<p class="hint">No tests logged yet.</p>';
  } else {
    const fields = [
      ['Date', latest.date], ['Temp', fmtUnit(latest.temp, '')],
      ['pH', fmtUnit(latest.ph, '')], ['Ammonia', fmtUnit(latest.ammonia, 'ppm')],
      ['Nitrite', fmtUnit(latest.nitrite, 'ppm')], ['Nitrate', fmtUnit(latest.nitrate, 'ppm')],
      ['GH', fmtUnit(latest.gh, 'dGH')], ['KH', fmtUnit(latest.kh, 'dKH')],
      ['Phosphate', fmtUnit(latest.phosphate, 'ppm')]
    ];
    fields.forEach(([label, value]) => {
      const tile = document.createElement('div');
      tile.className = 'stat-tile';
      tile.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
      latestEl.appendChild(tile);
    });
  }

  const feedback = computeFeedback(tank);
  const list = document.getElementById('feedbackList');
  list.innerHTML = '';
  feedback.forEach(item => {
    const div = document.createElement('div');
    div.className = 'feedback-item ' + item.level;
    div.textContent = item.text;
    list.appendChild(div);
  });
}

function fmtUnit(v, unit) {
  if (v === null || v === undefined || v === '') return '—';
  return v + (unit ? ' ' + unit : '');
}

function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000);
}

function computeFeedback(tank) {
  const out = [];
  const tests = [...tank.tests].sort((a, b) => a.date.localeCompare(b.date));
  const latest = tests[tests.length - 1];
  const prev = tests[tests.length - 2];
  const targets = tank.targets || defaultTargets();

  // Tank age / cycling
  if (tank.createdDate) {
    const age = daysAgo(tank.createdDate);
    if (age >= 0 && age < 42) {
      out.push({ level: 'info', text: `Tank is young (${age} day(s) old) and may still be cycling. Test every 1-2 days and watch closely for ammonia/nitrite spikes.` });
    }
  }
  if (!tank.filter.present) {
    out.push({ level: 'info', text: 'No filter is set for this tank. If that\'s intentional (e.g. a low-tech/Walstad-style setup), keep a close eye on ammonia and nitrite since biological filtration relies entirely on substrate and plants.' });
  }

  if (!latest) {
    out.push({ level: 'info', text: 'Log a water test to get parameter-based feedback.' });
    return out;
  }

  // Ammonia
  if (latest.ammonia !== null && latest.ammonia !== undefined) {
    const max = targets.ammoniaMax ?? 0;
    if (latest.ammonia > max + 0.5) {
      out.push({ level: 'danger', text: `Ammonia is ${latest.ammonia} ppm — toxic to fish. Do a large water change (25-50%) now, hold off on feeding/adding fish, and retest in 24h.` });
    } else if (latest.ammonia > max) {
      out.push({ level: 'warning', text: `Trace ammonia detected (${latest.ammonia} ppm). Keep an eye on it and consider a partial water change.` });
    }
  }

  // Nitrite
  if (latest.nitrite !== null && latest.nitrite !== undefined) {
    const max = targets.nitriteMax ?? 0;
    if (latest.nitrite > max + 0.25) {
      out.push({ level: 'danger', text: `Nitrite is ${latest.nitrite} ppm — highly toxic even at low levels. Do a water change now and consider adding aquarium salt (if appropriate for your stock) to reduce nitrite toxicity.` });
    } else if (latest.nitrite > max) {
      out.push({ level: 'warning', text: `Trace nitrite detected (${latest.nitrite} ppm). Monitor closely, this often accompanies mid-cycle.` });
    }
  }

  // Nitrate
  if (latest.nitrate !== null && latest.nitrate !== undefined && targets.nitrateMax !== null) {
    if (latest.nitrate > targets.nitrateMax) {
      out.push({ level: 'warning', text: `Nitrate is ${latest.nitrate} ppm, above your target max of ${targets.nitrateMax} ppm. A water change should bring it down.` });
    } else if (tank.co2.present && latest.nitrate < 5) {
      out.push({ level: 'info', text: `Nitrate is very low (${latest.nitrate} ppm) in a CO2-injected planted tank. Plants may be nitrogen-limited — consider dosing a nitrogen-containing fertilizer.` });
    }
  }

  // pH
  if (latest.ph !== null && latest.ph !== undefined) {
    if (targets.phMin !== null && latest.ph < targets.phMin) {
      out.push({ level: 'warning', text: `pH (${latest.ph}) is below your target range (${targets.phMin}-${targets.phMax}).` });
    } else if (targets.phMax !== null && latest.ph > targets.phMax) {
      out.push({ level: 'warning', text: `pH (${latest.ph}) is above your target range (${targets.phMin}-${targets.phMax}).` });
    }
    if (prev && prev.ph !== null && prev.ph !== undefined) {
      const diff = Math.abs(latest.ph - prev.ph);
      if (diff >= 0.3) {
        out.push({ level: 'warning', text: `pH shifted by ${diff.toFixed(2)} since the last test (${prev.date} → ${latest.date}). Sudden swings stress fish more than a stable-but-imperfect pH.` });
      }
    }
  }

  // KH / pH crash risk
  if (latest.kh !== null && latest.kh !== undefined && latest.kh < 3 && latest.ph !== null && latest.ph < 7) {
    out.push({ level: 'warning', text: `KH is low (${latest.kh} dKH) with a pH under 7 — there's limited buffering capacity, which raises the risk of a sudden pH crash. Monitor closely or consider a buffering substrate/additive.` });
  }

  // GH / KH out of range
  if (latest.gh !== null && latest.gh !== undefined && targets.ghMin !== null && targets.ghMax !== null) {
    if (latest.gh < targets.ghMin || latest.gh > targets.ghMax) {
      out.push({ level: 'info', text: `GH (${latest.gh} dGH) is outside your target range (${targets.ghMin}-${targets.ghMax}). Confirm this suits your stocking.` });
    }
  }
  if (latest.kh !== null && latest.kh !== undefined && targets.khMin !== null && targets.khMax !== null) {
    if (latest.kh < targets.khMin || latest.kh > targets.khMax) {
      out.push({ level: 'info', text: `KH (${latest.kh} dKH) is outside your target range (${targets.khMin}-${targets.khMax}).` });
    }
  }

  // Temp
  if (latest.temp !== null && latest.temp !== undefined && targets.tempMin !== null && targets.tempMax !== null) {
    if (latest.temp < targets.tempMin || latest.temp > targets.tempMax) {
      out.push({ level: 'warning', text: `Temperature (${latest.temp}°${targets.tempUnit}) is outside your target range (${targets.tempMin}-${targets.tempMax}°${targets.tempUnit}).` });
    }
  }

  // Water change recency
  const wcs = [...tank.waterChanges].sort((a, b) => a.date.localeCompare(b.date));
  const lastWc = wcs[wcs.length - 1];
  if (!lastWc) {
    out.push({ level: 'info', text: 'No water changes logged yet. Regular water changes help control nitrate and replenish trace minerals.' });
  } else {
    const days = daysAgo(lastWc.date);
    if (days > 14) {
      out.push({ level: 'info', text: `Last logged water change was ${days} days ago. Consider a fresh water change soon.` });
    }
  }

  // Small tank + heavy stocking heuristic
  if (tank.sizeValue && tank.stocking.length) {
    const totalQty = tank.stocking.reduce((sum, s) => sum + (s.qty || 0), 0);
    const gallons = tank.sizeUnit === 'L' ? tank.sizeValue / 3.785 : tank.sizeValue;
    if (gallons > 0 && totalQty / gallons > 1.5) {
      out.push({ level: 'info', text: `You have ${totalQty} animals logged in roughly ${Math.round(gallons)} gallons. This is a rough heuristic, not a real bioload calculation — but it's worth double-checking adult sizes, filtration capacity, and water change frequency.` });
    }
  }

  if (out.filter(f => f.level === 'danger' || f.level === 'warning').length === 0 && latest) {
    out.push({ level: 'good', text: 'Latest reading looks good against your target ranges. Keep up the routine.' });
  }

  return out;
}

/* ---------- Tests tab ---------- */

function bindTestsTab() {
  document.getElementById('testForm').addEventListener('submit', e => {
    e.preventDefault();
    const tank = getActiveTank();
    if (!tank) return;
    const test = {
      id: uid(),
      date: document.getElementById('t-date').value || todayStr(),
      temp: numOrNull(document.getElementById('t-temp').value),
      ph: numOrNull(document.getElementById('t-ph').value),
      ammonia: numOrNull(document.getElementById('t-ammonia').value),
      nitrite: numOrNull(document.getElementById('t-nitrite').value),
      nitrate: numOrNull(document.getElementById('t-nitrate').value),
      gh: numOrNull(document.getElementById('t-gh').value),
      kh: numOrNull(document.getElementById('t-kh').value),
      phosphate: numOrNull(document.getElementById('t-phosphate').value),
      notes: document.getElementById('t-notes').value
    };
    tank.tests.push(test);
    saveState();
    e.target.reset();
    document.getElementById('t-date').value = todayStr();
    renderTestsTab(tank);
    renderOverview(tank);
  });
  document.getElementById('t-date').value = todayStr();

  document.getElementById('chartParam').addEventListener('change', () => {
    const tank = getActiveTank();
    if (tank) renderChart(tank);
  });

  document.getElementById('csvImportInput').addEventListener('change', importCsv);
  document.getElementById('exportTestsCsvBtn').addEventListener('click', () => {
    const tank = getActiveTank();
    if (!tank) return;
    exportTestsCsv(tank);
  });
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function renderTestsTab(tank) {
  if (!tank) return;
  renderTestsTable(tank);
  renderChart(tank);
}

function renderTestsTable(tank) {
  const tbody = document.querySelector('#testsTable tbody');
  tbody.innerHTML = '';
  const tests = [...tank.tests].sort((a, b) => b.date.localeCompare(a.date));
  tests.forEach(test => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${test.date}</td>
      <td>${fmtCell(test.temp)}</td>
      <td>${fmtCell(test.ph)}</td>
      <td>${fmtCell(test.ammonia)}</td>
      <td>${fmtCell(test.nitrite)}</td>
      <td>${fmtCell(test.nitrate)}</td>
      <td>${fmtCell(test.gh)}</td>
      <td>${fmtCell(test.kh)}</td>
      <td>${fmtCell(test.phosphate)}</td>
      <td>${escapeHtml(test.notes || '')}</td>
      <td></td>`;
    const rmBtn = document.createElement('button');
    rmBtn.className = 'row-remove-btn';
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', () => {
      tank.tests = tank.tests.filter(t => t.id !== test.id);
      saveState();
      renderTestsTab(tank);
      renderOverview(tank);
    });
    tr.lastElementChild.appendChild(rmBtn);
    tbody.appendChild(tr);
  });
}

function fmtCell(v) {
  return (v === null || v === undefined || v === '') ? '' : v;
}

function exportTestsCsv(tank) {
  const cols = ['date', 'temp', 'ph', 'ammonia', 'nitrite', 'nitrate', 'gh', 'kh', 'phosphate', 'notes'];
  const rows = [cols.join(',')];
  [...tank.tests].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    rows.push(cols.map(c => csvEscape(t[c] ?? '')).join(','));
  });
  downloadFile(`${slug(tank.name)}-tests.csv`, rows.join('\n'), 'text/csv');
}

function csvEscape(v) {
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function slug(s) {
  return (s || 'tank').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function importCsv(e) {
  const file = e.target.files[0];
  const tank = getActiveTank();
  const resultEl = document.getElementById('csvImportResult');
  if (!file || !tank) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { imported, skipped } = parseCsvTests(reader.result);
      tank.tests.push(...imported);
      saveState();
      renderTestsTab(tank);
      renderOverview(tank);
      resultEl.textContent = `Imported ${imported.length} row(s), skipped ${skipped}.`;
    } catch (err) {
      resultEl.textContent = 'Import failed: ' + err.message;
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

const CSV_FIELD_ALIASES = {
  date: ['date', 'testdate'],
  temp: ['temp', 'temperature'],
  ph: ['ph'],
  ammonia: ['ammonia', 'nh3', 'nh3/nh4', 'nh4'],
  nitrite: ['nitrite', 'no2'],
  nitrate: ['nitrate', 'no3'],
  gh: ['gh', 'generalhardness'],
  kh: ['kh', 'carbonatehardness', 'alkalinity'],
  phosphate: ['phosphate', 'po4'],
  notes: ['notes', 'note', 'comment', 'comments']
};

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvTests(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error('No data rows found');
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const colMap = {};
  header.forEach((h, idx) => {
    for (const [field, aliases] of Object.entries(CSV_FIELD_ALIASES)) {
      if (aliases.includes(h) && colMap[field] === undefined) colMap[field] = idx;
    }
  });
  if (colMap.date === undefined) throw new Error('CSV must include a "date" column');

  const imported = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const rawDate = (cells[colMap.date] || '').trim();
    const date = normalizeDate(rawDate);
    if (!date) { skipped++; continue; }
    const test = { id: uid(), date, temp: null, ph: null, ammonia: null, nitrite: null, nitrate: null, gh: null, kh: null, phosphate: null, notes: '' };
    ['temp', 'ph', 'ammonia', 'nitrite', 'nitrate', 'gh', 'kh', 'phosphate'].forEach(f => {
      if (colMap[f] !== undefined) test[f] = numOrNull(cells[colMap[f]]);
    });
    if (colMap.notes !== undefined) test.notes = (cells[colMap.notes] || '').trim();
    imported.push(test);
  }
  return { imported, skipped };
}

function normalizeDate(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/* ---------- Chart ---------- */

function renderChart(tank) {
  const svg = document.getElementById('chartSvg');
  const param = document.getElementById('chartParam').value;
  const tests = [...tank.tests]
    .filter(t => t[param] !== null && t[param] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));

  svg.innerHTML = '';
  const W = 640, H = 220, padL = 40, padR = 16, padT = 16, padB = 28;

  if (tests.length === 0) {
    const text = svgEl('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle' });
    text.textContent = 'No data for this parameter yet';
    svg.appendChild(text);
    return;
  }

  const values = tests.map(t => t[param]);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const rangePad = (max - min) * 0.1;
  min -= rangePad; max += rangePad;

  const xFor = i => padL + (i / Math.max(1, tests.length - 1)) * (W - padL - padR);
  const yFor = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  // axis
  svg.appendChild(svgEl('line', { x1: padL, y1: padT, x2: padL, y2: H - padB, class: 'chart-axis' }));
  svg.appendChild(svgEl('line', { x1: padL, y1: H - padB, x2: W - padR, y2: H - padB, class: 'chart-axis' }));

  const yLabelTop = svgEl('text', { x: padL - 6, y: padT + 4, 'text-anchor': 'end' });
  yLabelTop.textContent = max.toFixed(1);
  svg.appendChild(yLabelTop);
  const yLabelBottom = svgEl('text', { x: padL - 6, y: H - padB, 'text-anchor': 'end' });
  yLabelBottom.textContent = min.toFixed(1);
  svg.appendChild(yLabelBottom);

  const firstLabel = svgEl('text', { x: padL, y: H - padB + 14, 'text-anchor': 'start' });
  firstLabel.textContent = tests[0].date;
  svg.appendChild(firstLabel);
  const lastLabel = svgEl('text', { x: W - padR, y: H - padB + 14, 'text-anchor': 'end' });
  lastLabel.textContent = tests[tests.length - 1].date;
  svg.appendChild(lastLabel);

  const points = tests.map((t, i) => `${xFor(i)},${yFor(t[param])}`).join(' ');
  svg.appendChild(svgEl('polyline', { points, class: 'chart-line' }));

  tests.forEach((t, i) => {
    const c = svgEl('circle', { cx: xFor(i), cy: yFor(t[param]), r: 3, class: 'chart-dot' });
    const title = svgEl('title', {});
    title.textContent = `${t.date}: ${t[param]}`;
    c.appendChild(title);
    svg.appendChild(c);
  });
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/* ---------- Water changes tab ---------- */

function bindWaterChangesTab() {
  document.getElementById('wcForm').addEventListener('submit', e => {
    e.preventDefault();
    const tank = getActiveTank();
    if (!tank) return;
    const wc = {
      id: uid(),
      date: document.getElementById('wc-date').value || todayStr(),
      percent: numOrNull(document.getElementById('wc-percent').value),
      notes: document.getElementById('wc-notes').value
    };
    tank.waterChanges.push(wc);
    saveState();
    e.target.reset();
    document.getElementById('wc-date').value = todayStr();
    renderWaterChangesTab(tank);
    renderOverview(tank);
  });
  document.getElementById('wc-date').value = todayStr();
}

function renderWaterChangesTab(tank) {
  if (!tank) return;
  const wcs = [...tank.waterChanges].sort((a, b) => b.date.localeCompare(a.date));
  const tbody = document.querySelector('#wcTable tbody');
  tbody.innerHTML = '';
  wcs.forEach(wc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${wc.date}</td><td>${fmtCell(wc.percent)}</td><td>${escapeHtml(wc.notes || '')}</td><td></td>`;
    const rmBtn = document.createElement('button');
    rmBtn.className = 'row-remove-btn';
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', () => {
      tank.waterChanges = tank.waterChanges.filter(w => w.id !== wc.id);
      saveState();
      renderWaterChangesTab(tank);
      renderOverview(tank);
    });
    tr.lastElementChild.appendChild(rmBtn);
    tbody.appendChild(tr);
  });

  const hintEl = document.getElementById('lastWcHint');
  if (wcs.length) {
    hintEl.textContent = `Last water change: ${wcs[0].date} (${daysAgo(wcs[0].date)} days ago)`;
  } else {
    hintEl.textContent = 'No water changes logged yet.';
  }
}

/* ---------- Ask Claude tab ---------- */

function bindAskTab() {
  document.getElementById('genSummaryBtn').addEventListener('click', () => {
    const tank = getActiveTank();
    if (!tank) return;
    document.getElementById('summaryOutput').value = buildSummary(tank);
  });
  document.getElementById('copySummaryBtn').addEventListener('click', () => {
    const ta = document.getElementById('summaryOutput');
    if (!ta.value) return;
    ta.select();
    navigator.clipboard?.writeText(ta.value).catch(() => document.execCommand('copy'));
  });
  document.getElementById('downloadSummaryBtn').addEventListener('click', () => {
    const tank = getActiveTank();
    const ta = document.getElementById('summaryOutput');
    if (!tank || !ta.value) return;
    downloadFile(`${slug(tank.name)}-summary.txt`, ta.value, 'text/plain');
  });

  // persist api key / model locally (not part of tank backup, kept separate)
  const keyInput = document.getElementById('apiKeyInput');
  const modelInput = document.getElementById('apiModelInput');
  keyInput.value = localStorage.getItem('aquariumTracker.apiKey') || '';
  modelInput.value = localStorage.getItem('aquariumTracker.apiModel') || '';
  keyInput.addEventListener('change', () => localStorage.setItem('aquariumTracker.apiKey', keyInput.value));
  modelInput.addEventListener('change', () => localStorage.setItem('aquariumTracker.apiModel', modelInput.value));

  document.getElementById('askBtn').addEventListener('click', askClaude);
}

function buildSummary(tank) {
  const lines = [];
  lines.push(`Aquarium summary: ${tank.name}`);
  lines.push('='.repeat(20));
  if (tank.createdDate) {
    lines.push(`Setup date: ${tank.createdDate} (${document.getElementById('ageDisplay').textContent})`);
  }
  if (tank.sizeValue) lines.push(`Size: ${tank.sizeValue} ${tank.sizeUnit}`);
  lines.push(`Filter: ${tank.filter.present ? (tank.filter.type || 'yes, type unspecified') : 'none'}`);
  lines.push(`CO2: ${tank.co2.present ? (tank.co2.type || 'yes, details unspecified') : 'none'}`);
  if (tank.substrate) lines.push(`Substrate: ${tank.substrate}`);
  if (tank.plants.length) lines.push(`Plants: ${tank.plants.join(', ')}`);
  if (tank.stocking.length) {
    lines.push('Stocking:');
    tank.stocking.forEach(s => lines.push(`  - ${s.qty}x ${s.species}${s.notes ? ' (' + s.notes + ')' : ''}`));
  }
  const t = tank.targets;
  lines.push(`Target ranges: temp ${t.tempMin}-${t.tempMax}°${t.tempUnit}, pH ${t.phMin}-${t.phMax}, GH ${t.ghMin}-${t.ghMax} dGH, KH ${t.khMin}-${t.khMax} dKH, nitrate max ${t.nitrateMax} ppm`);
  if (tank.notes) lines.push(`Notes: ${tank.notes}`);

  lines.push('');
  lines.push('Recent water tests (most recent last):');
  const tests = [...tank.tests].sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  if (!tests.length) {
    lines.push('  (none logged)');
  } else {
    lines.push('  date       | temp | pH   | NH3  | NO2  | NO3  | GH   | KH   | PO4  | notes');
    tests.forEach(t => {
      lines.push(`  ${t.date} | ${pad(t.temp)} | ${pad(t.ph)} | ${pad(t.ammonia)} | ${pad(t.nitrite)} | ${pad(t.nitrate)} | ${pad(t.gh)} | ${pad(t.kh)} | ${pad(t.phosphate)} | ${t.notes || ''}`);
    });
  }

  const wcs = [...tank.waterChanges].sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  lines.push('');
  lines.push('Recent water changes:');
  if (!wcs.length) lines.push('  (none logged)');
  else wcs.forEach(w => lines.push(`  ${w.date}: ${w.percent ?? '?'}%${w.notes ? ' - ' + w.notes : ''}`));

  lines.push('');
  lines.push('Automated feedback from this app:');
  computeFeedback(tank).forEach(f => lines.push(`  [${f.level.toUpperCase()}] ${f.text}`));

  lines.push('');
  lines.push('Please review the above and let me know if anything looks concerning or what I should do next.');

  return lines.join('\n');
}

function pad(v) {
  return (v === null || v === undefined || v === '') ? '—' : String(v).padEnd(4);
}

async function askClaude() {
  const statusEl = document.getElementById('askStatus');
  const answerEl = document.getElementById('askAnswer');
  const tank = getActiveTank();
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('apiModelInput').value.trim();
  const question = document.getElementById('askQuestion').value.trim();

  answerEl.textContent = '';
  if (!tank) return;
  if (!apiKey) { statusEl.textContent = 'Enter your Anthropic API key first.'; return; }
  if (!model) { statusEl.textContent = 'Enter a model ID first (see docs.anthropic.com/en/docs/about-claude/models).'; return; }
  if (!question) { statusEl.textContent = 'Type a question first.'; return; }

  statusEl.textContent = 'Asking Claude...';
  const summary = buildSummary(tank);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: 'You are an aquarium-keeping assistant. The user will give you a summary of their tank and its water test history, then ask a question. Give practical, specific advice.',
        messages: [{ role: 'user', content: `${summary}\n\nQuestion: ${question}` }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('\n').trim();
    answerEl.textContent = text || '(empty response)';
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = 'Request failed: ' + err.message + ' (your browser may block direct API calls — use the Export Summary option instead).';
  }
}

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', init);
