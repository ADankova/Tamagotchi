import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  deserialize,
  hygieneToPoops,
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

describe('перенос старых сохранений', () => {
  it('сейв версии 1 без вида животного загружается: питомец и записи зала — «Пушистики»', () => {
    const state = sampleState();
    const v1 = JSON.parse(serialize(state));
    v1.version = 1;
    delete v1.pet.species;
    delete v1.graveyard[0].species;
    const loaded = deserialize(JSON.stringify(v1));
    expect(loaded?.pet?.species).toBe('blob');
    expect(loaded?.graveyard[0]?.species).toBe('blob');
  });

  it('неизвестный вид животного — повреждённый сейв', () => {
    const data = JSON.parse(serialize(sampleState()));
    data.pet.species = 'dragon';
    expect(deserialize(JSON.stringify(data))).toBeNull();
  });
});

describe('сейв версии 2 → 3: чистота превращается в какашки', () => {
  it.each([
    [100, 0],
    [75, 1],
    [40, 3],
    [0, 5],
  ])('чистота %d → %d какашек', (hygiene: number, poops: number) => {
    expect(hygieneToPoops(hygiene)).toBe(poops);
  });

  it('старый сейв с чистотой загружается без потерь', () => {
    const state = sampleState();
    const v2 = JSON.parse(serialize(state));
    v2.version = 2;
    v2.pet.stats.hygiene = 35;
    delete v2.pet.poops;
    delete v2.pet.poopTimerMs;
    const loaded = deserialize(JSON.stringify(v2));
    expect(loaded?.pet?.poops).toBe(3);
    expect(loaded?.pet?.poopTimerMs).toBe(3 * 3600 * 1000);
    expect(loaded?.pet?.stats).toEqual(state.pet?.stats);
  });

  it('из версии 1 — сразу через обе миграции', () => {
    const v1 = JSON.parse(serialize(sampleState()));
    v1.version = 1;
    delete v1.pet.species;
    delete v1.pet.poops;
    delete v1.pet.poopTimerMs;
    v1.pet.stats.hygiene = 100;
    const loaded = deserialize(JSON.stringify(v1));
    expect(loaded?.pet?.species).toBe('blob');
    expect(loaded?.pet?.poops).toBe(0);
  });
});
