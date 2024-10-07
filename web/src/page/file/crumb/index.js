import { _tpl } from '../../../js/utils/template';
import { _mySlide, hdPath } from '../../../js/utils/utils';
import './index.less';

let history = [];
let pathArr = [];

let target = null;
let callback = null;

function addHistory() {
  if (
    history.length > 0 &&
    arrToPath(history[history.length - 1]) === getPath()
  )
    return;
  history.push(pathArr);
}

function getLastHistory() {
  const res = history.pop();
  return res || [];
}

// 生成路径
function renderCrumb() {
  const html = _tpl(
    `
    <i cursor="y" class="back iconfont icon-chexiao"></i>
    <span cursor="y" class='home'>主页</span>
    <span v-for="item,idx in pathArr" cursor="y" :data-idx="idx + 1">{{item}}</span>
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
  pathArr = getLastHistory();
  renderCrumb();
  callback && callback(getPath());
}

function toGo(p, ...arg) {
  if (typeof p === 'string') {
    p = pathToArr(p);
  }
  if (arrToPath(p) !== getPath()) {
    addHistory();
  }
  pathArr = p;
  renderCrumb();
  callback && callback(getPath(), ...arg);
}

// 点击事件
function hdClick(e) {
  const target = e.target;
  const tag = target.tagName.toLowerCase();
  if (tag === 'i' || tag === 'span') {
    if (tag === 'i') {
      toBack();
    } else if (tag === 'span') {
      let p = [];
      if (target.className === 'home') {
        p = [];
      } else {
        const idx = +target.dataset.idx;
        p = pathArr.slice(0, idx);
      }
      toGo(p);
    }
  } else if (this === target) {
    editPath();
  }
}

// 手势右划后退
_mySlide({
  el: '.content_wrap',
  right: toBack,
});

_mySlide({
  el: '.crumb_box',
  right: toBack,
});

function hdInputBlur() {
  const val = this.value.trim();
  if (getPath() !== val) {
    toGo(val);
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
  return hdPath('/' + arr.join('/'));
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
