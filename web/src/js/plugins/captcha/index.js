import { reqUserCaptcha, reqUserGetCaptcha } from '../../../api/user';
import _d from '../../common/config';
import { delay, isDark } from '../../utils/utils';
import { MaskLoading } from '../loadingBar';
import _msg from '../message';
import './index.less';

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

class SlideCaptcha {
  constructor(flag, opt = {}) {
    this.flag = flag;
    this.opt = opt;

    this.init();
  }

  async init() {
    this.initDOM();
    this.maskLoading = new MaskLoading(this.box);
    this.bindEvents();
    this.update();
  }

  /* ================= DOM ================= */

  initDOM() {
    const mask = el('div', 'captcha-mask');
    mask.style.zIndex = _d.levelObj.captcha;
    const box = el('div', 'captcha-box');
    const content = el('div', 'captcha-content');

    /* 图片区 */
    const captchaBox = el('div', 'captcha-img-box');
    const bg = el('img', 'captcha-bg');
    const piece = el('img', 'captcha-piece');

    captchaBox.append(bg, piece);

    /* 滑块区 */
    const sliderWrap = el('div', 'captcha-slider-wrap');
    const sliderMask = el('div', 'captcha-slider-mask');
    const slider = el(
      'div',
      'captcha-slider iconfont icon-shuangxianyoujiantou'
    );
    slider.setAttribute('cursor', 'y');
    const text = el('span', 'captcha-text');
    text.innerText = '右滑补全拼图';

    sliderMask.appendChild(slider);
    sliderWrap.append(sliderMask, text);

    content.append(captchaBox, sliderWrap);
    box.appendChild(content);
    mask.appendChild(box);
    document.body.appendChild(mask);

    Object.assign(this, {
      mask,
      box,
      content,
      captchaBox,
      bg,
      piece,
      sliderWrap,
      sliderMask,
      slider,
      text,
    });
  }

  /* ================= 数据 ================= */

  async update() {
    this.maskLoading.show();
    try {
      const res = await reqUserGetCaptcha({
        flag: this.flag,
        theme: isDark() ? 'dark' : 'light',
      });
      if (res.code === 1) {
        this.captcha = res.data;
        this.reset();
      } else {
        this.close();
      }
    } catch {
      this.close();
    } finally {
      this.maskLoading.hide();
    }
  }

  async verify(id, track) {
    this.maskLoading.show();
    try {
      const res = await reqUserCaptcha({ id, track });
      if (res.code === 1) {
        _msg.success(res.codeText);
        this.sliderMask.classList.add('success');
        await delay(500);
        this.maskLoading.hide();
        this.close();
        this.opt.success?.({ id });
      } else {
        this.update();
      }
    } catch {
      this.sliderMask.classList.add('fail');
      this.update();
    }
  }
  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.mask.style.display = 'flex';
      this.bg.src = this.captcha.bg;
      this.piece.src = this.captcha.piece;

      this.cw = this.content.clientWidth;
      this.displayToRealScale = this.captcha.w / this.cw;

      this.slider.style.left = '0px';
      this.sliderMask.style.width = '0px';
      this.piece.style.left = '0px';

      this.sliderMask.classList.remove('success');
      this.sliderMask.classList.remove('fail');

      const pieceSize = this.captcha.s / this.displayToRealScale;
      this.piece.style.width = this.piece.style.height = `${pieceSize}px`;
      this.piece.style.top = `${this.captcha.y / this.displayToRealScale}px`;

      this.text.style.display = '';
    }, 100);
  }

  /* ================= 事件 ================= */

  bindEvents() {
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onMaskClick = this.onMaskClick.bind(this);
    this.onRaset = this.reset.bind(this);

    this.slider.addEventListener('mousedown', this.onDown);
    this.slider.addEventListener('touchstart', this.onDown, {
      passive: false,
    });
    this.mask.addEventListener('click', this.onMaskClick);
    window.addEventListener('resize', this.onRaset);
  }

  onDown(e) {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    this.originX = point.clientX;

    this.track = [];
    this.startTime = Date.now();
    const y = point.clientY - this.content.getBoundingClientRect().top;
    this.track.push({ x: 0, y, t: 0 });

    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
    this.slider.addEventListener('touchmove', this.onMove, { passive: false });
    this.slider.addEventListener('touchend', this.onUp);
  }

  onMove(e) {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;

    let moveX = point.clientX - this.originX;
    const sliderW = this.slider.offsetWidth;

    moveX = Math.max(0, Math.min(moveX, this.cw - sliderW));

    this.slider.style.left = `${moveX}px`;
    this.sliderMask.style.width = `${moveX}px`;

    const pieceX =
      ((this.cw - this.piece.offsetWidth) / (this.cw - sliderW)) * moveX;
    this.piece.style.left = `${pieceX}px`;

    this.text.style.display = 'none';

    const now = Date.now();
    if (
      this.track.length === 0 ||
      now - this.track[this.track.length - 1].t > 60
    ) {
      const y = point.clientY - this.content.getBoundingClientRect().top;
      this.track.push({
        x: Math.round(pieceX * this.displayToRealScale),
        y: Math.round(y * this.displayToRealScale),
        t: now - this.startTime,
      });
    }
  }

  onUp() {
    this.removeDragEvents();
    if (this.track[this.track.length - 1].x === 0) return this.reset();
    this.verify(this.captcha.id, this.track);
  }

  removeDragEvents() {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
    this.slider.removeEventListener('touchmove', this.onMove);
    this.slider.removeEventListener('touchend', this.onUp);
  }

  onMaskClick(e) {
    if (e.target === this.mask) this.close();
  }

  close() {
    this.removeDragEvents();
    this.slider.removeEventListener('mousedown', this.onDown);
    this.slider.removeEventListener('touchstart', this.onDown);
    this.mask.removeEventListener('click', this.onMaskClick);
    window.removeEventListener('resize', this.onRaset);
    this.maskLoading?.close();
    this.mask.remove();
    this.opt.close?.();
  }
}

export default function captcha(flag, opt) {
  return new SlideCaptcha(flag, opt);
}
