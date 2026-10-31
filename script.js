'use strict';

/* =========================================================================
 * Stick Brawl (스틱 브롤) — 삼국지 실시간 P2P 스틱맨 격투
 * 모든 그래픽은 Canvas API로, 모든 효과음은 Web Audio로 코드에서 생성한다.
 * ========================================================================= */

/* ----------------------------- 상수 ----------------------------- */
const W = 960, H = 540, GROUND = 462;
const TICK_MS = 1000 / 60;
const PEER_PREFIX = 'stickbrawl-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BASE_HP = 100;
const GRAVITY = 0.8, MOVE_SPEED = 4.6, JUMP_V = 15.5;
const DASH_SPEED = 13, DASH_FRAMES = 12, DASH_INV = 10, DASH_CD = 40;
const INTRO_FRAMES = 100, KO_FRAMES = 180, FIGHT_BANNER = 45;
const HURT_W = 36, HURT_H = 114;
const NET_TIMEOUT = 8000;
const PHASE = { INTRO: 0, FIGHT: 1, KO: 2 };
const ST = { IDLE: 0, WALK: 1, AIR: 2, ATK: 3, HIT: 4, DASH: 5, KO: 6 };
const SK = { hip: 52, torso: 40, neck: 5, headR: 11, upper: 22, fore: 22, thigh: 28, shin: 27 };
const INK = '#1f1a17', PAPER = '#e6ddc5', PAPER_LIGHT = '#f3ead2', RED = '#a8322a';
const SERIF = '"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang","Songti SC",serif';
const HAN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/* ----------------------------- 무기 / 캐릭터 정의 -----------------------------
 * 무기 판정은 손 위치에서 무기 각도 방향으로 [from, to] 구간의 캡슐(반지름 r)로 계산.
 * off는 날 중심선이 자루에서 수직으로 벗어난 정도(언월도처럼 한쪽으로 넓은 날).
 * grip2가 있으면 양손 무기: 뒷손은 자루 위 grip2 지점을 잡는다(IK).
 */
const WEAPONS = {
  twin:      { from: 4,  to: 36,  r: 7,  off: 0, grip2: null },
  glaive:    { from: 34, to: 104, r: 15, off: 4, grip2: -26 },
  serpent:   { from: 50, to: 110, r: 8,  off: 0, grip2: -28 },
  sevenstar: { from: 4,  to: 58,  r: 10, off: 1, grip2: null },
  spear:     { from: 46, to: 98,  r: 9,  off: 0, grip2: -26 },
};

