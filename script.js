'use strict';

/* =========================================================================
 * Stick Brawl (스틱 브롤) — 삼국지 실시간 P2P 스틱맨 격투
 * 모든 그래픽은 Canvas API로, 모든 효과음은 Web Audio로 코드에서 생성한다.
 * ========================================================================= */

/* ----------------------------- 상수 ----------------------------- */
const W = 960, H = 540, GROUND = 462;
const TICK_MS = 1000 / 60;
const PEER_PREFIX = 'stickbrawl-v4-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BASE_HP = 100;
const GRAVITY = 0.8, MOVE_SPEED = 4.6, JUMP_V = 15.5;
const DASH_SPEED = 13, DASH_FRAMES = 12, DASH_INV = 10, DASH_CD = 40;
const INTRO_FRAMES = 100, KO_FRAMES = 180, FIGHT_BANNER = 45;
const HURT_W = 36, HURT_H = 114;
const NET_TIMEOUT = 8000;
const PHASE = { INTRO: 0, FIGHT: 1, KO: 2 };
const ST = { IDLE: 0, WALK: 1, AIR: 2, ATK: 3, HIT: 4, DASH: 5, KO: 6, GUARD: 7, BLOCK: 8 };
const METER_MAX = 100, GUARD_MAX = 100, PARRY_WINDOW = 7, GUARD_RANGE = 280;
const SK = { hip: 52, torso: 40, neck: 5, headR: 11, upper: 22, fore: 22, thigh: 28, shin: 27 };
const INK = '#1f1a17', PAPER = '#e6ddc5', PAPER_LIGHT = '#f3ead2', RED = '#a8322a';
const SERIF = '"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang","Songti SC",serif';
const TAU = Math.PI * 2;
const HAN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/* ----------------------------- 무기 / 캐릭터 정의 -----------------------------
 * 무기 판정은 손 위치에서 무기 각도 방향으로 [from, to] 구간의 캡슐(반지름 r)로 계산.
 * off는 날 중심선이 자루에서 수직으로 벗어난 정도(언월도처럼 한쪽으로 넓은 날).
 * grip2가 있으면 양손 무기: 뒷손은 자루 위 grip2 지점을 잡는다(IK).
 * tip보다 손에 가까운 자루 부분에 맞으면 약한 타격(데미지·넉백 절반)이 된다. 긴 무기는 품 안으로 파고들면 약하다.
 */
const WEAPONS = {
  twin:      { from: 4,  to: 36,  r: 7,  off: 0, grip2: null, tip: 0 },
  glaive:    { from: 34, to: 104, r: 15, off: 4, grip2: -26, tip: 62, back: -46 },
  serpent:   { from: 50, to: 110, r: 8,  off: 0, grip2: -28, tip: 74, back: -52 },
  sevenstar: { from: 4,  to: 58,  r: 10, off: 1, grip2: null, tip: 0 },
  spear:     { from: 46, to: 98,  r: 9,  off: 0, grip2: -26, tip: 66, back: -44 },
  pike:      { from: 30, to: 86,  r: 7,  off: 0, grip2: -24, tip: 64, back: -40 },
  halberd:   { from: 46, to: 104, r: 11, off: 0, grip2: -26, tip: 70, back: -48 },
  saber:     { from: 4,  to: 50,  r: 9,  off: 1, grip2: null, tip: 0 },
  bow:       { from: 0,  to: 0,   r: 0,  off: 0, grip2: null, tip: 0 },
};

/* 키프레임: [frame, handX, handY, weaponAngle] (어깨 기준, 오른쪽을 바라볼 때 좌표) */
const CHARACTERS = [
  {
    id: 'liubei', name: '유비', hanja: '劉備', weapon: 'twin', weaponName: '쌍고검 (雙股劍)',
    desc: '밸런스형 · 한 번 공격에 두 번 베는 빠른 쌍검',
    hp: 1.05, speed: 1.0, jump: 1.0, body: '#e0b422', accent: '#2e8b3d', fx: '#3aa655',
    stats: { 체력: 3, 속도: 3, 공격력: 2, 공속: 4, 사거리: 2 },
    idle: { main: [18, 14, -0.9], off: [10, 18, -0.4], lean: 0 },
    guard: { main: [16, -4, -1.2], off: [12, 2, -1.9], lean: -0.12 },
    attack: {
      total: 24, lunge: [5, 3],
      main: [[3, -6, -30, -2.4], [7, 34, 16, 0.9], [11, 28, 20, 1.1]],
      off: [[5, 10, 18, -0.4], [8, -10, -26, -2.3], [12, 36, 6, 0.5], [16, 30, 12, 0.7]],
      lean: [[7, 0.25], [12, 0.3], [16, 0.2]],
      hits: [
        { from: 4, to: 7, arm: 'main', dmg: 8, kb: 4, up: 2 },
        { from: 9, to: 12, arm: 'off', dmg: 9, kb: 6.5, up: 3 },
      ],
    },
    special: {
      name: '쌍룡난무', hanja: '雙龍亂舞', desc: '앞으로 파고들며 양손 검으로 다섯 번 몰아친다',
      total: 40, lunge: [[5, 5], [15, 4], [25, 4]],
      main: [[3, -6, -30, -2.4], [7, 34, 16, 0.9], [13, -6, -28, -2.3], [17, 36, 10, 0.7], [24, -4, -32, -2.5], [30, 38, 6, 0.4], [34, 32, 14, 0.8]],
      off: [[5, 10, 18, -0.4], [8, -10, -26, -2.3], [12, 36, 6, 0.5], [19, -10, -24, -2.2], [23, 36, 4, 0.4], [27, 20, 18, 0.2]],
      lean: [[7, 0.25], [12, 0.3], [17, 0.3], [23, 0.3], [30, 0.35], [34, 0.3]],
      hits: [
        { from: 4, to: 7, arm: 'main', dmg: 4, kb: 2.5, up: 1 },
        { from: 9, to: 12, arm: 'off', dmg: 4, kb: 2.5, up: 1 },
        { from: 14, to: 17, arm: 'main', dmg: 4, kb: 2.5, up: 1 },
        { from: 20, to: 23, arm: 'off', dmg: 4, kb: 2.5, up: 1 },
        { from: 25, to: 30, arm: 'main', dmg: 8, kb: 9, up: 5 },
      ],
    },
  },
  {
    id: 'guanyu', name: '관우', hanja: '關羽', weapon: 'glaive', weaponName: '청룡언월도 (靑龍偃月刀)',
    desc: '느리지만 묵직한 한 방 · 넓은 베기 궤적 · 휘두르는 동안 경직 무시',
    hp: 1.15, speed: 0.8, jump: 0.92, body: '#1f5e33', accent: '#2f8a4d', fx: '#1f9e7a',
    stats: { 체력: 5, 속도: 1, 공격력: 5, 공속: 1, 사거리: 4 },
    idle: { main: [16, 10, -1.2], off: [0, 0, 0], lean: 0 },
    guard: { main: [14, -6, -1.45], lean: -0.12 },
    attack: {
      total: 52, lunge: [21, 5], armor: [14, 26],
      main: [[16, -14, -28, -2.6], [21, 10, -34, -1.5], [25, 34, -4, 0], [29, 32, 10, 0.9], [36, 32, 10, 0.9]],
      lean: [[16, -0.2], [25, 0.2], [29, 0.3], [36, 0.3]],
      hits: [{ from: 19, to: 29, arm: 'main', dmg: 20, kb: 12, up: 6 }],
    },
    special: {
      name: '청룡승천', hanja: '靑龍昇天', desc: '언월도를 한 바퀴 크게 휘둘러 앞뒤를 베고 내려찍는다 (경직 무시)',
      total: 56, lunge: [[18, 4], [38, 6]], armor: [4, 46],
      main: [[10, -14, -28, -2.6], [18, 34, -4, 0], [22, 28, 18, 1.2], [26, -6, 24, 2.4], [30, -30, 0, 3.14], [34, -14, -30, 4.0], [38, 14, -34, 4.7], [44, 32, 10, 7.18], [50, 32, 10, 7.18]],
      lean: [[10, -0.2], [18, 0.2], [26, 0], [34, -0.15], [44, 0.3], [50, 0.3]],
      hits: [
        { from: 16, to: 31, arm: 'main', dmg: 14, kb: 2.5, up: 9 },
        { from: 36, to: 46, arm: 'main', dmg: 20, kb: 13, up: 7 },
      ],
    },
  },
  {
    id: 'zhangfei', name: '장비', hanja: '張飛', weapon: 'serpent', weaponName: '장팔사모 (丈八蛇矛)',
    desc: '빠른 발 · 앞으로 뛰어들며 찌르는 긴 사거리의 강력한 찌르기',
    hp: 0.9, speed: 1.15, jump: 1.05, body: '#151515', accent: '#c0392b', fx: '#d0392b',
    stats: { 체력: 2, 속도: 4, 공격력: 4, 공속: 2, 사거리: 5 },
    idle: { main: [14, 8, -0.25], off: [0, 0, 0], lean: 0 },
    guard: { main: [14, -6, -1.45], lean: -0.12 },
    attack: {
      total: 38, lunge: [12, 6.5],
      main: [[10, -12, 6, -0.08], [14, 40, 10, 0.05], [20, 40, 10, 0.05]],
      lean: [[10, -0.15], [14, 0.35], [20, 0.35]],
      hits: [{ from: 12, to: 17, arm: 'main', dmg: 16, kb: 10, up: 4 }],
    },
    special: {
      name: '장판교의 포효', hanja: '長坂橋', desc: '천지를 울리는 고함으로 가까운 적을 기절시킨다 (막기 불가)',
      total: 46, armor: [4, 14], roar: { f: 14, range: 240, stun: 58, dmg: 4 },
      main: [[8, -4, -20, -1.9], [14, 20, -24, -1.2], [30, 20, -24, -1.2]],
      lean: [[8, -0.25], [14, 0.15], [30, 0.15]],
      hits: [],
    },
  },
  {
    id: 'caocao', name: '조조', hanja: '曹操', weapon: 'sevenstar', weaponName: '칠성보도 (七星寶刀)',
    desc: '짧은 쿨타임과 넓은 베기 궤적 · 빈틈이 적은 운영형',
    hp: 1.0, speed: 1.0, jump: 1.0, body: '#6a2c8f', accent: '#b22222', fx: '#8a44c8',
    stats: { 체력: 3, 속도: 3, 공격력: 3, 공속: 4, 사거리: 3 },
    idle: { main: [18, 12, -1.0], off: [-10, 26, 0], lean: 0 },
    guard: { main: [14, -4, -1.35], off: [-6, 10, 0], lean: -0.12 },
    attack: {
      total: 20, lunge: [6, 3],
      main: [[4, -8, -30, -2.6], [8, 36, -4, -0.2], [11, 30, 20, 1.2]],
      lean: [[4, -0.1], [8, 0.2], [11, 0.25]],
      hits: [{ from: 5, to: 11, arm: 'main', dmg: 12, kb: 7, up: 3 }],
    },
    special: {
      name: '간웅의 반격', hanja: '奸雄反擊', desc: '받아치기 자세. 자세 중에 공격받으면 흘려내고 즉시 강하게 반격한다',
      total: 40, counter: [3, 30], counterHit: { dmg: 22, kb: 12, up: 6 },
      main: [[4, 4, 2, -0.2], [30, 4, 2, -0.2]],
      lean: [[4, -0.15], [30, -0.15]],
      hits: [],
    },
  },
  {
    id: 'zhaoyun', name: '조자룡', hanja: '趙子龍', weapon: 'spear', weaponName: '애각창 (涯角槍)',
    desc: '최고의 기동력과 점프력 · 딜레이 없는 연속 찌르기',
    hp: 0.8, speed: 1.3, jump: 1.22, body: '#f7f5ef', accent: '#2f6fd6', fx: '#3d7fe0',
    stats: { 체력: 1, 속도: 5, 공격력: 1, 공속: 5, 사거리: 4 },
    idle: { main: [14, 6, -0.2], off: [0, 0, 0], lean: 0 },
    guard: { main: [14, -6, -1.45], lean: -0.12 },
    attack: {
      total: 14, lunge: [4, 2.5], alt: 9,
      main: [[3, 2, 8, -0.08], [6, 40, 6, 0.02], [9, 38, 6, 0.02]],
      lean: [[3, -0.05], [6, 0.3], [9, 0.3]],
      hits: [{ from: 4, to: 8, arm: 'main', dmg: 7, kb: 4, up: 2 }],
    },
    special: {
      name: '칠진칠출', hanja: '七進七出', desc: '무적 상태로 돌진하며 세 번 연속으로 꿰뚫는다',
      total: 34, drive: [3, 20, 7.5], inv: 12,
      main: [[3, 2, 8, -0.08], [6, 40, -2, -0.05], [9, 4, 8, -0.05], [12, 40, 8, 0.05], [15, 4, 6, 0], [19, 42, 2, 0], [26, 40, 4, 0]],
      lean: [[3, 0.1], [6, 0.35], [12, 0.35], [19, 0.4], [26, 0.3]],
      hits: [
        { from: 4, to: 7, arm: 'main', dmg: 7, kb: 2, up: 1 },
        { from: 10, to: 13, arm: 'main', dmg: 7, kb: 2, up: 1 },
        { from: 16, to: 20, arm: 'main', dmg: 10, kb: 10, up: 6 },
      ],
    },
  },
  {
    id: 'lubu', name: '여포', hanja: '呂布', weapon: 'halberd', weaponName: '방천화극 (方天畫戟)',
    desc: '천하무쌍의 맹장 · 긴 사거리와 강한 베기, 고른 능력치',
    hp: 1.1, speed: 1.05, jump: 1.05, body: '#8b1a1a', accent: '#c9a227', fx: '#d4892a',
    stats: { 체력: 4, 속도: 3, 공격력: 4, 공속: 3, 사거리: 4 },
    idle: { main: [16, 8, -0.7], off: [0, 0, 0], lean: 0 },
    guard: { main: [14, -6, -1.45], lean: -0.12 },
    attack: {
      total: 32, lunge: [11, 6],
      main: [[8, -10, -4, -0.45], [12, 40, 2, 0.05], [17, 36, 14, 0.6], [22, 34, 14, 0.6]],
      lean: [[8, -0.15], [12, 0.35], [17, 0.3]],
      hits: [{ from: 11, to: 17, arm: 'main', dmg: 12, kb: 8, up: 3 }],
    },
    special: {
      name: '천하무쌍', hanja: '天下無雙', desc: '방천화극을 쉴 새 없이 돌리며 돌진해 앞뒤의 적을 모두 휩쓴다 (경직 무시)',
      total: 62, armor: [0, 50], drive: [6, 44, 4.5], noWeak: true,
      main: [[6, 20, 0, -1.57, 30], [12, 20, 2, 1.57, 30], [18, 20, 2, 4.71, 30], [24, 20, 2, 7.85, 30], [30, 20, 2, 11.0, 30], [36, 20, 2, 14.1, 30], [42, 20, 2, 17.3, 30], [48, 34, 8, 19.4, 0], [54, 34, 8, 19.4, 0]],
      lean: [[6, 0.1], [44, 0.1], [48, 0.35]],
      hits: [
        { from: 8, to: 12, arm: 'main', dmg: 4, kb: 2, up: 1 },
        { from: 12, to: 16, arm: 'butt', dmg: 4, kb: 2, up: 1 },
        { from: 18, to: 22, arm: 'main', dmg: 4, kb: 2, up: 1 },
        { from: 24, to: 28, arm: 'butt', dmg: 4, kb: 2, up: 1 },
        { from: 30, to: 34, arm: 'main', dmg: 4, kb: 2, up: 1 },
        { from: 36, to: 40, arm: 'butt', dmg: 4, kb: 2, up: 1 },
        { from: 45, to: 51, arm: 'main', dmg: 10, kb: 13, up: 7 },
      ],
    },
  },
];

/* 스토리 모드 병졸. 메뉴에는 나오지 않고 CHAR에만 등록된다. 공격 직전 예고 동작(긴 선딜)이 있어 피하기 쉽다. */
const SABER_IDLE = { main: [18, 12, -1.0], off: [-10, 26, 0], lean: 0 };
const SABER_GUARD = { main: [14, -4, -1.35], off: [-6, 10, 0], lean: -0.12 };
const SOLDIERS = [
  {
    id: 'sword', name: '도병', hanja: '刀兵', weapon: 'saber', hp: 0.28, speed: 0.78, jump: 0.8, chain: 99,
    soldier: true, body: '#6b5a45', accent: '#a8322a',
    idle: SABER_IDLE, guard: SABER_GUARD,
    attack: {
      total: 40, lunge: [14, 3],
      main: [[12, -8, -30, -2.6], [16, 36, -4, -0.2], [19, 30, 20, 1.2]],
      lean: [[12, -0.15], [16, 0.2], [19, 0.25]],
      hits: [{ from: 13, to: 19, arm: 'main', dmg: 6, kb: 5, up: 2 }],
    },
  },
  {
    id: 'pike', name: '창병', hanja: '槍兵', weapon: 'pike', hp: 0.32, speed: 0.72, jump: 0.8, chain: 99,
    soldier: true, body: '#6b5a45', accent: '#a8322a',
    idle: { main: [14, 8, -0.25], off: [0, 0, 0], lean: 0 }, guard: { main: [14, -6, -1.45], lean: -0.12 },
    attack: {
      total: 46, lunge: [16, 4],
      main: [[14, -12, 6, -0.08], [18, 40, 10, 0.05], [26, 40, 10, 0.05]],
      lean: [[14, -0.15], [18, 0.35], [26, 0.35]],
      hits: [{ from: 16, to: 21, arm: 'main', dmg: 7, kb: 6, up: 2 }],
    },
  },
  {
    id: 'archer', name: '궁병', hanja: '弓兵', weapon: 'bow', hp: 0.2, speed: 0.8, jump: 0.8, chain: 99,
    soldier: true, body: '#6b5a45', accent: '#a8322a',
    idle: { main: [20, 6, -0.3], off: [6, 16, 0], lean: 0 }, guard: { main: [16, -2, -0.4], off: [6, 10, 0], lean: -0.1 },
    attack: {
      total: 44, fire: 30,
      main: [[8, 38, -6, 0], [30, 38, -6, 0], [34, 36, -4, 0]],
      off: [[8, 34, -6, 0], [26, 4, -8, 0], [30, 4, -8, 0], [33, 24, -4, 0]],
      lean: [[8, -0.08], [30, -0.1]],
      hits: [],
    },
  },
  {
    id: 'elite', name: '적장', hanja: '敵將', weapon: 'saber', hp: 1.0, speed: 0.95, jump: 0.95, chain: 2,
    soldier: true, elite: true, body: '#6b5a45', accent: '#a8322a',
    idle: SABER_IDLE, guard: SABER_GUARD,
    attack: {
      total: 28, lunge: [8, 4],
      main: [[6, -8, -30, -2.6], [10, 36, -4, -0.2], [13, 30, 20, 1.2]],
      lean: [[6, -0.12], [10, 0.2], [13, 0.25]],
      hits: [{ from: 7, to: 13, arm: 'main', dmg: 12, kb: 8, up: 3 }],
    },
  },
];
for (const s of SOLDIERS) s.special = { ...s.attack, name: s.name, hanja: s.hanja, desc: '' };

const FACTIONS = {
  yellow: { name: '황건적', body: '#b8962a', band: '#e8c547' },
  dong:   { name: '동탁군', body: '#6b2a1e', helm: '#2b2b2b' },
  yuan:   { name: '원소군', body: '#7d6e48', helm: '#9a7a2a' },
  wei:    { name: '조조군', body: '#2f4f8f', helm: '#1f1f2a' },
  shu:    { name: '유비군', body: '#2e7d3a', helm: '#5a3a22' },
};

/* 영웅별 3단 콤보의 2타·3타. 1타는 각 캐릭터의 attack.
 * hop: [프레임, 위로 속도, 앞으로 속도] 도약 / rot: 몸 전체 회전 키프레임 / wave: 검기 투사체 / noWeak: 회전 공격은 자루 타격 감쇠 없음 / fin: 마무리(줌인·큰 경직) */
const COMBOS = {
  liubei: [
    {
      name: '쌍검 회전베기', total: 28, lunge: [[4, 3], [12, 3]],
      main: [[3, -30, -7, -2.8], [7, -1, -28, -1.6], [11, 31, -2, -0.2], [15, 12, 34, 1.2], [19, -27, 21, 2.6]],
      off: [[3, 30, 15, 0.34], [7, 1, 36, 1.54], [11, -31, 10, 2.94], [15, -12, -26, 4.34], [19, 27, -12, 5.74]],
      lean: [[3, -0.1], [11, 0.15], [19, 0.05]],
      hits: [
        { from: 5, to: 12, arm: 'main', dmg: 5, kb: 2.5, up: 2 },
        { from: 9, to: 17, arm: 'off', dmg: 5, kb: 3, up: 2 },
        { from: 13, to: 20, arm: 'main', dmg: 5, kb: 6, up: 3 },
      ],
    },
    {
      name: '쌍룡 돌격', total: 32, fin: true, lunge: [[10, 10]],
      main: [[6, -8, 12, 0.35], [11, 42, -6, -0.06], [17, 40, -6, -0.06]],
      off: [[6, -12, 16, 0.45], [11, 40, 4, 0.08], [17, 38, 4, 0.08]],
      lean: [[6, -0.2], [11, 0.45], [17, 0.4]],
      hits: [
        { from: 10, to: 15, arm: 'main', dmg: 7, kb: 9, up: 4 },
        { from: 10, to: 15, arm: 'off', dmg: 7, kb: 11, up: 6 },
      ],
    },
  ],
  guanyu: [
    {
      name: '횡소천군', total: 40, armor: [10, 22], lunge: [[16, 5]],
      main: [[10, -24, 2, 3.0], [16, 4, 30, 1.6], [21, 36, 10, 0.25], [27, 26, 0, -0.6], [32, 24, 2, -0.7]],
      lean: [[10, -0.2], [21, 0.25], [27, 0.15]],
      hits: [{ from: 14, to: 23, arm: 'main', dmg: 15, kb: 11, up: 4 }],
    },
    {
      name: '청룡 도약참', total: 54, fin: true, hop: [8, 10, 4], armor: [6, 30],
      main: [[8, -6, -30, -2.0], [16, -16, -26, -2.9], [22, 10, -34, -1.5], [27, 34, -2, 0.2], [31, 32, 12, 1.0], [42, 32, 12, 1.0]],
      lean: [[8, -0.2], [16, -0.35], [24, 0.2], [31, 0.4], [42, 0.35]],
      hits: [{ from: 22, to: 33, arm: 'main', dmg: 18, kb: 12, up: 7 }],
    },
  ],
  zhangfei: [
    {
      name: '사모 회전', total: 34, noWeak: true, lunge: [[6, 3]],
      main: [[4, 18, 0, -1.57, 30], [9, 20, 2, 1.57, 30], [14, 20, 2, 4.71, 30], [19, 20, 2, 7.85, 30], [24, 18, 0, 11.0, 30]],
      lean: [[4, 0], [14, 0.1], [24, 0]],
      hits: [
        { from: 6, to: 10, arm: 'main', dmg: 3, kb: 3, up: 1 },
        { from: 9, to: 13, arm: 'butt', dmg: 3, kb: 3, up: 1 },
        { from: 13, to: 17, arm: 'main', dmg: 3, kb: 3, up: 1 },
        { from: 17, to: 22, arm: 'butt', dmg: 4, kb: 8, up: 4 },
      ],
    },
    {
      name: '맹호 도약찌르기', total: 42, fin: true, hop: [5, 8, 8],
      main: [[5, -10, 4, -0.3], [11, 40, 14, 0.45], [24, 40, 14, 0.45]],
      lean: [[5, -0.2], [11, 0.35], [24, 0.3]],
      hits: [{ from: 10, to: 24, arm: 'main', dmg: 14, kb: 11, up: 6 }],
    },
  ],
  caocao: [
    {
      name: '역베기', total: 22, lunge: [[3, 3]],
      main: [[3, 22, 22, 1.5], [7, 34, -10, -0.9], [10, 24, -30, -1.6], [14, 22, -28, -1.5]],
      lean: [[3, 0.2], [7, 0], [10, -0.15]],
      hits: [{ from: 4, to: 10, arm: 'main', dmg: 9, kb: 4, up: 9 }],
    },
    {
      name: '칠성 검기', total: 32, fin: true, lunge: [[9, 5]], wave: { f: 12, speed: 11, dmg: 7, life: 34 },
      main: [[8, -10, -28, -2.7], [12, 38, -2, -0.1], [15, 30, 20, 1.2], [22, 28, 20, 1.2]],
      lean: [[8, -0.15], [12, 0.3], [15, 0.3]],
      hits: [{ from: 9, to: 15, arm: 'main', dmg: 8, kb: 8, up: 4 }],
    },
  ],
  zhaoyun: [
    {
      name: '창 돌리기', total: 28, noWeak: true, lunge: [[5, 4]],
      main: [[3, 18, 0, -1.57, 26], [7, 20, 2, 1.57, 26], [11, 20, 2, 4.71, 26], [15, 20, 2, 7.85, 26], [19, 18, 0, 10.2, 26]],
      lean: [[3, 0], [11, 0.1], [19, 0]],
      hits: [
        { from: 6, to: 9, arm: 'main', dmg: 3, kb: 3, up: 1 },
        { from: 8, to: 11, arm: 'butt', dmg: 3, kb: 3, up: 1 },
        { from: 11, to: 14, arm: 'main', dmg: 3, kb: 3, up: 1 },
        { from: 14, to: 18, arm: 'butt', dmg: 4, kb: 7, up: 3 },
      ],
    },
    {
      name: '용 승천', total: 36, fin: true, hop: [5, 12, 3], rot: [[5, 0], [20, -TAU]],
      main: [[5, 20, 18, 1.2], [10, 38, -6, -0.4], [16, 30, -26, -1.3], [26, 30, -20, -1.0]],
      lean: [[5, 0.1], [10, 0.2]],
      hits: [{ from: 7, to: 16, arm: 'main', dmg: 8, kb: 3, up: 13 }],
    },
  ],
  lubu: [
    {
      name: '방천 회전', total: 32, noWeak: true, lunge: [[6, 3]],
      main: [[4, 18, 0, -1.57, 30], [9, 20, 2, 1.57, 30], [14, 20, 2, 4.71, 30], [19, 18, 0, 7.6, 30]],
      lean: [[4, 0], [14, 0.1], [19, 0.05]],
      hits: [
        { from: 6, to: 10, arm: 'main', dmg: 4, kb: 3, up: 1 },
        { from: 10, to: 14, arm: 'butt', dmg: 4, kb: 3, up: 1 },
        { from: 14, to: 19, arm: 'main', dmg: 6, kb: 8, up: 3 },
      ],
    },
    {
      name: '비장 일격', total: 48, fin: true, hop: [7, 9, 6], armor: [6, 26],
      main: [[7, -8, -28, -2.2], [14, -14, -26, -2.9], [19, 12, -32, -1.4], [24, 36, 0, 0.3], [28, 32, 14, 1.0], [38, 32, 14, 1.0]],
      lean: [[7, -0.15], [14, -0.3], [22, 0.2], [28, 0.4], [38, 0.35]],
      hits: [{ from: 19, to: 30, arm: 'main', dmg: 16, kb: 12, up: 7 }],
    },
  ],
};

