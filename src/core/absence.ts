import { NEED_ALERT_THRESHOLD, POOP_SICK_THRESHOLD } from './config';
import type { GameEvent, LifeStage, Pet } from './types';

/** Что произошло, пока игрока не было. Текст подбирает UI. */
export type AbsenceNote =
  | { kind: 'grew'; stage: LifeStage }
  | { kind: 'hatched' }
  | { kind: 'gotSick' }
  | { kind: 'sleeping' }
  | { kind: 'hungry' }
  | { kind: 'dirty'; poops: number }
  | { kind: 'pooped'; poops: number }
  | { kind: 'bored' }
  | { kind: 'died' };

export function describeAbsence(after: Pet, events: readonly GameEvent[]): AbsenceNote[] {
  const notes: AbsenceNote[] = [];
  for (const e of events) {
    if (e.type === 'hatched') notes.push({ kind: 'hatched' });
    if (e.type === 'stageChanged' && e.stage !== 'baby') notes.push({ kind: 'grew', stage: e.stage });
  }
  if (events.some((e) => e.type === 'gotSick')) notes.push({ kind: 'gotSick' });
  if (after.stage === 'dead') {
    notes.push({ kind: 'died' });
    return notes;
  }
  if (after.isSleeping) notes.push({ kind: 'sleeping' });
  if (after.stats.hunger < NEED_ALERT_THRESHOLD) notes.push({ kind: 'hungry' });
  const pooped = events.filter((e) => e.type === 'pooped').length;
  if (after.poops >= POOP_SICK_THRESHOLD) notes.push({ kind: 'dirty', poops: after.poops });
  else if (pooped > 0) notes.push({ kind: 'pooped', poops: after.poops });
  if (after.stats.happiness < NEED_ALERT_THRESHOLD) notes.push({ kind: 'bored' });
  return notes;
}
