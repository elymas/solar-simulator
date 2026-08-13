// Every line the app can ever speak, derived from the app's own modules.
//
// DERIVED, NEVER HAND-LISTED. A hand-written list is a second copy of the script
// the child hears, and the two drift the first time a fact is reworded — leaving
// a phrase with no audio (silently falling back) or an orphan file nobody plays.
// Everything below is produced by calling the real code, so adding a body, a
// mission or a travel fact changes this set automatically.
//
// The unit is the FINAL utterance, not the source string: speakBody() speaks
// `${name}. ${fact}`, so that is what gets synthesized and hashed.

import { createHash } from 'node:crypto';
import { PLANET_DATA, MOON_DATA, STAR_DATA, BELT_DATA } from '../src/planets/planetData.js';
import { STR } from '../src/ui/strings.js';
import { ISS_FACTS } from '../src/earth/ISSMarker.js';
import { SHOWER_TABLE } from '../src/utils/meteorData.js';
import { TRAVEL_FACTS_KO, eligibleDestinations } from '../src/play/travelFacts.js';
import { tripSpeechKo } from '../src/play/RocketTrip.js';
import { comparisonRows } from '../src/play/SizeCompare.js';
import { MISSION_CATALOG } from '../src/play/missions.js';

/** Stable id for one utterance. Rewording a line changes its id, by design. */
export function phraseId(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/** Every selectable body, keyed as the app keys them. */
function allBodies() {
  const out = [];
  for (const [key, data] of Object.entries(PLANET_DATA)) out.push([key, data]);
  for (const moons of Object.values(MOON_DATA)) for (const m of moons) out.push([m.key, m]);
  for (const [key, data] of Object.entries(STAR_DATA)) out.push([key, data]);
  for (const [key, data] of Object.entries(BELT_DATA)) out.push([key, data]);
  return out;
}

/**
 * Collect every utterance the app can produce.
 * @returns {Array<{text: string, id: string, source: string}>} unique, sorted by source
 */
export function collectPhrases() {
  const seen = new Map();
  const add = (text, source) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (!seen.has(clean)) seen.set(clean, { text: clean, id: phraseId(clean), source });
  };

  // speakBody(): the name, then one rotating fact — exactly as tts.js composes it.
  for (const [, data] of allBodies()) {
    const name = data.nameKo || data.name;
    if (!name) continue;
    const facts = Array.isArray(data.factsKo) ? data.factsKo.filter(Boolean) : [];
    if (facts.length === 0) add(name, 'body-name');
    for (const fact of facts) add(`${name}. ${fact}`, 'body-fact');
  }

  // The ISS is not in planetData but is spoken through the same shape.
  add(ISS_FACTS.factsKo[0], 'iss');

  // Meteor showers: one notice per shower in the table.
  for (const shower of SHOWER_TABLE) add(STR.earthMeteorNotice(shower.koreanName), 'meteor');

  // Rocket arrivals.
  for (const fact of Object.values(TRAVEL_FACTS_KO)) add(fact, 'travel');

  // What the rocket overlay actually says: the duration fact AND the distance,
  // as one utterance. tts.speak cancels whatever is talking, so the overlay
  // cannot say them separately — and the bare fact above would therefore never
  // be the string it looks up. Missing these is what silently drops the trip
  // narration back to the device voice.
  for (const key of eligibleDestinations()) add(tripSpeechKo(key), 'travel');

  // Size comparison: the spoken row is the FIRST row for each body that has one.
  for (const [key, data] of allBodies()) {
    const [row] = comparisonRows(key, data);
    if (row) add(row.factKo, 'size-compare');
  }

  // Fixed callouts.
  add(STR.eventAlignment, 'event');
  add(STR.playPraise, 'praise');
  add(STR.playDayComplete, 'praise');

  // Mission prompts are displayed, not spoken today, but the sticker book reads
  // them aloud on some paths; cheap to include and harmless if unused.
  for (const mission of MISSION_CATALOG) add(mission.promptKo, 'mission');

  return [...seen.values()].sort((a, b) => a.source.localeCompare(b.source) || a.text.localeCompare(b.text));
}
