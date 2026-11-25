import { ACTIONS, blockReason, cooldownLeft } from '../core/actions';
import { NEED_ALERT_THRESHOLD } from '../core/config';
import { getMood, getNeeds, MAX_NAME_LENGTH } from '../core/pet';
import type { ActionType, Pet, StatKey } from '../core/types';
import type { Absence, Game } from '../game';
import { careGrade, summarizeGraveyard } from '../memorial';
import type { GraveRecord } from '../storage/save';
import {
  absenceNoteText,
  ACTION_LABELS,
  BLOCK_REASONS,
  CARE_LABELS,
  CAUSE_LABELS,
  EVENT_MESSAGES,
  FORM_LABELS,
  formatDuration,
  MOOD_LABELS,
  STAGE_LABELS,
  STAT_LABELS,
  T,
  WAKE_LABEL,
} from '../strings';
import { LCD, PetCanvas } from './canvas';
import { ACTION_ICONS, iconImg, spriteDataUrl, STAT_ICONS } from './icons';
import { CUTSCENE_MS, stageSprite } from './scene';
import type { SpriteName } from './sprites';

const STAT_ORDER: readonly StatKey[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health'];
const MESSAGE_TTL_MS = 4000;
const LCD_TRANSPARENT = { ...LCD, bg: 'transparent', ghost: 'transparent' };

type Attrs = Record<string, string>;
type Screen = 'start' | 'game' | 'results' | 'memory';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

/** Картинка спрайта в цветах экрана — для стартового экрана, итогов и зала памяти. */
function lcdSprite(name: SpriteName, className: string, scale = 8): HTMLImageElement {
  const img = el('img', { class: className, alt: '' });
  img.src = spriteDataUrl(name, scale, LCD_TRANSPARENT);
  return img;
}

function stageText(pet: Pet): string {
  const stage = pet.stage === 'dead' ? (pet.stageAtDeath ?? 'egg') : pet.stage;
  const label = STAGE_LABELS[stage];
  return stage === 'adult' && pet.form ? `${label}, ${FORM_LABELS[pet.form]}` : label;
}

function careText(score: number): string {
  return `${Math.round(score)} из 100, ${CARE_LABELS[careGrade(score)]}`;
}

interface StatRow {
  bar: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
}

export class UI {
  private readonly startScreen: HTMLElement;
  private readonly gameScreen: HTMLElement;
  private readonly resultsScreen: HTMLElement;
  private readonly memoryScreen: HTMLElement;
  private readonly startNotice = el('p', { class: 'notice', hidden: '' });

  private readonly petName = el('h2', { class: 'pet-name' });
  private readonly petStage = el('p', { class: 'pet-meta' });
  private readonly canvas = el('canvas', { class: 'lcd-canvas', role: 'img' });
  private readonly petCanvas: PetCanvas;
  private readonly petMood = el('p', { class: 'pet-mood' });
  private readonly needs = el('div', { class: 'needs', 'aria-hidden': 'true' });
  private readonly statRows = new Map<StatKey, StatRow>();
  private readonly actionButtons = new Map<ActionType, HTMLButtonElement>();
  private readonly message = el('p', { class: 'message', role: 'status', 'aria-live': 'polite' });
  private readonly absenceBox = el('div', { class: 'absence', hidden: '' });

  private readonly resultsList = el('dl', { class: 'results' });
  private readonly resultsNote = el('p', { class: 'notice', hidden: '' });
  private readonly resultsInput: HTMLInputElement;

  private readonly memorySummary = el('p', { class: 'memory-summary' });
  private readonly memoryList = el('ol', { class: 'memory-list' });
  private readonly memoryButtons: HTMLButtonElement[] = [];

  private view: 'main' | 'memory' = 'main';
  private messageTimer = 0;
  private lastNeedsKey = '';
  private lastMemoryKey = '';
  private deathTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
  ) {
    const start = this.nameForm('start', T.newGame);
    this.startScreen = el('section', { class: 'screen screen-start' }, [
      el('h1', { text: T.title }),
      lcdSprite('egg', 'hero-sprite'),
      el('p', { class: 'intro', text: T.intro }),
      this.startNotice,
      start.form,
      this.memoryButton(),
    ]);

    this.gameScreen = this.buildGameScreen();
    this.petCanvas = new PetCanvas(this.canvas);

    const results = this.nameForm('results', T.newEgg);
    this.resultsInput = results.input;
    this.resultsScreen = el('section', { class: 'screen screen-results' }, [
      el('h1', { text: T.resultsTitle }),
      lcdSprite('grave', 'hero-sprite'),
      this.resultsNote,
      this.resultsList,
      results.form,
      this.memoryButton(),
    ]);

    this.memoryScreen = el('section', { class: 'screen screen-memory', 'aria-labelledby': 'memory-title' }, [
      el('div', { class: 'memory-head' }, [
        el('button', { type: 'button', class: 'link', 'data-close-memory': '', text: `← ${T.back}` }),
        el('h1', { id: 'memory-title', text: T.graveyard }),
      ]),
      el('p', { class: 'intro', text: T.memoryIntro }),
      this.memorySummary,
      this.memoryList,
      el('h2', { class: 'section-title', text: T.settings }),
      el('button', { type: 'button', class: 'danger', 'data-reset': '', text: T.reset }),
    ]);

    this.root.append(this.startScreen, this.gameScreen, this.resultsScreen, this.memoryScreen);
    this.bindEvents();
    this.petCanvas.start();
  }

  showCorruptedNotice(): void {
    this.startNotice.textContent = T.corrupted;
    this.startNotice.hidden = false;
  }

  showAbsence(absence: Absence): void {
    const pet = this.game.state.pet;
    if (!pet) return;
    if (pet.stage === 'dead') {
      this.resultsNote.textContent = T.diedWhileAway(pet.name);
      this.resultsNote.hidden = false;
      return;
    }
    const lines = absence.notes.map((n) => absenceNoteText(pet.name, n));
    this.absenceBox.replaceChildren(
      el('p', { class: 'absence-title', text: T.absenceTitle(formatDuration(absence.dtMs)) }),
      lines.length
        ? el('ul', {}, lines.map((l) => el('li', { text: l })))
        : el('p', { text: T.absenceNothing }),
      el('button', { type: 'button', class: 'link', 'data-dismiss': '', text: T.dismiss }),
    );
    this.absenceBox.hidden = false;
  }

  render(): void {
    const { pet } = this.game.state;
    // Сначала отдаём питомца экрану: он сам заметит смену стадии и запустит сценку.
    this.petCanvas.setPet(pet);
    // Как только сценка смерти закончится — сразу показать итоги, не дожидаясь тика.
    if (this.petCanvas.isPlaying('death') && !this.deathTimer) {
      this.deathTimer = window.setTimeout(() => {
        this.deathTimer = 0;
        this.render();
      }, CUTSCENE_MS.death + 50);
    }
    const screen = this.currentScreen(pet);
    this.startScreen.hidden = screen !== 'start';
    this.gameScreen.hidden = screen !== 'game';
    this.resultsScreen.hidden = screen !== 'results';
    this.memoryScreen.hidden = screen !== 'memory';

    if (pet && screen === 'game') this.renderGame(pet);
    if (pet && screen === 'results') this.renderResults(pet);
    if (screen === 'memory') this.renderMemory();
    const count = this.game.state.graveyard.length;
    for (const b of this.memoryButtons) {
      b.textContent = T.openMemory(count);
      b.hidden = count === 0 && b.dataset.optional === 'true';
    }
    document.title =
      pet && screen === 'game' && pet.stage !== 'dead' && getNeeds(pet).length > 0 ? `(!) ${T.title}` : T.title;
  }

  private currentScreen(pet: Pet | null): Screen {
    if (this.view === 'memory') return 'memory';
    if (!pet) return 'start';
    // Пока идёт сценка смерти, остаёмся на игровом экране.
    if (pet.stage === 'dead' && !this.petCanvas.isPlaying('death')) return 'results';
    return 'game';
  }

  // --- Построение ---

  private memoryButton(optional = true): HTMLButtonElement {
    const b = el('button', { type: 'button', class: 'link memory-link', 'data-open-memory': '' });
    b.dataset.optional = String(optional);
    this.memoryButtons.push(b);
    return b;
  }

  private nameForm(idSuffix: string, submitLabel: string): { form: HTMLFormElement; input: HTMLInputElement } {
    const id = `pet-name-${idSuffix}`;
    const input = el('input', {
      id,
      type: 'text',
      maxlength: String(MAX_NAME_LENGTH),
      placeholder: T.namePlaceholder,
      autocomplete: 'off',
    });
    const error = el('p', { class: 'error', role: 'alert' });
    const form = el('form', { class: 'name-form' }, [
      el('label', { for: id, text: T.nameLabel }),
      el('div', { class: 'row' }, [input, el('button', { type: 'submit', class: 'primary', text: submitLabel })]),
      error,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.game.newPet(input.value)) {
        input.value = '';
        error.textContent = '';
        this.absenceBox.hidden = true;
        this.resultsNote.hidden = true;
      } else {
        error.textContent = T.nameRequired;
        input.focus();
      }
    });
    return { form, input };
  }

  private buildGameScreen(): HTMLElement {
    const stats = el('div', { class: 'stats' });
    for (const key of STAT_ORDER) {
      const fill = el('div', { class: 'bar-fill' });
      const bar = el(
        'div',
        {
          class: 'bar',
          role: 'progressbar',
          'aria-label': STAT_LABELS[key],
          'aria-valuemin': '0',
          'aria-valuemax': '100',
        },
        [fill],
      );
      const value = el('span', { class: 'stat-value' });
      stats.append(
        el('div', { class: 'stat' }, [
          iconImg(STAT_ICONS[key]),
          el('span', { class: 'stat-label', text: STAT_LABELS[key] }),
          bar,
          value,
        ]),
      );
      this.statRows.set(key, { bar, fill, value });
    }

    const actions = el('div', { class: 'actions' });
    ACTIONS.forEach((action, i) => {
      const btn = el('button', { type: 'button', class: 'action', 'data-action': action }, [
        iconImg(ACTION_ICONS[action], 'icon action-icon'),
        el('span', { class: 'label' }),
        el('span', { class: 'hotkey', 'aria-hidden': 'true', text: String(i + 1) }),
      ]);
      actions.append(btn);
      this.actionButtons.set(action, btn);
    });

    const device = el('div', { class: 'device' }, [
      el('header', { class: 'device-header' }, [this.petName, this.petStage]),
      el('div', { class: 'lcd' }, [this.canvas, this.needs]),
      this.petMood,
    ]);

    const controls = el('div', { class: 'controls' }, [
      this.absenceBox,
      stats,
      actions,
      this.message,
      el('div', { class: 'controls-footer' }, [this.memoryButton(false)]),
    ]);

    return el('section', { class: 'screen screen-game' }, [device, controls]);
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');
      if (btn) {
        this.game.act(btn.dataset.action as ActionType);
        return;
      }
      if (target.closest('[data-dismiss]')) this.absenceBox.hidden = true;
      if (target.closest('[data-open-memory]')) this.setView('memory');
      if (target.closest('[data-close-memory]')) this.setView('main');
      if (target.closest('[data-reset]') && window.confirm(T.resetConfirm)) {
        this.game.resetAll();
        this.absenceBox.hidden = true;
        this.resultsNote.hidden = true;
        this.setView('main');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.view === 'memory') {
        this.setView('main');
        return;
      }
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (this.gameScreen.hidden) return;
      const action = ACTIONS[Number(e.key) - 1];
      if (action) {
        e.preventDefault();
        this.game.act(action);
      }
    });

    const bus = this.game.bus;
    bus.on('changed', () => this.render());
    bus.on('actionDone', (e) => this.petCanvas.play(e.action));
    bus.on('actionBlocked', (e) => {
      if (e.reason !== 'cooldown' && e.reason !== 'dead') this.say(BLOCK_REASONS[e.reason]);
    });
    bus.on('saveFailed', () => this.say(T.saveFailed));
    bus.on('hatched', () => this.say(EVENT_MESSAGES.hatched(this.name())));
    bus.on('stageChanged', (e) => {
      if (e.stage !== 'baby' && e.stage !== 'egg') this.say(EVENT_MESSAGES.grew(this.name(), e.stage));
    });
    bus.on('gotSick', () => this.say(EVENT_MESSAGES.gotSick(this.name())));
    bus.on('recovered', () => this.say(EVENT_MESSAGES.recovered(this.name())));
    bus.on('fellAsleep', (e) => e.auto && this.say(EVENT_MESSAGES.fellAsleepAuto(this.name())));
    bus.on('wokeUp', (e) => e.auto && this.say(EVENT_MESSAGES.wokeUpAuto(this.name())));
  }

  private setView(view: 'main' | 'memory'): void {
    this.view = view;
    this.render();
    const focusTarget =
      view === 'memory'
        ? this.memoryScreen.querySelector<HTMLElement>('[data-close-memory]')
        : this.root.querySelector<HTMLElement>('.screen:not([hidden]) [data-open-memory]');
    focusTarget?.focus();
    window.scrollTo({ top: 0 });
  }

  // --- Отрисовка ---

  private renderGame(pet: Pet): void {
    const now = this.game.currentTime();
    this.petName.textContent = pet.name;
    this.petStage.textContent = `${stageText(pet)} · ${formatDuration(pet.ageMs)}`;

    const mood = pet.stage === 'egg' ? STAGE_LABELS.egg : MOOD_LABELS[getMood(pet)];
    this.petMood.textContent = mood;
    this.canvas.setAttribute('aria-label', `${pet.name}: ${mood}`);

    const needs = pet.stage === 'dead' ? [] : getNeeds(pet);
    const needsKey = needs.join(',');
    if (needsKey !== this.lastNeedsKey) {
      this.lastNeedsKey = needsKey;
      this.needs.replaceChildren(...needs.map((k) => iconImg(STAT_ICONS[k], 'icon need')));
    }

    for (const key of STAT_ORDER) {
      const row = this.statRows.get(key);
      if (!row) continue;
      const value = Math.round(pet.stats[key]);
      row.fill.style.width = `${value}%`;
      row.fill.dataset.level = value > 60 ? 'ok' : value >= NEED_ALERT_THRESHOLD ? 'warn' : 'low';
      row.bar.setAttribute('aria-valuenow', String(value));
      row.value.textContent = String(value);
    }

    const { cooldowns } = this.game.state;
    for (const [action, btn] of this.actionButtons) {
      const reason = blockReason(pet, action, cooldowns, now);
      const label = action === 'sleep' && pet.isSleeping ? WAKE_LABEL : ACTION_LABELS[action];
      const left = cooldownLeft(cooldowns, action, now);
      const labelEl = btn.querySelector('.label');
      if (labelEl) labelEl.textContent = left > 0 ? `${label} · ${Math.ceil(left / 1000)}` : label;
      btn.setAttribute('aria-label', label);
      btn.disabled = reason !== null;
      btn.title = reason ? BLOCK_REASONS[reason] : '';
    }
  }

  private renderResults(pet: Pet): void {
    const rows: Array<[string, string]> = [
      [T.name, pet.name],
      [T.age, formatDuration(pet.ageMs)],
      [T.stage, stageText(pet)],
      [T.cause, CAUSE_LABELS[pet.causeOfDeath ?? 'neglect']],
      [T.care, careText(pet.careScore)],
      [T.sicknesses, String(pet.care.sicknessCount)],
    ];
    this.resultsList.replaceChildren(
      ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]),
    );
    if (document.activeElement === document.body) this.resultsInput.focus({ preventScroll: true });
  }

  private renderMemory(): void {
    const { graveyard } = this.game.state;
    const key = JSON.stringify(graveyard);
    if (key === this.lastMemoryKey) return;
    this.lastMemoryKey = key;

    const summary = summarizeGraveyard(graveyard);
    this.memorySummary.textContent = summary.longest
      ? `${T.memoryCount(summary.count)}. ${T.memoryRecord(summary.longest.name, formatDuration(summary.longest.ageMs))}.`
      : T.memoryEmpty;
    this.memoryList.replaceChildren(...graveyard.map((g) => this.memoryCard(g, g === summary.longest)));
  }

  private memoryCard(g: GraveRecord, isRecord: boolean): HTMLElement {
    const stage = g.stage === 'adult' && g.form ? `${STAGE_LABELS.adult}, ${FORM_LABELS[g.form]}` : STAGE_LABELS[g.stage];
    const details = [`${T.cause}: ${CAUSE_LABELS[g.causeOfDeath]}`];
    if (g.careScore !== undefined) details.push(`${T.care.toLowerCase()}: ${careText(g.careScore)}`);
    if (g.sicknessCount !== undefined) details.push(`${T.sicknesses.toLowerCase()}: ${g.sicknessCount}`);
    return el('li', { class: isRecord ? 'memory-card record' : 'memory-card' }, [
      lcdSprite(stageSprite(g.stage, g.form), 'memory-sprite', 4),
      el('div', { class: 'memory-text' }, [
        el('p', { class: 'memory-name' }, [
          g.name,
          ...(isRecord ? [el('span', { class: 'badge', text: '★' })] : []),
        ]),
        el('p', { text: `${stage} · ${T.lived} ${formatDuration(g.ageMs)}` }),
        el('p', { class: 'memory-details', text: details.join(' · ') }),
        el('p', { class: 'memory-date', text: T.diedOn(new Date(g.diedAt).toLocaleDateString('ru-RU')) }),
      ]),
    ]);
  }

  private name(): string {
    return this.game.state.pet?.name ?? '';
  }

  private say(text: string): void {
    this.message.textContent = text;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.textContent = '';
    }, MESSAGE_TTL_MS);
  }
}
