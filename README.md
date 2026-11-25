# Тамагочи

Игра «Тамагочи» для Android на TypeScript: виртуальный питомец, который растёт в реальном времени, даже когда приложение закрыто.

**Скачать APK:** [tamagotchi-debug.apk](https://github.com/ADankova/Tamagotchi/releases/download/android-latest/tamagotchi-debug.apk)

Техническое задание: [docs/TZ.md](docs/TZ.md)

## Запуск

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev        # быстрый просмотр интерфейса в браузере при разработке
npm test           # юнит-тесты
npm run build      # проверка типов + сборка в dist/
```

## Android

APK собирается в GitHub Actions (`.github/workflows/android.yml`) при каждом пуше в `main` и выкладывается в релиз [android-latest](https://github.com/ADankova/Tamagotchi/releases/tag/android-latest). Скачайте `tamagotchi-debug.apk` на телефон, откройте и разрешите установку из этого источника. Сборки подписаны постоянным ключом (`android-signing/`), поэтому новые версии ставятся поверх старых с сохранением питомца.

Собрать локально (нужны Android Studio / Android SDK и JDK 21):

```bash
npm install
npm run build
npx cap add android        # один раз
npm run android:icons
npm run android:theme
npm run android:manifest
npm run android:gradle
npx cap sync android
cd android && ./gradlew assembleDebug
```

В приложении работают системная кнопка «Назад» и настоящие напоминания: когда приложение свёрнуто, ставится уведомление на момент, когда питомцу понадобится забота.

**Режим тестирования** (ускорение времени ×10…×1000, ползунки показателей): в приложении — 7 быстрых касаний по строке «Версия» в настройках; при разработке в браузере — адрес `http://localhost:5173/?debug=1`.

## Как добавить животное

1. Нарисовать спрайты в `src/render/sprites.ts`: тела для стадий `baby`, `child`, `teen`, `adultGood`, `adultNormal`, `adultNaughty`, `elder` (симметричные, не шире 24 и не выше 20 пикселей; глаза — символ `e`, чтобы питомец моргал и спал) и, если нужно, хвост в двух кадрах одного размера.
2. Добавить вид в `Species` и `SPECIES` в `src/core/types.ts`.
3. Описать облик в `SPECIES_LOOKS` (`src/render/species.ts`) и подписать в `SPECIES_LABELS` (`src/strings.ts`).
4. `npm test` — тесты проверят симметрию, размеры и что все сцены помещаются на экран.



```
src/
  core/          чистая логика без DOM: модель, tick, действия, стадии, баланс (config.ts)
  storage/       сохранение в localStorage, версия сейва, проверка и миграции
  render/        интерфейс (ui.ts) и панель отладки (debug.ts)
  audio/         8-битные звуки (Web Audio)
  notify/        напоминания (Android)
  platform.ts    связь с Android: кнопка «Назад», сворачивание, уведомления
  game.ts        игровой цикл: время, офлайн-прогресс, шина событий
  strings.ts     все тексты интерфейса
  main.ts        точка входа
tests/           Vitest
```

Все числа баланса — в `src/core/config.ts`.

## Статус

- [x] Этап 1 — ядро, сохранение, офлайн-прогресс, тесты, простой интерфейс
- [x] Этап 2 — графика и интерфейс
- [x] Этап 3 — сценки вылупления, взросления и смерти, «Зал памяти»
- [x] Этап 4 — звук, напоминания, настройки, баланс, публикация, Android-приложение
