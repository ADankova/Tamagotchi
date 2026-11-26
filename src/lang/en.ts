import { M3_MOVES } from '../core/match3';
import { PET_PICTURE_NAMES } from '../core/mosaicPictures';
import { DAY, HOUR, MINUTE } from '../core/config';
import type { Dict } from './ru';

// English UI texts. Same shape as ru.ts — the compiler checks that nothing is missing.

const STAGE_LABELS: Dict['STAGE_LABELS'] = {
  egg: 'egg',
  baby: 'baby',
  child: 'child',
  teen: 'teen',
  adult: 'adult',
  elder: 'elder',
  dead: 'passed away',
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function treatWord(n: number): string {
  return plural(n, 'treat', 'treats');
}

function poopWord(n: number): string {
  return plural(n, 'poop', 'poops');
}

export const en: Dict = {
  T: {
    title: 'Tamagotchi',
    intro: 'Adopt a pet and take care of it. It keeps growing even when the app is closed.',
    chooseSpecies: 'Who will hatch?',
    nameLabel: "Pet's name",
    namePlaceholder: 'For example, Fluffy',
    nameRequired: 'Give your pet a name.',
    name: 'Name',
    newGame: 'New game',
    newEgg: 'New egg',
    age: 'Age',
    stage: 'Stage',
    cause: 'Cause',
    resultsTitle: 'Your pet has passed away',
    graveyard: 'Memorial',
    settings: 'Settings',
    reset: 'Reset save',
    resetConfirm: 'Delete the pet, the Memorial and all settings? This cannot be undone.',
    corrupted: 'The save was damaged, so a new game was started.',
    saveFailed: 'Could not save the game: the browser does not allow writing to storage.',
    absenceTitle: (time: string) => `While you were away (${time}):`,
    absenceNothing: 'all quiet.',
    dismiss: 'Got it',
    debug: 'Debug',
    speed: 'Time speed',
    care: 'Care',
    sicknesses: 'Illnesses',
    back: 'Back',
    memoryIntro: 'A place to remember all your pets.',
    memoryEmpty: 'Nobody here yet.',
    memoryCount: (n: number) => `Pets in total: ${n}`,
    memoryRecord: (name: string, age: string) => `${name} lived the longest — ${age}`,
    lived: 'lived',
    diedOn: (date: string) => `passed away ${date}`,
    diedWhileAway: (name: string) => `${name} could not wait for you.`,
    testNotification: 'Test: reminders work. Time to go back to your pet!',
    openMemory: (n: number) => (n > 0 ? `Memorial (${n})` : 'Memorial'),
  },
  ATTENTION_TEXT: {
    hatch: (name) => `${name} hatched! Come and say hi.`,
    hungry: (name) => `${name} is hungry.`,
    dirty: (name) => `${name} made a mess — time to clean up.`,
    bored: (name) => `${name} misses you.`,
    sick: (name) => `${name} is sick. Medicine needed.`,
    dying: (name) => `${name} feels very bad!`,
  },
  ATTENTION_SHORT: {
    hatch: 'hatching',
    hungry: 'hunger',
    dirty: 'mess',
    bored: 'boredom',
    sick: 'illness',
    dying: 'poor health',
  },
  SETTINGS_TEXT: {
    title: 'Settings',
    sound: 'Sound',
    soundHint: '8-bit sounds for actions and events.',
    notifications: 'Reminders',
    notificationsHint: 'We will let you know when your pet needs care.',
    notificationsDenied: 'Notifications are blocked. Allow them in phone settings: Apps → Tamagotchi → Notifications.',
    notificationsUnsupported: 'This browser cannot show notifications.',
    notificationsWeb: 'In a browser, reminders only arrive while the tab is open.',
    testButton: 'Test notification',
    testSent: 'A test notification will arrive in 5 seconds. You can minimise the app.',
    testFailed: 'Failed: notifications are not allowed.',
    lastReminder: (time: string, what: string) => `Last reminder was scheduled for ${time} (${what}).`,
    language: 'Language',
    languageHint: 'Interface language. The game restarts, your progress is kept.',
    data: 'Data',
    version: (v: string) => `Version ${v}`,
  },
  treatWord,
  GAMES_TEXT: {
    menuTitle: 'Mini-games',
    menuIntro: 'Play with your pet and earn treats.',
    close: 'Close',
    rulesButton: (game: string) => `Rules of “${game}”`,
    favourite: (game: string, on: boolean) => (on ? `Remove “${game}” from favourites` : `Add “${game}” to favourites`),
    queensTitle: 'Pet Sudoku',
    queensAbout: 'Place the pets: exactly one in every row, column and colour zone. Pets must not touch each other — not even diagonally.',
    level: (size: number, reward: number) => `${size}×${size} · +${reward} ${treatWord(reward)}`,
    levelNames: ['Easy', 'Medium', 'Hard'],
    stats: (played: number, won: number) => `Played: ${played} · Won: ${won}`,
    slideTitle: 'Pet Blocks',
    slideAbout:
      'Drag blocks left and right. Fill a row completely and it disappears. Clear a block with a treat and the treat is yours. Two modes: in Avalanche a new row falls from the top after every move, in Tide it grows from the bottom and lifts the stack. Blocks can carry bonuses: freeze (3 moves without new rows), lightning (removes the blocks touching it above and below) and crumbs (break blocks inside a 3×3 area). Do not let the stack reach the top!',
    slidePlay: 'Play',
    slideModeName: { fall: 'Avalanche', rise: 'Tide' },
    slideModeInfo: { fall: 'Blocks fall from the top', rise: 'Blocks grow from the bottom' },
    slideStats: (played: number, best: number) => `Played: ${played} · Best: ${best} ${plural(best, 'row', 'rows')}`,
    slideLines: (n: number) => `${n} ${plural(n, 'row', 'rows')}`,
    slideTreats: (n: number) => `Treats: ${n}`,
    slideNext: { fall: 'Falls next', rise: 'Grows next' },
    slideHint: 'Drag a block left or right',
    slideOverTitle: 'The stack reached the top!',
    slideOverText: (name: string, lines: number, treats: number) =>
      treats > 0
        ? `${lines} ${plural(lines, 'row', 'rows')} cleared. ${name} gets ${treats} ${treatWord(treats)}!`
        : `${lines} ${plural(lines, 'row', 'rows')} cleared. ${name} had a great time.`,
    slideRecord: 'New record!',
    slideResumed: 'Game resumed where you left off.',
    slideLeaveConfirm: 'Finish the game? The treats you collected are already yours.',
    slideFreeze: 'Freeze',
    slideFreezeEmpty: 'No freeze',
    slideCrumbsEmpty: 'No crumbs',
    slideCrumbs: 'Crumbs',
    slideFrozen: (n: number) => `Frozen: ${n} ${plural(n, 'move', 'moves')}`,
    slideBonusGot: { freeze: 'Freeze saved!', crumbs: 'Crumbs saved!', lightning: 'Lightning!' },
    slideNoCrumbTarget: 'Nothing for the crumbs to break',
    slideBonusHint: 'Bonuses on blocks: freeze, lightning, crumbs',
    slideBlock: (row: number, col: number, len: number) => `Block: row ${row}, cells ${col}–${col + len - 1}`,
    mosaicTitle: 'Pet Thieves',
    mosaicAbout:
      'A picture made of coloured cubes. Tap a jar: it moves into a slot and your pet starts carrying cubes of its colour to the burrow, as many as the number says. Only exposed cubes can be carried: at the edge or next to an empty spot. Clear the whole picture before the slots fill up with jars that have nothing to carry. Jars joined by a tube are taken together (you need two free slots) and leave the slots together: an empty one waits for its partner.',
    mosaicLevel: 'Random picture',
    mosaicPicture: { heart: 'Heart', ...Object.fromEntries(Object.entries(PET_PICTURE_NAMES).map(([k, v]) => [k, v.en])) } as Record<string, string>,
    mosaicInfo: (reward: number) => `Small picture · +${reward} ${plural(reward, 'treat', 'treats')}`,
    mosaicStats: (played: number, won: number) => `Played: ${played} · Won: ${won}`,
    mosaicLeft: (n: number) => `Cubes: ${n}`,
    mosaicSpeed: (n: number) => `Speed ×${n}`,
    mosaicHint: 'Tap the jars below',
    mosaicJar: (n: number) => `Jar, ${n}`,
    mosaicWinTitle: 'Picture complete!',
    mosaicWinText: (name: string, reward: number) => `${name} carried every cube and gets ${reward} ${plural(reward, 'treat', 'treats')}!`,
    mosaicStuckTitle: 'The jars are stuck',
    mosaicStuckText: (name: string) => `All slots are taken and ${name} has nothing to carry. Try again?`,
    mosaicLeaveConfirm: 'Finish the game? The picture will not be saved.',
    harborTitle: 'Pet Bay',
    harborAbout:
      'Islands with pets float up from below. Tap a pet and it sails to the ship of its kind. If there is no such ship yet, the pet waits on the pier and hops aboard when one arrives. Each ship needs three of the same kind. If the pier is full and nobody can be sent, you are stuck. Some islands carry bonuses: clear every pet off the island to get one. The net fishes out the pet kind that has the most on the ships. Clear moves the pier pets to the shared block beside it. Shuffle rearranges the pets on the islands. Some islands hold treats: clear the island to get one. The round is saved when you leave.',
    harborBonusName: { net: 'Net', clear: 'Clear', shuffle: 'Shuffle' } as Record<'net' | 'clear' | 'shuffle', string>,
    harborLevel: 'Quiet bay',
    harborInfo: () => 'Three ships · treats on the islands',
    harborStats: (played: number, won: number) => `Played: ${played} · Won: ${won}`,
    harborLeft: (n: number) => `Pets left: ${n}`,
    harborHint: 'Tap the pets on the islands',
    harborPet: 'Pet',
    harborWinTitle: 'All aboard!',
    harborWinText: (name: string) => `${name} sent every pet sailing!`,
    harborStuckTitle: 'The pier is full',
    harborStuckText: (name: string) => `The pier is full and ${name} has nobody to send. Try again?`,
    harborLeaveConfirm: 'Finish the game? The round will not be saved.',
    harborTreats: (n: number) => `Treats: ${n}`,
    match3Title: 'Match Three',
    match3About:
      'Swap neighbouring pets: three or more in a row or column vanish and the ones above fall down. Four in a row makes a line bonus that clears its row or column (tap it). A 2×2 square, or a T or L of five, makes a bomb that clears everything within 3 cells. Five in a row or a plus-shaped cross makes a rainbow: swap it with a neighbour to clear every pet of that kind. Reach the score before you run out of moves.',
    match3Level: 'Limited moves',
    match3Info: (reward: number) => `Score points in ${M3_MOVES} moves · +${reward} treat${reward === 1 ? '' : 's'}`,
    match3Stats: (played: number, won: number, best: number) => `Played: ${played} · Won: ${won} · Best: ${best}`,
    match3Moves: (n: number) => `Moves: ${n}`,
    match3Score: (score: number, goal: number) => `Score: ${score} / ${goal}`,
    match3Hint: 'Swap neighbouring pets or tap a bonus',
    match3Tile: 'Pet',
    match3Special: { row: 'Row bonus', col: 'Column bonus', bomb: 'Bomb', rainbow: 'Rainbow' } as Record<'row' | 'col' | 'bomb' | 'rainbow', string>,
    match3Legend: {
      title: 'What you get',
      threeTitle: '3 or more in a row',
      threeText: 'pets vanish, new ones fall in',
      rowTitle: '4 in a row, horizontal',
      rowText: 'row bonus: clears its whole row',
      colTitle: '4 in a row, vertical',
      colText: 'column bonus: clears its whole column',
      bombTitle: '2×2 square, T or L',
      bombText: 'bomb: clears everything within 3 cells',
      rainbowTitle: '5 in a row or a plus cross',
      rainbowText: 'rainbow: swap with a neighbour to clear every pet of its kind',
      tip: 'Just tap a row, column or bomb bonus. Two swapped rainbows clear the whole board. A bonus inside a matched line goes off by itself.',
    },
    match3Shuffle: 'No moves left — the pets were shuffled',
    match3WinTitle: 'Goal reached!',
    match3WinText: (name: string, score: number, reward: number) => `${name} scored ${score} and gets ${reward} treat${reward === 1 ? '' : 's'}!`,
    match3LoseTitle: 'Out of moves',
    match3LoseText: (name: string, score: number, goal: number) => `Scored ${score} of ${goal}. ${name} is sure you can do better!`,
    match3LeaveConfirm: 'Finish the game? The round will not be saved.',
    soon: 'More games coming soon',
    rules: {
      region: '1 pet per colour',
      line: '1 per row and column',
      touch: 'No touching',
    },
    hint: 'Tap — cross, swipe — several crosses, double tap — pet',
    progress: (placed: number, size: number) => `${placed}/${size}`,
    livesLabel: (n: number) => `Hearts left: ${n}`,
    wrong: 'A pet cannot go here',
    winTitle: 'You won!',
    winText: (name: string, reward: number) => `${name} is thrilled! Reward: +${reward} ${treatWord(reward)}.`,
    winButton: 'Collect reward',
    loseTitle: 'Out of hearts',
    loseText: (name: string) => `No worries — ${name} still had fun.`,
    retry: 'Try again',
    finish: 'Finish',
    leaveConfirm: 'Leave the game? Progress will not be saved.',
    cell: (r: number, c: number, color: string) => `Row ${r}, column ${c}, ${color} zone`,
    cellPet: 'pet',
    cellCross: 'cross',
    regionColors: ['pink', 'yellow', 'blue', 'mint', 'lilac', 'coral', 'sand', 'lime', 'purple', 'cornflower'],
    earned: (n: number) => `+${n} ${treatWord(n)}!`,
  },
  DEV_TEXT: {
    title: 'Test mode',
    hint: 'Speeds up time so you can quickly check hatching, growing up, illness and reminders. After the app restarts the speed is ×1 again.',
    speed: 'Time speed',
    stats: 'Pet stats',
    hide: 'Hide test mode',
    addPoop: '+1 poop',
    enabled: 'Test mode is on — it is at the bottom of Settings.',
    tapsLeft: (n: number) => `${n} more to open test mode`,
    animButton: 'Animations',
    animOff: 'Normal behaviour',
    animStageOwn: 'My stage',
    animStages: { baby: 'Baby', child: 'Child', teen: 'Teen', adultGood: 'Adult', elder: 'Elder' } as Record<string, string>,
    animSpeciesOwn: 'My pet',
    animSpecies: { cat: 'Cat', dog: 'Dog', blob: 'Fluffy' } as Record<string, string>,
    animRows: {
      idle_smooth: 'Idle', walk: 'Walk', lie_wag: 'Lying', roll: 'Roll', eat_side: 'Eat (side)', catch: 'Catches treat', sleep_twitch: 'Sleep', sick: 'Sad (sick, hungry, tired)',
    } as Record<string, string>,
    badge: (scale: number) => `×${scale}`,
    badgeLabel: (scale: number) => `Time is sped up ${scale} times. Tap to return to normal speed.`,
  },
  SPECIES_LABELS: {
    cat: 'Kitty',
    dog: 'Puppy',
    blob: 'Fluffy',
  },
  CARE_LABELS: {
    good: 'excellent',
    normal: 'fine',
    naughty: 'so-so',
  },
  STAT_LABELS: {
    hunger: 'Fullness',
    happiness: 'Happiness',
    energy: 'Energy',
    health: 'Health',
  },
  ACTION_LABELS: {
    feed: 'Feed',
    snack: 'Treat',
    play: 'Play',
    sleep: 'Sleep',
    clean: 'Clean',
    medicine: 'Medicine',
  },
  WAKE_LABEL: 'Wake up',
  STAGE_LABELS,
  FORM_LABELS: {
    good: 'good',
    normal: 'ordinary',
    naughty: 'naughty',
  },
  MOOD_LABELS: {
    happy: 'Happy with life',
    normal: 'All is well',
    sad: 'Something is missing',
    sick: 'Sick',
    sleeping: 'Sleeping',
    dead: 'Passed away',
  },
  CAUSE_LABELS: {
    hunger: 'hunger',
    sickness: 'illness',
    neglect: 'poor care',
    oldAge: 'old age',
  },
  BLOCK_REASONS: {
    noPet: 'Adopt a pet first.',
    egg: 'The pet has not hatched yet.',
    dead: 'The pet has passed away.',
    sleeping: 'The pet is sleeping.',
    sick: 'The pet is sick and does not want to play.',
    cooldown: 'Wait a couple of seconds.',
    noTreats: 'No treats — earn some in “Play”!',
    clean: 'Nothing to clean — all tidy.',
  },
  EVENT_MESSAGES: {
    hatched: (name: string) => `${name} hatched!`,
    grew: (name: string, stage) => `${name} grew up: now ${STAGE_LABELS[stage]}.`,
    gotSick: (name: string) => `${name} got sick. Give some medicine.`,
    recovered: (name: string) => `${name} recovered.`,
    fellAsleepAuto: (name: string) => `${name} fell asleep from tiredness.`,
    wokeUpAuto: (name: string) => `${name} had a good rest and woke up.`,
  },
  absenceNoteText: (name, note) => {
    switch (note.kind) {
      case 'hatched':
        return `${name} hatched`;
      case 'grew':
        return `${name} grew to the “${STAGE_LABELS[note.stage]}” stage`;
      case 'gotSick':
        return `${name} got sick`;
      case 'sleeping':
        return `${name} is sleeping now`;
      case 'hungry':
        return `${name} got hungry`;
      case 'dirty':
        return `${name} made a mess — ${note.poops} ${poopWord(note.poops)} on the floor`;
      case 'pooped':
        return `${name} made a mess (${note.poops} ${poopWord(note.poops)})`;
      case 'bored':
        return `${name} got bored`;
      case 'died':
        return `${name} could not wait for you`;
    }
  },
  poopWord,
  POOP_TEXT: {
    label: 'Cleaning',
    clean: 'clean',
    count: (n: number) => `${n} ${poopWord(n)} on the floor`,
    pooped: (name: string) => `${name} made a mess. Time to clean!`,
  },
  formatDuration: (ms: number) => {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
    if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    return `${Math.max(minutes, 0)} min`;
  },
};
