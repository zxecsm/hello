import _d from '../../js/common/config';
import { getScreenSize, myOpen } from '../../js/utils/utils';

let showWindowArr = [];
// 添加窗口
function add(id, close, target) {
  remove(id);
  showWindowArr.push({ id, close, target });
}
// 删除窗口
function remove(id) {
  showWindowArr = showWindowArr.filter((item) => item.id != id);
}
// 返回关闭最顶层窗口
function back() {
  const obj = showWindowArr.pop();
  if (obj) {
    obj.close();
  }
}
// 窗口数据
function getValue() {
  return showWindowArr;
}
export const backWindow = {
  add,
  remove,
  back,
  getValue,
};
let zIdx = 100;
let topIdx = 9999;
// 设置窗口层级
export function setZidx(el, id, close, isTop) {
  if (id && close) {
    backWindow.add(id, close, el);
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
// 监听浏览器返回事件
function pushHistory() {
  window.history.pushState(null, '', myOpen());
}
pushHistory();
window.addEventListener('popstate', function () {
  backWindow.back();
  pushHistory();
});
