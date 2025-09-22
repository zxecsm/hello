import $ from 'jquery';
import nanoid from '../../js/utils/nanoid';
import {
  ContentScroll,
  _animate,
  _getTarget,
  _position,
  _setTimeout,
  getCenterPointDistance,
  getScreenSize,
  imgjz,
  isBigScreen,
  isFullScreen,
  isMobile,
  longPress,
  myDrag,
  myOpen,
  myResize,
  savePopLocationInfo,
  switchBorderRadius,
  toCenter,
  toSetSize,
} from '../../js/utils/utils';
import { popWindow, setZidx } from './popWindow';
import defaultIcon from '../../images/img/default-icon.png';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import _path from '../../js/utils/path';
const $minimizeBox = $('.minimize_box');
// 标签logo
function getTagFont(type) {
  let font = 'iconfont ';
  if (type === 'notes') {
    font += `icon-mingcheng-jiluben`;
  } else if (type === 'note') {
    font += `icon-jilu`;
  } else if (type === 'history') {
    font += `icon-history`;
  } else if (type === 'bmk') {
    font += `icon-shuqian`;
  } else if (type === 'edit') {
    font += `icon-bianji`;
  } else if (type === 'log') {
    font += `icon-rizhi`;
  } else if (type === 'pic') {
    font += `icon-tupian`;
  } else if (type === 'trash') {
    font += `icon-huishouzhan`;
  } else if (type === 'root') {
    font += `icon-zhanghao`;
  } else if (type === 'sharebm') {
    font += `icon-fenxiang_2`;
  } else if (type === 'sharelist') {
    font += `icon-fenxiang_2`;
  } else if (type === 'sharemusic') {
    font += `icon-yinle1`;
  } else if (type === 'videoplay') {
    font += `icon-shipin1`;
  } else if (type === 'file' || type === 'sharefile') {
    font += `icon-24gl-folder`;
  } else if (type === 'notepad') {
    font += `icon-jilu`;
  } else {
    font += `icon-shoucang`;
  }
  return font;
}
// 更新iframe标题
openInIframe.iframes = {
  data: new Map(),
  add(id, i) {
    this.data.set(id, i);
  },
  get(id) {
    return this.data.get(id);
  },
  remove(id) {
    this.data.delete(id);
  },
};
window.openInIframe = openInIframe;
class CreateIframe {
  constructor(url, name) {
    this.url = url;
    this.name = name || url;
    this.id = nanoid() + '_iframe';
    this.isTop = false;
    this.init();
  }
  init() {
    this.box = document.createElement('div');
    this.box.className = 'iframe_warp no_select';
    const html = _tpl(
      `
      <div class="i_head_btns window_head">
        <div cursor="y" class="i_close_btn iconfont icon-close-bold"></div>
        <div cursor="y" class="i_to_max_btn iconfont icon-xuanzeweixuanze"></div>
        <div cursor="y" class="i_hide_btn iconfont icon-minus-bold"></div>
        <div cursor="y" class="i_top iconfont icon-zhiding"></div>
        <div class="i_title_text"><p class="scroll_text"></p></div>
        <div cursor="y" title="刷新" class="i_refresh_btn iconfont icon-suijibofang"></div>
        <div cursor="y" title="新标签打开" class="i_new_page_open_btn iconfont icon-link1"></div>
      </div>
      <div class="con">
      <div class="iframe_mask"></div>
      <div class="iframe_load"></div>
      <iframe :src="url" scrolling="yes" frameborder="0"></iframe>
      </div>
      `,
      {
        url: this.url,
      }
    );
    _tpl.html(this.box, html);
    this.scrollText = this.box.querySelector('.scroll_text');
    this.iframe = this.box.querySelector('iframe');
    this.iframeMask = this.box.querySelector('.iframe_mask');
    this.iframeLoad = this.box.querySelector('.iframe_load');
    this.scrollT = new ContentScroll(this.scrollText);
    this.onIframeLoad = this.onIframeLoad.bind(this);
    this.iframe.addEventListener('load', this.onIframeLoad);
    this.iframe.addEventListener('error', this.onIframeLoad);
    document.querySelector('#main').append(this.box);
    this.box.style.display = 'flex';
    this.box.style.visibility = 'visible';
    toSetSize(this.box, 1250);
    const windows = popWindow.getList();
    const lastWindow = windows.slice(-1)[0];
    if (!lastWindow) {
      toCenter(this.box);
    } else {
      if (lastWindow.id.includes('_iframe')) {
        if (isFullScreen(lastWindow.target)) {
          toCenter(this.box);
        } else {
          const lastIframe = windows
            .filter(
              (item) =>
                item.id.includes('_iframe') &&
                item.target.style.visibility === 'visible'
            )
            .slice(-1)[0];
          if (lastIframe) {
            const { left, top } = _position(lastIframe.target, 1);
            toCenter(this.box, { left: left + 40, top: top + 40 });
          } else {
            toCenter(this.box);
          }
        }
      } else {
        toCenter(this.box);
      }
    }
    // 窗口缩放
    this.resizeClose = myResize({
      target: this.box,
      down({ target }) {
        target.style.transition = '0s';
        showIframeMask();
      },
      up({ target, x, y }) {
        hideIframeMask();
        savePopLocationInfo(target, {
          x,
          y,
          w: target.offsetWidth,
          h: target.offsetHeight,
        });
      },
    });
    // 拖动窗口
    this.dragClose = myDrag({
      trigger: this.box.querySelector('.i_title_text'),
      target: this.box,
      down({ target }) {
        target.style.transition = '0s';
        showIframeMask();
      },
      dblclick: () => {
        if (isFullScreen(this.box)) {
          this.toRest();
        } else {
          this.toMax();
        }
      },
      up: ({ target, x, y, pointerX }) => {
        hideIframeMask();
        const { h, w } = getScreenSize();
        if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
          this.toMax();
        } else {
          savePopLocationInfo(target, { x, y });
          this.toRest(pointerX);
        }
      },
    });
    this.bandEvent();
    this.tagBox = addHideBox(this);
    this.updateTitle(this.name);
    this.hdZindex();
  }
  onIframeLoad() {
    try {
      this.iframeLoad.style.opacity = 0;
      this.iframeWindow = this.iframe.contentWindow;
      this.iframeWindow.addEventListener('mousedown', this.hdDown);
      this.iframeWindow.addEventListener('touchstart', this.hdStart);
      this.iframeWindow.iframeId = this.id;
    } catch {}
  }
  // 更新标题
  updateTitle(name) {
    this.name = name;
    this.scrollT.init(this.name);
    this.tagBox.querySelector('.title').innerText = this.name;
  }
  // 处理层级
  hdZindex() {
    setZidx(this.box, this.id, this.hdHide.bind(this), this.isTop, this.tagBox);
  }
  // 全屏
  toMax() {
    const { w, h } = getScreenSize();
    this.box.style.transition =
      'top var(--speed-duration) var(--speed-timing), left var(--speed-duration) var(--speed-timing), width var(--speed-duration) var(--speed-timing), height var(--speed-duration) var(--speed-timing)';
    this.box.style.top = 0 + 'px';
    this.box.style.left = 0 + 'px';
    this.box.style.width = w + 'px';
    this.box.style.height = h + 'px';
    if (!isBigScreen()) {
      savePopLocationInfo(this.box, { x: 0, y: 0, w, h });
    }
    _setTimeout(() => {
      switchBorderRadius(this.box);
    }, 600);
  }
  // 退出全屏
  toRest(pointerX, isToMin = true) {
    const screen = getScreenSize();
    let { x = 0, y = 0, w = 0, h = 0 } = this.box.dataset;
    this.box.style.transition =
      'top var(--speed-duration) var(--speed-timing), left var(--speed-duration) var(--speed-timing), width var(--speed-duration) var(--speed-timing), height var(--speed-duration) var(--speed-timing)';
    if (pointerX && isToMin) {
      const bw = this.box.offsetWidth;
      if (bw != w) {
        const percent = (pointerX - x) / bw;
        x = pointerX - w * percent;
        savePopLocationInfo(this.box, { x });
      }
    }
    // 超出屏幕则居中
    if (x > screen.w || y > screen.h || 0 - x > w || y < 0) {
      toCenter(this.box);
      return;
    }
    if (isToMin) {
      this.box.style.top = y + 'px';
      this.box.style.left = x + 'px';
      this.box.style.width = w + 'px';
      this.box.style.height = h + 'px';
    }
    _setTimeout(() => {
      switchBorderRadius(this.box);
    }, 600);
  }
  bandEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.hdDown = this.hdDown.bind(this);
    this.hdStart = this.hdStart.bind(this);
    this.box.addEventListener('click', this.hdClick);
    this.box.addEventListener('mousedown', this.hdDown);
    this.box.addEventListener('touchstart', this.hdStart);
  }
  hdDown() {
    if (isMobile()) return;
    this.hdZindex();
  }
  hdStart() {
    if (!isMobile()) return;
    this.hdZindex();
  }
  close() {
    openInIframe.iframes.remove(this.id);
    this.box.removeEventListener('click', this.hdClick);
    this.box.removeEventListener('mousedown', this.hdDown);
    this.box.removeEventListener('touchstart', this.hdStart);
    this.tagBox.remove();
    this.scrollT.close();
    this.iframe.src = 'about:blank';
    this.iframe.removeEventListener('load', this.onIframeLoad);
    this.iframe.removeEventListener('error', this.onIframeLoad);
    try {
      this.iframeWindow.removeEventListener('mousedown', this.hdDown);
      this.iframeWindow.removeEventListener('touchstart', this.hdStart);
      this.iframeWindow.document.write('');
      this.iframeWindow.document.clear();
    } catch {}
    this.dragClose();
    this.resizeClose();
    _animate(
      this.box,
      { to: { transform: 'translateY(100%) scale(0)', opacity: 0 } },
      () => {
        popWindow.remove(this.id);
        this.iframe.remove();
        this.box.remove();
      }
    );
  }
  getUrl() {
    try {
      const url = this.iframeWindow.location.href;
      this.url = url;
    } catch {}
    return this.url;
  }
  hdClick(e) {
    const topBtn = _getTarget(this.box, e, '.i_top');
    if (_getTarget(this.box, e, '.i_close_btn')) {
      this.close();
    } else if (_getTarget(this.box, e, '.i_to_max_btn')) {
      if (isFullScreen(this.box)) {
        this.toRest();
      } else {
        this.toMax();
      }
    } else if (_getTarget(this.box, e, '.i_refresh_btn')) {
      this.iframeLoad.style.opacity = 1;
      try {
        this.iframeWindow.location.reload();
        return;
      } catch {}
      this.iframe.src = this.url;
    } else if (_getTarget(this.box, e, '.i_new_page_open_btn')) {
      myOpen(this.getUrl(), '_blank');
    } else if (_getTarget(this.box, e, '.i_hide_btn')) {
      this.hdHide();
    } else if (topBtn) {
      this.isTop = !this.isTop;
      if (this.isTop) {
        topBtn.className = 'i_top iconfont icon-zhiding1';
      } else {
        topBtn.className = 'i_top iconfont icon-zhiding';
      }
      this.hdZindex();
    }
  }
  hdHide() {
    const { x, y } = getCenterPointDistance(this.box, this.tagBox);
    _animate(
      this.box,
      { to: { transform: `translate(${x}px,${y}px) scale(0)`, opacity: 0 } },
      (target) => {
        target.style.visibility = 'hidden';
        popWindow.remove(this.id);
        this.tagBox.classList.add('hide');
        this.scrollT.close();
      }
    );
  }
}
function openInIframe(url, name) {
  const ifra = new CreateIframe(url, name);
  openInIframe.iframes.add(ifra.id, ifra);
  return ifra;
}
// 生成标签
function addHideBox(iframeBox) {
  const box = document.createElement('div');
  box.className = 'iframe_tag';
  box.setAttribute('title', iframeBox.url);
  box.setAttribute('cursor', '');
  box.setAttribute('iframeId', iframeBox.id);

  const close = document.createElement('span');
  close.className = 'close_btn iconfont icon-close-bold';
  const title = document.createElement('span');
  title.className = 'title';
  title.innerText = iframeBox.name;
  const logo = document.createElement('span');
  const isOuterLink = iframeBox.url.startsWith('http');

  logo.className = `logo ${
    isOuterLink ? '' : getTagFont(_path.basename(iframeBox.url)[0])
  }`;
  if (isOuterLink) {
    const u = `/api/getfavicon?u=${encodeURIComponent(iframeBox.url)}`;
    imgjz(u)
      .then((cache) => {
        logo.style.backgroundImage = `url(${cache})`;
      })
      .catch(() => {
        logo.style.backgroundImage = `url(${defaultIcon})`;
      });
  }
  box.appendChild(logo);
  box.appendChild(title);
  box.appendChild(close);
  $minimizeBox[0].appendChild(box);
  return box;
}
// 切换显示/隐藏
function switchIframeBox() {
  const _this = this.parentNode;
  const ifram = openInIframe.iframes.get(_this.getAttribute('iframeId'));
  const iframeBox = ifram.box;
  const obj = popWindow.getList().slice(-1)[0];
  if (iframeBox.style.visibility === 'hidden' || (obj && obj.id != ifram.id)) {
    ifram.hdZindex();
    const isShow = iframeBox.style.visibility === 'visible';
    iframeBox.style.visibility = 'visible';
    if (!isShow) {
      const { x, y } = getCenterPointDistance(iframeBox, _this);
      _animate(iframeBox, {
        to: {
          transform: `translate(${x}px,${y}px) scale(0)`,
          opacity: 0,
        },
        direction: 'reverse',
      });
    }
    ifram.scrollT.init(ifram.name);
    ifram.toRest(false, false);
    _this.classList.remove('hide');
    return;
  }
  ifram.hdHide();
}
$minimizeBox
  .on('click', '.title', switchIframeBox)
  .on('click', '.logo', function (e) {
    const _this = this.parentNode;
    handleHideBox(e, _this);
  })
  .on('click', '.close_btn', function () {
    const _this = this.parentNode;
    const ifram = openInIframe.iframes.get(_this.getAttribute('iframeId'));
    ifram.close();
  })
  .on('contextmenu', '.iframe_tag', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    const _this = this;
    handleHideBox(e, _this);
  });
