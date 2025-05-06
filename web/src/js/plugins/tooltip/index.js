import './index.less';
import { getScreenSize, isMobile, hdTextMsg } from '../../utils/utils';
import { _tpl } from '../../utils/template';
import localData from '../../common/localData';

const tipBox = document.createElement('pre');
tipBox.className = 'tool_tip';
document.body.appendChild(tipBox);
const space = 20;
function move(e) {
  if (!localData.get('toolTip') || tipBox.style.opacity === '0' || isMobile())
    return;
  const { w, h } = getScreenSize();
  const tw = tipBox.offsetWidth,
    th = tipBox.offsetHeight;
  let x = e.clientX,
    y = e.clientY;
  x <= w * 0.8 ? (x += space) : (x = x - tw - space);
  y <= h * 0.5 ? (y += space) : (y = y - th - space);
  x < 0 ? (x = 0) : x + tw > w ? (x = w - tw) : null;
  y < 0 ? (y = 0) : y + th > h ? (y = h - th) : null;
  tipBox.style.top = y + 'px';
  tipBox.style.left = x + 'px';
}
let tip = '';
const toolTip = {
  setTip(val) {
    if (!localData.get('toolTip') || isMobile()) return this;
    tip = val;
    _tpl.html(tipBox, hdTextMsg(tip));
    return this;
  },
  show() {
    if (!localData.get('toolTip') || isMobile()) return this;
    if (tip) {
      tipBox.style.opacity = 0.9;
    } else {
      this.hide();
    }
    return this;
  },
  hide() {
    tipBox.style.opacity = 0;
    return this;
  },
};
document.addEventListener('mousemove', move);
document.addEventListener('mouseup', toolTip.hide);
export default toolTip;
