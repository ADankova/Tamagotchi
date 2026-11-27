import { PET_PICTURE_NAMES } from '../core/mosaicPictures';
import type { AbsenceNote } from '../core/absence';
import type { ActionBlockReason } from '../core/actions';
import { DAY, HOUR, MINUTE } from '../core/config';
import type { AttentionReason } from '../core/forecast';
import type { ActionType, AdultForm, CauseOfDeath, LifeStage, Mood, Species, StatKey } from '../core/types';

// Русские тексты интерфейса. Английские — в en.ts (та же форма), выбор языка — в ../i18n.ts.

const T = {
  title: 'Тамагочи',
  intro: 'Заведи питомца и заботься о нём. Он растёт, даже когда приложение закрыто.',
  chooseSpecies: 'Кто вылупится?',
  nameLabel: 'Имя питомца',
  namePlaceholder: 'Например, Пушок',
  nameRequired: 'Придумай питомцу имя.',
  name: 'Имя',
  newGame: 'Новая игра',
  newEgg: 'Новое яйцо',
  age: 'Возраст',
  stage: 'Стадия',
  cause: 'Причина',
  resultsTitle: 'Питомец умер',
  graveyard: 'Зал памяти',
  settings: 'Настройки',
  reset: 'Сбросить сохранение',
  resetConfirm: 'Удалить питомца, Зал памяти и все настройки? Это нельзя отменить.',
  corrupted: 'Сохранение было повреждено, игра начата заново.',
  saveFailed: 'Не удалось сохранить игру: браузер не даёт писать в хранилище.',
  absenceTitle: (time: string) => `Пока тебя не было ${time}:`,
  absenceNothing: 'всё спокойно.',
  dismiss: 'Понятно',
  debug: 'Отладка',
  speed: 'Скорость времени',
  care: 'Уход',
  sicknesses: 'Болезней',
  back: 'Назад',
  memoryIntro: 'Здесь помнят всех твоих питомцев.',
  memoryEmpty: 'Пока здесь никого нет.',
  memoryCount: (n: number) => `Всего питомцев: ${n}`,
  memoryRecord: (name: string, age: string) => `Дольше всех прожил ${name} — ${age}`,
  lived: 'прожил',
  diedOn: (date: string) => `умер ${date}`,
  diedWhileAway: (name: string) => `${name} не дождался тебя.`,
  testNotification: 'Проверка: напоминания работают. Можно возвращаться к питомцу!',
  openMemory: (n: number) => (n > 0 ? `Зал памяти (${n})` : 'Зал памяти'),
};

const ATTENTION_TEXT: Record<AttentionReason, (name: string) => string> = {
  hatch: (name) => `${name} вылупился! Загляни познакомиться.`,
  hungry: (name) => `${name} проголодался.`,
  dirty: (name) => `${name} насорил — пора убрать.`,
  bored: (name) => `${name} скучает без тебя.`,
  sick: (name) => `${name} заболел. Нужно лекарство.`,
  dying: (name) => `${name} очень плохо себя чувствует!`,
};

const ATTENTION_SHORT: Record<AttentionReason, string> = {
  hatch: 'вылупление',
  hungry: 'голод',
  dirty: 'грязь',
  bored: 'скука',
  sick: 'болезнь',
  dying: 'плохое самочувствие',
};

const SETTINGS_TEXT = {
  title: 'Настройки',
  sound: 'Звук',
  soundHint: '8-битные звуки на действия и события.',
  notifications: 'Напоминания',
  notificationsHint: 'Сообщим, когда питомцу понадобится забота.',
  notificationsDenied: 'Уведомления запрещены. Разрешите их в настройках телефона: Приложения → Тамагочи → Уведомления.',
  notificationsUnsupported: 'Этот браузер не умеет показывать уведомления.',
  notificationsWeb: 'В браузере напоминание придёт, только пока вкладка открыта.',
  testButton: 'Проверить уведомление',
  testSent: 'Через 5 секунд придёт пробное уведомление. Можно свернуть приложение.',
  testFailed: 'Не удалось: уведомления не разрешены.',
  lastReminder: (time: string, what: string) => `Последнее напоминание было запланировано на ${time} (${what}).`,
  language: 'Язык',
  languageHint: 'Язык интерфейса. Игра перезапустится, прогресс сохранится.',
  data: 'Данные',
  version: (v: string) => `Версия ${v}`,
};

function treatWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'лакомство';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'лакомства';
  return 'лакомств';
}

const GAMES_TEXT = {
  menuTitle: 'Мини-игры',
  menuIntro: 'Играй с питомцем и зарабатывай лакомства.',
  close: 'Закрыть',
  rulesButton: (game: string) => `Правила игры «${game}»`,
  favourite: (game: string, on: boolean) => (on ? `Убрать «${game}» из избранного` : `Добавить «${game}» в избранное`),
  queensTitle: 'Судоку с питомцем',
  queensAbout: 'Расставь питомцев: по одному в каждой строке, столбце и цветной зоне. Питомцы не должны касаться друг друга — даже углами.',
  level: (size: number, reward: number) => `${size}×${size} · +${reward} ${treatWord(reward)}`,
  levelNames: ['Легко', 'Средне', 'Сложно'] as readonly string[],
  stats: (played: number, won: number) => `Сыграно: ${played} · Побед: ${won}`,
  slideTitle: 'Питомцы-блоки',
  slideAbout:
    'Двигай блоки пальцем влево и вправо. Заполни полосу целиком — она исчезнет. Блок с лакомством исчезнет — лакомство твоё. Два режима: в «Лавине» после каждого хода сверху падает новая полоса, в «Приливе» она вырастает снизу и поднимает стопку. На блоках бывают бонусы: заморозка на 3 хода, молния (убирает соседей сверху и снизу) и крошки (разбивают блоки в поле 3×3). Не дай стопке дорасти до верха!',
  slidePlay: 'Играть',
  slideModeName: { fall: 'Лавина', rise: 'Прилив' },
  slideModeInfo: { fall: 'Блоки падают сверху', rise: 'Блоки растут снизу' },
  slideStats: (played: number, best: number) => `Сыграно: ${played} · Рекорд: ${best} ${lineWord(best)}`,
  slideLines: (n: number) => `${n} ${lineWord(n)}`,
  slideTreats: (n: number) => `Лакомств: ${n}`,
  slideNext: { fall: 'Дальше упадёт', rise: 'Дальше вырастет' },
  slideHint: 'Тяни блок пальцем влево или вправо',
  slideOverTitle: 'Стопка до самого верха!',
  slideOverText: (name: string, lines: number, treats: number) =>
    treats > 0
      ? `Убрано ${lines} ${lineWord(lines)}. ${name} получает ${treats} ${treatWord(treats)}!`
      : `Убрано ${lines} ${lineWord(lines)}. ${name} отлично повеселился.`,
  slideRecord: 'Новый рекорд!',
  slideResumed: 'Игра продолжена с того места, где ты остановилась.',
  slideLeaveConfirm: 'Закончить игру? Собранные лакомства уже твои.',
  slideFreeze: 'Заморозка',
  slideFreezeEmpty: 'Нет заморозки',
  slideCrumbsEmpty: 'Нет крошек',
  slideCrumbs: 'Крошки',
  slideFrozen: (n: number) => `Заморожено: ${n} ${n === 1 ? 'ход' : n < 5 ? 'хода' : 'ходов'}`,
  slideBonusGot: { freeze: 'Заморозка в запасе!', crumbs: 'Крошки в запасе!', lightning: 'Молния!' },
  slideNoCrumbTarget: 'Крошкам нечего разбивать',
  slideBonusHint: 'Бонусы на блоках: заморозка, молния, крошки',
  slideBlock: (row: number, col: number, len: number) => `Блок: строка ${row}, клетки ${col}–${col + len - 1}`,
  mosaicTitle: 'Питомцы-воришки',
  mosaicAbout:
    'Картинка собрана из цветных кубиков. Нажми на баночку — она встанет в ячейку, и питомцы начнут уносить в норку кубики её цвета, сколько написано на баночке. Уносят только открытые кубики, у края или рядом с пустым местом. Освободи всю картинку, пока ячейки не забились баночками, которым нечего уносить. Баночки, соединённые трубкой, берутся только вместе (нужны две свободные ячейки) и освобождают ячейки тоже вместе: опустевшая ждёт вторую.',
  mosaicLevel: 'Случайная картинка',
  mosaicPicture: { heart: 'Сердечко', ...Object.fromEntries(Object.entries(PET_PICTURE_NAMES).map(([k, v]) => [k, v.ru])) } as Record<string, string>,
  mosaicInfo: (reward: number) => `Небольшая картинка · +${reward} ${treatWord(reward)}`,
  mosaicStats: (played: number, won: number) => `Сыграно: ${played} · Побед: ${won}`,
  mosaicLeft: (n: number) => `Кубиков: ${n}`,
  mosaicSpeed: (n: number) => `Скорость ×${n}`,
  mosaicHint: 'Нажимай на баночки внизу',
  mosaicJar: (n: number) => `Баночка, ${n}`,
  mosaicWinTitle: 'Картинка готова!',
  mosaicWinText: (name: string, reward: number) => `${name} унёс все кубики и получает ${reward} ${treatWord(reward)}!`,
  mosaicStuckTitle: 'Баночки застряли',
  mosaicStuckText: (name: string) => `Все ячейки заняты, и ${name} нечего уносить. Попробуем ещё раз?`,
  mosaicLeaveConfirm: 'Закончить игру? Картинка не сохранится.',
  harborTitle: 'Бухта питомцев',
  harborAbout:
    'Снизу всплывают острова с питомцами. Нажми на питомца — он поплывёт на корабль своего вида. Если такого корабля пока нет, питомец подождёт на пристани и пересядет, когда корабль появится. На корабль нужно собрать трёх одинаковых. Если пристань заполнена и отправить некого, питомцы застрянут. Некоторые острова несут бонусы: чтобы получить бонус, убери с острова всех питомцев. Сачок выуживает питомца, которого на кораблях больше всего. Удалить складывает питомцев с пристани в общий блок рядом. Обновить перемешивает питомцев на островах. Лакомства лежат на некоторых островах: убери с острова всех питомцев, и лакомство твоё. Партия сохраняется, если выйти.',
  harborBonusName: { net: 'Сачок', clear: 'Удалить', shuffle: 'Обновить' } as Record<'net' | 'clear' | 'shuffle', string>,
  harborLevel: 'Тихая бухта',
  harborInfo: () => 'Три корабля · лакомства на островах',
  harborStats: (played: number, won: number) => `Сыграно: ${played} · Побед: ${won}`,
  harborLeft: (n: number) => `Осталось питомцев: ${n}`,
  harborHint: 'Нажимай на питомцев на островах',
  harborPet: 'Питомец',
  harborWinTitle: 'Все отплыли!',
  harborWinText: (name: string) => `${name} отправил всех питомцев в плавание!`,
  harborStuckTitle: 'Пристань переполнена',
  harborStuckText: (name: string) => `Пристань заполнена, и ${name} некого отправить. Попробуем ещё раз?`,
  harborLeaveConfirm: 'Закончить игру? Партия не сохранится.',
  harborTreats: (n: number) => `Лакомств: ${n}`,
  match3Title: 'Три питомца в ряд',
  match3About:
    'Меняй местами соседних питомцев: три и больше в ряд или в столбце исчезают, а верхние падают вниз. Игра бесконечная, ходов и очков нет, а поле запоминается, когда ты выходишь. Время от времени среди упавших питомцев появляется лакомство: обычным рядом его не достать, но его заберёт бомба или бонус-строка и бонус-столбец. Четыре в ряд дают бонус-линию (нажми на него), квадрат 2×2 или «Т»/«Г» из пяти — бомбу, пять в ряд или крест-плюс — радугу.',
  match3Level: 'Без конца',
  match3Info: 'Лакомства достаются бомбой и бонус-линиями',
  match3Stats: (treats: number) => `Собрано лакомств: ${treats}`,
  match3Hint: 'Меняй соседних питомцев или нажми на бонус',
  match3Treats: (n: number) => `Лакомств: ${n}`,
  match3Restart: 'Начать заново',
  match3RestartSure: 'Нажми ещё раз, чтобы начать заново',
  match3TreatLabel: 'Лакомство',
  match3Tile: 'Питомец',
  match3Special: { row: 'Бонус: строка', col: 'Бонус: столбец', bomb: 'Бомба', rainbow: 'Радуга' } as Record<'row' | 'col' | 'bomb' | 'rainbow', string>,
  match3Legend: {
    title: 'Что получится',
    threeTitle: '3 и больше в ряд',
    threeText: 'питомцы исчезают, сверху падают новые',
    rowTitle: '4 в ряд по горизонтали',
    rowText: 'бонус-строка: стирает всю свою строку',
    colTitle: '4 в ряд по вертикали',
    colText: 'бонус-столбец: стирает весь свой столбец',
    bombTitle: 'Квадрат 2×2, «Т» или «Г»',
    bombText: 'бомба: сносит всё вокруг на 3 клетки',
    rainbowTitle: '5 в ряд или крест-плюс',
    rainbowText: 'радуга: поменяй с соседом — исчезнут все питомцы его вида',
    treatTitle: 'Лакомство',
    treatText: 'достанут только бомба, строка или столбец',
    tip: 'Бонус-строку, столбец и бомбу достаточно нажать. Две радуги, поменянные местами, убирают всё поле. Бонус внутри сложенного ряда срабатывает сам.',
  },
  match3Shuffle: 'Ходов не осталось — питомцы перемешались',
  match3LeaveConfirm: 'Закончить игру? Партия не сохранится.',
  forestTitle: 'Дикий лес',
  forestAbout:
    'Твой питомец ушёл в поход. Нажимай на землю — он пойдёт туда, на ветку, камень или куст — подойдёт и соберёт. Следи за сытостью, водой и теплом: ягоды и грибы едятся из рюкзака, пить можно из ручья. Из трёх веток и кремня на костровище получится костёр: ночью без него темно и холодно, а у огня можно поспать. За каждую прожитую ночь — 2 лакомства. Поход запоминается, когда ты выходишь.',
  forestLevel: 'Поход',
  forestInfo: 'Собирай, грейся у костра, переживи ночь',
  forestStats: (best: number) => (best > 0 ? `Рекорд: ${best} ${best === 1 ? 'ночь' : best < 5 ? 'ночи' : 'ночей'}` : 'Ещё ни одной ночи'),
  forestDay: (n: number) => `День ${n}`,
  forestHint: 'Нажми на ветку или кремень, чтобы собрать',
  forestBag: 'Рюкзак',
  forestBagTitle: (used: number, max: number) => `Рюкзак · ${used}/${max}`,
  forestBagEmpty: 'Пока пусто',
  forestEat: 'Съесть',
  forestWear: 'Надеть',
  forestGear: 'Слоты',
  forestDrink: 'Выпить',
  forestLight: 'Зажечь',
  forestCraft: 'Крафт',
  forestMake: 'Сделать',
  forestChestTitle: 'Сундук',
  forestQuestLabel: 'Задание',
  forestQuestsDone: 'Все задания выполнены!',
  forestPart: { 'pick:branch': 'Собери: {n} x Ветка', 'pick:flint': 'Собери: {n} x Кремень', 'pick:grass': 'Срежь: {n} x Трава', 'pick:stone': 'Собери: {n} x Камень', fire: 'Разожги костёр', 'craft:knife': 'Изготовь: {n} x Нож', 'craft:axe': 'Изготовь: {n} x Топор', 'craft:pickaxe': 'Изготовь: {n} x Кирка', 'craft:chest': 'Построй сундук', 'craft:loom': 'Построй ткацкий станок', 'craft:purse': 'Изготовь: {n} x Кошелёк', 'craft:flask': 'Изготовь: {n} x Фляга', 'craft:torch': 'Изготовь: {n} x Факел', 'made:porridge': 'Свари кашу', chop: 'Руби деревья', mine: 'Разбей камни: {n}', cook: 'Приготовь блюд: {n}', night: 'Проживи ночей: {n}' } as Record<string, string>,
  forestQuestsTitle: 'Задания',
  forestDefaultQ: 'Задание по умолчанию',
  forestRegularQ: 'Обычные задания',
  forestQPending: 'В процессе',
  forestQClaim: 'Получить',
  forestQDone: 'Готово',
  forestQuestReady: 'Задание выполнено! Забери награду',
  forestCraftTabs: { tools: 'Инструмент', build: 'Постройки' } as Record<string, string>,
  forestCraftLevel: 'Изготовление предмета',
  forestOwned: (n: number) => `Владение: ${n}`,
  forestClose: 'Закрыть',
  forestPlaceHint: 'Выбери зелёную клетку для сундука. Нажми в другое место — отмена',
  forestPlaceOk: 'Поставить',
  forestCookTitle: 'Костёр',
  forestCookHint: 'Выбери еду в рюкзаке — она ляжет сюда',
  forestSleep: 'Спать',
  forestWake: 'Проснуться',
  forestRestart: 'Новый поход',
  forestRestartSure: 'Нажми ещё раз, чтобы начать новый поход',
  forestTreats: (n: number) => `${n}`,
  forestItems: { branch: 'Ветка', stone: 'Камень', flint: 'Кремень', grass: 'Трава', mushroom: 'Гриб', berries: 'Ягоды', cooked: 'Печёный гриб', axe: 'Топор', knife: 'Нож', pickaxe: 'Кирка', torch: 'Факел', flask: 'Фляга', fullflask: 'Фляга с водой', egg: 'Птичье яйцо', seeds: 'Семена', tea: 'Травяной чай', compote: 'Компот', porridge: 'Каша', berryporridge: 'Ягодная каша', friedegg: 'Яичница', cloth: 'Ткань', purse: 'Кошелёк', loom: 'Ткацкий станок', chest: 'Сундук' } as Record<string, string>,
  forestPlaces: { bush: 'Куст', water: 'Ручей', pit: 'Кострище', fire: 'Костёр', tree: 'Дерево', loom: 'Ткацкий станок', rock: 'Большой камень', chest: 'Сундук' } as Record<string, string>,
  forestDesc: {
    branch: 'Сухая ветка. Нужна для костра: 3 штуки, чтобы разжечь, и по одной, чтобы подкинуть.',
    stone: 'Обычный камень. Пригодится, чтобы смастерить инструменты.',
    flint: 'Кремень высекает искру — без него костёр не разжечь.',
    grass: 'Пучок сухой травы. Из неё плетут и мастерят.',
    mushroom: 'Лесной гриб. Сырым почти не насыщает — лучше испечь на костре.',
    berries: 'Сладкие ягоды с куста. Можно съесть сразу.',
    cooked: 'Гриб, испечённый на костре. Сытно и вкусно!',
    knife: 'Маленький нож. Им срезают траву.',
    cloth: 'Грубая ткань из травы. Нужна для кошелька.',
    purse: 'Кошелёк. Надень его в верхний слот рюкзака — получишь +4 ячейки.',
    loom: 'Ткацкий станок: ткёт ткань из травы и шьёт кошельки.',
    torch: 'Горящий факел освещает дорогу ночью и не даёт замёрзнуть. Хватает примерно на минуту.',
    flask: 'Пустая фляга. У ручья можно наполнить её водой.',
    fullflask: 'Фляга, полная воды. Выпей (+30 к воде) — фляга останется пустой — или добавь в блюдо.',
    egg: 'Птичье яйцо. Лучше пожарить на костре.',
    seeds: 'Семена трав. Из них варят кашу.',
    friedegg: 'Яичница, поджаренная на костре. Очень сытно.',
    tea: 'Травяной чай. Утоляет жажду, согревает и немного лечит.',
    compote: 'Сладкий компот из ягод. И сытно, и пить не хочется.',
    porridge: 'Горячая каша из семян. Сытная еда.',
    berryporridge: 'Каша с ягодами. Самая сытная еда в лесу.',
    pickaxe: 'Крепкая кирка. Ей разбивают большие камни.',
    axe: 'Острый топор. Им можно рубить деревья.',
    chest: 'Вместительный сундук у костра. Нажми на него, чтобы убрать или достать вещи.',
  } as Record<string, string>,
  forestActs: { pick: 'Собрать', chop: 'Срубить', drink: 'Попить', light: 'Зажечь', feed: 'Подкинуть ветку', cook: 'Приготовить', sleep: 'Спать', open: 'Открыть', fill: 'Набрать воду', mine: 'Разбить', cut: 'Срезать' } as Record<string, string>,
  forestThrow: 'Выбросить',
  forestFoodLine: (n: number) => `Сытость +${n}`,
  forestStatNames: { food: 'Сытость', water: 'Вода', warmth: 'Тепло', health: 'Здоровье' } as Record<string, string>,
  forestMsg: {
    picked: (item: string) => `+1 ${item}`,
    berries: '+2 ягоды',
    full: 'Рюкзак полон',
    drank: 'Вкусная вода!',
    ate: (item: string) => `Ням! ${item}`,
    empty: 'Ягод пока нет — вырастут утром',
    fireLit: 'Костёр горит! Подкидывай ветки',
    fireFed: 'Ветка в огне — гореть дольше',
    needForFire: 'Для костра нужны 3 ветки и кремень',
    needBranch: 'Нужна ветка, чтобы подкинуть в огонь',
    fireOut: 'Костёр погас',
    chopped: '+2 ветки: дерево срублено',
    crafted: (item: string) => `Готово: ${item}!`,
    needMaterials: 'Не хватает материалов',
    haveIt: 'Это уже есть',
    noPlace: 'Сюда сундук не поставить',
    questDone: (reward: number) => (reward > 0 ? `Награда получена! +${reward} лакомства` : 'Награда получена!'),
    needFlask: 'Нужна пустая фляга',
    filled: 'Фляга полная! Можно пить',
    found: (item: string) => `Повезло: ${item}!`,
    torchLit: 'Факел горит',
    torchOut: 'Факел догорел',
    worn: 'Кошелёк надет: рюкзак +4 ячейки',
    broke: 'Сломалось: {item}',
    noRoom: 'Сначала освободи место в рюкзаке',
    needKnife: 'Траву не срезать без ножа',
    needPickaxe: 'Камень не разбить без кирки',
    mined: '+3 камня: глыба разбита',
    cut: '+1 трава',
    needAxe: 'Дерево не срубить без топора',
    evening: 'Скоро ночь — разведи костёр',
    morning: (day: number, reward: number) => `Утро! День ${day}, +${reward} лакомства`,
    woke: 'Питомец проснулся',
    low: { food: 'Хочу есть', water: 'Хочу пить', warmth: 'Холодно…' } as Record<string, string>,
    sleepNo: 'Спать можно вечером и ночью у горящего костра',
    cooked: 'Гриб испёкся!',
    nothingToCook: 'Из этого ничего не выйдет',
    fellAsleep: 'Питомец уснул у костра',
    thrown: (item: string) => `Выброшено: ${item}`,
  },
  forestOverTitle: 'Поход окончен',
  forestOverText: (name: string, nights: number, treats: number) =>
    `${name} устал и вернулся домой. Прожито ночей: ${nights}, лакомств: ${treats}.`,
  forestNew: 'Новый поход',
  forestLeaveConfirm: 'Выйти? Поход сохранится.',
  soon: 'Скоро здесь появятся новые игры',
  rules: {
    region: '1 питомец на цвет',
    line: '1 в строке и столбце',
    touch: 'Не соприкасаются',
  },
  hint: 'Касание — крестик, проведи пальцем — несколько крестиков, двойное касание — питомец',
  progress: (placed: number, size: number) => `${placed}/${size}`,
  livesLabel: (n: number) => `Осталось сердечек: ${n}`,
  wrong: 'Здесь питомца быть не может',
  winTitle: 'Победа!',
  winText: (name: string, reward: number) => `${name} в восторге! Награда: +${reward} ${treatWord(reward)}.`,
  winButton: 'Забрать награду',
  loseTitle: 'Сердечки закончились',
  loseText: (name: string) => `Ничего страшного — ${name} всё равно повеселился.`,
  retry: 'Ещё раз',
  finish: 'Закончить',
  leaveConfirm: 'Выйти из игры? Прогресс не сохранится.',
  cell: (r: number, c: number, color: string) => `Строка ${r}, столбец ${c}, ${color} зона`,
  cellPet: 'питомец',
  cellCross: 'крестик',
  regionColors: ['розовая', 'жёлтая', 'голубая', 'мятная', 'сиреневая', 'коралловая', 'песочная', 'салатовая', 'лиловая', 'васильковая'] as readonly string[],
  earned: (n: number) => `+${n} ${treatWord(n)}!`,
};

