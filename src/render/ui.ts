import { ACTIONS, blockReason, cooldownLeft } from '../core/actions';
import { ACTION_COOLDOWN_MS, NEED_ALERT_THRESHOLD, POOP_HEALTH_THRESHOLD, POOP_SICK_THRESHOLD } from '../core/config';
import { levelStats } from '../core/stats';
import { SLIDE_SIZE } from '../core/slide';
import { getLanguage, LANGUAGES, isLanguage, locale, setLanguage } from '../i18n';
import { getMood, getNeeds, MAX_NAME_LENGTH } from '../core/pet';
import type { AttentionReason } from '../core/forecast';
import { SPECIES, type ActionType, type Pet, type Species, type StatKey } from '../core/types';
import type { SoundName } from '../audio/tunes';
import type { Absence, Game } from '../game';
import type { Notifier } from '../notify/notifier';
import { careGrade, summarizeGraveyard } from '../memorial';
import type { GraveRecord } from '../storage/save';
import {
  absenceNoteText,
  ACTION_LABELS,
  ATTENTION_SHORT,
  BLOCK_REASONS,
  CARE_LABELS,
  CAUSE_LABELS,
  EVENT_MESSAGES,
  FORM_LABELS,
  GAMES_TEXT,
  formatDuration,
  DEV_TEXT,
  MOOD_LABELS,
  POOP_TEXT,
  SETTINGS_TEXT,
  SPECIES_LABELS,
  STAGE_LABELS,
  STAT_LABELS,
  T,
  wakeLabel,
} from '../strings';
import { LCD, PetCanvas } from './canvas';
import { ACTION_ICONS, iconImg, NEED_ICONS, spriteDataUrl, STAT_ICONS } from './icons';
import { CUTSCENE_MS, POOP_SLOTS, stageSprite } from './scene';
import { GamesOverlay } from './minigames';
import { ART } from './artData';
import { SPECIES_LOOKS } from './species';
import { createDevPanel } from './debug';
import type { SpriteName } from './sprites';
import { APP_VERSION } from '../version';

const STAT_ORDER: readonly StatKey[] = ['hunger', 'happiness', 'energy', 'health'];
const MESSAGE_TTL_MS = 4000;
const VERSION_TAPS_TO_UNLOCK = 7;
const LCD_TRANSPARENT = { ...LCD, bg: 'transparent', ghost: 'transparent' };

type Attrs = Record<string, string>;
type Screen = 'start' | 'game' | 'results' | 'memory' | 'settings';
type View = 'main' | 'memory' | 'settings';

export interface LastReminder {
  at: number;
  reason: AttentionReason;
}

export interface UiServices {
  notifier: Notifier;
  /** Когда и о чём было запланировано последнее напоминание. */
  lastReminder?: () => LastReminder | null;
  /** Короткий звук-подтверждение (после включения звука). */
  onSoundEnabled?: () => void;
  /** Звуки мини-игр. */
  playSound?: (name: SoundName) => void;
}

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

/** После смены языка страница перезагружается и открывает настройки. */
const REOPEN_KEY = 'tamagotchi.reopen';

export class UI {
  private readonly startScreen: HTMLElement;
  private readonly gameScreen: HTMLElement;
  private readonly resultsScreen: HTMLElement;
  private readonly memoryScreen: HTMLElement;
  private readonly settingsScreen: HTMLElement;
  private readonly soundSwitch: HTMLInputElement;
  private readonly notifySwitch: HTMLInputElement;
  private readonly notifyStatus = el('p', { class: 'setting-status', role: 'status' });
  private readonly reminderInfo = el('p', { class: 'setting-status' });
  private readonly testStatus = el('p', { class: 'setting-status', role: 'status' });
  private readonly testButton = el('button', { type: 'button', class: 'chunky test-button', 'data-test-notify': '' });
  private readonly startNotice = el('p', { class: 'notice', hidden: '' });

  private readonly petName = el('h2', { class: 'pet-name' });
  private readonly petStage = el('p', { class: 'pet-meta' });
  private readonly speedBadge = el('button', { type: 'button', class: 'speed-badge', 'data-reset-speed': '', hidden: '' });
  private readonly versionLine = el('p', { class: 'version' });
  private readonly devStatus = el('p', { class: 'setting-status dev-status', role: 'status' });
  private devPanel: HTMLElement | null = null;
  private versionTaps: number[] = [];
  private readonly canvas = el('canvas', { class: 'lcd-canvas', role: 'img' });
  private readonly petCanvas: PetCanvas;
  private readonly petMood = el('p', { class: 'pet-mood' });
  private readonly needs = el('div', { class: 'needs', 'aria-hidden': 'true' });
  private readonly poopIcons = el('span', { class: 'poop-icons', role: 'img' });
  private readonly poopValue = el('span', { class: 'stat-value' });
  private lastPoops = -1;
  private readonly treatCount = el('span', { class: 'treat-count', 'aria-hidden': 'true' });
  private overlay: GamesOverlay | null = null;
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

