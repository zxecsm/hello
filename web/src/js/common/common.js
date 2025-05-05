import {
  _getData,
  _setTimeout,
  debounce,
  randomColor,
  darkMode,
  isIframe,
  addCustomCode,
  changeHeadBtnSort,
  isLogin,
  _getDataTem,
  _setDataTem,
  _delDataTem,
  myOpen,
  pageErr,
} from '../utils/utils';
import _d from './config';
import _msg from '../plugins/message';
import { _loadingBar } from '../plugins/loadingBar';
import icon1logo from '../../images/img/icon1.svg';
import iconlogo from '../../images/img/icon.svg';
import imgHechang from '../../images/img/hechang.png';
import loadingPage from '../plugins/loading';
import { reqUserCustomCode, reqUserError } from '../../api/user';
import './codeRain';
import './stars';
window._pageName =
  myOpen()
    .split(/[?#]/)[0]
    .replace(_d.originURL, '')
    .split('/')
    .filter((item) => item)[0] || 'home';
if (isIframe() && window._pageName !== '404') {
  if (window._pageName === 'home') {
    pageErr();
  } else {
    try {
      if (top._pageName !== 'home') {
        pageErr();
      }
    } catch {
      pageErr();
    }
  }
}
if (isLogin()) {
  // 君子锁
  ~(function getGentlemanLock() {
    const gentlemanLockPd = _getData('gentlemanLockPd');
    if (gentlemanLockPd) {
      const pd = _getDataTem('gentlemanLockPd') || prompt('请输入君子锁密码：');
      if (pd === gentlemanLockPd) {
        _setDataTem('gentlemanLockPd', pd);
      } else {
        _delDataTem('gentlemanLockPd');
        getGentlemanLock();
      }
    }
  })();
}
document.body.style.opacity = 1;
loadingPage.start();
window.addEventListener('load', function () {
  if (window._pageName !== 'root') {
    reqUserCustomCode()
      .then((res) => {
        if (res.code === 1) {
          addCustomCode(res.data);
        }
      })
      .catch(() => {});
  }
  if (window._pageName === 'home' || window._pageName === 'note') return;
  loadingPage.end();
});
//鼠标点击效果
~(function () {
  function handle(e) {
    const randomc = randomColor();
    if (!_getData('clickLove')) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        z-index: ${_d.levelObj.clickLove};
        pointer-events: none;
        `;
      document.body.appendChild(box);

      box.style.left = e.clientX - 20 / 2 + 'px';
      box.style.top = e.clientY - 20 / 2 + 'px';
      box.style.backgroundColor = randomc;
      box.clientHeight;
      box.style.transition = '.8s ease-in-out';
      box.style.opacity = 0;
      box.style.transform = 'scale(2)';
      _setTimeout(() => {
        box.remove();
      }, 2000);
      return;
    }
    // 心形状
    const box1 = document.createElement('div');
    const box2 = document.createElement('div');
    const box3 = document.createElement('div');
    box1.style.cssText = `
          position: fixed;
          width: 16px;
          height: 16px;
          z-index: ${_d.levelObj.clickLove};
          pointer-events: none;
          transform: rotate(-45deg);
          `;
    box2.style.cssText = `
          position: absolute;
          top: -8px;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          `;
    box3.style.cssText = `
          position: absolute;
          left: 8px;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          `;
    box1.appendChild(box2);
    box1.appendChild(box3);
    document.body.appendChild(box1);
    box1.style.left = e.clientX - 16 / 2 + 'px';
    box1.style.top = e.clientY - 16 / 2 + 'px';
    box1.style.backgroundColor = randomc;
    box2.style.backgroundColor = randomc;
    box3.style.backgroundColor = randomc;
    box1.clientHeight;
    box1.style.transition = '2s ease-in-out';
    box1.style.opacity = 0;
    box1.style.transform = 'rotate(-55deg) translateY(-600%) scale(1.5)';
    _setTimeout(() => {
      box1.remove();
    }, 2000);
  }
  const _handle = debounce(handle, 100, true);
  document.addEventListener('mouseup', _handle);
  document.addEventListener('touchend', function (e) {
    const ev = e.changedTouches[0];
    _handle(ev);
  });
})();
window.addEventListener('online', function () {
  _msg.success('网络连接成功');
});
window.addEventListener('offline', function () {
  _msg.error('断网了，少年');
});
~(function () {
  if (!isIframe()) {
    const img = document.createElement('img');
    img.src = imgHechang;
    img.style.cssText = `
  width: 100px;
  height: 100px;
  position: fixed;
  right: 0;
  bottom: 0;
  opacity: .2;
  pointer-events: none;
  z-index: ${_d.levelObj.hechang};
  `;
    document.body.appendChild(img);
  }
})();
if (!isIframe()) {
  // 黑白
  document.documentElement.style.filter = `grayscale(${_getData(
    'pageGrayscale'
  )})`;
}

// 捕获错误
window.onerror = function (message, url, line, column) {
  reqUserError(`${message} at ${url}:${line}:${column}`);
  // return true;
};

// 字体处理
~(function () {
  let flag = null;
  function handleFontType() {
    return new Promise((resolve, reject) => {
      const fontType = _getData('fontType');
      if (fontType === 'default') {
        document.body.style.fontFamily = 'Roboto, Arial, sans-serif';
        resolve();
        return;
      }
      _loadingBar.start();
      const fontUrl = `/api/pub/font/${fontType}`;
      const ff = new FontFace('changfont', `url(${fontUrl})`);
      // 添加到全局的 FontFaceSet 中
      document.fonts.add(ff);
      ff.load()
        .then(() => {
          document.body.style.fontFamily = 'changfont';
          _loadingBar.end();
          if (flag) {
            document.fonts.delete(flag);
          }
          flag = ff;
          resolve();
        })
        .catch(() => {
          _msg.error('字体加载失败');
          _loadingBar.end();
          reject();
        });
    });
  }
  window.handleFontType = handleFontType;
})();
handleFontType();

darkMode(_getData('dark'));
changeHeadBtnSort(_getData('headBtnToRight'));
// 图标处理
~(function () {
  const icon = document.querySelector("link[rel*='icon']");
  document.addEventListener('visibilitychange', function () {
    // 页面变为不可见时触发
    if (document.visibilityState === 'hidden') {
      icon.href = iconlogo;
    }
    // 页面变为可见时触发
    if (document.visibilityState === 'visible') {
      icon.href = icon1logo;
    }
  });
})();
// eslint-disable-next-line no-console
console.log(`
 __   __  ______  __     __       __ 
|  | |  ||  ____||  |   |  |    / __ \\
|  |_|  || |____ |  |   |  |   | |  | |
|   _   ||  ____||  |   |  |   | |  | |
|  | |  || |____ |  |__ |  |__ | |__| |
|__| |__||______||_____||_____| \\ __ / 
`);
// eslint-disable-next-line no-console
console.log(`https://github.com/zxecsm/hello`);
