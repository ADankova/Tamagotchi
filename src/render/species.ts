import type { AdultForm, LifeStage, Species } from '../core/types';
import type { SpriteName } from './sprites';

/** Стадии, у которых есть свой облик (яйцо, надгробие и призрак общие для всех). */
export type BodyStage = 'baby' | 'child' | 'teen' | 'adultGood' | 'adultNormal' | 'adultNaughty' | 'elder';

export interface SpeciesLook {
  bodies: Readonly<Record<BodyStage, SpriteName>>;
  /** Хвост в двух кадрах — рисуется за телом справа и виляет. У малыша хвоста нет. */
  tail?: readonly [SpriteName, SpriteName];
  /** Облик для карточки выбора на старте. */
  preview: SpriteName;
}

/**
 * Реестр животных. Чтобы добавить новое: нарисовать спрайты в sprites.ts,
 * добавить вид в Species (core/types.ts), описать его здесь и подписать в strings.ts.
 */
export const SPECIES_LOOKS: Readonly<Record<Species, SpeciesLook>> = {
  cat: {
    bodies: {
      baby: 'catBaby',
      child: 'catChild',
      teen: 'catTeen',
      adultGood: 'catTeen',
      adultNormal: 'catTeen',
      adultNaughty: 'catTeen',
      elder: 'catElder',
    },
    tail: ['catTailA', 'catTailB'],
    preview: 'catChild',
  },
  dog: {
    bodies: {
      baby: 'dogBaby',
      child: 'dogChild',
      teen: 'dogTeen',
      adultGood: 'dogTeen',
      adultNormal: 'dogTeen',
      adultNaughty: 'dogTeen',
      elder: 'dogElder',
    },
    tail: ['dogTailA', 'dogTailB'],
    preview: 'dogChild',
  },
  blob: {
    bodies: {
      baby: 'baby',
      child: 'child',
      teen: 'teen',
      adultGood: 'teen',
      adultNormal: 'teen',
      adultNaughty: 'teen',
      elder: 'elder',
    },
    preview: 'child',
  },
};

export function bodyStage(stage: Exclude<LifeStage, 'egg' | 'dead'>, form?: AdultForm): BodyStage {
  if (stage !== 'adult') return stage;
  return form === 'good' ? 'adultGood' : form === 'naughty' ? 'adultNaughty' : 'adultNormal';
}

/** Сколько пикселей хвост добавляет справа от тела (он заходит на тело на 2 пикселя). */
export const TAIL_OVERLAP = 2;
