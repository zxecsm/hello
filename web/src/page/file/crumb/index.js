import localData from '../../../js/common/localData';
import bus from '../../../js/utils/bus';
import _path from '../../../js/utils/path';
import { _tpl } from '../../../js/utils/template';
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
function saveFileHistory(path) {
  if (!path) return;
  const list = localData
    .get('fileHistory')
    .filter((item) => item && item !== path);
  list.push(path);
  if (list.length > 50) {
    list.shift();
  }
  localData.set('fileHistory', list);
}
// 生成路径
function renderCrumb(HASH) {
  saveFileHistory(HASH);
  const hasBack = hashRouter.hasBack();
  const hasForward = hashRouter.hasForward();
  const html = _tpl(
    `
    <div cursor="y" class="back iconfont icon-zuo {{hasBack ? '' : 'deactive'}}"></div>
    <div cursor="y" class="forward iconfont icon-you {{hasForward ? '' : 'deactive'}}"></div>
    <div :cursor="pathArr.length > 0 ? 'y' : ''" class='home item'>主页</div>
    <template v-for="item,idx in pathArr">
      <div class='line iconfont icon-fenge'></div>
      <div class='item' :title="item" :cursor="idx + 1 === pathArr.length ? '' : 'y'" :data-idx="idx + 1">{{item}}</div>
    </template>
    <div cursor="y" class="refresh iconfont icon-suijibofang"></div>
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
  if (this === target) {
    editPath();
  } else {
    const className = target.className;
    const route = hashRouter.getRoute();
    if (className.includes('back')) {
      hashRouter.back();
    } else if (className.includes('forward')) {
      hashRouter.forward();
    } else if (className.includes('refresh')) {
      callback && callback(route, { pageNo: 1, top: 0, update: 1 });
    } else if (className.includes('item')) {
      let p = [];
      if (!className.includes('home')) {
        const idx = +target.dataset.idx;
        p = pathToArr(route).slice(0, idx);
      }
      const path = arrToPath(p);
      if (route !== path) {
        routerData.delete(path);
        hashRouter.push(path);
      }
    }
  }
}

function hdInputBlur() {
  const val = _path.normalize(this.value.trim()) || '/';
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
  hashRouter,
};

export default curmb;
