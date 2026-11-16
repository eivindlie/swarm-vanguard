import type { BossVariant } from './models';

export type DecorKind = 'cactus' | 'rock' | 'snowRock' | 'redRock' | 'mesa' | 'redMesa' | 'iceMesa' | 'arch' | 'pine' | 'crystal' | 'deadTree' | 'lavaSpike' | 'lavaRock';

export interface DecorSpec {
  kind: DecorKind;
  n: number;
  minX: number;
  maxX: number;
  scale: [number, number];
}

export interface Theme {
  id: 'desert' | 'canyon' | 'frost' | 'volcano';
  name: string;
  boss: BossVariant;
  bossName: string;
  // sky gradient (top -> horizon) and the fog that blends the world into it
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  fog: number;
  fogNear: number;
  fogFar: number;
  // lighting
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sun: number;
  sunIntensity: number;
  sunGlow: string; // colour of the sun disc in the sky
  cloud: string;
  cloudAlpha: number;
  // ground
  groundA: string;
  groundB: string;
  laneEdge: string;
  outer: string;
  wall: number;
  postBody: number;
  postCap: number;
  decor: DecorSpec[];
  ambient: { kind: 'dust' | 'snow' | 'embers'; color: number; n: number } | null;
}

export const THEMES: Theme[] = [
  {
    id: 'desert',
    name: 'Sun Dunes',
    boss: 'golem',
    bossName: 'SANDSTONE GOLEM',
    skyTop: '#4fb6ee',
    skyMid: '#9fdcf5',
    skyBottom: '#f6e8c4',
    fog: 0xf0e2bd,
    fogNear: 40,
    fogFar: 95,
    hemiSky: 0xffffff,
    hemiGround: 0xd9b77a,
    hemiIntensity: 1.7,
    sun: 0xfff0cf,
    sunIntensity: 2.4,
    sunGlow: '#fff6d8',
    cloud: '#ffffff',
    cloudAlpha: 0.85,
    groundA: '#e8c98a',
    groundB: '#dcb878',
    laneEdge: '#f7e7bd',
    outer: '#efd9a0',
    wall: 0xc9a56a,
    postBody: 0x8b6b45,
    postCap: 0xe8d3a0,
    decor: [
      { kind: 'cactus', n: 90, minX: 5.2, maxX: 13, scale: [0.9, 1.7] },
      { kind: 'rock', n: 110, minX: 4.9, maxX: 18, scale: [0.6, 1.9] },
      { kind: 'mesa', n: 22, minX: 18, maxX: 38, scale: [1.2, 2.5] },
    ],
    ambient: { kind: 'dust', color: 0xf3dfae, n: 70 },
  },
  {
    id: 'canyon',
    name: 'Red Canyon',
    boss: 'ogre',
    bossName: 'CANYON OGRE',
    skyTop: '#5a6fd6',
    skyMid: '#d98fa0',
    skyBottom: '#ffc58b',
    fog: 0xf0b48c,
    fogNear: 38,
    fogFar: 90,
    hemiSky: 0xffe2c8,
    hemiGround: 0xb8603f,
    hemiIntensity: 1.6,
    sun: 0xffc48a,
    sunIntensity: 2.6,
    sunGlow: '#ffe2b0',
    cloud: '#ffd6b8',
    cloudAlpha: 0.75,
    groundA: '#d98b61',
    groundB: '#cc7d55',
    laneEdge: '#f2b88f',
    outer: '#c4694a',
    wall: 0xa9553a,
    postBody: 0x7a3f2b,
    postCap: 0xf2b88f,
    decor: [
      { kind: 'redMesa', n: 28, minX: 14, maxX: 36, scale: [1.2, 2.7] },
      { kind: 'arch', n: 14, minX: 12, maxX: 26, scale: [1.0, 1.7] },
      { kind: 'redRock', n: 120, minX: 4.9, maxX: 20, scale: [0.6, 2.0] },
      { kind: 'deadTree', n: 40, minX: 5.2, maxX: 14, scale: [0.9, 1.6] },
    ],
    ambient: { kind: 'dust', color: 0xffc9a0, n: 70 },
  },
  {
    id: 'frost',
    name: 'Frozen Wastes',
    boss: 'frost',
    bossName: 'FROST COLOSSUS',
    skyTop: '#7fb8ee',
    skyMid: '#c4e2f7',
    skyBottom: '#f1f9ff',
    fog: 0xe3f1fb,
    fogNear: 35,
    fogFar: 85,
    hemiSky: 0xeaf6ff,
    hemiGround: 0x9fb6d6,
    hemiIntensity: 1.9,
    sun: 0xe9f3ff,
    sunIntensity: 2.0,
    sunGlow: '#ffffff',
    cloud: '#f4faff',
    cloudAlpha: 0.9,
    groundA: '#f1f8fd',
    groundB: '#dbe9f4',
    laneEdge: '#9fd2f2',
    outer: '#f6fbff',
    wall: 0xb5dcf0,
    postBody: 0x7fb3d8,
    postCap: 0xffffff,
    decor: [
      { kind: 'pine', n: 120, minX: 5.2, maxX: 22, scale: [0.9, 1.9] },
      { kind: 'crystal', n: 50, minX: 5.0, maxX: 16, scale: [0.8, 1.8] },
      { kind: 'snowRock', n: 90, minX: 4.9, maxX: 18, scale: [0.6, 1.8] },
      { kind: 'iceMesa', n: 18, minX: 20, maxX: 40, scale: [1.2, 2.5] },
    ],
    ambient: { kind: 'snow', color: 0xffffff, n: 110 },
  },
  {
    id: 'volcano',
    name: 'Ember Peak',
    boss: 'demon',
    bossName: 'MAGMA DEMON',
    skyTop: '#1f0e2e',
    skyMid: '#7a2a3a',
    skyBottom: '#ff7a38',
    fog: 0x6a2a2e,
    fogNear: 32,
    fogFar: 80,
    hemiSky: 0xffb090,
    hemiGround: 0x6a4250,
    hemiIntensity: 2.3,
    sun: 0xff9a5a,
    sunIntensity: 2.2,
    sunGlow: '#ffb070',
    cloud: '#5a2a38',
    cloudAlpha: 0.7,
    groundA: '#3a2b36',
    groundB: '#31242e',
    laneEdge: '#ff7a2a',
    outer: '#2a1b24',
    wall: 0x4d3441,
    postBody: 0x2a1a24,
    postCap: 0xff7a1a,
    decor: [
      { kind: 'lavaSpike', n: 80, minX: 5.0, maxX: 20, scale: [0.9, 2.0] },
      { kind: 'lavaRock', n: 110, minX: 4.9, maxX: 20, scale: [0.6, 1.9] },
      { kind: 'deadTree', n: 24, minX: 5.5, maxX: 14, scale: [0.9, 1.5] },
    ],
    ambient: { kind: 'embers', color: 0xff9a3a, n: 90 },
  },
];

/** Worlds are consecutive blocks of 4 levels; the last theme repeats if there are more levels. */
export function themeIndexForLevel(levelId: number): number {
  const i = Math.floor((levelId - 1) / 4);
  return Math.max(0, Math.min(THEMES.length - 1, i));
}

export function themeForLevel(levelId: number): Theme {
  return THEMES[themeIndexForLevel(levelId)];
}
