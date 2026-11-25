import { Game } from './game';
import { mountDebugPanel } from './render/debug';
import { UI } from './render/ui';
import type { KeyValueStorage } from './storage/save';

/** localStorage может быть недоступен (приватный режим, запрет cookies) — тогда играем без сохранения. */
function pickStorage(): KeyValueStorage {
  try {
    const probe = '__tamagotchi_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('Не найден элемент #app');

const game = new Game({ storage: pickStorage() });
const ui = new UI(root, game);
const info = game.start();

if (info.status === 'corrupted') ui.showCorruptedNotice();
if (info.absence) ui.showAbsence(info.absence);
if (new URLSearchParams(window.location.search).get('debug') === '1') mountDebugPanel(root, game);

ui.render();
game.run(window);