const DEV_TEXT = {
  title: 'Режим тестирования',
  hint: 'Ускоряет время, чтобы быстро проверить вылупление, взросление, болезни и напоминания. После перезапуска приложения скорость снова ×1.',
  speed: 'Скорость времени',
  stats: 'Показатели питомца',
  hide: 'Скрыть режим тестирования',
  addPoop: '+1 какашка',
  enabled: 'Режим тестирования включён — он внизу настроек.',
  tapsLeft: (n: number) => `Ещё ${n} — и откроется режим тестирования`,
  animButton: 'Анимации',
  animOff: 'Обычное поведение',
  animStageOwn: 'Моя стадия',
  animStages: { baby: 'Малыш', child: 'Ребёнок', teen: 'Подросток', adultGood: 'Взрослый', elder: 'Старичок' } as Record<string, string>,
  animSpeciesOwn: 'Мой питомец',
  animSpecies: { cat: 'Кошечка', dog: 'Собачка', blob: 'Пушистик' } as Record<string, string>,
  animRows: {
    idle_smooth: 'Покой', walk: 'Ходьба', lie_wag: 'Лежит', roll: 'Кувырок', eat_side: 'Еда боком', catch: 'Ловит лакомство', sleep_twitch: 'Сон', sick: 'Грустит (болезнь, голод, усталость)',
  } as Record<string, string>,
  badge: (scale: number) => `×${scale}`,
  badgeLabel: (scale: number) => `Время ускорено в ${scale} раз. Нажмите, чтобы вернуть обычную скорость.`,
};

