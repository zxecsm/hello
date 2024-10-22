import $ from 'jquery';
import QRCode from 'qrcode';
import _d from '../common/config';
import { _loadingBar } from '../plugins/loadingBar';
import _msg from '../plugins/message';
import qs from 'qs';
import loadSvg from '../../images/img/loading.svg';
import { reqSearchSplitWord } from '../../api/search';
import rMenu from '../plugins/rightMenu';
import { reqUserFileKey } from '../../api/user';
import { _tpl } from './template';
import _path from './path';
import { UpProgress } from '../plugins/UpProgress';
// 解析url
export function queryURLParams(url) {
  const obj = {};
  url.replace(
    /([^?=&#]+)=([^?=&#]+)/g,
    (...[, $1, $2]) => (obj[decodeURIComponent($1)] = decodeURIComponent($2))
  );
  url.replace(
    /#([^?=&#]+)/g,
    (...[, $1]) => (obj['HASH'] = decodeURIComponent($1))
  );
  return obj;
}
// 跳转
export function myOpen(url, _blank) {
  if (!_blank && !url) return window.location.href;
  const a = document.createElement('a');
  a.href = url;
  _blank && (a.target = '_blank');
  document.body.appendChild(a);
  a.click();
  a.remove();
}
// 本地储存
export function _setData(key, data) {
  data = JSON.stringify({ data });
  localStorage.setItem('hello_' + key, encodeURIComponent(data));
}
export function _setDataTem(key, data, flag = '') {
  data = JSON.stringify({ data });
  sessionStorage.setItem('hello_' + key + flag, encodeURIComponent(data));
}
//本地读取
export function _getData(key) {
  const d = localStorage.getItem('hello_' + key);
  if (d === null) {
    return _d.localStorageDefaultData[key];
  }
  return JSON.parse(decodeURIComponent(d)).data;
}
export function _getDataTem(key, flag = '') {
  const d = sessionStorage.getItem('hello_' + key + flag);
  if (d === null) {
    return d;
  }
  return JSON.parse(decodeURIComponent(d)).data;
}
export function _delData(key) {
  if (key) {
    localStorage.removeItem('hello_' + key);
  } else {
    localStorage.clear();
  }
}
export function _delDataTem(key) {
  if (key) {
    sessionStorage.removeItem('hello_' + key);
  } else {
    sessionStorage.clear();
  }
}
// 定时器
export function _setTimeout(callback, time) {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
    callback();
  }, time);
  return timer;
}
//节流
export function throttle(callback, wait) {
  let timer = null,
    pretime = 0,
    res = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    const now = Date.now(),
      tt = wait - (now - pretime);
    if (tt <= 0) {
      res = callback.call(this, ...args);
      pretime = now;
    } else {
      timer = setTimeout(() => {
        timer = null;
        res = callback.call(this, ...args);
        pretime = now;
      }, tt);
    }
    return res;
  };
}
// 执行一次
export function hdOnce(cb) {
  let isOnce = false;
  return function (...args) {
    if (!isOnce) {
      isOnce = true;
      cb && cb.call(this, ...args);
    }
  };
}
//防抖
export function debounce(callback, wait, immedia) {
  let timer = null,
    res = null;
  return function (...args) {
    if (timer) {
      clearTimeout(timer);
    } else {
      if (immedia) res = callback.call(this, ...args);
    }
    timer = setTimeout(() => {
      timer = null;
      if (!immedia) res = callback.call(this, ...args);
    }, wait);
    return res;
  };
}
// 提示音
export function playSound(src) {
  if (_getData('pmsound')) {
    let sound = document.createElement('audio');
    sound.src = src;
    sound.play();
    sound.onended = function () {
      sound.onended = null;
      sound = null;
    };
  }
}
// 随机数
export function randomNum(x, y) {
  return Math.round(Math.random() * (y - x) + x);
}
// 随机颜色
export function randomColor() {
  return `rgb(${randomNum(0, 255)},${randomNum(0, 255)},${randomNum(0, 255)})`;
}
// 获取选中文本
export function getSelectText() {
  return document.getSelection().toString();
}
// 事件委派获取点击目标
export function _getTarget(target, e, selector, stopPropagation) {
  return getTriggerTarget(e, { target, selector }, stopPropagation);
}
export function getTriggerTarget(e, opt, stopPropagation) {
  const { target = document, selector } = opt;
  let oTarget = e.target;
  const triggers = [...document.querySelectorAll(selector)];
  if (triggers.length === 0) return null;
  if (stopPropagation) {
    return triggers.find((item) => item === oTarget) || null;
  }
  while (oTarget && !triggers.find((item) => item === oTarget)) {
    if (oTarget === target) {
      oTarget = null;
    } else {
      oTarget = oTarget.parentNode;
    }
  }
  return oTarget;
}
// 随机排列数组
export function myShuffle(arr) {
  let m = arr.length,
    t,
    i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }
  return arr;
}
//图片或背景加载完毕后显示
export function loadImg(url) {
  return new Promise((resolve, reject) => {
    const oImg = document.createElement('img');
    oImg.src = url;
    oImg.onload = function () {
      unBind();
      resolve(this);
    };
    oImg.onerror = function () {
      unBind();
      reject(this);
    };
    function unBind() {
      oImg.onload = null;
      oImg.onerror = null;
    }
  });
}
// 图片加载
export function imgjz(url, fn, fnn) {
  loadImg(url)
    .then((img) => {
      fn && fn(img);
    })
    .catch((img) => {
      fnn && fnn(img);
    });
}
// 检查是否为有效的 HTTP/HTTPS URL
export function isurl(url) {
  try {
    const newUrl = new URL(url);
    // 检查协议是否为 http 或 https
    return newUrl.protocol === 'http:' || newUrl.protocol === 'https:'
      ? newUrl
      : false;
  } catch {
    return false; // 捕获错误并返回 false
  }
}
// 拆分字符
export function splitTextType(str, reg, type) {
  const s = [];
  let res = str.match(reg);
  while (res) {
    const idx = res.index;
    s.push({ value: str.slice(0, idx) });
    s.push({ type, value: res[0] });
    str = str.slice(idx + res[0].length);
    res = str.match(reg);
  }
  s.push({ value: str });
  return s;
}
// 提取邮箱、电话、链接
export function hdTextMsg(str) {
  const urlReg = /(http|https|ftp):\/\/[^\s]+/;
  const phoneReg = /1(3|5|6|7|8|9)[0-9]{9}/;
  const emailReg =
    /\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+/;
  const s = [];
  splitTextType(str, urlReg, 'link').forEach((item) => {
    const { type, value } = item;
    if (type === 'link') {
      s.push(item);
    } else if (!type) {
      splitTextType(value, phoneReg, 'tel').forEach((p) => {
        if (p.type === 'tel') {
          s.push(p);
        } else if (!p.type) {
          splitTextType(p.value, emailReg, 'email').forEach((e) => {
            s.push(e);
          });
        }
      });
    }
  });
  return _tpl(
    `
    <template v-for="{type,value} in s">
      <a v-if="type === 'link'" cursor="y" target='_blank' :href='value'>{{value}}</a>
      <a v-else-if="type === 'tel'" cursor="y" href='tel:{{value}}'>{{value}}</a>
      <a v-else-if="type === 'email'" cursor="y" href='mailto:{{value}}'>{{value}}</a>
      <template v-else>{{value}}</template>
    </template>
    `,
    { s }
  );
}
export function mailTo(email) {
  myOpen(`mailto:${email}`);
}
// 大屏
export function isBigScreen() {
  return window.innerWidth > _d.screen;
}
// 判断是否苹果设备
export function isios() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
// 移动端
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
// 数组按属性中英文排序
export function arrSortMinToMax(arr, property) {
  arr.sort((a, b) => {
    return mixedSort(a[property], b[property]);
  });
  return arr;
}
// 混合排序
export function mixedSort(a, b) {
  if (/^\d+/.test(a) && /^\d+/.test(b)) {
    return /^\d+/.exec(a) - /^\d+/.exec(b);
  } else if (isChinese(a) && isChinese(b)) {
    return a.localeCompare(b, 'zh-CN');
  } else {
    return a.localeCompare(b, 'en');
  }
}
// 分页
export function getPaging(list, pageNo, pageSize) {
  const totalPage = Math.ceil(list.length / pageSize) || 1;
  pageNo <= 0 ? (pageNo = totalPage) : pageNo > totalPage ? (pageNo = 1) : null;
  return {
    list: list.slice((pageNo - 1) * pageSize, pageNo * pageSize),
    pageNo,
    pageSize,
    totalPage,
  };
}
// 是否汉字
export function isChinese(str) {
  if (
    /^[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]+/.test(
      str
    )
  ) {
    return true;
  } else {
    return false;
  }
}
// 触控滑动事件
export function _mySlide(options) {
  let { el, up, right, down, left } = options,
    startX,
    startY;
  if (typeof el === 'string') {
    el = document.querySelector(el);
  }
  el.addEventListener('touchstart', handleStart);
  el.addEventListener('mousedown', handleStart);

  function handleStart(e) {
    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      el.addEventListener('touchmove', handleMove);
      el.addEventListener('touchend', handleEnd);
    } else {
      startX = e.clientX;
      startY = e.clientY;
      el.addEventListener('mousemove', handleMove);
      el.addEventListener('mouseup', handleEnd);
    }
  }
  function handleMove(e) {
    let spanX = 0,
      spanY = 0;
    if (e.type === 'touchmove') {
      spanX = e.changedTouches[0].clientX - startX;
      spanY = e.changedTouches[0].clientY - startY;
      if (Math.abs(spanX) > Math.abs(spanY)) {
        //水平方向滑动
        e.preventDefault();
      } else {
        //垂直方向滑动
      }
    }
  }
  function handleEnd(e) {
    let spanX = 0,
      spanY = 0;
    if (e.type === 'touchend') {
      spanX = e.changedTouches[0].clientX - startX;
      spanY = e.changedTouches[0].clientY - startY;
    } else {
      spanX = e.clientX - startX;
      spanY = e.clientY - startY;
    }
    if (Math.abs(spanX) > Math.abs(spanY)) {
      //水平方向滑动
      if (spanX > 30) {
        right && right.call(el, e);
      } else if (spanX < -30) {
        left && left.call(el, e);
      }
    } else {
      //垂直方向滑动
      if (spanY > 30) {
        down && down.call(el, e);
      } else if (spanY < -30) {
        up && up.call(el, e);
      }
    }
    if (e.type === 'touchend') {
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
    } else {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseup', handleEnd);
    }
  }
  return function () {
    el.removeEventListener('touchstart', handleStart);
    el.removeEventListener('mousedown', handleStart);
  };
}
// 长按
export function longPress(target, selector, callback) {
  let timer = null,
    x,
    y,
    cx,
    cy,
    isTrigger = false;
  target.addEventListener('touchstart', hdStart);

  function hdStart(e) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    cx = x = e.touches[0].clientX;
    cy = y = e.touches[0].clientY;
    timer = setTimeout(() => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (Math.abs(x - cx) > 10 || Math.abs(y - cy) > 10 || !isMobile()) return;
      if (selector && callback) {
        const _this = getTriggerTarget(e, { target: this, selector });
        if (_this) {
          callback && callback.call(_this, e);
          isTrigger = true;
        }
      } else {
        selector && selector.call(this, e);
        isTrigger = true;
      }
    }, 800);
    target.addEventListener('touchend', hdEnd);
    target.addEventListener('touchmove', hdMove);
  }
  function hdMove(e) {
    cx = e.changedTouches[0].clientX;
    cy = e.changedTouches[0].clientY;
  }
  function hdEnd(e) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (isTrigger) {
      isTrigger = false;
      e.preventDefault();
    }
    target.removeEventListener('touchend', hdEnd);
    target.removeEventListener('touchmove', hdMove);
  }

  return function unBind() {
    target.removeEventListener('touchstart', hdStart);
  };
}
const reqObj = {
  req: {},
  add(key, xhr) {
    if (this.req.hasOwnProperty(key)) {
      this.req[key].abort();
    }
    this.req[key] = xhr;
  },
  del(key) {
    delete this.req[key];
  },
};
// 请求
export function _postAjax(url, data = {}, opt = {}) {
  const {
    load = true,
    timeout = 0,
    stopErrorMsg = false,
    parallel = false,
  } = opt;
  if (load) {
    _loadingBar.start();
  }
  const k = 'post' + url;
  data = JSON.stringify(data);
  url = `${_d.serverURL}${url}`;
  return new Promise((resolve, reject) => {
    const x = $.ajax({
      type: 'post',
      url: url,
      dataType: 'json',
      contentType: 'application/json;charset=UTF-8',
      data: data,
      timeout: timeout,
      headers: {
        temid: _d.temid,
      },
      xhrFields: {
        withCredentials: true,
      },
      success: (data) => {
        if (!parallel) {
          reqObj.del(k);
        }
        if (load) {
          _loadingBar.end();
        }
        if (data.code === 0) {
          _msg.error(data.codeText);
          reject(data.codeText);
          return;
        } else if (data.code === 2) {
          toLogin();
          return;
        }
        resolve(data);
      },
      error: (err) => {
        if (!parallel) {
          reqObj.del(k);
        }
        if (load) {
          _loadingBar.end();
        }
        if (!stopErrorMsg) {
          if (err.statusText === 'error') {
            _msg.error(`连接失败!( ╯□╰ )`);
          } else if (err.statusText === 'timeout') {
            // _msg.error(`请求超时!( ╯□╰ )`);
          }
        }
        reject(err);
      },
    });
    if (!parallel) {
      reqObj.add(k, x);
    }
  });
}
export function _getAjax(url, data = {}, opt = {}) {
  const {
    load = true,
    timeout = 0,
    stopErrorMsg = false,
    parallel = false,
  } = opt;
  if (load) {
    _loadingBar.start();
  }
  const k = 'get' + url;
  url = `${_d.serverURL}${url}`;
  return new Promise((resolve, reject) => {
    const x = $.ajax({
      type: 'get',
      url: url,
      dataType: 'json',
      contentType: 'application/json;charset=UTF-8',
      data: data,
      headers: {
        temid: _d.temid,
      },
      timeout: timeout,
      xhrFields: {
        withCredentials: true,
      },
      cache: false,
      success: (data) => {
        if (!parallel) {
          reqObj.del(k);
        }
        if (load) {
          _loadingBar.end();
        }
        if (data.code === 0) {
          _msg.error(data.codeText);
          reject(data.codeText);
          return;
        } else if (data.code === 2) {
          toLogin();
          return;
        }
        resolve(data);
      },
      error: (err) => {
        if (!parallel) {
          reqObj.del(k);
        }
        if (load) {
          _loadingBar.end();
        }
        if (!stopErrorMsg) {
          if (err.statusText === 'error') {
            _msg.error(`连接失败!( ╯□╰ )`);
          } else if (err.statusText === 'timeout') {
            // _msg.error(`请求超时!( ╯□╰ )`);
          }
        }
        reject(err);
      },
    });
    if (!parallel) {
      reqObj.add(k, x);
    }
  });
}
// 处理文件名
export function hdFilename(str, fill) {
  return str.replace(/[\\\\/]/gi, fill || '');
}
// 上传文件
export function _upFile(url, data = {}, file, callback) {
  url = `${_d.serverURL}${url}/?${qs.stringify(data)}`;
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('attrname', file);
    $.ajax({
      type: 'post',
      data: formData,
      url,
      headers: {
        temid: _d.temid,
      },
      xhrFields: {
        withCredentials: true,
      },
      contentType: false,
      processData: false,
      xhr: function () {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function (e) {
          //loaded代表上传了多少
          //total代表总数为多少
          const pes = e.loaded / e.total;
          callback && callback(pes);
        });
        return xhr;
      },
      success: (data) => {
        if (data.code === 0) {
          _msg.error(data.codeText);
          reject(data.codeText);
          return;
        } else if (data.code === 2) {
          toLogin();
          return;
        }
        resolve(data);
      },
      error: () => {
        _msg.error(`连接失败!( ╯□╰ )`);
        reject();
      },
    });
  });
}
// 选择文件
export function getFiles(opt = {}) {
  return new Promise((resolve) => {
    const { multiple, accept, webkitdirectory } = opt;
    const oInp = document.createElement('input');
    oInp.type = 'file';
    if (multiple) {
      oInp.multiple = 'multiple';
    }
    if (webkitdirectory) {
      oInp.webkitdirectory = true;
    }
    if (accept) {
      oInp.accept = accept;
    }
    oInp.style.display = 'none';
    document.body.appendChild(oInp);
    oInp.click();
    oInp.addEventListener('change', hdChange);
    oInp.addEventListener('cancel', hdCancel);
    function hdChange(e) {
      const files = [...e.target.files];
      unBind();
      resolve(files);
    }
    function unBind() {
      oInp.removeEventListener('change', hdChange);
      oInp.removeEventListener('cancel', hdCancel);
      oInp.remove();
    }
    function hdCancel() {
      unBind();
      resolve([]);
    }
  });
}
// 读取文件
export function getFileReader(file, type) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    if (type === 'text') {
      fileReader.readAsText(file);
    } else if (type === 'url') {
      fileReader.readAsDataURL(file);
    } else if (type === 'string') {
      fileReader.readAsBinaryString(file);
    } else {
      fileReader.readAsArrayBuffer(file);
    }
    fileReader.onload = function (e) {
      fileReader.onload = null;
      fileReader.onerror = null;
      resolve(e.target.result);
    };
    fileReader.onerror = function (err) {
      fileReader.onload = null;
      fileReader.onerror = null;
      reject(err);
    };
  });
}
// 登录
export function toLogin() {
  _delData('account');
  _setDataTem('originurl', myOpen());
  myOpen('/login');
}
// 格式时间日期
export function formatDate({
  template = '{0}-{1}-{2} {3}:{4}:{5}',
  timestamp = Date.now(),
} = {}) {
  const date = new Date(+timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const weekArr = ['日', '一', '二', '三', '四', '五', '六'];
  const week = weekArr[date.getDay()]; // 直接获取周几

  const timeArr = [year, month, day, hour, minute, second, week];

  return template.replace(/\{(\d+)\}/g, (_, key) => {
    const index = Number(key); // 转换为数字
    return timeArr[index] !== undefined ? timeArr[index] : '';
  });
}
// 选中文本
export function selectText(el) {
  if (document.body.createTextRange) {
    const range = document.body.createTextRange();
    range.moveToElementText(el);
    range.select();
  } else if (window.getSelection) {
    const selection = window.getSelection(),
      range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
// 一键复制
export async function copyText(
  content,
  { success = '复制成功', error = '复制失败', stopMsg = false } = {}
) {
  try {
    // 使用 Clipboard API
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(content);
      if (!stopMsg) {
        _msg.success(success);
      }
    } else {
      throw new Error();
    }
  } catch {
    // 回退到 execCommand 方法
    if (typeof document.execCommand === 'function') {
      fallbackCopyText(content);
      if (!stopMsg) {
        _msg.success(success);
      }
    } else {
      if (!stopMsg) {
        _msg.error(error);
      }
    }
  }
}

function fallbackCopyText(content) {
  const tempDiv = document.createElement('div');
  const selection = window.getSelection();
  const range = document.createRange();

  // 设置临时 div 样式
  tempDiv.innerText = content;
  tempDiv.style.position = 'fixed';
  tempDiv.style.opacity = '0';
  tempDiv.style.pointerEvents = 'none';

  document.body.appendChild(tempDiv);
  range.selectNode(tempDiv);
  selection.removeAllRanges();
  selection.addRange(range);

  document.execCommand('copy');
  selection.removeAllRanges();
  tempDiv.remove();
}
// 文件大小计算
export function computeSize(fsize) {
  fsize = Number(fsize);
  if (isNaN(fsize)) return 0;
  if (fsize >= 1024 * 1024 * 1024) {
    fsize = `${(fsize / 1024 / 1024 / 1024).toFixed(2)}G`;
  } else if (fsize >= 1024 * 1024) {
    fsize = `${(fsize / 1024 / 1024).toFixed(2)}M`;
  } else if (fsize >= 1024) {
    fsize = `${(fsize / 1024).toFixed(2)}kb`;
  } else if (fsize < 1024) {
    fsize = `${fsize.toFixed(2)}b`;
  }
  return fsize;
}
// 转义字符串
export function encodeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '&#92;')
    .replace(/\//g, '&#x2F;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#x3D;');
}
// 遍历
export function _each(obj, callback, context) {
  const isLikeArray =
    Object.prototype.toString.call(obj) === '[object Array]' ||
    ('length' in obj && typeof obj.length === 'number');
  Object.prototype.toString.call(callback) === '[object Function]'
    ? null
    : (callback = Function.prototype);

  if (isLikeArray) {
    const arr = [...obj];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i],
        res = callback.call(context, item, i);
      if (res === false) break;
      if (typeof res === 'undefined') continue;
      arr[i] = res;
    }
    return arr;
  }
  const _obj = { ...obj };
  for (let key in _obj) {
    if (!_obj.hasOwnProperty(key)) break;
    const val = _obj[key],
      res = callback.call(context, val, key);
    if (res === false) break;
    if (typeof res === 'undefined') continue;
    _obj[key] = res;
  }
  return _obj;
}
// 下载配置
export function DownloadJSON(content, filename) {
  content = JSON.stringify(content);
  const eleLink = document.createElement('a');
  eleLink.download = filename || 'hello';
  eleLink.style.display = 'none';
  const blob = new Blob([content]);
  eleLink.href = URL.createObjectURL(blob);
  document.body.appendChild(eleLink);
  eleLink.click();
  document.body.removeChild(eleLink);
}
// id生成
export function nanoid() {
  return (
    'h' +
    Date.now().toString(36) +
    Number(String(Math.random()).slice(2)).toString(36)
  );
}
// 图片尺寸
export async function _imgSize(file) {
  const url = await getFileReader(file, 'url');
  const oImg = await loadImg(url);
  return {
    width: oImg.width,
    height: oImg.height,
  };
}
// 读取深层属性
export function getIn(target, keys) {
  return keys.reduce((obj, key) => (obj ? obj[key] : undefined), target);
}
export function tplReplace(tpl, data) {
  return tpl.replace(/\{\{(.*?)\}\}/g, (_, k) => {
    return (
      getIn(
        data,
        k
          .trim()
          .split('.')
          .filter((item) => item)
      ) || ''
    );
  });
}
// 压缩图片
export function compressionImg(file, x = 400, y = 400) {
  return new Promise(async (resolve, reject) => {
    try {
      const url = await getFileReader(file, 'url');
      const oImg = await loadImg(url),
        canvas = document.createElement('canvas'),
        context = canvas.getContext('2d');
      const originWidth = oImg.width;
      const originHeight = oImg.height;
      // 目标尺寸
      let targetWidth = originWidth,
        targetHeight = originHeight;
      // 图片尺寸超过400x400的限制
      if (originWidth > x || originHeight > y) {
        if (originWidth / originHeight > x / y) {
          // 更宽，按照宽度限定尺寸
          targetWidth = x;
          targetHeight = Math.round(x * (originHeight / originWidth));
        } else {
          targetHeight = y;
          targetWidth = Math.round(y * (originWidth / originHeight));
        }
      }
      // canvas对图片进行缩放
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      // 清除画布
      context.clearRect(0, 0, targetWidth, targetHeight);
      // 图片压缩
      context.drawImage(oImg, 0, 0, targetWidth, targetHeight);
      // canvas转为blob
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}
export function checkedType(target) {
  return Object.prototype.toString.call(target).slice(8, -1);
}
// 获取位置
export function _position(el, relativeToHTML) {
  let top = el.getBoundingClientRect().top,
    left = el.getBoundingClientRect().left;
  if (!relativeToHTML) {
    let p = el.offsetParent;
    top -= _offset(p).top;
    left -= _offset(p).left;
  }
  return {
    top,
    left,
  };
}
// 懒加载
export class LazyLoad {
  constructor() {
    this.options = {
      root: null, //根元素
      rootMargin: '0px', //传值形式类似于css的margin 传一个值则四个边都为0
      threshold: 0.1, //触发条件 表示目标元素刚进入根元素时触发
    };
  }
  bind(els, cb) {
    this.unBind();
    this.visibilityObs = new IntersectionObserver(
      debounce(() => {
        this.load(els, cb);
      }, 100),
      this.options
    );

    this.observeElements(this.visibilityObs, els);
  }
  load(els, cb) {
    this.loadObs = new IntersectionObserver((entries) => {
      entries.forEach((item) => {
        if (item.isIntersecting) {
          this.loadObs.unobserve(item.target);
          item.target.dataset.loaded = true;
          cb && cb(item.target);
        }
      });

      this.loadObs && this.loadObs.disconnect();
    }, this.options);

    this.observeElements(this.loadObs, els);
  }
  observeElements(obs, els) {
    els.forEach((el) => {
      if (!el.dataset.loaded) {
        obs.observe(el);
      }
    });
  }
  unBind() {
    this.visibilityObs && this.visibilityObs.disconnect();
    this.visibilityObs = null;
    this.loadObs && this.loadObs.disconnect();
    this.loadObs = null;
  }
}
// 位置
export function _offset(el) {
  let top = 0,
    left = 0;
  if (el) {
    while (el.nodeName !== 'BODY') {
      top += el.offsetTop;
      left += el.offsetLeft;
      el = el.parentNode;
    }
  }
  return {
    top,
    left,
  };
}
// 跳转
export function _myOpen(url, name) {
  // 在iframe中显示
  if (isIframe()) {
    try {
      parent.window.openInIframe(url, name || url);
      return;
    } catch {}
  }
  myOpen(url, '_blank');
}
// 百分比转换
export function percentToValue(min, max, percnet) {
  percnet < 0 ? (percnet = 0) : percnet > 1 ? (percnet = 1) : null;
  const one = (max - min) / 100;
  return percnet * 100 * one + min;
}
// 百分条
export function _progressBar(e, percent, callback) {
  const box = document.createElement('div');
  box.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: ${_d.levelObj._progressBar};
    `;
  const proBox = document.createElement('div');
  proBox.style.cssText = `
    position: absolute;
    width: 90%;
    max-width: 500px;
    background-color: var(--color10);
    border-radius: 5px;
    display: flex;
    padding: 10px 30px 30px 30px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    flex-flow: column;
    box-shadow: 0 0 5px var(--color5);
    opacity: 0;
    transform: translateY(-20px);
    transition: transform .5s ease-in-out, opacity .5s ease-in-out;
    `;
  // 显示百分比
  const percentBox = document.createElement('div');
  percentBox.style.cssText = `
    width: 100%;
    text-align: center;
    line-height: 50px;
    font-size: 30px;
    `;
  // 进度条盒子
  const pro1Box = document.createElement('div');
  pro1Box.style.cssText = `
    position: relative;
    width: 100%;
    height: 40px;
    background-color: var(--color9);
    overflow: hidden;
    `;
  // 进度条内遮罩
  const pro2Box = document.createElement('div');
  pro2Box.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    height: 40px;
    background-color: var(--color7);
    `;
  // 进度条滑块
  const dolt = document.createElement('div');
  dolt.style.cssText = `
    float: right;
    transform: translateX(50%);
    height: 40px;
    width: 40px;
    background-color: var(--color6);
    `;
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
    proBox._op = { x, y };
  }
  calculationPosition(percent);
  // 计算进度位置
  function calculationPosition(per) {
    per <= 0 ? (per = 0) : per >= 1 ? (per = 1) : null;
    const val =
      (pro1Box.offsetWidth - dolt.offsetWidth) * per + dolt.offsetWidth / 2;
    pro2Box.style.width = val + 'px';
    percentBox.innerText = parseInt(per * 100) + '%';
  }
  function move(e) {
    percent =
      (e.clientX - pro1BoxL - dolt.offsetWidth / 2) /
      (pro1Box.offsetWidth - dolt.offsetWidth);
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
      dragClose();
      pro1Box.onmousedown = null;
      pro1Box.ontouchstart = null;
      box.onwheel = null;
      box.onclick = null;
      box.remove();
    }
  };
}
// 图片格式
export function isImgFile(name) {
  return /(\.jpg|\.jpeg|\.png|\.ico|\.svg|\.webp|\.gif|\.bmp|\.tiff|\.tif|\.jfif|\.heif|\.heic)$/gi.test(
    name
  );
}
// 文件logo类型
export function fileLogoType(fname) {
  if (isImgFile(fname)) {
    return 'icon-tupian';
  } else if (/(\.rmvb|\.3gp|\.mp4|\.m4v|\.avi|\.mkv|\.flv)$/gi.test(fname)) {
    return 'icon-shipin2';
  } else if (/(\.mp3|\.wma|\.wav|\.ape|\.flac|\.ogg|\.aac)$/gi.test(fname)) {
    return 'icon-yinle1';
  } else if (/(\.rar|\.7z|\.zip|\.tar|\.gz)$/gi.test(fname)) {
    return 'icon-yasuobao2';
  } else {
    return 'icon-24gl-fileText';
  }
}

// 下载文件
export function downloadFile(fileUrl, filename) {
  return new Promise((resolve) => {
    filename = filename || _path.basename(fileUrl);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fileUrl, true);
    xhr.responseType = 'blob'; // 设置响应类型为 Blob

    const pro = new UpProgress(filename, 'iconfont icon-download');

    function unbindXHREvents() {
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onprogress = null;
    }
    // 监听进度事件
    xhr.onprogress = function (event) {
      let percentComplete = 0;
      if (event.lengthComputable) {
        percentComplete = event.loaded / event.total;
      } else {
        // 如果总长度不可计算，则尝试从自定义头部获取文件大小
        const fileSize = xhr.getResponseHeader('X-File-Size');
        if (fileSize) {
          percentComplete = event.loaded / +fileSize;
        }
      }
      pro.update(percentComplete);
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename; // 设置下载文件名
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url); // 释放 URL 对象
        unbindXHREvents();
        pro.close('下载完成');
      } else {
        pro.fail('下载失败');
      }
      resolve();
    };

    xhr.onerror = function () {
      unbindXHREvents();
      pro.fail('下载失败');
      resolve();
    };

    xhr.send();
  });
}
// 预览图片
export function imgPreview(arr, idx = 0) {
  let result, //图片宽高
    x, //偏移
    y,
    scale = 1, //缩放
    maxScale = 10, //最大缩放
    minScale = 0.5; //最小缩放//移动状态
  let pointers = [], // 触摸点数组
    point1 = { x: 0, y: 0 }, // 第一个点坐标
    point2 = { x: 0, y: 0 }, // 第二个点坐标
    diff = { x: 0, y: 0 }, // 相对于上一次pointermove移动差值
    lastPointermove = { x: 0, y: 0 }, // 用于计算diff
    lastPoint1 = { x: 0, y: 0 }, // 上一次第一个触摸点坐标
    lastPoint2 = { x: 0, y: 0 }, // 上一次第二个触摸点坐标
    lastCenter; // 上一次中心点坐标
  const box = document.createElement('div');
  box.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  color: #ccc;
  opacity: 0;
  z-index: ${_d.levelObj.imgPreview};
  `;
  const image = document.createElement('img');
  // 禁止移动端默认触摸事件
  image.style.cssText = `
  opacity: 0;
  touch-action: none;
  `;
  image.setAttribute('draggable', 'false');
  const image1 = document.createElement('img');
  image1.style.cssText = `
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: 100%;
  display: none;
  `;
  image1.setAttribute('draggable', 'false');
  box.appendChild(image);
  box.appendChild(image1);
  const pre = document.createElement('div');
  pre.style.cssText = `
  display: none;
  position: absolute;
  left: 10px;
  top: 50%;
  padding: 10px;
  font-size: 40px;
  border-radius: 10px;
  background-color: rgb(0 0 0 / 40%);
  transform: translateY(-50%);
  /*cursor: pointer;*/
  `;
  const next = document.createElement('div');
  next.style.cssText = `
  display: none;
  position: absolute;
  right: 10px;
  top: 50%;
  padding: 10px;
  font-size: 40px;
  border-radius: 10px;
  background-color: rgb(0 0 0 / 40%);
  transform: translateY(-50%);
  /*cursor: pointer;*/
  `;
  const close = document.createElement('div');
  close.style.cssText = `
  position: absolute;
  ${
    _getData('headBtnToRight')
      ? 'right: 0;border-radius: 0 0 0 50%;'
      : 'left: 0;border-radius: 0 0 50% 0;'
  }
  top: 0;
  padding: 10px;
  font-size: 40px;
  background-color: rgb(0 0 0 / 40%);
  /*cursor: pointer;*/
  `;
  const load = document.createElement('div');
  load.style.cssText = `
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url(${loadSvg});
  background-size: 100px 100px;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity .5s ease-in-out;
  z-index: 2;
  `;
  close.className = 'iconfont icon-close-bold';
  pre.className = 'iconfont icon-zuo';
  next.className = 'iconfont icon-you';
  pre.setAttribute('cursor', '');
  next.setAttribute('cursor', '');
  close.setAttribute('cursor', '');
  box.appendChild(pre);
  box.appendChild(next);
  box.appendChild(close);
  box.appendChild(load);
  document.body.appendChild(box);
  box.style.transition = 'opacity .2s ease-in-out';
  box.style.opacity = 1;
  if (arr.length > 1) {
    pre.style.display = 'block';
    next.style.display = 'block';
  }
  function cut(idx) {
    scale = 1;
    image.style.opacity = 0;
    image1.style.display = 'none';
    _loadingBar.end();
    load.style.opacity = 1;
    const { u1, u2 } = arr[idx];
    _loadingBar.start();
    if (u2) {
      image1.src = u2;
      image1.style.display = 'block';
    }
    image.src = u1;
  }
  cut(idx);
  function hdLoad() {
    load.style.opacity = 0;
    result = getImgSize(
      image.naturalWidth,
      image.naturalHeight,
      window.innerWidth,
      window.innerHeight
    );
    image.style.width = result.width + 'px';
    image.style.height = result.height + 'px';
    x = (window.innerWidth - result.width) * 0.5;
    y = (window.innerHeight - result.height) * 0.5;
    image.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) scale(1)';
    image1.style.display = 'none';
    image.style.opacity = 1;
    _loadingBar.end();
  }
  function hdError() {
    _loadingBar.end();
    load.style.opacity = 0;
    image.style.opacity = 0;
    _msg.error('图片加载失败');
  }
  function hdMove(e) {
    if (e.target !== image) return;
    handlePointers(e);
    const current1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    if (pointers.length === 1) {
      diff.x = current1.x - lastPointermove.x;
      diff.y = current1.y - lastPointermove.y;
      lastPointermove = { x: current1.x, y: current1.y };
      x += diff.x;
      y += diff.y;
      image.style.transform =
        'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
    } else if (pointers.length === 2) {
      const current2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      // 计算相对于上一次移动距离比例 ratio > 1放大，ratio < 1缩小
      let ratio =
        getDistance(current1, current2) / getDistance(lastPoint1, lastPoint2);
      // 缩放比例
      const _scale = scale * ratio;
      if (_scale > maxScale) {
        scale = maxScale;
        ratio = maxScale / scale;
      } else if (_scale < minScale) {
        scale = minScale;
        ratio = minScale / scale;
      } else {
        scale = _scale;
      }
      // 计算当前双指中心点坐标
      const center = getCenter(current1, current2);
      // 计算图片中心偏移量，默认transform-origin: 50% 50%
      // 如果transform-origin: 0% 0%，那origin.x = (ratio - 1) * result.width * 0
      // origin.y = (ratio - 1) * result.height * 0
      // 如果transform-origin: 30% 40%，那origin.x = (ratio - 1) * result.width * 0.3
      // origin.y = (ratio - 1) * result.height * 0.4
      const origin = {
        x: (ratio - 1) * result.width * 0.5,
        y: (ratio - 1) * result.height * 0.5,
      };
      // 计算偏移量
      x -= (ratio - 1) * (center.x - x) - origin.x - (center.x - lastCenter.x);
      y -= (ratio - 1) * (center.y - y) - origin.y - (center.y - lastCenter.y);
      image.style.transform =
        'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
      lastCenter = { x: center.x, y: center.y };
      lastPoint1 = { x: current1.x, y: current1.y };
      lastPoint2 = { x: current2.x, y: current2.y };
    }
    e.preventDefault();
  }
  function hdUp() {
    pointers = [];
    box.removeEventListener('pointermove', hdMove);
    box.removeEventListener('pointerup', hdUp);
  }
  function hdClick(e) {
    const target = e.target;
    if (target === pre) {
      idx -= 1;
      idx < 0 ? (idx = arr.length - 1) : null;
      cut(idx);
      return;
    } else if (target === next) {
      idx += 1;
      idx >= arr.length ? (idx = 0) : null;
      cut(idx);
      return;
    } else if (target === close || target === box) {
      closeBox();
    }
  }
  function closeBox() {
    box.removeEventListener('click', hdClick);
    box.removeEventListener('pointerdown', hdDown);
    image.removeEventListener('wheel', hdWheel);
    image.removeEventListener('load', hdLoad);
    image.removeEventListener('error', hdError);
    toHide(
      box,
      {
        to: 'auto',
        scale: 'small',
      },
      () => {
        box.remove();
      }
    );
    _loadingBar.end();
  }
  box.addEventListener('click', hdClick);
  function hdWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    let ratio = 1.1;
    // 缩小
    if (e.deltaY > 0) {
      ratio = 1 / 1.1;
    }
    const _scale = scale * ratio;
    if (_scale > maxScale) {
      ratio = maxScale / scale;
      scale = maxScale;
    } else if (_scale < minScale) {
      ratio = minScale / scale;
      scale = minScale;
    } else {
      scale = _scale;
    }
    // 目标元素是img说明鼠标在img上，以鼠标位置为缩放中心，否则默认以图片中心点为缩放中心
    if (e.target.tagName === 'IMG') {
      const origin = {
        x: (ratio - 1) * result.width * 0.5,
        y: (ratio - 1) * result.height * 0.5,
      };
      // 计算偏移量
      x -= (ratio - 1) * (e.clientX - x) - origin.x;
      y -= (ratio - 1) * (e.clientY - y) - origin.y;
    }
    image.style.transform =
      'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
    e.preventDefault();
  }
  function hdDown(e) {
    // 绑定 pointerup
    box.addEventListener('pointerup', hdUp);
    if (e.target !== image) return;
    pointers.push(e);
    point1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    if (pointers.length === 1) {
      image.setPointerCapture(e.pointerId);
      lastPointermove = { x: pointers[0].clientX, y: pointers[0].clientY };
    } else if (pointers.length === 2) {
      point2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      lastPoint2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      lastCenter = getCenter(point1, point2);
    }
    lastPoint1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    // 绑定 pointermove
    box.addEventListener('pointermove', hdMove);
  }
  // 图片加载完成后再操作，否则naturalWidth为0
  image.addEventListener('load', hdLoad);
  image.addEventListener('error', hdError);
  // 绑定 pointerdown
  box.addEventListener('pointerdown', hdDown);
  // 滚轮缩放
  image.addEventListener('wheel', hdWheel);

  /**
   * 更新指针
   * @param {PointerEvent} e
   * @param {string} type
   */
  function handlePointers(e) {
    for (let i = 0; i < pointers.length; i++) {
      if (pointers[i].pointerId === e.pointerId) {
        pointers[i] = e;
      }
    }
  }

  /**
   * 获取两点间距离
   * @param {object} a 第一个点坐标
   * @param {object} b 第二个点坐标
   * @returns
   */
  function getDistance(a, b) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return Math.hypot(x, y); // Math.sqrt(x * x + y * y);
  }
  /**
   * 获取中点坐标
   * @param {object} a 第一个点坐标
   * @param {object} b 第二个点坐标
   * @returns
   */
  function getCenter(a, b) {
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    return { x: x, y: y };
  }

  /**
   * 获取图片缩放尺寸
   * @param {number} naturalWidth
   * @param {number} naturalHeight
   * @param {number} maxWidth
   * @param {number} maxHeight
   * @returns
   */
  function getImgSize(naturalWidth, naturalHeight, maxWidth, maxHeight) {
    const imgRatio = naturalWidth / naturalHeight;
    const maxRatio = maxWidth / maxHeight;
    let width, height;
    // 如果图片实际宽高比例 >= 显示宽高比例
    if (imgRatio >= maxRatio) {
      if (naturalWidth > maxWidth) {
        width = maxWidth;
        height = (maxWidth / naturalWidth) * naturalHeight;
      } else {
        width = naturalWidth;
        height = naturalHeight;
      }
    } else {
      if (naturalHeight > maxHeight) {
        width = (maxHeight / naturalHeight) * naturalWidth;
        height = maxHeight;
      } else {
        width = naturalWidth;
        height = naturalHeight;
      }
    }
    return { width: width, height: height };
  }
}
// 提取链接
export function getPreUrl() {
  const reg = /^(https?:\/\/)([^\/\#\?]+)/;
  return myOpen().match(reg)[0];
}
// 设置滚动
export function pageScrollTop(top) {
  if (top === undefined) {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }
  // 通用设置滚动位置，适用于所有浏览器
  window.scrollTo({
    top, // 垂直方向滚动的像素数
    left: 0, // 水平方向滚动的像素数
    behavior: 'auto', // 滚动行为'auto' | 'smooth'
  });
}
// 404
export function pageErr() {
  myOpen('/404');
}
// 音乐时长
export function getDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audioElement = new Audio(url);
    audioElement.onloadeddata = function () {
      resolve(audioElement.duration);
    };
    audioElement.onerror = function () {
      reject();
    };
  });
}
// 浏览器通知
export function sendNotification(opt, callback) {
  try {
    // 检查是否支持 Notification API
    if (!('Notification' in window) || Notification.permission === 'denied') {
      return;
    }

    // 创建通知的函数
    function notify() {
      const obj = {
        title: '新通知',
        body: '',
        icon: '',
        ...opt,
      };
      const notification = new Notification(obj.title, {
        icon: obj.icon,
        body: obj.body,
      });
      notification.onclick = function () {
        callback && callback();
      };
    }

    // 根据权限状态发送通知
    if (Notification.permission === 'granted') {
      // 用户已经授权，直接发送通知
      notify();
    } else if (Notification.permission !== 'denied') {
      // 请求权限（使用 Promise 处理）
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          notify();
        }
      });
    }
  } catch {}
}
// 音乐文件
export function isMusicFile(str) {
  return /\.(mp3)$/i.test(str);
}
// 视频文件
export function isVideoFile(str) {
  return /(\.rmvb|\.3gp|\.mp4|\.m4v|\.avi|\.mkv|\.flv)$/i.test(str);
}
// 黑暗模式
export function darkMode(flag) {
  let state = false;
  if (flag === 's') {
    state = isDarkMode();
  } else if (flag === 'y') {
    state = true;
  } else if (flag === 'n') {
    state = false;
  }
  if (state) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
// 改变窗口头部排列
export function changeHeadBtnSort(flag) {
  if (flag) {
    document.documentElement.classList.add('head_btn_to_right');
  } else {
    document.documentElement.classList.remove('head_btn_to_right');
  }
}
// 滚动文本
export class ContentScroll {
  constructor(el) {
    this.el = el;
    this.timer = null;
  }
  init(text) {
    this.text = text ? text.trim().replace(/[\n\r]+/g, ' ') : '';
    this.start();
  }
  start() {
    this.close();
    this.timer = setTimeout(() => {
      clearTimeout(this.timer);
      let cW = this.el.offsetWidth,
        pW = this.el.parentNode.clientWidth,
        differ = cW - pW,
        duration = 0,
        interSpace = pW / 3;
      if (differ > 0) {
        const oI = document.createElement('i');
        oI.innerText = this.text;
        oI.style.marginLeft = interSpace + 'px';
        oI.style.fontStyle = 'normal';
        this.el.appendChild(oI);
        duration = (cW + interSpace) / 24;
        this.el.style.transition = `transform ${duration}s linear`;
        this.el.style.transform = `translateX(${-(cW + interSpace)}px)`;
      }
      this.timer = setTimeout(() => {
        this.start.call(this);
      }, duration * 1000 + 2000);
    }, 2000);
  }
  close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.el.innerText = this.text || '';
    this.el.style.transition = 'transform 0s';
    this.el.style.transform = 'none';
  }
}
// 计算时间
export function getDateDiff(timestamp) {
  // 时间字符串转时间戳
  let minute = 1000 * 60,
    hour = minute * 60,
    day = hour * 24,
    month = day * 30,
    year = day * 365,
    now = new Date().getTime(),
    deffer = now - timestamp,
    result = 'just now';
  if (deffer < 0) {
    return result;
  }
  const yearC = deffer / year,
    monthC = deffer / month,
    weekC = deffer / (7 * day),
    dayC = deffer / day,
    hourC = deffer / hour,
    minC = deffer / minute;
  if (yearC >= 1) {
    result = formatDate({ template: '{0}-{1}-{2}', timestamp: +timestamp });
  } else if (monthC >= 1) {
    result = `${parseInt(monthC)} 个月前`;
  } else if (weekC >= 1) {
    result = `${parseInt(weekC)} 周前`;
  } else if (dayC >= 1) {
    result = `${parseInt(dayC)} 天前`;
  } else if (hourC >= 1) {
    result = `${parseInt(hourC)} 小时前`;
  } else if (minC >= 1) {
    result = `${parseInt(minC)} 分钟前`;
  } else {
    result = '刚刚';
  }
  return result;
}
// 可读时间
export function readableTime(time) {
  const second = 1000,
    minute = second * 60,
    hour = minute * 60,
    day = hour * 24;
  let prefix = '';
  if (time < 0) {
    prefix = '-';
  }
  time = Math.abs(time);
  if (time < hour) {
    return `${prefix || ''}${parseInt(time / minute)}分钟`;
  } else if (time < day) {
    const m = parseInt((time % hour) / minute);
    return `${prefix || ''}${parseInt(time / hour)}小时${
      m > 0 ? `${m}分钟` : ''
    }`;
  } else {
    const h = parseInt((time % day) / hour);
    return `${prefix || ''}${parseInt(time / day)}天${h > 0 ? `${h}小时` : ''}`;
  }
}
// 格式数字
export function formatNum(count, isEn) {
  if (count >= 1e8) {
    return (count / 1e8).toFixed(1) + `${isEn ? 'B' : '亿'}`;
  } else if (count >= 1e4) {
    return (count / 1e4).toFixed(1) + `${isEn ? 'M' : '万'}`;
  } else if (count >= 1e3) {
    return (count / 1e4).toFixed(1) + `${isEn ? 'K' : '千'}`;
  } else {
    return parseInt(count);
  }
}
// 拖动
export function myDrag(opt) {
  opt.target = opt.target || opt.trigger;
  const { trigger, target, create, down, move, up, border, dblclick } = opt;
  create && create({ trigger, target });
  let ol, ot, x, y, pointerX, pointerY;
  function hdDown(e) {
    target.classList.add('jzxz');
    x = target.offsetLeft;
    y = target.offsetTop;
    const l = target.offsetLeft,
      t = target.offsetTop;
    if (e.type === 'touchstart') {
      pointerX = e.touches[0].clientX;
      pointerY = e.touches[0].clientY;
    } else if (e.type === 'mousedown') {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }
    ol = pointerX - l;
    ot = pointerY - t;
    trigger.addEventListener('touchmove', hdMove);
    trigger.addEventListener('touchend', hdUp);
    document.addEventListener('mousemove', hdMove);
    document.addEventListener('mouseup', hdUp);
    down && down({ e, trigger, target, x, y, pointerX, pointerY });
  }
  function hdMove(e) {
    e.preventDefault();
    if (e.type === 'touchmove') {
      pointerX = e.touches[0].clientX;
      pointerY = e.touches[0].clientY;
    } else if (e.type === 'mousemove') {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }
    x = pointerX - ol;
    y = pointerY - ot;
    if (border) {
      const { w, h } = getScreenSize(),
        cW = target.offsetWidth,
        cH = target.offsetHeight;
      x < 0 ? (x = 0) : x > w - cW ? (x = w - cW) : null;
      y < 0 ? (y = 0) : y > h - cH ? (y = h - cH) : null;
    }
    target.style.left = x + 'px';
    target.style.top = y + 'px';
    move && move({ e, trigger, target, x, y, pointerX, pointerY });
  }
  function hdUp(e) {
    target.classList.remove('jzxz');
    target.removeEventListener('touchmove', hdMove);
    target.removeEventListener('touchend', hdUp);
    document.removeEventListener('mousemove', hdMove);
    document.removeEventListener('mouseup', hdUp);
    up && up({ e, trigger, target, x, y, pointerX, pointerY });
  }
  function hdDblclick(e) {
    dblclick && dblclick({ e, trigger, target, x, y, pointerX, pointerY });
  }
  trigger.addEventListener('dblclick', hdDblclick);
  trigger.addEventListener('mousedown', hdDown);
  trigger.addEventListener('touchstart', hdDown);
  return function () {
    trigger.removeEventListener('mousedown', hdDown);
    trigger.removeEventListener('touchstart', hdDown);
    trigger.removeEventListener('dblclick', hdDblclick);
  };
}
// 滚动状态
export function scrollState(target, cb) {
  let t = 0;
  function hdScroll() {
    let s = 0;
    if (target === window) {
      s = pageScrollTop();
    } else {
      s = target.scrollTop;
    }
    if (s > t) {
      cb && cb({ target, type: 'up' });
    } else if (s < t) {
      cb && cb({ target, type: 'down' });
    }
    t = s;
  }
  target.addEventListener('scroll', hdScroll);
  return function () {
    target.removeEventListener('scroll', hdScroll);
  };
}
// 窗口居中
export function toCenter(el, obj) {
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return;
  if (obj) {
    const { left, top } = obj;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el._op = {
      x: left,
      y: top,
    };
  } else {
    const { w, h } = getScreenSize(),
      cw = el.offsetWidth,
      ch = el.offsetHeight,
      x = (w - cw) / 2,
      y = (h - ch) / 2;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el._op = {
      x,
      y,
    };
  }
}
// 窗口尺寸
export function getScreenSize() {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
  };
}
// 窗口大小设置
export function toSetSize(target, maxW = 900, maxH = 800) {
  // maxW = randomNum(maxW - 100, maxW + 100);
  // maxH = randomNum(maxH - 100, maxH + 100);
  const { w: ww, h: wh } = getScreenSize();
  let w, h;
  if (ww <= _d.screen) {
    h = wh;
    w = ww;
  } else {
    const diffH = Math.abs(wh - maxH),
      diffW = Math.abs(ww - maxW);
    h = wh > maxH ? (diffH > 60 ? maxH : wh - 60) : wh - 60;
    w = ww > maxW ? (diffW > 60 ? maxW : ww - 60) : ww - 60;
  }
  target.style.width = w + 'px';
  target.style.height = h + 'px';
  target._os = { w, h };
}
// 窗口全屏
export function myToMax(target) {
  const { w, h } = getScreenSize();
  target.style.transition =
    'left 0.5s ease-in-out, top 0.5s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out';
  target.style.top = 0 + 'px';
  target.style.left = 0 + 'px';
  target.style.width = w + 'px';
  target.style.height = h + 'px';
}
// 全屏状态
export function isFullScreen(target) {
  const { w, h } = getScreenSize();
  const fw = target.offsetWidth,
    fh = target.offsetHeight;
  return w <= fw && h <= fh;
}
// 重置位置
export function myToRest(target, pointerX) {
  let { x = 0, y = 0 } = target._op;
  let { w = 0, h = 0 } = target._os;
  target.style.transition =
    'left 0.5s ease-in-out, top 0.5s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out';
  // 如果是全屏
  if (pointerX && isFullScreen(target)) {
    let pes = (pointerX - x) / target.offsetWidth;
    x = pointerX - w * pes;
    target._op.x = x;
  }
  target.style.top = y + 'px';
  target.style.left = x + 'px';
  target.style.width = w + 'px';
  target.style.height = h + 'px';
}
// 调整窗口大小
export function myResize(opt, minW = 200, minH = 200) {
  let flag;
  const borderWidth = 5,
    jWidth = 8,
    zIndex = 999;
  const { target, down, move, up } = opt;
  target.style.minWidth = minW + 'px';
  target.style.minHeight = minH + 'px';
  const trigger1 = document.createElement('div');
  trigger1.className = 'nwse-resize';
  trigger1.style.cssText = `
  position: absolute;
  top: 0px;
  left: 0px;
  width: ${jWidth}px;
  height: ${jWidth}px;
  border-radius: 0 0 ${jWidth}px ;
  z-index: ${zIndex};
  `;
  const trigger2 = document.createElement('div');
  trigger2.className = 'nesw-resize';
  trigger2.style.cssText = `
  position: absolute;
  top: 0px;
  right: 0px;
  width: ${jWidth}px;
  height: ${jWidth}px;
  border-radius: 0 0 0 ${jWidth}px;
  z-index: ${zIndex};
  `;
  const trigger3 = document.createElement('div');
  trigger3.className = 'nwse-resize';
  trigger3.style.cssText = `
  position: absolute;
  right: 0px;
  bottom: 0px;
  width: ${jWidth}px;
  height: ${jWidth}px;
  border-radius: ${jWidth}px 0 0;
  z-index: ${zIndex};
  `;
  const trigger4 = document.createElement('div');
  trigger4.className = 'nesw-resize';
  trigger4.style.cssText = `
  position: absolute;
  bottom: 0px;
  left: 0px;
  width: ${jWidth}px;
  height: ${jWidth}px;
  border-radius: 0 ${jWidth}px 0 0;
  z-index: ${zIndex};
  `;
  const trigger5 = document.createElement('div');
  trigger5.className = 'ns-resize';
  trigger5.style.cssText = `
  position: absolute;
  top: 0px;
  left: 0px;
  width: 100%;
  height: ${borderWidth}px;
  z-index: ${zIndex};
  `;
  const trigger6 = document.createElement('div');
  trigger6.className = 'ew-resize';
  trigger6.style.cssText = `
  position: absolute;
  top: 0px;
  right: 0px;
  width: ${borderWidth}px;
  height: 100%;
  z-index: ${zIndex};
  `;
  const trigger7 = document.createElement('div');
  trigger7.className = 'ns-resize';
  trigger7.style.cssText = `
  position: absolute;
  bottom: 0px;
  left: 0px;
  width: 100%;
  height: ${borderWidth}px;
  z-index: ${zIndex};
  `;
  const trigger8 = document.createElement('div');
  trigger8.className = 'ew-resize';
  trigger8.style.cssText = `
  position: absolute;
  top: 0px;
  left: 0px;
  width: ${borderWidth}px;
  height: 100%;
  z-index: ${zIndex};
  `;
  const triggerArr = [
    trigger5,
    trigger6,
    trigger7,
    trigger8,
    trigger1,
    trigger2,
    trigger3,
    trigger4,
  ];
  triggerArr.forEach((item) => {
    target.appendChild(item);
  });
  let x, y, w, h, ol, ot;
  function hdDown(e) {
    e.stopPropagation();
    target.classList.add('jzxz');
    w = target.offsetWidth;
    h = target.offsetHeight;
    ol = target.offsetLeft;
    ot = target.offsetTop;
    if (e.type === 'touchstart') {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    flag = this;
    this.addEventListener('touchmove', hdMove);
    document.addEventListener('mousemove', hdMove);
    this.addEventListener('touchend', hdUp);
    document.addEventListener('mouseup', hdUp);
    down && down(target);
  }
  function hdMove(e) {
    e.preventDefault();
    let cx, cy;
    let ww = window.innerWidth,
      wh = window.innerHeight;
    if (e.type === 'touchmove') {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    cx < 0 ? (cx = 0) : cx > ww ? (cx = ww) : null;
    cy < 0 ? (cy = 0) : cy > wh ? (cy = wh) : null;
    const diffX = cx - x,
      diffY = cy - y;
    x = cx;
    y = cy;
    if (flag === trigger1) {
      w -= diffX;
      h -= diffY;
      if (w > minW) {
        ol += diffX;
        target.style.left = ol + 'px';
      }
      if (h > minH) {
        ot += diffY;
        target.style.top = ot + 'px';
      }
    } else if (flag === trigger2) {
      w += diffX;
      h -= diffY;
      if (h > minH) {
        ot += diffY;
        target.style.top = ot + 'px';
      }
    } else if (flag === trigger3) {
      w += diffX;
      h += diffY;
    } else if (flag === trigger4) {
      w -= diffX;
      h += diffY;
      if (w > minW) {
        ol += diffX;
        target.style.left = ol + 'px';
      }
    } else if (flag === trigger5) {
      h -= diffY;
      if (h > minH) {
        ot += diffY;
        target.style.top = ot + 'px';
      }
    } else if (flag === trigger6) {
      w += diffX;
    } else if (flag === trigger7) {
      h += diffY;
    } else if (flag === trigger8) {
      w -= diffX;
      if (w > minW) {
        ol += diffX;
        target.style.left = ol + 'px';
      }
    }

    if (w > minW) {
      target.style.width = w + 'px';
    }
    if (h > minH) {
      target.style.height = h + 'px';
    }
    move && move(target);
  }
  function hdUp() {
    target.classList.remove('jzxz');
    this.removeEventListener('touchmove', hdMove);
    document.removeEventListener('mousemove', hdMove);
    this.removeEventListener('touchend', hdUp);
    document.removeEventListener('mouseup', hdUp);
    up && up(target);
  }
  triggerArr.forEach((item) => {
    item.addEventListener('mousedown', hdDown);
    item.addEventListener('touchstart', hdDown);
  });
  return function () {
    triggerArr.forEach((item) => {
      item.removeEventListener('mousedown', hdDown);
      item.removeEventListener('touchstart', hdDown);
    });
  };
}
// 窗口隐藏
export function toHide(el, opt, cb) {
  const { to, scale, speed = 500, useVisibility } = opt;
  let tran = '';
  let s = '';
  if (to === 'right') {
    tran = `translateX(100%)`;
  } else if (to === 'left') {
    tran = `translateX(-100%)`;
  } else if (to === 'top') {
    tran = `translateY(-100%)`;
  } else if (to === 'bottom') {
    tran = `translateY(100%)`;
  } else if (to === 'auto') {
    tran = `translate${randomNum(1, 10) % 2 ? 'Y' : 'X'}(${
      randomNum(1, 10) % 2 ? '-' : ''
    }100%)`;
  }
  if (scale === 'big') {
    s = `scale(${2})`;
  } else if (scale === 'small') {
    s = `scale(${0})`;
  } else if (scale === 'auto') {
    s = `scale(${randomNum(1, 10) % 2 ? 1 : 2})`;
  }
  const second = speed / 1000;
  el.style.transition = `transform ${second}s ease-in-out, opacity ${second}s ease-in-out`;
  el.style.transform = `${tran} ${s}`;
  el.style.opacity = 0;
  _setTimeout(() => {
    el.style.transition = '0s';
    el.style.transform = 'none';
    el.style.opacity = 1;
    if (useVisibility) {
      el.style.visibility = 'hidden';
    } else {
      el.style.display = 'none';
    }
    cb && cb(el);
  }, speed);
}
// 二维码
export async function showQcode(e, text, title = '展示二维码') {
  try {
    if (text.trim() === '') {
      throw '请输入需要生成的内容';
    }
    const url = await QRCode.toDataURL(text, { width: 500, height: 500 });
    const html = _tpl(
      `<img style="width:250px;height:250px" data-src="{{url}}"/>
        <div cursor="y" class="item" title="点击复制">{{text}}</div>`,
      {
        url,
        text,
      }
    );
    rMenu.rightMenu(
      e,
      html,
      function ({ e, box }) {
        const item = _getTarget(box, e, '.item');
        if (item) {
          copyText(item.innerText);
        }
      },
      title
    );
  } catch (error) {
    _msg.error('生成失败');
    throw error;
  }
}
// 最小值索引
export function getMinIndex(arr) {
  return arr.reduce(
    (minIndex, current, index) => (current <= arr[minIndex] ? index : minIndex),
    0
  );
}
// 加载图
const oImg = (function () {
  const oImg = document.createElement('img');
  oImg.src = loadSvg;
  oImg.style.cssText = `width: 40px;padding: 10px;pointer-events: none;`;
  return oImg;
})();
export function loadingImg(el) {
  el.innerHTML = '';
  el.appendChild(oImg);
}
// 转义正则符号
export function encodeStr(keyword) {
  return keyword.replace(
    /[\[\(\$\^\.\]\*\\\?\+\{\}\\|\)]/gi,
    (key) => `\\${key}`
  );
}
// 搜索词所在索引
export function getWordIdx(splitWord, content) {
  if (splitWord.length === 0) return [];
  let regStr = '(';
  splitWord.forEach((item, idx) => {
    if (idx > 0) {
      regStr += '|';
    }
    regStr += encodeStr(item);
  });
  regStr += ')';
  const reg = new RegExp(regStr, 'ig');
  const res = [];
  content.replace(reg, (...[, $1, $2]) => {
    res.push({
      word: $1,
      start: $2,
      end: $2 + $1.length - 1,
    });
  });
  return res;
}
// 提取包含搜索词的内容
export function getWordContent(splitWord, content) {
  const arr = getWordIdx(splitWord, content);
  if (arr.length < 1) return [];
  const res = [],
    oneS = arr[0].start,
    oneE = arr[0].end;
  res.push({
    type: 'text',
    value: content.slice(0, oneS),
  });
  res.push({ type: 'word', value: content.slice(oneS, oneE + 1) });
  if (arr.length > 1) {
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1],
        item = arr[i];
      const prevE = prev.end,
        itemS = item.start,
        itemE = item.end;
      if (itemS <= prevE) {
        if (itemE < prevE) {
          item.end = prevE;
        } else {
          res.push({
            type: 'word',
            value: content.slice(prevE + 1, itemE + 1),
          });
        }
      } else {
        res.push({ type: 'text', value: content.slice(prevE + 1, itemS) });
        res.push({ type: 'word', value: content.slice(itemS, itemE + 1) });
      }
    }
  }
  const lastE = arr[arr.length - 1].end;
  res.push({ type: 'text', value: content.slice(lastE + 1) });
  return res;
}
// 包含搜索词数
export function getWordCount(splitWord, content) {
  if (splitWord.length === 0) return 0;
  const lowerContent = content.toLowerCase();
  return splitWord.reduce((pre, item, idx) => {
    const lowerItem = item.toLowerCase();
    if (lowerContent.includes(lowerItem)) {
      if (idx === 0) {
        pre += 10;
      } else {
        pre++;
      }
    }
    return pre;
  }, 0);
}
// 高亮搜索
export function hdTitleHighlight(
  splitWord,
  content,
  color = 'var(--btn-danger-color)'
) {
  const con = getWordContent(splitWord, content);
  return _tpl(
    `
    <template v-if="splitWord.length === 0 || con.length === 0">{{content}}</template>
    <template v-else>
      <template  v-for="{type,value} in con">
        <template v-if="type === 'text'">{{value}}</template>
        <template v-else-if="type === 'icon'">...</template>
        <span v-else-if="type === 'word'" :style="{color}">{{value}}</span>
      </template>
    </template>
    `,
    { con, color, content, splitWord }
  );
}
// 分词
export async function getSplitWord(str) {
  let words = [];
  str = str.trim();
  if (!str) return words;
  try {
    const intl = new Intl.Segmenter('cn', { granularity: 'word' });
    words = [...intl.segment(str)].map((item) => item.segment.trim());
  } catch {
    try {
      const res = await reqSearchSplitWord({ word: str });
      if (res.code === 1) {
        return res.data;
      }
    } catch {
      words = str.split(' ');
    }
  }
  words.unshift(str);
  const obj = {};
  return words.reduce((pre, item) => {
    if (item && !obj.hasOwnProperty(typeof item + item)) {
      obj[typeof item + item] = true;
      pre.push(item);
    }
    return pre;
  }, []);
}
// 去重
export function unique(arr, keys) {
  const obj = {};
  return arr.filter((item) => {
    if (keys) {
      keys.forEach((k) => {
        item = item[k];
      });
    }
    return obj.hasOwnProperty(typeof item + item)
      ? false
      : (obj[typeof item + item] = true);
  });
}
export function isIframe() {
  return self != top;
}
// 包装input
export function wrapInput(target, opt) {
  const { change, focus, blur, keyup, keydown, input, update } = opt;

  const eventHandlers = {
    input: (e) => {
      input?.(e);
      update?.(target.value);
    },
    change: (e) => change?.(e),
    focus: (e) => focus?.(e),
    blur: (e) => blur?.(e),
    keyup: (e) => keyup?.(e),
    keydown: (e) => keydown?.(e),
  };

  // 绑定事件，input 必须绑定，其他事件根据是否传递回调函数来绑定
  Object.keys(eventHandlers).forEach((event) => {
    if (event === 'input' || opt[event]) {
      target.addEventListener(event, eventHandlers[event]);
    }
  });

  return {
    setValue(val) {
      target.value = val;
      update?.(target.value);
      return this;
    },
    getValue() {
      return target.value;
    },
    unBind() {
      Object.keys(eventHandlers).forEach((event) => {
        if (event === 'input' || opt[event]) {
          target.removeEventListener(event, eventHandlers[event]);
        }
      });
    },
    target,
    focus() {
      target.focus();
      return this;
    },
    select() {
      target.select();
      return this;
    },
  };
}

// 解析书签
export function parseBookmark(node) {
  const res = [];
  function walk(node, list) {
    const els = node.children;
    if (els.length > 0) {
      for (let i = 0; i < els.length; i++) {
        const item = els[i];
        const iTagName = item.tagName;
        if (iTagName === 'P' || iTagName === 'H3') {
          continue;
        }
        if (iTagName === 'DT') {
          let child = {};
          const oH3 = item.querySelector('h3');
          const oDl = item.querySelector('dl');
          if (oH3 || oDl) {
            child = {
              title: oH3 ? oH3.innerText : '',
              folder: true,
              children: [],
            };
            walk(oDl, child.children);
          } else {
            const oA = item.querySelector('a');
            child = {
              title: oA ? oA.innerText : '',
              link: oA ? oA.href : '',
              des: oA ? oA.dataset.des || '' : '',
            };
          }
          list.push(child);
        } else if (iTagName === 'DL') {
          walk(item, list);
        }
      }
    }
  }
  walk(node, res);
  return res;
}
// 读取书签
export function getbookmark(str) {
  // 创建iframe
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  iframe.style.display = 'none';
  iframe.contentWindow.document.documentElement.innerHTML = str;
  const root = iframe.contentWindow.document.querySelector('dl');
  const res = parseBookmark(root);
  iframe.remove();
  return res;
}
// 文字logo
export function getTextImg(name, size = 400) {
  const s = name ? name[0] : '无';
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.font = size * 0.5 + 'px Arial';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(s, size / 2, size / 1.9);
  return cvs.toDataURL('image/png', 1);
}
// 上传配置
export async function upStr() {
  const files = await getFiles();
  if (files.length === 0) return '';
  const file = files[0];
  const text = await getFileReader(file, 'text');
  return text;
}
// 下载配置
export function downloadText(content, filename) {
  const eleLink = document.createElement('a');
  eleLink.download = filename;
  eleLink.style.display = 'none';
  // 字符内容转变成blob地址
  const blob = new Blob([content]);
  eleLink.href = URL.createObjectURL(blob);
  // 触发点击
  document.body.appendChild(eleLink);
  eleLink.click();
  // 然后移除
  document.body.removeChild(eleLink);
}
// 切换分页
export function creatSelect(e, opt, callback) {
  let { active = '', data } = opt;
  data = data.map((item) => ({
    id: item + '',
    param: { value: item },
    text: `${item}/页`,
    active: item === active ? true : false,
  }));
  rMenu.selectMenu(e, data, function ({ id, close, resetMenu, param }) {
    if (id) {
      data.forEach((item) => {
        if (item.id === id) {
          item.active = true;
        } else {
          item.active = false;
        }
      });
      resetMenu(data);
      callback && callback({ value: param.value, close });
    }
  });
}
// 跳转分页
export function inputPageNo(e, opt, callback) {
  const { subText = 'Go', value = '' } = opt;
  rMenu.inpMenu(
    e,
    {
      subText,
      items: {
        num: {
          value,
          inputType: 'number',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0) {
              return '请输入正整数';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const val = parseInt(inp.num);
        if (isNaN(val)) return;
        close();
        callback && callback(Math.abs(val));
      },
      1000,
      true
    )
  );
}
// 分享
export function createShare(e, opt, cb) {
  const {
    subText = '提交',
    title = '',
    name = '',
    expireTime = 0,
    pass = '',
  } = opt;
  rMenu.inpMenu(
    e,
    {
      subText,
      items: {
        title: {
          value: name,
          inputType: 'text',
          beforeText: '分享名称：',
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLenght.title) {
              return '名称过长';
            }
          },
        },
        expireTime: {
          value: expireTime,
          placeholder: '0：代表永久；负数：代表过期',
          inputType: 'number',
          beforeText: '过期时间（天）：',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val > _d.fieldLenght.expTime) {
              return `最大限制${_d.fieldLenght.expTime}`;
            }
          },
        },
        pass: {
          value: pass,
          inputType: 'password',
          beforeText: '提取码：',
          placeholder: '为空则不设置提取码',
          verify(val) {
            if (val.length > _d.fieldLenght.sharePass) {
              return '提取码过长';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        cb && cb({ close, inp });
      },
      1000,
      true
    ),
    title
  );
}
// 过期
export function isValidShare(t) {
  return t != 0 && t <= Date.now();
}
// 计算过期天数
export function getExpState(t) {
  const time = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (t === 0) {
    return 0;
  } else if (t <= time) {
    return Math.floor((t - time) / day);
  } else if (t > time) {
    return Math.ceil((t - time) / day);
  }
}
// 验证提取码
export function enterPassCode(cb) {
  rMenu.inpMenu(
    false,
    {
      items: {
        pass: {
          placeholder: '请输入提取码',
          beforeText: '提取码：',
          inputType: 'password',
          verify(val) {
            if (val.length === 0) {
              return '请输入提取码';
            } else if (val.length > _d.fieldLenght.sharePass) {
              return '提取码过长';
            }
          },
        },
      },
    },
    debounce(
      ({ close, inp }) => {
        cb && cb({ close, val: inp.pass });
      },
      1000,
      true
    ),
    0,
    1,
    1
  );
}
// 生成文件路径
export function getFilePath(p, t) {
  p = _path.normalize('/' + p);
  return `${_d.mediaURL}/?${qs.stringify({ p, t })}`;
}
// 格式歌曲时间
export function formartSongTime(time) {
  time = parseInt(time);
  if (time < 60) {
    return `00:${time.toString().padStart(2, '0')}`;
  }
  const ot = parseInt(time / 60)
      .toString()
      .padStart(2, '0'),
    oh = parseInt(time % 60)
      .toString()
      .padStart(2, '0');
  return `${ot}:${oh}`;
}
// 整数
export function isInteger(obj) {
  return Math.floor(obj) === obj;
}
export function isRoot() {
  return _getData('account') === 'root';
}
export function isLogin() {
  return _getData('account');
}
// 用户选项
export function userLogoMenu(e, account, username, email) {
  const acc = _getData('account');
  let data = [];
  if (!isIframe()) {
    data.push({
      id: '5',
      text: '主页',
      beforeIcon: 'iconfont icon-zhuye',
    });
  }
  if (account !== acc) {
    data.push({
      id: '1',
      text: '@ ' + username,
      beforeIcon: 'iconfont icon-zhanghao',
    });
    if (email) {
      data.push({
        id: '6',
        text: '邮箱',
        beforeIcon: 'iconfont icon-youxiang',
      });
    }
  }
  data = [
    ...data,
    { id: '2', text: '笔记本', beforeIcon: 'iconfont icon-mingcheng-jiluben' },
    { id: '3', text: '书签夹', beforeIcon: 'iconfont icon-shuqian' },
  ];
  if (!isIframe()) {
    data.push({ id: '4', text: '音乐库', beforeIcon: 'iconfont icon-yinle1' });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      close();
      let url = '';
      if (id === '2') {
        url = `/notes/?acc=${encodeURIComponent(account)}`;
        if (isIframe()) {
          _myOpen(url, username + '的笔记本');
        } else {
          myOpen(url);
        }
      } else if (id === '1') {
        url = `/?c=${encodeURIComponent(account)}`;
        if (isIframe()) {
          myOpen(url, '_blank');
        } else {
          myOpen(url);
        }
      } else if (id === '3') {
        url = `/bmk?acc=${encodeURIComponent(account)}`;
        if (isIframe()) {
          _myOpen(url, username + '的书签夹');
        } else {
          myOpen(url);
        }
      } else if (id === '4') {
        url = `/?p=open`;
        if (isIframe()) {
          myOpen(url, '_blank');
        } else {
          myOpen(url);
        }
      } else if (id === '5') {
        url = `/`;
        if (isIframe()) {
          myOpen(url, '_blank');
        } else {
          myOpen(url);
        }
      } else if (id === '6') {
        mailTo(email);
      }
    },
    `来自于：${username}`
  );
}
// 笔记字数、阅读时长计算
export function noteReadInfo(str) {
  str = str
    .replace(/[a-zA-Z]+/g, 'h') // 把连续出现的字母计算为一个字
    .replace(
      /[`·~!！@#$￥%^……&*()（）\-_——\+=\[\]【】\\\、|;；:：'‘’"“”,，.。<>《》\/?？\s\n\r]/g,
      ''
    ); // 删除所有标点符号和空格换行
  const word = str.length;
  const time = Math.round(word / 400);
  return {
    time: time > 1 ? time : 1,
    word,
  };
}
// 文件名验证
export function isFilename(name) {
  return !/[?\\\\/<>*|]/g.test(name);
}
// 创建一个切换状态函数
export function createStateSwitch(cb, state = false) {
  function fn() {
    state = !state;
    cb && cb(state);
  }
  fn.setState = function (val) {
    state = !!val;
  };
  fn.getState = function () {
    return state;
  };
  return fn;
}
export function isDarkMode() {
  return (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}
// 验证邮箱
export function isEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}
// 验证日期
export function isValidDate(dateString) {
  // 正则表达式用于匹配 YYYY-MM-DD 格式的日期
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!regex.test(dateString)) {
    return false;
  }
  // 进一步验证日期的合理性，例如 2023-02-30 是无效日期
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return false;
  }
  return date.toISOString().startsWith(dateString);
}
// 添加自定义代码
export function addCustomCode(code = {}) {
  const { js = '', css = '' } = code;
  const script = document.createElement('script');
  script.innerHTML = js;
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.appendChild(style);
  document.body.appendChild(script);
}
export function wave(idx = 1) {
  const _0x1f03ad = document['createElement']('style');
  _0x1f03ad['setAttribute']('type', 'text/css'),
    (_0x1f03ad['innerHTML'] = `
      .vh-bolang {
        pointer-events: none;
        position: fixed;
        left: 0px;
        bottom: 0px;
        width: 100vw;
        height: 88px;
        z-index: ${idx};
      }
      .vh-bolang-main>use{
        animation:vh-bolang-item-move 12s linear infinite
      }
      .vh-bolang-main>use:nth-child(1){
        animation-delay:-2s
      }
      .vh-bolang-main>use:nth-child(2){
        animation-delay:-2s;
        animation-duration:5s
      }
      .vh-bolang-main>use:nth-child(3){
        animation-delay:-4s;
        animation-duration:3s
      }
      @keyframes vh-bolang-item-move{
        0%{
          transform:translate(-90px,0)
        }
        100%{
          transform:translate(85px,0)
        }
      }`),
    document['querySelector']('head')['appendChild'](_0x1f03ad);
  const fillColor = 'rgb(153 205 239 / 10%)';
  const _0x29074d = `<svg class="vh-bolang" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none">
        <defs>
          <path id="vh-bolang-item" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"></path>
        </defs>
        <g class="vh-bolang-main">
          <use xlink:href="#vh-bolang-item" x="50" y="0" fill="${fillColor}"></use>
          <use xlink:href="#vh-bolang-item" x="50" y="3" fill="${fillColor}"></use>
          <use xlink:href="#vh-bolang-item" x="50" y="6" fill="${fillColor}"></use>
        </g>
      </svg>`,
    _0x319530 = new DOMParser(),
    _0x4d9451 = _0x319530['parseFromString'](_0x29074d, 'image/svg+xml')[
      'querySelector'
    ]('svg');
  document['body']['appendChild'](_0x4d9451);

  function createBubble() {
    const bubble = document.createElement('div');
    bubble.style.cssText = `
    position: fixed;
    bottom: -60px;
    background-color: rgb(153 205 239 / 30%);
    border-radius: 50%;
    animation: rise 5s infinite ease-in-out;
    pointer-events: none;
    z-index: ${idx};
    `;

    // 随机大小和位置
    const size = Math.random() * 50 + 10 + 'px';
    bubble.style.width = size;
    bubble.style.height = size;
    bubble.style.left = Math.random() * 100 + '%';

    // 随机动画持续时间
    bubble.style.animationDuration = Math.random() * 10 + 30 + 's';

    document.body.appendChild(bubble);

    // 在动画结束后删除泡泡
    _setTimeout(() => {
      bubble.remove();
    }, parseFloat(bubble.style.animationDuration) * 1000);
  }
  createBubble();
  // 定时生成泡泡
  setInterval(createBubble, 3000);
}
export async function getFileKey(p) {
  const exp = 5 * 60 * 60 * 1000;
  const t = Date.now();
  try {
    const fileKeys = _getData('fileKeys').filter(
      (k) => t - k.key.split('-')[1] < exp
    );
    const fKey = fileKeys.find((k) => k.p === p);
    if (fKey) {
      _setData('fileKeys', fileKeys);
      return fKey.key;
    }
    const res = await reqUserFileKey({ p });
    if (res.code === 1) {
      fileKeys.push({ p, key: res.data });
      _setData('fileKeys', fileKeys);
      return res.data;
    }
    _setData('fileKeys', fileKeys);
    return '';
  } catch {
    return '';
  }
}
export const _type = (function () {
  const _obj = {
      isNumber: 'Number',
      isBoolean: 'Boolean',
      isString: 'String',
      isNull: 'Null',
      isUndefined: 'Undefined',
      isSymbol: 'Symbol',
      isObject: 'Object',
      isArray: 'Array',
      isRegExp: 'RegExp',
      isDate: 'Date',
      isFunction: 'Function',
      isWindow: 'Window',
    },
    _toString = _obj.toString,
    _type = {};
  for (let key in _obj) {
    if (!_obj.hasOwnProperty(key)) break;
    let reg = new RegExp('\\[object ' + _obj[key] + '\\]');
    _type[key] = function (val) {
      return reg.test(_toString.call(val));
    };
  }
  return _type;
})();
export function parseObjectJson(str) {
  try {
    const res = JSON.parse(str);
    if (_type.isString(res) || !_type.isObject(res)) {
      throw new Error();
    }
    return res;
  } catch {
    return '';
  }
}
// 限制并行任务
export async function concurrencyTasks(tasks, concurrency, taskCallback) {
  let index = 0;
  async function handleTask() {
    if (index >= tasks.length) return;
    const currentIndex = index;
    index++;
    taskCallback && (await taskCallback(tasks[currentIndex], currentIndex));
    await handleTask();
  }
  const activeUps = [];
  for (let i = 0; i < concurrency; i++) {
    activeUps.push(handleTask());
  }
  await Promise.all(activeUps);
}

export function findLastIndex(array, predicate) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1; // 如果没有找到则返回 -1
}

// 获取数组相同项
export function getDuplicates(arr, keys) {
  const seen = new Set();
  return arr.filter((item) => {
    if (keys) {
      keys.forEach((key) => (item = item[key]));
    }
    if (seen.has(item)) return true;
    seen.add(item);
    return false;
  });
}
