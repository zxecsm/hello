import _d from '../../js/common/config';
import { debounce, getScreenSize } from '../../js/utils/utils';
import { removeTagsActive } from './iframe';

let windowList = [];
const updateActiveWindows = debounce(function () {
  removeTagsActive();
  windowList.forEach((item) => {
    item.target &&
      !['search', 'rightmenu', 'bg'].includes(item.id) &&
      item.target.classList.remove('active-window');
  });
  const topWindow = windowList.slice(-1)[0];
  if (topWindow) {
    const { id, target, tagBox } = topWindow;
    target &&
      !['search', 'rightmenu', 'bg'].includes(id) &&
      target.classList.add('active-window');
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
    topIdx++;
    tem = topIdx;
  } else {
    zIdx++;
    tem = zIdx;
  }
  el.style.zIndex = tem;
}