/* 키프레임: [frame, handX, handY, weaponAngle] (어깨 기준, 오른쪽을 바라볼 때 좌표) */
const CHARACTERS = [
  {
    id: 'liubei', name: '유비', hanja: '劉備', weapon: 'twin', weaponName: '쌍고검 (雙股劍)',
    desc: '밸런스형 · 한 번 공격에 두 번 베는 빠른 쌍검',
    hp: 1.0, speed: 1.0, jump: 1.0, body: '#e0b422', accent: '#2e8b3d',
    stats: { 체력: 3, 속도: 3, 공격력: 2, 공속: 4, 사거리: 2 },
    idle: { main: [18, 14, -0.9], off: [10, 18, -0.4], lean: 0 },
    attack: {
      total: 24, lunge: [5, 3],
      main: [[3, -6, -30, -2.4], [7, 34, 16, 0.9], [11, 28, 20, 1.1]],
      off: [[5, 10, 18, -0.4], [8, -10, -26, -2.3], [12, 36, 6, 0.5], [16, 30, 12, 0.7]],
      lean: [[7, 0.25], [12, 0.3], [16, 0.2]],
      hits: [
        { from: 4, to: 7, arm: 'main', dmg: 6, kb: 4, up: 2 },
        { from: 9, to: 12, arm: 'off', dmg: 7, kb: 6.5, up: 3 },
      ],
    },
  },
  {
    id: 'guanyu', name: '관우', hanja: '關羽', weapon: 'glaive', weaponName: '청룡언월도 (靑龍偃月刀)',
    desc: '느리지만 묵직한 한 방 · 넓은 베기 궤적 · 휘두르는 동안 경직 무시',
    hp: 1.2, speed: 0.8, jump: 0.92, body: '#1f5e33', accent: '#2f8a4d',
    stats: { 체력: 5, 속도: 1, 공격력: 5, 공속: 1, 사거리: 4 },
    idle: { main: [16, 10, -1.2], off: [0, 0, 0], lean: 0 },
    attack: {
      total: 48, lunge: [21, 5], armor: [8, 29],
      main: [[16, -14, -28, -2.6], [21, 10, -34, -1.5], [25, 34, -4, 0], [29, 32, 10, 0.9], [36, 32, 10, 0.9]],
      lean: [[16, -0.2], [25, 0.2], [29, 0.3], [36, 0.3]],
      hits: [{ from: 19, to: 29, arm: 'main', dmg: 24, kb: 12, up: 6 }],
    },
  },
  {
    id: 'zhangfei', name: '장비', hanja: '張飛', weapon: 'serpent', weaponName: '장팔사모 (丈八蛇矛)',
    desc: '빠른 발 · 앞으로 뛰어들며 찌르는 긴 사거리의 강력한 찌르기',
    hp: 0.9, speed: 1.15, jump: 1.05, body: '#151515', accent: '#c0392b',
    stats: { 체력: 2, 속도: 4, 공격력: 4, 공속: 2, 사거리: 5 },
    idle: { main: [14, 8, -0.25], off: [0, 0, 0], lean: 0 },
    attack: {
      total: 34, lunge: [12, 8],
      main: [[10, -12, 6, -0.08], [14, 40, 10, 0.05], [20, 40, 10, 0.05]],
      lean: [[10, -0.15], [14, 0.35], [20, 0.35]],
      hits: [{ from: 12, to: 17, arm: 'main', dmg: 19, kb: 10, up: 4 }],
    },
  },
  {
    id: 'caocao', name: '조조', hanja: '曹操', weapon: 'sevenstar', weaponName: '칠성보도 (七星寶刀)',
    desc: '짧은 쿨타임과 넓은 베기 궤적 · 빈틈이 적은 운영형',
    hp: 1.0, speed: 1.0, jump: 1.0, body: '#6a2c8f', accent: '#b22222',
    stats: { 체력: 3, 속도: 3, 공격력: 3, 공속: 4, 사거리: 3 },
    idle: { main: [18, 12, -1.0], off: [-10, 26, 0], lean: 0 },
    attack: {
      total: 20, lunge: [6, 3],
      main: [[4, -8, -30, -2.6], [8, 36, -4, -0.2], [11, 30, 20, 1.2]],
      lean: [[4, -0.1], [8, 0.2], [11, 0.25]],
      hits: [{ from: 5, to: 11, arm: 'main', dmg: 10, kb: 7, up: 3 }],
    },
  },
  {
    id: 'zhaoyun', name: '조자룡', hanja: '趙子龍', weapon: 'spear', weaponName: '애각창 (涯角槍)',
    desc: '최고의 기동력과 점프력 · 딜레이 없는 연속 찌르기',
    hp: 0.8, speed: 1.3, jump: 1.22, body: '#f7f5ef', accent: '#2f6fd6',
    stats: { 체력: 1, 속도: 5, 공격력: 1, 공속: 5, 사거리: 4 },
    idle: { main: [14, 6, -0.2], off: [0, 0, 0], lean: 0 },
    attack: {
      total: 14, lunge: [4, 2.5], alt: 9,
      main: [[3, 2, 8, -0.08], [6, 40, 6, 0.02], [9, 38, 6, 0.02]],
      lean: [[3, -0.05], [6, 0.3], [9, 0.3]],
      hits: [{ from: 4, to: 8, arm: 'main', dmg: 6, kb: 4, up: 2 }],
    },
  },
];

const CHAR = {};
for (const ch of CHARACTERS) {
  const a = ch.attack, i = ch.idle;
  ch.mainK = [[0, ...i.main], ...a.main, [a.total, ...i.main]];
  ch.offK = a.off ? [[0, ...i.off], ...a.off, [a.total, ...i.off]] : null;
  ch.leanK = [[0, i.lean], ...a.lean, [a.total, i.lean]];
  ch.lastHitEnd = Math.max(...a.hits.map(h => h.to));
  CHAR[ch.id] = ch;
}

