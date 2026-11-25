import { ACTIONS, blockReason, cooldownLeft } from '../core/actions';
import { NEED_ALERT_THRESHOLD } from '../core/config';
import { getMood, getNeeds, MAX_NAME_LENGTH } from '../core/pet';
import type { ActionType, Pet, StatKey } from '../core/types';
import type { Absence, Game } from '../game';
import {
  absenceNoteText,
  ACTION_LABELS,
  BLOCK_REASONS,
  CAUSE_LABELS,
  EVENT_MESSAGES,
  FORM_LABELS,
  formatDuration,
  MOOD_LABELS,
  NEED_ICONS,
  STAGE_LABELS,
  STAT_LABELS,
  T,
  WAKE_LABEL,
} from '../strings';

// Простой интерфейс этапа 1: HTML-кнопки и текст. Графика появится на этапе 2.

const STAT_ORDER: readonly StatKey[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health'];
const MESSAGE_TTL_MS = 4000;

type Attrs = Record<string, string>;

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

export function petGlyph(pet: Pet): string {
  switch (pet.stage) {
    case 'egg':
      return '🥚';
    case 'baby':
      return '🐣';
    case 'child':
      return '🐥';
    case 'teen':
      return '🐤';
    case 'adult':
      return pet.form === 'naughty' ? '🦃' : pet.form === 'good' ? '🐓' : '🐔';
    case 'elder':
      return '🦉';
    case 'dead':
      return '🪦';
  }
}

function stageText(pet: Pet): string {
  const stage = pet.stage === 'dead' ? (pet.stageAtDeath ?? 'egg') : pet.stage;
  const label = STAGE_LABELS[stage];
  return stage === 'adult' && pet.form ? `${label}, ${FORM_LABELS[pet.form]}` : label;
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

  private readonly startNotice: HTMLElement;

  private readonly petName = el('h2', { class: 'pet-name' });
  private readonly petStage = el('p', { class: 'pet-meta' });
  private readonly petGlyphEl = el('div', { class: 'pet-glyph', 'aria-hidden': 'true' });
  private readonly petMood = el('p', { class: 'pet-mood' });
  private readonly needs = el('div', { class: 'needs', 'aria-hidden': 'true' });
  private readonly statRows = new Map<StatKey, StatRow>();
  private readonly actionButtons = new Map<ActionType, HTMLButtonElement>();
  private readonly message = el('p', { class: 'message', role: 'status', 'aria-live': 'polite' });
  private readonly absenceBox = el('div', { class: 'absence', hidden: '' });
  private readonly graveyardList = el('ol', { class: 'graveyard' });

  private readonly resultsList = el('dl', { class: 'results' });
  private readonly resultsGlyph = el('div', { class: 'pet-glyph', 'aria-hidden': 'true' });
  private readonly resultsInput: HTMLInputElement;

  private messageTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
  ) {
    const start = this.nameForm('start', T.newGame);
    this.startNotice = el('p', { class: 'notice', hidden: '' });
    this.startScreen = el('section', { class: 'screen screen-start' }, [
      el('h1', { text: T.title }),
      el('div', { class: 'pet-glyph', 'aria-hidden': 'true', text: '🥚' }),
      el('p', { text: T.intro }),
      this.startNotice,
      start.form,
    ]);

    this.gameScreen = this.buildGameScreen();

    const results = this.nameForm('results', T.newEgg);
    this.resultsInput = results.input;
    this.resultsScreen = el('section', { class: 'screen screen-results' }, [
      el('h1', { text: T.resultsTitle }),
      this.resultsGlyph,
      this.resultsList,
      results.form,
    ]);

    this.root.append(this.startScreen, this.gameScreen, this.resultsScreen);
    this.bindEvents();
  }

  showCorruptedNotice(): void {
    this.startNotice.textContent = T.corrupted;
    this.startNotice.hidden = false;
  }

  showAbsence(absence: Absence): void {
    const pet = this.game.state.pet;
    if (!pet || pet.stage === 'dead') return;
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
    const screen = !pet ? 'start' : pet.stage === 'dead' ? 'results' : 'game';
    this.startScreen.hidden = screen !== 'start';
    this.gameScreen.hidden = screen !== 'game';
    this.resultsScreen.hidden = screen !== 'results';
    if (pet && screen === 'game') this.renderGame(pet);
    if (pet && screen === 'results') this.renderResults(pet);
    this.renderGraveyard();
    document.title = pet && getNeeds(pet).length > 0 && screen === 'game' ? `(!) ${T.title}` : T.title;
  }

  // --- Построение ---

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
      el('div', { class: 'row' }, [input, el('button', { type: 'submit', text: submitLabel })]),
      error,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.game.newPet(input.value)) {
        input.value = '';
        error.textContent = '';
        this.absenceBox.hidden = true;
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
      stats.append(el('div', { class: 'stat' }, [el('span', { text: STAT_LABELS[key] }), bar, value]));
      this.statRows.set(key, { bar, fill, value });
    }

    const actions = el('div', { class: 'actions' });
    ACTIONS.forEach((action, i) => {
      const btn = el('button', { type: 'button', 'data-action': action });
      btn.append(el('span', { class: 'hotkey', 'aria-hidden': 'true', text: String(i + 1) }));
      btn.append(el('span', { class: 'label' }));
      actions.append(btn);
      this.actionButtons.set(action, btn);
    });

    const settings = el('details', { class: 'settings' }, [
      el('summary', { text: `${T.graveyard} и ${T.settings.toLowerCase()}` }),
      el('h3', { text: T.graveyard }),
      this.graveyardList,
      el('button', { type: 'button', class: 'danger', 'data-reset': '', text: T.reset }),
    ]);

    return el('section', { class: 'screen screen-game' }, [
      el('header', {}, [this.petName, this.petStage]),
      this.absenceBox,
      el('div', { class: 'pet' }, [this.needs, this.petGlyphEl, this.petMood]),
      stats,
      actions,
      this.message,
      settings,
    ]);
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
      if (target.closest('[data-reset]') && window.confirm(T.resetConfirm)) {
        this.game.resetAll();
        this.absenceBox.hidden = true;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (this.gameScreen.hidden) return;
      const index = Number(e.key) - 1;
      const action = ACTIONS[index];
      if (action) {
        e.preventDefault();
        this.game.act(action);
      }
    });

    const bus = this.game.bus;
    bus.on('changed', () => this.render());
    bus.on('actionBlocked', (e) => {
      if (e.reason !== 'cooldown') this.say(BLOCK_REASONS[e.reason]);
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

  // --- Отрисовка ---

  private renderGame(pet: Pet): void {
    const now = this.game.currentTime();
    this.petName.textContent = pet.name;
    this.petStage.textContent = `${T.stage}: ${stageText(pet)} · ${T.age}: ${formatDuration(pet.ageMs)}`;

    const mood = getMood(pet);
    this.petGlyphEl.textContent = petGlyph(pet) + (pet.isSleeping ? '💤' : pet.isSick ? '🤒' : '');
    this.petMood.textContent = pet.stage === 'egg' ? STAGE_LABELS.egg : MOOD_LABELS[mood];
    this.needs.textContent = getNeeds(pet).map((k) => NEED_ICONS[k]).join(' ');

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
      const label =
        action === 'sleep' && pet.isSleeping ? WAKE_LABEL : ACTION_LABELS[action];
      const left = cooldownLeft(cooldowns, action, now);
      const labelEl = btn.querySelector('.label');
      if (labelEl) labelEl.textContent = left > 0 ? `${label} · ${Math.ceil(left / 1000)}` : label;
      btn.setAttribute('aria-label', label);
      btn.disabled = reason !== null;
      btn.title = reason ? BLOCK_REASONS[reason] : '';
    }
  }

  private renderResults(pet: Pet): void {
    this.resultsGlyph.textContent = petGlyph(pet);
    const rows: Array<[string, string]> = [
      [T.name, pet.name],
      [T.age, formatDuration(pet.ageMs)],
      [T.stage, stageText(pet)],
      [T.cause, CAUSE_LABELS[pet.causeOfDeath ?? 'neglect']],
    ];
    this.resultsList.replaceChildren(
      ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]),
    );
    if (document.activeElement === document.body) this.resultsInput.focus({ preventScroll: true });
  }

  private renderGraveyard(): void {
    const { graveyard } = this.game.state;
    if (graveyard.length === 0) {
      this.graveyardList.replaceChildren(el('li', { class: 'empty', text: T.graveyardEmpty }));
      return;
    }
    this.graveyardList.replaceChildren(
      ...graveyard.map((g) =>
        el('li', {
          text: `${g.name} — ${STAGE_LABELS[g.stage]}, ${formatDuration(g.ageMs)}, ${CAUSE_LABELS[g.causeOfDeath]}`,
        }),
      ),
    );
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
