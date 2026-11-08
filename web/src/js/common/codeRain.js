import { debounce, isIframe, throttle } from '../utils/utils';
import _d from './config';
import localData from './localData';
const canvas = document.createElement('canvas');
canvas.style.cssText = `
position: fixed;
top: 0;
left: 0;
z-index: 99999;
display: none;
background-color: #000000;
`;
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');

let fontSize = 14;
let clos;
const drops = [];
const str = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890';
const resizeCanvas = debounce(function () {
  if (isIframe()) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (canvas.width <= 800) {
    fontSize = 16;
  }
  clos = Math.floor(window.innerWidth / fontSize);
  drops.length = 0;
  for (let i = 0; i < clos; i++) {
    drops.push(0);
  }
}, 500);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
function drawString() {
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 ' + fontSize + 'px 微软雅黑';
  ctx.fillStyle = '#ff2d2d';

  for (let i = 0; i < clos; i++) {
    const x = i * fontSize;
    const y = drops[i] * fontSize;
    ctx.fillText(str[Math.floor(Math.random() * str.length)], x, y);
    if (y > canvas.height && Math.random() > 0.99) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}
const DEFAULT_SLEEP = _d.fieldLength.rainCodeSleep;

let sleep = localData.get('sleep');
sleep = sleep === null ? DEFAULT_SLEEP : Number(sleep);
if (!Number.isFinite(sleep)) sleep = DEFAULT_SLEEP;

let active = false; // 本页是否已经进入代码雨状态
let countdownTimer = null;
let drawTimer = null;

function persistSleep() {
  localData.set('sleep', sleep);
}

function stopDraw() {
  if (drawTimer) {
    clearInterval(drawTimer);
    drawTimer = null;
  }
  canvas.style.display = 'none';
}

function startDraw() {
  if (drawTimer || isIframe() || document.visibilityState === 'hidden') return;
  canvas.style.display = 'block';
  drawTimer = setInterval(drawString, 30);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown() {
  if (countdownTimer || sleep <= 0 || isIframe() || document.visibilityState === 'hidden') {
    return;
  }
  countdownTimer = setInterval(tick, 1000);
}

function tick() {
  if (sleep <= 0) {
    stopCountdown();
    return;
  }

  sleep--;

  if (sleep === 0) {
    active = true;
    sleep = -1; // 与旧逻辑保持一致，激活后持久化为 -1
    stopCountdown();
    persistSleep();
    startDraw();
  }
}

export const initRainCodeSleep = throttle(() => {
  sleep = DEFAULT_SLEEP;
  active = false;
  stopDraw();
  persistSleep();
  startCountdown();
}, 2000);

// 只在可见时倒计时/绘制，隐藏时持久化当前计数
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    stopCountdown();
    stopDraw();
    persistSleep();
  } else if (active) {
    startDraw();
  } else {
    startCountdown();
  }
});

if (document.visibilityState === 'visible') {
  startCountdown();
}

document.addEventListener('mousemove', initRainCodeSleep);
document.addEventListener('touchstart', initRainCodeSleep);
document.addEventListener('keydown', initRainCodeSleep);
