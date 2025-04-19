import _d from '../../common/config';
import './index.less';
import { myDrag, toCenter } from '../../utils/utils';

export function percentBar(e, percent, callback) {
  const box = document.createElement('div');
  box.className = 'percent_bar';
  box.style.zIndex = _d.levelObj.percentBar;
  const proBox = document.createElement('div');
  proBox.className = 'pro_box';
  // 显示百分比
  const percentBox = document.createElement('div');
  percentBox.className = 'percent_box';
  // 进度条盒子
  const pro1Box = document.createElement('div');
  pro1Box.className = 'pro1_box';
  // 进度条内遮罩
  const pro2Box = document.createElement('div');
  pro2Box.className = 'pro2_box';
  // 进度条滑块
  const dolt = document.createElement('div');
  dolt.className = 'dolt';
  // 放入body
  pro2Box.appendChild(dolt);
  pro1Box.appendChild(pro2Box);
  proBox.appendChild(percentBox);
  proBox.appendChild(pro1Box);
  box.appendChild(proBox);
  document.body.appendChild(box);
  rikey(e);
  proBox.clientHeight;
  proBox.style.opacity = 1;
  proBox.style.transform = 'none';
  let pro1BoxL; //进度条盒子距离窗口的距离
  const dragClose = myDrag({
    trigger: percentBox,
    target: proBox,
    border: true,
  });
  function rikey(e) {
    const ww = window.innerWidth;
    if (!e) {
      toCenter(proBox);
      return;
    }
    let h = window.innerHeight,
      mtw = proBox.offsetWidth,
      mth = proBox.offsetHeight,
      x = e.clientX,
      y = e.clientY;
    x < ww / 2 ? null : (x = x - mtw);
    y < h / 2 ? null : (y = y - mth);
    x < 0 ? (x = 0) : x + mtw > ww ? (x = ww - mtw) : null;
    y < 0 ? (y = 0) : y + mth > h ? (y = h - mth) : null;
    proBox.style.top = y + 'px';
    proBox.style.left = x + 'px';
    proBox.dataset.x = x;
    proBox.dataset.y = y;
  }
  calculationPosition(percent);
  // 计算进度位置
  function calculationPosition(per) {
    per <= 0 ? (per = 0) : per >= 1 ? (per = 1) : null;
    const val =
      (pro1Box.offsetWidth - dolt.offsetWidth) * per + dolt.offsetWidth / 2;
    pro2Box.style.width = val + 'px';
    percentBox.innerText = parseInt(per * 100) + '%';
  }
  function move(e) {
    percent =
      (e.clientX - pro1BoxL - dolt.offsetWidth / 2) /
      (pro1Box.offsetWidth - dolt.offsetWidth);
    percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
    calculationPosition(percent);
    callback && callback(percent, 'move');
  }
  // 桌面端
  pro1Box.onmousedown = function (e) {
    pro1BoxL = pro1Box.getBoundingClientRect().left;
    tmove(e);
    function tmove(e) {
      e.preventDefault();
      move(e);
    }
    function up() {
      callback && callback(percent, 'up');
      document.removeEventListener('mousemove', tmove);
      document.removeEventListener('mouseup', up);
    }
    document.addEventListener('mousemove', tmove);
    document.addEventListener('mouseup', up);
  };
  // 移动端
  pro1Box.ontouchstart = function (e) {
    pro1BoxL = pro1Box.getBoundingClientRect().left;
    tmove(e);
    function tmove(e) {
      e.preventDefault();
      const ev = e.changedTouches[0];
      move(ev);
    }
    function up() {
      callback && callback(percent, 'up');
      pro1Box.removeEventListener('touchmove', tmove);
      pro1Box.removeEventListener('touchend', up);
    }
    pro1Box.addEventListener('touchmove', tmove);
    pro1Box.addEventListener('touchend', up);
  };
  box.onwheel = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0) {
      percent -= 0.05;
    } else {
      percent += 0.05;
    }
    percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
    calculationPosition(percent);
    callback && callback(percent, 'wheel');
  };
  box.onclick = function (e) {
    if (e.target === box) {
      dragClose();
      pro1Box.onmousedown = null;
      pro1Box.ontouchstart = null;
      box.onwheel = null;
      box.onclick = null;
      box.remove();
    }
  };
}
export class CircularProgressBar {
  constructor(container, options = {}) {
    this.container = container;
    this.color = options.color || '#198754';
    this.bgColor = options.bgColor || '#888888';
    this.strokeWidth = options.strokeWidth || 10;
    this.max = options.max || 100;
    this.value = options.value || 0;

    this.createElements();
    this.setProgress(this.value);
  }

  createElements() {
    const wrapper = document.createElement('div');
    const circleRadius = 45;
    const circumference = 2 * Math.PI * circleRadius;

    Object.assign(wrapper.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
    });

    wrapper.innerHTML = `
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block; transform:rotate(-90deg);">
    <circle
      cx="50" cy="50" r="${circleRadius}"
      stroke="${this.bgColor}"
      stroke-width="${this.strokeWidth}"
      fill="none"
    />
    <circle
      class="progress-ring"
      cx="50" cy="50" r="${circleRadius}"
      stroke="${this.color}"
      stroke-width="${this.strokeWidth}"
      fill="none"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${circumference}"
    />
  </svg>
  <div class="progress-text">${this.value}%</div>
`;

    const textDiv = wrapper.querySelector('.progress-text');
    Object.assign(textDiv.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    });

    this.wrapper = wrapper;
    this.progressCircle = wrapper.querySelector('.progress-ring');
    this.progressCircle.style.transition =
      'stroke-dashoffset 0.6s ease, stroke 0.3s ease';
    this.setColor(this.color);
    this.progressText = textDiv;
    this.circumference = circumference;

    this.container.appendChild(wrapper);
  }
  setColor(color) {
    this.color = color;
    this.progressCircle.style.stroke = color;
    return this;
  }
  setProgress(value) {
    this.value = Math.min(Math.max(value, 0), this.max);
    const percent = this.value / this.max;
    const offset = this.circumference * (1 - percent);
    this.progressCircle.style.strokeDashoffset = offset;
    this.progressText.textContent = `${Math.round(percent * 100)}%`;
    return this;
  }
}
