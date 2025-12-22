import { CacheByExpire } from './cache.js';
import { svgToBase64Png } from './img.js';
import nanoid from './nanoid.js';

const cache = new CacheByExpire(30 * 1000);

const THEMES = {
  light: {
    bg: '#ebebeb',
    piece: '#dddddd',
    line: '#f5f5f5',
    stroke: '#d0d0d0',
  },
  dark: { bg: '#222222', piece: '#333333', line: '#2a2a2a', stroke: '#3a3a3a' },
};

const puzzle = (x, y, s, r) => `
  M${x} ${y} h${s} v${s} h-${s} Z
  M${x + s} ${y + s / 2} a${r} ${r} 0 1 1 0 0
`;

function genPattern({ bg, line }) {
  const size = 16 + ((Math.random() * 8) | 0);
  const rot = [45, -45, 30, -30][(Math.random() * 4) | 0];
  const t = (Math.random() * 3) | 0;

  const body = [
    `<line x1="0" y1="0" x2="0" y2="${size}" stroke="${line}" stroke-width="1"/>`,
    `<line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${line}" stroke-width="1"/>
     <line x1="0" y1="${size}" x2="${size}" y2="0" stroke="${line}" stroke-width="1"/>`,
    `<path d="M0 ${size / 2} L${size / 2} 0 M${size / 2} ${size} L${size} ${
      size / 2
    }"
       stroke="${line}" stroke-width="1" fill="none"/>`,
  ][t];

  return `
  <pattern id="p" width="${size}" height="${size}"
    patternUnits="userSpaceOnUse"
    patternTransform="rotate(${rot})">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    ${body}
  </pattern>`;
}

async function genCaptcha({ w = 400, h = 220, s = 50, theme = 'light' } = {}) {
  const x = (Math.random() * (w - 2 * s - 20) + s + 10) | 0;
  const y = (Math.random() * (h - s - 20) + 10) | 0;
  const r = s / 4;
  const t = THEMES[theme] || THEMES.light;
  const angle = (Math.random() * 2 - 1).toFixed(2);

  const bgSVG = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${genPattern(t)}
      <mask id="m">
        <rect width="100%" height="100%" fill="white"/>
        <path d="${puzzle(x, y, s, r)}" fill="black"/>
      </mask>
    </defs>
    <rect width="100%" height="100%" fill="url(#p)" mask="url(#m)"/>
    <path d="${puzzle(x, y, s, r)}" fill="none" stroke="${
    t.stroke
  }" stroke-width="1"/>
  </svg>`;

  const pieceSVG = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${angle} ${s / 2} ${s / 2})">
      <rect x="-${x}" y="-${y}" width="${w}" height="${h}" fill="${t.piece}"/>
      <path d="${puzzle(0, 0, s, r)}" fill="${t.piece}"/>
    </g>
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
  const variance =
    velocities.reduce((s, v) => s + Math.pow(v - meanV, 2), 0) /
    velocities.length;
  if (variance < 0.001) return false;

  return true;
}

export default captcha;
