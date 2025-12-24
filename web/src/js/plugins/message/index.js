import _d from '../../common/config';
import { _mySlide, debounce, playSound } from '../../utils/utils';
import imgBlop from '../../../images/img/blop.mp3';
import imgMsg from '../../../images/img/msg.mp3';
import onlineMsg from '../../../images/img/online.mp3';
import './index.less';
import { initRainCodeSleep } from '../../common/codeRain';
const msgArr = [];
const zIndex = _d.levelObj.msg;
class Msg {
  constructor(opt = {}, callback) {
    initRainCodeSleep();
    const defaultOpt = {
      message: 'default text',
      type: 'info',
      duration: 3000,
      icon: '',
      reside: false,
    };
    this.opt = Object.assign(defaultOpt, opt);
    if (this.opt.message.length > 100) {
      this.opt.message = this.opt.message.slice(0, 100) + '...';
    }
    this.callback = callback;
    this.timer = null;
    this.init();
  }
  init() {
    this.render();
    this.show();
    this.bind();
  }
  render() {
    this.el = document.createElement('div');
    switch (this.opt.type) {
      case 'info':
        this.el.className = 'message_box info';
        break;
      case 'success':
        this.el.className = 'message_box success';
        break;
      case 'error':
        this.el.className = 'message_box error';
        break;
      case 'warning':
        this.el.className = 'message_box warning';
      default:
        break;
    }
    this.el.style.zIndex = zIndex;
    if (this.opt.icon) {
      this.oIcon = document.createElement('i');
      this.oIcon.className = `icon ${this.opt.icon}`;
    }
    this.oText = document.createElement('span');
    this.oText.className = 'text';
    if (this.opt.icon) {
      this.oText.style.paddingLeft = 0;
    }
    if (this.callback) {
      this.oText.setAttribute('cursor', '');
    }
    this.oText.textContent = this.opt.message;
    this.progress = document.createElement('div');
    this.progress.className = 'progress';
    this.oClose = document.createElement('i');
    this.oClose.className = 'close iconfont icon-close-bold';
    this.oClose.setAttribute('cursor', '');
    if (this.opt.icon) {
      this.el.appendChild(this.oIcon);
    }
    this.el.appendChild(this.oText);
    this.el.appendChild(this.progress);
    this.el.appendChild(this.oClose);
  }
  bind() {
    this.hdEnter = this.hdEnter.bind(this);
    this.hdLeave = this.hdLeave.bind(this);
    this.hdClick = this.hdClick.bind(this);
    this.el.addEventListener('mouseenter', this.hdEnter);
    this.el.addEventListener('mouseleave', this.hdLeave);
    this.el.addEventListener('click', this.hdClick);
    const close = this.close.bind(this);
    this.unBindSlide = _mySlide({
      el: this.el,
      left: close,
      right: close,
      up: close,
      down: close,
      isStrict: false,
    });
  }
  unbind() {
    this.el.removeEventListener('mouseenter', this.hdEnter);
    this.el.removeEventListener('mouseleave', this.hdLeave);
    this.el.removeEventListener('click', this.hdClick);
    this.unBindSlide();
  }
  hdClick(e) {
    if (e.target === this.oText) {
      this.callback && this.callback('click');
    }
    this.close();
  }
  hdEnter() {
    this.el.isCheck = true;
    this.el.style.zIndex = zIndex + 1;
    this.el.style.opacity = 1;
    this.progress.style.transition = `0s`;
    this.progress.style.width = '100%';
    this.progress.style.opacity = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  hdLeave() {
    this.el.style.zIndex = zIndex;
    this.el.style.opacity = 0.9;
    this.el.isCheck = false;
    this.hide();
  }
  show() {
    let top = 0;
    msgArr.forEach((item) => {
      top += item.offsetHeight + 20;
    });
    document.body.appendChild(this.el);
    msgArr.push(this.el);
    this.el.style.top = top + 'px';
    this.el.clientHeight;
    this.el.style.transition = '0.3s ease-in-out';
    this.el.style.marginTop = '20px';
    this.el.style.opacity = 0.9;
    if (!this.opt.reside) {
      this.hide();
    }
  }
  hide() {
    if (this.opt.duration === 0) return;
    this.progress.style.opacity = 1;
    this.progress.style.transition = `width ${
      this.opt.duration / 1000
    }s linear`;
    this.progress.style.width = '0';
    this.timer = setTimeout(() => {
      clearTimeout(this.timer);
      this.timer = null;
      this.close();
    }, this.opt.duration);
  }
  close() {
    this.unbind();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const idx = msgArr.findIndex((item) => item === this.el);
    msgArr.splice(idx, 1);
    const h = this.el.offsetHeight + 20;
    this.el.style.transition = '0.3s ease-in-out';
    this.el.style.marginTop = `-${h}px`;
    this.el.style.opacity = 0;
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      this.el.remove();
      this.callback && this.callback('close');
    }, 300);
    msgArr.forEach((item, i) => {
      if (item.isCheck || i < idx) return;
      const t = parseInt(item.style.top);
      item.style.transition = '0.3s ease-in-out';
      item.style.top = t - h + 'px';
    });
  }
}
// 底部提示
const botMsg = (function () {
  let timer = null;
  const box = document.createElement('div'),
    textbox = document.createElement('div');
  box.style.cssText = `
      width: 100%;
      position: fixed;
      top: 2rem;
      padding: 0 2rem;
      transform: translateY(-100%);
      font-size: 1.8rem;
      opacity: 0;
      text-align: right;
      z-index: ${zIndex};
      pointer-events: none;`;
  textbox.style.cssText = `
      display: inline-block;
      line-height: 1.5;
      overflow: hidden;
      font-weight: bold;
      padding: 1rem;
      border-radius: 1rem;
      color: var(--color1);
      box-shadow: 0 0 .5rem var(--color5);
      background-color: var(--bg-color-o3);`;
  box.appendChild(textbox);
  document.body.appendChild(box);
  function mstc(str, again) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!again) {
      box.style.transition = '0s';
      box.style.transform = 'translateY(-100%)';
      box.style.opacity = '0';
      box.clientWidth;
    }

    textbox.textContent = str;
    box.style.transition =
      'transform 0.3s ease-in-out,opacity 0.3s ease-in-out';
    box.style.transform = 'none';
    box.style.opacity = '1';

    timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      box.style.transition = 'transform 1s ease-in-out,opacity 1s ease-in-out';
      box.style.transform = 'translateY(-100%)';
      box.style.opacity = '0';
    }, 5000);
  }
  return mstc;
})();

