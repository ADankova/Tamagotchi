import type { StatKey } from '../core/types';
import type { Game } from '../game';
import { STAT_LABELS, T } from '../strings';

const SPEEDS = [1, 10, 100, 1000] as const;
const STATS: readonly StatKey[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health'];

/** Панель отладки: включается параметром ?debug=1 в адресе. */
export function mountDebugPanel(root: HTMLElement, game: Game): void {
  const panel = document.createElement('details');
  panel.className = 'debug';
  panel.open = true;
  const summary = document.createElement('summary');
  summary.textContent = T.debug;
  panel.append(summary);

  const speedRow = document.createElement('div');
  speedRow.className = 'row';
  const speedLabel = document.createElement('span');
  speedLabel.textContent = `${T.speed}:`;
  speedRow.append(speedLabel);
  const speedButtons = SPEEDS.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `×${s}`;
    b.addEventListener('click', () => game.setTimeScale(s));
    speedRow.append(b);
    return [s, b] as const;
  });
  panel.append(speedRow);

  const inputs = new Map<StatKey, HTMLInputElement>();
  for (const key of STATS) {
    const label = document.createElement('label');
    label.className = 'debug-stat';
    label.textContent = STAT_LABELS[key];
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.addEventListener('change', () => game.setStat(key, Number(input.value)));
    label.append(input);
    panel.append(label);
    inputs.set(key, input);
  }

  root.append(panel);

  const sync = () => {
    for (const [s, b] of speedButtons) b.setAttribute('aria-pressed', String(game.timeScale === s));
    const pet = game.state.pet;
    for (const [key, input] of inputs) {
      if (document.activeElement !== input && pet) input.value = String(Math.round(pet.stats[key]));
    }
  };
  game.bus.on('changed', sync);
  sync();
}
