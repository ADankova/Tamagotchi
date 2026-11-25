import { Capacitor } from '@capacitor/core';
import { NoNotifier, WebNotifier, type Notifier } from './notify/notifier';

/** Запущены ли мы внутри Android-приложения (Capacitor), а не в браузере. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function createNotifier(): Promise<Notifier> {
  if (isNativeApp()) {
    const { NativeNotifier } = await import('./notify/native');
    return new NativeNotifier();
  }
  return WebNotifier.supported() ? new WebNotifier() : new NoNotifier();
}

export interface ShellHandlers {
  /** true — кнопка «Назад» обработана внутри игры. */
  onBack: () => boolean;
  onPause: () => void;
  onResume: () => void;
}

/** Системная кнопка «Назад» и сворачивание приложения на Android. В браузере ничего не делает. */
export async function setupNativeShell(handlers: ShellHandlers): Promise<void> {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (!handlers.onBack()) void App.minimizeApp();
  });
  await App.addListener('pause', handlers.onPause);
  await App.addListener('resume', handlers.onResume);
}