const SPECIES_LABELS: Record<Species, string> = {
  cat: 'Кошечка',
  dog: 'Собачка',
  blob: 'Пушистик',
};

const CARE_LABELS: Record<AdultForm, string> = {
  good: 'отличный',
  normal: 'нормальный',
  naughty: 'так себе',
};

const STAT_LABELS: Record<StatKey, string> = {
  hunger: 'Сытость',
  happiness: 'Счастье',
  energy: 'Энергия',
  health: 'Здоровье',
};

const ACTION_LABELS: Record<ActionType, string> = {
  feed: 'Покормить',
  snack: 'Лакомство',
  play: 'Поиграть',
  sleep: 'Спать',
  clean: 'Убрать',
  medicine: 'Лекарство',
};

const WAKE_LABEL = 'Разбудить';

const STAGE_LABELS: Record<LifeStage, string> = {
  egg: 'яйцо',
  baby: 'малыш',
  child: 'ребёнок',
  teen: 'подросток',
  adult: 'взрослый',
  elder: 'старость',
  dead: 'умер',
};

const FORM_LABELS: Record<AdultForm, string> = {
  good: 'хороший',
  normal: 'обычный',
  naughty: 'вредный',
};

const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Доволен жизнью',
  normal: 'Всё нормально',
  sad: 'Чего-то не хватает',
  sick: 'Болеет',
  sleeping: 'Спит',
  dead: 'Умер',
};

