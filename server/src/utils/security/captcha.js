import { randomInt } from 'node:crypto';
import { CacheByExpire } from '../common/cache.js';
import { svgToBase64Png } from '../fs/img.js';
import nanoid from '../common/nanoid.js';

// 60 秒：比 verifyTrack 允许的 30 秒最大耗时多留一倍余量，避免边界时刻提前过期
// maxSize 兜底：单条约 20KB，限制条目数避免极端情况下内存无限增长
const cache = new CacheByExpire(60 * 1000, 60 * 1000, { maxSize: 3000 });

const THEMES = {
  light: {
    bg: '#ebebeb',
    piece: '#dddddd',
    line: '#f5f5f5',
    stroke: '#d0d0d0',
  },
  dark: { bg: '#222222', piece: '#333333', line: '#2a2a2a', stroke: '#3a3a3a' },
};

// 随机整数（使用 CSPRNG，避免 Math.random 可预测）
const randInt = (min, max) => randomInt(min, max + 1);

// 背景 pattern
function genPattern({ bg, line }) {
  const size = randInt(16, 23);
  const rot = [45, -45, 30, -30][randInt(0, 3)];
  const type = randInt(0, 2);
  const body = [
    `<line x1="0" y1="0" x2="0" y2="${size}" stroke="${line}" stroke-width="1"/>`,
    `<line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${line}" stroke-width="1"/>
     <line x1="0" y1="${size}" x2="${size}" y2="0" stroke="${line}" stroke-width="1"/>`,
    `<path d="M0 ${size / 2} L${size / 2} 0 M${size / 2} ${size} L${size} ${
      size / 2
    }" stroke="${line}" stroke-width="1" fill="none"/>`,
  ][type];

  return `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})">
    <rect width="${size}" height="${size}" fill="${bg}"/>${body}</pattern>`;
}

// 全图噪点/细线：让凹槽不再是纯色块，增加图像识别成本
function genNoise(w, h, t) {
  const items = [];
  const lineCount = randInt(12, 20);

  for (let i = 0; i < lineCount; i++) {
    const x1 = randInt(0, w);
    const y1 = randInt(0, h);
    const x2 = Math.min(w, Math.max(0, x1 + randInt(-80, 80)));
    const y2 = Math.min(h, Math.max(0, y1 + randInt(-80, 80)));

    items.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${t.stroke}" stroke-width="1" opacity="0.35"/>`,
    );
  }

  const dotCount = randInt(30, 50);

  for (let i = 0; i < dotCount; i++) {
    items.push(
      `<circle cx="${randInt(0, w)}" cy="${randInt(0, h)}" r="${randInt(1, 2)}" fill="${
        t.stroke
      }" opacity="0.28"/>`,
    );
  }

  return items.join('');
}

// 生成形状路径
function shapePath(type, cx, cy, s, sides = 5) {
  const r = s / 2;
  if (type === 'square') return `M${cx - r} ${cy - r} h${s} v${s} h-${s} Z`;
  if (type === 'circle')
    return `M${cx} ${cy} m-${r},0 a${r},${r} 0 1,0 ${s},0 a${r},${r} 0 1,0 -${s},0`;
  let d = '';
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += i === 0 ? `M${x} ${y}` : `L${x} ${y}`;
  }
  return d + ' Z';
}

// 随机形状
function randomShape() {
  const list = [
    { type: 'square' },
    { type: 'circle' },
    { type: 'polygon', sides: 3 },
    { type: 'polygon', sides: 5 },
    { type: 'polygon', sides: 6 },
  ];
  return list[randInt(0, list.length - 1)];
}

// 随机挑一个与真孔形状不同的形状
function pickDifferentShape(realShape) {
  const list = [
    { type: 'square' },
    { type: 'circle' },
    { type: 'polygon', sides: 3 },
    { type: 'polygon', sides: 5 },
    { type: 'polygon', sides: 6 },
  ];
  const key = (s) => (s.type === 'polygon' ? `polygon-${s.sides}` : s.type);
  const candidates = list.filter((item) => key(item) !== key(realShape));

  return candidates[randInt(0, candidates.length - 1)];
}