longPress($minimizeBox[0], '.iframe_tag', function (e) {
  const _this = this,
    ev = e.changedTouches[0];
  handleHideBox(ev, _this);
});
// 标签菜单
function handleHideBox(e, _this) {
  const ifram = openInIframe.iframes.get(_this.getAttribute('iframeId'));
  const url = ifram.getUrl();
  const data = [
    {
      id: '1',
      text: '新标签打开',
      beforeIcon: 'iconfont icon-link1',
    },
  ];
  if (openInIframe.iframes.data.size > 1) {
    data.push(
      {
        id: '2',
        text: '隐藏其他窗口',
        beforeIcon: 'iconfont icon-minus-bold',
      },
      {
        id: '3',
        text: '关闭其他窗口',
        beforeIcon: 'iconfont icon-shibai',
      }
    );
  }
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      close();
      if (id === '1') {
        myOpen(url, '_blank');
      } else if (id === '2') {
        hideAllIframe(ifram);
      } else if (id === '3') {
        closeAllIframe(ifram);
      }
    },
    _this.innerText
  );
}
export function closeAllIframe(ignoreIframe) {
  openInIframe.iframes.data.forEach((ifram) => {
    if (!ignoreIframe || ignoreIframe.id != ifram.id) {
      ifram.close();
    }
  });
}
export function hideAllIframe(ignoreIframe) {
  openInIframe.iframes.data.forEach((ifram) => {
    if (!ignoreIframe || ignoreIframe.id != ifram.id) {
      ifram.hdHide();
    }
  });
}
export function showIframeMask() {
  openInIframe.iframes.data.forEach((ifram) => {
    ifram.iframeMask.style.display = 'block';
  });
}
export function hideIframeMask() {
  openInIframe.iframes.data.forEach((ifram) => {
    ifram.iframeMask.style.display = 'none';
  });
}
export function removeTagsActive() {
  openInIframe.iframes.data.forEach((ifram) => {
    ifram.tagBox.classList.remove('active-window');
  });
}
