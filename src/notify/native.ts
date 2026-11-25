import { LocalNotifications } from '@capacitor/local-notifications';
import { nextAttention, type Attention } from '../core/forecast';
import type { Pet } from '../core/types';
import { T } from '../strings';
import { attentionMessage, TEST_DELAY_MS, type Notifier, type PermissionResult } from './notifier';

const NOTIFICATION_ID = 1;
const TEST_NOTIFICATION_ID = 2;

/**
 * Телефон (Android через Capacitor): настоящее запланированное уведомление,
 * которое придёт, даже если приложение закрыто.
 */
export class NativeNotifier implements Notifier {
  readonly kind = 'native' as const;

  async permission(): Promise<PermissionResult> {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }

  async request(): Promise<boolean> {
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch {
      return false;
    }
  }

  async scheduleAway(pet: Pet): Promise<Attention | null> {
    await this.cancel();
    if ((await this.permission()) !== 'granted') return null;
    const attention = nextAttention(pet);
    if (!attention) return null;
    const { title, body } = attentionMessage(pet, attention);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title,
          body,
          schedule: { at: new Date(Date.now() + attention.inMs), allowWhileIdle: true },
        },
      ],
    });
    return attention;
  }

  async test(): Promise<boolean> {
    if (!(await this.request())) return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_NOTIFICATION_ID,
          title: T.title,
          body: T.testNotification,
          schedule: { at: new Date(Date.now() + TEST_DELAY_MS), allowWhileIdle: true },
        },
      ],
    });
    return true;
  }

  async cancel(): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    } catch {
      // нечего отменять
    }
  }
}
