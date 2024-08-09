import _d from '../../common/config';
import {
  ContentScroll,
  LazyLoad,
  _getTarget,
  _position,
  _setTimeout,
  encodeHtml,
  imgjz,
  myDrag,
  myResize,
  toCenter,
  wrapInput,
} from '../../utils/utils';
import _pop from '../popConfirm';
import './index.less';
import loadFailImg from '../../../images/img/loadfail.png';
import { CreateTabs } from '../../../page/notes/tabs';
// 右键菜单
let arr = [];
class RightM {
  constructor(opt = {}) {
    const defaultOpt = {
      e: null,
      title: '',
      html: '',
      click: null,
      keyup: null,
      afterRender: null,
      beforeClose: null,
      hideCloseBtn: false,
      readyToCloseAll: null,
      space: 10,
    };
    this.opt = Object.assign(defaultOpt, opt);
    this.init();
  }
  init() {
    this.rightMask = document.createElement('div');
    this.rightMask.className = 'right_mask';
    this.rightMask.style.zIndex = _d.levelObj.rightBox;
    this.rightBox = document.createElement('div');
    this.rightBox.className = 'right_box max';
    this.head = document.createElement('div');
    this.head.className = 'head';
    if (!this.opt.hideCloseBtn) {
      this.hClose = document.createElement('div');
      this.hClose.className = `iconfont icon-guanbi close`;
      this.hClose.setAttribute('cursor', '');
      this.head.appendChild(this.hClose);
    }
    this.title = document.createElement('div');
    this.title.className = 'title';
    this.title.innerHTML = '<div class="scroll_text jzxz"></div>';
    this.head.appendChild(this.title);
    this.content = document.createElement('div');
    this.content.className = 'content';
    this.rightBox.appendChild(this.head);
    this.rightBox.appendChild(this.content);
    this.rightMask.appendChild(this.rightBox);
    document.body.appendChild(this.rightMask);
    // 标题滚动
    this.titleScroll = new ContentScroll(
      this.title.querySelector('.scroll_text')
    );
    this.titleScroll.init(this.opt.title);
    // 拖拽移动位置
    this.dragClose = myDrag({
      trigger: this.title,
      target: this.rightBox,
      down({ target }) {
        target.style.transition = '0s';
      },
      up({ target, x, y }) {
        target.style.transition = 'left 0.5s ease-in-out,top 0.5s ease-in-out';
        let h = window.innerHeight;
        if (y <= 0 || y >= h) {
          // toCenter(target);
          const { x, y } = target._op;
          target.style.top = y + 'px';
          target.style.left = x + 'px';
        } else {
          target._op = { x, y };
        }
      },
    });
    // 拖拽放大缩小
    this.resizeClose = myResize(
      {
        target: this.rightBox,
        down: (target) => {
          target.style.transition = '0s';
        },
        up: (target) => {
          target._os = {
            w: target.offsetWidth,
            h: target.offsetHeight,
          };
        },
      },
      200,
      100
    );
    this.renderList(this.opt.html);
    this.hdPosition(this.opt.e);
    this.bindEvent();
    this.rightBox.classList.add('open');
  }
  bindEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.hdKeyup = this.hdKeyup.bind(this);
    this.rightMask.addEventListener('click', this.hdClick);
    this.rightMask.addEventListener('keyup', this.hdKeyup);
  }
  renderList(html) {
    if (typeof html === 'string') {
      this.content.innerHTML = html;
    } else {
      this.content.innerHTML = '';
      this.content.appendChild(html);
    }
    this.opt.afterRender && this.opt.afterRender.call(this);
  }
  hdPosition(e) {
    const w = window.innerWidth,
      h = window.innerHeight;
    let rw = this.rightBox.offsetWidth,
      rh = this.rightBox.offsetHeight;
    const maxW = w * 0.8,
      maxH = h * 0.8;
    rw > maxW ? (rw = maxW) : null;
    rh > maxH ? (rh = maxH) : null;
    this.rightBox.style.width = rw + 'px';
    this.rightBox.style.height = rh + 'px';
    if (!e) {
      toCenter(this.rightBox);
      return;
    }
    let x = e.clientX,
      y = e.clientY;
    x <= w * 0.5 ? (x += this.opt.space) : (x = x - rw - this.opt.space);
    y <= h * 0.5 ? (y += this.opt.space) : (y = y - rh - this.opt.space);
    x < 0 ? (x = 0) : x + rw > w ? (x = w - rw) : null;
    y < 0 ? (y = 0) : y + rh > h ? (y = h - rh) : null;
    this.rightBox.style.top = y + 'px';
    this.rightBox.style.left = x + 'px';
    this.rightBox._op = { x, y };
  }
  hdClick(e) {
    const close = this.close.bind(this);
    if (e.target === this.rightMask) {
      if (
        !this.opt.readyToCloseAll ||
        this.opt.readyToCloseAll.call(this, { e, close })
      ) {
        this.close(1);
      }
    } else if (e.target == this.hClose) {
      this.close();
    } else {
      this.opt.click && this.opt.click.call(this, { e, close });
    }
  }
  hdKeyup(e) {
    this.opt.keyup &&
      this.opt.keyup.call(this, { e, close: this.close.bind(this) });
  }
  close(all) {
    if (all) {
      arr.forEach((item) => {
        item.close();
      });
      return;
    }
    this.opt.beforeClose && this.opt.beforeClose.call(this);
    arr = arr.filter((item) => item !== this);
    this.dragClose();
    this.resizeClose();
    this.titleScroll.close();
    this.rightMask.removeEventListener('click', this.hdClick);
    this.rightMask.removeEventListener('keyup', this.hdKeyup);
    this.rightMask.remove();
  }
}
function rightM(opt) {
  const r = new RightM(opt);
  arr.push(r);
  return r;
}
function selectTabs(e, data, opt = {}, title = '') {
  const html = `<div class="tabs_wrap"><i cursor class="clean_btn iconfont icon-15qingkong-1"></i></div><p class='err'></p><button cursor class="mtcbtn">提交</button>`;
  let tabsObj = null;
  rightM({
    e,
    title,
    html,
    readyToCloseAll({ e, close }) {
      if (
        tabsObj.list.length === 0 ||
        (tabsObj.list.length === data.length &&
          tabsObj.list.every((item) => data.some((y) => y.id === item.id)))
      ) {
        return true;
      } else {
        _pop({ e, text: '关闭：输入框？' }, (type) => {
          if (type == 'confirm') {
            close(1);
          }
        });
        return false;
      }
    },
    beforeClose() {
      tabsObj.unBindEvent();
    },
    afterRender() {
      const clean = this.content.querySelector('.clean_btn');
      if (data.length > 0) {
        clean.style.display = 'block';
      }
      const tabsWrap = this.content.querySelector('.tabs_wrap');
      tabsObj = new CreateTabs({
        el: tabsWrap,
        data,
        change: (data) => {
          if (data.length > 0) {
            clean.style.display = 'block';
            return;
          }
          clean.style.display = 'none';
        },
        add({ e, add }) {
          opt.add && opt.add({ e, add });
        },
      });
    },
    click({ e, close }) {
      const mtcBtn = _getTarget(this.content, e, '.mtcbtn');
      const cleanBtn = _getTarget(this.content, e, '.clean_btn');
      if (mtcBtn) {
        let errText = '';
        if (opt.verify) {
          errText = opt.verify(tabsObj.list) || '';
        }
        if (!errText) {
          opt.submit && opt.submit({ e, close, data: tabsObj.list });
        } else {
          this.rightBox.style.animation = `tada .5s ease-in-out`;
          _setTimeout(() => {
            this.rightBox.style.animation = `none`;
          }, 500);
        }
        this.content.querySelector('.err').innerText = errText;
      } else if (cleanBtn) {
        tabsObj.list = [];
      }
    },
  });
}
function inpMenu(e, data, callback, title = '', hideCloseBtn, isMask) {
  let str = '';
  const wrapInputList = [];
  let inputs = [];
  const { subText = '提交', items } = data;
  const list = Object.keys(items);
  list.forEach((item) => {
    let {
      type = 'input',
      placeholder = '',
      value = '',
      inputType = 'text',
      beforeText = '',
    } = items[item];
    value += '';
    if (type == 'input') {
      str += `
      <div class="inp_item">
      ${beforeText ? `<div class="title">${encodeHtml(beforeText)}</div>` : ''}
        <div class="inp_box">
        <input class='inp' data-flag="${item}" autocomplete="off" placeholder="${placeholder}" value="${encodeHtml(
        value
      )}" type="${inputType}">
          <i cursor class="clean_btn iconfont icon-guanbi ${
            value.trim() == '' ? '' : 'show'
          }"></i>
        </div>
        <p class='err'></p>
      </div>
      `;
    } else if (type == 'textarea') {
      str += `
      <div class='texta_item'>
      ${beforeText ? `<div class="title">${encodeHtml(beforeText)}</div>` : ''}
      <div class='texta_box'>
      <textarea title='Ctrl+Enter ${subText}' class='texta' data-flag="${item}" autocomplete="off" placeholder="${placeholder}">${encodeHtml(
        value
      )}</textarea>
      <i cursor class="clean_btn iconfont icon-15qingkong-1 ${
        value.trim() == '' ? '' : 'show'
      }"></i>
      </div>
      <p class='err'></p>
      </div>
      `;
    }
  });
  str += `<button cursor class="mtcbtn">${subText}</button>`;
  function getInpValue() {
    return [...inputs].map((item) => item.value.trim());
  }
  let initInpValue = [],
    curInpValue = [];
  function unBindInput() {
    wrapInputList.forEach((item) => {
      item.unBind();
    });
  }
  rightM({
    e,
    title,
    hideCloseBtn,
    html: str,
    beforeClose() {
      unBindInput();
    },
    afterRender() {
      if (isMask) {
        this.rightMask.style.backgroundColor = 'var(--color10)';
      }
      unBindInput();
      inputs = this.content.querySelectorAll('input,textarea');
      if (inputs.length > 0) {
        inputs[0].select();
        inputs[0].focus();
      }
      initInpValue = getInpValue();
      [...inputs].forEach((item) => {
        const key = item.dataset.flag;
        const verify = data.items[key].verify;
        const inpBox = item.parentNode;
        const inpItem = inpBox.parentNode;
        const cleanBtn = inpItem.querySelector('.clean_btn');
        const err = inpItem.querySelector('.err');
        const wInput = wrapInput(item, {
          change(val) {
            if (val.trim() == '') {
              cleanBtn.classList.remove('show');
            } else {
              cleanBtn.classList.add('show');
            }
          },
          focus() {
            inpBox.classList.add('focus');
          },
          blur() {
            inpBox.classList.remove('focus');
            let errText = '';
            if (verify) {
              errText = verify(wInput.getValue()) || '';
            }
            err.innerText = errText;
          },
        });
        wrapInputList.push(wInput);
      });
    },
    readyToCloseAll({ e, close }) {
      if (isMask) {
        return false;
      }
      curInpValue = getInpValue();
      if (
        curInpValue.every((item) => item == '') ||
        initInpValue.toString() == curInpValue.toString()
      ) {
        return true;
      } else {
        _pop({ e, text: '关闭：输入框？' }, (type) => {
          if (type == 'confirm') {
            close(1);
          }
        });
        return false;
      }
    },
    click({ e, close }) {
      const cleanBtn = _getTarget(this.content, e, '.clean_btn');
      const mtcBtn = _getTarget(this.content, e, '.mtcbtn');
      if (mtcBtn) {
        const inp = {};
        let isErr = false;
        [...inputs].forEach((item) => {
          const err = item.parentNode.parentNode.querySelector('.err');
          const key = item.dataset.flag;
          inp[key] = item.value.trim();
          const verify = data.items[key].verify;
          let errText = '';
          if (verify) {
            errText = verify(inp[key]) || '';
            if (errText && !isErr) {
              isErr = true;
            }
          }
          err.innerText = errText;
        });
        if (isErr) {
          this.rightBox.style.animation = `tada .5s ease-in-out`;
          _setTimeout(() => {
            this.rightBox.style.animation = `none`;
          }, 500);
        } else {
          if (!e.isTrusted) {
            e = null;
          }
          curInpValue = getInpValue();
          callback && callback({ e, inp, close });
        }
      } else if (cleanBtn) {
        const inp = cleanBtn.parentNode.firstElementChild;
        inp.value = '';
        inp.focus();
        cleanBtn.classList.remove('show');
      }
    },
    keyup({ e }) {
      const tag = e.target.tagName.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        (tag === 'input' && e.key === 'Enter') ||
        (tag === 'textarea' && ctrl && e.key === 'Enter')
      ) {
        e.preventDefault();
        this.rightMask.querySelector('button').click();
      }
    },
  });
}
function render(data) {
  let str = '';
  data.forEach((item) => {
    const {
      id,
      text = '',
      afterIcon = '',
      afterText = '',
      beforeText = '',
      beforeIcon = beforeText ? '' : 'icon iconfont icon-shoucang',
      active = false,
      pointer = true,
    } = item;
    str += `<div data-id='${encodeHtml(id)}' ${
      pointer ? 'cursor' : ''
    } class='item ${active ? 'active' : ''} ${pointer ? '' : 'stop'}'>
      ${beforeIcon ? `<i class="icon ${beforeIcon}"></i>` : ''}
      ${beforeText ? `<i class="title">${encodeHtml(beforeText)}</i>` : ''}
      <span class='text'>${encodeHtml(text)}</span>
      ${afterText ? `<i class="title">${encodeHtml(afterText)}</i>` : ''}
      ${afterIcon ? `<i class="icon ${afterIcon}"></i>` : ''}
    </div>`;
  });
  return str;
}
function selectMenu(e, data, callback, title = '') {
  function resetMenu(da) {
    const html = render(da);
    r.renderList(html);
  }
  const html = render(data);
  let isOnce = false;
  const r = rightM({
    e,
    html,
    title,
    afterRender() {
      // 定位到当前选中项
      if (isOnce) return;
      isOnce = true;
      const items = this.content.querySelectorAll('.item');
      const curIdx = data.findIndex((item) => item.active);
      if (curIdx < 0) return;
      const cur = items[curIdx];
      if (cur) {
        const t = _position(cur).top;
        _setTimeout(() => {
          this.content.scrollTop = t;
        });
      }
    },
    click({ e, close }) {
      const item = _getTarget(this.content, e, '.item');
      if (item) {
        const id = item.dataset.id;
        const d = data.find((item) => item.id == id);
        callback && callback({ e, close, resetMenu, id, param: d.param || {} });
      }
    },
  });
}
function rightMenu(e, html, callback, title = '') {
  let isOnce = false;
  const loadImg = new LazyLoad();
  rightM({
    e,
    title,
    html,
    beforeClose() {
      loadImg.unBind();
    },
    afterRender() {
      loadImg.bind(this.content.querySelectorAll('img'), (item) => {
        const url = item.getAttribute('data-src');
        imgjz(
          url,
          () => {
            item.src = url;
          },
          () => {
            item.src = loadFailImg;
          }
        );
      });
      if (isOnce) return;
      isOnce = true;
      const items = this.content.querySelectorAll('.item');
      const cur = Array.prototype.find.call(items, (item) =>
        item.className.includes('active')
      );
      if (cur) {
        let t = _position(cur).top;
        _setTimeout(() => {
          this.content.scrollTop = t;
        });
      }
    },
    click({ e, close }) {
      callback && callback({ e, close, box: this.content });
    },
  });
}
function rightInfo(e, text, title) {
  const html = document.createElement('pre');
  html.style.cssText = `
      box-sizing: border-box;
      padding: 10px;
      color: var(--color3);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;`;
  html.innerText = text;
  rightM({
    e,
    title,
    html,
  });
}
const rMenu = {
  rightM,
  selectTabs,
  inpMenu,
  selectMenu,
  rightMenu,
  rightInfo,
};
export default rMenu;
