// Округлый шрифт Nunito (с кириллицей) вшивается в приложение при сборке.
import '@fontsource-variable/nunito';
import { Sound } from './audio/sound';
import { hasNewNeed, soundForAction, soundForEvent } from './audio/tunes';
import { getNeeds } from './core/pet';
import type { Need } from './core/types';
import { Game } from './game';
import { createNotifier, setupNativeShell } from './platform';
import { UI, type LastReminder } from './render/ui';
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

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('Не найден элемент #app');

  const game = new Game({ storage: pickStorage() });
  const sound = new Sound();
  const notifier = await createNotifier();
  const REMINDER_KEY = 'tamagotchi.reminder';
  const readReminder = (): LastReminder | null => {
    try {
      const v = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? 'null');
      return v && typeof v.at === 'number' && typeof v.reason === 'string' ? (v as LastReminder) : null;
    } catch {
      return null;
    }
  };
  const ui = new UI(root, game, {
    notifier,
    onSoundEnabled: () => sound.play('toggle'),
    playSound: (name) => sound.play(name),
    lastReminder: readReminder,
  });
  const info = game.start();

  // --- Звук ---
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  let lastNeeds: Need[] = [];
  game.bus.onAny((e) => {
    sound.setEnabled(game.state.settings.sound);
    const pet = game.state.pet;
    if (e.type === 'actionDone') sound.play(soundForAction(e.action, pet?.isSleeping ?? false));
    else if (e.type === 'actionBlocked') {
      if (e.reason !== 'cooldown') sound.play('blocked');
    } else if (e.type === 'changed') {
      const needs = pet && pet.stage !== 'dead' ? getNeeds(pet) : [];
      if (hasNewNeed(lastNeeds, needs)) sound.play('alert');
      lastNeeds = needs;
    } else if (e.type === 'treatsEarned') {
      sound.play('win');
    } else if (e.type !== 'saveFailed') {
      const name = soundForEvent(e);
      if (name) sound.play(name);
    }
  });

  // --- Напоминания: ставим, когда игра уходит в фон, снимаем при возвращении ---
  const goAway = () => {
    const pet = game.state.pet;
    if (!game.state.settings.notifications || !pet || pet.stage === 'dead') return;
    void notifier.scheduleAway(pet, game.timeScale).then((attention) => {
      if (!attention) return;
      try {
        localStorage.setItem(REMINDER_KEY, JSON.stringify({ at: Date.now() + attention.inMs, reason: attention.reason }));
      } catch {
        // не страшно: это только подсказка в настройках
      }
    });
  };
  const comeBack = () => void notifier.cancel();
  document.addEventListener('visibilitychange', () => (document.hidden ? goAway() : comeBack()));
  await setupNativeShell({
    onBack: () => ui.handleBack(),
    onPause: () => {
      game.update();
      game.save();
      goAway();
    },
    onResume: () => {
      comeBack();
      game.update();
    },
  });

  if (info.status === 'corrupted') ui.showCorruptedNotice();
  if (info.absence) ui.showAbsence(info.absence);
  if (new URLSearchParams(window.location.search).get('debug') === '1') ui.enableDevMode(false);

  sound.setEnabled(game.state.settings.sound);
  ui.render();
  game.run(window);
}

void main();