const CHAR = {};
/* 무기 키프레임: [frame, handX, handY, 각도, 쥐는위치]. 쥐는위치 g>0이면 손이 자루 가운데 쪽으로 옮겨가 봉술처럼 돌릴 수 있다.
 * 끝 각도는 idle 각도와 같은 방향(2π 배수 차이)으로 맞춰 휘두른 방향 그대로 자연스럽게 돌아오게 한다. */
const nearAngle = (base, ref) => base + TAU * Math.round((ref - base) / TAU);
function buildMoveKeys(ch, mv) {
  const i = ch.idle;
  const norm = k => (k.length >= 5 ? k : [...k, 0]);
  const main = mv.main.map(norm);
  const last = main.length ? main[main.length - 1][3] : i.main[2];
  mv.mainK = [[0, ...i.main, 0], ...main, [mv.total, i.main[0], i.main[1], nearAngle(i.main[2], last), 0]];
  const ob = mv.offBase || i.off;
  const offLast = mv.off && mv.off.length ? mv.off[mv.off.length - 1][3] : ob[2];
  mv.offK = mv.off ? [[0, ...ob], ...mv.off, [mv.total, ob[0], ob[1], nearAngle(ob[2], offLast)]] : null;
  mv.rotK = mv.rot ? [[0, 0], ...mv.rot, [mv.total, nearAngle(0, mv.rot[mv.rot.length - 1][1])]] : null;
  mv.leanK = [[0, i.lean], ...mv.lean, [mv.total, i.lean]];
  mv.lunges = !mv.lunge ? [] : Array.isArray(mv.lunge[0]) ? mv.lunge : [mv.lunge];
  mv.lastHitEnd = mv.hits.length ? Math.max(...mv.hits.map(h => h.to)) : mv.roar ? mv.roar.f : mv.counter ? mv.counter[1] : 0;
  mv.legK = mv.legs ? [[0, ...mv.legBase], ...mv.legs, [mv.total, ...mv.legBase]] : null;
  mv.arms = [...new Set(mv.hits.map(h => h.arm))];
  return mv;
}

/* 발차기는 모든 캐릭터 공통: 무기는 막기 자세로 쥔 채 앞발로 찬다. 가드 게이지(gd)를 크게 깎아 막기만 하는 상대를 깬다. */
const KICK = {
  total: 22, guardArms: true, lunge: [6, 3], main: [],
  lean: [[5, -0.12], [8, -0.3], [13, -0.25]],
  legs: [[3, 6, -26], [7, 50, -54], [12, 48, -52]], legBase: [14, 0],
  hits: [{ from: 6, to: 11, arm: 'foot', dmg: 6, kb: 11, up: 4, gd: 45 }],
};
const AIR_KICK = {
  total: 30, guardArms: true, air: true, dive: [5, 7, 3], main: [],
  lean: [[3, 0.05], [7, -0.45], [24, -0.45]],
  legs: [[3, 8, -30], [7, 50, -26], [24, 50, -26]], legBase: [12, -12], tuck: [-6, -30],
  hits: [{ from: 6, to: 22, arm: 'foot', dmg: 8, kb: 8, up: 5, gd: 30 }],
};
/* 체술 버튼의 주먹: 무기는 막기 자세로 쥐고 반대 손으로 짧게 지른다. 아주 빨라서 품 안에 들어온 상대를 끊어낸다. */
const PUNCH = {
  total: 14, guardArms: true, offPunch: true, lunge: [3, 2.5], main: [],
  offBase: [6, 14, 0], off: [[2, -2, 6, 0], [5, 40, -6, 0], [8, 38, -6, 0]],
  lean: [[2, -0.05], [5, 0.22], [8, 0.18]],
  hits: [{ from: 4, to: 7, arm: 'fist', dmg: 3, kb: 3, up: 1, gd: 10 }],
};
/* 양손 무기(창·언월도)는 한 손을 떼고 지르므로 주먹이 늦다. 품 안 약점을 완전히 지우지 않게 한다. */
const PUNCH_TWO_HANDED = {
  total: 20, lunge: [6, 2.5],
  off: [[4, -2, 6, 0], [8, 40, -6, 0], [11, 38, -6, 0]],
  lean: [[4, -0.05], [8, 0.22], [11, 0.18]],
  hits: [{ from: 7, to: 10, arm: 'fist', dmg: 3, kb: 3, up: 1, gd: 10 }],
};
const COMBO_WINDOW = 18;

for (const ch of [...CHARACTERS, ...SOLDIERS]) {
  buildMoveKeys(ch, ch.attack);
  buildMoveKeys(ch, ch.special);
  if (COMBOS[ch.id]) {
    ch.attack2 = buildMoveKeys(ch, COMBOS[ch.id][0]);
    ch.attack3 = buildMoveKeys(ch, COMBOS[ch.id][1]);
    ch.combo = ['n', 'n2', 'n3'];
  } else {
    ch.combo = ch.elite ? ['n', 'n'] : ['n'];
  }
  ch.kick = buildMoveKeys(ch, { ...KICK });
  ch.airKick = buildMoveKeys(ch, { ...AIR_KICK });
  ch.punch = buildMoveKeys(ch, WEAPONS[ch.weapon].grip2 !== null ? { ...PUNCH, ...PUNCH_TWO_HANDED } : { ...PUNCH });
  if (!ch.guard.off) ch.guard.off = ch.idle.off;
  CHAR[ch.id] = ch;
}

const MOVES = { n: 'attack', n2: 'attack2', n3: 'attack3', s: 'special', k: 'kick', j: 'airKick', p: 'punch' };
const MOVE_CODES = ['n', 's', 'k', 'j', 'p', 'n2', 'n3'];
const COMBO_MOVES = new Set(['n', 'n2', 'n3', 'k']);
const moveOf = p => CHAR[p.c][MOVES[p.mv] || 'attack'];

const AI_RANGE = { liubei: 62, guanyu: 125, zhangfei: 150, caocao: 88, zhaoyun: 128, lubu: 132, sword: 72, pike: 118, archer: 400, elite: 88 };
const AI_SP_RANGE = { liubei: 75, guanyu: 135, zhangfei: 220, caocao: 160, zhaoyun: 170, lubu: 140, sword: 0, pike: 0, archer: 0, elite: 0 };

/* ----------------------------- 유틸 ----------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const hanNum = n => (n <= 10 ? HAN_NUM[n] : String(n));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleKeys(keys, f) {
  if (f <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (f <= b[0]) {
      const a = keys[i - 1];
      let t = (f - a[0]) / (b[0] - a[0] || 1);
      t = 0.5 * t + 0.5 * t * t * (3 - 2 * t);
      const out = [];
      for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * t);
      return out;
    }
  }
  return keys[keys.length - 1].slice(1);
}

/* 2관절 IK: 어깨(엉덩이) → 손(발) 목표점. bend 부호로 팔꿈치/무릎 방향 결정 */
function ik(sx, sy, tx, ty, l1, l2, bend) {
  let dx = tx - sx, dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.01;
  if (d > maxD) { tx = sx + dx / d * maxD; ty = sy + dy / d * maxD; d = maxD; }
  d = Math.max(d, 0.001);
  const base = Math.atan2(ty - sy, tx - sx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ea = base + bend * off;
  return { ex: sx + Math.cos(ea) * l1, ey: sy + Math.sin(ea) * l1, hx: tx, hy: ty };
}

/* ----------------------------- 포즈 (절차적 애니메이션) -----------------------------
 * 렌더링과 히트 판정이 같은 포즈를 공유하므로 "보이는 무기 = 판정"이 된다.
 * 좌표는 발 위치(0,0) 기준, 오른쪽을 바라보는 로컬 좌표.
 */
function computePose(p, now) {
  const ch = CHAR[p.c], wd = WEAPONS[ch.weapon];
  const A = p.af >= 0 ? moveOf(p) : null;
  let m, o, lean;
  if (A && A.guardArms) {
    m = ch.guard.main.slice();
    o = A.offPunch ? sampleKeys(A.offK, p.af) : ch.guard.off.slice();
    lean = sampleKeys(A.leanK, p.af)[0];
  } else if (A) {
    m = sampleKeys(A.mainK, p.af);
    o = A.offK ? sampleKeys(A.offK, p.af) : ch.idle.off.slice();
    lean = sampleKeys(A.leanK, p.af)[0];
    if (A.alt) m[1] += (p.an % 2 ? -1 : 1) * A.alt * Math.sin(Math.PI * p.af / A.total);
  } else if (p.st === ST.GUARD || p.st === ST.BLOCK) {
    m = ch.guard.main.slice(); o = ch.guard.off.slice(); lean = ch.guard.lean;
    if (p.st === ST.BLOCK) { lean -= 0.14; m[0] -= 4; }
  } else {
    m = ch.idle.main.slice(); o = ch.idle.off.slice(); lean = ch.idle.lean;
    const br = Math.sin(now * 0.004 + p.idx * 2);
    m[1] += br * 1.5; m[2] += br * 0.04; o[1] += br * 1.2;
  }

  let bob = 0, crouch = 0;
  switch (p.st) {
    case ST.WALK: bob = -Math.abs(Math.sin(p.wp)) * 3; lean += 0.07 * Math.sign(p.vx * p.f); break;
    case ST.IDLE: bob = Math.sin(now * 0.004 + p.idx * 2) * 1.2; crouch = 2; break;
    case ST.HIT: lean -= 0.4; m = [6, 24, 0.6]; o = [-18, 10, 0.3]; break;
    case ST.DASH: lean += 0.45; crouch = 8; break;
    case ST.KO: lean -= 0.5; m = [10, 26, 0.9]; o = [-20, 6, 0.3]; break;
    case ST.AIR: lean += 0.05; break;
    case ST.GUARD: crouch = 5; if (Math.abs(p.vx) > 0.6) bob = -Math.abs(Math.sin(p.wp)) * 2; break;
    case ST.BLOCK: crouch = 7; break;
  }

  const hip = { x: 0, y: -SK.hip + crouch + bob };
  const sh = { x: hip.x + Math.sin(lean) * SK.torso, y: hip.y - Math.cos(lean) * SK.torso };
  const hd = { x: sh.x + Math.sin(lean * 1.1) * (SK.neck + SK.headR), y: sh.y - Math.cos(lean * 1.1) * (SK.neck + SK.headR) };

  const mainArm = ik(sh.x, sh.y, sh.x + m[0], sh.y + m[1], SK.upper, SK.fore, 1);
  const w = m[2], grip = m[3] || 0;
  let offArm, ow;
  if (wd.grip2 !== null && p.st !== ST.HIT && p.st !== ST.KO && !(A && A.offPunch)) {
    ow = w;
    const g2 = grip > 0 ? -14 : wd.grip2;
    offArm = ik(sh.x, sh.y, mainArm.hx + Math.cos(w) * g2, mainArm.hy + Math.sin(w) * g2, SK.upper, SK.fore, 1);
  } else {
    ow = o[2];
    offArm = ik(sh.x, sh.y, sh.x + o[0], sh.y + o[1], SK.upper, SK.fore, 1);
  }

  let ff, fb;
  if (!p.g) {
    const tuck = clamp(-p.vy * 0.6, -6, 10);
    ff = [12, hip.y + 40 - tuck]; fb = [-10, hip.y + 48 - tuck * 0.5];
  } else if (p.st === ST.WALK || (p.st === ST.GUARD && Math.abs(p.vx) > 0.6)) {
    const s = Math.sin(p.wp), c = Math.cos(p.wp);
    ff = [3 + s * 15, -Math.max(0, c) * 9]; fb = [-3 - s * 15, -Math.max(0, -c) * 9];
  } else if (p.st === ST.GUARD || p.st === ST.BLOCK) {
    ff = [17, 0]; fb = [-17, 0];
  } else if (p.st === ST.DASH) {
    ff = [16, 0]; fb = [-28, -6];
  } else if (p.st === ST.ATK) {
    ff = [16 + lean * 30, 0]; fb = [-14 - lean * 12, 0];
  } else if (p.st === ST.HIT) {
    ff = [10, 0]; fb = [-18, 0];
  } else {
    ff = [14, 0]; fb = [-12, 0];
  }
  if (A && A.legK) {
    ff = sampleKeys(A.legK, p.af);
    fb = A.tuck ? A.tuck.slice() : [-16, 0];
  }
  const legF = ik(hip.x, hip.y, ff[0], ff[1], SK.thigh, SK.shin, -1);
  const legB = ik(hip.x, hip.y, fb[0], fb[1], SK.thigh, SK.shin, -1);

  const pose = {
    hip, sh, hd, lean, grip,
    me: { x: mainArm.ex, y: mainArm.ey }, mh: { x: mainArm.hx, y: mainArm.hy }, w,
    oe: { x: offArm.ex, y: offArm.ey }, oh: { x: offArm.hx, y: offArm.hy }, ow,
    kf: { x: legF.ex, y: legF.ey }, ff: { x: legF.hx, y: legF.hy },
    kb: { x: legB.ex, y: legB.ey }, fb: { x: legB.hx, y: legB.hy },
  };
  const rot = A && A.rotK ? sampleKeys(A.rotK, p.af)[0] : 0;
  if (rot) rotatePose(pose, rot);
  return pose;
}

/* 공중제비 같은 몸 전체 회전은 엉덩이를 축으로 모든 관절과 무기 각도를 돌린다. 판정도 같은 포즈를 쓰므로 함께 돈다. */
function rotatePose(pose, a) {
  const c = Math.cos(a), s = Math.sin(a), ox = pose.hip.x, oy = pose.hip.y;
  for (const k of ['sh', 'hd', 'me', 'mh', 'oe', 'oh', 'kf', 'ff', 'kb', 'fb']) {
    const q = pose[k], dx = q.x - ox, dy = q.y - oy;
    q.x = ox + dx * c - dy * s;
    q.y = oy + dx * s + dy * c;
  }
  pose.w += a; pose.ow += a; pose.rot = a;
}

/* 무기 날(blade) 구간을 월드 좌표 캡슐로 변환. 핸디캡 배율은 끝(사거리)만 늘려 근접 사각지대가 생기지 않게 한다 */
function bladeSeg(p, pose, arm, ox = p.x, oy = p.y) {
  if (arm === 'foot') {
    return { ax: ox + p.f * pose.kf.x, ay: oy + pose.kf.y, bx: ox + p.f * pose.ff.x, by: oy + pose.ff.y, r: 9 * p.ws };
  }
  if (arm === 'fist') {
    return { ax: ox + p.f * pose.oe.x, ay: oy + pose.oe.y, bx: ox + p.f * pose.oh.x, by: oy + pose.oh.y, r: 8 * p.ws };
  }
  const wd = WEAPONS[CHAR[p.c].weapon];
  const hand = arm === 'off' ? pose.oh : pose.mh;
  const w = arm === 'off' ? pose.ow : pose.w;
  const g = arm === 'off' ? 0 : pose.grip || 0;
  const s = p.ws, c = Math.cos(w), sn = Math.sin(w);
  if (arm === 'butt') {
    const a0 = wd.back * s - g, a1 = (wd.back + 26) * s - g;
    return { ax: ox + p.f * (hand.x + c * a0), ay: oy + hand.y + sn * a0, bx: ox + p.f * (hand.x + c * a1), by: oy + hand.y + sn * a1, r: 7 * s };
  }
  const px = -sn * wd.off * s, py = c * wd.off * s;
  const from = wd.from - g, to = wd.to * s - g;
  const ax = hand.x + c * from + px, ay = hand.y + sn * from + py;
  const bx = hand.x + c * to + px, by = hand.y + sn * to + py;
  return { ax: ox + p.f * ax, ay: oy + ay, bx: ox + p.f * bx, by: oy + by, r: wd.r * s };
}

function hurtbox(p, ox = p.x, oy = p.y) {
  const s = p.hs, w = HURT_W * s, h = HURT_H * s, cy = oy - HURT_H / 2;
  return { x0: ox - w / 2, x1: ox + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
}

function segHitsRect(seg, rect) {
  const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
  const n = Math.max(2, Math.ceil(len / Math.max(3, seg.r * 0.8)) + 1);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = seg.ax + (seg.bx - seg.ax) * t, y = seg.ay + (seg.by - seg.ay) * t;
    const cx = clamp(x, rect.x0, rect.x1), cy = clamp(y, rect.y0, rect.y1);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= seg.r * seg.r) return { x: (x + cx) / 2, y: (y + cy) / 2, t };
  }
  return null;
}

/* ----------------------------- 플레이어 ----------------------------- */
function makePlayer(idx, charId, handicapped) {
  const ch = CHAR[charId] || CHARACTERS[0];
  const maxHp = Math.round(BASE_HP * ch.hp * (handicapped ? 1.5 : 1));
  const p = {
    idx, c: ch.id, maxHp, hp: maxHp, hc: !!handicapped,
    ws: handicapped ? 1.3 : 1, hs: handicapped ? 0.8 : 1,
    x: 0, y: GROUND, vx: 0, vy: 0, f: 1, g: true,
    st: ST.IDLE, af: -1, an: 0, hm: {}, df: 0, dd: 1, dcd: 0, inv: 0, fl: 0, hit: 0, kt: 0,
    mv: 'n', mp: 0, gd: GUARD_MAX, bs: 0, dz: 0, backT: 0, cs: 0, cw: 0, ak: false,
    wins: 0, ad: false, ljc: 0, lac: 0, ldc: 0, lsc: 0, luc: 0, bj: 0, ba: 0, bd: 0, bsp: 0, bu: 0, prevSeg: null,
    rx: 0, ry: GROUND, wp: 0, hpLag: maxHp, trails: {}, trailAf: -1, ghosts: [],
  };
  resetPlayer(p);
  return p;
}

function resetPlayer(p) {
  p.x = p.rx = p.idx === 0 ? W * 0.3 : W * 0.7;
  p.y = p.ry = GROUND;
  p.f = p.idx === 0 ? 1 : -1;
  p.vx = p.vy = 0; p.g = true; p.hp = p.maxHp; p.hpLag = p.maxHp;
  p.st = ST.IDLE; p.af = -1; p.hm = {}; p.df = 0; p.dcd = 0; p.inv = 0; p.fl = 0; p.hit = 0; p.kt = 0;
  p.mv = 'n'; p.gd = GUARD_MAX; p.bs = 0; p.dz = 0; p.backT = 0; p.cs = 0; p.cw = 0; p.ak = false;
  p.ad = false; p.bj = p.ba = p.bd = p.bsp = p.bu = 0; p.prevSeg = null; p.trails = {}; p.trailAf = -1; p.ghosts.length = 0;
}

function newInput() {
  return { l: false, r: false, j: false, a: false, d: false, s: false, u: false, jc: 0, ac: 0, dc: 0, sc: 0, uc: 0 };
}

/* ----------------------------- 게임 상태 ----------------------------- */
let game = null;
let eventSeq = 0;

function createGame(opts) {
  const handicapIdx = opts.handicap ? (opts.mode === 'practice' ? 0 : 1) : -1;
  game = {
    mode: opts.mode, me: opts.me, code: opts.code || '', handicap: !!opts.handicap,
    players: [makePlayer(0, opts.chars[0], handicapIdx === 0), makePlayer(1, opts.chars[1], handicapIdx === 1)],
    phase: PHASE.INTRO, pt: 0, round: 1, frame: 0, hitstop: 0, winner: -1,
    inputs: [newInput(), newInput()], pending: [], lastF: -1, seen: new Set(),
    ai: { t: 0, mode: 'approach' }, lastRecv: performance.now(), projs: [],
  };
}

function emit(ev) {
  ev.id = ++eventSeq;
  game.pending.push(ev);
  handleEvent(ev);
}

/* ----------------------------- 호스트 물리 시뮬레이션 ----------------------------- */
function simStep() {
  const g = game;
  g.frame++;
  if (g.hitstop > 0) { g.hitstop--; return; }
  g.pt++;
  if (g.phase === PHASE.INTRO && g.pt >= INTRO_FRAMES) { g.phase = PHASE.FIGHT; g.pt = 0; }

  const P = g.players, ctrl = g.phase === PHASE.FIGHT;
  if (g.mode === 'practice') updateAI(g.ai, P[1], P[0], g.inputs[1]);
  updatePlayer(P[0], g.inputs[0], P[1], ctrl);
  updatePlayer(P[1], g.inputs[1], P[0], ctrl);
  separate(P[0], P[1]);

  if (g.phase === PHASE.FIGHT) {
    checkHits(P[0], P[1]);
    checkHits(P[1], P[0]);
    updateProjs();
  } else g.projs.length = 0;
  for (const p of P) storePrevSeg(p);

  if (g.phase === PHASE.KO && g.pt >= KO_FRAMES) nextRound();
}

function nextRound() {
  game.round++;
  game.phase = PHASE.INTRO; game.pt = 0; game.winner = -1;
  for (const p of game.players) resetPlayer(p);
}

function startMove(p, kind) {
  const mv = CHAR[p.c][MOVES[kind]];
  p.mv = kind; p.af = 0; p.an++; p.hm = {}; p.ba = 0; p.prevSeg = null;
  if (mv.inv) p.inv = Math.max(p.inv, mv.inv);
}

/* 땅: 무기 → 무기 → 발차기 콤보(직전 공격이 끝난 뒤 COMBO_WINDOW 안에 이어 누르면 다음 단계). 공중: 점프 발차기(점프당 1회). */
function nextAttackKind(p) {
  if (!p.g) return p.ak ? null : 'j';
  const ch = CHAR[p.c], seq = ch.combo;
  p.cs = p.cw > 0 ? p.cs + 1 : 0;
  if (p.cs >= seq.length) {
    if (ch.chain === 99) { p.cs = 0; return seq[0]; }
    p.cs = -1;
    return 'k';
  }
  return seq[p.cs];
}

