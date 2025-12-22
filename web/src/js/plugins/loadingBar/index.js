import _d from '../../common/config';
import loadingSvg from '../../../images/img/loading.svg';
// 页面加载进度条效果
class LoadingBar {
  constructor(options) {
    this.num = 0;
    this.init(options);
  }
  init(options) {
    let defaultobj = {
      color: 'red',
      size: '3',
      setStart: null,
      setEnd: null,
      zIndex: 999,
    };
    this.options = Object.assign(defaultobj, options);
    this.render();
  }
  render() {
    this.el = document.createElement('div');
    const { color, size, zIndex } = this.options;
    this.el.style.cssText = `
    height: ${size / 10}rem;
    background-color: ${color};
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    border-radio:2rem;
    pointer-events: none;
    z-index: ${zIndex};
    background-image: linear-gradient(to right,Orange 90%, red);`;
    document.body.appendChild(this.el);
  }
  start() {
    this.num++;
    if (this.num === 1) {
      this.el.style.animation = `loadingEffect 10s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
      this.options.setStart && this.options.setStart();
    }
  }
  end() {
    this.num--;
    this.num <= 0 ? (this.num = 0) : null;
    if (this.num === 0) {
      this.el.style.animation = 'none';
      this.options.setEnd && this.options.setEnd();
    }
  }
}

export const _loadingBar = new LoadingBar({
  color: 'red', //进度条颜色
  // size: '4', //进度条粗细（px）
  zIndex: _d.levelObj.loading,
  setStart() {},
  setEnd() {},
});

export class MaskLoading {
  constructor(target = document.body) {
    this.target = target;
    this.render();
  }
  render() {
    this.el = document.createElement('div');
    this.el.style.cssText = `
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 99999;
    background-image: url(${loadingSvg});
    background-size: 10rem 10rem;
    background-position: center;
    background-repeat: no-repeat;
    `;
    this.target.appendChild(this.el);
  }
  show(through = false) {
    if (!through) {
      this.el.style.pointerEvents = 'auto';
    } else {
      this.el.style.pointerEvents = 'none';
    }
    this.el.style.display = 'block';
  }
  hide() {
    this.el.style.display = 'none';
  }
  close() {
    this.el.remove();
  }
}
export const maskLoading = new MaskLoading();