const AI_RANGE = { liubei: 62, guanyu: 125, zhangfei: 150, caocao: 88, zhaoyun: 128 };

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
  const ch = CHAR[p.c], A = ch.attack, wd = WEAPONS[ch.weapon];
  let m, o, lean;
  if (p.af >= 0) {
    m = sampleKeys(ch.mainK, p.af);
    o = ch.offK ? sampleKeys(ch.offK, p.af) : ch.idle.off.slice();
    lean = sampleKeys(ch.leanK, p.af)[0];
    if (A.alt) m[1] += (p.an % 2 ? -1 : 1) * A.alt * Math.sin(Math.PI * p.af / A.total);
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
  }

  const hip = { x: 0, y: -SK.hip + crouch + bob };
  const sh = { x: hip.x + Math.sin(lean) * SK.torso, y: hip.y - Math.cos(lean) * SK.torso };
  const hd = { x: sh.x + Math.sin(lean * 1.1) * (SK.neck + SK.headR), y: sh.y - Math.cos(lean * 1.1) * (SK.neck + SK.headR) };

  const mainArm = ik(sh.x, sh.y, sh.x + m[0], sh.y + m[1], SK.upper, SK.fore, 1);
  const w = m[2];
  let offArm, ow;
  if (wd.grip2 !== null && p.st !== ST.HIT && p.st !== ST.KO) {
    ow = w;
    offArm = ik(sh.x, sh.y, mainArm.hx + Math.cos(w) * wd.grip2, mainArm.hy + Math.sin(w) * wd.grip2, SK.upper, SK.fore, 1);
  } else {
    ow = o[2];
    offArm = ik(sh.x, sh.y, sh.x + o[0], sh.y + o[1], SK.upper, SK.fore, 1);
  }

  let ff, fb;
  if (!p.g) {
    const tuck = clamp(-p.vy * 0.6, -6, 10);
    ff = [12, hip.y + 40 - tuck]; fb = [-10, hip.y + 48 - tuck * 0.5];
  } else if (p.st === ST.WALK) {
    const s = Math.sin(p.wp), c = Math.cos(p.wp);
    ff = [3 + s * 15, -Math.max(0, c) * 9]; fb = [-3 - s * 15, -Math.max(0, -c) * 9];
  } else if (p.st === ST.DASH) {
    ff = [16, 0]; fb = [-28, -6];
  } else if (p.st === ST.ATK) {
    ff = [16 + lean * 30, 0]; fb = [-14 - lean * 12, 0];
  } else if (p.st === ST.HIT) {
    ff = [10, 0]; fb = [-18, 0];
  } else {
    ff = [14, 0]; fb = [-12, 0];
  }
  const legF = ik(hip.x, hip.y, ff[0], ff[1], SK.thigh, SK.shin, -1);
  const legB = ik(hip.x, hip.y, fb[0], fb[1], SK.thigh, SK.shin, -1);

  return {
    hip, sh, hd, lean,
    me: { x: mainArm.ex, y: mainArm.ey }, mh: { x: mainArm.hx, y: mainArm.hy }, w,
    oe: { x: offArm.ex, y: offArm.ey }, oh: { x: offArm.hx, y: offArm.hy }, ow,
    kf: { x: legF.ex, y: legF.ey }, ff: { x: legF.hx, y: legF.hy },
    kb: { x: legB.ex, y: legB.ey }, fb: { x: legB.hx, y: legB.hy },
  };
}

/* 무기 날(blade) 구간을 월드 좌표 캡슐로 변환. 핸디캡 배율은 끝(사거리)만 늘려 근접 사각지대가 생기지 않게 한다 */
function bladeSeg(p, pose, arm, ox = p.x, oy = p.y) {
  const wd = WEAPONS[CHAR[p.c].weapon];
  const hand = arm === 'off' ? pose.oh : pose.mh;
  const w = arm === 'off' ? pose.ow : pose.w;
  const s = p.ws, c = Math.cos(w), sn = Math.sin(w);
  const px = -sn * wd.off * s, py = c * wd.off * s;
  const ax = hand.x + c * wd.from + px, ay = hand.y + sn * wd.from + py;
  const bx = hand.x + c * wd.to * s + px, by = hand.y + sn * wd.to * s + py;
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
    if ((x - cx) ** 2 + (y - cy) ** 2 <= seg.r * seg.r) return { x: (x + cx) / 2, y: (y + cy) / 2 };
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
    st: ST.IDLE, af: -1, an: 0, hm: 0, df: 0, dd: 1, dcd: 0, inv: 0, fl: 0, hit: 0, kt: 0,
    wins: 0, ad: false, ljc: 0, lac: 0, ldc: 0, bj: 0, ba: 0, bd: 0, prevSeg: null,
    rx: 0, ry: GROUND, wp: 0, hpLag: maxHp, trail: [], ghosts: [],
  };
  resetPlayer(p);
  return p;
}

function resetPlayer(p) {
  p.x = p.rx = p.idx === 0 ? W * 0.3 : W * 0.7;
  p.y = p.ry = GROUND;
  p.f = p.idx === 0 ? 1 : -1;
  p.vx = p.vy = 0; p.g = true; p.hp = p.maxHp; p.hpLag = p.maxHp;
  p.st = ST.IDLE; p.af = -1; p.hm = 0; p.df = 0; p.dcd = 0; p.inv = 0; p.fl = 0; p.hit = 0; p.kt = 0;
  p.ad = false; p.bj = p.ba = p.bd = 0; p.prevSeg = null; p.trail.length = 0; p.ghosts.length = 0;
}

function newInput() {
  return { l: false, r: false, j: false, a: false, d: false, jc: 0, ac: 0, dc: 0 };
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
    ai: { t: 0, mode: 'approach' }, lastRecv: performance.now(),
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
  }
  for (const p of P) storePrevSeg(p);

  if (g.phase === PHASE.KO && g.pt >= KO_FRAMES) nextRound();
}

function nextRound() {
  game.round++;
  game.phase = PHASE.INTRO; game.pt = 0; game.winner = -1;
  for (const p of game.players) resetPlayer(p);
}

