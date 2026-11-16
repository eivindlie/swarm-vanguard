// Renders the app icon (SVG below) to every PNG size a PWA needs, using the Chromium that Playwright ships.
// Usage: node tools/make-icons.mjs   -> public/icons/*.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// A blue squad charging a horned red horde under a glowing sun. `safe` shrinks the artwork for maskable icons
// (the OS may crop up to 20% from each edge) and `round` rounds the corners for plain "any" icons.
const svg = ({ safe = 1, round = false }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2f8a"/><stop offset="0.55" stop-color="#262b66"/><stop offset="1" stop-color="#15162e"/></linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.28" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <linearGradient id="lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c98a" stop-opacity="0.25"/><stop offset="1" stop-color="#e8c98a" stop-opacity="0.55"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${round ? 112 : 0}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${round ? 112 : 0}" fill="url(#sun)"/>
  <g transform="translate(256 256) scale(${safe}) translate(-256 -256)">
    <path d="M196 120 L316 120 L560 700 L-48 700 Z" fill="url(#lane)"/>
    <!-- the horde: a ragged red mass with horns -->
    <g fill="#d93636">
      <circle cx="150" cy="132" r="26"/><circle cx="204" cy="118" r="28"/><circle cx="262" cy="112" r="30"/><circle cx="320" cy="120" r="28"/><circle cx="372" cy="134" r="26"/>
      <circle cx="176" cy="170" r="26"/><circle cx="236" cy="160" r="28"/><circle cx="296" cy="160" r="28"/><circle cx="348" cy="172" r="26"/>
    </g>
    <g fill="#f3e6c8"><path d="M130 112 l-10 -34 l26 22z"/><path d="M186 96 l-8 -36 l26 24z"/><path d="M244 88 l-6 -38 l28 24z"/><path d="M304 98 l-6 -36 l26 24z"/><path d="M356 112 l-4 -34 l26 22z"/></g>
    <g fill="#ffee55"><circle cx="262" cy="108" r="6"/><circle cx="236" cy="156" r="5"/><circle cx="296" cy="156" r="5"/></g>
    <!-- tracers -->
    <g stroke="#ffd23a" stroke-width="9" stroke-linecap="round"><path d="M214 330 L218 236"/><path d="M256 320 L256 220"/><path d="M298 330 L294 236"/></g>
    <g stroke="#fff4b0" stroke-width="3.5" stroke-linecap="round"><path d="M214 326 L217 250"/><path d="M256 316 L256 232"/><path d="M298 326 L295 250"/></g>
    <!-- the squad: helmets over bodies -->
    <g>
      ${[[256, 384], [212, 410], [300, 410], [168, 436], [256, 440], [344, 436]]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y + 20}" rx="22" ry="8" fill="#000" opacity="0.28"/><rect x="${x - 17}" y="${y - 6}" width="34" height="36" rx="14" fill="#2f6fff"/><circle cx="${x}" cy="${y - 14}" r="19" fill="#1d3f9e"/><rect x="${x - 12}" y="${y - 17}" width="24" height="9" rx="4" fill="#8fe9ff"/>`)
        .join('')}
    </g>
  </g>
</svg>`;

const targets = [
  { file: 'icon-192.png', size: 192, opts: { round: true }, transparent: true },
  { file: 'icon-512.png', size: 512, opts: { round: true }, transparent: true },
  { file: 'icon-maskable-512.png', size: 512, opts: { safe: 0.78 } }, // full-bleed + safe zone
  { file: 'apple-touch-icon.png', size: 180, opts: { safe: 0.94 } }, // iOS rounds the corners itself
  { file: 'favicon-48.png', size: 48, opts: { round: true }, transparent: true },
];

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(t.opts).replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: !!t.transparent });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
