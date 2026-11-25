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

const iconMoon = sprite([
  '..###.',
  '.##...',
  '##....',
  '##....',
  '##....',
  '.##...',
  '..###.',
]);

export const SPRITES = {
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
} as const satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;
