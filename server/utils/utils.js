// 歌曲信息解析
import { parseFile } from 'music-metadata';
// 接收上传文件
import { formidable } from 'formidable';

import appConfig from '../data/config.js';

import _connect from './connect.js';

import _f from './f.js';

import getCity from './getCity.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import _path from './path.js';
import Lock from './lock.js';
import nanoid from './nanoid.js';
import _crypto from './crypto.js';
import V from './validRules.js';
import { sym } from './symbols.js';

const kHello = sym('hello');
const kValidate = sym('validate');

// 获取模块目录
export function getDirname(meta) {
  const __filename = fileURLToPath(meta.url);
  return dirname(__filename);
}

export function getFilename(meta) {
  return fileURLToPath(meta.url);
}

const lock = new Lock();

// 记录日志
export async function writelog(req, str, flag = appConfig.appName) {
  const unLock = await lock.acquire();

  try {
    str = str + '';

    str = str.trim().replace(/[\n\r]+/g, ' ');

    if (str.trim() === '') return;

    const date = formatDate({ template: '{0}-{1}-{2} {3}:{4}:{5}' });

    if (req) {
      const { country, province, city, isp } = getCity(req[kHello].ip);

      const { username, account } = req[kHello].userinfo;

      str = `[${date}]${username || account ? ' - ' : ''}${username || ''}${
        account ? `(${account})` : ''
      } - ${str} - [${country} ${province} ${city} ${isp}](${
        req[kHello].ip
      }) - ${req[kHello].os}\n`;
    } else {
      str = `[${date}] - ${str}\n`;
    }

    const targetPath = appConfig.logDir(`${flag}.log`);

    // console.log(str);
    await _f.appendFile(targetPath, str);

    const s = await _f.lstat(targetPath);

    if (s && s.size > 9 * 1024 * 1024) {
      await _f.rename(
        targetPath,
        appConfig.logDir(
          `${formatDate({
            template: '{0}{1}{2}_{3}{4}{5}',
          })}_${flag}.log`
        )
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  } finally {
    unLock();
  }
}

// 操作日志
export function uLog(req, str) {
  return writelog(
    req,
    `${req ? `${req[kHello].method}(${req[kHello].path}) - ` : ''}${str}`,
    'user'
  );
}

// 错误日志
export function errLog(req, err) {
  return writelog(
    req,
    `${req ? `${req[kHello].method}(${req[kHello].path}) - ` : ''}${err}`,
    'error'
  );
}

// 参数错误
export function paramErr(res, req, err = '', data = {}) {
  let str = '';
  try {
    if (typeof data === 'string') {
      str = JSON.stringify(req[data]);
    } else {
      str = JSON.stringify(data);
    }
  } catch {}

  _err(res, '参数错误')(req, `${err}${str ? ` - ${str}` : ''}`, 1);
}

// 参数验证中间件
export function validate(...rules) {
  return async (req, res, next) => {
    rules = Array.isArray(rules[0]) ? rules : [rules];

    req[kValidate] = {};
    for (const [type, schema, path = ''] of rules) {
      try {
        const res = await V.parse(req[type], schema, path);
        if (rules.length === 1) {
          req[kValidate] = res;
        } else {
          req[kValidate][type] = res;
        }
      } catch (err) {
        return paramErr(res, req, err, type);
      }
    }

    next();
  };
}

// 验证颜色
export function isValidColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
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

//处理返回的结果
export function _send(res, options) {
  res.status(200).json({
    code: 1,
    codeText: 'ok',
    data: null,
    ...options,
  });
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
export async function receiveFiles(
  req,
  uploadDir,
  filename,
  maxFileSizeMB = 5,
  HASH
) {
  req.setTimeout(1000 * 60 * 10); // 10分钟超时

  const maxFileSize = maxFileSizeMB * 1024 * 1024;
  await _f.mkdir(uploadDir);
  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
    maxFileSize,
  });

  const { files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

  const fileKey = Object.keys(files)[0];
  if (!fileKey || !files[fileKey]) {
    throw new Error('No file uploaded');
  }

  const uploadedFile = Array.isArray(files[fileKey])
    ? files[fileKey][0]
    : files[fileKey];
  const newPath = _path.normalize(uploadDir, uploadedFile.newFilename);
  const originalPath = _path.normalize(uploadDir, filename);

  await _f.fsp.rename(newPath, originalPath);
  if (HASH && HASH !== (await _crypto.sampleHash(originalPath))) {
    await _f.del(originalPath);
    throw new Error('hash error');
  }
}

// 合并切片
export async function mergefile(count, from, to, HASH) {
  const list = await _f.fsp.readdir(from);

  if (list.length < count) throw new Error('file chunks error');

  list.sort((a, b) => {
    const na = a.split('_')[1];
    const nb = b.split('_')[1];
    return Number(na) - Number(nb);
  });

  const temFile = `${to}_${nanoid()}`;

  for (const filename of list) {
    const filePath = _path.normalize(from, filename);
    const readStream = _f.fs.createReadStream(filePath);

    await _f.streamp.pipeline(
      readStream,
      new _f.stream.Transform({
        transform(chunk, _, callback) {
          callback(null, chunk);
        },
      }),
      await _f.createWriteStream(temFile, { flags: 'a' }) // 'a' 追加模式
    );

    await _f.del(filePath);
  }

  await _f.del(from);

  await _f.rename(temFile, to);

  if (HASH && HASH !== (await _crypto.sampleHash(to))) {
    await _f.del(to);
    throw new Error('hash error');
  }
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

// 图片格式
export function isImgFile(name) {
  return /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i.test(name);
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

// 分词
export function getSplitWord(str) {
  let words = [];
  str = str.trim();
  if (!str) return words;
  try {
    const intl = new Intl.Segmenter('cn', { granularity: 'word' });
    words = [...intl.segment(str)].map((item) => item.segment.trim());
  } catch {
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

export function isTooDeep(obj, maxDepth) {
  function check(node, depth) {
    if (depth > maxDepth) return true;
    if (node === null || typeof node !== 'object') return false;

    const values = Array.isArray(node) ? node : Object.values(node);
    for (const val of values) {
      if (check(val, depth + 1)) return true;
    }

    return false;
  }

  return check(obj, 0);
}

export function replaceObjectValue(obj, data) {
  return (function fn(obj) {
    const res = Array.isArray(obj) ? [] : {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'object') {
          if (value === null) {
            res[key] = null;
          } else {
            res[key] = fn(value);
          }
        } else if (typeof value === 'string') {
          res[key] = tplReplace(value, data);
        } else {
          res[key] = value;
        }
      }
    }
    return res;
  })(obj);
}

// 深拷贝
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  const hash = new WeakMap();
  const stack = [];
  const clone = Array.isArray(obj) ? [] : {};

  // 初始化栈
  stack.push({
    source: obj,
    target: clone,
  });
  hash.set(obj, clone);

  while (stack.length > 0) {
    const { source, target } = stack.pop();

    for (let key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];

        if (value === null || typeof value !== 'object') {
          // 基本类型直接赋值
          target[key] = value;
        } else if (hash.has(value)) {
          // 已克隆过的对象直接引用
          target[key] = hash.get(value);
        } else {
          // 新对象，创建克隆并加入栈
          const newClone = Array.isArray(value) ? [] : {};
          target[key] = newClone;
          hash.set(value, newClone);
          stack.push({
            source: value,
            target: newClone,
          });
        }
      }
    }
  }

  return clone;
}

// 歌曲标签信息
export async function getSongInfo(path) {
  const metadata = await parseFile(path);
  let duration = getIn(metadata, ['format', 'duration'], 0),
    artist = getIn(metadata, ['common', 'artist'], '未知'),
    title = getIn(metadata, ['common', 'title'], '未知'),
    album = getIn(metadata, ['common', 'album'], '--'),
    year = getIn(metadata, ['common', 'year'], '--'),
    pic = getIn(metadata, ['common', 'picture', '0', 'data'], ''),
    picFormat = getIn(metadata, ['common', 'picture', '0', 'format'], ''),
    lrc = getIn(metadata, ['native', `ID3v2.3`], []);
  lrc = lrc.find(
    (item) => item !== null && typeof item === 'object' && item.id === 'USLT'
  );
  lrc = lrc && getIn(lrc, ['value', 'text'], '');
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
    template: '{0}/{1}/{2}/{3}',
    timestamp: timestamp || Date.now(),
  });
}

