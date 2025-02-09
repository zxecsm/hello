import _d from '../../common/config';
import './index.less';
import { myDrag, toCenter } from '../../utils/utils';

class Pop {
  constructor(opt, callback) {
    this.text = opt.text;
    this.top = opt.top;
    this.cancel = {
      type: 'info',
      text: '取消',
      ...(opt.cancel || {}),
    };
    this.confirm = {
      type: 'primary',
      text: '确认',
      ...(opt.confirm || {}),
    };
    this.callback = callback;
    this.e = opt.e;
    this.init();
  }
  init() {
    this.mask = document.createElement('div');
    this.mask.className = 'pop_confirm_mask';
    this.mask.style.zIndex = this.top ? 9999 : _d.levelObj.popConfirm;
    this.box = document.createElement('div');
    this.box.className = 'box';
    this.textBox = document.createElement('div');
    this.textBox.className = 'text_box';
    this.textBox.innerText = this.text;
    this.btns = document.createElement('div');
    this.btns.className = 'btns';
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = `btn btn_${this.cancel.type}`;
    this.cancelBtn.setAttribute('cursor', '');
    this.cancelBtn.innerText = this.cancel.text;
    this.confirmBtn = document.createElement('button');
    this.confirmBtn.style.cssText = `margin-left: 20px;`;
    this.confirmBtn.className = `btn btn_${this.confirm.type}`;
    this.confirmBtn.setAttribute('cursor', '');
    this.confirmBtn.innerText = this.confirm.text;
    this.btns.appendChild(this.cancelBtn);
    this.btns.appendChild(this.confirmBtn);
    this.box.appendChild(this.textBox);
    this.box.appendChild(this.btns);
    this.mask.appendChild(this.box);
    document.body.appendChild(this.mask);
    this.dragClose = myDrag({
      trigger: this.box,
      border: true,
      down({ target }) {
        target.style.transition = '0s';
      },
    });
    this.show();
    this.bindEvent();
  }
  show() {
    this.position();
    this.mask.clientWidth;
    this.box.style.opacity = 1;
    this.box.style.transform = 'none';
  }
  bindEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.mask.addEventListener('click', this.hdClick);
  }
  unBindEvent() {
    this.mask.removeEventListener('click', this.hdClick);
  }
  hdClick(e) {
    const target = e.target;
    if (target === this.mask) {
      this.close();
      this.callback && this.callback('close');
    } else if (target === this.cancelBtn) {
      this.close();
      this.callback && this.callback('cancel');
    } else if (target === this.confirmBtn) {
      this.close();
      this.callback && this.callback('confirm');
    }
  }
  close() {
    this.dragClose();
    this.unBindEvent();
    this.mask.remove();
  }
  position() {
    if (!this.e) {
      toCenter(this.box);
      return;
    }
    let ww = window.innerWidth;
    let hh = window.innerHeight,
      mtw = this.box.offsetWidth,
      mth = this.box.offsetHeight,
      x = this.e.clientX,
      y = this.e.clientY;
    x < ww / 2 ? null : (x = x - mtw);
    y < hh / 2 ? null : (y = y - mth);
    x < 0 ? (x = 0) : x + mtw > ww ? (x = ww - mtw) : null;
    y < 0 ? (y = 0) : y + mth > hh ? (y = hh - mth) : null;
    this.box.style.top = y + 'px';
    this.box.style.left = x + 'px';
  }
}
function _pop(opt, callback) {
  return new Pop(opt, callback);
}
_pop.p = function (opt) {
  return new Promise((resolve) => {
    new Pop(opt, (type) => {
      resolve(type);
    });
  });
};
export default _pop;