const CAUSE_LABELS: Record<CauseOfDeath, string> = {
  hunger: 'голод',
  sickness: 'болезнь',
  neglect: 'плохой уход',
  oldAge: 'старость',
};

const BLOCK_REASONS: Record<ActionBlockReason, string> = {
  noPet: 'Сначала заведи питомца.',
  egg: 'Питомец ещё не вылупился.',
  dead: 'Питомец умер.',
  sleeping: 'Питомец спит.',
  sick: 'Питомец болеет и не хочет играть.',
  cooldown: 'Подожди пару секунд.',
  noTreats: 'Нет лакомств — заработай в «Поиграть»!',
  clean: 'Убирать нечего — всё чисто.',
  healthy: 'Питомец здоров — лекарство не нужно.',
};

const EVENT_MESSAGES = {
  hatched: (name: string) => `${name} вылупился!`,
  grew: (name: string, stage: LifeStage) => `${name} подрос: теперь ${STAGE_LABELS[stage]}.`,
  gotSick: (name: string) => `${name} заболел. Дай лекарство.`,
  recovered: (name: string) => `${name} выздоровел.`,
  fellAsleepAuto: (name: string) => `${name} уснул от усталости.`,
  wokeUpAuto: (name: string) => `${name} выспался и проснулся.`,
};

