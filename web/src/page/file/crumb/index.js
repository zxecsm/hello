import bus from '../../../js/utils/bus';
import _path from '../../../js/utils/path';
import { _tpl } from '../../../js/utils/template';
import { _mySlide, isMobile } from '../../../js/utils/utils';
import HashRouter from './hashRouter';
import './index.less';

const routerData = new Map(); // 储存页面信息

let target = null;
let callback = null;
let pageInfo = { pageNo: 1, top: 0 };

const hashRouter = new HashRouter({
  before(HASH) {
    // 跳转前获取当前页信息并保存
    updatePageInfo();
    routerData.set(HASH, pageInfo);
  },
  change(HASH) {
    // 查看是否有即将跳转页的信息
    const info = routerData.get(HASH) || { pageNo: 1, top: 0 };
    renderCrumb(HASH);
    callback && callback(HASH, info);
  },
});

bus.on('setPageInfo', (info) => (pageInfo = info));

function updatePageInfo() {
  bus.emit('getPageInfo');
}

// 生成路径
function renderCrumb(HASH) {
  const hasBack = hashRouter.hasBack();
  const hasForward = hashRouter.hasForward();
  const html = _tpl(
    `
    <i cursor="y" class="back iconfont icon-zuo {{hasBack ? '' : 'deactive'}}"></i>
    <i cursor="y" class="forward iconfont icon-you {{hasForward ? '' : 'deactive'}}"></i>
    <span :cursor="pathArr.length > 0 ? 'y' : ''" class='home'>主页</span>
    <span v-for="item,idx in pathArr" :title="item" :cursor="idx + 1 === pathArr.length ? '' : 'y'" :data-idx="idx + 1">{{item}}</span>
    <i cursor="y" class="refresh iconfont icon-suijibofang"></i>
    `,
    { pathArr: pathToArr(HASH), hasBack, hasForward }
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
  if (p !== hashRouter.getRoute()) {
    routerData.delete(p);
    hashRouter.push(p);
  } else {
    renderCrumb(p);
    callback && callback(p, param);
  }
}

// 点击事件
function hdClick(e) {
  const target = e.target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'i' || tag === 'span') {
    const route = hashRouter.getRoute();
    if (tag === 'i') {
      const className = target.className;
      if (className.includes('back')) {
        hashRouter.back();
      } else if (className.includes('forward')) {
        hashRouter.forward();
      } else if (className.includes('refresh')) {
        callback && callback(route, { pageNo: 1, top: 0, update: 1 });
      }
    } else if (tag === 'span') {
      let p = [];
      if (target.className === 'home') {
        p = [];
      } else {
        const idx = +target.dataset.idx;
        p = pathToArr(route).slice(0, idx);
      }
      const path = arrToPath(p);
      if (route !== path) {
        routerData.delete(path);
        hashRouter.push(path);
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
  if (val === hashRouter.getRoute()) {
    renderCrumb(val);
  } else {
    routerData.delete(val);
    hashRouter.push(val);
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
  oInp.value = hashRouter.getRoute();
  target.innerHTML = '';
  target.appendChild(oInp);
  oInp.focus();
}

// 获取路径
function getHash() {
  return hashRouter.getHash();
}

function arrToPath(arr) {
  return _path.normalize('/' + arr.join('/'));
}

function pathToArr(path) {
  return path.split('/').filter((item) => item);
}

const curmb = {
  bind,
  getHash,
  toGo,
};

export default curmb;