function updatePlayer(p, inp, opp, ctrl) {
  const ch = CHAR[p.c];

  if (inp.jc !== p.ljc) { p.ljc = inp.jc; if (ctrl) p.bj = 7; }
  if (inp.ac !== p.lac) { p.lac = inp.ac; if (ctrl) p.ba = 8; }
  if (inp.dc !== p.ldc) { p.ldc = inp.dc; if (ctrl) p.bd = 6; }
  if ((inp.sc | 0) !== p.lsc) { p.lsc = inp.sc | 0; if (ctrl) p.bsp = 8; }
  if ((inp.uc | 0) !== p.luc) { p.luc = inp.uc | 0; if (ctrl) p.bu = 8; }
  if (!ctrl) p.bj = p.ba = p.bd = p.bsp = p.bu = 0;
  if (p.dcd > 0) p.dcd--;
  if (p.inv > 0) p.inv--;
  if (p.fl > 0) p.fl--;
  if (p.dz > 0) p.dz--;
  if (p.cw > 0) p.cw--;
  if (p.st !== ST.BLOCK && p.gd < GUARD_MAX) p.gd = Math.min(GUARD_MAX, p.gd + 0.45);

  const dir = ctrl ? (inp.r ? 1 : 0) - (inp.l ? 1 : 0) : 0;
  const toward = opp.x >= p.x ? 1 : -1;
  const back = dir !== 0 && dir === -toward;
  p.backT = back ? p.backT + 1 : 0;

  if (p.st === ST.KO) {
    if (p.g) p.kt++;
  } else if (p.hit > 0) {
    p.hit--;
    p.st = ST.HIT;
    if (p.hit === 0) p.st = p.g ? ST.IDLE : ST.AIR;
  } else if (p.bs > 0) {
    p.bs--;
    p.st = p.bs > 0 ? ST.BLOCK : ST.IDLE;
  } else {
    let mv = moveOf(p);
    if (p.af >= 0) {
      p.af++;
      if (p.g) for (const [f, v] of mv.lunges) if (p.af === f) p.vx = p.f * v * ch.speed;
      if (mv.roar && p.af === mv.roar.f) doRoar(p, opp);
      if (mv.fire && p.af === mv.fire) fireArrow(p);
      if (mv.dive && p.af === mv.dive[0]) { p.vx = p.f * mv.dive[1]; p.vy = Math.max(p.vy, mv.dive[2]); }
      if (mv.hop && p.af === mv.hop[0]) { p.vy = -mv.hop[1]; p.vx = p.f * mv.hop[2]; p.g = false; p.hopped = true; }
      if (mv.wave && p.af === mv.wave.f) spawnWave(p, mv.wave);
      if (p.af >= mv.total) {
        if (COMBO_MOVES.has(p.mv)) p.cw = COMBO_WINDOW;
        p.af = -1; p.mv = 'n'; mv = ch.attack;
      }
    }
    if (p.df > 0) {
      p.df--;
      p.vx = p.dd * DASH_SPEED * (0.45 + 0.55 * (p.df / DASH_FRAMES));
      if (!p.g) p.vy = Math.min(p.vy, 0.5);
      if (p.df === 0) p.vx *= 0.5;
    }

    // 새 동작을 시작하기 전에 먼저 상대 쪽으로 돌아선다 (공격 버튼을 누르고 있어도 뒤로 돌 수 있게)
    if (p.af < 0 && p.df <= 0 && Math.abs(opp.x - p.x) > 6) p.f = toward;

    const canDash = p.bd > 0 && p.dcd <= 0 && p.df <= 0 && (p.af < 0 || p.af > mv.lastHitEnd) && (p.g || !p.ad);
    if (canDash) {
      p.af = -1; p.mv = 'n'; p.df = DASH_FRAMES; p.dd = dir || p.f; p.inv = DASH_INV; p.dcd = DASH_CD; p.bd = 0;
      if (!p.g) { p.ad = true; p.vy = 0; }
      emit({ k: 'dash', p: p.idx, x: r1(p.x), y: r1(p.y) });
    }
    const free = p.af < 0 && p.df <= 0;
    if (free && ctrl && p.bsp > 0 && p.g) {
      p.bsp = 0;
      if (p.mp >= METER_MAX) {
        p.mp = 0;
        startMove(p, 's');
        emit({ k: 'sp', p: p.idx, c: p.c });
      }
    }
    if (p.af < 0 && free && ctrl && p.bu > 0) {
      p.bu = 0;
      const kind = !p.g ? (p.ak ? null : 'j') : dir === toward ? 'k' : 'p';
      if (kind) {
        if (kind === 'j') p.ak = true;
        startMove(p, kind);
        emit({ k: 'sw', p: p.idx, c: p.c, kick: 1 });
      }
    }
    if (p.af < 0 && free && ctrl && (p.ba > 0 || inp.a)) {
      const kind = nextAttackKind(p);
      if (kind) {
        if (kind === 'j') p.ak = true;
        startMove(p, kind);
        emit({ k: 'sw', p: p.idx, c: p.c, kick: kind === 'k' || kind === 'j' ? 1 : 0 });
      }
    }
    if (p.bj > 0 && p.g && p.af < 0 && p.df <= 0) {
      p.bj = 0; p.vy = -JUMP_V * ch.jump; p.g = false;
    }
    if (p.df <= 0 && !(p.af >= 0 && (moveOf(p).air || moveOf(p).hop))) {
      let target = dir * MOVE_SPEED * ch.speed;
      if (p.af >= 0) target *= 0.2;
      else if (back && p.g) target *= 0.6;
      p.vx += (target - p.vx) * (p.g ? (p.af >= 0 ? 0.15 : 0.35) : 0.12);
    }
    mv = moveOf(p);
    if (p.af >= 0 && mv.drive && p.af >= mv.drive[0] && p.af <= mv.drive[1]) p.vx = p.f * mv.drive[2];

    const near = Math.abs(opp.x - p.x) < GUARD_RANGE;
    p.st = p.df > 0 ? ST.DASH : p.af >= 0 ? ST.ATK : !p.g ? ST.AIR
      : back && near ? ST.GUARD : Math.abs(p.vx) > 0.6 ? ST.WALK : ST.IDLE;
  }
  if (p.bj > 0) p.bj--;
  if (p.ba > 0) p.ba--;
  if (p.bd > 0) p.bd--;
  if (p.bsp > 0) p.bsp--;
  if (p.bu > 0) p.bu--;

  if (p.st === ST.HIT || p.st === ST.KO || p.st === ST.BLOCK) p.vx *= p.g ? 0.85 : 0.99;
  if (!(p.df > 0 && !p.g)) p.vy += GRAVITY;
  p.x += p.vx; p.y += p.vy;
  if (p.y >= GROUND) {
    p.y = GROUND;
    const fallV = p.vy;
    if (p.vy > 0) p.vy = 0;
    if (!p.g) {
      p.g = true; p.ad = false; p.ak = false;
      if (p.mv === 'j' && p.af >= 0) { p.af = -1; p.mv = 'n'; }
      if (p.hopped || fallV > 11) emit({ k: 'land', x: r1(p.x), y: GROUND, hv: p.hopped && p.af >= 0 && moveOf(p).fin ? 1 : 0 });
      p.hopped = false;
    }
  } else {
    p.g = false;
  }
  if (p.x < 24) { p.x = 24; if (p.vx < 0) p.vx = 0; }
  if (p.x > W - 24) { p.x = W - 24; if (p.vx > 0) p.vx = 0; }
}

function separate(a, b) {
  if (a.st === ST.KO || b.st === ST.KO || a.df > 0 || b.df > 0) return;
  if (Math.abs(a.y - b.y) >= 90) return;
  const dx = b.x - a.x, min = 34;
  if (Math.abs(dx) >= min) return;
  const s = dx >= 0 ? 1 : -1, push = (min - Math.abs(dx)) / 2;
  a.x = clamp(a.x - s * push, 24, W - 24);
  b.x = clamp(b.x + s * push, 24, W - 24);
}

function storePrevSeg(p) {
  if (p.af < 0) { p.prevSeg = null; return; }
  const pose = computePose(p, 0);
  p.prevSeg = {};
  for (const arm of moveOf(p).arms) p.prevSeg[arm] = bladeSeg(p, pose, arm);
}

function checkHits(att, def) {
  if (att.af < 0 || att.st !== ST.ATK || def.st === ST.KO || def.inv > 0) return;
  const hits = moveOf(att).hits;
  const wd = WEAPONS[CHAR[att.c].weapon];
  let pose = null;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (att.af < h.from || att.af > h.to || ((att.hm[def.idx] || 0) & (1 << i))) continue;
    pose = pose || computePose(att, 0);
    const cur = bladeSeg(att, pose, h.arm);
    const prev = att.prevSeg ? att.prevSeg[h.arm] : null;
    const box = hurtbox(def);
    let contact = null;
    const steps = prev ? 3 : 0;
    for (let k = 0; k <= steps && !contact; k++) {
      const t = steps ? k / steps : 1;
      const seg = prev ? {
        ax: prev.ax + (cur.ax - prev.ax) * t, ay: prev.ay + (cur.ay - prev.ay) * t,
        bx: prev.bx + (cur.bx - prev.bx) * t, by: prev.by + (cur.by - prev.by) * t, r: cur.r,
      } : cur;
      contact = segHitsRect(seg, box);
    }
    if (!contact) continue;
    const along = wd.from + contact.t * (wd.to * att.ws - wd.from);
    const amv = moveOf(att);
    const weak = (h.arm === 'main' || h.arm === 'off') && !amv.noWeak && !amv.fin && wd.tip > 0 && along < wd.tip && att.mv !== 's';
    const hh = weak ? { ...h, dmg: Math.max(1, Math.round(h.dmg * 0.5)), kb: h.kb * 0.5, up: (h.up ?? 3) * 0.6, weak: true } : h;
    applyHit(att, def, hh, i, contact);
    if (def.st === ST.KO || att.af < 0) return;
  }
}

function applyHit(att, def, h, i, pt) {
  att.hm[def.idx] = (att.hm[def.idx] || 0) | (1 << i);
  const dmv = def.af >= 0 ? moveOf(def) : null;
  if (dmv && dmv.counter && def.af >= dmv.counter[0] && def.af <= dmv.counter[1]) { triggerCounter(def, att); return; }

  const fromFront = def.f === (att.x >= def.x ? 1 : -1);
  const guarding = !def.noGuard && def.g && def.af < 0 && def.df <= 0 && def.hit <= 0 && fromFront && (def.st === ST.BLOCK || def.backT > 0);
  if (guarding && def.st !== ST.BLOCK && def.backT <= PARRY_WINDOW) { parry(att, def, pt); return; }
  if (guarding) { block(att, def, h, pt); return; }
  damage(att, def, h, pt);
}

function damage(att, def, h, pt) {
  if (att.dmgMul) h = { ...h, dmg: Math.max(1, Math.round(h.dmg * att.dmgMul)) };
  const g = game, dmv = def.af >= 0 ? moveOf(def) : null;
  if (g.story && g.story.survival) {
    if (att.idx === 0) survivalComboHit();
    else if (def.idx === 0) g.story.combo = 0;
  }
  const dir = att.x <= def.x ? 1 : -1;
  def.hp = Math.max(0, def.hp - h.dmg);
  def.fl = 10;
  if (att.mv !== 's') att.mp = Math.min(METER_MAX, att.mp + h.dmg * 1.1);
  def.mp = Math.min(METER_MAX, def.mp + h.dmg * 1.4);
  const armored = dmv && dmv.armor && def.af >= dmv.armor[0] && def.af <= dmv.armor[1] && def.hp > 0;
  if (armored) {
    def.vx += dir * 1.2;
  } else {
    def.af = -1; def.mv = 'n'; def.df = 0; def.bs = 0;
    def.hit = Math.round(10 + h.dmg * 0.5);
    def.vx = dir * h.kb;
    def.vy = -(h.up ?? 3);
    def.g = def.vy >= 0 && def.g;
    def.st = ST.HIT;
  }
  if (def.x <= 34 || def.x >= W - 34) att.vx -= dir * h.kb * 0.7;
  const fin = att.af >= 0 && (moveOf(att).fin || att.mv === 's') ? 1 : 0;
  g.hitstop = Math.max(g.hitstop, def.grunt ? (fin ? 5 : 2) : fin ? 9 : h.dmg >= 18 ? 8 : 4);
  emit({ k: 'hit', x: r1(pt.x), y: r1(pt.y), d: h.dmg, t: def.idx, hv: h.dmg >= 18 ? 1 : 0, a: armored ? 1 : 0, w: h.weak ? 1 : 0, g: def.grunt ? 1 : 0, fin, c: att.c });

  if (def.hp <= 0 && g.mode === 'story') {
    def.st = ST.KO; def.af = -1; def.mv = 'n'; def.df = 0; def.hit = 0; def.kt = 0; def.dz = 0;
    def.vx = dir * (def.grunt ? 9 : 11); def.vy = def.grunt ? -8 : -11; def.g = false;
    onStoryKO(def, att);
  } else if (def.hp <= 0) {
    def.st = ST.KO; def.af = -1; def.mv = 'n'; def.df = 0; def.hit = 0; def.kt = 0; def.dz = 0;
    def.vx = dir * 11; def.vy = -11; def.g = false;
    att.wins++;
    g.phase = PHASE.KO; g.pt = 0; g.hitstop = 18;
    g.winner = att.st === ST.KO ? -1 : att.idx;
    emit({ k: 'ko', t: def.idx });
  }
}

function block(att, def, h, pt) {
  const dir = att.x <= def.x ? 1 : -1;
  const chip = att.mv === 's' ? Math.round(h.dmg * 0.25) : 0;
  if (chip) def.hp = Math.max(1, def.hp - chip);
  def.st = ST.BLOCK;
  def.bs = Math.round(8 + h.dmg * 0.45);
  def.vx = dir * h.kb * 0.6;
  def.gd -= h.gd ?? h.dmg * 1.6;
  def.mp = Math.min(METER_MAX, def.mp + h.dmg * 0.6);
  if (att.mv !== 's') att.mp = Math.min(METER_MAX, att.mp + h.dmg * 0.3);
  if (def.x <= 34 || def.x >= W - 34) att.vx -= dir * h.kb * 0.6;
  game.hitstop = 3;
  if (def.gd <= 0) {
    def.gd = GUARD_MAX * 0.5; def.bs = 0;
    def.st = ST.HIT; def.hit = 46; def.dz = 46; def.vx = dir * 3;
    game.hitstop = 8;
    emit({ k: 'gbreak', x: r1(def.x), y: r1(def.y - 130), t: def.idx });
    return;
  }
  emit({ k: 'block', x: r1(pt.x), y: r1(pt.y), d: chip, t: def.idx });
}

function parry(att, def, pt) {
  const dir = att.x <= def.x ? 1 : -1;
  att.af = -1; att.mv = 'n'; att.df = 0; att.prevSeg = null;
  att.st = ST.HIT; att.hit = 30; att.dz = 30; att.vx = -dir * 4; att.fl = 6;
  def.backT = PARRY_WINDOW + 1;
  def.mp = Math.min(METER_MAX, def.mp + 18);
  game.hitstop = 10;
  emit({ k: 'parry', x: r1(pt.x), y: r1(pt.y), t: def.idx });
}

function triggerCounter(cao, att) {
  const ch = CHAR[cao.c];
  cao.f = att.x >= cao.x ? 1 : -1;
  startMove(cao, 'n');
  cao.af = 5;
  cao.hm = { [att.idx]: (1 << ch.attack.hits.length) - 1 };
  cao.inv = 16;
  cao.vx = cao.f * 6;
  att.af = -1; att.mv = 'n';
  emit({ k: 'counter', x: r1(cao.x), y: r1(cao.y - 130), t: cao.idx });
  damage(cao, att, ch.special.counterHit, { x: att.x, y: att.y - 62 });
}

function doRoar(p, opp) {
  const R = CHAR[p.c].special.roar;
  emit({ k: 'roar', x: r1(p.x + p.f * 10), y: r1(p.y - 100), t: p.idx });
  const targets = game.mode === 'story' && p.idx === 0 ? storyFoes() : [opp];
  for (const t of targets) {
    if (t.st === ST.KO || t.inv > 0) continue;
    if (Math.abs(t.x - p.x) > R.range * p.ws || Math.abs(t.y - p.y) > 160) continue;
    damage(p, t, { dmg: R.dmg, kb: 2, up: 0 }, { x: t.x, y: t.y - 70 });
    if (t.st !== ST.KO) { t.hit = R.stun; t.dz = R.stun; t.vx *= 0.3; }
  }
}

/* ----------------------------- 연습 모드 CPU ----------------------------- */
function updateAI(ai, me, opp, inp) {
  inp.l = inp.r = inp.a = false;
  if (game.phase !== PHASE.FIGHT || me.st === ST.KO) return;
  const dx = opp.x - me.x, adx = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
  const range = AI_RANGE[me.c] * me.ws;
  if (--ai.t <= 0) {
    ai.t = 10 + (Math.random() * 22) | 0;
    const r = Math.random();
    ai.mode = adx > range ? (r < 0.85 ? 'approach' : 'wait') : (r < 0.22 ? 'retreat' : r < 0.42 ? 'wait' : 'approach');
    const gr = Math.random();
    ai.guard = gr < 0.3 ? 'hold' : gr < 0.38 ? 'parry' : null;
  }
  let mv = 0;
  if (ai.mode === 'approach' && adx > range * 0.7) mv = dir;
  else if (ai.mode === 'retreat') mv = -dir;
  if (me.af < 0 && adx < 220) {
    if (ai.guard === 'hold' && (opp.af >= 0 || adx < AI_RANGE[opp.c] * 1.2)) mv = -dir;
    else if (ai.guard === 'parry' && opp.af >= 2) mv = -dir;
  }
  inp.l = mv < 0; inp.r = mv > 0;
  if (me.mp >= METER_MAX && me.af < 0 && adx < AI_SP_RANGE[me.c] * me.ws && Math.random() < 0.05) {
    if (me.c !== 'caocao' || (opp.af >= 0 && opp.af < 8)) inp.sc++;
  }
  if (me.af < 0 && Math.abs(opp.y - me.y) < 80) {
    if ((opp.st === ST.GUARD || opp.st === ST.BLOCK) && adx < 85 && Math.random() < 0.1) { inp.l = dir < 0; inp.r = dir > 0; inp.uc++; }
    else if (adx < 58 && Math.random() < 0.07) { inp.l = inp.r = false; inp.uc++; }
  }
  if (adx < range && me.af < 0 && Math.abs(opp.y - me.y) < 80 && Math.random() < 0.11) inp.ac++;
  if (opp.af >= 0 && opp.af < 10 && adx < 170 && me.dcd <= 0 && Math.random() < 0.05) {
    inp.l = dir > 0; inp.r = dir < 0; inp.dc++;
  }
  if (Math.random() < 0.006 || (opp.y < me.y - 60 && Math.random() < 0.03)) inp.jc++;
}

/* ----------------------------- 스토리 모드 -----------------------------
 * 웨이브: [[병졸종류, 수], ...]. boss.c는 영웅 id 또는 'elite'(이름 있는 적장). max는 동시에 화면에 있는 적 수.
 */
const STORIES = {
  liubei: {
    title: '인의의 길', hanja: '仁義之道', stages: [
      {
        name: '황건적 토벌', hanja: '黃巾討伐', faction: 'yellow', max: 4,
        waves: [[['sword', 5]], [['sword', 3], ['pike', 3]]],
        boss: { c: 'zhangfei', hp: 1.8, with: [['sword', 2]] },
        intro: [['유비', '황건적이 마을을 어지럽히고 있다. 백성을 지키러 가자!']],
        bossTalk: [['장비', '하하하! 네가 그 소문난 유비냐? 내 장팔사모부터 받아라!'], ['유비', '좋다! 실력으로 보여주마!']],
        outro: [['장비', '졌소! 오늘부터 형님으로 모시겠소!'], ['유비', '함께 천하의 백성을 구하자, 익덕!']],
      },
      {
        name: '호뢰관 전투', hanja: '虎牢關', faction: 'dong', max: 5,
        waves: [[['sword', 4], ['archer', 2]], [['pike', 4], ['archer', 2], ['sword', 2]]],
        boss: { c: 'lubu', hp: 1.6, with: [['pike', 2], ['archer', 1]] },
        intro: [['유비', '동탁의 군대가 호뢰관을 막고 있다. 화살을 조심하라!']],
        bossTalk: [['여포', '사람 중엔 여포, 말 중엔 적토! 누가 감히 내 앞에 서느냐!'], ['유비', '천하무쌍이라 해도 물러설 수는 없다!']],
        outro: [['여포', '흥, 오늘은 이쯤 해 두지.'], ['유비', '관문이 열렸다! 연합군이여, 진격하라!']],
      },
      {
        name: '서주 혈전', hanja: '徐州血戰', faction: 'wei', max: 6,
        waves: [[['sword', 4], ['pike', 3]], [['archer', 3], ['sword', 3], ['pike', 2]], [['pike', 4], ['archer', 3]]],
        boss: { c: 'caocao', hp: 2.2, with: [['sword', 2], ['archer', 2]] },
        intro: [['유비', '조조의 대군이 서주로 몰려온다. 물러설 수 없다!']],
        bossTalk: [['조조', '유비, 천하의 영웅은 그대와 나뿐이오. 내 밑으로 오시오!'], ['유비', '백성을 버리는 패도는 따를 수 없소!']],
        outro: [['조조', '흥, 오늘은 물러나 주지. 하지만 다음엔 다를 것이오.'], ['유비', '인의로 세상을 바로 세우리라!']],
      },
    ],
  },
  guanyu: {
    title: '의리의 길', hanja: '忠義之道', stages: [
      {
        name: '사수관', hanja: '汜水關', faction: 'dong', max: 4,
        waves: [[['sword', 4], ['pike', 2]], [['pike', 3], ['archer', 2], ['sword', 2]]],
        boss: { c: 'elite', name: '화웅', hanja: '華雄', hp: 1.6, with: [['sword', 2]] },
        intro: [['관우', '술이 식기 전에 돌아오겠소.']],
        bossTalk: [['화웅', '이름 없는 궁수 따위가 감히!'], ['관우', '내 청룡언월도가 대답하리라.']],
        outro: [['관우', '술이 아직 따뜻하군.']],
      },
      {
        name: '백마 전투', hanja: '白馬', faction: 'yuan', max: 5,
        waves: [[['sword', 3], ['archer', 3]], [['pike', 4], ['sword', 3]]],
        boss: { c: 'elite', name: '안량', hanja: '顔良', hp: 1.8, with: [['pike', 2], ['archer', 1]] },
        intro: [['관우', '원소의 맹장 안량이 백마를 포위했다. 단숨에 베어 버리겠다.']],
        bossTalk: [['안량', '누가 감히 내 앞을 막느냐!']],
        outro: [['관우', '조조에게 진 빚은 이것으로 갚았다.']],
      },
      {
        name: '오관돌파', hanja: '五關斬將', faction: 'wei', max: 6,
        waves: [[['pike', 4], ['sword', 2]], [['archer', 4], ['sword', 3]], [['sword', 3], ['pike', 3], ['archer', 2]]],
        boss: { c: 'caocao', hp: 2.2, with: [['sword', 2], ['archer', 2]] },
        intro: [['관우', '형님께 돌아가는 길, 다섯 관문이 막아서도 멈추지 않으리.']],
        bossTalk: [['조조', '운장, 정말 떠나겠소? 그렇다면 실력으로 보여주시오!'], ['관우', '승상의 은혜는 잊지 않겠소. 허나 의리를 저버릴 수는 없소!']],
        outro: [['조조', '…가시오. 그대 같은 의인을 막을 수는 없구려.'], ['관우', '형님, 지금 갑니다!']],
      },
    ],
  },
  zhangfei: {
    title: '호걸의 길', hanja: '豪傑之道', stages: [
      {
        name: '탁현의 들판', hanja: '涿縣', faction: 'yellow', max: 4,
        waves: [[['sword', 5]], [['pike', 3], ['sword', 3]]],
        boss: { c: 'guanyu', hp: 1.7, with: [['sword', 2]] },
        intro: [['장비', '황건적 놈들! 이 장비 님이 상대해 주마!']],
        bossTalk: [['관우', '힘만 믿고 날뛰는 자로군. 한 수 겨뤄 보겠소?'], ['장비', '좋소! 수염 긴 양반, 각오하시오!']],
        outro: [['관우', '대단한 힘이오. 유비 형님께 함께 가지 않겠소?'], ['장비', '하하! 좋소, 오늘부터 형제요!']],
      },
      {
        name: '서주성 수비', hanja: '徐州城', faction: 'yuan', max: 5,
        waves: [[['sword', 4], ['archer', 2]], [['pike', 3], ['archer', 3], ['sword', 2]]],
        boss: { c: 'elite', name: '문추', hanja: '文醜', hp: 1.8, with: [['sword', 2], ['archer', 1]] },
        intro: [['장비', '성을 지키라 하셨으니, 한 놈도 못 들어온다!']],
        bossTalk: [['문추', '장비라는 놈이 네놈이냐!'], ['장비', '그래, 내가 장익덕이다!']],
        outro: [['장비', '하하하! 다음은 누구냐!']],
      },
      {
        name: '장판교', hanja: '長坂橋', faction: 'wei', max: 6,
        waves: [[['sword', 4], ['pike', 3]], [['pike', 4], ['archer', 3]], [['sword', 4], ['archer', 3], ['pike', 2]]],
        boss: { c: 'caocao', hp: 2.2, with: [['pike', 2], ['archer', 2]] },
        intro: [['장비', '나는 연인 장익덕이다! 누가 나와 죽기로 싸우겠느냐!']],
        bossTalk: [['조조', '저 고함 소리… 장비로구나. 내가 직접 상대하마!']],
        outro: [['조조', '물러나라! 장비의 함정일지도 모른다!'], ['장비', '하하하! 조조가 꽁무니를 빼는구나!']],
      },
    ],
  },
  caocao: {
    title: '패왕의 길', hanja: '霸王之道', stages: [
      {
        name: '영천 토벌', hanja: '潁川', faction: 'yellow', max: 4,
        waves: [[['sword', 4], ['pike', 2]], [['sword', 3], ['pike', 2], ['archer', 2]]],
        boss: { c: 'elite', name: '장각', hanja: '張角', hp: 1.6, with: [['sword', 2]] },
        intro: [['조조', '난세를 끝낼 자는 바로 나다. 황건적부터 쓸어버려라!']],
        bossTalk: [['장각', '푸른 하늘은 이미 죽었다!'], ['조조', '하늘의 뜻은 내가 정한다.']],
        outro: [['조조', '난세의 간웅이라… 좋은 칭호로군.']],
      },
      {
        name: '서주 공략', hanja: '徐州攻略', faction: 'shu', max: 5,
        waves: [[['sword', 4], ['pike', 2]], [['archer', 3], ['pike', 3], ['sword', 2]]],
        boss: { c: 'zhangfei', hp: 1.9, with: [['sword', 2], ['archer', 1]] },
        intro: [['조조', '유비가 서주를 차지했다. 기회를 주지 않겠다.']],
        bossTalk: [['장비', '조조 이놈! 형님의 성에 발을 들이다니!'], ['조조', '용맹하구나. 그 용맹, 내 아래에서 쓰지 않겠느냐?']],
        outro: [['장비', '큭… 다음엔 반드시 이긴다!'], ['조조', '유비에겐 아까운 장수로군.']],
      },
      {
        name: '장판 추격', hanja: '長坂追擊', faction: 'shu', max: 6,
        waves: [[['sword', 4], ['pike', 3]], [['archer', 3], ['sword', 4]], [['pike', 4], ['archer', 3], ['sword', 2]]],
        boss: { c: 'zhaoyun', hp: 2.0, with: [['sword', 2], ['pike', 1]] },
        intro: [['조조', '유비의 백성들 사이로 홀로 달리는 장수가 있다고?']],
        bossTalk: [['조자룡', '나는 상산의 조자룡이다! 길을 비켜라!'], ['조조', '저토록 뛰어난 장수를… 꼭 내 사람으로 만들고 싶구나!']],
        outro: [['조조', '놓쳤구나. 허나 저런 장수를 보았으니 그것으로 족하다.']],
      },
    ],
  },
  zhaoyun: {
    title: '충의의 길', hanja: '忠勇之道', stages: [
      {
        name: '반하 전투', hanja: '磐河', faction: 'yuan', max: 4,
        waves: [[['sword', 4], ['archer', 2]], [['pike', 3], ['sword', 3]]],
        boss: { c: 'elite', name: '문추', hanja: '文醜', hp: 1.6, with: [['sword', 2]] },
        intro: [['조자룡', '공손찬 장군을 구해야 한다!']],
        bossTalk: [['문추', '애송이가 감히!'], ['조자룡', '상산의 조자룡, 여기 있다!']],
        outro: [['조자룡', '장군, 무사하십니까!']],
      },
      {
        name: '장판파 단기돌파', hanja: '長坂坡', faction: 'wei', max: 6,
        waves: [[['sword', 5], ['pike', 2]], [['pike', 4], ['archer', 3]], [['sword', 4], ['archer', 2], ['pike', 3]]],
        boss: { c: 'elite', name: '하후은', hanja: '夏侯恩', hp: 1.7, with: [['pike', 2], ['archer', 1]] },
        intro: [['조자룡', '주공의 아드님을 찾아야 한다. 백만 대군이라도 뚫고 가겠다!']],
        bossTalk: [['하후은', '이 청강검 앞에 무릎 꿇어라!']],
        outro: [['조자룡', '아두 공자님을 찾았다! 이제 돌아간다!']],
      },
      {
        name: '장판파 탈출', hanja: '七進七出', faction: 'wei', max: 6,
        waves: [[['pike', 4], ['sword', 3]], [['archer', 4], ['sword', 4]]],
        boss: { c: 'caocao', hp: 2.2, with: [['sword', 2], ['archer', 2]] },
        intro: [['조자룡', '공자님을 품에 안고… 반드시 주공께 돌아간다!']],
        bossTalk: [['조조', '과연 명불허전! 내가 직접 시험해 보마!'], ['조자룡', '누구도 이 길을 막을 수 없다!']],
        outro: [['조조', '칠진칠출… 저런 장수가 유비에게 있다니.'], ['조자룡', '주공! 공자님은 무사하십니다!']],
      },
    ],
  },
  lubu: {
    title: '무쌍의 길', hanja: '無雙之道', stages: [
      {
        name: '호뢰관 삼영전', hanja: '虎牢關', faction: 'yuan', max: 5,
        waves: [[['sword', 4], ['pike', 2]], [['pike', 3], ['archer', 2], ['sword', 3]]],
        boss: { c: 'zhangfei', hp: 1.8, with: [['sword', 2]] },
        intro: [['여포', '연합군 따위가 몰려와 봐야 소용없다. 이 방천화극을 받아라!']],
        bossTalk: [['장비', '세 성을 섬긴 종놈아! 이 장익덕이 상대해 주마!'], ['여포', '시끄러운 놈이로군. 덤벼라!']],
        outro: [['장비', '큭… 형님들이 오기 전에 쓰러질 순 없는데!'], ['여포', '천하에 나를 당할 자는 없다!']],
      },
      {
        name: '서주 탈취', hanja: '徐州', faction: 'shu', max: 5,
        waves: [[['sword', 4], ['archer', 2]], [['pike', 4], ['sword', 3]], [['archer', 3], ['pike', 3], ['sword', 2]]],
        boss: { c: 'liubei', hp: 1.9, with: [['sword', 2], ['archer', 1]] },
        intro: [['여포', '유비가 성을 비운 틈이다. 서주는 내가 차지한다!']],
        bossTalk: [['유비', '은혜를 원수로 갚는구려, 여포!'], ['여포', '난세에 은혜 따위가 무슨 소용이냐!']],
        outro: [['유비', '…오늘은 물러나지만, 백성은 그대를 따르지 않을 것이오.'], ['여포', '서주는 이제 내 것이다!']],
      },
      {
        name: '하비성 결전', hanja: '下邳', faction: 'wei', max: 6,
        waves: [[['pike', 4], ['sword', 3]], [['archer', 4], ['sword', 3]], [['sword', 4], ['pike', 3], ['archer', 2]]],
        boss: { c: 'caocao', hp: 2.2, with: [['sword', 2], ['archer', 2]] },
        intro: [['여포', '조조의 대군이 하비성을 에워쌌다. 끝까지 싸운다!']],
        bossTalk: [['조조', '여포, 그대의 무용은 아깝지만 여기까지다.'], ['여포', '천하무쌍 여포가 쉽게 쓰러질 것 같으냐!']],
        outro: [['조조', '…저 무용, 과연 천하무쌍이로다.'], ['여포', '하비성은 무너지지 않는다!']],
      },
    ],
  },
};
const STORY_KEY = 'sb_story_v1';
const STORY_HP_MUL = 2.0, STORY_BOSS_HP = 0.75, STORY_BOSS_DMG = 0.75;
const MAX_ENGAGED = 2;