function updatePlayer(p, inp, opp, ctrl) {
  const ch = CHAR[p.c], A = ch.attack;

  if (inp.jc !== p.ljc) { p.ljc = inp.jc; if (ctrl) p.bj = 7; }
  if (inp.ac !== p.lac) { p.lac = inp.ac; if (ctrl) p.ba = 8; }
  if (inp.dc !== p.ldc) { p.ldc = inp.dc; if (ctrl) p.bd = 6; }
  if (!ctrl) p.bj = p.ba = p.bd = 0;
  if (p.dcd > 0) p.dcd--;
  if (p.inv > 0) p.inv--;
  if (p.fl > 0) p.fl--;

  if (p.st === ST.KO) {
    if (p.g) p.kt++;
  } else if (p.hit > 0) {
    p.hit--;
    p.st = ST.HIT;
    if (p.hit === 0) p.st = p.g ? ST.IDLE : ST.AIR;
  } else {
    if (p.af >= 0) {
      p.af++;
      if (A.lunge && p.af === A.lunge[0] && p.g) p.vx = p.f * A.lunge[1] * ch.speed;
      if (p.af >= A.total) p.af = -1;
    }
    if (p.df > 0) {
      p.df--;
      p.vx = p.dd * DASH_SPEED * (0.45 + 0.55 * (p.df / DASH_FRAMES));
      if (!p.g) p.vy = Math.min(p.vy, 0.5);
      if (p.df === 0) p.vx *= 0.5;
    }

    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    const canDash = p.bd > 0 && p.dcd <= 0 && p.df <= 0 && (p.af < 0 || p.af > ch.lastHitEnd) && (p.g || !p.ad);
    if (canDash) {
      p.af = -1; p.df = DASH_FRAMES; p.dd = dir || p.f; p.inv = DASH_INV; p.dcd = DASH_CD; p.bd = 0;
      if (!p.g) { p.ad = true; p.vy = 0; }
      emit({ k: 'dash', p: p.idx, x: r1(p.x), y: r1(p.y) });
    }
    const free = p.af < 0 && p.df <= 0;
    if (free && ctrl && (p.ba > 0 || inp.a)) {
      p.af = 0; p.an++; p.hm = 0; p.ba = 0; p.prevSeg = null;
      emit({ k: 'sw', p: p.idx, c: p.c });
    }
    if (p.bj > 0 && p.g && p.af < 0 && p.df <= 0) {
      p.bj = 0; p.vy = -JUMP_V * ch.jump; p.g = false;
    }
    if (p.df <= 0) {
      let target = (ctrl ? dir : 0) * MOVE_SPEED * ch.speed;
      if (p.af >= 0) target *= 0.2;
      p.vx += (target - p.vx) * (p.g ? (p.af >= 0 ? 0.15 : 0.35) : 0.12);
    }
    if (p.af < 0 && p.df <= 0) {
      const dx = opp.x - p.x;
      if (Math.abs(dx) > 6) p.f = dx > 0 ? 1 : -1;
    }
    p.st = p.df > 0 ? ST.DASH : p.af >= 0 ? ST.ATK : !p.g ? ST.AIR : Math.abs(p.vx) > 0.6 ? ST.WALK : ST.IDLE;
  }
  if (p.bj > 0) p.bj--;
  if (p.ba > 0) p.ba--;
  if (p.bd > 0) p.bd--;

  if (p.st === ST.HIT || p.st === ST.KO) p.vx *= p.g ? 0.85 : 0.99;
  if (!(p.df > 0 && !p.g)) p.vy += GRAVITY;
  p.x += p.vx; p.y += p.vy;
  if (p.y >= GROUND) {
    p.y = GROUND;
    if (p.vy > 0) p.vy = 0;
    if (!p.g) { p.g = true; p.ad = false; }
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
  p.prevSeg = { main: bladeSeg(p, pose, 'main'), off: bladeSeg(p, pose, 'off') };
}

function checkHits(att, def) {
  if (att.af < 0 || att.st !== ST.ATK || def.st === ST.KO || def.inv > 0) return;
  const hits = CHAR[att.c].attack.hits;
  let pose = null;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (att.af < h.from || att.af > h.to || (att.hm & (1 << i))) continue;
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
    if (contact) { applyHit(att, def, h, i, contact); if (def.st === ST.KO) return; }
  }
}

