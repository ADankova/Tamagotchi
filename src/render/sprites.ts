// Пиксельная графика в виде текстовых карт — без файлов-картинок.
// Все персонажи и предметы оригинальные.
//
// Символы:
//   .  прозрачный
//   #  контур (тёмный)
//   +  тень (средний тон)
//   o  заливка (светлый)
//   e  глаз: тёмный, а при закрытых глазах — цвет тени

export type PixelChar = '.' | '#' | '+' | 'o' | 'e';

export interface Sprite {
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

function sprite(rows: readonly string[]): Sprite {
  return { w: rows[0]?.length ?? 0, h: rows.length, rows };
}

// --- Питомец по стадиям ---

const egg = sprite([
  '.....###.....',
  '...##ooo##...',
  '..#ooooooo#..',
  '.#ooooooooo#.',
  '.#oo+ooo+oo#.',
  '#ooooooooooo#',
  '#oooo+++oooo#',
  '#ooooooooooo#',
  '#o+ooooooo+o#',
  '#ooooooooooo#',
  '#oooo+o+oooo#',
  '.#ooooooooo#.',
  '.#ooooooooo#.',
  '..##ooooo##..',
  '....#####....',
]);

const eggCracked = sprite([
  '.....###.....',
  '...##ooo##...',
  '..#ooooooo#..',
  '.#ooooooooo#.',
  '.#oo+ooo+oo#.',
  '#ooooooooooo#',
  '#o#ooo#ooo#o#',
  '##o#o#o#o#o##',
  '#ooo#ooo#ooo#',
  '#ooooooooooo#',
  '#oooo+o+oooo#',
  '.#ooooooooo#.',
  '.#ooooooooo#.',
  '..##ooooo##..',
  '....#####....',
]);

const ghost = sprite([
  '...#####...',
  '.##ooooo##.',
  '#ooooooooo#',
  '#ooeoooeoo#',
  '#ooooooooo#',
  '#oooo+oooo#',
  '#ooooooooo#',
  '#ooooooooo#',
  '#o#ooooo#o#',
  '##.#ooo#.##',
  '#...###...#',
]);

const baby = sprite([
  '...#####...',
  '..#ooooo#..',
  '.#ooooooo#.',
  '#ooeoooeoo#',
  '#ooooooooo#',
  '#oo+ooo+oo#',
  '#oooo#oooo#',
  '.#ooooooo#.',
  '..#######..',
]);

const child = sprite([
  '....#####....',
  '..##ooooo##..',
  '.#ooooooooo#.',
  '.#ooeoooeoo#.',
  '#ooooooooooo#',
  '#oo+ooooo+oo#',
  '#ooooo#ooooo#',
  '#ooooooooooo#',
  '.#ooooooooo#.',
  '..##ooooo##..',
  '...##...##...',
]);

const teen = sprite([
  '..#.........#..',
  '..##.......##..',
  '..#o#######o#..',
  '.#ooooooooooo#.',
  '#ooooooooooooo#',
  '#oooeoooooeooo#',
  '#oooeoooooeooo#',
  '#oo+ooooooo+oo#',
  '#ooooo###ooooo#',
  '#ooooooooooooo#',
  '.#ooooooooooo#.',
  '..#ooooooooo#..',
  '...###...###...',
  '..####...####..',
]);

const adultGood = sprite([
  '........#........',
  '.......#o#.......',
  '......#####......',
  '....##ooooo##....',
  '...#ooooooooo#...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '.#oooeoooooeooo#.',
  '#ooooeoooooeoooo#',
  '#ooo+ooooooo+ooo#',
  '#ooooo#ooo#ooooo#',
  '#oooooo###oooooo#',
  '.#ooooooooooooo#.',
  '..#ooooooooooo#..',
  '...##ooooooo##...',
  '.....#######.....',
  '....##.....##....',
]);

const adultNormal = sprite([
  '.................',
  '......#...#......',
  '......#####......',
  '....##ooooo##....',
  '...#ooooooooo#...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '.#oooeoooooeooo#.',
  '#ooooeoooooeoooo#',
  '#ooo+ooooooo+ooo#',
  '#oooooo###oooooo#',
  '#ooooooooooooooo#',
  '.#ooooooooooooo#.',
  '..#ooooooooooo#..',
  '...##ooooooo##...',
  '.....#######.....',
  '....##.....##....',
]);

const adultNaughty = sprite([
  '...#.........#...',
  '...##.......##...',
  '....##.###.##....',
  '....##ooooo##....',
  '...#ooooooooo#...',
  '..#ooooooooooo#..',
  '.#oo#ooooooo#oo#.',
  '.#oooeoooooeooo#.',
  '#ooooeoooooeoooo#',
  '#ooo+ooooooo+ooo#',
  '#oooooo###oooooo#',
  '#ooooo#ooo#ooooo#',
  '.#ooooooooooooo#.',
  '..#ooooooooooo#..',
  '...##ooooooo##...',
  '.....#######.....',
  '....##.....##....',
]);

const elder = sprite([
  '.................',
  '.................',
  '......#####......',
  '....##ooooo##....',
  '...#ooooooooo#...',
  '..#ooooooooooo#..',
  '.#oo###ooo###oo#.',
  '.#oooeoooooeooo#.',
  '#ooooooooooooooo#',
  '#ooo+ooooooo+ooo#',
  '#oooooo###oooooo#',
  '#ooooo+++++ooooo#',
  '#oooo+++++++oooo#',
  '.#ooo+++++++ooo#.',
  '..#ooo+++++ooo#..',
  '...##oo+++oo##...',
  '.....#######.....',
  '....##.....##....',
]);

const grave = sprite([
  '....#####....',
  '..##ooooo##..',
  '.#ooooooooo#.',
  '.#oooo#oooo#.',
  '.#ooo###ooo#.',
  '.#oooo#oooo#.',
  '.#oooo#oooo#.',
  '.#ooooooooo#.',
  '.#oo+++++oo#.',
  '.#ooooooooo#.',
  '.#oo+++++oo#.',
  '.#ooooooooo#.',
  '#############',
  '#+++++++++++#',
  '#############',
]);

// ================= Кошка и собака =================
// Тела симметричны; хвост — отдельный спрайт в двух кадрах (виляет).

const catBaby = sprite([
  '.#.......#.',
  '.##.....##.',
  '.#+#####+#.',
  '#ooooooooo#',
  '#ooeoooeoo#',
  '#oooo+oooo#',
  '#ooo#o#ooo#',
  '.#ooooooo#.',
  '..#######..',
]);

const catChild = sprite([
  '..#.......#..',
  '..##.....##..',
  '..#+#####+#..',
  '.#ooooooooo#.',
  '#ooooooooooo#',
  '#ooeoooooeoo#',
  '#ooooooooooo#',
  '#ooooo+ooooo#',
  '#oooo#o#oooo#',
  '.#ooooooooo#.',
  '..#ooooooo#..',
  '..#o#ooo#o#..',
  '..###...###..',
]);

const catTeen = sprite([
  '.#...........#.',
  '.##.........##.',
  '.#+#.......#+#.',
  '.#++#######++#.',
  '#ooooooooooooo#',
  '#ooooooooooooo#',
  '#ooeeoooooeeoo#',
  '#ooooooooooooo#',
  '#oooooo+oooooo#',
  '#ooooo#o#ooooo#',
  '.#ooooooooooo#.',
  '..#ooooooooo#..',
  '..#o#ooooo#o#..',
  '..###.....###..',
]);

const catAdultGood = sprite([
  '.#.............#.',
  '.##...........##.',
  '.#+#.........#+#.',
  '.#++#########++#.',
  '#ooooooooooooooo#',
  '#ooooooooooooooo#',
  '#oooeoooooooeooo#',
  '#oooeoooooooeooo#',
  '#oo++ooooooo++oo#',
  '#ooooooo+ooooooo#',
  '#ooooo#o#o#ooooo#',
  '.#ooooooooooooo#.',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const catAdultNormal = sprite([
  '.#.............#.',
  '.##...........##.',
  '.#+#.........#+#.',
  '.#++#########++#.',
  '#ooooooooooooooo#',
  '#ooooooooooooooo#',
  '#oooeoooooooeooo#',
  '#oooeoooooooeooo#',
  '#ooooooooooooooo#',
  '#ooooooo+ooooooo#',
  '#oooooo#o#oooooo#',
  '.#ooooooooooooo#.',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const catAdultNaughty = sprite([
  '.#.............#.',
  '.##...........##.',
  '.#+#.........#+#.',
  '.#++#########++#.',
  '#ooo#ooooooo#ooo#',
  '#oooo#ooooo#oooo#',
  '#oooeoooooooeooo#',
  '#oooeoooooooeooo#',
  '#ooooooooooooooo#',
  '#ooooooo+ooooooo#',
  '#ooooooo#ooooooo#',
  '.#oooo#ooo#oooo#.',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const catElder = sprite([
  '.#.............#.',
  '.##...........##.',
  '.#+#.........#+#.',
  '.#++#########++#.',
  '#ooooooooooooooo#',
  '#ooooooooooooooo#',
  '#ooo##ooooo##ooo#',
  '#oooeoooooooeooo#',
  '#ooooooooooooooo#',
  '#ooooooo+ooooooo#',
  '#oooooo#o#oooooo#',
  '.#oooo+++++oooo#.',
  '..#oooo+++oooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const catTailA = sprite([
  '....#.',
  '...#o#',
  '...#o#',
  '..#o#.',
  '.#o#..',
  '#o#...',
  '##....',
]);

const catTailB = sprite([
  '..#...',
  '.#o#..',
  '.#o#..',
  '.#o#..',
  '.#o#..',
  '#o#...',
  '##....',
]);

// --- Собака ---

const dogBaby = sprite([
  '..#######..',
  '.#ooooooo#.',
  '#+ooooooo+#',
  '#+oeoooeo+#',
  '#+ooo#ooo+#',
  '.#oo#o#oo#.',
  '.#ooooooo#.',
  '..#######..',
]);

const dogChild = sprite([
  '...#######...',
  '..#ooooooo#..',
  '.#ooooooooo#.',
  '#+#ooooooo#+#',
  '#+#oeoooeo#+#',
  '#+#ooooooo#+#',
  '#+#oo###oo#+#',
  '.##ooo#ooo##.',
  '..#ooooooo#..',
  '..#ooooooo#..',
  '..#o#ooo#o#..',
  '..###...###..',
]);

const dogTeen = sprite([
  '....#######....',
  '..##ooooooo##..',
  '.#ooooooooooo#.',
  '#+#ooooooooo#+#',
  '#++#ooooooo#++#',
  '#++#eoooooe#++#',
  '#++#ooooooo#++#',
  '#+#ooo###ooo#+#',
  '.##oooo#oooo##.',
  '..#ooo#o#ooo#..',
  '..#ooooooooo#..',
  '..#oo#ooo#oo#..',
  '..#oo#...#oo#..',
  '..####...####..',
]);

const dogAdultGood = sprite([
  '.....#######.....',
  '...##ooooooo##...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '#+#ooooooooooo#+#',
  '#++#ooooooooo#++#',
  '#++#oeoooooeo#++#',
  '#++#ooooooooo#++#',
  '#++#ooo###ooo#++#',
  '.##ooooo#ooooo##.',
  '..#ooo#ooo#ooo#..',
  '..#oooo#+#oooo#..',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const dogAdultNormal = sprite([
  '.....#######.....',
  '...##ooooooo##...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '#+#ooooooooooo#+#',
  '#++#ooooooooo#++#',
  '#++#oeoooooeo#++#',
  '#++#ooooooooo#++#',
  '#++#ooo###ooo#++#',
  '.##ooooo#ooooo##.',
  '..#oooo#o#oooo#..',
  '..#ooooooooooo#..',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const dogAdultNaughty = sprite([
  '.....#######.....',
  '...##ooooooo##...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '#+#o#ooooooo#o#+#',
  '#++#o#ooooo#o#++#',
  '#++#oeoooooeo#++#',
  '#++#ooooooooo#++#',
  '#++#ooo###ooo#++#',
  '.##ooooo#ooooo##.',
  '..#oooo###oooo#..',
  '..#ooo#ooo#ooo#..',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const dogElder = sprite([
  '.....#######.....',
  '...##ooooooo##...',
  '..#ooooooooooo#..',
  '.#ooooooooooooo#.',
  '#+#ooooooooooo#+#',
  '#++#o##ooo##o#++#',
  '#++#oeoooooeo#++#',
  '#++#ooooooooo#++#',
  '#++#ooo###ooo#++#',
  '.##oooo+#+oooo##.',
  '..#ooooo+ooooo#..',
  '..#ooooooooooo#..',
  '..#ooooooooooo#..',
  '..#oo#ooooo#oo#..',
  '..#oo#.....#oo#..',
  '..####.....####..',
]);

const dogTailA = sprite([
  '...##',
  '..#o#',
  '.#o#.',
  '#o#..',
  '##...',
]);

const dogTailB = sprite([
  '.....',
  '...##',
  '.##o#',
  '#oo#.',
  '###..',
]);

// --- Предметы и эффекты ---

const bowl = sprite([
  '..#.#.#.',
  '.#.#.#..',
  '..####..',
  '.#oooo#.',
  '########',
  '#++++++#',
  '.#++++#.',
  '..####..',
]);

const candy = sprite([
  '##.###.##',
  '#o#ooo#o#',
  '##.###.##',
]);

const ball = sprite([
  '..###..',
  '.#ooo#.',
  '#oo+oo#',
  '#o+++o#',
  '#oo+oo#',
  '.#ooo#.',
  '..###..',
]);

const poop = sprite([
  '...#...',
  '..#+#..',
  '.#+++#.',
  '.#+++#.',
  '#+++++#',
  '#######',
]);

const poopSmall = sprite([
  '..#..',
  '.#+#.',
  '#+++#',
  '#####',
]);

const zed = sprite([
  '####',
  '..#.',
  '.#..',
  '####',
]);

const skull = sprite([
  '.###.',
  '#####',
  '#.#.#',
  '#####',
  '.#.#.',
]);

const heart = sprite([
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]);

const bubble = sprite([
  '.#.',
  '#.#',
  '.#.',
]);

const sparkle = sprite([
  '..#..',
  '..#..',
  '##.##',
  '..#..',
  '..#..',
]);

const pill = sprite([
  '.######.',
  '#ooo+++#',
  '#ooo+++#',
  '.######.',
]);

const tear = sprite([
  '.#.',
  '#+#',
  '.#.',
]);

// --- Иконки интерфейса (только контур) ---

const iconHunger = sprite([
  '....##.',
  '...####',
  '..#####',
  '.#####.',
  '###....',
  '.#.....',
  '#......',
]);

const iconBolt = sprite([
  '...##.',
  '..##..',
  '.##...',
  '#####.',
  '..##..',
  '.##...',
  '##....',
  '#.....',
]);

const iconDrop = sprite([
  '..#..',
  '..#..',
  '.###.',
  '#####',
  '#####',
  '#####',
  '.###.',
]);

const iconCross = sprite([
  '..###..',
  '..###..',
  '#######',
  '#######',
  '#######',
  '..###..',
  '..###..',
]);

const iconGear = sprite([
  '...###...',
  '.#.###.#.',
  '..#####..',
  '####.####',
  '###...###',
  '####.####',
  '..#####..',
  '.#.###.#.',
  '...###...',
]);

const iconMoon = sprite([
  '..###.',
  '.##...',
  '##....',
  '##....',
  '##....',
  '.##...',
  '..###.',
]);

const RAW_SPRITES = {
  egg,
  eggCracked,
  ghost,
  baby,
  child,
  teen,
  adultGood,
  adultNormal,
  adultNaughty,
  elder,
  grave,
  bowl,
  candy,
  ball,
  poop,
  poopSmall,
  zed,
  skull,
  heart,
  bubble,
  sparkle,
  pill,
  tear,
  iconHunger,
  iconBolt,
  iconDrop,
  iconCross,
  iconMoon,
  iconGear,
  catBaby,
  catChild,
  catTeen,
  catAdultGood,
  catAdultNormal,
  catAdultNaughty,
  catElder,
  catTailA,
  catTailB,
  dogBaby,
  dogChild,
  dogTeen,
  dogAdultGood,
  dogAdultNormal,
  dogAdultNaughty,
  dogElder,
  dogTailA,
  dogTailB,
} as const satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof RAW_SPRITES;

/** Питомцы нарисованы крупнее прежнего: коробка, в которой они ходят, больше в этой же пропорции. */
export const PET_SCALE = 1.5;

const PET_BODIES = [
  'baby', 'child', 'teen', 'adultGood', 'adultNormal', 'adultNaughty', 'elder',
  'catBaby', 'catChild', 'catTeen', 'catAdultGood', 'catAdultNormal', 'catAdultNaughty', 'catElder',
  'dogBaby', 'dogChild', 'dogTeen', 'dogAdultGood', 'dogAdultNormal', 'dogAdultNaughty', 'dogElder',
] as const satisfies readonly SpriteName[];

export const SPRITES: Readonly<Record<SpriteName, Sprite>> = {
  ...RAW_SPRITES,
  ...Object.fromEntries(
    PET_BODIES.map((name) => {
      const raw: Sprite = RAW_SPRITES[name];
      return [name, { ...raw, w: Math.round(raw.w * PET_SCALE), h: Math.round(raw.h * PET_SCALE) }] as const;
    }),
  ),
};