function storyProgress() {
  try { return JSON.parse(localStorage.getItem(STORY_KEY)) || {}; } catch (e) { return {}; }
}

function saveStoryClear(c, idx, rec) {
  const all = storyProgress();
  const e = all[c] || { cleared: 0, best: {} };
  e.cleared = Math.max(e.cleared, idx + 1);
  const b = e.best[idx];
  if (!b || rec.time < b.time) e.best[idx] = rec;
  all[c] = e;
  try { localStorage.setItem(STORY_KEY, JSON.stringify(all)); } catch (err) { /* 저장 불가 */ }
}

const storyFoes = () => game.players.filter(p => p.idx !== 0 && p.st !== ST.KO && !p.gone);

function startStory(charId, stageIdx) {
  const st = STORIES[charId].stages[stageIdx];
  const hc = $('handicap').checked;
  game = {
    mode: 'story', me: 0, code: '', handicap: hc,
    players: [], phase: PHASE.FIGHT, pt: 0, round: 1, frame: 0, hitstop: 0, winner: -1,
    inputs: [newInput()], pending: [], lastF: -1, seen: new Set(), ai: null, lastRecv: performance.now(),
    projs: [], items: [],
    story: {
      c: charId, idx: stageIdx, st, wave: -1, queue: [], spawnT: 0, side: 1, kills: 0, time: 0, dmgTaken: 0,
      phase: 'talk', phaseT: 0, talk: null, nextIdx: 1, boss: null, bossSpawned: false, banner: null, engaged: new Set(),
    },
  };
  const me = makePlayer(0, charId, hc);
  me.maxHp = me.hp = me.hpLag = Math.round(me.maxHp * STORY_HP_MUL);
  me.x = me.rx = W * 0.35;
  game.players.push(me);
  enterGame();
  storyTalk(st.intro, () => nextWave());
}

/* ----------------------------- 서바이벌 모드 -----------------------------
 * 쓰러질 때까지 끝없는 웨이브. 웨이브마다 적이 늘고 강해지며 5웨이브마다 영웅 보스가 나온다.
 * 점수 = 격파 점수 × 콤보 배율(연속 타격 50회에서 최대 ×2) + 웨이브 보너스.
 */
const SURV_POINTS = { sword: 100, pike: 120, archer: 150, elite: 400 };
const SURV_BOSS_POINTS = 1500;
const SURV_FACTIONS = ['yellow', 'dong', 'yuan', 'wei', 'shu'];
const COMBO_KEEP = 150;
const SURV_HP_MUL = 2.5;

function startSurvival(charId) {
  const hc = $('handicap').checked;
  game = {
    mode: 'story', me: 0, code: '', handicap: hc,
    players: [], phase: PHASE.FIGHT, pt: 0, round: 1, frame: 0, hitstop: 0, winner: -1,
    inputs: [newInput()], pending: [], lastF: -1, seen: new Set(), ai: null, lastRecv: performance.now(),
    projs: [], items: [],
    story: {
      survival: true, c: charId, idx: 0, st: { name: '서바이벌', hanja: '無雙', faction: 'yellow', max: 4, waves: [] },
      wave: -1, queue: [], spawnT: 0, side: 1, kills: 0, time: 0, dmgTaken: 0,
      phase: 'fight', phaseT: 0, talk: null, nextIdx: 1, boss: null, bossSpawned: false, banner: null, engaged: new Set(),
      score: 0, combo: 0, comboT: 0, maxCombo: 0, hpMul: 1, dmgMul: 1, maxEngaged: MAX_ENGAGED,
    },
  };
  const me = makePlayer(0, charId, hc);
  me.maxHp = me.hp = me.hpLag = Math.round(me.maxHp * SURV_HP_MUL);
  me.x = me.rx = W / 2;
  game.players.push(me);
  enterGame();
  nextSurvivalWave();
}

function nextSurvivalWave() {
  const g = game, S = g.story;
  S.wave++;
  const n = S.wave + 1;
  S.phase = 'fight';
  if (n > 1) {
    const bonus = (n - 1) * 100;
    S.score += bonus;
    emit({ k: 'score', x: r1(g.players[0].x), y: r1(g.players[0].y - 150), d: bonus, wave: 1 });
    storyHeal(0.15);
  }
  S.st.faction = SURV_FACTIONS[(n - 1) % SURV_FACTIONS.length];
  S.st.max = Math.min(8, 4 + Math.floor(n / 3));
  S.maxEngaged = Math.min(3, MAX_ENGAGED + Math.floor(n / 8));
  S.hpMul = 1 + 0.05 * (n - 1);
  S.dmgMul = Math.min(2, 1 + 0.035 * (n - 1));
  const total = Math.min(24, Math.round(4 + n * 1.2));
  const archers = Math.floor(total * Math.min(0.35, 0.1 + n * 0.02));
  const elites = n >= 4 ? Math.min(4, Math.floor((n - 1) / 3)) : 0;
  const pikes = Math.floor((total - archers - elites) * 0.4);
  const swords = Math.max(0, total - archers - elites - pikes);
  const queue = [];
  const push = (t, k) => { for (let i = 0; i < k; i++) queue.push(t); };
  push('sword', swords); push('pike', pikes); push('archer', archers); push('elite', elites);
  for (let i = queue.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [queue[i], queue[j]] = [queue[j], queue[i]]; }
  S.queue = queue; S.spawnT = 40;
  if (n % 5 === 0) {
    const pool = CHARACTERS.filter(h => h.id !== S.c);
    const c = pool[(Math.random() * pool.length) | 0].id;
    const e = spawnEnemy(c, { isBoss: true, dmgMul: STORY_BOSS_DMG * S.dmgMul });
    e.maxHp = e.hp = e.hpLag = Math.round(BASE_HP * CHAR[c].hp * (1.3 + 0.15 * (n / 5)) * STORY_BOSS_HP);
    e.mp = 30; e.grunt = false; e.noGuard = false;
    S.boss = e;
    S.queue = queue.slice(0, Math.ceil(queue.length / 2));
    storyBanner(`제 ${n} 웨이브 · 적장 출현!`, `${CHAR[c].hanja} ${CHAR[c].name}`, '#e0463a');
  } else {
    storyBanner(`제 ${n} 웨이브`, `${FACTIONS[S.st.faction].name} ${total}명`);
  }
}

function survivalScore(def) {
  const S = game.story;
  const base = def === S.boss ? SURV_BOSS_POINTS : SURV_POINTS[def.c] || 100;
  const pts = Math.round(base * (1 + Math.min(1, S.combo / 50)));
  S.score += pts;
  emit({ k: 'score', x: r1(def.x), y: r1(def.y - 120), d: pts });
}

function survivalComboHit() {
  const S = game.story;
  S.combo++; S.comboT = COMBO_KEEP;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
}

/* 랭킹: 이 기기(localStorage)는 항상 저장한다. RANK_DB_URL에 Firebase Realtime Database 주소를 넣으면 전체 랭킹도 함께 쓴다. */
const RANK_DB_URL = 'https://stick-brawl-14e05-default-rtdb.asia-southeast1.firebasedatabase.app';
const RANK_KEY = 'sb_rank_v1';
const RANK_SIZE = 10;

const cleanName = s => (String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '무명');
const validRec = r => r && typeof r.name === 'string' && Number.isFinite(r.score) && Number.isFinite(r.ts);

const Rank = {
  all() { try { return JSON.parse(localStorage.getItem(RANK_KEY)) || {}; } catch (e) { return {}; } },
  local(c) { return (this.all()[c] || []).filter(validRec); },
  addLocal(c, rec) {
    const all = this.all();
    const list = (all[c] || []).filter(validRec);
    list.push(rec);
    list.sort((a, b) => b.score - a.score || a.ts - b.ts);
    all[c] = list.slice(0, RANK_SIZE);
    try { localStorage.setItem(RANK_KEY, JSON.stringify(all)); } catch (e) { /* 저장 불가 */ }
    const pos = all[c].indexOf(rec);
    return pos >= 0 ? pos + 1 : 0;
  },
  async push(c, rec) {
    if (!RANK_DB_URL) return false;
    try {
      const res = await fetch(`${RANK_DB_URL}/survival/${c}.json`, { method: 'POST', body: JSON.stringify(rec) });
      return res.ok;
    } catch (e) { return false; }
  },
  async global(c) {
    if (!RANK_DB_URL) return null;
    try {
      const res = await fetch(`${RANK_DB_URL}/survival/${c}.json?orderBy=%22score%22&limitToLast=${RANK_SIZE}`);
      if (!res.ok) return null;
      const data = await res.json();
      return Object.values(data || {}).filter(validRec).sort((a, b) => b.score - a.score).slice(0, RANK_SIZE);
    } catch (e) { return null; }
  },
};

function storyBanner(text, sub, col = PAPER_LIGHT) {
  game.story.banner = { text, sub, col, t0: game.frame };
}

function nextWave() {
  const g = game, S = g.story;
  S.wave++;
  S.phase = 'fight';
  const queue = [];
  for (const [type, n] of S.st.waves[S.wave]) for (let i = 0; i < n; i++) queue.push(type);
  for (let i = queue.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [queue[i], queue[j]] = [queue[j], queue[i]]; }
  S.queue = queue; S.spawnT = 30;
  const me = g.players[0];
  if (S.wave > 0) storyHeal(0.2);
  storyBanner(`第${hanNum(S.wave + 1)}陣`, `제 ${S.wave + 1}진 · ${FACTIONS[S.st.faction].name}`);
}

function storyHeal(frac) {
  const me = game.players[0];
  const heal = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * frac));
  if (heal <= 0) return;
  me.hp += heal;
  emit({ k: 'heal', x: r1(me.x), y: r1(me.y - 130), d: heal });
}

function spawnEnemy(type, opts = {}) {
  const g = game, S = g.story, me = g.players[0];
  S.side = -S.side;
  let x = S.side > 0 ? W - 30 : 30;
  if (Math.abs(x - me.x) < 140) x = W - x;
  const e = makePlayer(S.nextIdx++, type, false);
  const ch = CHAR[type], fac = FACTIONS[S.st.faction];
  e.x = e.rx = x; e.f = x > me.x ? -1 : 1;
  e.inp = newInput();
  e.ai = { t: 0, mode: 'approach', cd: 30 + Math.random() * 50 };
  e.inv = 20;
  if (ch.soldier) {
    e.body = fac.body; e.helm = fac.helm; e.band = fac.band;
    e.grunt = !ch.elite;
    e.noGuard = !ch.elite;
    if (S.survival) { e.maxHp = e.hp = e.hpLag = Math.round(e.maxHp * S.hpMul); e.dmgMul = S.dmgMul; }
  }
  Object.assign(e, opts);
  g.players.push(e);
  return e;
}

function spawnBoss() {
  const S = game.story, b = S.st.boss;
  const e = spawnEnemy(b.c, { isBoss: true, bossName: b.name, bossHanja: b.hanja, dmgMul: STORY_BOSS_DMG });
  e.maxHp = e.hp = e.hpLag = Math.round(e.maxHp * b.hp * STORY_BOSS_HP);
  storyHeal(0.3);
  e.mp = 30;
  e.grunt = false; e.noGuard = false;
  S.boss = e;
  const queue = [];
  for (const [type, n] of b.with || []) for (let i = 0; i < n; i++) queue.push(type);
  S.queue = queue; S.spawnT = 120;
  const name = fighterName(e);
  storyBanner('적장 출현!', `${name.hanja} ${name.name}`, '#e0463a');
}

function fighterName(p) {
  const ch = CHAR[p.c];
  return { name: p.bossName || ch.name, hanja: p.bossHanja || ch.hanja };
}

function storyTalk(lines, done) {
  const S = game.story;
  S.phase = 'talk';
  S.talk = { lines: lines || [], i: 0, done };
  showTalkLine();
}

function showTalkLine() {
  const S = game && game.story;
  if (!S || !S.talk) return;
  const line = S.talk.lines[S.talk.i];
  if (!line) {
    const done = S.talk.done;
    S.talk = null;
    $('talk').classList.add('hidden');
    if (done) done();
    return;
  }
  $('talkName').textContent = line[0];
  $('talkText').textContent = line[1];
  $('talk').classList.remove('hidden');
}

function advanceTalk() {
  const S = game && game.story;
  if (!S || !S.talk) return;
  S.talk.i++;
  showTalkLine();
}

function onStoryKO(def, att) {
  const g = game, S = g.story;
  if (def.idx === 0) {
    S.phase = 'fail'; S.phaseT = 0; g.hitstop = 16;
    emit({ k: 'ko', t: 0 });
    return;
  }
  S.kills++;
  emit({ k: def === S.boss ? 'ko' : 'gko', x: r1(def.x), y: r1(def.y - 60), t: def.idx });
  if (def.grunt && Math.random() < (S.survival ? 0.16 : 0.15)) g.items.push({ x: def.x, y: GROUND - 10, life: 600 });
  if (S.survival) {
    survivalScore(def);
    if (def === S.boss) { S.boss = null; g.hitstop = 16; storyHeal(0.25); }
    return;
  }
  if (def === S.boss) {
    S.phase = 'clear'; S.phaseT = 0; g.hitstop = 20;
    for (const e of storyFoes()) e.flee = true;
  }
}

function storyStep() {
  const g = game, S = g.story;
  g.frame++;
  if (S.phase === 'talk' || S.phase === 'result') return;
  if (g.hitstop > 0) { g.hitstop--; return; }
  g.pt++;
  const me = g.players[0];
  const fighting = S.phase === 'fight' && me.st !== ST.KO;
  if (fighting) S.time++;
  if (S.comboT > 0 && --S.comboT === 0) S.combo = 0;

  if (S.phase === 'fight' && S.queue.length && storyFoes().length < S.st.max && --S.spawnT <= 0) {
    spawnEnemy(S.queue.shift());
    S.spawnT = 45;
  }
  if (g.frame % 20 === 0) {
    const melee = storyFoes().filter(e => e.grunt && e.c !== 'archer' && !e.flee);
    melee.sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
    S.engaged = new Set(melee.slice(0, S.maxEngaged || MAX_ENGAGED).map(e => e.idx));
  }

  const enemies = g.players.filter(p => p.idx !== 0);
  for (const e of enemies) enemyAI(e, me, fighting);

  const foes = storyFoes();
  let target = null, best = Infinity;
  for (const e of foes) { const d = Math.abs(e.x - me.x) + (e.flee ? 1000 : 0); if (d < best) { best = d; target = e; } }
  const hpBefore = me.hp;
  updatePlayer(me, g.inputs[0], target || { x: me.x + me.f * 400, y: me.y, st: ST.IDLE }, fighting);
  for (const e of enemies) updatePlayer(e, e.inp, me, fighting || !!e.flee);

  for (const e of enemies) separate(me, e);
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) separateSoft(enemies[i], enemies[j]);

  if (S.phase === 'fight') {
    for (const e of enemies) {
      if (e.gone) continue;
      checkHits(me, e);
      if (me.st !== ST.KO) checkHits(e, me);
    }
  }
  updateProjs();
  updateItems(me);
  if (me.hp < hpBefore) S.dmgTaken += hpBefore - me.hp;
  for (const p of g.players) storePrevSeg(p);
  g.players = g.players.filter(p => p.idx === 0 || !(p.gone || (p.st === ST.KO && p.kt > 70)));

  if (S.phase === 'fight' && !S.queue.length && storyFoes().length === 0) {
    if (S.survival) nextSurvivalWave();
    else if (S.wave < S.st.waves.length - 1) nextWave();
    else if (!S.bossSpawned) {
      S.bossSpawned = true;
      spawnBoss();
      storyTalk(S.st.bossTalk, () => { S.phase = 'fight'; });
    }
  }
  if (S.phase === 'clear' || S.phase === 'fail') {
    S.phaseT++;
    if (S.phaseT === 130) {
      if (S.survival) showSurvivalResult();
      else if (S.phase === 'clear') storyTalk(S.st.outro, () => showStoryResult(true));
      else showStoryResult(false);
    }
  }
  g.pending.length = 0;
}

function separateSoft(a, b) {
  if (a.st === ST.KO || b.st === ST.KO || Math.abs(a.y - b.y) >= 90) return;
  const dx = b.x - a.x, min = 24;
  if (Math.abs(dx) >= min) return;
  const s = dx >= 0 ? 1 : -1, push = (min - Math.abs(dx)) / 4;
  a.x = clamp(a.x - s * push, 24, W - 24);
  b.x = clamp(b.x + s * push, 24, W - 24);
}

function enemyAI(e, me, fighting) {
  const inp = e.inp;
  inp.l = inp.r = inp.a = false;
  if (e.st === ST.KO || !fighting && !e.flee) return;
  const dx = me.x - e.x, adx = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
  if (e.flee) {
    const out = e.x < W / 2 ? -1 : 1;
    inp.l = out < 0; inp.r = out > 0;
    if (e.x <= 26 || e.x >= W - 26) e.gone = true;
    return;
  }
  if (e.isBoss || !e.grunt) { updateAI(e.ai, e, me, inp); return; }
  if (e.ai.cd > 0) e.ai.cd--;
  let mv = 0;
  if (e.c === 'archer') {
    const wallBehind = (dir > 0 && e.x < 60) || (dir < 0 && e.x > W - 60);
    if (adx < 170 && !wallBehind) mv = -dir;
    else if (adx > 470) mv = dir;
    if (e.af < 0 && e.ai.cd <= 0 && adx > 90 && adx < 560 && Math.abs(me.y - e.y) < 60) { inp.ac++; e.ai.cd = 80 + Math.random() * 70; }
  } else if (game.story.engaged.has(e.idx)) {
    const range = AI_RANGE[e.c];
    if (adx > range * 0.8) mv = dir;
    else if (e.af < 0 && e.ai.cd <= 0 && Math.abs(me.y - e.y) < 70) { inp.ac++; e.ai.cd = 55 + Math.random() * 50; }
  } else {
    const want = 190 + (e.idx % 3) * 35;
    if (adx < want - 30) mv = -dir;
    else if (adx > want + 40) mv = dir;
  }
  inp.l = mv < 0; inp.r = mv > 0;
}

function fireArrow(p) {
  if (!game.projs) return;
  game.projs.push({ kind: 'arrow', x: p.x + p.f * 34, y: p.y - 96, vx: p.f * 9.5, vy: -0.5, owner: p, dmg: 5, life: 150 });
  emit({ k: 'shoot', p: p.idx });
}

function spawnWave(p, W2) {
  if (!game.projs) return;
  game.projs.push({ kind: 'wave', x: p.x + p.f * 46, y: p.y - 64, vx: p.f * W2.speed, vy: 0, owner: p, dmg: W2.dmg, life: W2.life, hit: new Set() });
  emit({ k: 'wavefx', p: p.idx });
}

const isFoe = (a, b) => (game.mode === 'story' ? (a.idx === 0) !== (b.idx === 0) : a !== b);

function activeCutSegs(t) {
  if (t.af < 0 || t.st !== ST.ATK) return null;
  const active = moveOf(t).hits.filter(h => t.af >= h.from && t.af <= h.to);
  if (!active.length) return null;
  const pose = computePose(t, 0);
  return active.map(h => bladeSeg(t, pose, h.arm));
}

/* 화살은 첫 대상에 맞으면 사라지고 무기로 쳐낼 수 있다. 검기는 관통하며 대상마다 한 번씩 맞힌다. */
function updateProjs() {
  const g = game;
  if (!g.projs || !g.projs.length) return;
  for (const a of g.projs) {
    a.x += a.vx; a.y += a.vy; a.life--;
    if (a.kind === 'arrow') a.vy += 0.03;
    const targets = g.players.filter(t => t !== a.owner && t.st !== ST.KO && !t.gone && isFoe(a.owner, t));
    for (const t of targets) {
      if (a.dead) break;
      if (a.kind === 'arrow') {
        const cut = activeCutSegs(t);
        if (cut && cut.some(s => distToSeg(a.x, a.y, s) < s.r + 8)) {
          a.dead = true;
          emit({ k: 'deflect', x: r1(a.x), y: r1(a.y) });
          break;
        }
      }
      if (t.inv > 0 || (a.hit && a.hit.has(t.idx))) continue;
      const hb = hurtbox(t), pad = a.kind === 'wave' ? 16 : 4;
      if (a.x < hb.x0 - pad || a.x > hb.x1 + pad || a.y < hb.y0 - pad || a.y > hb.y1) continue;
      const h = { dmg: a.dmg, kb: a.kind === 'wave' ? 7 : 3, up: 2 };
      const pt = { x: a.x, y: a.y };
      const fromFront = t.f === (a.vx < 0 ? 1 : -1);
      const guarding = !t.noGuard && t.g && t.af < 0 && t.df <= 0 && t.hit <= 0 && fromFront && (t.st === ST.BLOCK || t.backT > 0);
      if (guarding) {
        if (a.kind === 'arrow') { t.gd -= 8; emit({ k: 'block', x: r1(a.x), y: r1(a.y), d: 0, t: t.idx }); }
        else block(a.owner, t, h, pt);
      } else {
        damage(a.owner, t, h, pt);
      }
      if (a.kind === 'arrow') a.dead = true;
      else a.hit.add(t.idx);
    }
    if (a.x < -40 || a.x > W + 40 || a.y > GROUND || a.life <= 0) a.dead = true;
  }
  g.projs = g.projs.filter(a => !a.dead);
}

function distToSeg(x, y, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - s.ax) * dx + (y - s.ay) * dy) / l2, 0, 1);
  return Math.hypot(x - (s.ax + dx * t), y - (s.ay + dy * t));
}

function updateItems(me) {
  const g = game;
  for (const it of g.items) {
    it.life--;
    if (me.st !== ST.KO && Math.abs(me.x - it.x) < 30 && me.y > GROUND - 60) {
      it.dead = true;
      const heal = 18;
      me.hp = Math.min(me.maxHp, me.hp + heal);
      emit({ k: 'heal', x: r1(it.x), y: r1(it.y - 40), d: heal });
    }
  }
  g.items = g.items.filter(it => !it.dead && it.life > 0);
}