// 生成验证码
async function genCaptcha({ w = 400, h = 220, theme = 'light', minS = 40, maxS = 60 } = {}) {
  const t = THEMES[theme] || THEMES.light;
  const realShape = randomShape();
  const realS = randInt(minS, maxS);
  const realX = randInt(realS, w - realS);

  // 真孔 + 0~2 个混淆孔：同一垂直中心、不同形状/尺寸
  const holes = [{ x: realX, s: realS, shape: realShape }];
  const decoyCount = randInt(0, 2);

  for (let i = 0; i < decoyCount; i++) {
    const decoyShape = pickDifferentShape(realShape);

    let decoyS = realS + (randInt(0, 1) ? randInt(6, 12) : -randInt(6, 12));

    // 尺寸必须和真孔有明显差异，且不能超出合理范围
    if (decoyS < 34 || decoyS > 68) {
      decoyS = realS + randInt(6, 12);
    }

    decoyS = Math.max(34, Math.min(68, decoyS));

    let placed = false;

    // 和已有孔保持至少 24px 的边缘间距，放不下就少放一个
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const decoyX = randInt(4, w - decoyS - 4);
      const gapOk = holes.every((hole) => Math.abs(hole.x - decoyX) - (hole.s + decoyS) / 2 >= 24);

      if (gapOk) {
        holes.push({ x: decoyX, s: decoyS, shape: decoyShape });
        placed = true;
      }
    }
  }

  // 所有孔共用同一垂直中心，拼图块按真孔尺寸定位
  const maxHoleS = Math.max(...holes.map((hole) => hole.s));
  const cy = randInt(maxHoleS, h - maxHoleS);

  const holeD = holes
    .map((hole) =>
      hole.shape.type === 'polygon'
        ? shapePath('polygon', hole.x + hole.s / 2, cy, hole.s, hole.shape.sides)
        : shapePath(hole.shape.type, hole.x + hole.s / 2, cy, hole.s),
    )
    .join(' ');

  const pieceD =
    realShape.type === 'polygon'
      ? shapePath('polygon', realS / 2, realS / 2, realS, realShape.sides)
      : shapePath(realShape.type, realS / 2, realS / 2, realS);

  const y = cy - realS / 2;

  // 注意：先铺一层不透明底色，镂空区域会显示底色而不是透明，
  // 避免通过 PNG 的 alpha 通道反推凹槽位置。
  const bgSVG = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${t.bg}"/>
    <defs>${genPattern(
      t,
    )}<mask id="m"><rect width="100%" height="100%" fill="white"/><path d="${holeD}" fill="black"/></mask></defs>
    <rect width="100%" height="100%" fill="url(#p)" mask="url(#m)"/>
    <path d="${holeD}" fill="none" stroke="${t.stroke}" stroke-width="1"/>
    ${genNoise(w, h, t)}
  </svg>`;

  const pieceSVG = `<svg width="${realS}" height="${realS}" xmlns="http://www.w3.org/2000/svg">
    <path d="${pieceD}" fill="${t.piece}"/>
  </svg>`;

  return {
    x: realX,
    y,
    s: realS,
    w,
    h,
    theme,
    // 仅用于内部测试/排查，get 返回前会删除
    holes,
    // 背景图强制拍平，输出无 alpha 通道
    bg: await svgToBase64Png(bgSVG, t.bg),
    piece: await svgToBase64Png(pieceSVG),
  };
}

const captcha = {
  // 获取验证码：记录发起时间，用于后续耗时校验
  async get(flag, { theme = 'light' } = {}) {
    const cap = await genCaptcha({ theme });
    cap.id = nanoid();

    cache.set(cap.id, {
      status: 'pending',
      flag,
      createAt: Date.now(),
      data: { ...cap },
    });

    delete cap.x;
    delete cap.holes;
    return cap;
  },
  verify(id, track) {
    const value = cache.get(id);
    if (!value) return false;

    // 已使用过直接作废
    if (value.status === 'passed') {
      cache.delete(id);
      return false;
    }

    const elapsed = Date.now() - value.createAt;

    if (verifyTrack(track, value.data.x, elapsed)) {
      value.status = 'passed';
      return true;
    }

    cache.delete(id);
    return false;
  },
  consume(id, flag) {
    const value = cache.take(id);
    if (!value) return false;

    return value.status === 'passed' && value.flag === flag;
  },
  getValue(id) {
    return cache.get(id);
  },
};

// 轨迹点上限：15 秒拖动按 60ms 采样最多约 250 个点，300 足够；
const MAX_TRACK_POINTS = 300;

function verifyTrack(track, targetX, elapsed) {
  if (!Array.isArray(track) || track.length < 5) return false;
  if (track.length > MAX_TRACK_POINTS) return false;

  const first = track[0];
  const last = track[track.length - 1];

  if (
    ![first, last].every(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.t),
    )
  ) {
    return false;
  }

  // 服务端实际耗时：防止瞬间提交、复用或伪造轨迹时间
  if (!Number.isFinite(elapsed) || elapsed < 200 || elapsed > 30 * 1000) return false;

  const totalTime = last.t - first.t;

  // 拖动时长
  if (totalTime < 200 || totalTime > 15 * 1000) return false;
  // 客户端记录的拖动时长不能超过服务端实际耗时太多
  if (last.t > elapsed + 1000) return false;

  // 1. 终点误差
  if (Math.abs(last.x - targetX) > 5) return false;

  // 2. 实际轨迹长度、速度、Y 轴偏移
  let totalDistance = 0;
  const velocities = [];
  let hasYMovement = false;
  let prevX = first.x;
  let prevT = first.t;

  for (let i = 1; i < track.length; i++) {
    const p = track[i];
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y) || !Number.isFinite(p?.t)) return false;

    const dx = p.x - prevX;
    const dy = p.y - track[i - 1].y;
    const dt = p.t - prevT;

    // 时间必须单调递增
    if (dt < 0) return false;
    // 允许小幅回退修正，但不允许大幅回退 / 单步瞬移
    if (dx < -100 || dx > 200) return false;
    if (dy !== 0) hasYMovement = true;

    totalDistance += Math.sqrt(dx * dx + dy * dy);
    velocities.push(Math.abs(dx / (dt || 1)));

    prevX = p.x;
    prevT = p.t;
  }

  // 3. 平均速度（下限放宽，兼容慢速拖动）
  const avgV = totalDistance / (totalTime || 1);
  if (avgV < 0.005 || avgV > 5) return false;

  // 4. Y 轴微小偏移
  if (!hasYMovement) return false;

  // 5. 速度变异系数：匀速脚本轨迹 CV≈0
  const meanV = velocities.reduce((s, v) => s + v, 0) / velocities.length;
  const variance = velocities.reduce((s, v) => s + Math.pow(v - meanV, 2), 0) / velocities.length;
  const cv = meanV > 0 ? Math.sqrt(variance) / meanV : 0;
  if (cv < 0.12) return false;

  // 6. 采样时间不能完全等距（脚本常见特征）
  if (new Set(track.map((p) => p.t)).size < 3) return false;

  return true;
}

export default captcha;
