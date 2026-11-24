// 代码雨背景（登录页使用）
const CHARS = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890';
const FONT_FAMILY = '微软雅黑, Microsoft YaHei, sans-serif';
const FONT_WEIGHT = 500;
const INTERVAL = 36;
const MIN_FONT_SIZE = 14;
const SMALL_SCREEN_FONT_SIZE = 16;
// 每个字符从亮色到灰色、再到透明消失所需的帧数（每列在此基础上略有差异）
const LIFE = 26;
const LIFE_JITTER = 4;

// 颜色取自项目主色（青 / 蓝 / 绿 / 黄），同色重复出现用于加权
const THEMES = {
  dark: {
    // 顶部偏深、底部带一点青调的近黑，避免死黑
    top: '8, 11, 15',
    bottom: '13, 21, 26',
    // 字符淡出到一半时变成的灰色
    grey: [148, 163, 184],
    alphaMin: 0.3,
    alphaMax: 0.55,
    colors: [
      '#22d3ee',
      '#22d3ee',
      '#22d3ee',
      '#38bdf8',
      '#93c5fd',
      '#4ade80',
      '#4ade80',
      '#fde047',
    ],
  },
  light: {
    // 带一点冷调的浅底，纯白会更刺眼
    top: '248, 251, 251',
    bottom: '236, 243, 245',
    grey: [71, 85, 105],
    alphaMin: 0.6,
    alphaMax: 0.95,
    colors: [
      '#0e7490',
      '#0e7490',
      '#0e7490',
      '#0891b2',
      '#1d4ed8',
      '#15803d',
      '#15803d',
      '#b45309',
    ],
  },
};

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomChar() {
  return CHARS.charAt(Math.floor(Math.random() * CHARS.length));
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export default function codeRain(canvas) {
  const noop = { setTheme() {}, start() {}, stop() {}, resize() {}, destroy() {} };
  if (!canvas) return noop;

  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  // 每一列独立维护位置、生命周期和拖尾，列与列之间相位错开，密度才均匀
  const drops = [];
  const lives = [];
  const trails = [];
  const styles = [];

  let dark = false;
  let fontSize = MIN_FONT_SIZE;
  let columns = 0;
  let width = 0;
  let height = 0;
  let rows = 0;
  let dpr = 1;
  let drawTimer = null;
  let resizeTimer = null;

  function theme() {
    return dark ? THEMES.dark : THEMES.light;
  }

  // 画布本身保持透明，底色放到 CSS 背景上
  function applyTheme() {
    const t = theme();
    canvas.style.backgroundImage = `linear-gradient(to bottom, rgb(${t.top}), rgb(${t.bottom}))`;
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 为每一列预生成"亮色 → 灰色 → 透明"的颜色字符串
  function recolor() {
    const t = theme();
    for (let i = 0; i < columns; i++) {
      const base = hexToRgb(randomOf(t.colors));
      const baseAlpha = randomBetween(t.alphaMin, t.alphaMax);
      const life = lives[i];
      const list = [];

      for (let k = 0; k < life; k++) {
        const p = k / life;
        // 前面保持亮色，中段过渡到灰色，末段灰色逐渐透明
        const mix = Math.min(1, Math.max(0, (p - 0.25) / 0.5));
        const r = Math.round(base[0] + (t.grey[0] - base[0]) * mix);
        const g = Math.round(base[1] + (t.grey[1] - base[1]) * mix);
        const b = Math.round(base[2] + (t.grey[2] - base[2]) * mix);
        list.push(`rgba(${r}, ${g}, ${b}, ${(baseAlpha * (1 - p)).toFixed(3)})`);
      }

      styles[i] = list;
    }
  }

  // 初始画面：允许列处在周期中任意位置（并补齐拖尾），一打开就是完整雨幕
  // 运行中：每次落完都从屏幕上方重新进入，绝不跳到中间或底部
  function resetColumn(i, initial) {
    const trail = trails[i];
    trail.length = 0;

    if (initial) {
      const pause = rows;
      const cycle = pause + rows + lives[i];
      const head = Math.floor(Math.random() * cycle) - pause;
      drops[i] = head;

      const visible = Math.min(lives[i], Math.max(0, head + 1));
      for (let k = 0; k < visible; k++) {
        trail.push(randomChar());
      }
      return;
    }

    // 从屏幕上方开始，空档长度随机，靠"开始时间"错开各列
    drops[i] = -Math.floor(rows * (0.2 + Math.random() * 1.4));
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));

    fontSize = width <= 800 ? SMALL_SCREEN_FONT_SIZE : MIN_FONT_SIZE;
    columns = Math.max(1, Math.floor(width / fontSize));
    rows = Math.ceil(height / fontSize);

    drops.length = lives.length = trails.length = styles.length = 0;
    for (let i = 0; i < columns; i++) {
      lives.push(LIFE + Math.floor(Math.random() * (LIFE_JITTER * 2 + 1)) - LIFE_JITTER);
      trails.push([]);
    }
    recolor();
    for (let i = 0; i < columns; i++) {
      resetColumn(i, true);
    }

    applyTheme();
    clear();
  }

  function draw() {
    // 每帧清空后重绘所有字符，画布上不会残留任何东西
    clear();
    ctx.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_FAMILY}`;

    for (let i = 0; i < columns; i++) {
      const trail = trails[i];
      const life = lives[i];
      const x = i * fontSize;

      // 头部生成新字符，尾部超出生命周期的字符自然被丢掉
      trail.unshift(randomChar());
      if (trail.length > life) trail.length = life;

      // 每个字符按自己的年龄取颜色：亮色 → 灰色 → 透明
      for (let k = 0; k < trail.length; k++) {
        const row = drops[i] - k;
        if (row < 0) break;
        const y = row * fontSize;
        if (y > height) continue;
        ctx.fillStyle = styles[i][k];
        ctx.fillText(trail[k], x, y);
      }

      drops[i]++;

      // 整条拖尾都落出屏幕后，重新随机一个空档和相位
      if (drops[i] > rows + life) {
        resetColumn(i);
      }
    }
  }

  function start() {
    if (drawTimer || document.visibilityState === 'hidden') return;
    drawTimer = setInterval(draw, INTERVAL);
  }

  function stop() {
    if (drawTimer) {
      clearInterval(drawTimer);
      drawTimer = null;
    }
  }

  function setTheme(isDark) {
    const next = !!isDark;
    if (next === dark) return;
    dark = next;
    recolor();
    applyTheme();
    clear();
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 300);
  }

  // 页面隐藏时暂停，返回时继续
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      stop();
    } else {
      start();
    }
  }

  function destroy() {
    stop();
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  start();

  return { setTheme, start, stop, resize, destroy };
}
