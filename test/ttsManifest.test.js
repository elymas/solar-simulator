import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectPhrases, phraseId } from '../scripts/tts-phrases.mjs';

const TTS_DIR = join(process.cwd(), 'public', 'tts');
const MANIFEST = join(TTS_DIR, 'manifest.json');

// The recorded narration and the app's script are two artifacts that must agree.
// They can only drift in two ways, and both are caught here: a line that gained
// audio it no longer matches (orphan), and a line the app can speak that was
// never recorded (gap). A gap is not a failure — the app falls back to the device
// voice — so it is REPORTED rather than asserted, while an orphan or a
// manifest/file mismatch IS a failure, because those mean the two sides disagree
// about what was baked.
describe('pre-recorded narration manifest', () => {
  const phrases = collectPhrases();

  it('derives a stable id from the final utterance', () => {
    // The build hashes the sentence the child hears, so rewording a fact must
    // produce a new id (and therefore a new recording) rather than silently
    // keeping the old audio.
    const a = phraseId('태양. 태양은 스스로 빛나는 별이에요.');
    expect(phraseId('태양. 태양은 스스로 빛나는 별이에요.')).toBe(a);
    expect(phraseId('태양. 태양은 스스로 빛나는 별이에요!')).not.toBe(a);
  });

  it('collects every spoken line without duplicates', () => {
    const ids = phrases.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(phrases.length).toBeGreaterThan(100);
  });

  it.runIf(existsSync(MANIFEST))('lists only ids the app can actually speak', () => {
    const { entries } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const live = new Set(phrases.map((p) => p.id));
    const orphans = Object.keys(entries).filter((id) => !live.has(id));
    expect(orphans, `orphaned recordings: run \`npm run tts -- --prune\``).toEqual([]);
  });

  it.runIf(existsSync(MANIFEST))('has a file on disk for every id it lists', () => {
    const { entries } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const missing = Object.keys(entries).filter((id) => !existsSync(join(TTS_DIR, `${id}.mp3`)));
    expect(missing).toEqual([]);
  });

  it.runIf(existsSync(MANIFEST))('carries the exact text for each id, so lookup cannot mis-map', () => {
    const { entries } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    for (const [id, text] of Object.entries(entries)) {
      expect(phraseId(text), `manifest text for ${id} does not hash to it`).toBe(id);
    }
  });

  it.runIf(existsSync(MANIFEST))('reports how much of the script is recorded', () => {
    const { entries } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const recorded = Object.keys(entries).length;
    const gaps = phrases.filter((p) => !entries[p.id]);
    // Informational: an unrecorded line still speaks, in the device voice.
    if (gaps.length) {
      console.warn(`${gaps.length} line(s) have no recording and will use the device voice:`);
      for (const g of gaps.slice(0, 5)) console.warn(`  [${g.source}] ${g.text}`);
    }
    expect(recorded).toBeGreaterThan(0);
  });
});
