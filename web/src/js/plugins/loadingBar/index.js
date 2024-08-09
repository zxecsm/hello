import _d from '../../common/config';
import loadingImg from '../../../images/img/loading.svg';
// 页面加载进度条效果
class LoadingBar {
  constructor(options) {
    this.num = 0;
    this.timer = null;
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
    let { color, size, zIndex } = this.options;
    this.el.style.cssText = `
    height: ${size}px;
    background-color: ${color};
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    border-radio:20px;
    pointer-events: none;
    z-index: ${zIndex};
    background-image: linear-gradient(to right,Orange 90%, red);`;
    document.body.appendChild(this.el);
  }
  start() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.num++;
    if (this.num === 1) {
      this.el.style.transition = '0s';
      this.el.style.width = '0';
      this.el.clientHeight;
      this.el.style.transition = '20s ease-in-out';
      this.el.style.width = '90%';
      this.options.setStart && this.options.setStart();
    }
  }
  end() {
    this.num--;
    this.num <= 0 ? (this.num = 0) : null;
    if (this.num === 0) {
      this.el.style.transition = '0s';
      this.el.clientHeight;
      this.el.style.width = '0';
      this.options.setEnd && this.options.setEnd();
    }
  }
}
function createMaskLoading() {
  let num = 0;
  let box = document.createElement('div');
  box.style.cssText = `
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: ${_d.levelObj.loading};
  background-image: url(${loadingImg});
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100px 100px;
  `;
  let timer = null;
  document.body.appendChild(box);
  function start() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    num++;
    if (num === 1) {
      box.style.display = 'block';
      box.style.opacity = 1;
    }
  }
  function end() {
    num--;
    num <= 0 ? (num = 0) : null;
    if (num === 0) {
      box.style.transition = '.5s ease-in-out';
      box.style.opacity = 0;
      timer = setTimeout(() => {
        clearTimeout(timer);
        timer = null;
        box.style.display = 'none';
      }, 500);
    }
  }
  return {
    start,
    end,
  };
}
export const maskLoading = createMaskLoading();
export const _loadingBar = new LoadingBar({
  color: 'red', //进度条颜色
  // size: '4', //进度条粗细（px）
  zIndex: _d.levelObj.loading,
  setStart() {
    if (_d.isFilePage) {
      maskLoading.start();
    }
  },
  setEnd() {
    if (_d.isFilePage) {
      maskLoading.end();
    }
  },
});
