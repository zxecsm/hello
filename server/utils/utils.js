// 歌曲信息解析
import { parseFile } from 'music-metadata';
// 接收上传文件
import { formidable } from 'formidable';

import configObj from '../data/config.js';

import msg from '../data/msg.js';

import _f from './f.js';

import getCity from './getCity.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export function getDirname(meta) {
  const __filename = fileURLToPath(meta.url);
  return dirname(__filename);
}

export function getFilename(meta) {
  return fileURLToPath(meta.url);
}

// 记录日志
export async function writelog(req, str, flag = 'hello') {
  try {
    str = str + '';

    str = str.trim().replace(/[\n\r]+/g, ' ');

    if (str.trim() === '') return;

    const date = formatDate({ template: '{0}-{1}-{2} {3}:{4}' });

    if (req) {
      const { country, province, city, isp } = getCity(req._hello.ip);

      const { username, account } = req._hello.jwt.userinfo;

      str = `[${date}]${username || account ? ' - ' : ''}${username || ''}${
        account ? `(${account})` : ''
      } - ${str} - [${country} ${province} ${city} ${isp}](${
        req._hello.ip
      }) - ${req._hello.os}\n`;
    } else {
      str = `[${date}] - ${str}\n`;
    }
    await _f.mkdir(`${configObj.filepath}/log`);

    const hp = `${configObj.filepath}/log/${flag}.log`;
    // console.log(str);
    _f.c.appendFileSync(hp, str);

    const s = await _f.p.stat(hp);

    if (s.size > 10 * 1024 * 1024) {
      await _f.p.rename(
        hp,
        `${configObj.filepath}/log/${formatDate({
          template: '{0}{1}{2}_{3}{4}{5}',
        })}_${flag}.log`
      );
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {}
}

// 操作日志
export function uLog(req, str) {
  return writelog(
    req,
    `${req._hello.method}(${req._hello.path}) - ${str}`,
    'user'
  );
}

// 错误日志
export function errLog(req, err) {
  return writelog(
    req,
    `${req._hello.method}(${req._hello.path}) - ${err}`,
    'error'
  );
}

// 参数错误
export function paramErr(res, req) {
  _err(res, '参数错误');
  let param = '';

  if (req._hello.method === 'get') {
    param = JSON.stringify(req.query);
  } else if (req._hello.method === 'post') {
    param = JSON.stringify(req.body);
  }

  writelog(
    req,
    `${req._hello.method}(${req._hello.path}) - 参数错误：[ ${param || ''} ]`,
    'error'
  );
}

// 客户端ip获取
export function getClientIp(req) {
  let ip = '';

  try {
    ip =
      req.headers['x-forwarded-for'] ||
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress ||
      '';
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    ip = '';
  }

  if (/^\:\:ffff\:/i.test(ip)) {
    ip = ip.slice(7);
  }

  ip = extractIP(ip);

  return ip ? ip[0] : '0.0.0.0';
}

export function extractIP(text) {
  const ipv4Regex =
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

  const ipv6Regex =
    /\b(?:(?:[0-9A-Fa-f]{1,4}:){7}(?:[0-9A-Fa-f]{1,4}|:))|(?:(?:[0-9A-Fa-f]{1,4}:){6}(?::[0-9A-Fa-f]{1,4}|(?=::[0-9A-Fa-f]{1,4})))|(?:(?:[0-9A-Fa-f]{1,4}:){5}(?:(?::[0-9A-Fa-f]{1,4}){1,2}|:(?=::[0-9A-Fa-f]{1,4})))|(?:(?:[0-9A-Fa-f]{1,4}:){4}(?:(?::[0-9A-Fa-f]{1,4}){1,3}|:(?=(?::[0-9A-Fa-f]{1,4}){1,2})))|(?:(?:[0-9A-Fa-f]{1,4}:){3}(?:(?::[0-9A-Fa-f]{1,4}){1,4}|:(?=(?::[0-9A-Fa-f]{1,4}){1,3})))|(?:(?:[0-9A-Fa-f]{1,4}:){2}(?:(?::[0-9A-Fa-f]{1,4}){1,5}|:(?=(?::[0-9A-Fa-f]{1,4}){1,4})))|(?:(?:[0-9A-Fa-f]{1,4}:){1}(?:(?::[0-9A-Fa-f]{1,4}){1,6}|:(?=(?::[0-9A-Fa-f]{1,4}){1,5})))|(?:(?:(?::[0-9A-Fa-f]{1,4}){1,7})|(?:(?:::)(?::[0-9A-Fa-f]{1,4}){1,6}))\b/; // 这里省略了IPv6的正则表达式，以避免过长，使用上面的IPv6正则表达式替换即可

  const ipRegex = new RegExp(
    `(${ipv4Regex.source})|(${ipv6Regex.source})`,
    'g'
  );

  const matches = text.match(ipRegex);

  return matches ? matches : null;
}

// 格式时间日期
export function formatDate(opt = {}) {
  const { template = '{0}-{1}-{2} {3}:{4}:{5}', timestamp = Date.now() } = opt;
  const date = new Date(+timestamp);
  const year = date.getFullYear(),
    month = date.getMonth() + 1,
    day = date.getDate(),
    week = date.getDay(),
    hour = date.getHours(),
    minute = date.getMinutes(),
    second = date.getSeconds();
  const weekArr = ['日', '一', '二', '三', '四', '五', '六'],
    timeArr = [year, month, day, hour, minute, second, week];
  return template.replace(/\{(\d+)\}/g, function () {
    const key = arguments[1];
    if (key === 6) return weekArr[timeArr[key]];
    const val = timeArr[key] + '';
    if (val === 'undefined') return '';
    return val.length < 2 ? '0' + val : val;
  });
}

//处理返回的结果
export function _send(res, options) {
  res.status(200);

  res.type('application/json');

  res.send(
    Object.assign(
      {
        code: 1,
        codeText: 'ok',
        data: null,
      },
      options
    )
  );
}

export function _success(res, codeText = '操作成功', data = null) {
  _send(res, {
    data,
    codeText,
  });

  return function (req, txt, concat) {
    if (txt) {
      if (concat) {
        txt = `${codeText}(${txt})`;
      }
    } else {
      txt = codeText;
    }
    uLog(req, txt);
  };
}

export function _nologin(res) {
  _send(res, {
    code: 2,
    codeText: `当前未登录，请登录后再操作`,
  });
}

export function _nothing(res, codeText = 'ok', data = null) {
  _send(res, {
    code: 3,
    codeText,
    data,
  });
}

export function _err(res, codeText = '操作失败', data = null) {
  _send(res, {
    code: 0,
    codeText,
    data,
  });

  return function (req, txt, concat) {
    if (txt) {
      if (concat) {
        txt = `${codeText}(${txt})`;
      }
    } else {
      txt = codeText;
    }
    errLog(req, txt);
  };
}

// 等待
export function delay(time) {
  return new Promise((resolve) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      resolve();
    }, time);
  });
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

