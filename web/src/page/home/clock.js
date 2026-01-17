import {
  _getTarget,
  formatDate,
  getScreenSize,
  isMobile,
  myDrag,
  percentToValue,
} from '../../js/utils/utils';
import { setZidx } from './popWindow';
import { hideIframeMask, showIframeMask } from './iframe';
import localData from '../../js/common/localData';
import rMenu from '../../js/plugins/rightMenu';
const clock = document.querySelector('.clock');
const domHour = clock.querySelector('.hour');
const domMin = clock.querySelector('.min');
const domSec = clock.querySelector('.sec');
const sections = clock.querySelectorAll('.time_section');

// 滚动字符
class ScrollText {
  constructor(target) {
    this.target = target;
    this.curContent = '';
    this.nextContent = '';
    this.init();
  }

  init() {
    this.cur = this.createScrollElement();
    this.next = this.createScrollElement();
    this.next.style.transform = 'translateY(100%)';
    this.target.appendChild(this.cur);
    this.target.appendChild(this.next);
  }

  createScrollElement() {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;
    return element;
  }

  run(curContent, nextContent) {
    if (this.curContent === curContent && this.nextContent === nextContent) return;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.curContent = this.cur.textContent = curContent;
    this.nextContent = this.next.textContent = nextContent;

    this.cur.style.transition = this.next.style.transition = 'transform 0.5s ease-in-out';
    this.cur.style.transform = 'translateY(-100%)';
    this.next.style.transform = 'translateY(0)';

    this.timer = setTimeout(() => {
      this.cur.textContent = nextContent;
      this.next.textContent = curContent;
      this.cur.style.transition = this.next.style.transition = '0s';
      this.cur.style.transform = 'translateY(0)';
      this.next.style.transform = 'translateY(100%)';
    }, 500);
  }
}

let scrollTexts = [];
sections.forEach((item) => {
  scrollTexts.push(new ScrollText(item));
});

function updateTime() {
  const date = formatDate({
    timestamp: Date.now() + 500,
    template: '{3}{4}{5}',
  });

  scrollTexts.forEach((item, idx) => {
    const nextContent = +date[idx];
    const curContent = nextContent - 1;
    item.run(curContent < 0 ? 9 : curContent, nextContent);
  });
}

let animateList = [];
// 开始运作
function clockRun(sec, min, hour) {
  // 清除重新创建
  animateList.forEach((animation) => animation.cancel());
  animateList = [];
  [
    {
      target: domHour,
      keyframes: [
        {
          transform: `rotate(${hour}deg)`,
        },
        {
          transform: `rotate(${hour + 360}deg)`,
        },
      ],
      options: { duration: 216000 * 1000, iterations: Infinity },
    },
    {
      target: domMin,
      keyframes: [{ transform: `rotate(${min}deg)` }, { transform: `rotate(${min + 360}deg)` }],
      options: { duration: 3600 * 1000, iterations: Infinity },
    },
    {
      target: domSec,
      keyframes: [{ transform: `rotate(${sec}deg)` }, { transform: `rotate(${sec + 360}deg)` }],
      options: { duration: 60 * 1000, iterations: Infinity },
    },
  ].forEach(({ keyframes, options, target }) => {
    animateList.push(target.animate(keyframes, options));
  });
}
// 刻度
function drawLines(className, total, translateX) {
  const gap = 360 / total;
  let strHtml = '';
  for (let i = 0; i < total; i++) {
    if (className === '.line-min' && i % 5 === 0) continue;
    strHtml += `<li style="transform:rotate(${i * gap}deg) translate(${translateX}px,-50%);"></li>`;
  }
  const wrap = document.querySelector(className);
  wrap.innerHTML = strHtml;
}
// 数字
function drawNumbers(className) {
  const wrap = document.querySelector(className),
    radius = wrap.clientWidth / 2;

  let strHtml = '';
  for (let i = 1; i <= 12; i++) {
    if (![12, 3, 6, 9].includes(i)) continue;
    const myAngle = ((i - 3) / 6) * Math.PI,
      myX = radius + radius * Math.cos(myAngle),
      myY = radius + radius * Math.sin(myAngle);
    strHtml += `<li style="left:${myX}px; top:${myY}px">${i}</li>`;
  }
  wrap.innerHTML = strHtml;
}
// 指针旋转
function clockMove() {
  const now = new Date(),
    hour = now.getHours(),
    min = now.getMinutes(),
    sec = now.getSeconds(),
    secAngle = sec * 6 - 90,
    minAngle = min * 6 + sec * 0.1 - 90,
    hourAngle = hour * 30 + min * 0.5 - 90;
  clockRun(secAngle, minAngle, hourAngle);
}
function clockinit() {
  drawLines('.line-min', 60, 90);
  drawLines('.line-hour', 12, 85);
  drawNumbers('.number');
}
clockinit();
clockMove();
setInterval(updateTime, 1000);
updateTime(); // 初始化时间
const clockData = localData.get('clockData');
function hdClick(e) {
  clockMove();
  if (e.target.tagName.toLowerCase() === 'i') {
    rMenu.percentBar(e, clockData.size, (percent) => {
      clock.style.transform = `scale(${percentToValue(0.5, 4, percent)})`;
      clockData.size = percent;
      localData.set('clockData', clockData, 200);
    });
  }
}
clock.addEventListener('click', hdClick);
document.addEventListener('visibilitychange', function () {
  // 页面变为可见时触发
  if (document.visibilityState === 'visible') {
    clockMove();
  }
});
clock.style.transform = `scale(${percentToValue(0.5, 4, clockData.size)})`;
//拖动
myDrag({
  trigger: clock,
  border: true,
  create({ target }) {
    const { left, top } = clockData.coord;
    const { w, h } = getScreenSize();
    // 超出屏幕恢复默认
    if (left > w || top > h) {
      clockData.coord = localData.defaultData.clockData.coord;
    }

    target.style.left = clockData.coord.left + 'px';
    target.style.top = clockData.coord.top + 'px';
  },
  down() {
    showIframeMask();
  },
  up({ x, y }) {
    hideIframeMask();
    clockData.coord = {
      left: x,
      top: y,
    };
    localData.set('clockData', clockData);
  },
});
function clockIndex(e) {
  if (_getTarget(this, e, '.clock')) {
    setZidx(clock);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  clockIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  clockIndex(e.changedTouches[0]);
});
