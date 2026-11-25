import { formForCareScore } from './core/lifecycle';
import type { AdultForm } from './core/types';
import type { GraveRecord } from './storage/save';

export interface MemorialSummary {
  count: number;
  /** Дольше всех проживший питомец. */
  longest: GraveRecord | null;
}

export function summarizeGraveyard(records: readonly GraveRecord[]): MemorialSummary {
  let longest: GraveRecord | null = null;
  for (const r of records) {
    if (!longest || r.ageMs > longest.ageMs) longest = r;
  }
  return { count: records.length, longest };
}

/** Оценка ухода теми же порогами, что и форма взрослого питомца. */
export function careGrade(score: number): AdultForm {
  return formForCareScore(score);
}
