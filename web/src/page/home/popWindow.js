import _d from '../../js/common/config';
import { getScreenSize } from '../../js/utils/utils';

let windowList = [];
// 添加窗口
function add(id, close, target) {
  remove(id);
  windowList.forEach((item) => {
    item.target &&
      !['search', 'rightmenu', 'bg'].includes(item.id) &&
      getScreenSize().w > _d.screen &&
      item.target.classList.remove('active-window');
  });
  windowList.push({ id, close, target });
  target &&
    !['search', 'rightmenu', 'bg'].includes(id) &&
    getScreenSize().w > _d.screen &&
    target.classList.add('active-window');
}
// 删除窗口
function remove(id) {
  windowList = windowList.filter((item) => item.id != id);
}
// 返回关闭最顶层窗口
function back() {
  const obj = windowList.pop();
  if (obj) {
    obj.close();
  }
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
export function setZidx(el, id, close, isTop) {
  if (id && close) {
    popWindow.add(id, close, el);
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
