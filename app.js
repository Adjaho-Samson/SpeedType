(() => {
  'use strict';

  const STORE = { records: 'speedtype.records.v1', preferences: 'speedtype.preferences.v1' };
  const passages = [
    'La régularité transforme les petits efforts en progrès durables. Chaque phrase tapée avec attention vous rapproche d’une frappe plus fluide, plus juste et plus libre.',
    'Au petit matin, la ville s’éveille doucement. Les fenêtres s’éclairent, les cafés ouvrent leurs portes et les premières idées prennent forme au bout des doigts.',
    'Un bon rythme ne se force pas : il se construit. Respirez, gardez les épaules détendues et laissez vos mains retrouver leur chemin sur le clavier.',
    'La curiosité nous emmène parfois très loin. Il suffit d’une question, d’un carnet ouvert et d’un peu de patience pour découvrir une nouvelle façon de voir le monde.',
    'Dans le jardin, le vent fait danser les feuilles. Une mésange se pose près du vieux banc, puis s’envole au-dessus des fleurs baignées de lumière.',
    'Écrire, c’est donner une forme à ses idées. Un mot après l’autre, le brouillon devient une histoire, une lettre ou le début d’un projet inattendu.',
    'Le calme aide à trouver la cadence. Prenez le temps de lire chaque ligne, puis avancez sans regarder vos mains : la précision vient avant la vitesse.',
    'Sur la côte, les pirogues colorées reviennent au port. Le soleil descend lentement et la mer garde en mémoire le passage de chaque vague.'
  ];

  const el = (id) => document.getElementById(id);
  const ui = {
    input: el('typingInput'), passage: el('passageText'), passageBox: el('passageBox'),
    wpm: el('wpmValue'), accuracy: el('accuracyValue'), time: el('timeValue'),
    record: el('recordValue'), durationLabel: el('recordDurationLabel'), progress: el('progressFill'),
    state: el('runState'), stateText: el('runStateText'), restart: el('restartButton'),
    result: el('resultPanel'), resultTitle: el('resultTitle'), resultSummary: el('resultSummary'),
    resultWpm: el('resultWpm'), resultAccuracy: el('resultAccuracy'), resultErrors: el('resultErrors'),
    bestWpm: el('bestWpm'), bestAccuracy: el('bestAccuracy'), testsCount: el('testsCount'),
    recordSubheading: el('recordSubheading'), toast: el('toast')
  };

  const safeRead = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { showToast('Le navigateur ne peut pas enregistrer les données locales.'); return false; }
  };
  let preferences = safeRead(STORE.preferences, { duration: 30 });
  if (![15, 30, 60, 120].includes(Number(preferences.duration))) preferences.duration = 30;
  preferences.duration = Number(preferences.duration);
  let records = safeRead(STORE.records, { byDuration: {}, totalTests: 0 });
  if (!records || typeof records !== 'object') records = { byDuration: {}, totalTests: 0 };
  if (!records.byDuration) records.byDuration = {};
  if (!Number.isFinite(records.totalTests)) records.totalTests = 0;

  let duration = preferences.duration;
  let target = '';
  let timer = null;
  let startTime = 0;
  let started = false;
  let finished = false;
  let toastTimeout;

  function escapeHTML(char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char;
  }
  function choosePassage() {
    const first = Math.floor(Math.random() * passages.length);
    const second = (first + 1 + Math.floor(Math.random() * (passages.length - 1))) % passages.length;
    const third = (second + 1 + Math.floor(Math.random() * (passages.length - 1))) % passages.length;
    target = `${passages[first]} ${passages[second]} ${passages[third]}`;
  }
  function currentRecord() { return records.byDuration[String(duration)] || null; }
  function renderTarget() {
    const typed = ui.input.value;
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const ch = escapeHTML(target[i]);
      if (i < typed.length) {
        html += `<span class="${typed[i] === target[i] ? 'correct' : 'incorrect'}">${ch}</span>`;
      } else if (i === typed.length && !finished) {
        html += `<span class="current">${ch === ' ' ? '&nbsp;' : ch}</span>`;
      } else {
        html += ch === ' ' ? '&nbsp;' : ch;
      }
    }
    ui.passage.innerHTML = html;
    const pct = Math.min(100, Math.round((typed.length / target.length) * 100));
    ui.progress.style.width = `${pct}%`;
  }
  function correctCount(value = ui.input.value) {
    let correct = 0;
    for (let i = 0; i < value.length; i++) if (value[i] === target[i]) correct++;
    return correct;
  }
  function currentStats(elapsedSeconds) {
    const typed = ui.input.value;
    const correct = correctCount(typed);
    const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    const mins = Math.max(elapsedSeconds, 0.5) / 60;
    const wpm = Math.round((correct / 5) / mins);
    return { wpm: Math.max(0, wpm), accuracy, errors: typed.length - correct, typed: typed.length };
  }
  function elapsedNow() { return started ? Math.min(duration, (Date.now() - startTime) / 1000) : 0; }
  function updateRecordPanel() {
    const best = currentRecord();
    ui.record.textContent = best ? String(best.wpm) : '—';
    ui.bestWpm.textContent = best ? String(best.wpm) : '—';
    ui.bestAccuracy.textContent = best ? `${best.accuracy}%` : '—';
    ui.testsCount.textContent = String(records.totalTests || 0);
    ui.durationLabel.textContent = String(duration);
    ui.recordSubheading.textContent = `Sur ${duration} secondes`;
  }
  function updateLiveStats() {
    const elapsed = elapsedNow();
    const left = started ? Math.max(0, Math.ceil(duration - elapsed)) : duration;
    const stats = currentStats(elapsed);
    ui.wpm.textContent = String(stats.wpm);
    ui.accuracy.innerHTML = `${stats.accuracy}<span class="metric-small">%</span>`;
    ui.time.innerHTML = `${left}<span class="metric-small">s</span>`;
    ui.progress.style.width = `${Math.min(100, (ui.input.value.length / target.length) * 100)}%`;
    if (started && left <= 0) finishRun();
  }
  function setState(name, label) {
    ui.state.classList.remove('is-running', 'is-done');
    if (name) ui.state.classList.add(name);
    ui.stateText.textContent = label;
  }
  function resetRun({ newPassage = true } = {}) {
    clearInterval(timer);
    timer = null; started = false; finished = false; startTime = 0;
    if (newPassage || !target) choosePassage();
    ui.input.value = '';
    ui.input.disabled = false;
    ui.result.hidden = true;
    ui.time.innerHTML = `${duration}<span class="metric-small">s</span>`;
    ui.wpm.textContent = '0';
    ui.accuracy.innerHTML = '100<span class="metric-small">%</span>';
    ui.progress.style.width = '0%';
    setState('', 'PRÊT À JOUER');
    renderTarget(); updateRecordPanel();
  }
  function beginRun() {
    if (started || finished) return;
    started = true; startTime = Date.now();
    setState('is-running', 'EN COURS');
    timer = setInterval(updateLiveStats, 100);
    updateLiveStats();
  }
  function finishRun() {
    if (finished) return;
    const elapsed = started ? Math.max(0.5, elapsedNow()) : duration;
    finished = true; started = false; clearInterval(timer); timer = null;
    const stats = currentStats(elapsed);
    ui.input.disabled = true;
    setState('is-done', 'TEST TERMINÉ');
    ui.time.innerHTML = `0<span class="metric-small">s</span>`;
    ui.wpm.textContent = String(stats.wpm);
    ui.accuracy.innerHTML = `${stats.accuracy}<span class="metric-small">%</span>`;
    ui.resultWpm.textContent = String(stats.wpm);
    ui.resultAccuracy.textContent = `${stats.accuracy}%`;
    ui.resultErrors.textContent = String(stats.errors);
    const previous = currentRecord();
    const isRecord = !previous || stats.wpm > previous.wpm;
    ui.resultTitle.textContent = isRecord && stats.typed > 0 ? 'Nouveau record !' : 'Bien joué !';
    ui.resultSummary.textContent = stats.typed ? `${stats.typed} caractères saisis · votre progression est enregistrée sur cet appareil.` : 'Un essai de plus vous rapprochera de votre meilleur score.';
    ui.result.hidden = false;
    if (stats.typed > 0) {
      records.totalTests = (records.totalTests || 0) + 1;
      if (isRecord) records.byDuration[String(duration)] = { wpm: stats.wpm, accuracy: stats.accuracy, date: new Date().toISOString() };
      safeWrite(STORE.records, records);
    }
    updateRecordPanel();
    ui.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => ui.toast.classList.remove('is-visible'), 2800);
  }

  document.querySelectorAll('.duration-button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.duration);
      if (next === duration) return;
      duration = next; preferences.duration = next; safeWrite(STORE.preferences, preferences);
      document.querySelectorAll('.duration-button').forEach((b) => {
        const selected = b === button;
        b.classList.toggle('is-selected', selected);
        b.setAttribute('aria-pressed', String(selected));
      });
      resetRun();
    });
  });
  ui.restart.addEventListener('click', () => { resetRun(); ui.input.focus({ preventScroll: true }); });
  ui.passageBox.addEventListener('click', () => ui.input.focus());
  ui.passageBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ui.input.focus(); }
  });
  ui.input.addEventListener('paste', (event) => { event.preventDefault(); showToast('Le collage est désactivé pendant le test.'); });
  ui.input.addEventListener('drop', (event) => event.preventDefault());
  ui.input.addEventListener('input', () => {
    if (finished) return;
    if (ui.input.value.length > target.length) ui.input.value = ui.input.value.slice(0, target.length);
    if (ui.input.value.length && !started) beginRun();
    renderTarget(); updateLiveStats();
    if (ui.input.value.length >= target.length) finishRun();
  });

  function updateConnection() {
    const offline = !navigator.onLine;
    el('connectionStatus').classList.toggle('is-offline', offline);
    el('connectionLabel').textContent = offline ? 'Hors ligne' : 'En ligne';
    if (offline) el('installStatus').textContent = 'Vous êtes hors ligne : le jeu et vos records restent disponibles.';
    else if (el('installStatus').dataset.message !== 'custom') el('installStatus').textContent = 'Le jeu et vos records fonctionnent aussi hors connexion.';
  }
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();

  // Installation PWA: n'affiche le bouton natif que si le navigateur le propose.
  let deferredInstallPrompt = null;
  const installButton = el('installButton');
  const installStatus = el('installStatus');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isDesktop = !isIOS && !isAndroid && !/Mobi/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!isStandalone) {
    if (isIOS) el('iosHelp').hidden = false;
    else if (isAndroid) el('androidHelp').hidden = false;
    else if (isDesktop) el('desktopHelp').hidden = false;
  } else {
    installStatus.textContent = 'SpeedType est installée : vos progrès sont enregistrés sur cet appareil.';
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
    installStatus.textContent = 'Installation disponible : ajoutez SpeedType à votre appareil.';
  });
  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    if (choice && choice.outcome === 'accepted') installStatus.textContent = 'SpeedType est en cours d’installation.';
    else installStatus.textContent = 'Installation annulée. Vous pourrez réessayer depuis le menu du navigateur.';
  });
  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    el('iosHelp').hidden = true; el('androidHelp').hidden = true; el('desktopHelp').hidden = true;
    installStatus.textContent = 'SpeedType est installée : vos records restent sur cet appareil.';
    showToast('SpeedType a bien été installée.');
  });

  // Service worker avec diagnostic visible et flux de mise à jour explicite.
  const pwaStatus = el('pwaStatus');
  const updateBanner = el('updateBanner');
  let waitingWorker = null;
  let refreshing = false;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
        pwaStatus.textContent = 'Mode hors ligne prêt';
        function watchForUpdate() {
          if (registration.waiting && navigator.serviceWorker.controller) {
            waitingWorker = registration.waiting;
            updateBanner.hidden = false;
          }
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker = worker;
                updateBanner.hidden = false;
              }
            });
          });
        }
        watchForUpdate();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && registration.update) registration.update().catch(() => {});
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) { refreshing = true; window.location.reload(); }
        });
      } catch (error) {
        pwaStatus.textContent = 'Mode hors ligne non disponible';
        installStatus.textContent = 'Le service hors ligne n’a pas pu démarrer. Vérifiez que le site est servi en HTTPS.';
        console.warn('SpeedType: échec d’enregistrement du service worker.', error);
      }
    });
  } else {
    pwaStatus.textContent = 'PWA : HTTPS requis';
    if (!isStandalone) installStatus.textContent = 'L’installation et le mode hors ligne nécessitent HTTPS (sauf sur localhost).';
  }
  el('updateButton').addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });
  el('dismissUpdate').addEventListener('click', () => { updateBanner.hidden = true; });

  document.querySelectorAll('.duration-button').forEach((button) => {
    const selected = Number(button.dataset.duration) === duration;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  resetRun({ newPassage: true });
})();