function applyHit(att, def, h, i, pt) {
  const g = game, dch = CHAR[def.c];
  att.hm |= 1 << i;
  const dir = att.x <= def.x ? 1 : -1;
  def.hp = Math.max(0, def.hp - h.dmg);
  def.fl = 10;
  const armored = dch.attack.armor && def.af >= dch.attack.armor[0] && def.af <= dch.attack.armor[1] && def.hp > 0;
  if (armored) {
    def.vx += dir * 1.2;
  } else {
    def.af = -1; def.df = 0;
    def.hit = Math.round(10 + h.dmg * 0.5);
    def.vx = dir * h.kb;
    def.vy = -(h.up || 3);
    def.g = false;
    def.st = ST.HIT;
  }
  if (def.x <= 34 || def.x >= W - 34) att.vx -= dir * h.kb * 0.7;
  g.hitstop = h.dmg >= 18 ? 8 : 4;
  emit({ k: 'hit', x: r1(pt.x), y: r1(pt.y), d: h.dmg, t: def.idx, hv: h.dmg >= 18 ? 1 : 0, a: armored ? 1 : 0 });

  if (def.hp <= 0) {
    def.st = ST.KO; def.af = -1; def.df = 0; def.hit = 0; def.kt = 0;
    def.vx = dir * 11; def.vy = -11; def.g = false;
    att.wins++;
    g.phase = PHASE.KO; g.pt = 0; g.hitstop = 18;
    g.winner = att.st === ST.KO ? -1 : att.idx;
    emit({ k: 'ko', t: def.idx });
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
  }
  let mv = 0;
  if (ai.mode === 'approach' && adx > range * 0.7) mv = dir;
  else if (ai.mode === 'retreat') mv = -dir;
  inp.l = mv < 0; inp.r = mv > 0;
  if (adx < range && me.af < 0 && Math.abs(opp.y - me.y) < 80 && Math.random() < 0.11) inp.ac++;
  if (opp.af >= 0 && opp.af < 10 && adx < 170 && me.dcd <= 0 && Math.random() < 0.05) {
    inp.l = dir > 0; inp.r = dir < 0; inp.dc++;
  }
  if (Math.random() < 0.006 || (opp.y < me.y - 60 && Math.random() < 0.03)) inp.jc++;
}

/* ----------------------------- 네트워크 (PeerJS) -----------------------------
 * Host-Authoritative: Host만 물리/충돌/체력을 계산하고 60Hz로 상태를 보낸다.
 * Client는 자신의 패드 입력만 보낸다. 입력의 "눌림"은 카운터로 보내므로 패킷 순서가 바뀌어도 누락되지 않는다.
 */
const net = { peer: null, conn: null, role: null, code: '', joinTimer: 0, hostTries: 0 };

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
  const peer = new Peer(PEER_PREFIX + code, { debug: 1 });
  net.peer = peer;
  peer.on('open', () => {
    if (net.peer !== peer) return;
    lobbyMsg('친구에게 방 코드를 알려주세요. 상대를 기다리는 중...');
    $('copyBtn').classList.remove('hidden');
  });
  peer.on('connection', conn => {
    if (net.peer !== peer) return;
    if (net.conn) {
      conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); });
      return;
    }
    net.conn = conn;
    conn.on('data', onHostData);
    conn.on('close', () => { if (net.conn === conn) onDisconnect('상대가 나갔어요.'); });
    conn.on('error', () => { if (net.conn === conn) onDisconnect('연결 오류가 발생했어요.'); });
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
        inp.l = !!d.l; inp.r = !!d.r; inp.j = !!d.j; inp.a = !!d.a; inp.d = !!d.d;
        inp.jc = d.jc | 0; inp.ac = d.ac | 0; inp.dc = d.dc | 0;
      }
      break;
    case 'bye':
      onDisconnect('상대가 나갔어요.');
      break;
  }
}

function joinRoom() {
  if (!peerAvailable()) return;
  const code = $('codeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { menuMsg('방 코드 4자리를 입력하세요.'); return; }
  net.role = 'client'; net.code = code;
  showLobby('방 참여', code, '방에 연결하는 중...', false);
  const peer = new Peer({ debug: 1 });
  net.peer = peer;
  const fail = msg => {
    if (net.peer !== peer || game) return;
    netClose();
    showScreen('menu');
    menuMsg(msg);
  };
  peer.on('open', () => {
    if (net.peer !== peer) return;
    const conn = peer.connect(PEER_PREFIX + code, { reliable: false, serialization: 'json' });
    net.conn = conn;
    conn.on('open', () => {
      lobbyMsg('연결됨! 캐릭터 정보를 교환하는 중...');
      conn.send({ t: 'hello', c: selectedChar, v: 1 });
    });
    conn.on('data', onClientData);
    conn.on('close', () => { if (net.conn === conn) { if (game) onDisconnect('방장과 연결이 끊어졌어요.'); else fail('연결이 끊어졌어요.'); } });
    conn.on('error', () => fail('연결 오류가 발생했어요.'));
  });
  peer.on('error', err => {
    if (err.type === 'peer-unavailable') fail('방을 찾을 수 없어요. 코드를 확인하세요.');
    else fail('연결 오류: ' + (err.type || err.message));
  });
  net.joinTimer = setTimeout(() => fail('연결 시간이 초과됐어요. 같은 Wi-Fi인지 확인해 보세요.'), 20000);
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
  return [r1(p.x), r1(p.y), r2(p.vx), r2(p.vy), p.f, r1(p.hp), p.st, p.af, p.an, p.df, p.inv > 0 ? 1 : 0, p.fl, p.wins, p.g ? 1 : 0, p.kt];
}

function unpackPlayer(p, a) {
  [p.x, p.y, p.vx, p.vy, p.f, p.hp, p.st, p.af, p.an, p.df, p.inv, p.fl, p.wins, p.g, p.kt] = a;
  p.g = !!p.g;
}

function broadcastState() {
  const g = game;
  netSend({ t: 's', f: g.frame, ph: g.phase, pt: g.pt, rd: g.round, w: g.winner, p: g.players.map(packPlayer), e: g.pending });
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
  if (newRound) for (const p of g.players) { p.rx = p.x; p.ry = p.y; p.hpLag = p.hp; p.trail.length = 0; }
}

function onDisconnect(msg) {
  if (!game && net.role === null) return;
  leaveGame();
  menuMsg(msg);
}

/* ----------------------------- 입력 (가상 패드 + 키보드) ----------------------------- */
const KEYS = ['l', 'r', 'j', 'a', 'd'];
const localInput = newInput();
const padHeld = { l: false, r: false, j: false, a: false, d: false };
const keyHeld = { l: false, r: false, j: false, a: false, d: false };
const mouseHeld = { l: false, r: false, j: false, a: false, d: false };
let padRects = [];

function pressCounter(k) {
  if (k === 'j') localInput.jc++;
  else if (k === 'a') localInput.ac++;
  else if (k === 'd') localInput.dc++;
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
  const now = { l: false, r: false, j: false, a: false, d: false };
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
};

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyH') { showHitbox = !showHitbox; $('hitboxOpt').checked = showHitbox; return; }
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
};

