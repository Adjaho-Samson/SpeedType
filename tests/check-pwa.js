'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`PASS: ${message}`);

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.name && manifest.short_name === 'SpeedType' && manifest.display === 'standalone') pass('manifest JSON, nom et affichage autonome'); else fail('champs principaux du manifeste');
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((item) => item.sizes === size && item.type === 'image/png');
    if (!icon) { fail(`icône ${size} déclarée`); continue; }
    const filePath = path.join(root, icon.src.replace(/^\.\//, ''));
    if (!fs.existsSync(filePath)) { fail(`fichier ${icon.src}`); continue; }
    const png = fs.readFileSync(filePath);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    if (width === Number(size.split('x')[0]) && height === Number(size.split('x')[1])) pass(`icône ${size} présente et aux bonnes dimensions`); else fail(`dimensions incorrectes pour ${icon.src}`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const term of ['manifest.json', 'theme-color', 'apple-mobile-web-app-capable']) {
    if (html.includes(term)) pass(`configuration HTML : ${term}`); else fail(`configuration HTML absente : ${term}`);
  }
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const term of ['serviceWorker.register', 'beforeinstallprompt', 'speedtype.records.v1', 'speedtype.preferences.v1']) {
    if (app.includes(term)) pass(`application : ${term}`); else fail(`application incomplète : ${term}`);
  }
  for (const file of ['service-worker.js', 'app.js', 'styles.css', 'offline.html']) {
    if (fs.existsSync(path.join(root, file))) pass(`ressource présente : ${file}`); else fail(`ressource manquante : ${file}`);
  }
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  for (const term of ['CACHE_VERSION', 'caches.delete', 'SKIP_WAITING', "'./app.js'", "'./styles.css'"]) {
    if (sw.includes(term)) pass(`service worker : ${term}`); else fail(`service worker incomplet : ${term}`);
  }
} catch (error) { fail(error.message); }