function absenceNoteText(name: string, note: AbsenceNote): string {
  switch (note.kind) {
    case 'hatched':
      return `${name} вылупился`;
    case 'grew':
      return `${name} подрос до стадии «${STAGE_LABELS[note.stage]}»`;
    case 'gotSick':
      return `${name} заболел`;
    case 'sleeping':
      return `${name} сейчас спит`;
    case 'hungry':
      return `${name} проголодался`;
    case 'dirty':
      return `${name} насорил — на полу ${note.poops} ${poopWord(note.poops)}`;
    case 'pooped':
      return `${name} насорил (${note.poops} ${poopWord(note.poops)})`;
    case 'bored':
      return `${name} заскучал`;
    case 'died':
      return `${name} не дождался тебя`;
  }
}

/** «полоса / полосы / полос» по числу. */
function lineWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'полоса';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'полосы';
  return 'полос';
}

/** «какашка / какашки / какашек» по числу. */
function poopWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'какашка';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'какашки';
  return 'какашек';
}

const POOP_TEXT = {
  label: 'Уборка',
  clean: 'чисто',
  count: (n: number) => `${n} ${poopWord(n)} на полу`,
  pooped: (name: string) => `${name} насорил. Пора убрать!`,
};

function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  return `${Math.max(minutes, 0)} мин`;
}

export const ru = {
  T,
  ATTENTION_TEXT,
  ATTENTION_SHORT,
  SETTINGS_TEXT,
  treatWord,
  GAMES_TEXT,
  DEV_TEXT,
  SPECIES_LABELS,
  CARE_LABELS,
  STAT_LABELS,
  ACTION_LABELS,
  WAKE_LABEL,
  STAGE_LABELS,
  FORM_LABELS,
  MOOD_LABELS,
  CAUSE_LABELS,
  BLOCK_REASONS,
  EVENT_MESSAGES,
  absenceNoteText,
  poopWord,
  POOP_TEXT,
  formatDuration,
};

export type Dict = typeof ru;
