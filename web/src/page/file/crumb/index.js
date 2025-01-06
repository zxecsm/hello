import bus from '../../../js/utils/bus';
import _path from '../../../js/utils/path';
import { _tpl } from '../../../js/utils/template';
import { _mySlide, isMobile } from '../../../js/utils/utils';
import './index.less';

let historyList = [];
let pathArr = [];

let target = null;
let callback = null;

let pageInfo = { pageNo: 1, top: 0 };

bus.on('setPageInfo', (info) => (pageInfo = info));

function updatePageInfo() {
  bus.emit('getPageInfo');
}

function addHistory() {
  if (
    historyList.length > 0 &&
    arrToPath(historyList[historyList.length - 1].pathArr) === getPath()
  )
    return;
  historyList.push({ pageInfo, pathArr });
}

function getLastHistory() {
  const res = historyList.pop();
  return res || { pageInfo: { pageNo: 1, top: 0 }, pathArr: [] };
}

// 生成路径
function renderCrumb() {
  const html = _tpl(
    `
    <i cursor="y" class="back iconfont icon-Undo"></i>
    <span :cursor="pathArr.length > 0 ? 'y' : ''" class='home'>主页</span>
    <span v-for="item,idx in pathArr" :title="item" :cursor="idx + 1 === pathArr.length ? '' : 'y'" :data-idx="idx + 1">{{item}}</span>
    <i cursor="y" class="refresh iconfont icon-suijibofang"></i>
    `,
    { pathArr }
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

function toBack() {
  const { pageInfo, pathArr: p } = getLastHistory();
  pathArr = p;
  renderCrumb();
  callback && callback(getPath(), pageInfo);
}

function toGo(p, param = {}) {
  if (typeof p === 'string') {
    p = pathToArr(p);
  }
  if (arrToPath(p) !== getPath()) {
    addHistory();
  }
  pathArr = p;
  renderCrumb();
  callback && callback(getPath(), param);
}

// 点击事件
function hdClick(e) {
  const target = e.target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'i' || tag === 'span') {
    if (tag === 'i') {
      const className = target.className;
      if (className.includes('back')) {
        toBack();
      } else if (className.includes('refresh')) {
        toGo(pathArr.slice(0), { pageNo: 1, top: 0, update: 1 });
      }
    } else if (tag === 'span') {
      let p = [];
      if (target.className === 'home') {
        p = [];
      } else {
        const idx = +target.dataset.idx;
        p = pathArr.slice(0, idx);
      }
      if (arrToPath(p) === getPath()) return;
      updatePageInfo();
      toGo(p, { pageNo: 1, top: 0 });
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
      toBack();
    }
  },
});

_mySlide({
  el: '.crumb_box',
  right() {
    if (isMobile()) {
      toBack();
    }
  },
});

function hdInputBlur() {
  const val = this.value.trim();
  if (getPath() !== val) {
    updatePageInfo();
    toGo(val, { pageNo: 1, top: 0 });
  } else {
    renderCrumb();
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
  oInp.value = getPath();
  target.innerHTML = '';
  target.appendChild(oInp);
  oInp.focus();
}

// 获取路径
function getPath() {
  return arrToPath(pathArr);
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
