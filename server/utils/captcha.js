import { CacheByExpire } from './cache.js';
import { svgToBase64Png } from './img.js';
import nanoid from './nanoid.js';

const cache = new CacheByExpire(30 * 1000, 30 * 1000);

const THEMES = {
  light: {
    bg: '#ebebeb',
    piece: '#dddddd',
    line: '#f5f5f5',
    stroke: '#d0d0d0',
  },
  dark: { bg: '#222222', piece: '#333333', line: '#2a2a2a', stroke: '#3a3a3a' },
};

// 随机整数
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

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

// 生成验证码
async function genCaptcha({ w = 400, h = 220, theme = 'light', minS = 40, maxS = 60 } = {}) {
  const s = randInt(minS, maxS);
  const x = randInt(s, w - s);
  const y = randInt(s, h - s);
  const t = THEMES[theme] || THEMES.light;
  const shape = randomShape();

  const holePath =
    shape.type === 'polygon'
      ? shapePath('polygon', x + s / 2, y + s / 2, s, shape.sides)
      : shapePath(shape.type, x + s / 2, y + s / 2, s);
  const piecePath =
    shape.type === 'polygon'
      ? shapePath('polygon', s / 2, s / 2, s, shape.sides)
      : shapePath(shape.type, s / 2, s / 2, s);

  const bgSVG = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>${genPattern(
      t,
    )}<mask id="m"><rect width="100%" height="100%" fill="white"/><path d="${holePath}" fill="black"/></mask></defs>
    <rect width="100%" height="100%" fill="url(#p)" mask="url(#m)"/>
    <path d="${holePath}" fill="none" stroke="${t.stroke}" stroke-width="1"/>
  </svg>`;

  const pieceSVG = `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
    <path d="${piecePath}" fill="${t.piece}"/>
  </svg>`;

  return {
    x,
    y,
    s,
    w,
    h,
    theme,
    bg: await svgToBase64Png(bgSVG),
    piece: await svgToBase64Png(pieceSVG),
  };
}

const captcha = {
  async get(flag, theme = 'light') {
    const cap = await genCaptcha({ theme });
    cap.id = nanoid();

    cache.set(cap.id, { status: 'pending', flag, data: { ...cap } });
    delete cap.x;
    return cap;
  },
  verify(id, track) {
    const value = cache.get(id);
    if (!value) return false;

    if (value.status === 'passed') {
      cache.delete(id);
      return false;
    }

    if (verifyTrack(track, value.data.x)) {
      value.status = 'passed';
      return true;
    }

    cache.delete(id);
    return false;
  },
  consume(id, flag) {
    const value = cache.get(id);
    if (!value) return false;
    const { status, flag: f } = value;

    cache.delete(id);
    return status === 'passed' && f === flag;
  },
  getValue(id) {
    return cache.get(id);
  },
};

function verifyTrack(track, targetX) {
  if (!track || track.length < 5) return false;

  const first = track[0],
    last = track[track.length - 1];
  const totalTime = last.t - first.t;

  // 1. 终点误差
  if (Math.abs(last.x - targetX) > 5) return false;

  // 2. 实际轨迹长度、速度、Y 轴偏移
  let totalDistance = 0;
  let velocities = [];
  let hasYMovement = false;

  for (let i = 1; i < track.length; i++) {
    const dx = track[i].x - track[i - 1].x;
    const dy = track[i].y - track[i - 1].y;
    const dt = track[i].t - track[i - 1].t || 1;

    if (dy !== 0) hasYMovement = true;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
    velocities.push(Math.abs(dx / dt));
  }

  // 3. 平均速度
  const avgV = totalDistance / totalTime;
  if (avgV < 0.05 || avgV > 5) return false;

  // 4. Y 轴微小偏移
  if (!hasYMovement) return false;

  // 5. 速度方差
  const meanV = velocities.reduce((s, v) => s + v, 0) / velocities.length;
  const variance = velocities.reduce((s, v) => s + Math.pow(v - meanV, 2), 0) / velocities.length;
  if (variance < 0.001) return false;

  return true;
}

export default captcha;
