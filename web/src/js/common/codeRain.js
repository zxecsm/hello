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
let timer = null;
setInterval(() => {
  if (isIframe()) return;
  let sleep = localData.get('sleep');
  sleep = sleep === null ? _d.fieldLength.rainCodeSleep : sleep;
  sleep--;
  localData.set('sleep', sleep);
  if (sleep === 0) {
    canvas.style.display = 'block';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    timer = setInterval(drawString, 30);
  } else if (sleep > 0) {
    canvas.style.display = 'none';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
}, 1000);

export const initRainCodeSleep = throttle(() => {
  localData.set('sleep', _d.fieldLength.rainCodeSleep);
}, 2000);
document.addEventListener('mousemove', initRainCodeSleep);
document.addEventListener('touchstart', initRainCodeSleep);
document.addEventListener('keydown', initRainCodeSleep);
