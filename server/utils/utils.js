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
export async function writelog(req, str, flag = 'hello') {
  const unLock = await lock.acquire();

  try {
    str = str + '';

    str = str.trim().replace(/[\n\r]+/g, ' ');

    if (str.trim() === '') return;

    const date = formatDate({ template: '{0}-{1}-{2} {3}:{4}:{5}' });

    if (req) {
      const { country, province, city, isp } = getCity(req._hello.ip);

      const { username, account } = req._hello.userinfo;

      str = `[${date}]${username || account ? ' - ' : ''}${username || ''}${
        account ? `(${account})` : ''
      } - ${str} - [${country} ${province} ${city} ${isp}](${
        req._hello.ip
      }) - ${req._hello.os}\n`;
    } else {
      str = `[${date}] - ${str}\n`;
    }

    const targetPath = _path.normalize(`${appConfig.appData}/log/${flag}.log`);

    await _f.mkdir(_path.dirname(targetPath));

    // console.log(str);
    await _f.fsp.appendFile(targetPath, str);

    const s = await _f.fsp.lstat(targetPath);

    if (s.size > 9 * 1024 * 1024) {
      await _f.rename(
        targetPath,
        _path.normalize(
          `${appConfig.appData}/log/${formatDate({
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
  let param = '';

  if (req._hello.method === 'get') {
    param = JSON.stringify(req.query);
  } else if (req._hello.method === 'post') {
    param = JSON.stringify(req.body);
  }

  _err(res, '参数错误')(req, param || '', 1);
}

// 客户端ip获取
export function getClientIp(req) {
  try {
    const ip =
      req.headers['x-forwarded-for'] ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      '';

    if (!ip) return '0.0.0.0';

    const formattedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    const extractedIp = extractIP(formattedIp);
    return extractedIp ? extractedIp[0] : '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

export function extractIP(text) {
  const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
  const ipv6Regex = /\b([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}\b/;
  const ipRegex = new RegExp(
    `(${ipv4Regex.source})|(${ipv6Regex.source})`,
    'g'
  );

  return text.match(ipRegex) || null;
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
export function receiveFiles(req, path, filename, maxFileSize = 5) {
  return new Promise((resolve, reject) => {
    req.setTimeout(1000 * 60 * 10);

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
        const newPath = _path.normalize(
            `${path}/${files.attrname[0].newFilename}`
          ),
          originalPath = _path.normalize(`${path}/${filename}`);

        _f.fs.rename(newPath, originalPath, function (err) {
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
  const list = await _f.fsp.readdir(from);

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
    const u = _path.normalize(`${from}/${list[i]}`);
    const f = await _f.fsp.readFile(u);
    await _f.fsp.appendFile(temFile, f);
    await _f.del(u);
  }

  await _f.del(from);

  await _f.rename(temFile, to);
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
  return /(\.jpg|\.jpeg|\.png|\.ico|\.svg|\.webp|\.gif|\.bmp|\.tiff|\.tif|\.jfif|\.heif|\.heic)$/gi.test(
    name
  );
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
export function deepClone(obj, hash = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (hash.has(obj)) return hash.get(obj);

  const clone = Array.isArray(obj) ? [] : {};
  hash.set(obj, clone);

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], hash);
    }
  }

  return clone;
}

// 歌曲标签信息
export async function getSongInfo(path) {
  const metadata = await parseFile(path);
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

// 验证值
export function validationValue(target, arr) {
  return arr.includes(target);
}

// 是否空格开头或结尾
export function hasLeadingOrTrailingSpaces(str) {
  return str.startsWith(' ') || str.endsWith(' ');
}

// 字符限制
export function validaString(
  target,
  min = 0,
  max = 0,
  isAlphanumeric = false, // 由数字字母下划线组成
  allowWhitespace = false // 允许空格
) {
  // 验证输入类型
  if (
    !_type.isString(target) ||
    !_type.isNumber(min) ||
    !_type.isNumber(max) ||
    (!allowWhitespace && hasLeadingOrTrailingSpaces(target))
  )
    return false;

  const length = target.length;

  // 检查最小长度限制
  if (length < min) return false;

  // 检查最大长度限制
  if (max > 0 && length > max) return false;

  // 如果需要，检查是否为字母数字_
  if (isAlphanumeric && length > 0) {
    return /^[\w]+$/.test(target);
  }

  return true;
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
  _connect.send(req._hello.userinfo.account, req._hello.temid, {
    type: 'updatedata',
    data: {
      flag,
      id,
    },
  });
}

// 错误通知消息
export function errorNotifyMsg(req, text) {
  _connect.send(req._hello.userinfo.account, nanoid(), {
    type: 'errMsg',
    data: {
      text,
    },
  });
}

// 文件名格式
export function isFilename(name) {
  // 检查空字符串
  if (!name || name.trim() === '') {
    return false;
  }

  // 检查长度限制（例如255个字符）
  if (name.length > 255) {
    return false;
  }

  // 检查非法字符
  return !/[?\\\\/<>*|:"]/g.test(name);
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
    if (_type.isString(res) || !_type.isObject(res)) {
      throw new Error();
    }
    return res;
  } catch {
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
