// Sticker book + mission HUD (SPEC-PLAY-001 REQ-PLAY-401/403).
//
// One surface, not two. The book is opened by a toggle rather than popped up on
// completion (plan.md §B) — an auto-popup fights the celebration moment — and
// the day's missions ride inside it, because a second always-on overlay would
// cost a phone its sky for information the child only wants between attempts.
// The toggle carries a done/total badge so the button still says "there is
// something in here".
//
// Nothing is cached: every render re-asks the engine and the store. That is what
// makes a midnight rollover a non-event here (the view hands us a NEW engine for
// the new date and the next refresh simply reads it) and what keeps the earned
// state honest right after an award.

import { MISSION_CATALOG } from './missions.js';
import { STR } from '../ui/strings.js';

// @MX:ANCHOR: [AUTO] The only presentation of sticker inventory and daily mission
// state. Award (mission engine), persistence (stickers.js) and the child's view
// of both meet here.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-403 / AC-PLAY-403
// @MX:REASON: [AUTO] SolarSystemView refreshes it after every completion and hides
// it on view exit, and the toggle is a third caller. A second renderer of the same
// state would drift from the store the moment an award happened off its path.
export class StickerBook {
  /**
   * @param {Object} opts
   * @param {() => {today: Function, isDayComplete: Function}} opts.getEngine
   *   Re-read per render, never held: the engine is per-calendar-day.
   * @param {{hasSticker: Function}} opts.store
   * @param {Array} [opts.catalog] - The sticker universe (one per mission).
   * @param {Document} [opts.doc]
   */
  constructor({ getEngine, store, catalog = MISSION_CATALOG, doc = document } = {}) {
    this.getEngine = getEngine;
    this.store = store;
    this.catalog = catalog;
    this.doc = doc;
    this._open = false;

    injectStyles(doc);
    this._build();
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    doc.addEventListener('keydown', this._onKeyDown);
    this.refresh();
  }

  get isOpen() {
    return this._open;
  }

  open() {
    this.refresh();
    this._open = true;
    this.el.hidden = false;
  }