/* ----------------------------- 이펙트 ----------------------------- */
const fx = { parts: [], slashes: [], texts: [], shake: 0, flash: 0 };

function handleEvent(ev) {
  switch (ev.k) {
    case 'sw':
      Sound.swing(ev.c === 'guanyu' || ev.c === 'zhangfei');
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
      fx.slashes.push({ x: ev.x, y: ev.y, a: -0.6 + Math.random() * 1.2, len: ev.hv ? 90 : 55, life: 16, max: 16 });
      fx.texts.push({ x: ev.x, y: ev.y - 20, txt: (ev.a ? '' : '-') + ev.d, life: 50, max: 50, size: ev.hv ? 34 : 24 });
      fx.shake = Math.max(fx.shake, ev.hv ? 12 : 5);
      if (ev.hv) fx.flash = 0.35;
      if (game && ev.t === game.me && navigator.vibrate) { try { navigator.vibrate(ev.hv ? 60 : 25); } catch (e) { /* ignore */ } }
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
  fx.shake = Math.max(0, fx.shake - 0.9 * k);
  fx.flash = Math.max(0, fx.flash - 0.03 * k);
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

function drawWeapon(c, type, hx, hy, ang, s, now, ink) {
  c.save();
  c.translate(hx, hy); c.rotate(ang); c.scale(s, s);
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
  }
  c.restore();
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
  }

  // 눈
  if (ko) {
    c.strokeStyle = ink; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(hd.x + 3, hd.y - 3); c.lineTo(hd.x + 7, hd.y + 1); c.moveTo(hd.x + 7, hd.y - 3); c.lineTo(hd.x + 3, hd.y + 1); c.stroke();
  } else {
    c.fillStyle = ink; c.beginPath(); c.arc(hd.x + 5, hd.y - 0.5, 1.7, 0, Math.PI * 2); c.fill();
    if (ch.id === 'zhangfei' || ch.id === 'guanyu') strokeLine(c, hd.x + 1.5, hd.y - 5.5, hd.x + 8.5, hd.y - 3, ink, 1.8);
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
  strokeLine(c, pose.hip.x, pose.hip.y, pose.sh.x, pose.sh.y, ch.body, 6);
  if (ch.id === 'zhangfei') {
    const bx = pose.hip.x + (pose.sh.x - pose.hip.x) * 0.15, by = pose.hip.y + (pose.sh.y - pose.hip.y) * 0.15;
    strokeLine(c, bx - 6, by + 1, bx + 6, by - 1, ch.accent, 4.5);
    const fl = Math.sin(now * 0.012 + p.idx) * 2;
    c.strokeStyle = ch.accent; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(bx - 5, by); c.quadraticCurveTo(bx - 12, by + 5 + fl, bx - 15 - clamp(p.vx * p.f, -4, 8), by + 13 + fl); c.stroke();
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
  drawWeapon(c, ch.weapon, pose.mh.x, pose.mh.y, pose.w, p.ws, now, ink);
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
  for (let i = 0; i < 2; i++) {
    const p = P[i], ch = CHAR[p.c], left = i === 0;
    const bw = 340, bh = 16, by = 36;
    const bx = left ? 26 : W - 26 - bw;
    const ax = left ? bx : bx + bw;
    c.textAlign = left ? 'left' : 'right'; c.textBaseline = 'alphabetic';
    c.font = `900 19px ${SERIF}`; c.fillStyle = INK;
    const name = `${ch.hanja} ${ch.name}`;
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
    if (i === g.me) tag('나', RED);
    if (p.hc) tag('핸디캡', '#2f6fd6');

    const frac = clamp(p.hp / p.maxHp, 0, 1), lag = clamp(p.hpLag / p.maxHp, 0, 1);
    c.fillStyle = 'rgba(31,26,23,0.15)'; c.fillRect(bx, by, bw, bh);
    const bar = (f, col) => { c.fillStyle = col; c.fillRect(left ? bx : bx + bw * (1 - f), by, bw * f, bh); };
    bar(lag, '#f0d98a');
    bar(frac, frac > 0.3 ? RED : '#d3541c');
    c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(bx, by, bw, bh);
    c.font = '700 11px sans-serif'; c.fillStyle = PAPER_LIGHT; c.textAlign = left ? 'left' : 'right';
    c.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, left ? bx + 6 : bx + bw - 6, by + 12);

    for (let wv = 0; wv < Math.min(p.wins, 5); wv++) {
      const sx = left ? bx + wv * 22 : bx + bw - 18 - wv * 22;
      c.fillStyle = RED; c.fillRect(sx, by + bh + 5, 18, 18);
      c.fillStyle = PAPER_LIGHT; c.font = `900 13px ${SERIF}`; c.textAlign = 'center';
      c.fillText('勝', sx + 9, by + bh + 19);
    }
    if (p.wins > 5) {
      c.fillStyle = RED; c.font = '900 14px sans-serif'; c.textAlign = left ? 'left' : 'right';
      c.fillText(`×${p.wins}`, left ? bx + 5 * 22 + 2 : bx + bw - 5 * 22 - 2, by + bh + 19);
    }
  }
  c.textAlign = 'center'; c.fillStyle = INK;
  c.font = `900 22px ${SERIF}`;
  c.fillText(`第${hanNum(g.round)}合`, W / 2, 80);
  c.font = '700 12px sans-serif'; c.fillStyle = 'rgba(31,26,23,0.55)';
  if (g.code) c.fillText(`방 ${g.code}`, W / 2, 98);
  if (g.mode === 'practice') c.fillText('연습 모드 · vs CPU', W / 2, 98);
}

function drawPhaseBanner(c) {
  const g = game, P = g.players;
  if (g.phase === PHASE.INTRO) {
    if (g.round === 1 && g.pt < 55) {
      const a = CHAR[P[0].c], b = CHAR[P[1].c];
      drawBanner(c, `${a.hanja}  VS  ${b.hanja}`, `${a.name} 대 ${b.name}`, 54, PAPER_LIGHT, g.pt / 12);
    } else {
      const t = g.round === 1 ? g.pt - 55 : g.pt;
      drawBanner(c, `第${hanNum(g.round)}合`, `제 ${g.round} 합 · 준비`, 64, PAPER_LIGHT, t / 12);
    }
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

function drawTrail(c, p) {
  if (p.trail.length < 2) return;
  for (let i = 1; i < p.trail.length; i++) {
    const a = p.trail[i - 1], b = p.trail[i];
    const al = (i / p.trail.length) * 0.28;
    c.fillStyle = `rgba(31,26,23,${al})`;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.lineTo(b[2], b[3]); c.lineTo(b[0], b[1]); c.closePath(); c.fill();
  }
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
    if (p.st === ST.WALK) p.wp += p.vx * p.f * 0.09 * k;
    p.hpLag += (p.hp - p.hpLag) * Math.min(1, 0.06 * k);
    if (p.hpLag < p.hp) p.hpLag = p.hp;
    if (p.st === ST.DASH && renderFrame % 2 === 0) { p.ghosts.push([p.rx, p.ry]); if (p.ghosts.length > 5) p.ghosts.shift(); }
    else if (p.st !== ST.DASH && p.ghosts.length && renderFrame % 2 === 0) p.ghosts.shift();
  }

  const shx = (Math.random() - 0.5) * fx.shake, shy = (Math.random() - 0.5) * fx.shake;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + shx * scale), dpr * (oy + shy * scale));

  // 그림자
  for (const p of g.players) {
    const hgt = GROUND - p.ry, s = clamp(1 - hgt / 320, 0.3, 1);
    ctx.fillStyle = `rgba(31,26,23,${0.2 * s})`;
    ctx.beginPath(); ctx.ellipse(p.rx, GROUND + 3, 28 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 대시 잔상
  for (const p of g.players) p.ghosts.forEach((gh, i) => drawFighter(ctx, p, now, gh[0], gh[1], 0.1 + i * 0.05));

  // 무기 궤적 + 캐릭터 (내 캐릭터를 앞에)
  const order = g.me === 0 ? [1, 0] : [0, 1];
  for (const idx of order) {
    const p = g.players[idx];
    drawTrail(ctx, p);
    const pose = drawFighter(ctx, p, now, p.rx, p.ry, 1);
    if (p.af >= 0) {
      const arms = CHAR[p.c].weapon === 'twin' ? ['main', 'off'] : ['main'];
      for (const arm of arms) {
        const sgm = bladeSeg(p, pose, arm, p.rx, p.ry);
        const mx = (sgm.ax + sgm.bx) / 2, my = (sgm.ay + sgm.by) / 2;
        if (arm === 'main') { p.trail.push([mx, my, sgm.bx, sgm.by]); if (p.trail.length > 7) p.trail.shift(); }
      }
    } else if (p.trail.length) p.trail.shift();

    if (showHitbox) {
      const hb = hurtbox(p, p.rx, p.ry);
      ctx.strokeStyle = 'rgba(30,110,220,0.8)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0);
      const hits = CHAR[p.c].attack.hits;
      const arms = CHAR[p.c].weapon === 'twin' ? ['main', 'off'] : ['main'];
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
  for (const p of fx.parts) {
    ctx.fillStyle = p.col + (p.life / p.max).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.min(1, t.life / 15);
    ctx.font = `900 ${t.size}px ${SERIF}`;
    ctx.lineWidth = 4; ctx.strokeStyle = PAPER_LIGHT; ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = RED; ctx.fillText(t.txt, t.x, t.y);
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  drawHUD(ctx);
  drawPhaseBanner(ctx);

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
  if (g.mode === 'host' || g.mode === 'practice') {
    Object.assign(g.inputs[0], localInput);
    simStep();
    if (g.mode === 'host') broadcastState();
    else g.pending.length = 0;
    if (g.mode === 'host' && performance.now() - g.lastRecv > NET_TIMEOUT) onDisconnect('상대의 응답이 없어 연결을 종료했어요.');
  } else {
    netSend({ t: 'i', l: localInput.l, r: localInput.r, j: localInput.j, a: localInput.a, d: localInput.d, jc: localInput.jc, ac: localInput.ac, dc: localInput.dc });
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
  const inGame = name === 'game';
  $('pad').classList.toggle('hidden', !inGame);
  $('exitBtn').classList.toggle('hidden', !inGame);
  if (inGame) requestAnimationFrame(cachePadRects);
  if (name === 'menu') requestAnimationFrame(sizePreviews);
}

function menuMsg(t) { $('menuMsg').textContent = t || ''; }
function lobbyMsg(t) { $('lobbyMsg').textContent = t; }

function showLobby(title, code, msg, copy) {
  $('lobbyTitle').textContent = title;
  $('roomCode').textContent = code;
  lobbyMsg(msg);
  $('copyBtn').classList.toggle('hidden', !copy);
  showScreen('lobby');
}

let wakeLock = null;
async function enterGame() {
  fx.parts.length = fx.slashes.length = fx.texts.length = 0;
  acc = 0;
  showScreen('game');
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 지원 안 함 */ }
}

function leaveGame() {
  netClose();
  game = null;
  for (const k of KEYS) { padHeld[k] = keyHeld[k] = mouseHeld[k] = false; }
  refreshInput();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  showScreen('menu');
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
  $('copyBtn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${net.code}`;
    try { await navigator.clipboard.writeText(url); lobbyMsg('초대 링크를 복사했어요! 상대를 기다리는 중...'); }
    catch (e) { lobbyMsg(url); }
  });
  $('exitBtn').addEventListener('click', () => leaveGame());
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
    pv.t = 0; pv.p.af = -1;
  }
  $('infoName').textContent = `${ch.hanja} ${ch.name}`;
  $('infoWeapon').textContent = `무기: ${ch.weaponName}`;
  $('infoDesc').textContent = ch.desc;
  const stats = $('infoStats');
  stats.innerHTML = '';
  for (const [label, v] of Object.entries(ch.stats)) {
    const l = document.createElement('span'); l.textContent = label;
    const pips = document.createElement('span'); pips.className = 'pips';
    for (let i = 0; i < 5; i++) { const d = document.createElement('i'); d.className = 'pip' + (i < v ? ' on' : ''); pips.appendChild(d); }
    stats.append(l, pips);
  }
}

function sizePreviews() {
  for (const pv of previews) {
    const r = pv.cv.getBoundingClientRect();
    if (!r.width) continue;
    pv.cv.width = Math.round(r.width * view.dpr);
    pv.cv.height = Math.round(r.height * view.dpr);
  }
}

function renderPreviews(now, k) {
  for (const pv of previews) {
    const c = pv.cv.getContext('2d'), p = pv.p;
    const cw = pv.cv.width, chh = pv.cv.height;
    if (!cw || !chh) continue;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cw, chh);
    const selected = p.c === selectedChar;
    if (selected) {
      pv.t += k;
      const A = CHAR[p.c].attack;
      const cycle = A.total + 40;
      const f = Math.floor(pv.t) % cycle;
      p.af = f < A.total ? f : -1;
      p.an = Math.floor(pv.t / cycle);
      p.st = p.af >= 0 ? ST.ATK : ST.IDLE;
    } else { p.af = -1; p.st = ST.IDLE; }
    const s = Math.min(chh / 160, cw / 150);
    c.setTransform(s, 0, 0, s, cw * 0.3, chh - 10 * s);
    c.fillStyle = 'rgba(31,26,23,0.15)';
    c.beginPath(); c.ellipse(0, 2, 26, 4, 0, 0, Math.PI * 2); c.fill();
    drawFighter(c, p, now, 0, 0, 1);
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
