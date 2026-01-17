import _d from '../../common/config';
import {
  ContentScroll,
  LazyLoad,
  _getTarget,
  _position,
  _setTimeout,
  debounce,
  deepEqual,
  findLastIndex,
  getScreenSize,
  hdTextMsg,
  imgjz,
  isEmail,
  isInteger,
  isValidColor,
  isurl,
  myDrag,
  myResize,
  myToRest,
  savePopLocationInfo,
  toCenter,
  wrapInput,
} from '../../utils/utils';
import './index.less';
import loadFailImg from '../../../images/img/loadfail.png';
import { CreateTabs } from '../../../page/notes/tabs';
import { _tpl, deepClone } from '../../utils/template';
import cacheFile from '../../utils/cacheFile';
import _path from '../../utils/path';
// 右键菜单
let rightBoxList = [];
const updateActiveWindows = debounce(function () {
  rightBoxList.forEach((item) => {
    if (item.rightBox) {
      item.rightBox.classList.add('inactive-window');
    }
  });
  const topWindow = rightBoxList.slice(-1)[0];
  if (topWindow) {
    const { rightBox } = topWindow;
    if (rightBox) {
      rightBox.classList.remove('inactive-window');
    }
  }
}, 100);
class RightM {
  constructor(opt = {}) {
    const defaultOpt = {
      e: null,
      title: '',
      html: '',
      click: null,
      keyup: null,
      searchCallback: null,
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
    this.head.className = 'head window_head';
    if (!this.opt.hideCloseBtn) {
      this.hClose = document.createElement('div');
      this.hClose.className = `iconfont icon-close-bold close`;
      this.hClose.setAttribute('cursor', '');
      this.head.appendChild(this.hClose);
    }
    this.searchBtn = document.createElement('div');
    this.searchBtn.className = 'search_btn iconfont icon-search';
    this.head.appendChild(this.searchBtn);
    this.searchBox = document.createElement('div');
    this.searchBox.className = 'search_box inp_box';
    this.searchInp = document.createElement('input');
    this.searchInp.setAttribute('placeholder', '搜索');
    this.searchInp.setAttribute('autocomplete', 'off');
    this.searchBox.appendChild(this.searchInp);
    this.clearSearchText = document.createElement('i');
    this.clearSearchText.className = 'clear iconfont icon-shibai';
    this.clearSearchText.setAttribute('cursor', 'y');
    this.searchBox.appendChild(this.clearSearchText);
    this.head.appendChild(this.searchBox);
    this.title = document.createElement('div');
    this.title.className = 'title';
    this.title.innerHTML = '<div class="scroll_text no_select"></div>';
    this.head.appendChild(this.title);
    this.content = document.createElement('div');
    this.content.className = 'content';
    this.loading = document.createElement('div');
    this.loading.className = 'loading';
    this.rightBox.appendChild(this.head);
    this.rightBox.appendChild(this.loading);
    this.rightBox.appendChild(this.content);
    this.rightMask.appendChild(this.rightBox);
    document.body.appendChild(this.rightMask);
    if (!this.opt.searchCallback) {
      this.searchBtn.remove();
    }
    this.searchInpWrap = wrapInput(this.searchInp, {
      update: (val) => {
        if (val === '') {
          this.clearSearchText.style.display = 'none';
        } else {
          this.clearSearchText.style.display = 'block';
        }
        this.opt.searchCallback && this.opt.searchCallback('change', val.trim());
      },
      focus: (e) => {
        e.target.parentNode.classList.add('focus');
        this.searchBtn.style.display = 'none';
        this.opt.searchCallback && this.opt.searchCallback('focus', e.target);
      },
      blur: (e) => {
        e.target.parentNode.classList.remove('focus');
        if (this.searchInpWrap.getValue().trim() === '') {
          this.searchBox.style.display = 'none';
          this.searchBtn.style.display = 'block';
        }
        this.opt.searchCallback && this.opt.searchCallback('blur', e.target);
      },
    });
    // 标题滚动
    this.titleScroll = new ContentScroll(this.title.querySelector('.scroll_text'));
    this.titleScroll.init(this.opt.title);
    // 拖拽移动位置
    this.dragClose = myDrag({
      trigger: this.title,
      target: this.rightBox,
      down({ target }) {
        target.style.transition = '0s';
      },
      up({ target, x, y }) {
        const { h, w } = getScreenSize();
        if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
          myToRest(target);
        } else {
          savePopLocationInfo(target, { x, y });
        }
      },
    });
    // 拖拽放大缩小
    this.resizeClose = myResize(
      {
        target: this.rightBox,
        down: ({ target }) => {
          target.style.transition = '0s';
        },
        up: ({ target, x, y }) => {
          savePopLocationInfo(target, {
            x,
            y,
            w: target.offsetWidth,
            h: target.offsetHeight,
          });
        },
      },
      200,
      100,
    );
    this.renderList(this.opt.html);
    this.hdPosition(this.opt.e);
    this.bindEvent();
    this.rightBox.classList.add('open');
  }
  loadStart() {
    if (this.loading) {
      this.loading.style.display = 'block';
    }
  }
  loadEnd() {
    if (this.loading) {
      this.loading.style.display = 'none';
    }
  }
  bindEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.hdKeyup = this.hdKeyup.bind(this);
    this.rightMask.addEventListener('click', this.hdClick);
    this.rightMask.addEventListener('keyup', this.hdKeyup);
  }
  renderList(html) {
    _tpl.html(this.content, html);
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
    savePopLocationInfo(this.rightBox, { w: rw, h: rh });

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
    savePopLocationInfo(this.rightBox, { x, y });
  }
  hdClick(e) {
    const close = this.close.bind(this);
    if (e.target === this.rightMask) {
      if (!this.opt.readyToCloseAll || this.opt.readyToCloseAll.call(this, { e, close })) {
        this.close(1, e);
      }
    } else if (e.target === this.hClose) {
      this.close();
    } else if (e.target === this.searchBtn) {
      this.searchBox.style.display = 'flex';
      this.searchInpWrap.setValue('').focus();
    } else if (e.target === this.clearSearchText) {
      this.searchInpWrap.setValue('').focus();
    } else {
      this.opt.click && this.opt.click.call(this, { e, close });
    }
  }
  hdKeyup(e) {
    this.opt.keyup && this.opt.keyup.call(this, { e, close: this.close.bind(this) });
  }
  close(all, e) {
    if (all) {
      let idx = -1;
      if (e) {
        const ex = e.clientX,
          ey = e.clientY;
        idx = findLastIndex(rightBoxList, (item) => {
          const { x, y, w, h } = item.rightBox.dataset;
          const maxX = +x + +w;
          const maxY = +y + +h;
          return ex >= x && ex <= maxX && ey >= y && ey <= maxY;
        });
      }
      rightBoxList.forEach((item, index) => {
        if (index > idx) {
          item.close();
        }
      });
      return;
    }
    this.opt.beforeClose && this.opt.beforeClose.call(this);
    rightBoxList = rightBoxList.filter((item) => item !== this);
    updateActiveWindows();
    this.dragClose();
    this.resizeClose();
    this.titleScroll.close();
    this.searchInpWrap.unBind();
    this.rightMask.removeEventListener('click', this.hdClick);
    this.rightMask.removeEventListener('keyup', this.hdKeyup);
    this.rightMask.remove();
  }
}
function rightM(opt) {
  const r = new RightM(opt);
  rightBoxList.push(r);
  updateActiveWindows();
  return r;
}
const closeShake = debounce((target) => {
  target.classList.remove('shake');
}, 500);
function shake(target) {
  target.classList.add('shake');
  closeShake(target);
}
function selectTabs(e, data, opt = {}, title = '') {
  const html = `<div class="tabs_wrap"><i cursor="y" class="clean_btn iconfont icon-qingkong-1"></i></div><p class='err'></p><button cursor="y" class="mtcbtn">提交</button>`;
  let tabsObj = null;
  function isDiff() {
    return !deepEqual(
      tabsObj.list.map((item) => item.id),
      data.map((item) => item.id),
    );
  }
  const r = rightM({
    e,
    title,
    html,
    readyToCloseAll({ e, close }) {
      if (isDiff()) {
        pop({ e, text: '关闭：输入框？' }, (type) => {
          if (type === 'confirm') {
            close(1, e);
          }
        });
        return false;
      } else {
        return true;
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
        data: deepClone(data),
        change: (data) => {
          if (data.length > 0) {
            clean.style.display = 'block';
            return;
          }
          clean.style.display = 'none';
        },
        add({ e, add, data }) {
          opt.add && opt.add({ e, add, data });
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
          opt.submit && opt.submit({ e, close, data: tabsObj.list, loading, isDiff });
        } else {
          shake(this.rightBox);
        }
        this.content.querySelector('.err').textContent = errText;
      } else if (cleanBtn) {
        tabsObj.list = [];
      }
    },
  });
  const loading = {
    start() {
      r.loadStart();
    },
    end() {
      r.loadEnd();
    },
  };
}
function inpMenu(e, data, callback, title = '', hideCloseBtn, isMask) {
  const { subText = '提交', items } = data;
  const wrapInputList = [];
  let inputs = [];
  Object.keys(items).forEach((item) => {
    let {
      type = 'input',
      placeholder = '',
      autocomplete = 'off',
      value = '',
      selectItem = [],
      inputType = 'text',
      beforeText = '',
      trimValue = true,
    } = items[item];
    value += '';
    items[item] = {
      ...items[item],
      type,
      placeholder,
      autocomplete,
      value,
      selectItem,
      inputType,
      beforeText,
      trimValue,
    };
  });
  const html = _tpl(
    `
    <template v-for="{type,placeholder,value,selectItem,inputType,beforeText,autocomplete},key in items">
      <div v-if="type === 'input'" class="inp_item">
          <div v-if="beforeText" class="title">{{beforeText}}</div>
          <div class="inp_box">
            <input class='inp' :data-flag="key" :autocomplete="autocomplete" :placeholder="placeholder" :value="value" :type="inputType"/>
            <i v-if="inputType === 'password'" v-show="value !== ''" cursor="y" class="show_pass_btn iconfont icon-kejian"></i>
            <i cursor="y" class="clean_btn iconfont icon-shibai {{value === '' ? '' : 'show'}}"></i>
          </div>
          <p class='err'></p>
        </div>
      <div v-else-if="type === 'textarea'" class='texta_item'>
        <div v-if="beforeText" class="title">{{beforeText}}</div>
        <div class='texta_box'>
          <textarea title='Ctrl+Enter {{subText}}' class='texta' :data-flag="key" :autocomplete="autocomplete" :placeholder="placeholder">{{value}}</textarea>
          <i cursor="y" class="clean_btn iconfont icon-qingkong-1 {{value === '' ? '' : 'show'}}"></i>
        </div>
        <p class='err'></p>
      </div>
      <div v-else-if="type === 'select'" class='select_item'>
        <div v-if="beforeText" class="title">{{beforeText}}</div>
        <div cursor="y" class='select_box' :data-flag="key"><span>{{selectInitValue(selectItem,value)}}</span><i class="iconfont icon-xiala"></i></div>
        <p class='err'></p>
      </div>
    </template>
    <button cursor="y" class="mtcbtn">{{subText}}</button>
    `,
    {
      ...data,
      subText,
      selectInitValue(selectItem, value) {
        const s = selectItem.find((s) => s.value === value);
        return s ? s.text : '';
      },
    },
  );
  function unBindInput() {
    wrapInputList.forEach((item) => {
      item.unBind();
    });
  }
  const initItems = deepClone(items);
  // 与最初值是否不同
  function isDiff() {
    const curItemsArr = [],
      initItemsArr = [];
    Object.keys(items).forEach((key) => {
      curItemsArr.push(items[key]);
      initItemsArr.push(initItems[key]);
    });
    return !deepEqual(
      curItemsArr.map((item) => item.value),
      initItemsArr.map((item) => item.value),
    );
  }
  const r = rightM({
    e,
    title,
    hideCloseBtn,
    html,
    beforeClose() {
      unBindInput();
    },
    afterRender() {
      if (isMask) {
        this.rightMask.style.backgroundColor = 'var(--color10)';
      }
      unBindInput();
      inputs = this.content.querySelectorAll('input,textarea');
      [...inputs].forEach((item) => {
        const key = item.dataset.flag;
        const verify = items[key].verify;
        const keyDown = items[key].keyDown;
        const inpBox = item.parentNode;
        const inpItem = inpBox.parentNode;
        const cleanBtn = inpItem.querySelector('.clean_btn');
        const showPassBtn = inpItem.querySelector('.show_pass_btn');
        const err = inpItem.querySelector('.err');
        const wInput = wrapInput(item, {
          update(val) {
            if (showPassBtn) {
              showPassBtn.style.display = val === '' ? 'none' : 'block';
            }
            if (val === '') {
              cleanBtn.classList.remove('show');
            } else {
              cleanBtn.classList.add('show');
            }
            items[key].value = items[key].trimValue ? val.trim() : val;
          },
          focus() {
            inpBox.classList.add('focus');
          },
          blur() {
            inpBox.classList.remove('focus');
            let errText = '';
            if (verify) {
              errText = verify(items[key].value, items) || '';
            }
            err.textContent = errText;
          },
          keydown(e) {
            keyDown && keyDown({ e, items, value: items[key].value, input: wInput });
          },
        });
        wrapInputList.push(wInput);
      });
      if (inputs.length > 0) {
        inputs[0].select();
        inputs[0].focus();
      }
    },
    readyToCloseAll({ e, close }) {
      if (isMask) {
        return false;
      }
      if (isDiff()) {
        pop({ e, text: '关闭：输入框？' }, (type) => {
          if (type === 'confirm') {
            close(1, e);
          }
        });
        return false;
      } else {
        return true;
      }
    },
    click({ e, close }) {
      const cleanBtn = _getTarget(this.content, e, '.clean_btn');
      const showPassBtn = _getTarget(this.content, e, '.show_pass_btn');
      const mtcBtn = _getTarget(this.content, e, '.mtcbtn');
      const sBox = _getTarget(this.content, e, '.select_box');
      if (mtcBtn) {
        let isErr = false;
        [...inputs].forEach((item) => {
          const err = item.parentNode.parentNode.querySelector('.err');
          const key = item.dataset.flag;
          const verify = items[key].verify;
          let errText = '';
          if (verify) {
            errText = verify(items[key].value, items) || '';
            if (errText && !isErr) {
              isErr = true;
            }
          }
          err.textContent = errText;
        });
        if (isErr) {
          shake(this.rightBox);
        } else {
          if (!e.isTrusted) {
            e = null;
          }
          const inp = {};
          Object.keys(items).forEach((k) => {
            const { value, trimValue } = items[k];
            inp[k] = trimValue ? value.trim() : value;
          });
          callback && callback({ e, inp, close, items, loading, isDiff, submit });
        }
      } else if (cleanBtn) {
        const inp = cleanBtn.parentNode.firstElementChild;
        inp.value = '';
        inp.focus();
        inp.dispatchEvent(new Event('input'));
      } else if (sBox) {
        const key = sBox.dataset.flag;
        const { value, selectItem, beforeText } = items[key];
        const arr = [];
        selectItem.forEach((item, idx) => {
          const obj = {
            id: idx + 1 + '',
            text: item.text,
          };
          if (item.value === value) {
            obj.active = true;
          }
          arr.push(obj);
        });
        selectMenu(
          e,
          arr,
          ({ id, close }) => {
            if (id) {
              const sData = selectItem[id - 1];
              items[key].value = sData.value;
              sBox.querySelector('span').textContent = sData.text;
              close();
            }
          },
          beforeText,
          true,
        );
      } else if (showPassBtn) {
        const inp = showPassBtn.parentNode.firstElementChild;
        if (inp.type === 'password') {
          inp.type = 'text';
          showPassBtn.className = 'show_pass_btn iconfont icon-bukejian';
        } else {
          inp.type = 'password';
          showPassBtn.className = 'show_pass_btn iconfont icon-kejian';
        }
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
  function submit() {
    r.rightMask.querySelector('button').click();
  }
  const loading = {
    start() {
      r.loadStart();
    },
    end() {
      r.loadEnd();
    },
  };
  return submit;
}
function render(data) {
  data = data.map((item) => {
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
    return {
      ...item,
      id,
      text,
      afterIcon,
      afterText,
      beforeText,
      beforeIcon,
      active,
      pointer,
    };
  });
  return _tpl(
    `
    <div v-for="{id,text,afterIcon,afterText,beforeText,beforeIcon,active,pointer} in data" :data-id='id'
     :cursor="pointer || ''" class="item {{active ? 'active' : ''}} {{pointer ? '' : 'stop'}}">
      <i v-if="beforeIcon" class="icon {{beforeIcon}}"></i>
      <i v-if="beforeText" class="title">{{beforeText}}</i>
      <span class='text'>{{text}}</span>
      <i v-if="afterText" class="title">{{afterText}}</i>
      <i v-if="afterIcon" class="icon {{afterIcon}}"></i>
    </div>
    `,
    { data },
  );
}
function selectMenu(e, data, callback, title = '') {
  function resetMenu(da) {
    data = da;
    let val = r.searchInpWrap.getValue().trim();
    let arr = [];
    if (val) {
      val = val.toLowerCase();
      arr = data.filter((item) => item.text.toLowerCase().includes(val));
    } else {
      arr = data;
    }
    const html = render(arr);
    r.renderList(html);
  }
  const html = render(data);
  let isOnce = false;
  const rOpt = {
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
    searchCallback(type) {
      if (type === 'change') {
        resetMenu(data);
      }
    },
    click({ e, close }) {
      const item = _getTarget(this.content, e, '.item');
      if (item) {
        const id = item.dataset.id;
        const d = data.find((item) => item.id === id);
        callback && callback({ e, close, resetMenu, id, param: d.param || {}, loading });
      }
    },
  };
  if (data.length < 10) {
    delete rOpt.searchCallback;
  }
  const r = rightM(rOpt);
  const loading = {
    start() {
      r.loadStart();
    },
    end() {
      r.loadEnd();
    },
  };
}
function rightMenu(e, html, callback, title = '') {
  function resetMenu(html) {
    r.renderList(html);
  }
  let isOnce = false;
  const loadImg = new LazyLoad();
  const r = rightM({
    e,
    title,
    html,
    beforeClose() {
      loadImg.unBind();
    },
    afterRender() {
      const imgs = [...this.content.querySelectorAll('img')].filter((item) => {
        const url = item.getAttribute('data-src');
        if (!url) return false;
        const cache = cacheFile.hasUrl(url, 'image');
        if (cache) {
          item.src = cache;
        }
        return !cache;
      });
      loadImg.bind(imgs, async (item) => {
        imgjz(item.getAttribute('data-src'))
          .then((cache) => {
            item.src = cache;
          })
          .catch(() => {
            item.src = loadFailImg;
          });
      });
      if (isOnce) return;
      isOnce = true;
      const items = this.content.querySelectorAll('.item');
      const cur = Array.prototype.find.call(items, (item) => item.className.includes('active'));
      if (cur) {
        let t = _position(cur).top;
        _setTimeout(() => {
          this.content.scrollTop = t;
        });
      }
    },
    click({ e, close }) {
      callback && callback({ e, close, resetMenu, box: this.content, loading });
    },
  });
  const loading = {
    start() {
      r.loadStart();
    },
    end() {
      r.loadEnd();
    },
  };
}
function rightInfo(e, text, title) {
  const html = _tpl(`<pre v-html="dom" class="right_info"></pre>`, {
    dom: hdTextMsg(text),
  });
  rightM({
    e,
    title,
    html,
  });
}

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
    this.textBox.textContent = this.text;
    this.btns = document.createElement('div');
    this.btns.className = 'btns';
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = `btn btn_${this.cancel.type}`;
    this.cancelBtn.setAttribute('cursor', '');
    this.cancelBtn.textContent = this.cancel.text;
    this.confirmBtn = document.createElement('button');
    this.confirmBtn.style.cssText = `margin-left: 2rem;`;
    this.confirmBtn.className = `btn btn_${this.confirm.type}`;
    this.confirmBtn.setAttribute('cursor', '');
    this.confirmBtn.textContent = this.confirm.text;
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
    rightBoxList = rightBoxList.filter((item) => item !== this);
    updateActiveWindows();
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
function pop(opt, callback) {
  const p = new Pop(opt, callback);
  rightBoxList.push(p);
  updateActiveWindows();
  return p;
}
pop.p = function (opt) {
  return new Promise((resolve) => {
    new Pop(opt, (type) => {
      resolve(type);
    });
  });
};
function percentBar(e, percent, callback) {
  const box = document.createElement('div');
  rightBoxList.push(box);
  updateActiveWindows();
  box.className = 'percent_bar';
  box.style.zIndex = _d.levelObj.percentBar;
  const proBox = document.createElement('div');
  proBox.className = 'pro_box';
  // 显示百分比
  const percentBox = document.createElement('div');
  percentBox.className = 'percent_box';
  // 进度条盒子
  const pro1Box = document.createElement('div');
  pro1Box.className = 'pro1_box';
  // 进度条内遮罩
  const pro2Box = document.createElement('div');
  pro2Box.className = 'pro2_box';
  // 进度条滑块
  const dolt = document.createElement('div');
  dolt.className = 'dolt';
  // 放入body
  pro2Box.appendChild(dolt);
  pro1Box.appendChild(pro2Box);
  proBox.appendChild(percentBox);
  proBox.appendChild(pro1Box);
  box.appendChild(proBox);
  document.body.appendChild(box);
  rikey(e);
  proBox.clientHeight;
  proBox.style.opacity = 1;
  proBox.style.transform = 'none';
  let pro1BoxL; //进度条盒子距离窗口的距离
  const dragClose = myDrag({
    trigger: percentBox,
    target: proBox,
    border: true,
  });
  function rikey(e) {
    const ww = window.innerWidth;
    if (!e) {
      toCenter(proBox);
      return;
    }
    let h = window.innerHeight,
      mtw = proBox.offsetWidth,
      mth = proBox.offsetHeight,
      x = e.clientX,
      y = e.clientY;
    x < ww / 2 ? null : (x = x - mtw);
    y < h / 2 ? null : (y = y - mth);
    x < 0 ? (x = 0) : x + mtw > ww ? (x = ww - mtw) : null;
    y < 0 ? (y = 0) : y + mth > h ? (y = h - mth) : null;
    proBox.style.top = y + 'px';
    proBox.style.left = x + 'px';
    savePopLocationInfo(proBox, { x, y });
  }
  calculationPosition(percent);
  // 计算进度位置
  function calculationPosition(per) {
    per <= 0 ? (per = 0) : per >= 1 ? (per = 1) : null;
    const val = (pro1Box.offsetWidth - dolt.offsetWidth) * per + dolt.offsetWidth / 2;
    pro2Box.style.width = val + 'px';
    percentBox.textContent = parseInt(per * 100) + '%';
  }
  function move(e) {
    percent =
      (e.clientX - pro1BoxL - dolt.offsetWidth / 2) / (pro1Box.offsetWidth - dolt.offsetWidth);
    percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
    calculationPosition(percent);
    callback && callback(percent, 'move');
  }
  // 桌面端
  pro1Box.onmousedown = function (e) {
    pro1BoxL = pro1Box.getBoundingClientRect().left;
    tmove(e);
    function tmove(e) {
      e.preventDefault();
      move(e);
    }
    function up() {
      callback && callback(percent, 'up');
      document.removeEventListener('mousemove', tmove);
      document.removeEventListener('mouseup', up);
    }
    document.addEventListener('mousemove', tmove);
    document.addEventListener('mouseup', up);
  };
  // 移动端
  pro1Box.ontouchstart = function (e) {
    pro1BoxL = pro1Box.getBoundingClientRect().left;
    tmove(e);
    function tmove(e) {
      e.preventDefault();
      const ev = e.changedTouches[0];
      move(ev);
    }
    function up() {
      callback && callback(percent, 'up');
      pro1Box.removeEventListener('touchmove', tmove);
      pro1Box.removeEventListener('touchend', up);
    }
    pro1Box.addEventListener('touchmove', tmove);
    pro1Box.addEventListener('touchend', up);
  };
  box.onwheel = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0) {
      percent -= 0.05;
    } else {
      percent += 0.05;
    }
    percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
    calculationPosition(percent);
    callback && callback(percent, 'wheel');
  };
  box.onclick = function (e) {
    if (e.target === box) {
      rightBoxList = rightBoxList.filter((item) => item !== box);
      updateActiveWindows();
      dragClose();
      pro1Box.onmousedown = null;
      pro1Box.ontouchstart = null;
      box.onwheel = null;
      box.onclick = null;
      box.remove();
    }
  };
}
const rMenu = {
  validString(val, min = 0, max) {
    const len = val.length;

    if (min > 0 && len === 0) return '请输入内容';

    if (max === undefined) {
      if (len < min) return `请输入不小于${min}个字符`;
    } else {
      if (min === max && len !== min) return `请输入${min}个字符`;
      if (len < min || len > max) return `请输入${min}-${max}个字符`;
    }

    return '';
  },
  validAlphanumeric(val) {
    if (!/^[\w]+$/.test(val)) return '请输入只包含数字、字母、下划线的字符';
    return '';
  },
  validNumber(val, min, max) {
    const num = +val;

    // 非数字
    if (val === '' || Number.isNaN(num)) return '请输入数字';

    // 只传 min
    if (min !== undefined && max === undefined) {
      if (num < min) return `请输入不小于${min}的数字`;
      return '';
    }

    // 只传 max
    if (max !== undefined && min === undefined) {
      if (num > max) return `请输入不大于${max}的数字`;
      return '';
    }

    // 同时传 min 和 max
    if (min !== undefined && max !== undefined) {
      if (min === max && num !== min) return `请输入等于${min}的数字`;
      if (num < min || num > max) return `请输入${min}-${max}之间的数字`;
      return '';
    }

    // min 和 max 都未传 → 无限制
    return '';
  },
  validUrl(val) {
    if (!isurl(val)) return '请输入正确的网址';
    return '';
  },
  validColor(val) {
    if (!isValidColor(val)) return '请输入正确的颜色格式';
    return '';
  },
  validMode(val) {
    if (!/^[0-7]{3}$/.test(val)) return '请输入正确的权限码格式';
    return '';
  },
  validInteger(val) {
    if (!isInteger(+val)) return '请输入整数';
    return '';
  },
  validFilename(val) {
    if (!_path.isFilename(val)) return '请输入不包含特殊字符的文件名';
    return '';
  },
  validEmail(val) {
    if (!isEmail(val)) return '请输入正确的邮箱';
    return '';
  },
  pop,
  percentBar,
  rightM,
  selectTabs,
  inpMenu,
  selectMenu,
  rightMenu,
  rightInfo,
};
export default rMenu;
