import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  deserialize,
  loadState,
  SAVE_KEY,
  SAVE_VERSION,
  saveState,
  serialize,
  type GameState,
  type KeyValueStorage,
} from '../src/storage/save';
import { makePet, memoryStorage, T0 } from './helpers';

function sampleState(): GameState {
  return {
    ...createInitialState(T0),
    pet: makePet(),
    cooldowns: { feed: T0 + 3000 },
    graveyard: [
      {
        name: 'Бублик',
        stage: 'adult',
        form: 'normal',
        bornAt: T0 - 1e9,
        diedAt: T0 - 1e8,
        ageMs: 9e8,
        causeOfDeath: 'hunger',
      },
    ],
  };
}

describe('сохранение', () => {
  it('сохраняет и загружает то же состояние', () => {
    const storage = memoryStorage();
    const state = sampleState();
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage, T0)).toEqual({ status: 'loaded', state });
  });

  it('в сейве есть номер версии', () => {
    expect(JSON.parse(serialize(sampleState())).version).toBe(SAVE_VERSION);
  });

  it('пустое хранилище — новая игра', () => {
    expect(loadState(memoryStorage(), T0)).toEqual({
      status: 'empty',
      state: createInitialState(T0),
    });
  });

  it.each([
    ['не JSON', '{oops'],
    ['не объект', '[1,2,3]'],
    ['нет версии', JSON.stringify({ pet: null })],
    ['версия из будущего', JSON.stringify({ ...JSON.parse(serialize(sampleState())), version: 999 })],
    [
      'битый питомец',
      JSON.stringify({ ...JSON.parse(serialize(sampleState())), pet: { name: 1 } }),
    ],
    [
      'NaN в характеристиках',
      serialize(sampleState()).replace('"hunger":80', '"hunger":"много"'),
    ],
  ])('повреждённый сейв (%s) сбрасывается безопасно', (_label, raw) => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, raw);
    expect(loadState(storage, T0)).toEqual({
      status: 'corrupted',
      state: createInitialState(T0),
    });
  });

  it('старые записи Зала памяти без оценки ухода загружаются', () => {
    const state = sampleState();
    const withCare = { ...state, graveyard: [{ ...state.graveyard[0]!, careScore: 82, sicknessCount: 1 }] };
    expect(deserialize(serialize(withCare))).toEqual(withCare);
    expect(deserialize(serialize(state))).toEqual(state);
    const broken = JSON.parse(serialize(withCare));
    broken.graveyard[0].careScore = 'высокий';
    expect(deserialize(JSON.stringify(broken))).toBeNull();
  });

  it('deserialize не тащит лишние поля', () => {
    const raw = JSON.stringify({ ...JSON.parse(serialize(sampleState())), junk: true });
    expect(deserialize(raw)).not.toHaveProperty('junk');
  });

  it('если хранилище недоступно, игра не падает', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(saveState(broken, sampleState())).toBe(false);
    expect(loadState(broken, T0).status).toBe('corrupted');
  });
});
