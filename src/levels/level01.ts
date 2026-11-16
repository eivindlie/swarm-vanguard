import type { LevelDef } from '../sim/level';

export const level01: LevelDef = {
  id: 1,
  name: 'First Steps',
  length: 150,
  coins: 20,
  spawns: [
    { t: 'enemies', y: 22, x: 0, spreadX: 3, spreadY: 4, count: 10, kind: 'grunt' },
    { t: 'gates', y: 34, left: { op: 'add', value: 5 }, right: { op: 'mul', value: 2 } },
    { t: 'block', y: 48, x: -2, w: 3, hp: 18, reward: { kind: 'soldiers', n: 12 } },
    { t: 'enemies', y: 55, x: 1, spreadX: 3, spreadY: 6, count: 22, kind: 'grunt' },
    { t: 'gates', y: 72, left: { op: 'sub', value: 4 }, right: { op: 'add', value: 8 } },
    { t: 'enemies', y: 85, x: 0, spreadX: 3.4, spreadY: 8, count: 36, kind: 'grunt' },
    { t: 'block', y: 100, x: 2, w: 3, hp: 30, reward: { kind: 'weapon', stat: 'damage', mul: 1.5, label: 'DMG x1.5' } },
    { t: 'enemies', y: 112, x: 0, spreadX: 3.4, spreadY: 10, count: 50, kind: 'grunt' },
    { t: 'enemies', y: 128, x: 0, spreadX: 2, spreadY: 3, count: 2, kind: 'brute' },
  ],
};