// 读取深层值
export function getIn(target, keys, defaultValue = undefined) {
  if (!target) return defaultValue;

  const keyArray = Array.isArray(keys) ? keys : keys.split('.');

  let current = target;
  for (const key of keyArray) {
    if (current == null) return defaultValue;
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

export function tplReplace(tpl, data) {
  return tpl.replace(/\{\{(.*?)\}\}/g, (_, k) => {
    return getIn(data, k.trim().split('.').filter(Boolean), '');
  });
}

// 整数
export function isInteger(obj) {
  return Math.floor(obj) === obj;
}

// 过期判断
export function isValidShare(t) {
  return t != 0 && t <= Date.now();
}

// 同步更新数据
export function syncUpdateData(req, flag, id = '') {
  _connect.send(req[kHello].userinfo.account, req[kHello].temid, {
    type: 'updatedata',
    data: {
      flag,
      id,
    },
  });
}

// 错误通知消息
export function errorNotifyMsg(req, text) {
  _connect.send(req[kHello].userinfo.account, nanoid(), {
    type: 'errMsg',
    data: {
      text,
    },
  });
}

// 规范化pageNo
export function normalizePageNo(total, pageSize, pageNo) {
  const totalPage = Math.ceil(total / pageSize) || 1;
  return pageNo > totalPage ? totalPage : pageNo <= 0 ? 1 : pageNo;
}

// 处理分页
export function createPagingData(list, pageSize, pageNo) {
  const totalPage = Math.ceil(list.length / pageSize) || 1;
  pageNo = normalizePageNo(list.length, pageSize, pageNo);
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
    if (_type.isObject(res)) return res;
    throw new Error();
  } catch {
    return '';
  }
}

export function parseArrayJson(str) {
  try {
    const res = JSON.parse(str);
    if (_type.isArray(res)) return res;
    throw new Error();
  } catch {
    return '';
  }
}

export function parseJson(str, defaultValue) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export function debounce(callback, wait, immedia) {
  let timer = null,
    res = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    if (!timer && immedia) {
      res = callback.apply(this, args);
    }
    timer = setTimeout(() => {
      timer = null;
      if (!immedia) res = callback.apply(this, args);
    }, wait);
    return res;
  };
}

// 并行任务
export async function concurrencyTasks(tasks, concurrency, taskCallback) {
  let index = 0;

  async function handleTask() {
    while (index < tasks.length) {
      const currentIndex = index++;

      taskCallback && (await taskCallback(tasks[currentIndex], currentIndex));
    }
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

// 获取请求源
export function getOrigin(req) {
  try {
    const refererUrl = new URL(
      req.headers.origin || req.headers.referer || `http://${req.headers.host}`
    );
    return `${refererUrl.protocol}//${refererUrl.host}`;
  } catch {
    return 'https://xxx.com';
  }
}

// 返回完整的<head>标签
export function extractFullHead(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return headMatch ? headMatch[0] : '<head></head>';
}