function showStoryResult(win) {
  const S = game.story;
  S.phase = 'result';
  const me = game.players[0];
  const secs = Math.round(S.time / 60);
  const total = STORIES[S.c].stages.length;
  if (win) saveStoryClear(S.c, S.idx, { time: secs, kills: S.kills });
  $('resultTitle').textContent = win ? `${S.st.name} 승리!` : '패배…';
  $('resultStats').innerHTML = [
    ['격파', `${S.kills}명`],
    ['시간', `${Math.floor(secs / 60)}분 ${secs % 60}초`],
    ['남은 체력', win ? `${Math.ceil(me.hp)} / ${me.maxHp}` : '-'],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('resultNext').classList.toggle('hidden', !win || S.idx + 1 >= total);
  $('resultSub').textContent = win
    ? (S.idx + 1 >= total ? `「${STORIES[S.c].title}」 완결! 천하에 이름을 떨쳤다.` : '다음 전장으로 나아가자.')
    : '다시 도전해 보세요. 막기와 발차기를 섞어 보세요!';
  $('storyResult').classList.remove('hidden');
}

const fmtSecs = s => `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
const fmtDate = ts => {
  const d = new Date(ts), z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const escHtml = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function showSurvivalResult() {
  const S = game.story;
  S.phase = 'result';
  const secs = Math.round(S.time / 60);
  S.record = { name: '', score: S.score, kills: S.kills, wave: S.wave + 1, time: secs, combo: S.maxCombo, ts: Date.now(), c: S.c };
  const best = Rank.local(S.c)[0];
  const ch = CHAR[S.c];
  $('survTitle').textContent = `${ch.hanja} ${ch.name} 전사…`;
  $('survSub').textContent = !best || S.score > best.score ? '이 기기 최고 기록!' : `이 기기 최고 기록 ${best.score.toLocaleString()}점`;
  $('survStats').innerHTML = [
    ['점수', S.score.toLocaleString()],
    ['격파', `${S.kills}명`],
    ['웨이브', `${S.wave + 1}`],
    ['생존', fmtSecs(secs)],
    ['최대 콤보', `${S.maxCombo}`],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('survName').value = localStorage.getItem('sb_name') || '';
  $('survName').disabled = false;
  $('survSave').disabled = S.score <= 0;
  $('survSave').textContent = '기록 남기기';
  $('survMsg').textContent = S.score > 0 ? '이름을 남기면 랭킹에 기록돼요.' : '';
  $('survResult').classList.remove('hidden');
}

async function saveSurvivalRecord() {
  const S = game && game.story;
  if (!S || !S.record || S.recordSaved) return;
  const name = cleanName($('survName').value);
  localStorage.setItem('sb_name', name);
  const rec = { ...S.record, name };
  S.recordSaved = true;
  $('survSave').disabled = true; $('survName').disabled = true;
  const pos = Rank.addLocal(S.c, rec);
  let msg = pos ? `이 기기 랭킹 ${pos}위에 기록됐어요!` : '이 기기 랭킹 10위 안에는 들지 못했어요.';
  $('survMsg').textContent = msg + (RANK_DB_URL ? ' 전체 랭킹에 올리는 중…' : '');
  if (RANK_DB_URL) {
    const ok = await Rank.push(S.c, rec);
    $('survMsg').textContent = msg + (ok ? ' 전체 랭킹에도 올라갔어요.' : ' (전체 랭킹 전송 실패)');
  }
  $('survSave').textContent = '기록 완료';
}

let rankChar = null, rankScope = 'local';

async function buildRankScreen() {
  const c = rankChar || selectedChar;
  rankChar = c;
  const tabs = $('rankTabs');
  tabs.innerHTML = '';
  for (const h of CHARACTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'story-tab' + (h.id === c ? ' on' : '');
    b.textContent = h.name;
    b.addEventListener('click', () => { rankChar = h.id; buildRankScreen(); });
    tabs.appendChild(b);
  }
  $('rankLocal').classList.toggle('on', rankScope === 'local');
  $('rankGlobal').classList.toggle('on', rankScope === 'global');
  const body = $('rankBody');
  const note = $('rankNote');
  let list;
  if (rankScope === 'global') {
    if (!RANK_DB_URL) {
      body.innerHTML = '';
      note.textContent = '전체 랭킹은 아직 설정되지 않았어요. (README의 "전체 랭킹 설정" 참고)';
      return;
    }
    note.textContent = '불러오는 중…';
    list = await Rank.global(c);
    if (rankChar !== c || rankScope !== 'global') return;
    if (!list) { body.innerHTML = ''; note.textContent = '전체 랭킹을 불러오지 못했어요.'; return; }
  } else {
    list = Rank.local(c);
  }
  note.textContent = list.length ? '' : '아직 기록이 없어요. 서바이벌에 도전해 보세요!';
  body.innerHTML = list.map((r, i) => `<tr${i < 3 ? ` class="top${i + 1}"` : ''}>
    <td>${i + 1}</td><td class="nm">${escHtml(cleanName(r.name))}</td><td class="sc">${Math.round(r.score).toLocaleString()}</td>
    <td>${r.kills | 0}</td><td>${r.wave | 0}</td><td>${fmtSecs(r.time | 0)}</td><td class="dt">${fmtDate(r.ts)}</td></tr>`).join('');
}

/* ----------------------------- 네트워크 (PeerJS) -----------------------------
 * Host-Authoritative: Host만 물리/충돌/체력을 계산하고 60Hz로 상태를 보낸다.
 * Client는 자신의 패드 입력만 보낸다. 입력의 "눌림"은 카운터로 보내므로 패킷 순서가 바뀌어도 누락되지 않는다.
 */
const net = { peer: null, conn: null, role: null, code: '', joinTimer: 0, hostTries: 0, nat: null, linkTimer: 0 };

/* PeerJS 기본 TURN(*.turn.peerjs.com)은 도메인이 사라져 DNS 오류만 내므로 STUN만 직접 지정한다. */
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const isBadNat = k => k === 'symmetric' || k === 'blocked';

/* 같은 로컬 포트인데 STUN 서버마다 바깥 포트가 다르게 보이면 대칭형 NAT라서 홀 펀칭이 거의 불가능하다. */
function probeNat() {
  return new Promise(resolve => {
    let pc, done = false;
    try { pc = new RTCPeerConnection({ iceServers: ICE_SERVERS }); } catch (e) { resolve({ kind: 'unknown', v6: false }); return; }
    const maps = {};
    let v6 = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { pc.close(); } catch (e) { /* ignore */ }
      const sets = Object.values(maps);
      const kind = !sets.length ? 'blocked' : sets.some(s => s.size > 1) ? 'symmetric' : 'open';
      resolve({ kind, v6 });
    };
    pc.onicecandidate = e => {
      if (!e.candidate || !e.candidate.candidate) { finish(); return; }
      const p = e.candidate.candidate.split(' ');
      if ((p[2] || '').toLowerCase() !== 'udp') return;
      const addr = (p[4] || '').toLowerCase(), type = p[7];
      if (addr.includes(':') && !addr.startsWith('fe80')) v6 = true;
      if (type === 'srflx') {
        const base = p[p.indexOf('rport') + 1];
        (maps[base] = maps[base] || new Set()).add(addr + ':' + p[5]);
      }
    };
    pc.createDataChannel('probe');
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(finish);
    setTimeout(finish, 4000);
  });
}

function natText(r, who = '내') {
  if (!r || r.kind === 'unknown') return '';
  const v6 = r.v6 ? ' · IPv6 지원' : '';
  if (r.kind === 'open') return `${who} 네트워크: 직접 연결 가능성 좋음${v6}`;
  if (r.kind === 'symmetric') return `${who} 네트워크: 직접 연결 가능성 낮음 (바깥 포트가 매번 바뀜)${v6}`;
  return `${who} 네트워크: 직접 연결 가능성 낮음 (UDP 통신이 막힘)${v6}`;
}

function p2pFailMsg(mine, theirs) {
  if (isBadNat(mine) && isBadNat(theirs)) return '두 기기 모두 직접 연결이 어려운 네트워크예요. 한 기기의 핫스팟에 다른 기기를 연결하거나 같은 Wi-Fi에서 시도해 보세요.';
  if (isBadNat(mine)) return '이 기기의 네트워크가 직접 연결을 막고 있어요. Wi-Fi로 바꾸거나 상대 기기의 핫스팟에 연결해 보세요.';
  if (isBadNat(theirs)) return '상대 기기의 네트워크가 직접 연결을 막고 있어요. 상대가 Wi-Fi로 바꾸거나 이 기기의 핫스팟에 연결해 보세요.';
  return '기기끼리 직접 연결하지 못했어요. 한쪽이 Wi-Fi로 바꾸거나, 한 기기의 핫스팟에 다른 기기를 연결해 보세요.';
}

function startNatProbe() {
  net.nat = null;
  netInfo('내 네트워크 확인 중...');
  const role = net.role, code = net.code;
  const pr = probeNat().then(r => {
    if (net.role === role && net.code === code) { net.nat = r; netInfo(natText(r)); }
    return r;
  });
  return pr;
}

async function updateLinkInfo() {
  const pc = net.conn && net.conn.peerConnection;
  if (!pc || !game) return;
  try {
    const stats = await pc.getStats();
    const byId = {};
    let pair = null;
    stats.forEach(s => { byId[s.id] = s; });
    stats.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = byId[s.selectedCandidatePairId]; });
    if (!pair) stats.forEach(s => { if (!pair && s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated || s.selected)) pair = s; });
    if (!pair || !game) return;
    const l = byId[pair.localCandidateId] || {}, r = byId[pair.remoteCandidateId] || {};
    const types = [l.candidateType, r.candidateType];
    const v6 = String(l.address || l.ip || '').includes(':');
    let path;
    if (types.includes('relay')) path = '중계 서버';
    else if (types.every(t => t === 'host')) path = v6 ? 'IPv6 직접 연결' : '같은 네트워크 직접 연결';
    else path = '홀 펀칭 직접 연결' + (v6 ? ' · IPv6' : '');
    const rtt = pair.currentRoundTripTime;
    game.link = `연결: ${path}${rtt != null ? ` · ${Math.round(rtt * 1000)}ms` : ''}`;
  } catch (e) { /* 통계 미지원 브라우저 */ }
}

function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  return s;
}

function netSend(msg) {
  const c = net.conn;
  if (!c || !c.open) return;
  try {
    const dc = c.dataChannel;
    if (msg.t === 's' && dc && dc.bufferedAmount > 65536) return;
    c.send(msg);
  } catch (e) { /* 연결 종료 중 */ }
}

function netClose() {
  clearTimeout(net.joinTimer);
  clearInterval(net.linkTimer);
  if (net.conn) { try { net.conn.send({ t: 'bye' }); } catch (e) { /* ignore */ } try { net.conn.close(); } catch (e) { /* ignore */ } }
  if (net.peer) { try { net.peer.destroy(); } catch (e) { /* ignore */ } }
  net.peer = null; net.conn = null; net.role = null;
}

function peerAvailable() {
  if (typeof Peer === 'undefined') {
    menuMsg('PeerJS를 불러오지 못했어요. 인터넷 연결을 확인하세요. (연습 모드는 가능)');
    return false;
  }
  return true;
}

function hostRoom(retry) {
  if (!peerAvailable()) return;
  if (!retry) net.hostTries = 0;
  const code = genCode();
  net.role = 'host'; net.code = code;
  showLobby('방 만들기', code, '서버에 연결하는 중...', false);
  startNatProbe();
  const peer = new Peer(PEER_PREFIX + code, { debug: 1, config: { iceServers: ICE_SERVERS } });
  net.peer = peer;
  const waitingMsg = '친구에게 방 코드를 알려주세요. 상대를 기다리는 중...';
  peer.on('open', () => {
    if (net.peer !== peer) return;
    lobbyMsg(waitingMsg);
    $('copyBtn').classList.remove('hidden');
  });
  peer.on('connection', conn => {
    if (net.peer !== peer) return;
    if (game) {
      conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); });
      return;
    }
    if (net.conn) { try { net.conn.close(); } catch (e) { /* ignore */ } }
    net.conn = conn;
    const theirs = conn.metadata && conn.metadata.nat;
    lobbyMsg('상대가 들어오는 중... 기기끼리 직접 연결하는 중이에요.');
    if (theirs) netInfo([natText(net.nat), natText({ kind: theirs, v6: !!conn.metadata.v6 }, '상대')].filter(Boolean).join('\n'));
    conn.on('data', onHostData);
    const lost = (msg, lobbyText) => {
      if (net.conn !== conn) return;
      if (game) { onDisconnect(msg); return; }
      net.conn = null;
      try { conn.close(); } catch (e) { /* ignore */ }
      lobbyMsg(lobbyText);
    };
    conn.on('close', () => lost('상대가 나갔어요.', '상대의 연결이 끊겼어요. 방은 열려 있으니 다시 참여하면 돼요.'));
    conn.on('error', err => lost('연결 오류가 발생했어요.',
      err && err.type === 'negotiation-failed'
        ? p2pFailMsg(net.nat && net.nat.kind, theirs) + ' 방은 그대로 열려 있어요.'
        : '연결 오류가 발생했어요. 방은 열려 있으니 다시 참여하면 돼요.'));
  });
  peer.on('error', err => {
    if (net.peer !== peer) return;
    if (err.type === 'unavailable-id' && net.hostTries++ < 5) {
      peer.destroy(); net.peer = null;
      hostRoom(true);
      return;
    }
    if (game) return;
    netClose();
    showScreen('menu');
    menuMsg('방을 만들지 못했어요: ' + (err.type || err.message));
  });
}

function onHostData(d) {
  if (!d || typeof d !== 'object') return;
  if (game) game.lastRecv = performance.now();
  switch (d.t) {
    case 'hello': {
      const clientChar = CHAR[d.c] ? d.c : CHARACTERS[0].id;
      const handicap = $('handicap').checked;
      if (!game) {
        createGame({ mode: 'host', me: 0, chars: [selectedChar, clientChar], handicap, code: net.code });
        enterGame();
      }
      netSend({ t: 'init', chars: [game.players[0].c, game.players[1].c], handicap: game.handicap });
      break;
    }
    case 'i':
      if (game) {
        const inp = game.inputs[1];
        inp.l = !!d.l; inp.r = !!d.r; inp.j = !!d.j; inp.a = !!d.a; inp.d = !!d.d; inp.s = !!d.s; inp.u = !!d.u;
        inp.jc = d.jc | 0; inp.ac = d.ac | 0; inp.dc = d.dc | 0; inp.sc = d.sc | 0; inp.uc = d.uc | 0;
      }
      break;
    case 'bye':
      if (game) onDisconnect('상대가 나갔어요.');
      else { net.conn = null; lobbyMsg('상대가 접속을 취소했어요. 계속 기다리는 중...'); }
      break;
  }
}

function joinRoom() {
  if (!peerAvailable()) return;
  const code = $('codeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { menuMsg('방 코드 4자리를 입력하세요.'); return; }
  net.role = 'client'; net.code = code;
  showLobby('방 참여', code, '서버에 연결하는 중...', false);
  const natReady = startNatProbe();
  const peer = new Peer({ debug: 1, config: { iceServers: ICE_SERVERS } });
  net.peer = peer;
  const fail = msg => {
    if (net.peer !== peer || game) return;
    netClose();
    showScreen('menu');
    menuMsg(msg);
  };
  peer.on('open', async () => {
    if (net.peer !== peer) return;
    lobbyMsg('방을 찾는 중...');
    const nat = await Promise.race([natReady, new Promise(r => setTimeout(() => r(null), 2500))]);
    if (net.peer !== peer) return;
    const conn = peer.connect(PEER_PREFIX + code, {
      reliable: false, serialization: 'json',
      metadata: nat ? { nat: nat.kind, v6: nat.v6 } : {},
    });
    net.conn = conn;
    conn.on('iceStateChanged', st => {
      if (!game && net.conn === conn && st === 'checking') lobbyMsg('방을 찾았어요! 기기끼리 직접 연결하는 중...');
    });
    conn.on('open', () => {
      lobbyMsg('연결됨! 캐릭터 정보를 교환하는 중...');
      conn.send({ t: 'hello', c: selectedChar, v: 1 });
    });
    conn.on('data', onClientData);
    conn.on('close', () => { if (net.conn === conn) { if (game) onDisconnect('방장과 연결이 끊어졌어요.'); else fail('연결이 끊어졌어요. 다시 [참여]를 눌러 보세요.'); } });
    conn.on('error', err => fail(err && err.type === 'negotiation-failed' ? p2pFailMsg(net.nat && net.nat.kind) : '연결 오류가 발생했어요. 다시 [참여]를 눌러 보세요.'));
  });
  peer.on('error', err => {
    if (err.type === 'peer-unavailable') fail('방을 찾을 수 없어요. 코드를 확인하세요.');
    else fail('연결 오류: ' + (err.type || err.message));
  });
  net.joinTimer = setTimeout(() => fail(p2pFailMsg(net.nat && net.nat.kind)), 30000);
}

function onClientData(d) {
  if (!d || typeof d !== 'object') return;
  if (game) game.lastRecv = performance.now();
  switch (d.t) {
    case 'init':
      if (!game) {
        clearTimeout(net.joinTimer);
        createGame({ mode: 'client', me: 1, chars: d.chars, handicap: d.handicap, code: net.code });
        enterGame();
      }
      break;
    case 's':
      if (game) applyState(d);
      break;
    case 'full':
      netClose(); showScreen('menu'); menuMsg('이미 대전 중인 방이에요.');
      break;
    case 'bye':
      onDisconnect('방장이 나갔어요.');
      break;
  }
}

function packPlayer(p) {
  return [r1(p.x), r1(p.y), r2(p.vx), r2(p.vy), p.f, r1(p.hp), p.st, p.af, p.an, p.df, p.inv > 0 ? 1 : 0, p.fl, p.wins, p.g ? 1 : 0, p.kt,
    Math.max(0, MOVE_CODES.indexOf(p.mv)), Math.round(p.mp), Math.round(p.gd), p.dz];
}

function unpackPlayer(p, a) {
  let mv;
  [p.x, p.y, p.vx, p.vy, p.f, p.hp, p.st, p.af, p.an, p.df, p.inv, p.fl, p.wins, p.g, p.kt, mv, p.mp, p.gd, p.dz] = a;
  p.g = !!p.g;
  p.mv = MOVE_CODES[mv] || 'n';
}

function broadcastState() {
  const g = game;
  const pj = g.projs.map(a => [a.kind === 'wave' ? 1 : 0, r1(a.x), r1(a.y), r2(a.vx), r2(a.vy), a.owner.idx, a.life]);
  netSend({ t: 's', f: g.frame, ph: g.phase, pt: g.pt, rd: g.round, w: g.winner, p: g.players.map(packPlayer), e: g.pending, pj });
  g.pending = [];
}

function applyState(d) {
  const g = game;
  if (Array.isArray(d.e)) {
    for (const ev of d.e) {
      if (g.seen.has(ev.id)) continue;
      g.seen.add(ev.id);
      handleEvent(ev);
    }
    if (g.seen.size > 2000) g.seen.clear();
  }
  if (d.f <= g.lastF) return;
  g.lastF = d.f;
  const newRound = d.rd !== g.round;
  g.phase = d.ph; g.pt = d.pt; g.round = d.rd; g.winner = d.w;
  d.p.forEach((a, i) => unpackPlayer(g.players[i], a));
  g.projs = (d.pj || []).map(([k, x, y, vx, vy, o, life]) => ({ kind: k ? 'wave' : 'arrow', x, y, vx, vy, owner: g.players[o] || g.players[0], life }));
  if (newRound) for (const p of g.players) { p.rx = p.x; p.ry = p.y; p.hpLag = p.hp; p.trails = {}; p.trailAf = -1; }
}

function onDisconnect(msg) {
  if (!game && net.role === null) return;
  leaveGame();
  menuMsg(msg);
}

/* ----------------------------- 입력 (가상 패드 + 키보드) ----------------------------- */
const KEYS = ['l', 'r', 'j', 'a', 'd', 's', 'u'];
const localInput = newInput();
const noKeys = () => ({ l: false, r: false, j: false, a: false, d: false, s: false, u: false });
const padHeld = noKeys(), keyHeld = noKeys(), mouseHeld = noKeys();
let padRects = [];

function pressCounter(k) {
  if (k === 'j') localInput.jc++;
  else if (k === 'a') localInput.ac++;
  else if (k === 'd') localInput.dc++;
  else if (k === 's') localInput.sc++;
  else if (k === 'u') localInput.uc++;
}

function refreshInput() {
  for (const k of KEYS) {
    const held = padHeld[k] || keyHeld[k] || mouseHeld[k];
    if (held && !localInput[k]) pressCounter(k);
    localInput[k] = held;
  }
  for (const el of padButtons) el.classList.toggle('on', padHeld[el.dataset.k] || mouseHeld[el.dataset.k]);
}

let padButtons = [];
function cachePadRects() {
  padRects = padButtons.map(el => {
    const r = el.getBoundingClientRect();
    return { k: el.dataset.k, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
  });
}

function hitButton(x, y) {
  let best = null, bestD = Infinity;
  const m = 12;
  for (const r of padRects) {
    if (x < r.x0 - m || x > r.x1 + m || y < r.y0 - m || y > r.y1 + m) continue;
    const d = (x - r.cx) ** 2 + (y - r.cy) ** 2;
    if (d < bestD) { bestD = d; best = r.k; }
  }
  return best;
}

function onPadTouch(e) {
  e.preventDefault();
  if (!padRects.length || padRects[0].x1 === 0) cachePadRects();
  const now = noKeys();
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    const k = hitButton(t.clientX, t.clientY);
    if (k) now[k] = true;
  }
  for (const k of KEYS) padHeld[k] = now[k];
  refreshInput();
}

function setupPad() {
  const pad = $('pad');
  padButtons = [...pad.querySelectorAll('.btn')];
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    pad.addEventListener(type, onPadTouch, { passive: false });
  }
  let mouseDown = false;
  const mouseUpdate = e => {
    for (const k of KEYS) mouseHeld[k] = false;
    if (mouseDown) { const k = hitButton(e.clientX, e.clientY); if (k) mouseHeld[k] = true; }
    refreshInput();
  };
  pad.addEventListener('mousedown', e => { mouseDown = true; cachePadRects(); mouseUpdate(e); });
  window.addEventListener('mousemove', e => { if (mouseDown) mouseUpdate(e); });
  window.addEventListener('mouseup', e => { mouseDown = false; mouseUpdate(e); });
}

const KEYMAP = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
  ArrowUp: 'j', KeyW: 'j', Space: 'j',
  KeyJ: 'a', KeyZ: 'a', KeyK: 'd', KeyX: 'd', ShiftLeft: 'd', ShiftRight: 'd',
  KeyL: 's', KeyC: 's', KeyI: 'u', KeyV: 'u',
};

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyH') { showHitbox = !showHitbox; $('hitboxOpt').checked = showHitbox; return; }
  if (game && game.story && game.story.talk && !e.repeat && ['Enter', 'Space', 'KeyJ', 'KeyZ'].includes(e.code)) {
    e.preventDefault(); advanceTalk(); return;
  }
  const k = KEYMAP[e.code];
  if (!k || !game) return;
  e.preventDefault();
  keyHeld[k] = true;
  refreshInput();
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.code];
  if (!k) return;
  keyHeld[k] = false;
  refreshInput();
});
window.addEventListener('blur', () => {
  for (const k of KEYS) { keyHeld[k] = false; padHeld[k] = false; mouseHeld[k] = false; }
  refreshInput();
});

/* ----------------------------- 효과음 (Web Audio 합성) ----------------------------- */
const Sound = {
  ctx: null, noiseBuf: null, enabled: true,
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  },
  ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; },
  noise(dur, f0, f1, q, gain) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },
  tone(f0, f1, dur, type, gain) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  swing(heavy) { this.noise(heavy ? 0.28 : 0.13, heavy ? 600 : 1200, heavy ? 2400 : 4200, 0.9, heavy ? 0.35 : 0.22); },
  hit(heavy) {
    this.noise(heavy ? 0.22 : 0.12, heavy ? 900 : 1800, 300, 1.2, 0.6);
    this.tone(heavy ? 120 : 190, 40, heavy ? 0.28 : 0.16, 'sine', 0.55);
  },
  dash() { this.noise(0.16, 500, 2000, 0.7, 0.18); },
  ko() { this.tone(110, 98, 1.8, 'triangle', 0.5); this.tone(166, 150, 1.4, 'sine', 0.25); this.noise(0.5, 400, 120, 0.6, 0.4); },
  block() { this.tone(1400, 900, 0.12, 'square', 0.08); this.noise(0.08, 5000, 3000, 2, 0.3); },
  parry() { this.tone(1800, 2400, 0.25, 'triangle', 0.3); this.tone(2700, 2700, 0.35, 'sine', 0.15); },
  gbreak() { this.noise(0.4, 2000, 200, 0.8, 0.6); this.tone(300, 80, 0.4, 'square', 0.15); },
  roar() { this.noise(0.8, 320, 110, 0.5, 0.8); this.tone(95, 60, 0.8, 'sawtooth', 0.22); },
  special() { this.tone(220, 440, 0.45, 'triangle', 0.3); this.tone(330, 660, 0.45, 'sine', 0.15); },
  counter() { this.tone(600, 1300, 0.15, 'square', 0.12); },
};

/* ----------------------------- 이펙트 ----------------------------- */
const fx = { parts: [], slashes: [], texts: [], rings: [], bursts: [], streaks: [], cutin: null, shake: 0, flash: 0, zoom: 0, zx: W / 2, zy: H / 2 };

function impact(x, y, col, big) {
  fx.bursts.push({ x, y, r: big ? 70 : 40, life: big ? 14 : 9, max: big ? 14 : 9, col });
  const n = big ? 10 : 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    fx.streaks.push({ x, y, a, len: (big ? 70 : 40) + Math.random() * 30, w: big ? 4 : 3, life: 10, max: 10, col: i % 2 ? '255,253,240' : col });
  }
  if (big) { fx.zoom = Math.max(fx.zoom, 0.09); fx.zx = x; fx.zy = y; }
}

function sparks(x, y, n, col, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * speed;
    fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, r: 1.2 + Math.random() * 2.2, life: 22, max: 22, col, g: 0.18 });
  }
}

function popText(x, y, txt, size, col, life = 50) {
  fx.texts.push({ x, y, txt, life, max: life, size, col });
}

function handleEvent(ev) {
  switch (ev.k) {
    case 'sw':
      if (ev.kick) Sound.noise(0.1, 700, 1600, 0.8, 0.2);
      else Sound.swing(ev.c === 'guanyu' || ev.c === 'zhangfei');
      break;
    case 'dash': {
      Sound.dash();
      for (let i = 0; i < 8; i++) {
        fx.parts.push({ x: ev.x + (Math.random() - 0.5) * 20, y: ev.y - 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.5, r: 3 + Math.random() * 4, life: 24, max: 24, col: 'rgba(120,100,80,', g: -0.02 });
      }
      break;
    }
    case 'hit': {
      Sound.hit(ev.hv);
      const n = ev.hv ? 26 : 14;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * (ev.hv ? 8 : 5);
        fx.parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, r: 1.5 + Math.random() * 3.5, life: 30, max: 30, col: Math.random() < 0.55 ? 'rgba(31,26,23,' : 'rgba(168,40,32,', g: 0.25 });
      }
      fx.slashes.push({ x: ev.x, y: ev.y, a: -0.6 + Math.random() * 1.2, len: ev.hv || ev.fin ? 90 : 55, life: 16, max: 16 });
      impact(ev.x, ev.y, rgbOf((CHAR[ev.c] && CHAR[ev.c].fx) || '#a8322a'), !!ev.fin);
      if (ev.w) popText(ev.x, ev.y - 20, `-${ev.d} 자루`, 18, '#6b625a');
      else popText(ev.x, ev.y - 20, (ev.a ? '' : '-') + ev.d, ev.fin ? 38 : ev.hv ? 34 : 24, RED);
      fx.shake = Math.max(fx.shake, ev.fin ? 10 : ev.g ? 3 : ev.hv ? 12 : 5);
      if (ev.hv && !ev.g) fx.flash = 0.35;
      if (game && ev.t === game.me && navigator.vibrate) { try { navigator.vibrate(ev.hv ? 60 : 25); } catch (e) { /* ignore */ } }
      break;
    }
    case 'gko':
      Sound.hit(true);
      sparks(ev.x, ev.y, 12, 'rgba(31,26,23,', 6);
      fx.shake = Math.max(fx.shake, 6);
      break;
    case 'score':
      popText(ev.x, ev.y, `+${ev.d}${ev.wave ? ' 웨이브 보너스' : ''}`, ev.wave ? 22 : 18, '#c98a12', 45);
      break;
    case 'heal':
      Sound.tone(660, 990, 0.18, 'triangle', 0.2);
      popText(ev.x, ev.y, `+${ev.d}`, 24, '#2e8b3d', 50);
      break;
    case 'shoot':
      Sound.tone(520, 180, 0.12, 'triangle', 0.15);
      break;
    case 'wavefx':
      Sound.swing(true);
      Sound.tone(900, 300, 0.25, 'sine', 0.12);
      break;
    case 'land':
      for (let i = 0; i < (ev.hv ? 18 : 8); i++) {
        const d = Math.random() < 0.5 ? -1 : 1;
        fx.parts.push({ x: ev.x + d * Math.random() * 12, y: ev.y - 2, vx: d * (1 + Math.random() * (ev.hv ? 5 : 3)), vy: -Math.random() * 2, r: 3 + Math.random() * 5, life: 26, max: 26, col: 'rgba(120,100,80,', g: -0.02 });
      }
      if (ev.hv) {
        fx.rings.push({ x: ev.x, y: ev.y - 4, r: 10, grow: 7, life: 18, max: 18, col: '120,100,80', w: 4 });
        fx.shake = Math.max(fx.shake, 9);
        Sound.noise(0.3, 300, 90, 0.7, 0.5);
      }
      break;
    case 'deflect':
      Sound.block();
      sparks(ev.x, ev.y, 8, 'rgba(232,197,71,', 4);
      popText(ev.x, ev.y - 18, '쳐냄!', 18, '#3d5a80', 34);
      break;
    case 'block':
      Sound.block();
      sparks(ev.x, ev.y, 10, 'rgba(225,230,238,', 4);
      sparks(ev.x, ev.y, 4, 'rgba(232,197,71,', 3);
      popText(ev.x, ev.y - 22, ev.d ? `막음 -${ev.d}` : '막음', 18, '#3d5a80', 36);
      fx.shake = Math.max(fx.shake, 2);
      break;
    case 'parry':
      Sound.parry();
      sparks(ev.x, ev.y, 18, 'rgba(240,200,60,', 6);
      fx.rings.push({ x: ev.x, y: ev.y, r: 8, grow: 4, life: 20, max: 20, col: '232,176,74', w: 4 });
      popText(ev.x, ev.y - 28, '튕겨냄!', 30, '#c98a12', 60);
      fx.flash = Math.max(fx.flash, 0.25);
      fx.shake = Math.max(fx.shake, 6);
      break;
    case 'gbreak':
      Sound.gbreak();
      popText(ev.x, ev.y, '가드 브레이크!', 28, RED, 70);
      sparks(ev.x, ev.y + 60, 20, 'rgba(225,230,238,', 7);
      fx.shake = Math.max(fx.shake, 10);
      break;
    case 'roar':
      Sound.roar();
      for (let i = 0; i < 3; i++) fx.rings.push({ x: ev.x, y: ev.y, r: 10 + i * 30, grow: 9, life: 34, max: 34, col: '168,40,32', w: 6 - i * 1.5 });
      popText(ev.x, ev.y - 30, '喝!', 64, RED, 55);
      fx.shake = Math.max(fx.shake, 14);
      break;
    case 'counter':
      Sound.counter();
      popText(ev.x, ev.y, '반격!', 34, '#6a2c8f', 55);
      fx.flash = Math.max(fx.flash, 0.4);
      break;
    case 'sp': {
      Sound.special();
      const sp = CHAR[ev.c].special;
      fx.cutin = { name: sp.name, hanja: sp.hanja, idx: ev.p, life: 55, max: 55 };
      break;
    }
    case 'ko':
      Sound.ko();
      fx.shake = 20; fx.flash = 0.6;
      break;
  }
}

function updateEffects(k) {
  for (const p of fx.parts) { p.x += p.vx * k; p.y += p.vy * k; p.vy += p.g * k; p.vx *= Math.pow(0.97, k); p.life -= k; if (p.y > GROUND + 4 && p.g > 0) { p.y = GROUND + 4; p.vy = 0; p.vx *= 0.5; } }
  fx.parts = fx.parts.filter(p => p.life > 0);
  for (const s of fx.slashes) s.life -= k;
  fx.slashes = fx.slashes.filter(s => s.life > 0);
  for (const t of fx.texts) { t.y -= 0.8 * k; t.life -= k; }
  fx.texts = fx.texts.filter(t => t.life > 0);
  for (const r of fx.rings) { r.r += r.grow * k; r.life -= k; }
  fx.rings = fx.rings.filter(r => r.life > 0);
  if (fx.cutin && (fx.cutin.life -= k) <= 0) fx.cutin = null;
  for (const b of fx.bursts) b.life -= k;
  fx.bursts = fx.bursts.filter(b => b.life > 0);
  for (const s of fx.streaks) s.life -= k;
  fx.streaks = fx.streaks.filter(s => s.life > 0);
  fx.shake = Math.max(0, fx.shake - 0.9 * k);
  fx.flash = Math.max(0, fx.flash - 0.03 * k);
  fx.zoom *= Math.pow(0.88, k);
}

/* ----------------------------- 캔버스 / 배경 ----------------------------- */
const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const bgCanvas = document.createElement('canvas');
const view = { dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
let showHitbox = false;

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  view.scale = Math.min(view.w / W, view.h / H);
  view.ox = (view.w - W * view.scale) / 2;
  view.oy = (view.h - H * view.scale) / 2;
  buildBackground();
  cachePadRects();
  sizePreviews();
  if (!$('storyScreen').classList.contains('hidden')) drawStageBosses();
}

function buildBackground() {
  bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
  const c = bgCanvas.getContext('2d');
  const { dpr, scale, ox, oy } = view;
  const rnd = mulberry32(20261031);

  c.setTransform(1, 0, 0, 1, 0, 0);
  const grad = c.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, '#efe7d0'); grad.addColorStop(1, '#ddd2b4');
  c.fillStyle = grad; c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  const x0 = -ox / scale - 10, x1 = (view.w - ox) / scale + 10;
  const y0 = -oy / scale - 10, y1 = (view.h - oy) / scale + 10;

  // 해 (붉은 낙관 느낌)
  c.fillStyle = 'rgba(178, 48, 38, 0.55)';
  c.beginPath(); c.arc(W * 0.78, 130, 46, 0, Math.PI * 2); c.fill();

  // 수묵 산 3겹
  const layers = [
    { base: 300, amp: 110, alpha: 0.12, f: [0.0042, 0.011, 0.027], seed: 1.3 },
    { base: 345, amp: 80, alpha: 0.18, f: [0.0055, 0.014, 0.031], seed: 4.1 },
    { base: 395, amp: 55, alpha: 0.26, f: [0.007, 0.019, 0.043], seed: 7.7 },
  ];
  for (const L of layers) {
    const g2 = c.createLinearGradient(0, L.base - L.amp, 0, GROUND);
    g2.addColorStop(0, `rgba(40,36,32,${L.alpha})`);
    g2.addColorStop(1, 'rgba(40,36,32,0)');
    c.fillStyle = g2;
    c.beginPath(); c.moveTo(x0, GROUND);
    for (let x = x0; x <= x1; x += 6) {
      const n = Math.sin(x * L.f[0] + L.seed) * 0.55 + Math.sin(x * L.f[1] + L.seed * 2) * 0.3 + Math.sin(x * L.f[2] + L.seed * 3) * 0.15;
      c.lineTo(x, L.base - Math.max(0, n + 0.35) * L.amp);
    }
    c.lineTo(x1, GROUND); c.closePath(); c.fill();
  }

  // 안개
  const mist = c.createLinearGradient(0, 360, 0, GROUND);
  mist.addColorStop(0, 'rgba(239,231,208,0)'); mist.addColorStop(1, 'rgba(239,231,208,0.7)');
  c.fillStyle = mist; c.fillRect(x0, 360, x1 - x0, GROUND - 360);

  // 땅
  const gg = c.createLinearGradient(0, GROUND, 0, y1);
  gg.addColorStop(0, '#d6c9a6'); gg.addColorStop(1, '#c9b98f');
  c.fillStyle = gg; c.fillRect(x0, GROUND, x1 - x0, y1 - GROUND);

  // 붓 터치 지면선
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(x0, GROUND - 2);
  for (let x = x0; x <= x1; x += 5) c.lineTo(x, GROUND - 1.5 - Math.abs(Math.sin(x * 0.031) * Math.sin(x * 0.007)) * 2.5);
  for (let x = x1; x >= x0; x -= 5) c.lineTo(x, GROUND + 2 + Math.abs(Math.sin(x * 0.023 + 1)) * 3);
  c.closePath(); c.fill();

  // 풀 / 돌
  c.strokeStyle = 'rgba(31,26,23,0.45)'; c.lineWidth = 1.5; c.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const x = x0 + rnd() * (x1 - x0), h = 4 + rnd() * 9;
    c.beginPath();
    c.moveTo(x, GROUND); c.quadraticCurveTo(x - 2, GROUND - h * 0.6, x - 4 + rnd() * 2, GROUND - h);
    c.moveTo(x + 2, GROUND); c.quadraticCurveTo(x + 3, GROUND - h * 0.5, x + 6, GROUND - h * 0.8);
    c.stroke();
  }
  c.fillStyle = 'rgba(31,26,23,0.18)';
  for (let i = 0; i < 40; i++) {
    c.beginPath();
    c.ellipse(x0 + rnd() * (x1 - x0), GROUND + 12 + rnd() * (y1 - GROUND - 12), 2 + rnd() * 5, 1 + rnd() * 2, 0, 0, Math.PI * 2);
    c.fill();
  }

  // 서예 장식
  c.save();
  c.fillStyle = 'rgba(31,26,23,0.13)';
  c.font = `900 44px ${SERIF}`; c.textAlign = 'center';
  ['天', '下', '三', '分'].forEach((ch, i) => c.fillText(ch, W - 46, 120 + i * 50));
  c.restore();

  // 종이 질감
  c.setTransform(1, 0, 0, 1, 0, 0);
  const area = bgCanvas.width * bgCanvas.height;
  const specks = Math.min(4000, area / 600);
  for (let i = 0; i < specks; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(90,70,40,0.06)' : 'rgba(255,255,240,0.08)';
    c.fillRect(rnd() * bgCanvas.width, rnd() * bgCanvas.height, 1 + rnd() * 2 * dpr, 1 + rnd() * 2 * dpr);
  }
  const vg = c.createRadialGradient(bgCanvas.width / 2, bgCanvas.height / 2, Math.min(bgCanvas.width, bgCanvas.height) * 0.35, bgCanvas.width / 2, bgCanvas.height / 2, Math.max(bgCanvas.width, bgCanvas.height) * 0.75);
  vg.addColorStop(0, 'rgba(110,80,40,0)'); vg.addColorStop(1, 'rgba(110,80,40,0.22)');
  c.fillStyle = vg; c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

/* ----------------------------- 무기 드로잉 (무기 로컬 좌표: +x가 날 방향) ----------------------------- */
function strokeLine(c, x0, y0, x1, y1, col, w) {
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}

function tassel(c, x, now, col, len = 12) {
  c.strokeStyle = col; c.lineWidth = 1.6;
  for (let i = -1; i <= 1; i++) {
    const sw = Math.sin(now * 0.012 + i) * 3;
    c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x - 4, 6 + i * 2, x - 6 + sw, len + i * 2); c.stroke();
  }
}

function drawWeapon(c, type, hx, hy, ang, s, now, ink, grip = 0) {
  c.save();
  c.translate(hx, hy); c.rotate(ang); c.scale(s, s);
  if (grip) c.translate(-grip / s, 0);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const silver = c.createLinearGradient(0, -6, 0, 6);
  silver.addColorStop(0, '#f6f8fa'); silver.addColorStop(0.5, '#c3c9d0'); silver.addColorStop(1, '#8a929b');

  switch (type) {
    case 'twin': {
      strokeLine(c, -7, 0, 0, 0, '#5a3a22', 3.4);
      strokeLine(c, 0, -4.5, 0, 4.5, '#c9a227', 3);
      c.beginPath(); c.moveTo(1.5, -2.4); c.lineTo(30, -2); c.lineTo(36.5, 0); c.lineTo(30, 2); c.lineTo(1.5, 2.4); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
      break;
    }
    case 'glaive': {
      strokeLine(c, -46, 0, 64, 0, '#5a2b1a', 3.6);
      c.fillStyle = '#c9a227';
      c.beginPath(); c.moveTo(-46, -2); c.lineTo(-54, 0); c.lineTo(-46, 2); c.closePath(); c.fill();
      tassel(c, 60, now, '#b22222', 14);
      c.beginPath();
      c.moveTo(62, -3);
      c.quadraticCurveTo(84, -9, 105, -6);
      c.lineTo(99, -1);
      c.quadraticCurveTo(98, 16, 68, 15);
      c.lineTo(62, 4);
      c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke();
      c.beginPath(); c.moveTo(80, -7); c.lineTo(84, -13); c.lineTo(88, -7.5); c.fillStyle = '#c3c9d0'; c.fill(); c.stroke();
      c.strokeStyle = '#2f8a4d'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(66, 4); c.bezierCurveTo(72, -2, 78, 10, 84, 4); c.bezierCurveTo(88, 0, 90, 6, 92, 3); c.stroke();
      c.fillStyle = '#2f8a4d';
      c.beginPath(); c.ellipse(62, 0, 4, 5.5, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'serpent': {
      strokeLine(c, -52, 0, 78, 0, '#1c1c1c', 3.6);
      tassel(c, 74, now, '#c0392b', 13);
      c.fillStyle = '#c9a227'; c.fillRect(74, -3, 4.5, 6);
      const top = [], bot = [];
      const L = 32, x0 = 78;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, x = x0 + t * L;
        const cy = Math.sin(t * Math.PI * 3) * 3.6 * (1 - t * 0.4);
        const hw = 3.6 * (1 - t) + 0.3;
        top.push([x, cy - hw]); bot.push([x, cy + hw]);
      }
      c.beginPath(); c.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) c.lineTo(x, y);
      c.lineTo(x0 + L + 2, 0);
      for (let i = bot.length - 1; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
      c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
      break;
    }
    case 'sevenstar': {
      strokeLine(c, -9, 0, 0, 0, '#3a1f4a', 4);
      c.strokeStyle = '#c9a227'; c.lineWidth = 1.8;
      c.beginPath(); c.arc(-11.5, 0, 2.6, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#c9a227';
      c.beginPath(); c.ellipse(0.5, 0, 2.8, 7.5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.moveTo(2, -3.8); c.lineTo(50, -3.8);
      c.quadraticCurveTo(57, -3.4, 60, -1);
      c.quadraticCurveTo(57, 6.5, 46, 6.5);
      c.lineTo(2, 4.8); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
      strokeLine(c, 4, -1.5, 48, -1.5, 'rgba(255,255,255,0.8)', 0.9);
      c.fillStyle = '#e8c547';
      for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(8 + i * 6, 1.4, 1.25, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'spear': {
      strokeLine(c, -44, 0, 70, 0, '#6b5636', 3.2);
      tassel(c, 66, now, '#d33b2f', 12);
      c.beginPath(); c.moveTo(68, 0); c.lineTo(75, -3.8); c.lineTo(98, 0); c.lineTo(75, 3.8); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
      c.beginPath(); c.moveTo(72, -2); c.quadraticCurveTo(70, -8, 66, -12); c.lineTo(78, -3); c.closePath();
      c.moveTo(72, 2); c.quadraticCurveTo(70, 8, 66, 12); c.lineTo(78, 3); c.closePath();
      c.fill(); c.stroke();
      break;
    }
    case 'pike': {
      strokeLine(c, -40, 0, 66, 0, '#7a5a34', 3);
      c.beginPath(); c.moveTo(64, -2.6); c.quadraticCurveTo(76, -4, 86, 0); c.quadraticCurveTo(76, 4, 64, 2.6); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#a8322a'; c.fillRect(60, -2.5, 4, 5);
      break;
    }
    case 'halberd': {
      strokeLine(c, -48, 0, 76, 0, '#4a1c14', 3.6);
      c.fillStyle = '#c9a227';
      c.beginPath(); c.moveTo(-48, -2); c.lineTo(-56, 0); c.lineTo(-48, 2); c.closePath(); c.fill();
      tassel(c, 70, now, '#c0392b', 13);
      c.beginPath(); c.moveTo(76, -3); c.lineTo(104, 0); c.lineTo(76, 3); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
      for (const sd of [-1, 1]) {
        c.beginPath();
        c.moveTo(77, sd * 2.5);
        c.quadraticCurveTo(80, sd * 17, 95, sd * 16);
        c.quadraticCurveTo(86, sd * 11, 89, sd * 3.5);
        c.closePath();
        c.fill(); c.stroke();
      }
      c.fillStyle = '#c9a227'; c.fillRect(72, -3.5, 5, 7);
      break;
    }
    case 'saber': {
      strokeLine(c, -8, 0, 0, 0, '#4a3524', 3.6);
      strokeLine(c, 0, -5, 0, 5, '#6b6b6b', 3);
      c.beginPath();
      c.moveTo(2, -3); c.lineTo(42, -3); c.quadraticCurveTo(50, -2, 51, 1); c.quadraticCurveTo(46, 5.5, 38, 5); c.lineTo(2, 3.6); c.closePath();
      c.fillStyle = silver; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
      break;
    }
  }
  c.restore();
}

/* 활은 손 위치 기준으로 세워 그리고, 시위는 뒷손(oh)까지 당겨진다. 당기는 동안 화살이 시위에 걸려 보인다. */
function drawBow(c, p, pose, ink) {
  const { mh, oh } = pose;
  const drawing = p.af >= 0 && p.af < (moveOf(p).fire || 0);
  c.save();
  c.translate(mh.x, mh.y);
  c.strokeStyle = '#6b4a2a'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-4, -30); c.quadraticCurveTo(14, 0, -4, 30); c.stroke();
  c.restore();
  const sx = drawing ? oh.x : mh.x - 4, sy = drawing ? oh.y : mh.y;
  c.strokeStyle = 'rgba(60,50,40,0.8)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(mh.x - 4, mh.y - 30); c.lineTo(sx, sy); c.lineTo(mh.x - 4, mh.y + 30); c.stroke();
  if (drawing) {
    strokeLine(c, sx, sy, mh.x + 18, mh.y, '#5a4630', 1.8);
    c.fillStyle = '#c3c9d0';
    c.beginPath(); c.moveTo(mh.x + 18, mh.y - 2.5); c.lineTo(mh.x + 24, mh.y); c.lineTo(mh.x + 18, mh.y + 2.5); c.closePath(); c.fill();
  }
}

function drawSoldierHead(c, ch, p, hd, ink, now) {
  const R = SK.headR;
  if (p.band) {
    strokeLine(c, hd.x - 10.5, hd.y - 4, hd.x + 10.5, hd.y - 5, p.band, 4);
    const fl = Math.sin(now * 0.012 + p.idx) * 2;
    c.strokeStyle = p.band; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(hd.x - 10, hd.y - 4); c.quadraticCurveTo(hd.x - 17, hd.y - 2 + fl, hd.x - 22, hd.y + 4 + fl); c.stroke();
  } else {
    c.fillStyle = p.helm || '#3a3a3a';
    c.beginPath(); c.moveTo(hd.x - R - 2, hd.y - 2); c.lineTo(hd.x - 1, hd.y - R - 9); c.lineTo(hd.x + R + 2, hd.y - 2); c.closePath(); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#b22222';
    c.beginPath(); c.arc(hd.x - 1, hd.y - R - 10, 2.4, 0, Math.PI * 2); c.fill();
  }
  if (ch.elite) {
    const sway = Math.sin(now * 0.01 + p.idx) * 3 - clamp(p.vx * p.f, -5, 8);
    c.strokeStyle = '#c0392b'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(hd.x - 1, hd.y - R - 10); c.quadraticCurveTo(hd.x - 10 + sway, hd.y - R - 26, hd.x - 22 + sway, hd.y - R - 18); c.stroke();
    strokeLine(c, hd.x + 1, hd.y - 5.5, hd.x + 8.5, hd.y - 3, ink, 1.8);
  }
}

/* ----------------------------- 스틱맨 드로잉 ----------------------------- */
function limb(c, a, b, e, col, w) {
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(e.x, e.y); c.stroke();
}

function drawCape(c, p, pose, now) {
  const { sh } = pose;
  const drag = clamp(p.vx * p.f, -6, 10);
  const lift = p.g ? 0 : clamp(p.vy, -12, 12);
  const back = 8 + Math.max(0, drag) * 3 + (p.st === ST.DASH ? 20 : 0) + (p.g ? 0 : 6);
  const t = now * 0.008 + p.idx;
  const len = 62;
  const front = [], rear = [];
  for (let i = 0; i <= 5; i++) {
    const k = i / 5;
    const wave = Math.sin(t + i * 1.1) * 3 * k;
    const x = sh.x - 2 - back * k * k + wave;
    const y = sh.y + 2 + len * k - (back * 0.35 + lift * 0.8) * k * k;
    front.push([x + 3, y]);
    rear.push([x - 6 - 8 * k + Math.sin(t * 1.3 + i) * 2 * k, y - 2 * k]);
  }
  c.beginPath();
  c.moveTo(front[0][0], front[0][1]);
  for (const [x, y] of front) c.lineTo(x, y);
  for (let i = 5; i >= 0; i--) c.lineTo(rear[i][0], rear[i][1]);
  c.closePath();
  c.fillStyle = '#b22222'; c.fill();
  c.strokeStyle = '#6e1212'; c.lineWidth = 1.6; c.stroke();
}

function drawHead(c, ch, p, pose, now, ink) {
  const { hd } = pose, R = SK.headR;
  const drag = clamp(p.vx * p.f, -5, 8);
  const flutter = Math.sin(now * 0.012 + p.idx * 3) * 3;
  const ko = p.st === ST.KO;

  const bandTails = (col, long) => {
    c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.moveTo(hd.x - 10, hd.y - 4);
    c.quadraticCurveTo(hd.x - 18 - drag, hd.y - 7 + flutter, hd.x - (long ? 32 : 26) - drag * 1.6, hd.y - 1 + flutter * 1.5);
    c.moveTo(hd.x - 10, hd.y - 3);
    c.quadraticCurveTo(hd.x - 17 - drag, hd.y + flutter * 0.5, hd.x - (long ? 28 : 22) - drag * 1.3, hd.y + 6 + flutter);
    c.stroke();
  };

  if (ch.id === 'liubei') bandTails(ch.accent, false);
  if (ch.id === 'zhaoyun') bandTails(ch.accent, true);

  if (ch.id === 'lubu') {
    const sway = Math.sin(now * 0.008 + p.idx) * 4 - drag * 1.5 + (p.g ? 0 : clamp(p.vy, -8, 8));
    for (const [ox, k, w] of [[-2, 1, 3.2], [2, 0.86, 2.4]]) {
      c.strokeStyle = '#7a3b12'; c.lineWidth = w;
      c.beginPath();
      c.moveTo(hd.x + ox, hd.y - R - 3);
      c.bezierCurveTo(hd.x + ox - 6, hd.y - R - 26 * k, hd.x - 30 * k + sway, hd.y - R - 46 * k, hd.x - 54 * k + sway * 1.5, hd.y - R - 32 * k);
      c.stroke();
      c.strokeStyle = '#e8c547'; c.lineWidth = 1;
      c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
    }
  }

  if (ch.id === 'zhangfei') {
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 1.05 + i * (Math.PI * 0.8 / 8);
      const jit = Math.sin(i * 12.9898) * 3 + Math.sin(now * 0.03 + i) * 1.2;
      const len = R + 7 + jit;
      c.moveTo(hd.x + Math.cos(a) * (R - 2), hd.y + Math.sin(a) * (R - 2));
      c.lineTo(hd.x + Math.cos(a - 0.12) * len, hd.y + Math.sin(a - 0.12) * len);
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.15 + i * (Math.PI * 0.6 / 5);
      c.moveTo(hd.x + Math.cos(a) * (R - 1), hd.y + Math.sin(a) * (R - 1));
      c.lineTo(hd.x + Math.cos(a) * (R + 5), hd.y + Math.sin(a) * (R + 5));
    }
    c.stroke();
  }

  c.beginPath(); c.arc(hd.x, hd.y, R, 0, Math.PI * 2);
  c.fillStyle = ch.id === 'guanyu' ? '#a8382e' : PAPER_LIGHT;
  c.fill();
  c.strokeStyle = ink; c.lineWidth = 3; c.stroke();
  if (ch.soldier) drawSoldierHead(c, ch, p, hd, ink, now);

  if (ch.id === 'liubei') {
    c.fillStyle = ink; c.beginPath(); c.arc(hd.x - 3, hd.y - R - 2, 4, 0, Math.PI * 2); c.fill();
    strokeLine(c, hd.x - 10.5, hd.y - 4, hd.x + 10.5, hd.y - 5, ch.accent, 3.6);
  } else if (ch.id === 'zhaoyun') {
    strokeLine(c, hd.x - 10.5, hd.y - 4, hd.x + 10.5, hd.y - 5, ch.accent, 3.8);
    c.fillStyle = '#c9a227'; c.beginPath(); c.arc(hd.x + 6, hd.y - 5, 1.8, 0, Math.PI * 2); c.fill();
  } else if (ch.id === 'guanyu') {
    c.fillStyle = '#1f5e33';
    c.beginPath(); c.moveTo(hd.x - 11.5, hd.y - 3); c.quadraticCurveTo(hd.x - 2, hd.y - 22, hd.x + 11.5, hd.y - 4); c.closePath(); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke();
  } else if (ch.id === 'caocao') {
    c.fillStyle = ink;
    c.beginPath(); c.moveTo(hd.x - 9, hd.y - 7); c.lineTo(hd.x - 6, hd.y - 19); c.lineTo(hd.x + 6, hd.y - 19); c.lineTo(hd.x + 9, hd.y - 7); c.closePath(); c.fill();
    strokeLine(c, hd.x - 10, hd.y - 16, hd.x + 10, hd.y - 16, ink, 2);
    c.fillStyle = '#c9a227'; c.beginPath(); c.arc(hd.x + 1, hd.y - 12, 2, 0, Math.PI * 2); c.fill();
  } else if (ch.id === 'lubu') {
    c.fillStyle = '#c9a227';
    c.beginPath();
    c.moveTo(hd.x - 10, hd.y - 5); c.lineTo(hd.x - 8, hd.y - 15); c.lineTo(hd.x - 3, hd.y - 11);
    c.lineTo(hd.x + 1, hd.y - 18); c.lineTo(hd.x + 5, hd.y - 11); c.lineTo(hd.x + 10, hd.y - 15); c.lineTo(hd.x + 10, hd.y - 5);
    c.closePath(); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#6a2c8f'; c.beginPath(); c.arc(hd.x + 1, hd.y - 9, 2.2, 0, TAU); c.fill();
  }

  // 눈
  if (ko) {
    c.strokeStyle = ink; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(hd.x + 3, hd.y - 3); c.lineTo(hd.x + 7, hd.y + 1); c.moveTo(hd.x + 7, hd.y - 3); c.lineTo(hd.x + 3, hd.y + 1); c.stroke();
  } else {
    c.fillStyle = ink; c.beginPath(); c.arc(hd.x + 5, hd.y - 0.5, 1.7, 0, Math.PI * 2); c.fill();
    if (ch.id === 'zhangfei' || ch.id === 'guanyu' || ch.id === 'lubu') strokeLine(c, hd.x + 1.5, hd.y - 5.5, hd.x + 8.5, hd.y - 3, ink, 1.8);
  }

  // 관우의 긴 수염 (bezierCurveTo)
  if (ch.id === 'guanyu') {
    const sway = Math.sin(now * 0.006 + p.idx) * 2 - drag * 0.8 + (p.g ? 0 : clamp(p.vy, -8, 8) * 0.6);
    c.beginPath();
    c.moveTo(hd.x + 2, hd.y + 8);
    c.bezierCurveTo(hd.x + 11, hd.y + 16, hd.x + 5 + sway * 0.5, hd.y + 30, hd.x + 7 + sway, hd.y + 44);
    c.bezierCurveTo(hd.x - 1 + sway * 0.7, hd.y + 32, hd.x - 4, hd.y + 20, hd.x - 6, hd.y + 8);
    c.quadraticCurveTo(hd.x - 2, hd.y + 11, hd.x + 2, hd.y + 8);
    c.closePath();
    c.fillStyle = ink; c.fill();
  }
}

/* 달리며 뛰면 체공 시간에 맞춰 한 바퀴 돈다(앞으로 달리면 앞구르기, 뒤로 뛰면 뒤구르기). 표시만 바뀌고 판정에는 영향 없음. */
function airFlip(p) {
  if (p.st !== ST.AIR || p.g || Math.abs(p.vx) < 2.5 || CHAR[p.c].soldier) return 0;
  const v0 = JUMP_V * CHAR[p.c].jump;
  const t = clamp((p.vy + v0) / (2 * v0), 0, 1);
  return Math.sign(p.vx * p.f) * TAU * t * t * (3 - 2 * t);
}

function drawFighter(c, p, now, ox, oy, alpha) {
  const ch = CHAR[p.c];
  const pose = computePose(p, now);
  const flash = p.fl > 0 && p.fl % 4 < 2;
  const ink = flash ? '#c0392b' : INK;
  const softInk = flash ? '#d0574b' : '#4a423b';

  c.save();
  c.translate(ox, oy);
  c.scale(p.f, 1);
  if (p.st === ST.KO) c.rotate(-Math.min(1, p.kt / 22) * 1.42);
  const flip = airFlip(p);
  if (flip) { c.translate(0, -SK.hip); c.rotate(flip); c.translate(0, SK.hip); }
  c.globalAlpha = alpha * (p.inv && p.st === ST.DASH ? 0.7 : 1);
  c.lineCap = 'round'; c.lineJoin = 'round';

  if (ch.id === 'caocao') drawCape(c, p, pose, now);

  // 뒷팔 (+ 유비의 두 번째 검)
  if (ch.weapon === 'twin') drawWeapon(c, 'twin', pose.oh.x, pose.oh.y, pose.ow, p.ws, now, ink);
  limb(c, pose.sh, pose.oe, pose.oh, softInk, 4.2);

  // 다리
  limb(c, pose.hip, pose.kb, pose.fb, softInk, 4.6);
  limb(c, pose.hip, pose.kf, pose.ff, ink, 4.6);

  // 몸통 (먹선 테두리 + 캐릭터 색)
  strokeLine(c, pose.hip.x, pose.hip.y, pose.sh.x, pose.sh.y, ink, 9.5);
  strokeLine(c, pose.hip.x, pose.hip.y, pose.sh.x, pose.sh.y, p.body || ch.body, 6);
  if (ch.id === 'zhangfei') {
    const bx = pose.hip.x + (pose.sh.x - pose.hip.x) * 0.15, by = pose.hip.y + (pose.sh.y - pose.hip.y) * 0.15;
    strokeLine(c, bx - 6, by + 1, bx + 6, by - 1, ch.accent, 4.5);
    const fl = Math.sin(now * 0.012 + p.idx) * 2;
    c.strokeStyle = ch.accent; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(bx - 5, by); c.quadraticCurveTo(bx - 12, by + 5 + fl, bx - 15 - clamp(p.vx * p.f, -4, 8), by + 13 + fl); c.stroke();
  } else if (ch.id === 'lubu') {
    const bx = pose.hip.x + (pose.sh.x - pose.hip.x) * 0.15, by = pose.hip.y + (pose.sh.y - pose.hip.y) * 0.15;
    strokeLine(c, bx - 6, by + 1, bx + 6, by - 1, ch.accent, 4);
    strokeLine(c, pose.sh.x - 5, pose.sh.y + 2, pose.sh.x + 5, pose.sh.y + 1, ch.accent, 4.5);
  } else if (ch.id === 'liubei') {
    const bx = pose.hip.x + (pose.sh.x - pose.hip.x) * 0.15, by = pose.hip.y + (pose.sh.y - pose.hip.y) * 0.15;
    strokeLine(c, bx - 5, by + 1, bx + 5, by - 1, ch.accent, 3.5);
  } else if (ch.id === 'guanyu') {
    strokeLine(c, pose.sh.x - 1, pose.sh.y + 3, pose.hip.x + 2, pose.hip.y - 6, '#2f8a4d', 2);
  }

  // 목, 머리
  strokeLine(c, pose.sh.x, pose.sh.y, pose.hd.x, pose.hd.y, ink, 4);
  drawHead(c, ch, p, pose, now, ink);

  // 주무기 + 앞팔
  if (ch.weapon === 'bow') drawBow(c, p, pose, ink);
  else drawWeapon(c, ch.weapon, pose.mh.x, pose.mh.y, pose.w, p.ws, now, ink, pose.grip);
  limb(c, pose.sh, pose.me, pose.mh, ink, 4.6);

  c.fillStyle = ch.id === 'zhangfei' ? ch.accent : ink;
  c.beginPath(); c.arc(pose.mh.x, pose.mh.y, 3.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = ink;
  c.beginPath(); c.arc(pose.oh.x, pose.oh.y, 2.8, 0, Math.PI * 2); c.fill();

  c.restore();
  return pose;
}

/* ----------------------------- 렌더링 ----------------------------- */
let renderFrame = 0;
let spReady = false;

function drawBanner(c, text, sub, size, col, popT) {
  const s = popT < 1 ? 1 + (1 - popT) * 0.6 : 1;
  c.save();
  c.translate(W / 2, H * 0.4);
  c.scale(s, s);
  c.globalAlpha = Math.min(1, popT * 2);
  c.font = `900 ${size}px ${SERIF}`;
  const bw = Math.max(420, c.measureText(text).width + 90), bh = size * 1.15;
  c.fillStyle = 'rgba(31,26,23,0.82)';
  c.beginPath();
  c.moveTo(-bw / 2, -bh / 2);
  for (let x = -bw / 2; x <= bw / 2; x += 20) c.lineTo(x, -bh / 2 + Math.sin(x * 0.09) * 4);
  for (let x = bw / 2; x >= -bw / 2; x -= 20) c.lineTo(x, bh / 2 + Math.sin(x * 0.07 + 2) * 5);
  c.closePath(); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `900 ${size}px ${SERIF}`;
  c.fillStyle = col;
  c.fillText(text, 0, 2);
  if (sub) {
    c.font = `700 ${Math.round(size * 0.34)}px ${SERIF}`;
    c.fillStyle = INK;
    c.fillText(sub, 0, bh / 2 + size * 0.3);
  }
  c.restore();
}

function drawHUD(c) {
  const g = game, P = g.players;
  if (g.mode === 'story') { drawStoryHUD(c); return; }
  for (let i = 0; i < 2; i++) drawPlayerBar(c, P[i], i === 0, i === g.me);
  c.textAlign = 'center'; c.fillStyle = INK;
  c.font = `900 22px ${SERIF}`;
  c.fillText(`第${hanNum(g.round)}合`, W / 2, 80);
  c.font = '700 12px sans-serif'; c.fillStyle = 'rgba(31,26,23,0.55)';
  if (g.code) c.fillText(`방 ${g.code}`, W / 2, 98);
  if (g.mode === 'practice') c.fillText('연습 모드 · vs CPU', W / 2, 98);
  if (g.link) { c.font = '700 11px sans-serif'; c.fillText(g.link, W / 2, 114); }
}

function drawStoryHUD(c) {
  const g = game, S = g.story, me = g.players[0];
  drawPlayerBar(c, me, true, true);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = `900 16px ${SERIF}`; c.fillStyle = RED;
  c.fillText(`격파 ${S.kills}`, 26, 104);
  if (S.boss) {
    drawPlayerBar(c, S.boss, false, false);
  } else {
    const left = S.queue.length + storyFoes().length;
    c.textAlign = 'right'; c.font = `900 18px ${SERIF}`; c.fillStyle = INK;
    c.fillText(FACTIONS[S.st.faction].name, W - 26, 30);
    c.font = '700 13px sans-serif'; c.fillStyle = 'rgba(31,26,23,0.7)';
    c.fillText(`남은 적 ${left}`, W - 26, 50);
  }
  c.textAlign = 'center'; c.fillStyle = INK;
  if (S.survival) {
    c.font = `900 26px ${SERIF}`; c.fillStyle = RED;
    c.fillText(`${S.score.toLocaleString()}점`, W / 2, 82);
    c.font = '700 12px sans-serif'; c.fillStyle = 'rgba(31,26,23,0.65)';
    c.fillText(`서바이벌 · 제 ${Math.max(1, S.wave + 1)} 웨이브`, W / 2, 100);
    if (S.combo >= 3) {
      const mult = 1 + Math.min(1, S.combo / 50);
      const pop = 1 + Math.max(0, S.comboT - COMBO_KEEP + 8) * 0.04;
      c.save();
      c.translate(W - 120, 150); c.scale(pop, pop);
      c.font = `900 34px ${SERIF}`; c.textAlign = 'center';
      c.lineWidth = 5; c.strokeStyle = PAPER_LIGHT;
      c.strokeText(`${S.combo} HITS`, 0, 0);
      c.fillStyle = S.combo >= 50 ? '#c98a12' : RED; c.fillText(`${S.combo} HITS`, 0, 0);
      c.font = '900 14px sans-serif'; c.fillStyle = INK;
      c.fillText(`점수 ×${mult.toFixed(1)}`, 0, 20);
      const bar = S.comboT / COMBO_KEEP;
      c.fillStyle = 'rgba(31,26,23,0.15)'; c.fillRect(-50, 28, 100, 4);
      c.fillStyle = RED; c.fillRect(-50, 28, 100 * bar, 4);
      c.restore();
    }
    return;
  }
  c.font = `900 22px ${SERIF}`;
  c.fillText(S.st.hanja, W / 2, 80);
  c.font = '700 12px sans-serif'; c.fillStyle = 'rgba(31,26,23,0.6)';
  const wave = S.bossSpawned ? '적장전' : `제 ${Math.max(1, S.wave + 1)}진 / ${S.st.waves.length}`;
  c.fillText(`${S.st.name} · ${wave}`, W / 2, 98);
}

function drawPlayerBar(c, p, left, isMe) {
  {
    const bw = 340, bh = 16, by = 36;
    const bx = left ? 26 : W - 26 - bw;
    const ax = left ? bx : bx + bw;
    c.textAlign = left ? 'left' : 'right'; c.textBaseline = 'alphabetic';
    c.font = `900 19px ${SERIF}`; c.fillStyle = INK;
    const fn = fighterName(p);
    const name = `${fn.hanja} ${fn.name}`;
    c.fillText(name, ax, by - 8);
    let tx = ax + (left ? 1 : -1) * (c.measureText(name).width + 8);
    const tag = (label, col) => {
      c.font = '700 11px sans-serif';
      const tw = c.measureText(label).width + 10;
      const x = left ? tx : tx - tw;
      c.fillStyle = col; c.fillRect(x, by - 22, tw, 16);
      c.fillStyle = PAPER_LIGHT; c.textAlign = 'center'; c.fillText(label, x + tw / 2, by - 10);
      c.textAlign = left ? 'left' : 'right';
      tx += (left ? 1 : -1) * (tw + 4);
    };
    if (isMe) tag('나', RED);
    if (p.hc) tag('핸디캡', '#2f6fd6');
    if (p.isBoss) tag('적장', '#6a2c8f');

    const frac = clamp(p.hp / p.maxHp, 0, 1), lag = clamp(p.hpLag / p.maxHp, 0, 1);
    c.fillStyle = 'rgba(31,26,23,0.15)'; c.fillRect(bx, by, bw, bh);
    const bar = (f, col) => { c.fillStyle = col; c.fillRect(left ? bx : bx + bw * (1 - f), by, bw * f, bh); };
    bar(lag, '#f0d98a');
    bar(frac, frac > 0.3 ? RED : '#d3541c');
    c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(bx, by, bw, bh);
    c.font = '700 11px sans-serif'; c.fillStyle = PAPER_LIGHT; c.textAlign = left ? 'left' : 'right';
    c.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, left ? bx + 6 : bx + bw - 6, by + 12);

    // 필살 게이지 + 가드 게이지
    const my = by + bh + 3, mh = 7;
    const mfrac = clamp(p.mp / METER_MAX, 0, 1), full = mfrac >= 1;
    c.fillStyle = 'rgba(31,26,23,0.12)'; c.fillRect(bx, my, bw, mh);
    c.fillStyle = full ? `rgba(232,176,74,${0.75 + Math.sin(renderFrame * 0.25) * 0.25})` : '#c9a227';
    c.fillRect(left ? bx : bx + bw * (1 - mfrac), my, bw * mfrac, mh);
    c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(bx, my, bw, mh);
    if (full) {
      c.font = `900 13px ${SERIF}`; c.fillStyle = '#b07a0c'; c.textAlign = left ? 'right' : 'left';
      c.fillText('필살 준비!', left ? bx + bw : bx, my + mh + 14);
    }
    if (p.gd < GUARD_MAX) {
      const gf = clamp(p.gd / GUARD_MAX, 0, 1);
      c.fillStyle = gf < 0.3 ? '#d3541c' : '#3d6fb0';
      c.fillRect(left ? bx : bx + bw * (1 - gf), my + mh + 2, bw * gf, 3);
    }

    const sy = my + mh + 7;
    for (let wv = 0; wv < Math.min(p.wins, 5); wv++) {
      const sx = left ? bx + wv * 22 : bx + bw - 18 - wv * 22;
      c.fillStyle = RED; c.fillRect(sx, sy, 18, 18);
      c.fillStyle = PAPER_LIGHT; c.font = `900 13px ${SERIF}`; c.textAlign = 'center';
      c.fillText('勝', sx + 9, sy + 14);
    }
    if (p.wins > 5) {
      c.fillStyle = RED; c.font = '900 14px sans-serif'; c.textAlign = left ? 'left' : 'right';
      c.fillText(`×${p.wins}`, left ? bx + 5 * 22 + 2 : bx + bw - 5 * 22 - 2, sy + 14);
    }
  }
}

function drawPhaseBanner(c) {
  const g = game, P = g.players;
  if (g.mode === 'story') {
    const S = g.story;
    if (S.phase === 'clear') drawBanner(c, '승리!', `${S.st.name} 평정`, 76, '#e8b04a', S.phaseT / 10);
    else if (S.phase === 'fail') drawBanner(c, S.survival ? '전사…' : '패배…', S.survival ? `${S.score.toLocaleString()}점 · ${S.kills}명 격파` : '다시 일어서라', 70, '#e0463a', S.phaseT / 10);
    else if (S.banner && g.frame - S.banner.t0 < 90) {
      const t = g.frame - S.banner.t0;
      drawBanner(c, S.banner.text, S.banner.sub, 60, S.banner.col, t / 10);
    }
    return;
  }
  if (g.phase === PHASE.INTRO) {
    if (g.round === 1 && g.pt < 55) {
      const a = CHAR[P[0].c], b = CHAR[P[1].c];
      drawBanner(c, `${a.hanja}  VS  ${b.hanja}`, `${a.name} 대 ${b.name}`, 54, PAPER_LIGHT, g.pt / 12);
    } else {
      const t = g.round === 1 ? g.pt - 55 : g.pt;
      drawBanner(c, `第${hanNum(g.round)}合`, `제 ${g.round} 합 · 준비`, 64, PAPER_LIGHT, t / 12);
    }
    if (g.round <= 2) drawControlsHint(c);
  } else if (g.phase === PHASE.FIGHT && g.pt < FIGHT_BANNER) {
    drawBanner(c, '싸워라!', null, 70, '#e8b04a', g.pt / 8);
  } else if (g.phase === PHASE.KO) {
    if (g.pt < 80) drawBanner(c, 'K.O.', null, 86, '#e0463a', g.pt / 10);
    else {
      const txt = g.winner < 0 ? '무승부' : `${CHAR[P[g.winner].c].name} 승리!`;
      const sub = g.winner < 0 ? '' : g.winner === g.me ? '천하무쌍! 이겼다!' : '다음 합을 노려라…';
      drawBanner(c, txt, sub, 56, '#e8b04a', (g.pt - 80) / 10);
    }
  }
}

function drawControlsHint(c) {
  const lines = [
    '상대 반대쪽 방향을 누르고 있으면 막기 · 맞기 직전에 누르면 튕겨내기',
    '[체술] 주먹 · 앞+[체술] 발차기(막기 깨기) · 공중 [체술] 날아차기',
    '긴 무기는 품 안으로 파고들면 약해요 · 게이지가 차면 [필살]',
  ];
  c.save();
  c.font = '700 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.max(...lines.map(l => c.measureText(l).width)) + 30;
  const bh = lines.length * 22 + 6;
  c.fillStyle = 'rgba(243,234,210,0.88)';
  c.fillRect(W / 2 - w / 2, H * 0.6 - 4, w, bh);
  c.strokeStyle = 'rgba(31,26,23,0.5)'; c.lineWidth = 1.5;
  c.strokeRect(W / 2 - w / 2, H * 0.6 - 4, w, bh);
  c.fillStyle = INK;
  lines.forEach((l, i) => c.fillText(l, W / 2, H * 0.6 + 9 + i * 22));
  c.restore();
}

function drawCutin(c) {
  const ci = fx.cutin;
  if (!ci) return;
  const t = 1 - ci.life / ci.max;
  const slide = t < 0.15 ? 1 - t / 0.15 : 0;
  const fromLeft = ci.idx === 0;
  const alpha = t > 0.8 ? (1 - t) / 0.2 : 1;
  c.save();
  c.globalAlpha = alpha;
  c.translate((fromLeft ? -1 : 1) * slide * W, 0);
  c.fillStyle = 'rgba(31,26,23,0.85)';
  c.beginPath();
  c.moveTo(0, 170); c.lineTo(W, 155); c.lineTo(W, 235); c.lineTo(0, 250); c.closePath(); c.fill();
  c.fillStyle = '#e8b04a'; c.fillRect(0, 168, W, 3); c.fillRect(0, 247, W, 3);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `900 46px ${SERIF}`; c.fillStyle = PAPER_LIGHT;
  c.fillText(`${ci.name}!`, W / 2, 196);
  c.font = `700 20px ${SERIF}`; c.fillStyle = '#e8b04a';
  c.fillText(ci.hanja, W / 2, 230);
  c.restore();
}

function drawWarn(c, p, pose, now) {
  const x = p.rx + p.f * pose.hd.x, y = p.ry + pose.hd.y - 30 + Math.sin(now * 0.03) * 2;
  c.save();
  c.font = `900 22px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 4; c.strokeStyle = PAPER_LIGHT; c.strokeText('!', x, y);
  c.fillStyle = '#d3241c'; c.fillText('!', x, y);
  c.restore();
}