let cacheMsg = [];

function addCache(msg) {
  if (cacheMsg.length > 100) {
    cacheMsg.shift();
  }
  cacheMsg.push(msg);
}
document.addEventListener('visibilitychange', function () {
  // 页面变为可见时触发
  if (document.visibilityState === 'visible') {
    cacheMsg.forEach((item) => {
      new Msg(item.opt, item.callback);
    });
    cacheMsg = [];
  }
});
function success(
  message = '操作成功',
  callback,
  { duration = 3000, reside = false } = {}
) {
  const opt = {
    message,
    type: 'success',
    duration,
    icon: 'iconfont icon-chenggong',
    reside,
  };
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}
function error(
  message = '操作失败',
  callback,
  { duration = 6000, reside = false } = {}
) {
  const opt = {
    message,
    type: 'error',
    duration,
    icon: 'iconfont icon-shibai',
    reside,
  };
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}
function warning(message, callback, { duration = 8000, reside = false } = {}) {
  // 页面变为不可见时触发
  if (document.visibilityState === 'hidden') {
    _playSound(imgMsg);
  }
  // 页面变为可见时触发
  if (document.visibilityState === 'visible') {
    _playSound(imgBlop);
  }
  const opt = {
    message,
    type: 'warning',
    duration,
    icon: 'iconfont icon-warning-circle',
    reside,
  };
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}
function info(message, callback, { duration = 3000, reside = false } = {}) {
  const opt = { message, duration, icon: 'iconfont icon-info-circle', reside };
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}
function msg(opt, callback, sound) {
  if (sound) {
    // 页面变为不可见时触发
    if (document.visibilityState === 'hidden') {
      _playSound(imgMsg);
    }
    // 页面变为可见时触发
    if (document.visibilityState === 'visible') {
      _playSound(imgBlop);
    }
  }
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}
function online(message, callback, { duration = 8000, reside = false } = {}) {
  playSound(onlineMsg);
  const opt = {
    message,
    duration,
    type: 'success',
    icon: 'iconfont icon-zaixianzixun',
    reside,
  };
  if (document.visibilityState === 'hidden') {
    addCache({ opt, callback });
    return;
  }
  new Msg(opt, callback);
}

const _playSound = debounce(playSound, 1000, true);
const _msg = {
  success,
  error,
  warning,
  info,
  msg,
  botMsg,
  online,
};
export default _msg;
