import { describe, expect, it } from 'vitest';
import { backdropAt, hourOf } from '../src/render/backdrop';

describe('backdrop', () => {
  it('утром свечение в левом верхнем углу, к вечеру уходит вправо', () => {
    const morning = backdropAt(7);
    const noon = backdropAt(12);
    const evening = backdropAt(17);
    expect(morning.glowX).toBeLessThan(0.15);
    expect(morning.glowY).toBeLessThan(0.15);
    expect(noon.glowX).toBeGreaterThan(morning.glowX);
    expect(evening.glowX).toBeGreaterThan(noon.glowX);
    expect(evening.glowX).toBeGreaterThan(0.85);
  });

  it('свечение утром светло-жёлтое, ночью бледно-белое', () => {
    expect(backdropAt(7).glow).toBe('#fff2a8');
    expect(backdropAt(1).glow).toBe('#e9eeff');
  });

  it('ночью фон темнее, чем днём', () => {
    const lum = (c: string) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);
    expect(lum(backdropAt(1).top)).toBeLessThan(lum(backdropAt(12).top) - 200);
    expect(backdropAt(1).night).toBeGreaterThan(0.9);
    expect(backdropAt(12).night).toBe(0);
  });

  it('значения плавные и замыкаются в сутки', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const a = backdropAt(h);
      const b = backdropAt(h + 0.25);
      expect(Math.abs(a.glowX - b.glowX)).toBeLessThan(0.2);
    }
    expect(backdropAt(24)).toEqual(backdropAt(0));
    expect(backdropAt(-1)).toEqual(backdropAt(23));
  });

  it('hourOf считает часы с минутами', () => {
    expect(hourOf(new Date(2026, 0, 1, 7, 30))).toBe(7.5);
  });
});
