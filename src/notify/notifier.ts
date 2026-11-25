import { nextAttention, type Attention } from '../core/forecast';
import type { Pet } from '../core/types';
import { ATTENTION_TEXT, T } from '../strings';

export type PermissionResult = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Напоминания «пора позаботиться о питомце».
 * Когда игра уходит в фон, по прогнозу ставится одно напоминание; при возврате оно снимается.
 */
export interface Notifier {
  readonly kind: 'web' | 'native' | 'none';
  permission(): Promise<PermissionResult>;
  request(): Promise<boolean>;
  scheduleAway(pet: Pet): Promise<Attention | null>;
  cancel(): Promise<void>;
}

export function attentionMessage(pet: Pet, attention: Attention): { title: string; body: string } {
  return { title: T.title, body: ATTENTION_TEXT[attention.reason](pet.name) };
}

/** Браузер: Notification API. Срабатывает, пока вкладка открыта (в том числе в фоне). */
export class WebNotifier implements Notifier {
  readonly kind = 'web' as const;
  private timer = 0;

  static supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async permission(): Promise<PermissionResult> {
    return WebNotifier.supported() ? Notification.permission : 'unsupported';
  }

  async request(): Promise<boolean> {
    if (!WebNotifier.supported()) return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  }

  async scheduleAway(pet: Pet): Promise<Attention | null> {
    await this.cancel();
    if ((await this.permission()) !== 'granted') return null;
    const attention = nextAttention(pet);
    if (!attention) return null;
    const { title, body } = attentionMessage(pet, attention);
    this.timer = window.setTimeout(() => {
      try {
        new Notification(title, { body, tag: 'tamagotchi' });
      } catch {
        // На некоторых мобильных браузерах конструктор запрещён — тихо пропускаем.
      }
    }, attention.inMs);
    return attention;
  }

  async cancel(): Promise<void> {
    window.clearTimeout(this.timer);
    this.timer = 0;
  }
}

export class NoNotifier implements Notifier {
  readonly kind = 'none' as const;
  async permission(): Promise<PermissionResult> {
    return 'unsupported';
  }
  async request(): Promise<boolean> {
    return false;
  }
  async scheduleAway(): Promise<Attention | null> {
    return null;
  }
  async cancel(): Promise<void> {}
}
