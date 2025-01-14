import $ from 'jquery';
import {
  ContentScroll,
  _animate,
  _getTarget,
  _position,
  _setTimeout,
  getCenterPointDistance,
  getScreenSize,
  imgjz,
  isFullScreen,
  isMobile,
  longPress,
  myDrag,
  myOpen,
  myResize,
  nanoid,
  switchBorderRadius,
  toCenter,
  toSetSize,
} from '../../js/utils/utils';
import { popWindow, setZidx } from './popWindow';
import imgMrLogo from '../../images/img/mrlogo.png';
import { closeAllwindow, hideAllwindow } from './index';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
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
openInIframe.hdTitle = {
  data: {},
  add(id, i) {
    this.data[id] = i;
  },
  remove(id) {
    if (this.data.hasOwnProperty(id)) {
      delete this.data[id];
    }
  },
  updateTitle(id, val) {
    if (this.data.hasOwnProperty(id)) {
      const ifram = this.data[id];
      ifram.name = val;
      ifram.updateTitle();
    }
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
    this.box.className = 'iframe_warp jzxz';
    const html = _tpl(
      `
      <div class="i_head_btns">
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
    this.hdZindex();
    // 窗口缩放
    this.resizeClose = myResize({
      target: this.box,
      down({ target }) {
        target.style.transition = '0s';
        showIframeMask();
      },
      up({ target, x, y }) {
        hideIframeMask();
        target.dataset.w = target.offsetWidth;
        target.dataset.h = target.offsetHeight;
        target.dataset.x = x;
        target.dataset.y = y;
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
          target.dataset.x = x;
          target.dataset.y = y;
          this.toRest(pointerX);
        }
      },
    });
    this.bandEvent();
    this.tagBox = addHideBox(this);
    this.updateTitle();
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
  updateTitle() {
    this.scrollT.init(this.name);
    this.tagBox.querySelector('.title').innerText = this.name;
  }
  // 处理层级
  hdZindex() {
    setZidx(this.box, this.id, this.hdHide.bind(this), this.isTop);
  }
  // 全屏
  toMax() {
    const { w, h } = getScreenSize();
    this.box.style.transition =
      'top 0.5s ease-in-out, left 0.5s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out';
    this.box.style.top = 0 + 'px';
    this.box.style.left = 0 + 'px';
    this.box.style.width = w + 'px';
    this.box.style.height = h + 'px';
    _setTimeout(() => {
      switchBorderRadius(this.box);
    }, 550);
  }
  // 退出全屏
  toRest(pointerX) {
    const screen = getScreenSize();
    let { x = 0, y = 0, w = 0, h = 0 } = this.box.dataset;
    this.box.style.transition =
      'top 0.5s ease-in-out, left 0.5s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out';
    if (pointerX) {
      // 如果是全屏
      if (isFullScreen(this.box)) {
        let percent = (pointerX - x) / this.box.offsetWidth;
        x = pointerX - w * percent;
        this.box.dataset.x = x;
      }
    }
    // 超出屏幕则居中
    if (x > screen.w || y > screen.h || 0 - x > w || y < 0) {
      toCenter(this.box);
      return;
    }
    this.box.style.top = y + 'px';
    this.box.style.left = x + 'px';
    this.box.style.width = w + 'px';
    this.box.style.height = h + 'px';
    _setTimeout(() => {
      switchBorderRadius(this.box);
    }, 550);
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
    openInIframe.hdTitle.remove(this.id);
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
      try {
        let url = this.iframeWindow.location.href;
        this.url = url;
      } catch {}
      myOpen(this.url, '_blank');
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
  openInIframe.hdTitle.add(ifra.id, ifra);
  return ifra;
}
// 生成标签
function addHideBox(iframeBox) {
  const box = document.createElement('div');
  box.className = 'iframe_tag';
  box._iframeBox = iframeBox;
  box.setAttribute('title', iframeBox.url);
  box.setAttribute('cursor', '');

  const close = document.createElement('span');
  close.className = 'close_btn iconfont icon-close-bold';
  const title = document.createElement('span');
  title.className = 'title';
  title.innerText = iframeBox.name;
  const logo = document.createElement('span');
  const isOuterLink = iframeBox.url.startsWith('http');

  logo.className = `logo ${
    isOuterLink ? '' : getTagFont(iframeBox.url.split('/')[1])
  }`;
  if (isOuterLink) {
    const u = `/api/getfavicon?u=${encodeURIComponent(iframeBox.url)}`;
    imgjz(u)
      .then((cache) => {
        logo.style.backgroundImage = `url(${cache})`;
      })
      .catch(() => {
        logo.style.backgroundImage = `url(${imgMrLogo})`;
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
  const htarget = _this._iframeBox.box;
  const obj = popWindow.getList().slice(-1)[0];
  if (
    htarget.style.visibility === 'hidden' ||
    (obj && obj.id != _this._iframeBox.id)
  ) {
    _this._iframeBox.hdZindex();
    const isShow = htarget.style.visibility === 'visible';
    htarget.style.visibility = 'visible';
    if (!isShow) {
      const { x, y } = getCenterPointDistance(_this._iframeBox.box, _this);
      _animate(_this._iframeBox.box, {
        to: {
          transform: `translate(${x}px,${y}px) scale(0)`,
          opacity: 0,
        },
        direction: 'reverse',
      });
    }
    _this._iframeBox.scrollT.init(_this._iframeBox.name);
    _this._iframeBox.toRest();
    _this.classList.remove('hide');
    return;
  }
  _this._iframeBox.hdHide();
}
$minimizeBox
  .on('click', '.title', switchIframeBox)
  .on('click', '.logo', function (e) {
    const _this = this.parentNode;
    handleHideBox(e, _this);
  })
  .on('click', '.close_btn', function () {
    const _this = this.parentNode;
    _this._iframeBox.close();
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
  const htarget = _this._iframeBox,
    url = htarget.url;
  const data = [
    {
      id: '1',
      text: '新标签打开',
      beforeIcon: 'iconfont icon-link1',
    },
    {
      id: '2',
      text: '隐藏所有窗口',
      beforeIcon: 'iconfont icon-minus-bold',
    },
    {
      id: '3',
      text: '关闭所有窗口',
      beforeIcon: 'iconfont icon-shibai',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      close();
      if (id === '1') {
        myOpen(url, '_blank');
      } else if (id === '2') {
        hideAllwindow();
      } else if (id === '3') {
        closeAllwindow();
      }
    },
    _this.innerText
  );
}
export function closeAllIframe() {
  $minimizeBox[0].querySelectorAll('.iframe_tag').forEach((item) => {
    item._iframeBox.close();
  });
}
export function hideAllIframe() {
  $minimizeBox[0].querySelectorAll('.iframe_tag').forEach((item) => {
    item._iframeBox.hdHide();
  });
}
export function showIframeMask() {
  Object.keys(openInIframe.hdTitle.data).forEach((item) => {
    const ifra = openInIframe.hdTitle.data[item];
    ifra.iframeMask.style.display = 'block';
  });
}
export function hideIframeMask() {
  Object.keys(openInIframe.hdTitle.data).forEach((item) => {
    const ifra = openInIframe.hdTitle.data[item];
    ifra.iframeMask.style.display = 'none';
  });
}
