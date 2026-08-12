import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-artifact assertions (SPEC-PWA-001, D-4): reads dist/ produced by
// `vite build`. Run via `npm run test:build` (build + this suite), NOT part
// of the default `npm test` (vitest.config.js only includes *.test.js).
const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');
const dist = resolve(projectRoot, 'dist');

function readDist(relPath) {
  return readFileSync(resolve(dist, relPath), 'utf-8');
}

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else out.push(full);
  }
  return out;
}

describe('PWA build artifacts (SPEC-PWA-001)', () => {
  let manifest;
  let indexHtml;
  let swText;

  beforeAll(() => {
    if (!existsSync(dist)) {
      throw new Error('dist/ not found — run `npm run build` before this suite (or use `npm run test:build`).');
    }
    manifest = JSON.parse(readDist('manifest.webmanifest'));
    indexHtml = readDist('index.html');
    swText = readDist('sw.js');
  });

  describe('AC-PWA-101: manifest fields', () => {
    it('has the Korean name/short_name, standalone display, and theme colors', () => {
      expect(manifest.name).toBe('태양계 탐험');
      expect(manifest.short_name).toBe('태양계');
      expect(manifest.display).toBe('standalone');
      expect(manifest.background_color).toBe('#0a0a0f');
      expect(manifest.theme_color).toBe('#0a0a0f');
    });

    it('resolves start_url and scope under the /solar-simulator/ base', () => {
      expect(manifest.start_url).toBe('/solar-simulator/');
      expect(manifest.scope).toBe('/solar-simulator/');
    });

    it('includes 192 and 512 icons plus maskable variants of both', () => {
      const find = (sizes, purpose) =>
        manifest.icons.find((icon) => icon.sizes === sizes && (purpose ? icon.purpose === purpose : !icon.purpose));
      expect(find('192x192')).toBeTruthy();
      expect(find('512x512')).toBeTruthy();
      expect(find('192x192', 'maskable')).toBeTruthy();
      expect(find('512x512', 'maskable')).toBeTruthy();
    });
  });

  describe('AC-PWA-102: iOS install meta + apple-touch-icon', () => {
    it('has apple-mobile-web-app-capable and a status-bar-style meta', () => {
      expect(indexHtml).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes"/);
      expect(indexHtml).toMatch(/<meta name="apple-mobile-web-app-status-bar-style" content="[^"]+"/);
    });

    it('links a 180x180 apple-touch-icon that resolves to an existing PNG under the base', () => {
      const match = indexHtml.match(/<link rel="apple-touch-icon" sizes="180x180" href="([^"]+)"/);
      expect(match).toBeTruthy();
      const href = match[1];
      expect(href.startsWith('/solar-simulator/')).toBe(true);
      const relPath = href.replace('/solar-simulator/', '');
      expect(existsSync(resolve(dist, relPath))).toBe(true);
    });
  });

  describe('AC-PWA-103: viewport-fit=cover (device half is UNVERIFIED, see tasks.md)', () => {
    it('sets viewport-fit=cover on the viewport meta', () => {
      expect(indexHtml).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*"/);
    });
  });

  describe('AC-PWA-104: precache manifest covers shell + textures + fonts', () => {
    it('precaches the app shell (index.html, manifest, bundled JS/CSS)', () => {
      expect(swText).toContain('url:"index.html"');
      expect(swText).toContain('url:"manifest.webmanifest"');
      expect(swText).toMatch(/url:"assets\/index-[^"]+\.js"/);
      expect(swText).toMatch(/url:"assets\/index-[^"]+\.css"/);
    });

    it('precaches every public/textures/ file', () => {
      const textureFiles = readdirSync(resolve(projectRoot, 'public/textures')).filter((f) =>
        /\.(jpg|jpeg|png)$/i.test(f)
      );
      expect(textureFiles.length).toBeGreaterThan(0);
      for (const file of textureFiles) {
        expect(swText).toContain(`url:"textures/${file}"`);
      }
    });

    it('precaches the generated icon set', () => {
      const iconFiles = [
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-192x192.png',
        'maskable-icon-512x512.png',
        'apple-touch-icon-180x180.png',
      ];
      for (const file of iconFiles) {
        expect(swText).toContain(`url:"icons/${file}"`);
      }
    });

    it('precaches self-hosted font woff2 files with build hashes', () => {
      expect(swText).toMatch(/url:"assets\/inter-[^"]+\.woff2"/);
      expect(swText).toMatch(/url:"assets\/jetbrains-mono-[^"]+\.woff2"/);
    });
  });

  describe('AC-PWA-105: fonts self-hosted, zero Google Fonts references', () => {
    it('has no fonts.googleapis.com or fonts.gstatic.com reference anywhere in dist/', () => {
      const files = collectFiles(dist);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const text = readFileSync(file, 'utf-8').toString();
        expect(text).not.toContain('fonts.googleapis.com');
        expect(text).not.toContain('fonts.gstatic.com');
      }
    });
  });

  describe('AC-PWA-106: all PWA URLs respect the /solar-simulator/ base', () => {
    it('index.html asset references (script/link/manifest) are absolute under the base', () => {
      const hrefs = [...indexHtml.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
      const relevant = hrefs.filter(
        (h) => h.includes('/assets/') || h.includes('manifest.webmanifest') || h.includes('registerSW.js') || h.includes('/icons/')
      );
      expect(relevant.length).toBeGreaterThan(0);
      for (const href of relevant) {
        expect(href.startsWith('/solar-simulator/')).toBe(true);
      }
    });

    it('manifest icon paths are relative (resolve under the base via the manifest URL)', () => {
      for (const icon of manifest.icons) {
        expect(icon.src.startsWith('/')).toBe(false);
        expect(icon.src.startsWith('http')).toBe(false);
      }
    });

    it('service worker precache entries are relative (resolve under the deployed base)', () => {
      const urls = [...swText.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
      expect(urls.length).toBeGreaterThan(10);
      for (const url of urls) {
        expect(url.startsWith('/')).toBe(false);
        expect(url.startsWith('http')).toBe(false);
      }
    });
  });

  describe('AC-PWA-108: live API never cached; old caches purged on activate', () => {
    it('routes the live aircraft API through NetworkOnly', () => {
      // Asserted as a single registerRoute() call, not two independent
      // substring hits: the API host matching SOME route and NetworkOnly
      // existing SOMEWHERE would both pass while the live endpoint was
      // actually bound to a caching handler — the exact failure REQ-PWA-108
      // forbids (a cached response would mask FlightDataService's OFFLINE state).
      expect(swText).toMatch(/registerRoute\([^)]*api\\?\.airplanes\\?\.live[^)]*NetworkOnly/);
    });

    it('purges outdated caches and claims clients on activate (autoUpdate)', () => {
      expect(swText).toContain('cleanupOutdatedCaches');
      expect(swText).toContain('skipWaiting');
      expect(swText).toContain('clientsClaim');
    });
  });
});
