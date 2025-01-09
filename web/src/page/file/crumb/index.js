import bus from '../../../js/utils/bus';
import _path from '../../../js/utils/path';
import { _tpl } from '../../../js/utils/template';
import { _mySlide, isMobile } from '../../../js/utils/utils';
import hashRouter from './hashRouter';
import './index.less';

let target = null;
let callback = null;

let HASH = _path.normalize(hashRouter.getHash());

let pageInfo = { pageNo: 1, top: 0 };

window.addEventListener('hashchange', () => {
  // 跳转前获取当前页信息并保存
  updatePageInfo();
  hashRouter.set(HASH, pageInfo);
  // 查看是否有即将跳转页的信息
  HASH = _path.normalize(hashRouter.getHash());
  const info = hashRouter.get(HASH) || { pageNo: 1, top: 0 };
  renderCrumb();
  callback && callback(HASH, info);
});

bus.on('setPageInfo', (info) => (pageInfo = info));

function updatePageInfo() {
  bus.emit('getPageInfo');
}

// 生成路径
function renderCrumb() {
  const html = _tpl(
    `
    <i cursor="y" class="back iconfont icon-zuo"></i>
    <i cursor="y" class="forward iconfont icon-you"></i>
    <span :cursor="pathArr.length > 0 ? 'y' : ''" class='home'>主页</span>
    <span v-for="item,idx in pathArr" :title="item" :cursor="idx + 1 === pathArr.length ? '' : 'y'" :data-idx="idx + 1">{{item}}</span>
    <i cursor="y" class="refresh iconfont icon-suijibofang"></i>
    `,
    { pathArr: pathToArr(HASH) }
  );
  _tpl.html(target, html);
}

// 绑定
function bind(el, cb) {
  callback = cb;
  target = el;
  el.classList.add('crumb');
  el.addEventListener('click', hdClick);
}

function toGo(p, param = {}) {
  p = _path.normalize(p);
  if (p !== HASH) {
    hashRouter.setHash(p);
  } else {
    renderCrumb();
    callback && callback(p, param);
  }
}

// 点击事件
function hdClick(e) {
  const target = e.target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'i' || tag === 'span') {
    if (tag === 'i') {
      const className = target.className;
      if (className.includes('back')) {
        hashRouter.back();
      } else if (className.includes('forward')) {
        hashRouter.forward();
      } else if (className.includes('refresh')) {
        callback && callback(HASH, { pageNo: 1, top: 0, update: 1 });
      }
    } else if (tag === 'span') {
      let p = [];
      if (target.className === 'home') {
        p = [];
      } else {
        const idx = +target.dataset.idx;
        p = pathToArr(HASH).slice(0, idx);
      }
      const path = arrToPath(p);
      if (HASH !== path) {
        hashRouter.setHash(path);
      }
    }
  } else if (this === target) {
    editPath();
  }
}

// 手势右划后退
_mySlide({
  el: '.content_wrap',
  right() {
    if (isMobile()) {
      hashRouter.back();
    }
  },
  left() {
    if (isMobile()) {
      hashRouter.forward();
    }
  },
});

_mySlide({
  el: '.crumb_box',
  right() {
    if (isMobile()) {
      hashRouter.back();
    }
  },
  left() {
    if (isMobile()) {
      hashRouter.forward();
    }
  },
});

function hdInputBlur() {
  const val = _path.normalize(this.value.trim());
  if (val === HASH) {
    renderCrumb();
  } else {
    hashRouter.setHash(val);
  }
}

function hdInputKeyup(e) {
  if (e.key === 'Enter') {
    this.blur();
  }
}
const oInp = document.createElement('input');
oInp.addEventListener('blur', hdInputBlur);
oInp.addEventListener('keyup', hdInputKeyup);

// 编辑路径
function editPath() {
  oInp.value = HASH;
  target.innerHTML = '';
  target.appendChild(oInp);
  oInp.focus();
}

// 获取路径
function getPath() {
  return HASH;
}

function arrToPath(arr) {
  return _path.normalize('/' + arr.join('/'));
}

function pathToArr(path) {
  return path.split('/').filter((item) => item);
}

const curmb = {
  bind,
  getPath,
  toGo,
};

export default curmb;