  close() {
    this._open = false;
    this.el.hidden = true;
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  /** Re-render missions, grid and badge from the current engine + store. */
  refresh() {
    const engine = this.getEngine?.();
    const missions = engine ? engine.today() : [];

    this._missionList.replaceChildren(
      ...missions.map((mission) => {
        const li = this.doc.createElement('li');
        li.className = `sticker-mission${mission.done ? ' sticker-mission--done' : ''}`;
        li.textContent = `${mission.emoji} ${mission.promptKo}`;
        return li;
      })
    );
    this._dayComplete.hidden = !(engine && engine.isDayComplete());

    this._grid.replaceChildren(
      ...this.catalog.map((mission) => {
        const earned = Boolean(this.store?.hasSticker(mission.sticker));
        const tile = this.doc.createElement('span');
        tile.className = `sticker-tile${earned ? '' : ' sticker-tile--locked'}`;
        tile.dataset.sticker = mission.sticker;
        tile.setAttribute('role', 'img');
        // A locked tile still shows WHICH sticker it is: that is the hint the
        // mission list repeats, not a spoiler.
        tile.setAttribute(
          'aria-label',
          earned ? mission.promptKo : STR.playStickerLocked(mission.promptKo)
        );
        tile.textContent = mission.emoji;
        return tile;
      })
    );

    const done = missions.filter((mission) => mission.done).length;
    this._badge.textContent = `${done}/${missions.length}`;
  }

  /** Follow the rest of the solar chrome on a view switch. */
  setVisible(visible) {
    const display = visible ? '' : 'none';
    this.toggleBtn.style.display = display;
    if (!visible) this.close();
  }

  dispose() {
    this.doc.removeEventListener('keydown', this._onKeyDown);
    this.el.remove();
    this.toggleBtn.remove();
  }

  _build() {
    const doc = this.doc;

    this.toggleBtn = doc.createElement('button');
    this.toggleBtn.className = 'sticker-toggle';
    this.toggleBtn.setAttribute('aria-label', STR.playStickerBookOpen);
    this.toggleBtn.innerHTML =
      '<span class="sticker-toggle-icon" aria-hidden="true">&#127942;</span>' +
      '<span class="sticker-badge"></span>';
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this._badge = this.toggleBtn.querySelector('.sticker-badge');

    this.el = doc.createElement('div');
    this.el.className = 'sticker-book';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', STR.playStickerBookTitle);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    const panel = doc.createElement('div');
    panel.className = 'sticker-book-panel';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const close = doc.createElement('button');
    close.className = 'sticker-book-close';
    close.textContent = '×';
    close.setAttribute('aria-label', STR.playClose);
    close.addEventListener('click', () => this.close());

    this._missionList = doc.createElement('ul');
    this._missionList.className = 'sticker-missions';

    this._dayComplete = doc.createElement('p');
    this._dayComplete.className = 'sticker-day-complete';
    this._dayComplete.textContent = STR.playDayComplete;
    this._dayComplete.hidden = true;

    this._grid = doc.createElement('div');
    this._grid.className = 'sticker-grid';

    panel.append(
      close,
      heading(doc, 'h3', 'sticker-section-title', STR.playMissionsTitle),
      this._missionList,
      this._dayComplete,
      heading(doc, 'h3', 'sticker-section-title', STR.playStickerBookTitle),
      this._grid
    );
    this.el.appendChild(panel);

    doc.body.append(this.toggleBtn, this.el);
  }
}

function heading(doc, tag, className, text) {
  const el = doc.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

let stylesInjected = false;

function injectStyles(doc) {
  if (stylesInjected && doc === document) return;
  stylesInjected = true;
  const style = doc.createElement('style');
  style.textContent = `
    .sticker-toggle {
      position: fixed;
      /* Beside the planet-list toggle (44px + 10px gutter), inheriting the same
         safe-area insets (REQ-PWA-103). */
      top: calc(16px + env(safe-area-inset-top, 0px));
      left: calc(70px + env(safe-area-inset-left, 0px));
      background: rgba(26, 26, 46, 0.85);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(22, 199, 255, 0.15);
      border-radius: 8px;
      color: #16c7ff;
      /* Kid-sized hit area, Apple HIG 44pt floor (SPEC-MOBILE-001 REQ-MOB-105). */
      width: 44px;
      height: 44px;
      font-size: 18px;
      cursor: pointer;
      z-index: 101;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .sticker-badge {
      font-size: 10px;
      font-family: 'JetBrains Mono Variable', monospace;
      color: #b0b0b0;
      margin-top: 1px;
    }
    .sticker-book {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(6, 8, 20, 0.88);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      font-family: 'Inter Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      color: #e0e0e0;
      padding: 16px;
      overflow-y: auto;
    }
    .sticker-book[hidden] {
      display: none;
    }
    .sticker-book-panel {
      position: relative;
      width: 100%;
      max-width: 340px;
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(22, 199, 255, 0.2);
      border-radius: 16px;
      padding: 56px 24px 24px;
    }
    .sticker-book-close {
      position: absolute;
      top: 8px;
      right: 8px;
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      color: #888;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .sticker-section-title {
      font-size: 17px;
      color: #16c7ff;
      margin: 0 0 12px 0;
    }
    .sticker-missions {
      list-style: none;
      padding: 0;
      margin: 0 0 16px 0;
    }
    .sticker-mission {
      font-size: 19px;
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .sticker-mission--done {
      color: #16c7ff;
      text-decoration: line-through;
    }
    .sticker-day-complete {
      font-size: 22px;
      font-weight: 700;
      color: #ffd166;
      margin: 0 0 20px 0;
    }
    .sticker-day-complete[hidden] {
      display: none;
    }
    .sticker-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .sticker-tile {
      font-size: 30px;
      line-height: 1.4;
      text-align: center;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.06);
      opacity: 1;
    }
    /* Locked stickers keep their shape and lose their colour — a silhouette the
       child can still recognise, which is what makes the grid a wish list. */
    .sticker-tile--locked {
      opacity: 0.3;
      filter: grayscale(1);
    }
  `;
  doc.head.appendChild(style);
}