function drawArrow(c, a) {
  const ang = Math.atan2(a.vy, a.vx), cs = Math.cos(ang), sn = Math.sin(ang);
  const tx = a.x - cs * 26, ty = a.y - sn * 26;
  strokeLine(c, tx, ty, a.x, a.y, '#5a4630', 2);
  c.fillStyle = '#9aa3ad';
  c.beginPath();
  c.moveTo(a.x + cs * 6, a.y + sn * 6);
  c.lineTo(a.x - sn * 3, a.y + cs * 3);
  c.lineTo(a.x + sn * 3, a.y - cs * 3);
  c.closePath(); c.fill();
  c.strokeStyle = '#c0392b'; c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(tx, ty); c.lineTo(tx - cs * 5 - sn * 4, ty - sn * 5 + cs * 4);
  c.moveTo(tx, ty); c.lineTo(tx - cs * 5 + sn * 4, ty - sn * 5 - cs * 4);
  c.stroke();
}

function drawBun(c, it, now) {
  const bob = Math.sin(now * 0.006 + it.x) * 2;
  const x = it.x, y = it.y + bob;
  c.save();
  c.globalAlpha = it.life < 90 ? (Math.floor(it.life / 6) % 2 ? 0.4 : 1) : 1;
  c.fillStyle = 'rgba(31,26,23,0.15)';
  c.beginPath(); c.ellipse(x, GROUND + 2, 12, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fbf6ea'; c.strokeStyle = INK; c.lineWidth = 1.8;
  c.beginPath(); c.ellipse(x, y, 13, 9, 0, Math.PI, 0); c.lineTo(x + 13, y + 3); c.lineTo(x - 13, y + 3); c.closePath(); c.fill(); c.stroke();
  c.lineWidth = 1.2;
  c.beginPath();
  for (let i = -2; i <= 2; i++) { c.moveTo(x + i * 3, y - 8 + Math.abs(i)); c.quadraticCurveTo(x + i * 1.5, y - 4, x, y - 9); }
  c.stroke();
  c.restore();
}

function drawDizzy(c, p, pose, now) {
  const hx = p.rx + p.f * pose.hd.x, hy = p.ry + pose.hd.y - 20;
  for (let i = 0; i < 3; i++) {
    const a = now * 0.008 + i * (Math.PI * 2 / 3);
    const x = hx + Math.cos(a) * 16, y = hy + Math.sin(a) * 5;
    c.fillStyle = '#e8b04a'; c.strokeStyle = INK; c.lineWidth = 1;
    c.beginPath();
    for (let j = 0; j < 10; j++) {
      const r = j % 2 ? 2.2 : 5, b = j * Math.PI / 5 - Math.PI / 2;
      c.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
    c.closePath(); c.fill(); c.stroke();
  }
}

const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

/* 궤적은 지난 그리기 이후의 공격 프레임 사이를 소수 프레임으로 나눠 샘플링한다. 한 프레임에 40°씩 도는 회전도 매끄러운 호가 된다. */
function updateTrails(p, now) {
  const mv = p.af >= 0 && p.st === ST.ATK ? moveOf(p) : null;
  const arms = mv ? mv.arms.filter(a => a !== 'fist') : [];
  for (const arm of Object.keys(p.trails)) {
    if (arms.includes(arm)) continue;
    p.trails[arm].splice(0, 3);
    if (!p.trails[arm].length) delete p.trails[arm];
  }
  if (!arms.length) { p.trailAf = -1; return; }
  if (p.af === p.trailAf) return;
  const from = p.trailAf >= 0 && p.trailAf < p.af ? p.trailAf : p.af - 0.34;
  const steps = Math.max(1, Math.min(6, Math.ceil((p.af - from) * 3)));
  const q = Object.assign({}, p);
  for (let s = 1; s <= steps; s++) {
    q.af = from + (p.af - from) * s / steps;
    const pose = computePose(q, now);
    for (const arm of arms) {
      const sg = bladeSeg(q, pose, arm, p.rx, p.ry);
      const t = p.trails[arm] || (p.trails[arm] = []);
      t.push([sg.ax + (sg.bx - sg.ax) * 0.3, sg.ay + (sg.by - sg.ay) * 0.3, sg.bx, sg.by]);
      if (t.length > 16) t.shift();
    }
  }
  p.trailAf = p.af;
}

function drawTrail(c, p) {
  const col = rgbOf(CHAR[p.c].fx || '#4a423b');
  const big = p.mv === 's' || (p.af >= 0 && moveOf(p).fin);
  for (const t of Object.values(p.trails)) {
    const n = t.length;
    if (n < 2) continue;
    for (let i = 1; i < n; i++) {
      const a = t[i - 1], b = t[i], k = i / n;
      c.fillStyle = `rgba(${col},${(k * k * (big ? 0.6 : 0.42)).toFixed(3)})`;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.lineTo(b[2], b[3]); c.lineTo(b[0], b[1]); c.closePath(); c.fill();
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(t[0][2], t[0][3]);
    for (let i = 1; i < n; i++) c.lineTo(t[i][2], t[i][3]);
    c.strokeStyle = `rgba(${col},0.7)`; c.lineWidth = big ? 5 : 3.5; c.stroke();
    c.strokeStyle = 'rgba(255,253,240,0.85)'; c.lineWidth = big ? 2 : 1.3; c.stroke();
  }
}

function drawWave(c, a) {
  const col = rgbOf(CHAR[a.owner.c].fx || '#8a44c8');
  const d = a.vx >= 0 ? 1 : -1, al = clamp(a.life / 12, 0, 1);
  c.save();
  c.translate(a.x, a.y); c.scale(d, 1);
  c.beginPath();
  c.arc(-14, 0, 46, -1.05, 1.05);
  c.arc(-26, 0, 40, 1.0, -1.0, true);
  c.closePath();
  c.fillStyle = `rgba(${col},${(0.55 * al).toFixed(3)})`; c.fill();
  c.strokeStyle = `rgba(255,253,240,${(0.9 * al).toFixed(3)})`; c.lineWidth = 2;
  c.beginPath(); c.arc(-14, 0, 44, -0.95, 0.95); c.stroke();
  c.restore();
}

function render(now, k) {
  const { dpr, scale, ox, oy } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCanvas, 0, 0);
  if (!game) return;
  const g = game;
  renderFrame++;

  for (const p of g.players) {
    if (g.mode === 'client') {
      const d = Math.hypot(p.x - p.rx, p.y - p.ry);
      if (d > 120) { p.rx = p.x; p.ry = p.y; } else { const a = 1 - Math.pow(0.45, k); p.rx += (p.x - p.rx) * a; p.ry += (p.y - p.ry) * a; }
    } else { p.rx = p.x; p.ry = p.y; }
    if (p.st === ST.WALK || p.st === ST.GUARD) p.wp += p.vx * p.f * 0.09 * k;
    p.hpLag += (p.hp - p.hpLag) * Math.min(1, 0.06 * k);
    if (p.hpLag < p.hp) p.hpLag = p.hp;
    const fast = p.st === ST.DASH || (p.st === ST.ATK && Math.abs(p.vx) > 6.5);
    if (fast && renderFrame % 2 === 0) { p.ghosts.push([p.rx, p.ry]); if (p.ghosts.length > 5) p.ghosts.shift(); }
    else if (!fast && p.ghosts.length && renderFrame % 2 === 0) p.ghosts.shift();
    updateTrails(p, now);
  }

  const shx = (Math.random() - 0.5) * fx.shake, shy = (Math.random() - 0.5) * fx.shake;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + shx * scale), dpr * (oy + shy * scale));
  if (fx.zoom > 0.001) {
    const z = 1 + fx.zoom;
    ctx.translate(fx.zx, fx.zy); ctx.scale(z, z); ctx.translate(-fx.zx, -fx.zy);
  }

  // 그림자
  for (const p of g.players) {
    const hgt = GROUND - p.ry, s = clamp(1 - hgt / 320, 0.3, 1);
    ctx.fillStyle = `rgba(31,26,23,${0.2 * s})`;
    ctx.beginPath(); ctx.ellipse(p.rx, GROUND + 3, 28 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 대시 잔상
  for (const p of g.players) p.ghosts.forEach((gh, i) => drawFighter(ctx, p, now, gh[0], gh[1], 0.1 + i * 0.05));

  if (g.items) for (const it of g.items) drawBun(ctx, it, now);

  // 무기 궤적 + 캐릭터 (내 캐릭터를 맨 앞에)
  const meP = g.players[g.me];
  const order = g.players.filter(p => p !== meP);
  if (meP) order.push(meP);
  for (const p of order) {
    drawTrail(ctx, p);
    const fade = g.mode === 'story' && p !== meP && p.st === ST.KO ? clamp(1 - (p.kt - 40) / 30, 0, 1) : 1;
    const pose = drawFighter(ctx, p, now, p.rx, p.ry, fade);
    if (p !== meP && g.mode === 'story' && p.af >= 0 && p.st === ST.ATK) {
      const mv = moveOf(p), first = mv.hits.length ? mv.hits[0].from : mv.fire || 0;
      if (p.af < first) drawWarn(ctx, p, pose, now);
    }
    if (p.dz > 0 && p.st !== ST.KO) drawDizzy(ctx, p, pose, now);
    if (p.st === ST.BLOCK) {
      ctx.strokeStyle = 'rgba(120,160,220,0.55)'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.rx + p.f * 6, p.ry - 62, 52, p.f > 0 ? -0.9 : Math.PI - 0.9, p.f > 0 ? 0.9 : Math.PI + 0.9);
      ctx.stroke();
    }

    if (showHitbox) {
      const hb = hurtbox(p, p.rx, p.ry);
      ctx.strokeStyle = 'rgba(30,110,220,0.8)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0);
      const hits = moveOf(p).hits;
      const arms = p.af >= 0 && moveOf(p).arms.length ? moveOf(p).arms : CHAR[p.c].weapon === 'twin' ? ['main', 'off'] : ['main'];
      for (const arm of arms) {
        const active = p.af >= 0 && hits.some(h => h.arm === arm && p.af >= h.from && p.af <= h.to);
        const sgm = bladeSeg(p, pose, arm, p.rx, p.ry);
        ctx.strokeStyle = active ? 'rgba(230,30,30,0.9)' : 'rgba(230,120,30,0.45)';
        ctx.lineWidth = sgm.r * 2; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(sgm.ax, sgm.ay); ctx.lineTo(sgm.bx, sgm.by); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  if (g.projs) for (const a of g.projs) { if (a.kind === 'wave') drawWave(ctx, a); else drawArrow(ctx, a); }

  // 내 캐릭터 표시
  const me = g.players[g.me];
  if (me && me.st !== ST.KO) {
    const yy = me.ry - 150 + Math.sin(now * 0.006) * 3;
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(me.rx - 7, yy); ctx.lineTo(me.rx + 7, yy); ctx.lineTo(me.rx, yy + 9); ctx.closePath(); ctx.fill();
  }

  // 타격 이펙트
  for (const s of fx.slashes) {
    const t = s.life / s.max, L = s.len * (1.2 - t * 0.4);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = `rgba(168,40,32,${t * 0.85})`;
    ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -6 * t - 1, L / 2, 0); ctx.quadraticCurveTo(0, 3 * t, -L / 2, 0); ctx.fill();
    ctx.restore();
  }
  for (const b of fx.bursts) {
    const t = b.life / b.max, r = b.r * (1.3 - t * 0.5);
    const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    gr.addColorStop(0, `rgba(255,253,240,${(0.95 * t).toFixed(3)})`);
    gr.addColorStop(0.35, `rgba(${b.col},${(0.6 * t).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${b.col},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
  }
  for (const s of fx.streaks) {
    const t = s.life / s.max, d0 = s.len * (1 - t) * 0.6, d1 = d0 + s.len * t;
    const c = Math.cos(s.a), sn = Math.sin(s.a);
    ctx.strokeStyle = `rgba(${s.col},${(0.9 * t).toFixed(3)})`; ctx.lineWidth = s.w * t + 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x + c * d0, s.y + sn * d0); ctx.lineTo(s.x + c * d1, s.y + sn * d1); ctx.stroke();
  }
  for (const p of fx.parts) {
    ctx.fillStyle = p.col + (p.life / p.max).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const r of fx.rings) {
    ctx.strokeStyle = `rgba(${r.col},${(r.life / r.max * 0.8).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.5, r.w);
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.min(1, t.life / 15);
    ctx.font = `900 ${t.size}px ${SERIF}`;
    ctx.lineWidth = 4; ctx.strokeStyle = PAPER_LIGHT; ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.col || RED; ctx.fillText(t.txt, t.x, t.y);
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  drawCutin(ctx);
  drawHUD(ctx);
  drawPhaseBanner(ctx);
  if (me) {
    const ready = me.mp >= METER_MAX;
    if (ready !== spReady) { spReady = ready; $('spBtn').classList.toggle('ready', ready); }
  }

  if (g.mode === 'client' && performance.now() - g.lastRecv > 1500) {
    ctx.textAlign = 'center'; ctx.font = '700 16px sans-serif'; ctx.fillStyle = RED;
    ctx.fillText('연결이 불안정해요...', W / 2, 120);
  }

  if (fx.flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,250,235,${fx.flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/* ----------------------------- 메인 루프 ----------------------------- */
let lastTs = 0, acc = 0;

function gameTick() {
  const g = game;
  if (g.mode === 'story') {
    Object.assign(g.inputs[0], localInput);
    storyStep();
  } else if (g.mode === 'host' || g.mode === 'practice') {
    Object.assign(g.inputs[0], localInput);
    simStep();
    if (g.mode === 'host') broadcastState();
    else g.pending.length = 0;
    if (g.mode === 'host' && performance.now() - g.lastRecv > NET_TIMEOUT) onDisconnect('상대의 응답이 없어 연결을 종료했어요.');
  } else {
    netSend({ t: 'i', ...localInput });
    if (performance.now() - g.lastRecv > NET_TIMEOUT) onDisconnect('방장의 응답이 없어 연결을 종료했어요.');
  }
}

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, ts - (lastTs || ts));
  lastTs = ts;
  const k = dt / TICK_MS;
  if (game) {
    acc += dt;
    let steps = 0;
    while (acc >= TICK_MS && steps < 5 && game) { gameTick(); acc -= TICK_MS; steps++; }
    if (steps >= 5) acc = 0;
  }
  updateEffects(k);
  render(ts, k);
  if (!game && !$('menu').classList.contains('hidden')) renderPreviews(ts, k);
}

/* ----------------------------- 화면 전환 / 메뉴 ----------------------------- */
let selectedChar = localStorage.getItem('sb_char') || 'liubei';
if (!CHAR[selectedChar]) selectedChar = 'liubei';
const previews = [];

function showScreen(name) {
  $('menu').classList.toggle('hidden', name !== 'menu');
  $('lobby').classList.toggle('hidden', name !== 'lobby');
  $('storyScreen').classList.toggle('hidden', name !== 'story');
  $('rankScreen').classList.toggle('hidden', name !== 'rank');
  if (name !== 'game') { $('talk').classList.add('hidden'); $('storyResult').classList.add('hidden'); $('survResult').classList.add('hidden'); }
  if (name === 'story') buildStoryScreen();
  if (name === 'rank') buildRankScreen();
  const inGame = name === 'game';
  $('pad').classList.toggle('hidden', !inGame);
  $('exitBtn').classList.toggle('hidden', !inGame);
  if (inGame) requestAnimationFrame(cachePadRects);
  if (name === 'menu') requestAnimationFrame(sizePreviews);
}

function menuMsg(t) { $('menuMsg').textContent = t || ''; }
function lobbyMsg(t) { $('lobbyMsg').textContent = t; }
function netInfo(t) { $('netInfo').textContent = t || ''; }

function showLobby(title, code, msg, copy) {
  $('lobbyTitle').textContent = title;
  $('roomCode').textContent = code;
  lobbyMsg(msg);
  netInfo('');
  $('copyBtn').classList.toggle('hidden', !copy);
  showScreen('lobby');
}

let wakeLock = null;
async function enterGame() {
  fx.parts.length = fx.slashes.length = fx.texts.length = fx.bursts.length = fx.streaks.length = fx.rings.length = 0;
  fx.zoom = 0;
  acc = 0;
  showScreen('game');
  clearInterval(net.linkTimer);
  if (game && (game.mode === 'host' || game.mode === 'client')) {
    net.linkTimer = setInterval(updateLinkInfo, 2000);
    setTimeout(updateLinkInfo, 300);
  }
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 지원 안 함 */ }
}

function leaveGame(to = 'menu') {
  netClose();
  game = null;
  spReady = false;
  $('spBtn').classList.remove('ready');
  fx.cutin = null;
  for (const k of KEYS) { padHeld[k] = keyHeld[k] = mouseHeld[k] = false; }
  refreshInput();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  showScreen(to);
}

let storyChar = null;

function buildStoryScreen() {
  const c = storyChar || selectedChar;
  storyChar = c;
  const story = STORIES[c], ch = CHAR[c];
  const prog = storyProgress()[c] || { cleared: 0, best: {} };
  const tabs = $('storyTabs');
  tabs.innerHTML = '';
  for (const h of CHARACTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'story-tab' + (h.id === c ? ' on' : '');
    const done = (storyProgress()[h.id] || {}).cleared || 0;
    b.innerHTML = `${h.name}<small>${done}/${STORIES[h.id].stages.length}</small>`;
    b.addEventListener('click', () => { storyChar = h.id; buildStoryScreen(); });
    tabs.appendChild(b);
  }
  $('storyTitle').textContent = `${ch.hanja} ${ch.name} · 「${story.title}」`;
  const list = $('stageList');
  list.innerHTML = '';
  story.stages.forEach((st, i) => {
    const locked = i > prog.cleared;
    const cleared = i < prog.cleared;
    const boss = st.boss.name || CHAR[st.boss.c].name;
    const best = prog.best[i];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'stage-card' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '');
    card.disabled = locked;
    card.innerHTML = `
      <div class="stage-no">第${hanNum(i + 1)}章</div>
      <div class="stage-name">${st.name}<small>${st.hanja}</small></div>
      <div class="stage-meta">${FACTIONS[st.faction].name} · 적장 ${boss}</div>
      <div class="stage-state">${locked ? '잠김' : cleared ? `클리어${best ? ` · ${best.time}초` : ''}` : '도전!'}</div>
      <canvas class="stage-boss"></canvas>`;
    card.addEventListener('click', () => { Sound.init(); goFullscreen(); startStory(c, i); });
    list.appendChild(card);
  });
  requestAnimationFrame(drawStageBosses);
}

function drawStageBosses() {
  const story = STORIES[storyChar];
  if (!story) return;
  [...document.querySelectorAll('.stage-boss')].forEach((cv, i) => {
    const st = story.stages[i], b = st.boss, fac = FACTIONS[st.faction];
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    cv.width = Math.round(r.width * view.dpr); cv.height = Math.round(r.height * view.dpr);
    const c = cv.getContext('2d');
    const p = makePlayer(9, b.c, false);
    p.f = -1;
    if (CHAR[b.c].soldier) { p.body = fac.body; p.helm = fac.helm; p.band = fac.band; }
    const s = Math.min(cv.height / 165, cv.width / 140);
    c.setTransform(s, 0, 0, s, cv.width * 0.62, cv.height - 6 * s);
    c.fillStyle = 'rgba(31,26,23,0.15)';
    c.beginPath(); c.ellipse(0, 2, 26, 4, 0, 0, Math.PI * 2); c.fill();
    drawFighter(c, p, 0, 0, 0, 1);
  });
}

function goFullscreen() {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (!isTouch) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) {
    Promise.resolve(req.call(el)).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
}

function buildMenu() {
  const list = $('charList');
  CHARACTERS.forEach((ch, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = ch.id;
    const cv = document.createElement('canvas');
    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `${ch.name}<small>${ch.hanja}</small>`;
    card.append(cv, label);
    card.addEventListener('click', () => selectChar(ch.id));
    list.appendChild(card);
    const p = makePlayer(i, ch.id, false);
    p.f = 1;
    previews.push({ card, cv, p, t: 0 });
  });
  selectChar(selectedChar);

  $('hostBtn').addEventListener('click', () => { Sound.init(); goFullscreen(); menuMsg(''); hostRoom(false); });
  $('joinBtn').addEventListener('click', () => { Sound.init(); goFullscreen(); menuMsg(''); joinRoom(); });
  $('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('practiceBtn').addEventListener('click', () => {
    Sound.init(); goFullscreen(); menuMsg('');
    const others = CHARACTERS.filter(c => c.id !== selectedChar);
    const cpu = others[(Math.random() * others.length) | 0].id;
    createGame({ mode: 'practice', me: 0, chars: [selectedChar, cpu], handicap: $('handicap').checked });
    enterGame();
  });
  $('cancelBtn').addEventListener('click', () => { netClose(); showScreen('menu'); });
  $('storyBtn').addEventListener('click', () => { Sound.init(); menuMsg(''); storyChar = selectedChar; showScreen('story'); });
  $('survivalBtn').addEventListener('click', () => { Sound.init(); goFullscreen(); menuMsg(''); startSurvival(selectedChar); });
  $('rankBtn').addEventListener('click', () => { rankChar = selectedChar; showScreen('rank'); });
  $('rankBack').addEventListener('click', () => showScreen('menu'));
  $('rankLocal').addEventListener('click', () => { rankScope = 'local'; buildRankScreen(); });
  $('rankGlobal').addEventListener('click', () => { rankScope = 'global'; buildRankScreen(); });
  $('survSave').addEventListener('click', saveSurvivalRecord);
  $('survName').addEventListener('keydown', e => { if (e.key === 'Enter') saveSurvivalRecord(); });
  $('survRetry').addEventListener('click', () => { const c = game.story.c; leaveGame('menu'); startSurvival(c); });
  $('survRanking').addEventListener('click', () => { rankChar = game.story.c; leaveGame('rank'); });
  $('survMenu').addEventListener('click', () => leaveGame('menu'));
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('talk').addEventListener('click', advanceTalk);
  $('resultNext').addEventListener('click', () => { const S = game.story; leaveGame('story'); startStory(S.c, S.idx + 1); });
  $('resultRetry').addEventListener('click', () => { const S = game.story; leaveGame('story'); startStory(S.c, S.idx); });
  $('resultMenu').addEventListener('click', () => { storyChar = game.story.c; leaveGame('story'); });
  $('copyBtn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${net.code}`;
    try { await navigator.clipboard.writeText(url); lobbyMsg('초대 링크를 복사했어요! 상대를 기다리는 중...'); }
    catch (e) { lobbyMsg(url); }
  });
  $('exitBtn').addEventListener('click', () => {
    if (game && game.mode === 'story' && game.story.survival) leaveGame('menu');
    else if (game && game.mode === 'story') { storyChar = game.story.c; leaveGame('story'); } else leaveGame();
  });
  $('soundOpt').addEventListener('change', e => { Sound.enabled = e.target.checked; localStorage.setItem('sb_sound', e.target.checked ? '1' : '0'); });
  $('hitboxOpt').addEventListener('change', e => { showHitbox = e.target.checked; });
  $('handicap').addEventListener('change', e => localStorage.setItem('sb_handicap', e.target.checked ? '1' : '0'));

  $('handicap').checked = localStorage.getItem('sb_handicap') === '1';
  Sound.enabled = localStorage.getItem('sb_sound') !== '0';
  $('soundOpt').checked = Sound.enabled;

  const room = new URLSearchParams(location.search).get('room');
  if (room) { $('codeInput').value = room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); menuMsg('초대받은 방 코드가 입력됐어요. 캐릭터를 고르고 [참여]를 누르세요.'); }

  setupInstallGuide();
}

/* iOS 브라우저는 전체화면 API가 없어 주소창·탭이 화면을 가린다. 홈 화면에 추가(standalone)해야 꽉 찬 화면이 된다. */
function setupInstallGuide() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || standalone) return;
  const guide = $('installGuide');
  $('installBtn').classList.remove('hidden');
  $('installBtn').addEventListener('click', () => guide.classList.remove('hidden'));
  $('guideClose').addEventListener('click', () => guide.classList.add('hidden'));
  if (!localStorage.getItem('sb_install_seen')) {
    localStorage.setItem('sb_install_seen', '1');
    guide.classList.remove('hidden');
  }
}

