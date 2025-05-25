import './index.less';
import {
  _setTimeout,
  debounce,
  randomColor,
  darkMode,
  isIframe,
  addCustomCode,
  changeHeadBtnSort,
  isLogin,
  myOpen,
  pageErr,
  getDarkIcon,
  _getTarget,
  throttle,
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
import localData from './localData';
import wave from '../plugins/wave';
import { timeMsg } from '../../page/home/home';
import bear from '../plugins/bear';
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
    const gentlemanLockPd = localData.get('gentlemanLockPd');
    if (gentlemanLockPd) {
      const pd =
        localData.session.get('gentlemanLockPd') ||
        prompt('请输入君子锁密码：');
      if (pd === gentlemanLockPd) {
        localData.session.set('gentlemanLockPd', pd);
      } else {
        localData.session.remove('gentlemanLockPd');
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
  if (!isIframe()) {
    timeMsg();
  }
});
//鼠标点击效果
~(function () {
  function handle(e) {
    const randomc = randomColor();
    if (!localData.get('clickLove')) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        width: 1.6rem;
        height: 1.6rem;
        margin: -0.8rem 0 0 -0.8rem;
        border-radius: 50%;
        z-index: ${_d.levelObj.clickLove};
        pointer-events: none;
        `;
      document.body.appendChild(box);

      box.style.left = e.clientX + 'px';
      box.style.top = e.clientY + 'px';
      box.style.backgroundColor = randomc;
      box.clientHeight;
      box.style.transition = '.8s ease-in-out';
      box.style.opacity = 0;
      box.style.transform = 'scale(1.5)';
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
          width: 1rem;
          height: 1rem;
          margin: -0.5rem 0 0 -0.5rem;
          z-index: ${_d.levelObj.clickLove};
          pointer-events: none;
          transform: rotate(-45deg);
          `;
    box2.style.cssText = `
          position: absolute;
          top: -0.5rem;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          `;
    box3.style.cssText = `
          position: absolute;
          left: 0.5rem;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          `;
    box1.appendChild(box2);
    box1.appendChild(box3);
    document.body.appendChild(box1);
    box1.style.left = e.clientX + 'px';
    box1.style.top = e.clientY + 'px';
    box1.style.backgroundColor = randomc;
    box2.style.backgroundColor = randomc;
    box3.style.backgroundColor = randomc;
    box1.clientHeight;
    box1.style.transition = '1s ease-in-out';
    box1.style.opacity = 0;
    box1.style.transform = 'translateY(-400%) scale(1.5)';
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
  if (isIframe()) return;
  _msg.success('网络连接成功');
});
window.addEventListener('offline', function () {
  if (isIframe()) return;
  _msg.error('断网了，少年');
});
~(function () {
  if (!isIframe()) {
    const img = document.createElement('img');
    img.src = imgHechang;
    img.style.cssText = `
  width: 10rem;
  height: 10rem;
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
const toolBox = (() => {
  if (isIframe()) return null;
  const toolBox = document.createElement('div');
  toolBox.className = 'pub_tools';
  toolBox.innerHTML = `
  <div class="head"></div>
  <div class="btns">
    <div cursor="y" class="zoom_in iconfont icon-fangdasuoxiao_X"></div>
    <div cursor="y" class="dark iconfont icon-xianshiqi"></div>
    <div cursor="y" class="zoom_out iconfont icon-fangdasuoxiao_Y"></div>
  </div>
  `;
  if (window._pageName === 'home') {
    document.querySelector('#main').appendChild(toolBox);
  } else {
    document.body.appendChild(toolBox);
  }
  toolBox.addEventListener('click', (e) => {
    if (_getTarget(toolBox, e, '.zoom_in')) {
      const size = localData.get('htmlFontSize') + 1;
      localData.set('htmlFontSize', size);
    } else if (_getTarget(toolBox, e, '.zoom_out')) {
      const size = localData.get('htmlFontSize') - 1;
      localData.set('htmlFontSize', size < 6 ? 6 : size);
    } else if (_getTarget(toolBox, e, '.dark')) {
      let dark = localData.get('dark');
      if (dark === 'y') {
        dark = 'n';
        _msg.success('关闭黑暗模式');
      } else if (dark === 'n') {
        dark = 's';
        _msg.success('跟随系统');
      } else if (dark === 's') {
        dark = 'y';
        _msg.success('开启黑暗模式');
      }
      localData.set('dark', dark);
    }
  });
  toolBox.addEventListener(
    'wheel',
    throttle((e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY > 0) {
        const size = localData.get('htmlFontSize') - 1;
        localData.set('htmlFontSize', size < 6 ? 6 : size);
      } else {
        const size = localData.get('htmlFontSize') + 1;
        localData.set('htmlFontSize', size);
      }
    }, 200)
  );
  return toolBox;
})();
function updateToolBoxDarkBtn(dark) {
  if (toolBox) {
    toolBox.querySelector('.dark').className = `dark iconfont ${getDarkIcon(
      dark
    )}`;
  }
}
updateToolBoxDarkBtn(localData.get('dark'));
function changeHtmlFontSize(size, notify) {
  document.documentElement.style.fontSize = size + 'px';
  if (notify && !isIframe()) {
    _msg.botMsg(size, 1);
  }
}
changeHtmlFontSize(localData.get('htmlFontSize'));
localData.onChange(({ key }) => {
  if (!key || key === 'pageGrayscale') {
    updateGrayscale();
  }
  if (!key || key === 'fontType') {
    if (window._pageName !== 'home') {
      handleFontType(localData.get('fontType')).catch(() => {});
    }
  }
  if (!key || key === 'dark') {
    const dark = localData.get('dark');
    darkMode(dark);
    updateToolBoxDarkBtn(dark);
  }
  if (!key || key === 'headBtnToRight') {
    changeHeadBtnSort(localData.get('headBtnToRight'));
  }
  if (!key || key === 'htmlFontSize') {
    changeHtmlFontSize(localData.get('htmlFontSize'), 1);
  }
});
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (event) => {
    if (localData.get('dark') != 's') return;
    const dark = event.matches ? 'y' : 'n';
    darkMode(dark);
  });
function updateGrayscale() {
  if (!isIframe()) {
    // 黑白
    document.documentElement.style.filter = `grayscale(${localData.get(
      'pageGrayscale'
    )})`;
  }
}
updateGrayscale();
// 捕获错误
window.onerror = function (message, url, line, column) {
  reqUserError(`${message} at ${url}:${line}:${column}`);
  // return true;
};

// 字体处理
~(function () {
  let flag = null;
  function handleFontType(fontType) {
    return new Promise((resolve, reject) => {
      if (fontType === 'default') {
        document.body.style.fontFamily = _d.defaultFontFamily;
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
handleFontType(localData.get('fontType')).catch(() => {});

darkMode(localData.get('dark'));
changeHeadBtnSort(localData.get('headBtnToRight'));
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
if (!isIframe()) {
  bear(999);
  let idx = 1;
  switch (window._pageName) {
    case 'edit':
    case 'notepad':
      idx = 5;
      break;
    case 'file':
      idx = 11;
      break;
    case 'notes':
      idx = 6;
      break;
    default:
      break;
  }
  wave(idx);
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
}
