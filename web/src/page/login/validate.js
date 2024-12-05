import imgValidate from '../../images/img/validate.jpg';
// 获取指定区间内的随机数
function getRandomNumberByRange(start, end) {
  return Math.round(Math.random() * (end - start) + start);
}
// 创建元素
function createElement(tagName) {
  return document.createElement(tagName);
}
// 创建画布
function createCanvas(width, height) {
  const canvas = createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
class Validate {
  // 构造器
  constructor(opt) {
    const defaultOpt = {
      success: null,
      fail: null,
      close: null,
      image: imgValidate,
      puzzleSideLength: 60,
    };
    this.opt = Object.assign(defaultOpt, opt);
    this.radius = this.opt.puzzleSideLength / 4;
    this.puzzleW = this.opt.puzzleSideLength + this.radius * 2 - 2;
    this.PI = Math.PI;
    this.init();
  }
  // 初始化
  init() {
    this.initDOM();
    this.hdDraw();
    this.initImg();
    this.bindEvents();
  }
  // 初始化DOM
  initDOM() {
    const validateMask = createElement('div');
    validateMask.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity .5s ease-in-out;
      user-select: none;
      background-color: var(--bg-color-o4);
      z-index: 12;
    `;
    const box = createElement('div');
    box.style.cssText = `
      margin: auto;
      background-color: var(--color10);
      box-shadow: 0 0 5px var(--color5);
      padding: 20px;
      display: flex;
      border-radius: 10px;
      place-items: center;
      width: 96%;
      max-width: 600px;
    `;
    const content = createElement('div');
    content.style.cssText = `
      position: relative;
      width: 100%;
    `;
    box.appendChild(content);
    validateMask.appendChild(box);
    document.body.appendChild(validateMask);
    const canvas = createCanvas(0, 0),
      puzzle = canvas.cloneNode(true);
    puzzle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
    `;
    const sliderContainer = createElement('div');
    sliderContainer.style.cssText = `
      position: relative;
      text-align: center;
      height: 50px;
      line-height: 50px;
      margin-top: 15px;
      background-color: var(--color9);
    `;
    const sliderMask = createElement('div');
    sliderMask.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      height: 50px;
      background-color: var(--color7);
    `;
    const slider = createElement('div');
    slider.className = 'iconfont icon-shuangxianyoujiantou';
    slider.style.cssText = `
      position: absolute;
      left: 0px;
      top: 0px;
      width: 50px;
      height: 50px;
      text-align: center;
      font-weight: bold;
      line-height: 50px;
      background: var(--color6);
    `;
    const text = createElement('span');
    text.innerHTML = '右滑补全拼图';
    content.appendChild(canvas);
    content.appendChild(puzzle);
    slider.setAttribute('cursor', '');
    sliderMask.appendChild(slider);
    sliderContainer.appendChild(sliderMask);
    sliderContainer.appendChild(text);
    content.appendChild(sliderContainer);
    validateMask.clientWidth;
    validateMask.style.opacity = 1;
    Object.assign(this, {
      validateMask,
      box,
      content,
      canvas,
      puzzle,
      sliderContainer,
      slider,
      sliderMask,
      text,
      canvasCtx: canvas.getContext('2d'),
      puzzleCtx: puzzle.getContext('2d'),
    });
  }
  // 初始化图像
  initImg() {
    const img = createElement('img');
    img.onload = () => {
      img.onload = null;
      this.canvasCtx.drawImage(img, 0, 0, this.cw, this.ch);
      this.puzzleCtx.drawImage(img, 0, 0, this.cw, this.ch);
      const y = this.y - this.radius * 2 + 2;
      const imageData = this.puzzleCtx.getImageData(
        this.x,
        y,
        this.puzzleW,
        this.puzzleW
      );
      this.puzzle.width = this.puzzleW;
      this.puzzleCtx.putImageData(imageData, 0, y);
    };
    img.src = this.opt.image;
    this.img = img;
  }
  updateSize() {
    this.cw = this.content.clientWidth;
    this.ch = (this.cw / 4) * 3;
    this.puzzle.width = this.canvas.width = this.cw;
    this.puzzle.height = this.canvas.height = this.ch;
  }
  // 绘画
  hdDraw() {
    this.updateSize();
    this.x = getRandomNumberByRange(
      this.puzzleW + 10,
      this.cw - (this.puzzleW + 10)
    );
    this.y = getRandomNumberByRange(
      10 + this.radius * 2,
      this.ch - (this.puzzleW + 10)
    );
    this.draw(this.canvasCtx, 'fill', this.x, this.y);
    this.draw(this.puzzleCtx, 'clip', this.x, this.y);
  }
  draw(ctx, operation, x, y) {
    const psl = this.opt.puzzleSideLength;
    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + psl / 2, y);
    ctx.arc(x + psl / 2, y - r + 2, r, 0, 2 * this.PI);
    ctx.lineTo(x + psl / 2, y);
    ctx.lineTo(x + psl, y);
    ctx.lineTo(x + psl, y + psl / 2);
    ctx.arc(x + psl + r - 2, y + psl / 2, r, 0, 2 * this.PI);
    ctx.lineTo(x + psl, y + psl / 2);
    ctx.lineTo(x + psl, y + psl);
    ctx.lineTo(x, y + psl);
    ctx.lineTo(x, y);
    ctx.fillStyle = document.documentElement.className.includes('dark')
      ? '#000'
      : '#fff';
    ctx[operation]();
    ctx.beginPath();
    ctx.arc(x, y + psl / 2, r, 1.5 * this.PI, 0.5 * this.PI);
    ctx.globalCompositeOperation = 'xor';
    ctx.fill();
  }
  // 清除
  clean() {
    this.canvasCtx.clearRect(0, 0, this.cw, this.ch);
    this.puzzleCtx.clearRect(0, 0, this.cw, this.ch);
    this.puzzle.width = this.cw;
  }
  hdDown(e) {
    const move = (e) => {
      e.preventDefault();
      if (e.type === 'touchmove') {
        e = e.targetTouches[0];
      }
      let moveX = e.clientX - this.originX;
      moveX < 0
        ? (moveX = 0)
        : moveX > this.cw - 50
        ? (moveX = this.cw - 50)
        : null;
      this.slider.style.left = moveX + 'px';
      this.sliderMask.style.width = moveX + 'px';
      this.puzzle.style.left =
        ((this.cw - this.opt.puzzleSideLength - this.radius * 2) /
          (this.cw - 50)) *
          moveX +
        'px';
      this.text.style.display = 'none';
    };
    const up = (e) => {
      if (e.type === 'mouseup') {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      } else {
        this.slider.removeEventListener('touchmove', move);
        this.slider.removeEventListener('touchend', up);
      }
      if (this.verify()) {
        this.sliderMask.style.backgroundColor = '#d2f4ef';
        this.slider.style.backgroundColor = '#52ccba';
        this.opt.success && this.opt.success();
      } else {
        this.sliderMask.style.backgroundColor = '#fce1e1';
        this.slider.style.backgroundColor = '#f57a7a';
        this.opt.fail && this.opt.fail();
      }
      let timer = setTimeout(() => {
        clearTimeout(timer);
        timer = null;
        if (this.verify()) {
          this.close();
        } else {
          this.reset();
        }
      }, 500);
    };
    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    } else {
      e = e.targetTouches[0];
      this.slider.addEventListener('touchmove', move);
      this.slider.addEventListener('touchend', up);
    }
    this.originX = e.clientX;
  }
  hdClick(e) {
    if (e.target === this.validateMask) {
      this.close();
    }
  }
  // 绑定事件
  bindEvents() {
    this.hdDown = this.hdDown.bind(this);
    this.hdClick = this.hdClick.bind(this);
    this.slider.addEventListener('mousedown', this.hdDown);
    this.slider.addEventListener('touchstart', this.hdDown);
    this.validateMask.addEventListener('click', this.hdClick);
  }
  close() {
    this.slider.removeEventListener('mousedown', this.hdDown);
    this.slider.removeEventListener('touchstart', this.hdDown);
    this.validateMask.removeEventListener('click', this.hdClick);
    this.opt.close && this.opt.close();
    this.validateMask.remove();
  }
  // 重置
  reset() {
    this.text.style.display = 'block';
    this.sliderMask.style.backgroundColor = 'var(--color7)';
    this.slider.style.backgroundColor = 'var(--color6)';
    this.slider.style.left = 0;
    this.puzzle.style.left = 0;
    this.sliderMask.style.width = 0;
    this.clean();
    this.hdDraw();
    this.initImg();
  }
  // 验证
  verify() {
    const left = parseInt(this.puzzle.style.left);
    return Math.abs(left - this.x) < 10;
  }
}
export default function validateImg(opt) {
  new Validate(opt);
}
