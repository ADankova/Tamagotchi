import type { StatKey } from '../core/types';
import type { Game } from '../game';
import { DEV_TEXT, STAT_LABELS } from '../strings';

export const SPEEDS = [1, 10, 100, 1000] as const;
const STATS: readonly StatKey[] = ['hunger', 'happiness', 'energy', 'health'];

/**
 * Раздел «Режим тестирования» для экрана настроек: ускорение времени и ползунки показателей.
 * onHide — скрыть раздел (скорость при этом возвращается к ×1).
 */
export function createDevPanel(game: Game, onHide: () => void): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'dev-panel';

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = DEV_TEXT.title;
  const hint = document.createElement('p');
  hint.className = 'setting-hint';
  hint.textContent = DEV_TEXT.hint;
  panel.append(title, hint);

  const speedLabel = document.createElement('p');
  speedLabel.className = 'dev-label';
  speedLabel.textContent = DEV_TEXT.speed;
  const speedRow = document.createElement('div');
  speedRow.className = 'dev-speeds';
  const speedButtons = SPEEDS.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chunky small';
    b.textContent = `×${s}`;
    b.addEventListener('click', () => game.setTimeScale(s));
    speedRow.append(b);
    return [s, b] as const;
  });
  panel.append(speedLabel, speedRow);

  const statsLabel = document.createElement('p');
  statsLabel.className = 'dev-label';
  statsLabel.textContent = DEV_TEXT.stats;
  panel.append(statsLabel);
  const inputs = new Map<StatKey, HTMLInputElement>();
  for (const key of STATS) {
    const label = document.createElement('label');
    label.className = 'dev-stat';
    const name = document.createElement('span');
    name.textContent = STAT_LABELS[key];
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.addEventListener('change', () => game.setStat(key, Number(input.value)));
    label.append(name, input);
    panel.append(label);
    inputs.set(key, input);
  }

  const poopRow = document.createElement('div');
  poopRow.className = 'dev-speeds';
  const addPoop = document.createElement('button');
  addPoop.type = 'button';
  addPoop.className = 'chunky small';
  addPoop.textContent = DEV_TEXT.addPoop;
  addPoop.addEventListener('click', () => game.addPoop());
  poopRow.append(addPoop);
  panel.append(poopRow);

  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'chunky small dev-hide';
  hide.textContent = DEV_TEXT.hide;
  hide.addEventListener('click', () => {
    game.setTimeScale(1);
    onHide();
  });
  panel.append(hide);

  const sync = () => {
    for (const [s, b] of speedButtons) {
      b.setAttribute('aria-pressed', String(game.timeScale === s));
    }
    const pet = game.state.pet;
    for (const [key, input] of inputs) {
      input.disabled = !pet || pet.stage === 'dead';
      if (document.activeElement !== input && pet) input.value = String(Math.round(pet.stats[key]));
    }
  };
  game.bus.on('changed', sync);
  sync();
  return panel;
}