function selectChar(id) {
  selectedChar = id;
  localStorage.setItem('sb_char', id);
  const ch = CHAR[id];
  for (const pv of previews) {
    pv.card.classList.toggle('selected', pv.p.c === id);
    pv.t = 0; pv.step = 0; pv.p.af = -1; pv.p.mv = 'n'; pv.p.trails = {}; pv.p.trailAf = -1;
  }
  $('infoName').textContent = `${ch.hanja} ${ch.name}`;
  $('infoWeapon').textContent = `무기: ${ch.weaponName}`;
  $('infoDesc').textContent = ch.desc;
  $('infoSpecial').textContent = `필살기 · ${ch.special.name}(${ch.special.hanja}): ${ch.special.desc}`;
  const stats = $('infoStats');
  stats.innerHTML = '';
  for (const [label, v] of Object.entries(ch.stats)) {
    const l = document.createElement('span'); l.textContent = label;
    const pips = document.createElement('span'); pips.className = 'pips';
    for (let i = 0; i < 5; i++) { const d = document.createElement('i'); d.className = 'pip' + (i < v ? ' on' : ''); pips.appendChild(d); }
    stats.append(l, pips);
  }
  fitInfoText();
}

/* 설명 글은 칸 높이가 고정이므로, 무기 설명은 한 줄·필살기는 두 줄에 들어갈 때까지 글자를 줄인다. */
function fitText(el, maxLines, maxPx, minPx) {
  let size = maxPx;
  el.style.fontSize = size + 'px';
  el.classList.add('fitting');
  const fits = () => (maxLines === 1 ? el.scrollWidth <= el.clientWidth + 1 : el.scrollHeight <= size * 1.35 * maxLines + 2);
  while (!fits() && size > minPx) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
  el.classList.remove('fitting');
}

