const { getScreenSize, _getData, isMobile } = require('../../utils/utils');

const tipBox = document.createElement('pre');
tipBox.style.cssText = `
      position: fixed;
      z-index: 9999;
      box-sizing: border-box;
      padding: 10px;
      background-color: var(--color10);
      color: var(--color3);
      max-width: 80%;
      max-height: 80%;
      pointer-events: none;
      line-height: 1.5;
      opacity: 0;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-all;
      box-shadow: 0 0 5px var(--color5);
      transition: opacity .5s ease-in-out`;
document.body.appendChild(tipBox);
const space = 20;
function move(e) {
  if (!_getData('toolTip') || tipBox.style.opacity === '0' || isMobile())
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
    if (!_getData('toolTip') || isMobile()) return this;
    tip = val;
    tipBox.innerText = tip;
    return this;
  },
  show() {
    if (!_getData('toolTip') || isMobile()) return this;
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
