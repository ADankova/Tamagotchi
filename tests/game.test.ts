import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE } from '../src/core/config';
import type { GameEvent } from '../src/core/types';
import { Game, type BusEvent } from '../src/game';
import { fakeClock, memoryStorage } from './helpers';

function setup() {
  const storage = memoryStorage();
  const clock = fakeClock();
  const make = () => new Game({ storage, now: clock.now, seed: () => 99 });
  return { storage, clock, make };
}

describe('Game', () => {
  it('новая игра требует имя и создаёт яйцо', () => {
    const { make } = setup();
    const game = make();
    expect(game.start().status).toBe('empty');
    expect(game.newPet('   ')).toBe(false);
    expect(game.newPet('Пушок')).toBe(true);
    expect(game.state.pet?.stage).toBe('egg');
  });

  it('после закрытия вкладки догоняет пропущенное время и показывает сводку', () => {
    const { clock, make } = setup();
    const first = make();
    first.start();
    first.newPet('Пушок');

    clock.advance(5 * HOUR);
    const second = make();
    const info = second.start();
    const pet = second.state.pet;

    expect(info.status).toBe('loaded');
    expect(pet?.ageMs).toBe(5 * HOUR);
    expect(pet?.stage).toBe('baby');
    expect(info.absence?.dtMs).toBe(5 * HOUR);
    expect(info.absence?.notes).toContainEqual({ kind: 'hatched' });
  });

  it('офлайн-прогресс ограничен 72 часами', () => {
    const { clock, make } = setup();
    const first = make();
    first.start();
    first.newPet('Пушок');
    clock.advance(10 * DAY);
    const second = make();
    expect(second.start().absence?.dtMs).toBe(72 * HOUR);
  });

  it('перевод часов назад не двигает время, дальше отсчёт идёт от новых часов', () => {
    const { clock, make } = setup();
    const game = make();
    game.start();
    game.newPet('Пушок');
    clock.advance(-3 * HOUR);
    game.update();
    expect(game.state.pet?.ageMs).toBe(0);
    clock.advance(HOUR);
    game.update();
    expect(game.state.pet?.ageMs).toBe(HOUR);
  });

  it('действия идут через шину событий и сохраняются', () => {
    const { clock, make, storage } = setup();
    const game = make();
    game.start();
    game.newPet('Пушок');
    clock.advance(10 * MINUTE);
    game.update();

    const seen: BusEvent[] = [];
    game.bus.onAny((e) => seen.push(e));
    expect(game.act('sleep')).toBeNull();
    expect(game.act('sleep')).toBe('cooldown');
    expect(seen.map((e) => e.type)).toEqual(['actionDone', 'fellAsleep', 'changed', 'actionBlocked']);
    expect(JSON.parse(storage.data.get('tamagotchi.save') ?? '{}').pet.isSleeping).toBe(true);
  });

  it('смерть записывается в Зал памяти один раз', () => {
    const { clock, make } = setup();
    const game = make();
    game.start();
    game.newPet('Пушок');
    const died: GameEvent[] = [];
    game.bus.on('died', (e) => died.push(e));
    for (let i = 0; i < 30; i++) {
      clock.advance(DAY);
      game.update();
    }
    expect(game.state.pet?.stage).toBe('dead');
    expect(died).toHaveLength(1);
    expect(game.state.graveyard).toHaveLength(1);
    expect(game.state.graveyard[0]?.name).toBe('Пушок');
    expect(typeof game.state.graveyard[0]?.careScore).toBe('number');
    expect(game.state.graveyard[0]?.sicknessCount).toBe(game.state.pet?.care.sicknessCount);

    game.newPet('Бублик');
    expect(game.state.pet?.stage).toBe('egg');
    expect(game.state.graveyard).toHaveLength(1);
  });

  it('ускорение времени в отладке', () => {
    const { clock, make } = setup();
    const game = make();
    game.start();
    game.newPet('Пушок');
    game.setTimeScale(100);
    clock.advance(MINUTE);
    game.update();
    expect(game.state.pet?.ageMs).toBe(100 * MINUTE);
  });

  it('сброс удаляет сохранение', () => {
    const { make, storage } = setup();
    const game = make();
    game.start();
    game.newPet('Пушок');
    game.resetAll();
    expect(game.state.pet).toBeNull();
    expect(storage.data.size).toBe(0);
  });
});
