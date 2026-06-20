#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`✓ ${message}`);

const requiredFiles = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'README.md',
  'SECURITY.md',
  'LICENSE',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192.svg'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Falta archivo requerido: ${file}`);
}
if (!process.exitCode) ok('estructura mínima presente');

try {
  childProcess.execFileSync(process.execPath, ['--check', path.join(root, 'app.js')], { stdio: 'pipe' });
  childProcess.execFileSync(process.execPath, ['--check', path.join(root, 'sw.js')], { stdio: 'pipe' });
  ok('JavaScript válido');
} catch (error) {
  fail(`JavaScript inválido: ${error.stderr?.toString() || error.message}`);
}

let manifest;
try {
  manifest = JSON.parse(read('manifest.json'));
  ok('manifest.json válido');
} catch (error) {
  fail(`manifest.json inválido: ${error.message}`);
}

if (manifest) {
  for (const icon of manifest.icons || []) {
    if (!fs.existsSync(path.join(root, icon.src))) fail(`Icono del manifest no existe: ${icon.src}`);
  }
  if (manifest.display !== 'standalone') fail('La PWA debería usar display standalone');
  if (!String(manifest.start_url || '').startsWith('./')) fail('start_url debe ser relativo para GitHub Pages');
  if (!process.exitCode) ok('manifest PWA coherente');
}

const html = read('index.html');
const app = read('app.js');
const sw = read('sw.js');

if (!html.includes('Content-Security-Policy')) fail('Falta Content-Security-Policy en index.html');
if (/<script(?![^>]*src="app\.js")[^>]*>/i.test(html)) fail('Hay scripts inline o externos no esperados');
if (/on(click|load|error|mouseover)=/i.test(html)) fail('Hay manejadores inline en HTML');
if (!html.includes('<script src="app.js" defer></script>')) fail('app.js debería cargarse con defer');
if (!process.exitCode) ok('HTML sin scripts inline y con CSP');

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const jsIds = [...app.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
const missingIds = jsIds.filter((id) => !htmlIds.has(id));
if (missingIds.length) fail(`IDs usados por JS pero ausentes en HTML: ${missingIds.join(', ')}`);
else ok('todos los IDs usados por JS existen en HTML');

for (const asset of [...sw.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1]).filter(Boolean)) {
  const normalized = asset === '' ? 'index.html' : asset;
  if (normalized !== './' && !fs.existsSync(path.join(root, normalized))) fail(`Asset de service worker no existe: ${asset}`);
}
if (!process.exitCode) ok('service worker referencia assets existentes');

const versionMatch = app.match(/const APP_VERSION = '([^']+)'/);
if (!versionMatch) fail('No se encontró APP_VERSION en app.js');
else {
  const version = versionMatch[1];
  if (manifest && manifest.version !== version) fail(`Versión inconsistente: app.js=${version}, manifest=${manifest.version}`);
  if (!read('README.md').includes(`Versión actual: **${version}**`)) fail(`README no refleja la versión ${version}`);
  if (!process.exitCode) ok(`versión coherente: ${version}`);
}

if (!/sanitizePlainText/.test(app) || !/normalizeContacts/.test(app) || !/isUsablePhone/.test(app)) {
  fail('Faltan defensas de saneamiento y validación esperadas');
} else {
  ok('saneamiento y validación de datos presentes');
}

if (!process.exitCode) console.log('\nSmoke test completado sin errores críticos.');
