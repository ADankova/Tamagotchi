import {
  CARE_PENALTY_PER_SICKNESS,
  FORM_GOOD_MIN_SCORE,
  FORM_NORMAL_MIN_SCORE,
  STAGE_STARTS,
  STAT_MAX,
  STAT_MIN,
} from './config';
import type { AdultForm, CareRecord, LifeStage } from './types';

/** Стадия по возрасту от рождения (без учёта смерти). */
export function stageForAge(ageMs: number): LifeStage {
  let stage: LifeStage = 'egg';
  for (const [name, start] of STAGE_STARTS) {
    if (ageMs >= start) stage = name;
  }
  return stage;
}

/** Среднее счастье за жизнь минус штраф за каждую болезнь, 0..100. */
export function computeCareScore(care: CareRecord): number {
  const avgHappiness = care.minutes > 0 ? care.happinessMinutes / care.minutes : STAT_MAX;
  const score = avgHappiness - care.sicknessCount * CARE_PENALTY_PER_SICKNESS;
  return Math.min(STAT_MAX, Math.max(STAT_MIN, score));
}

export function formForCareScore(score: number): AdultForm {
  if (score >= FORM_GOOD_MIN_SCORE) return 'good';
  if (score >= FORM_NORMAL_MIN_SCORE) return 'normal';
  return 'naughty';
}