//接收文件
export function receiveFiles(req, path, filename, maxFileSize = 5) {
  return new Promise((resolve, reject) => {
    maxFileSize = maxFileSize * 1024 * 1024;

    formidable({
      multiples: false,
      uploadDir: path, //上传路径
      keepExtensions: true, //包含原始文件的扩展名
      maxFileSize, //限制上传文件的大小。
    }).parse(req, function (err, fields, files) {
      if (err) {
        reject(err);
      } else {
        let newPath = `${path}/${files.attrname[0].newFilename}`,
          originalPath = `${path}/${hdFilename(filename)}`;

        _f.c.rename(newPath, originalPath, function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }
    });
  });
}

// 合并切片
export async function mergefile(count, from, to) {
  const list = await _f.p.readdir(from);

  if (list.length < count) {
    throw `文件数据错误`;
  }

  list.sort((a, b) => {
    a = a.split('_')[1];
    b = b.split('_')[1];
    return a - b;
  });

  const temFile = `${to}_${nanoid()}`;

  for (let i = 0; i < list.length; i++) {
    const u = `${from}/${list[i]}`;
    const f = await _f.p.readFile(u);
    await _f.p.appendFile(temFile, f);
    await _f.del(u);
  }

  await _f.del(from);

  try {
    await _f.p.rename(temFile, to);
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    await _f.cp(temFile, to);
    await _f.del(temFile);
  }
}

// 生成id
export function nanoid() {
  return (
    'h' +
    Date.now().toString(36) +
    Number(String(Math.random()).slice(2)).toString(36)
  );
}
// 随机数
export function randomNum(x, y) {
  return Math.round(Math.random() * (y - x) + x);
}

// 判断网址
export function isurl(url) {
  try {
    const newUrl = new URL(url);

    if (newUrl.protocol === 'http:' || newUrl.protocol === 'https:') {
      return newUrl;
    }

    return false;
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return false;
  }
}

// 获取url域名
export function getHost(url) {
  let res = url.match(/\/\/([^/?#]+)/)[1];

  return res || 'hello.com';
}

// 图片格式
export function isImgFile(name) {
  return /(\.jpg|\.jpeg|\.png|\.ico|\.svg|\.webp|\.gif)$/gi.test(name);
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
  const spacing = 200,
    res = [],
    oneS = arr[0].start,
    oneE = arr[0].end;
  res.push({
    type: 'text',
    value: content.slice(oneS < spacing ? 0 : oneS - spacing, oneS),
  });
  res.push({ type: 'word', value: content.slice(oneS, oneE + 1) });
  if (arr.length > 1) {
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1],
        item = arr[i];
      let prevE = prev.end,
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
        const diff = itemS - prevE;
        if (diff <= spacing) {
          res.push({ type: 'text', value: content.slice(prevE + 1, itemS) });
        } else {
          res.push({
            type: 'text',
            value: content.slice(prevE + 1, prevE + spacing / 2),
          });
          res.push({ type: 'icon', value: '...' });
          res.push({
            type: 'text',
            value: content.slice(itemS - spacing / 2, itemS),
          });
        }
        res.push({ type: 'word', value: content.slice(itemS, itemE + 1) });
      }
    }
  }
  const lastE = arr[arr.length - 1].end;
  res.push({ type: 'text', value: content.slice(lastE + 1, lastE + spacing) });
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

// 分词
export function getSplitWord(str) {
  let words = [];
  str = str.trim();
  if (!str) return words;
  try {
    const intl = new Intl.Segmenter('cn', { granularity: 'word' });
    words = [...intl.segment(str)].map((item) => item.segment.trim());
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    words = str.split(' ');
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

export function replaceObjectValue(obj, msg) {
  return (function fn(obj) {
    const res = Array.isArray(obj) ? [] : {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object') {
          if (obj[key] === null) {
            res[key] = null;
          } else {
            res[key] = fn(obj[key]);
          }
        } else {
          res[key] = tplReplace(obj[key], { msg });
        }
      }
    }
    return res;
  })(obj);
}

// 深拷贝
export function deepClone(obj) {
  //判断传入对象为数组或者对象
  const result = Array.isArray(obj) ? [] : {};
  // for in遍历
  for (let key in obj) {
    // 判断是否为自身的属性值（排除原型链干扰）
    if (obj.hasOwnProperty(key)) {
      // 判断对象的属性值中存储的数据类型是否为对象
      if (typeof obj[key] === 'object') {
        // 有可能等于null
        if (obj[key] === null) {
          result[key] = null;
          continue;
        }

        // 递归调用
        result[key] = deepClone(obj[key]); //递归复制
      }
      // 不是的话直接赋值
      else {
        result[key] = obj[key];
      }
    }
  }
  // 返回新的对象
  return result;
}
// const util = require('util')
// 歌曲标签信息
export async function getSongInfo(path) {
  const metadata = await parseFile(path);
  // console.log(util.inspect(metadata, { showHidden: false, depth: null }));
  let duration = getIn(metadata, ['format', 'duration']) || 0,
    artist = getIn(metadata, ['common', 'artist']) || '未知',
    title = getIn(metadata, ['common', 'title']) || '未知',
    album = getIn(metadata, ['common', 'album']) || '--',
    year = getIn(metadata, ['common', 'year']) || '--',
    pic = getIn(metadata, ['common', 'picture', '0', 'data']) || '',
    picFormat = getIn(metadata, ['common', 'picture', '0', 'format']) || '',
    lrc = getIn(metadata, ['native', `ID3v2.3`]) || [];
  lrc = lrc.find(
    (item) => item !== null && typeof item === 'object' && item.id === 'USLT'
  );
  lrc = (lrc && getIn(lrc, ['value', 'text'])) || '';
  return {
    duration,
    pic,
    lrc,
    artist,
    title,
    album,
    year,
    picFormat,
  };
}
// 音乐文件
export function isMusicFile(str) {
  return /\.(mp3)$/i.test(str);
}
// 视频文件
export function isVideoFile(str) {
  return /(\.rmvb|\.3gp|\.mp4|\.m4v|\.avi|\.mkv|\.flv)$/i.test(str);
}
// 验证值
export function validationValue(target, arr) {
  return arr.includes(target);
}
// 字符限制
export function validaString(target, min = 0, max = 0, w) {
  if (!_type.isString(target) || !_type.isNumber(min) || !_type.isNumber(max))
    return false;
  const len = target.length;
  if (len >= min) {
    if (max > 0 && len > max) {
      return false;
    }
    if (w && len > 0) {
      return /^[\w]+$/.test(target);
    }
    return true;
  }
  return false;
}
// 数据类型判断
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

// 时间路径
export function getTimePath(timestamp) {
  return formatDate({
    template: '{0}/{1}/{2}',
    timestamp: timestamp || Date.now(),
  });
}

// 读取深层值
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

// 检查文件是否文本文件
export function isTextFile(filepath, length = 1000) {
  try {
    let res = true;
    const fd = _f.c.openSync(filepath, 'r');
    for (let i = 0; i < length; i++) {
      const buf = new Buffer.alloc(1);
      const bytes = _f.c.readSync(fd, buf, 0, 1, i);
      const char = buf.toString().charCodeAt();
      if (bytes === 0) {
        break;
      } else if (bytes === 1 && char === 0) {
        res = false;
        break;
      }
    }
    _f.c.closeSync(fd);
    return res;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }
}

// 整数
export function isInteger(obj) {
  return Math.floor(obj) === obj;
}

// 过期判断
export function isValidShare(t) {
  return t != 0 && t <= Date.now();
}

// 处理文件名
export function hdFilename(str, fill) {
  return str.replace(/[\\\\/]/gi, fill || '');
}

// 同步更新数据
export function syncUpdateData(req, flag, id = '') {
  msg.set(req._hello.userinfo.account, req._hello.temid, {
    type: 'updatedata',
    data: {
      flag,
      id,
    },
  });
}

// 错误通知消息
export function errorNotifyMsg(req, text) {
  msg.set(req._hello.userinfo.account, nanoid(), {
    type: 'errMsg',
    data: {
      text,
    },
  });
}

// 文件名格式
export function isFilename(name) {
  return !/[?\\\\/<>*|]/g.test(name);
}

// 处理分页
export function createPagingData(list, pageSize, pageNo) {
  const totalPage = Math.ceil(list.length / pageSize) || 1;
  pageNo > totalPage ? (pageNo = totalPage) : pageNo <= 0 ? (pageNo = 1) : null;
  const data = list.slice(pageSize * (pageNo - 1), pageSize * pageNo);
  return {
    total: list.length,
    totalPage,
    pageNo,
    data,
  };
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

export function isRoot(req) {
  return req._hello.userinfo.account === 'root';
}

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

export function parseObjectJson(str) {
  try {
    const res = JSON.parse(str);
    if (_type.isString(res) || !_type.isObject(res)) {
      throw new Error();
    }
    return res;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return '';
  }
}

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

// 并行任务
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

// 分批处理
export async function batchTask(callback, limit = 1000) {
  if (!callback) return;

  async function processBatch(offset = 0) {
    const state = await callback(offset, limit);
    if (state) {
      offset += limit;
      await processBatch(offset);
    }
  }

  await processBatch();
}