function fitInfoText() {
  if ($('menu').classList.contains('hidden')) return;
  const base = clamp(window.innerHeight * 0.03, 11, 14);
  fitText($('infoDesc'), 1, base, 9);
  fitText($('infoSpecial'), 2, base, 9);
}

function sizePreviews() {
  for (const pv of previews) {
    const r = pv.cv.getBoundingClientRect();
    if (!r.width) continue;
    pv.cv.width = Math.round(r.width * view.dpr);
    pv.cv.height = Math.round(r.height * view.dpr);
  }
  fitInfoText();
}

function renderPreviews(now, k) {
  for (const pv of previews) {
    const c = pv.cv.getContext('2d'), p = pv.p;
    const cw = pv.cv.width, chh = pv.cv.height;
    if (!cw || !chh) continue;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cw, chh);
    const selected = p.c === selectedChar;
    let oy = 0;
    if (selected) {
      pv.t += k;
      const seq = [...CHAR[p.c].combo, 's'];
      pv.step = pv.step || 0;
      let A = moveOf(p);
      const gap = p.mv === 's' ? 40 : 10;
      if (pv.t >= A.total + gap) {
        pv.t = 0;
        pv.step = (pv.step + 1) % seq.length;
        p.mv = seq[pv.step];
        p.an++;
        A = moveOf(p);
      }
      const f = pv.t;
      p.af = f < A.total ? f : -1;
      p.st = p.af >= 0 ? ST.ATK : ST.IDLE;
      p.g = true; p.vy = 0;
      if (A.hop && p.af >= A.hop[0]) {
        const t = p.af - A.hop[0], h = A.hop[1] * t - 0.4 * t * t;
        if (h > 0) { oy = -h; p.g = false; p.vy = -A.hop[1] + 0.8 * t; }
      }
    } else { p.af = -1; p.mv = 'n'; p.st = ST.IDLE; pv.step = 0; p.g = true; }
    const s = Math.min(chh / 160, cw / 150);
    c.setTransform(s, 0, 0, s, cw * 0.3, chh - 10 * s);
    c.fillStyle = 'rgba(31,26,23,0.15)';
    c.beginPath(); c.ellipse(0, 2, 26, 4, 0, 0, Math.PI * 2); c.fill();
    p.rx = 0; p.ry = oy;
    updateTrails(p, now);
    drawTrail(c, p);
    drawFighter(c, p, now, 0, oy, 1);
  }
}

/* ----------------------------- 아이콘 (코드 생성) ----------------------------- */
function makeAppleIcon() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 180;
  const c = cv.getContext('2d');
  c.fillStyle = PAPER; c.fillRect(0, 0, 180, 180);
  c.fillStyle = 'rgba(178,48,38,0.85)'; c.beginPath(); c.arc(132, 46, 22, 0, Math.PI * 2); c.fill();
  const p = makePlayer(0, 'guanyu', false);
  p.af = 25; p.st = ST.ATK;
  c.setTransform(1.15, 0, 0, 1.15, 52, 168);
  drawFighter(c, p, 0, 0, 0, 1);
  $('appleIcon').href = cv.toDataURL('image/png');
}

/* ----------------------------- 시작 ----------------------------- */
function boot() {
  setupPad();
  buildMenu();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  try { makeAppleIcon(); } catch (e) { /* ignore */ }
  requestAnimationFrame(frame);
}

boot();