  private readonly languageSelect = el(
    'select',
    { id: 'setting-language', class: 'language-select' },
    LANGUAGES.map((l) => el('option', { value: l.code, text: l.name })),
  );

  private view: View = 'main';
  private memoryReturn: View = 'main';
  private messageTimer = 0;
  private lastNeedsKey = '';
  private lastMemoryKey = '';
  private deathTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly services: UiServices,
  ) {
    const start = this.nameForm('start', T.newGame);
    this.startScreen = el('section', { class: 'screen screen-start' }, [
      el('h1', { text: T.title }),
      lcdSprite('egg', 'hero-sprite'),
      el('p', { class: 'intro', text: T.intro }),
      this.startNotice,
      start.form,
      el('div', { class: 'start-links' }, [
        this.memoryButton(),
        this.settingsButton(),
      ]),
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
        el('button', { type: 'button', class: 'chunky small back', 'data-close-memory': '', 'aria-label': T.back, text: '←' }),
        el('h1', { id: 'memory-title', text: T.graveyard }),
      ]),
      el('p', { class: 'intro', text: T.memoryIntro }),
      this.memorySummary,
      this.memoryList,
    ]);

    this.soundSwitch = el('input', { type: 'checkbox', role: 'switch', id: 'setting-sound' });
    this.notifySwitch = el('input', { type: 'checkbox', role: 'switch', id: 'setting-notify' });
    this.settingsScreen = el('section', { class: 'screen screen-settings', 'aria-labelledby': 'settings-title' }, [
      el('div', { class: 'memory-head' }, [
        el('button', { type: 'button', class: 'chunky small back', 'data-close-view': '', 'aria-label': T.back, text: '←' }),
        el('h1', { id: 'settings-title', text: SETTINGS_TEXT.title }),
      ]),
      this.settingRow(this.soundSwitch, SETTINGS_TEXT.sound, SETTINGS_TEXT.soundHint),
      this.settingRow(this.notifySwitch, SETTINGS_TEXT.notifications, SETTINGS_TEXT.notificationsHint, [
        this.notifyStatus,
        this.reminderInfo,
        this.testButton,
        this.testStatus,
      ]),
      el('div', { class: 'setting' }, [
        el('label', { class: 'setting-label', for: 'setting-language' }, [
          el('span', { class: 'setting-title', text: SETTINGS_TEXT.language }),
          el('span', { class: 'setting-hint', text: SETTINGS_TEXT.languageHint }),
        ]),
        this.languageSelect,
      ]),
      el('h2', { class: 'section-title', text: SETTINGS_TEXT.data }),
      el('div', { class: 'settings-buttons' }, [
        this.memoryButton(false),
        el('button', { type: 'button', class: 'chunky danger', 'data-reset': '', text: T.reset }),
      ]),
      this.versionLine,
      this.devStatus,
    ]);
    this.versionLine.textContent = SETTINGS_TEXT.version(APP_VERSION);
    if (readDevFlag()) this.enableDevMode(false);

    this.root.append(this.startScreen, this.gameScreen, this.resultsScreen, this.memoryScreen, this.settingsScreen);
    this.bindEvents();
    this.petCanvas.start();
    try {
      if (window.sessionStorage.getItem(REOPEN_KEY) === 'settings') this.view = 'settings';
      window.sessionStorage.removeItem(REOPEN_KEY);
    } catch {
      // нет sessionStorage — остаёмся на главном экране
    }
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
      el('button', { type: 'button', class: 'chunky small', 'data-dismiss': '', text: T.dismiss }),
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
    this.settingsScreen.hidden = screen !== 'settings';
    if (screen === 'settings') void this.renderSettings();

    if (pet && screen === 'game') this.renderGame(pet);
    if (pet && screen === 'results') this.renderResults(pet);
    if (screen === 'memory') this.renderMemory();
    const count = this.game.state.graveyard.length;
    for (const b of this.memoryButtons) {
      const label = b.querySelector('.btn-label');
      if (label) label.textContent = T.openMemory(count);
      b.hidden = count === 0 && b.dataset.optional === 'true';
    }
    document.title =
      pet && screen === 'game' && pet.stage !== 'dead' && getNeeds(pet).length > 0 ? `(!) ${T.title}` : T.title;
  }

  private currentScreen(pet: Pet | null): Screen {
    if (this.view !== 'main') return this.view;
    if (!pet) return 'start';
    // Пока идёт сценка смерти, остаёмся на игровом экране.
    if (pet.stage === 'dead' && !this.petCanvas.isPlaying('death')) return 'results';
    return 'game';
  }

  // --- Построение ---

  private memoryButton(optional = true): HTMLButtonElement {
    const b = el('button', { type: 'button', class: 'chunky pill memory-link', 'data-open-memory': '' }, [
      iconImg('memorial', 'icon pill-icon'),
      el('span', { class: 'btn-label' }),
    ]);
    b.dataset.optional = String(optional);
    this.memoryButtons.push(b);
    return b;
  }

  private settingsButton(): HTMLButtonElement {
    return el('button', { type: 'button', class: 'chunky pill', 'data-open-settings': '' }, [
      iconImg('settings', 'icon pill-icon'),
      el('span', { class: 'btn-label', text: SETTINGS_TEXT.title }),
    ]);
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
    const picker = this.speciesPicker(idSuffix);
    const form = el('form', { class: 'name-form' }, [
      picker,
      el('label', { for: id, text: T.nameLabel }),
      el('div', { class: 'row' }, [input, el('button', { type: 'submit', class: 'chunky primary', text: submitLabel })]),
      error,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const chosen = picker.querySelector<HTMLInputElement>('input:checked')?.value as Species | undefined;
      if (this.game.newPet(input.value, chosen ?? 'cat')) {
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

  /** Карточки выбора животного: превью, подпись, радиокнопка. */
  private speciesPicker(idSuffix: string): HTMLElement {
    const options = SPECIES.map((species, i) => {
      const id = `species-${idSuffix}-${species}`;
      const radio = el('input', { type: 'radio', name: `species-${idSuffix}`, value: species, id });
      if (i === 0) radio.checked = true;
      return el('label', { class: 'species-option', for: id }, [
        radio,
        el('span', { class: 'species-card' }, [
          lcdSprite(SPECIES_LOOKS[species].preview, 'species-sprite', 4),
          el('span', { class: 'species-name', text: SPECIES_LABELS[species] }),
        ]),
      ]);
    });
    return el('fieldset', { class: 'species-picker' }, [el('legend', { text: T.chooseSpecies }), ...options]);
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
        el('div', { class: 'stat', 'data-stat': key }, [
          el('span', { class: 'stat-icon', 'aria-hidden': 'true' }, [iconImg(STAT_ICONS[key])]),
          el('span', { class: 'stat-label', text: STAT_LABELS[key] }),
          bar,
          value,
        ]),
      );
      this.statRows.set(key, { bar, fill, value });
    }
    stats.append(
      el('div', { class: 'stat stat-poop', 'data-stat': 'poop' }, [
        el('span', { class: 'stat-icon', 'aria-hidden': 'true' }, [iconImg('poop')]),
        el('span', { class: 'stat-label', text: POOP_TEXT.label }),
        this.poopIcons,
        this.poopValue,
      ]),
    );

    const actions = el('div', { class: 'actions' });
    ACTIONS.forEach((action, i) => {
      const btn = el('button', { type: 'button', class: 'chunky action', 'data-action': action }, [
        el('span', { class: 'icon-badge' }, [iconImg(ACTION_ICONS[action], 'icon action-icon')]),
        el('span', { class: 'label' }),
        el('span', { class: 'hotkey', 'aria-hidden': 'true', text: String(i + 1) }),
        ...(action === 'snack' ? [this.treatCount] : []),
      ]);
      actions.append(btn);
      this.actionButtons.set(action, btn);
    });

    const device = el('div', { class: 'device' }, [
      el('header', { class: 'device-header' }, [this.petName, this.petStage]),
      this.speedBadge,
      el('div', { class: 'lcd-area' }, [el('div', { class: 'lcd' }, [this.canvas, this.needs])]),
      this.petMood,
    ]);

    const controls = el('div', { class: 'controls' }, [
      this.absenceBox,
      stats,
      actions,
      this.message,
      el('div', { class: 'controls-footer' }, [
        this.memoryButton(false),
        this.settingsButton(),
      ]),
    ]);

    return el('section', { class: 'screen screen-game' }, [device, controls]);
  }

  private bindEvents(): void {
    this.soundSwitch.addEventListener('change', () => {
      this.game.setSettings({ sound: this.soundSwitch.checked });
      if (this.soundSwitch.checked) this.services.onSoundEnabled?.();
    });
    this.languageSelect.addEventListener('change', () => {
      const lang = this.languageSelect.value;
      if (!isLanguage(lang) || lang === getLanguage()) return;
      this.game.setSettings({ language: lang });
      this.game.save();
      setLanguage(lang);
      // Все подписи собраны при запуске — проще всего перезапустить экран на новом языке.
      try {
        window.sessionStorage.setItem(REOPEN_KEY, 'settings');
      } catch {
        // не страшно: просто вернёмся на главный экран
      }
      window.location.reload();
    });
    this.notifySwitch.addEventListener('change', () => void this.toggleNotifications(this.notifySwitch.checked));
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');
      if (btn) {
        this.doAction(btn.dataset.action as ActionType);
        return;
      }
      if (target.closest('[data-dismiss]')) this.absenceBox.hidden = true;
      if (target.closest('[data-open-memory]')) {
        this.memoryReturn = this.view === 'settings' ? 'settings' : 'main';
        this.setView('memory');
      }
      if (target.closest('[data-open-settings]')) this.setView('settings');
      if (target.closest('[data-test-notify]')) void this.testNotification();
      if (target.closest('[data-reset-speed]')) this.game.setTimeScale(1);
      if (target === this.versionLine) this.countVersionTap();
      if (target.closest('[data-close-memory]')) this.setView(this.memoryReturn);
      if (target.closest('[data-close-view]')) this.setView('main');
      if (target.closest('[data-reset]') && window.confirm(T.resetConfirm)) {
        this.game.resetAll();
        this.absenceBox.hidden = true;
        this.resultsNote.hidden = true;
        this.setView('main');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.handleBack()) return;
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (this.gameScreen.hidden) return;
      const action = ACTIONS[Number(e.key) - 1];
      if (action && !this.overlay) {
        e.preventDefault();
        this.doAction(action);
      }
    });

    const bus = this.game.bus;
    bus.on('changed', () => this.render());
    bus.on('actionDone', (e) => {
      this.petCanvas.play(e.action);
      this.startCooldown(e.action);
    });
    bus.on('actionBlocked', (e) => {
      if (e.reason !== 'cooldown' && e.reason !== 'dead') this.say(BLOCK_REASONS[e.reason]);
    });
    bus.on('saveFailed', () => this.say(T.saveFailed));
    bus.on('hatched', () => this.say(EVENT_MESSAGES.hatched(this.name())));
    bus.on('stageChanged', (e) => {
      if (e.stage !== 'baby' && e.stage !== 'egg') this.say(EVENT_MESSAGES.grew(this.name(), e.stage));
    });
    bus.on('gotSick', () => this.say(EVENT_MESSAGES.gotSick(this.name())));
    bus.on('pooped', () => this.say(POOP_TEXT.pooped(this.name())));
    bus.on('treatsEarned', (e) => this.say(GAMES_TEXT.earned(e.amount)));
    bus.on('recovered', () => this.say(EVENT_MESSAGES.recovered(this.name())));
    bus.on('fellAsleep', (e) => e.auto && this.say(EVENT_MESSAGES.fellAsleepAuto(this.name())));
    bus.on('wokeUp', (e) => e.auto && this.say(EVENT_MESSAGES.wokeUpAuto(this.name())));
  }

  /** «Поиграть» открывает окно мини-игр, остальные действия выполняются сразу. */
  private doAction(action: ActionType): void {
    if (action !== 'play') {
      this.game.act(action);
      return;
    }
    const reason = this.game.playBlockReason();
    const pet = this.game.state.pet;
    if (reason || !pet) {
      if (reason && reason !== 'cooldown') this.say(BLOCK_REASONS[reason]);
      this.services.playSound?.('blocked');
      return;
    }
    this.overlay = new GamesOverlay(
      {
        petName: pet.name,
        petImage: ART[`face_${pet.species}`],
        playSound: (name) => this.services.playSound?.(name),
        stats: (size) => levelStats(this.game.state.gameStats, 'queens', size),
        onFinish: (won, reward, size) => this.game.finishMiniGame(won, reward, { game: 'queens', key: size }),
        slideStats: () => levelStats(this.game.state.gameStats, 'slide', SLIDE_SIZE),
        earnTreats: (n) => this.game.awardTreats(n),
        finishSlide: (lines, treats) =>
          this.game.finishMiniGame(treats > 0, 0, { game: 'slide', key: SLIDE_SIZE, score: lines }),
        treatImage: ART.snack,
      },
      () => {
        this.overlay = null;
        this.root.querySelector<HTMLElement>('[data-action=play]')?.focus();
      },
    );
  }

  /** Системная «Назад» или Esc: закрыть вложенный экран. false — мы уже на главном. */
  handleBack(): boolean {
    if (this.overlay) {
      this.overlay.back();
      return true;
    }
    if (this.view === 'main') return false;
    this.setView(this.view === 'memory' ? this.memoryReturn : 'main');
    return true;
  }

  /** Скрытый режим тестирования: 7 быстрых касаний по строке версии. */
  private countVersionTap(): void {
    if (this.devPanel) return;
    const now = Date.now();
    this.versionTaps = [...this.versionTaps.filter((t) => now - t < 3000), now];
    const left = VERSION_TAPS_TO_UNLOCK - this.versionTaps.length;
    if (left <= 0) {
      this.versionTaps = [];
      this.enableDevMode(true);
    } else if (this.versionTaps.length >= 3) {
      this.devStatus.textContent = DEV_TEXT.tapsLeft(left);
    }
  }

  enableDevMode(announce: boolean): void {
    if (this.devPanel) return;
    writeDevFlag(true);
    this.devPanel = createDevPanel(this.game, () => this.disableDevMode());
    this.versionLine.before(this.devPanel);
    this.devStatus.textContent = announce ? DEV_TEXT.enabled : '';
  }

  private disableDevMode(): void {
    writeDevFlag(false);
    this.devPanel?.remove();
    this.devPanel = null;
    this.devStatus.textContent = '';
  }

  /** Откат действия: заливка сползает с кнопки за время кулдауна. */
  private startCooldown(action: ActionType): void {
    const btn = this.actionButtons.get(action);
    if (!btn) return;
    btn.style.setProperty('--cd-ms', `${ACTION_COOLDOWN_MS[action]}ms`);
    btn.classList.remove('cooling');
    void btn.offsetWidth; // перезапуск CSS-анимации
    btn.classList.add('cooling');
  }

  private setView(view: View): void {
    this.view = view;
    this.render();
    const focusTarget =
      view === 'memory'
        ? this.memoryScreen.querySelector<HTMLElement>('[data-close-memory]')
        : view === 'settings'
          ? this.settingsScreen.querySelector<HTMLElement>('[data-close-view]')
          : this.root.querySelector<HTMLElement>('.screen:not([hidden]) [data-open-memory]');
    focusTarget?.focus();
    window.scrollTo({ top: 0 });
  }

  private settingRow(input: HTMLInputElement, title: string, hint: string, extra: HTMLElement[] = []): HTMLElement {
    return el('div', { class: 'setting' }, [
      el('label', { class: 'setting-label', for: input.id }, [
        el('span', { class: 'setting-title', text: title }),
        el('span', { class: 'setting-hint', text: hint }),
      ]),
      el('span', { class: 'switch' }, [input, el('span', { class: 'switch-track', 'aria-hidden': 'true' })]),
      ...extra,
    ]);
  }

  private async toggleNotifications(on: boolean): Promise<void> {
    if (!on) {
      this.game.setSettings({ notifications: false });
      await this.services.notifier.cancel();
      return;
    }
    const granted = await this.services.notifier.request();
    this.game.setSettings({ notifications: granted });
    if (!granted) this.notifySwitch.checked = false;
    await this.renderSettings(true);
  }

  private async testNotification(): Promise<void> {
    this.testButton.disabled = true;
    const ok = await this.services.notifier.test();
    this.testStatus.textContent = ok ? SETTINGS_TEXT.testSent : SETTINGS_TEXT.testFailed;
    window.setTimeout(() => {
      this.testStatus.textContent = '';
    }, 15000);
    window.setTimeout(() => {
      this.testButton.disabled = false;
    }, 5000);
  }

  private async renderSettings(afterRequest = false): Promise<void> {
    const { settings } = this.game.state;
    this.testButton.textContent = SETTINGS_TEXT.testButton;
    const last = this.services.lastReminder?.() ?? null;
    this.reminderInfo.textContent = last
      ? SETTINGS_TEXT.lastReminder(
          new Date(last.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }),
          ATTENTION_SHORT[last.reason],
        )
      : '';
    this.soundSwitch.checked = settings.sound;
    this.languageSelect.value = settings.language;
    this.notifySwitch.checked = settings.notifications;
    const { notifier } = this.services;
    const permission = await notifier.permission();
    this.notifySwitch.disabled = permission === 'unsupported';
    this.testButton.hidden = permission === 'unsupported';
    this.notifyStatus.textContent =
      permission === 'unsupported'
        ? SETTINGS_TEXT.notificationsUnsupported
        : permission === 'denied' && (afterRequest || settings.notifications)
          ? SETTINGS_TEXT.notificationsDenied
          : notifier.kind === 'web' && settings.notifications
            ? SETTINGS_TEXT.notificationsWeb
            : '';
  }

  // --- Отрисовка ---

  private renderGame(pet: Pet): void {
    const now = this.game.currentTime();
    this.petName.textContent = pet.name;
    this.petStage.textContent = `${stageText(pet)} · ${formatDuration(pet.ageMs)}`;

    const scale = this.game.timeScale;
    this.speedBadge.hidden = scale === 1;
    this.speedBadge.textContent = DEV_TEXT.badge(scale);
    this.speedBadge.setAttribute('aria-label', DEV_TEXT.badgeLabel(scale));

    const mood = pet.stage === 'egg' ? STAGE_LABELS.egg : MOOD_LABELS[getMood(pet)];
    this.petMood.textContent = mood;
    this.canvas.setAttribute('aria-label', `${pet.name}: ${mood}`);

    const needs = pet.stage === 'dead' ? [] : getNeeds(pet);
    const needsKey = needs.join(',');
    if (needsKey !== this.lastNeedsKey) {
      this.lastNeedsKey = needsKey;
      this.needs.replaceChildren(...needs.map((k) => iconImg(NEED_ICONS[k], 'icon need')));
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

    if (pet.poops !== this.lastPoops) {
      this.lastPoops = pet.poops;
      const shown = Math.min(pet.poops, POOP_SLOTS.length);
      this.poopIcons.replaceChildren(
        ...(shown === 0
          ? [el('span', { class: 'poop-clean', text: POOP_TEXT.clean })]
          : Array.from({ length: shown }, () => iconImg('poop', 'icon poop-icon'))),
      );
      this.poopIcons.setAttribute('aria-label', pet.poops === 0 ? POOP_TEXT.clean : POOP_TEXT.count(pet.poops));
      this.poopValue.textContent = String(pet.poops);
      const level = pet.poops > POOP_HEALTH_THRESHOLD ? 'low' : pet.poops >= POOP_SICK_THRESHOLD ? 'warn' : 'ok';
      this.poopIcons.parentElement?.setAttribute('data-level', level);
    }

    this.treatCount.textContent = String(pet.treats);
    this.treatCount.dataset.empty = String(pet.treats === 0);

    const { cooldowns } = this.game.state;
    for (const [action, btn] of this.actionButtons) {
      const reason = blockReason(pet, action, cooldowns, now);
      const label = action === 'sleep' && pet.isSleeping ? wakeLabel() : ACTION_LABELS[action];
      const left = cooldownLeft(cooldowns, action, now);
      const labelEl = btn.querySelector('.label');
      if (labelEl) labelEl.textContent = label;
      btn.dataset.reason = reason ?? '';
      if (left === 0) btn.classList.remove('cooling');
      btn.setAttribute('aria-label', label);
      // Без лакомств кнопка остаётся нажимаемой — чтобы подсказать, где их взять.
      btn.disabled = reason !== null && reason !== 'noTreats';
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
      lcdSprite(stageSprite(g.stage, g.form, g.species ?? 'blob'), 'memory-sprite', 4),
      el('div', { class: 'memory-text' }, [
        el('p', { class: 'memory-name' }, [
          g.name,
          ...(isRecord ? [el('span', { class: 'badge', text: '★' })] : []),
        ]),
        el('p', { text: `${stage} · ${T.lived} ${formatDuration(g.ageMs)}` }),
        el('p', { class: 'memory-details', text: details.join(' · ') }),
        el('p', { class: 'memory-date', text: T.diedOn(new Date(g.diedAt).toLocaleDateString(locale())) }),
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

const DEV_FLAG_KEY = 'tamagotchi.dev';

function readDevFlag(): boolean {
  try {
    return localStorage.getItem(DEV_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDevFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEV_FLAG_KEY, '1');
    else localStorage.removeItem(DEV_FLAG_KEY);
  } catch {
    // не страшно: режим просто не запомнится
  }
}
