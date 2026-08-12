#!/usr/bin/env node
// Bake every spoken line to an audio file (SPEC-KIDS-001 K2, upgraded voice).
//
// WHY BUILD TIME. This app is a static site on GitHub Pages with no backend, so
// a runtime TTS call would ship KIE_API_KEY to the browser where anyone can read
// it out of the bundle. Baking also means the voice works offline (the files ride
// the PWA precache), starts instantly, and costs money once rather than per tap.
// It is only possible because every line is enumerable — see tts-phrases.mjs.
//
// INCREMENTAL. A phrase's id is a hash of its final text, so re-running this
// after rewording one fact regenerates exactly that one file. Nothing is charged
// twice, and --prune removes files whose phrase no longer exists.
//
// Usage:
//   node scripts/build-tts.mjs            # generate what is missing
//   node scripts/build-tts.mjs --dry-run  # report only, spend nothing
//   node scripts/build-tts.mjs --prune    # also delete orphaned files
//   node scripts/build-tts.mjs --limit=5  # generate at most N (smoke test)

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { collectPhrases } from './tts-phrases.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'tts');
const MANIFEST = join(OUT_DIR, 'manifest.json');

const API = 'https://api.kie.ai/api/v1/jobs';
const MODEL = 'google/gemini-3-1-flash-tts';

// Voice choice. Kore reads Korean warmly at a child's pace; the profile is what
// actually steers tone, since the accent list this model exposes is English-only
// and 'Neutral' is the one that does not colour Korean. Changing any of these
// changes how every line sounds, so treat it as a single global decision.
const VOICE = {
  speaker_id: 'Speaker 1',
  voice_name: 'Kore',
  accent: 'Neutral',
  audio_profile: 'A warm, friendly Korean narrator speaking gently to a five-year-old child',
  style: 'Empathetic',
  pace: 'Natural',
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000;
// The run is almost entirely spent waiting on the API, so a handful of phrases
// are kept in flight at once. Deliberately modest: the service publishes no rate
// limit, and a 185-phrase build is not worth discovering one the hard way.
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

function apiKey() {
  const envPath = join(ROOT, '.env');
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY;
  if (!existsSync(envPath)) throw new Error('KIE_API_KEY not set and no .env file found');
  const line = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('KIE_API_KEY='));
  if (!line) throw new Error('KIE_API_KEY missing from .env');
  return line.slice('KIE_API_KEY='.length).trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createTask(key, text) {
  const res = await fetch(`${API}/createTask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: {
        temperature: 1,
        speakers: [VOICE],
        dialogue_turns: [{ speaker_id: VOICE.speaker_id, text }],
      },
    }),
  });
  const body = await res.json();
  const taskId = body?.data?.taskId;
  if (!taskId) throw new Error(`createTask failed: ${JSON.stringify(body).slice(0, 200)}`);
  return taskId;
}

async function awaitAudioUrl(key, taskId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    // resultJson arrives as an ESCAPED JSON string inside the envelope, so the
    // URL is pulled out directly rather than double-parsing a shape the docs do
    // not pin down.
    if (/"state"\s*:\s*"fail"/.test(text)) throw new Error(`task failed: ${text.slice(0, 200)}`);
    const match = text.match(/https:\/\/[^"\\ ]+\.(?:wav|mp3|m4a|ogg)/);
    if (match) return match[0];
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`timed out after ${POLL_TIMEOUT_MS}ms`);
}

/**
 * The API returns 24 kHz mono WAV (~48 KB/s); the full set would be over 30 MB,
 * which cannot ride the PWA precache next to 8 MB of textures. 48 kbps mono mp3
 * is ~6 KB/s, brings the set to roughly 6 MB, and is indistinguishable from 64k
 * on speech at this sample rate — while being a format every target browser
 * plays without a flag.
 */
function toMp3(wavBuffer, outPath) {
  const tmp = `${outPath}.wav`;
  writeFileSync(tmp, wavBuffer);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-b:a', '48k', outPath]);
  } finally {
    unlinkSync(tmp);
  }
}

async function main() {
  const phrases = collectPhrases();
  mkdirSync(OUT_DIR, { recursive: true });

  const missing = phrases.filter((p) => !existsSync(join(OUT_DIR, `${p.id}.mp3`)));
  console.log(`phrases: ${phrases.length}  present: ${phrases.length - missing.length}  missing: ${missing.length}`);

  if (PRUNE) {
    const live = new Set(phrases.map((p) => `${p.id}.mp3`));
    const orphans = readdirSync(OUT_DIR).filter((f) => f.endsWith('.mp3') && !live.has(f));
    for (const f of orphans) {
      if (!DRY_RUN) unlinkSync(join(OUT_DIR, f));
      console.log(`prune ${f}`);
    }
  }

  const todo = missing.slice(0, LIMIT);
  if (DRY_RUN) {
    for (const p of todo) console.log(`would generate ${p.id}  [${p.source}]  ${p.text}`);
  } else if (todo.length) {
    const key = apiKey();
    const queue = [...todo];
    let done = 0;
    let failed = 0;
    const worker = async () => {
      while (queue.length) {
        const phrase = queue.shift();
        const out = join(OUT_DIR, `${phrase.id}.mp3`);
        try {
          const taskId = await createTask(key, phrase.text);
          const url = await awaitAudioUrl(key, taskId);
          const audio = Buffer.from(await (await fetch(url)).arrayBuffer());
          toMp3(audio, out);
          done += 1;
          console.log(`[${done + failed}/${todo.length}] ${phrase.id}  ${phrase.text}`);
        } catch (error) {
          // One bad line must not cost the whole run: the phrase simply has no
          // file and the app falls back to the device voice for it.
          failed += 1;
          console.error(`FAILED ${phrase.id}  ${phrase.text}\n  ${error.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    if (failed) console.error(`${failed} phrase(s) failed; re-run to retry just those`);
  }

  // The manifest lists only phrases that actually HAVE a file, so the runtime
  // never waits on a 404 for a line that failed to generate.
  const entries = {};
  for (const p of phrases) {
    if (existsSync(join(OUT_DIR, `${p.id}.mp3`))) entries[p.id] = p.text;
  }
  if (!DRY_RUN) writeFileSync(MANIFEST, `${JSON.stringify({ version: 1, entries }, null, 0)}\n`);
  console.log(`manifest: ${Object.keys(entries).length}/${phrases.length} phrases have audio`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
