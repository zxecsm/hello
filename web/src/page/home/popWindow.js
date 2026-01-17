import _d from '../../js/common/config';
import { _position, debounce, getScreenSize, toCenter } from '../../js/utils/utils';
import { removeTagsActive } from './iframe';

let windowList = [];
const updateActiveWindows = debounce(function () {
  removeTagsActive();
  windowList.forEach((item) => {
    if (item.target && !['search', 'rightmenu', 'bg'].includes(item.id)) {
      item.target.classList.remove('active-window');
      item.target.classList.add('inactive-window');
    }
  });
  const topWindow = windowList.slice(-1)[0];
  if (topWindow) {
    const { id, target, tagBox } = topWindow;
    if (target && !['search', 'rightmenu', 'bg'].includes(id)) {
      target.classList.add('active-window');
      target.classList.remove('inactive-window');
    }
    tagBox && tagBox.classList.add('active-window');
  }
}, 100);
// 添加窗口
function add(id, close, target, tagBox) {
  remove(id);
  windowList.push({ id, close, target, tagBox });
  updateActiveWindows();
}
// 删除窗口
function remove(id) {
  windowList = windowList.filter((item) => item.id != id);
  updateActiveWindows();
}
// 返回关闭最顶层窗口
function back() {
  const obj = windowList.pop();
  if (obj) {
    obj.close();
  }
  updateActiveWindows();
}
// 窗口数据
function getList() {
  return windowList;
}
export const popWindow = {
  add,
  remove,
  back,
  getList,
};
let zIdx = 100;
let topIdx = 9999;
// 设置窗口层级
export function setZidx(el, id, close, isTop, tagBox) {
  if (id && close) {
    popWindow.add(id, close, el, tagBox);
  }
  let tem;
  if (isTop && getScreenSize().w > _d.screen) {
    topIdx = topIdx >= 100000 ? 9999 : topIdx + 1;
    tem = topIdx;
  } else {
    zIdx = zIdx >= 9999 ? 100 : zIdx + 1;
    tem = zIdx;
  }
  el.style.zIndex = tem;
}
// 动态位置
export function setPos(el, reference) {
  const { w, h } = getScreenSize();
  if (reference && _d.screen < w) {
    const { left, top } = _position(reference.target, 1);
    if (top + reference.target.offsetHeight > h || left + reference.target.offsetWidth > w) {
      toCenter(el);
    } else {
      toCenter(el, { left: left + 40, top: top + 40 });
    }
  } else {
    toCenter(el);
  }
}
