const { resolve } = require('path');
// 图片处理
const sharp = require('sharp');
const { _d } = require('../data/data');
// token
const jwt = require('jsonwebtoken');
// 歌曲信息解析
const mm = require('music-metadata');
// 接收上传文件
const { formidable } = require('formidable');
// ip地理位置
const IP2Region = require('ip2region').default;
const queryIP = new IP2Region();
// 压缩文件
const compressing = require('compressing');
const configObj = require('../data/config');
const { queryData, deleteData, updateData, insertData } = require('./sqlite');
const msg = require('../data/msg');
const _f = require('./f');
const { default: axios } = require('axios');
function getCity(ip) {
  const res = { country: '**', province: '**', city: '**', isp: '**' };
  try {
    const obj = queryIP.search(ip);
    Object.keys(res).forEach((key) => {
      const value = obj[key];
      if (value) {
        res[key] = value;
      }
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {}
  return res;
}
// 记录日志
async function writelog(req, str, flag = 'hello') {
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
function uLog(req, str) {
  return writelog(
    req,
    `${req._hello.method}(${req._hello.path}) - ${str}`,
    'user'
  );
}
// 错误日志
function errLog(req, err) {
  return writelog(
    req,
    `${req._hello.method}(${req._hello.path}) - ${err}`,
    'error'
  );
}
// 参数错误
function paramErr(res, req) {
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
// 压缩文件
function compressFile(p1, p2) {
  return compressing.zip.compressFile(p1, p2);
}
// 压缩目录
function compressDir(p1, p2) {
  return compressing.zip.compressDir(p1, p2);
}
// 解压
function uncompress(p1, p2) {
  return compressing.zip.uncompress(p1, p2);
}
// 压缩图片
async function compressionImg(path, x = 400, y = 400, quality) {
  try {
    const inputBuf = await _f.p.readFile(path);
    const img = sharp(inputBuf);
    const meta = await img.metadata();
    const buf = await img
      .resize(x, y, { fit: 'inside' }) // 保持比例
      .png(
        ['gif', 'raw', 'tile'].includes(meta.format) || !quality
          ? {}
          : { quality }
      )
      .toBuffer();
    return buf;
  } catch (error) {
    throw error;
  }
}
// 读取图片信息
async function getImgInfo(path) {
  try {
    const inputBuf = await _f.p.readFile(path);
    const img = sharp(inputBuf);
    return img.metadata();
  } catch (error) {
    throw error;
  }
}
// 计算图片压缩尺寸
function getCompressionSize(type) {
  let x = 400,
    y = 400;
  if (type == 'pic') {
    x = y = 500;
  } else if (type == 'bg') {
    x = 600;
  } else if (type == 'bgxs') {
    y = 800;
  }
  return { x, y };
}
// 客户端ip获取
function getClientIp(req) {
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
function extractIP(text) {
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
// 文件随机后缀
function getRandomName(str) {
  const r = '_' + Math.random().toString().slice(-6),
    arr = getSuffix(str);
  return arr[0] + r + `${arr[1] === '' ? '' : `.${arr[1]}`}`;
}
// 删除文件
async function _delDir(path) {
  try {
    if (_d.trashState) {
      const trashDir = `${configObj.filepath}/trash`;
      if (
        path === trashDir ||
        isParentDir(path, trashDir) ||
        isParentDir(trashDir, path)
      ) {
        return _f.del(path);
      }
      await _f.mkdir(trashDir);
      let fname = getPathFilename(path)[0];
      if (_f.c.existsSync(`${trashDir}/${fname}`)) {
        fname = getRandomName(fname);
      }
      try {
        await _f.p.rename(path, `${trashDir}/${fname}`);
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        await _f.cp(path, `${trashDir}/${fname}`);
        await _f.del(path);
      }
    } else {
      await _f.del(path);
    }
  } catch (error) {
    throw error;
  }
}
// 格式时间日期
function formatDate(opt = {}) {
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
    if (key == 6) return weekArr[timeArr[key]];
    const val = timeArr[key] + '';
    if (val == 'undefined') return '';
    return val.length < 2 ? '0' + val : val;
  });
}
// 获取扩展名
function getSuffix(str) {
  let idx = str.lastIndexOf('.'),
    a = '',
    b = '';
  if (idx < 0) {
    a = str;
  } else {
    a = str.slice(0, idx);
    b = str.slice(idx + 1);
  }
  return [a, b];
}
// 密码加密
function encryption(str) {
  return str.slice(10, -10).split('').reverse().join('');
}
//处理返回的结果
function _send(res, options) {
  res.status(200);
  res.type('application/json');
  res.send(
    Object.assign(
      {
        code: 0,
        codeText: 'ok',
        data: null,
      },
      options
    )
  );
}
function _success(res, codeText = '操作成功', data = null) {
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
function _nologin(res) {
  _send(res, {
    code: 2,
    codeText: `当前未登录，请登录后再操作`,
  });
}
function _nothing(res, codeText = 'ok', data = null) {
  _send(res, {
    code: 3,
    codeText,
    data,
  });
}
function _err(res, codeText = '操作失败', data = null) {
  _send(res, {
    code: 1,
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
function delay(time) {
  return new Promise((resolve) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      resolve();
    }, time);
  });
}
// 定时器
function _setTimeout(callback, time) {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
    callback();
  }, time);
  return timer;
}
// 生成token
function jwten(userinfo) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 2,
      userinfo,
    },
    _d.tokenKey
  );
}
// 解密token
function jwtde(token) {
  try {
    let obj = jwt.verify(token, _d.tokenKey);
    obj.userinfo = obj.userinfo || {};
    return obj;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return { userinfo: {} };
  }
}
//接收文件
function receiveFiles(req, path, filename, maxFileSize = 5) {
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
async function mergefile(count, from, to) {
  try {
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
  } catch (error) {
    throw error;
  }
}
// 生成id
function nanoid() {
  return (
    'h' +
    Date.now().toString(36) +
    '_' +
    Number(String(Math.random()).slice(2)).toString(36)
  );
}
// 随机数
function randomNum(x, y) {
  return Math.round(Math.random() * (y - x) + x);
}
// 音乐排序
function arrSortMinToMax(arr, property) {
  arr.sort((a, b) => {
    return mixedSort(a[property], b[property]);
  });
  return arr;
}
// 混合排序
function mixedSort(a, b) {
  if (/^\d+/.test(a) && /^\d+/.test(b)) {
    return /^\d+/.exec(a) - /^\d+/.exec(b);
  } else if (isChinese(a) && isChinese(b)) {
    return a.localeCompare(b, 'zh-CN');
  } else {
    return a.localeCompare(b, 'en');
  }
}
// 中文
function isChinese(str) {
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
// 处理歌单封面
function handleMusicList(arr) {
  arr.forEach((v, i) => {
    v.len = v.item.length;
    if (i === 0) {
      v.pic = 'history';
      return;
    }
    if (v.len != 0) {
      v.pic = `/music/${v.item[0].pic}`;
    } else {
      v.pic = 'default';
    }
  });
  return arr;
}
// 书签排序
function bookSort(arr) {
  return arr.sort((a, b) => a.num - b.num);
}
// 判断网址
function isurl(url) {
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
function getHost(url) {
  let res = url.match(/\/\/([^/?#]+)/)[1];
  return res || 'hello.com';
}
// 读取目录文件
async function readMenu(path) {
  try {
    const list = await _f.p.readdir(path);
    const arr = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const name = list[i];
        const f = `${path}/${name}`;
        const s = await _f.p.stat(f);
        if (s.isDirectory()) {
          arr.push({
            path,
            type: 'dir',
            name,
            time: s.ctime.getTime(),
            size: 0,
            mode: getPermissions(s),
          });
        } else {
          arr.push({
            path,
            type: 'file',
            name,
            time: s.ctime.getTime(),
            size: s.size,
            mode: getPermissions(s),
          });
        }
      } catch (error) {
        await writelog(false, `[ readMenu ] - ${error}`, 'error');
      }
    }
    return arr;
  } catch (error) {
    await writelog(false, `[ readMenu ] - ${error}`, 'error');
    return [];
  }
}
// 文件权限
function getPermissions(stats) {
  let permissions = '';
  // 检查所有者权限
  if (stats.mode & _f.c.constants.S_IRUSR) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWUSR) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXUSR) permissions += 'x';
  else permissions += '-';

  // 检查所属组权限
  if (stats.mode & _f.c.constants.S_IRGRP) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWGRP) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXGRP) permissions += 'x';
  else permissions += '-';

  // 检查其他用户权限
  if (stats.mode & _f.c.constants.S_IROTH) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWOTH) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXOTH) permissions += 'x';
  else permissions += '-';

  const groups = permissions.match(/(.{3})/g).map((group) => {
    return group
      .replace(/r/g, '4')
      .replace(/w/g, '2')
      .replace(/x/g, '1')
      .replace(/-/g, '0');
  });
  const num = groups.reduce((a, b) => {
    return (a += b.split('').reduce((c, d) => parseInt(c) + parseInt(d), 0));
  }, '');
  return permissions + ' ' + num;
}
// 图片格式
function isImgFile(name) {
  return /(\.jpg|\.jpeg|\.png|\.ico|\.svg|\.webp|\.gif)$/gi.test(name);
}
// 转义正则符号
function encodeStr(keyword) {
  return keyword.replace(
    /[\[\(\$\^\.\]\*\\\?\+\{\}\\|\)]/gi,
    (key) => `\\${key}`
  );
}
// 搜索词所在索引
function getWordIdx(searchVal, content) {
  searchVal = searchVal.trim();
  if (!searchVal) return [];
  const idx = searchVal.lastIndexOf('-');
  let searchArr = [];
  if (idx < 0) {
    searchArr = searchVal.split(' ');
  } else {
    searchArr = searchVal.slice(0, idx).split(' ');
  }
  searchArr = unique(searchArr);
  let regStr = '(';
  searchArr.forEach((item, idx) => {
    if (idx > 0) {
      regStr += '|';
    }
    regStr += encodeStr(item);
  });
  regStr += ')';
  let reg = new RegExp(regStr, 'ig');
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
function getWordContent(searchVal, content) {
  const arr = getWordIdx(searchVal, content);
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
function getWordCount(searchVal, content) {
  searchVal = searchVal.trim();
  if (!searchVal) return 0;
  let lowerContent = content.toLowerCase(),
    searchArr = [];
  const idx = searchVal.lastIndexOf('-');
  if (idx < 0) {
    searchArr = searchVal.split(' ');
  } else {
    const o = searchVal.slice(idx + 1);
    searchArr = searchVal.slice(0, idx).split(' ');
    searchArr.push(o);
  }
  searchArr = unique(searchArr);
  return searchArr.reduce((pre, item) => {
    let lowerItem = item.toLowerCase();
    if (lowerContent.includes(lowerItem)) {
      pre++;
    }
    return pre;
  }, 0);
}
// 去重
function unique(arr, keys) {
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
function splitWord(str) {
  str = str.trim();
  if (!str) return '';
  try {
    const intl = new Intl.Segmenter('cn', { granularity: 'word' });
    const obj = {};
    return (
      [...intl.segment(str)]
        .reduce((pre, item) => {
          const word = item.segment.trim();
          if (word && !obj.hasOwnProperty(typeof word + word)) {
            obj[typeof word + word] = true;
            pre.push(word);
          }
          return pre;
        }, [])
        .join(' ') + `-${str}`
    );
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return str.split(' ') + `-${str}`;
  }
}
// 策略化歌曲数据
function getMusicObj(arr) {
  return arr.reduce((total, item) => {
    total[item.id] = item;
    return total;
  }, {});
}
function replaceObjectValue(obj, msg) {
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
function deepClone(obj) {
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
async function getSongInfo(path) {
  try {
    const metadata = await mm.parseFile(path);
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
      (item) => item !== null && typeof item === 'object' && item.id == 'USLT'
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
  } catch (error) {
    throw error;
  }
}
// 音乐文件
function isMusicFile(str) {
  return /\.(mp3)$/i.test(str);
}
// 视频文件
function isVideoFile(str) {
  return /(\.rmvb|\.3gp|\.mp4|\.m4v|\.avi|\.mkv|\.flv)$/i.test(str);
}
// 验证值
function validationValue(target, arr) {
  return arr.includes(target);
}
// 字符限制
function validaString(target, min = 0, max = 0, w) {
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
const _type = (function () {
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
// 设置cookie
function setCookie(res, userinfo) {
  let token = jwten(userinfo);
  res.cookie('token', token, {
    maxAge: 1000 * 60 * 60 * 24 * 2,
    httpOnly: true,
  });
}
// 解析歌词
function parseLrc(lrc) {
  const reg = /\[(\d+\:\d+(\.\d+)?)\]([^\[\n\r]+)/gi,
    res = [];
  lrc.replace(reg, (...[, $1, , $2]) => {
    const parr = $2.split('<=>'),
      tarr = $1.split(':');
    res.push({
      t: parseInt(tarr[0] * 60) + Math.round(tarr[1]),
      p: parr[0].trim(),
      fy: parr[1] ? parr[1].trim() : '',
    });
  });
  res.sort((a, b) => a.t - b.t);
  return res;
}
// 时间路径
function getTimePath(timestamp) {
  return formatDate({
    template: '{0}/{1}/{2}',
    timestamp: timestamp || Date.now(),
  });
}
// 填充sql
function createFillString(len) {
  return new Array(len).fill('?').join(',');
}
// 读取深层值
function getIn(target, keys) {
  return keys.reduce((obj, key) => (obj ? obj[key] : undefined), target);
}
function tplReplace(tpl, data) {
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
// 文件所在目录
function getFileDir(path) {
  return path.split('/').slice(0, -1).join('/');
}
// path获取文件名
function getPathFilename(path) {
  const filename = path.split('/').slice(-1)[0];
  const [a, b] = getSuffix(filename);
  return [filename, a, b];
}
// 清理空目录
async function delEmptyFolder(path) {
  try {
    const s = await _f.p.stat(path);
    if (s.isDirectory()) {
      const list = await _f.p.readdir(path);
      for (let i = 0; i < list.length; i++) {
        await delEmptyFolder(`${path}/${list[i]}`);
      }
      // 清除空文件夹
      if ((await _f.p.readdir(path)).length == 0) {
        await _delDir(path);
      }
    }
  } catch (error) {
    throw error;
  }
}
// 获取所有文件
async function getAllFile(path) {
  try {
    const arr = [];
    async function getFile(path) {
      try {
        const s = await _f.p.stat(path);
        if (s.isDirectory()) {
          const list = await _f.p.readdir(path);
          for (let i = 0; i < list.length; i++) {
            await getFile(`${path}/${list[i]}`);
          }
        } else {
          arr.push({
            name: getPathFilename(path)[0],
            path: getFileDir(path),
            size: s.size,
            atime: s.atimeMs, //最近一次访问文件的时间戳
            ctime: s.ctimeMs, //最近一次文件状态的修改的时间戳
            birthtime: s.birthtimeMs, //文件创建时间的时间戳
          });
        }
      } catch (error) {
        await writelog(false, `[ getAllFile ] - ${error}`, 'error');
      }
    }
    await getFile(path);
    return arr;
  } catch (error) {
    await writelog(false, `[ getAllFile ] - ${error}`, 'error');
    return [];
  }
}
async function getDirSize(path) {
  try {
    let size = 0;
    (await getAllFile(path)).forEach((item) => {
      size += item.size;
    });
    return size;
  } catch (error) {
    throw error;
  }
}
// 用户根目录
function getRootDir(acc) {
  let path = configObj.rootP;
  if (acc !== 'root') {
    path = `${configObj.userFileP}/${acc}`;
  }
  return hdPath(path);
}
// 处理路径
function _hdPath(acc, p) {
  return hdPath(getRootDir(acc) + '/' + p);
}
function hdPath(path) {
  return path.replace(/(\/){2,}/g, '/');
}
// 检查文件是否文本文件
function isTextFile(filepath, length = 1000) {
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
// 判断是否父目录
function isParentDir(parentP, childP) {
  if (childP === parentP) return false;
  return parentP === childP.slice(0, parentP.length);
}
// 整数
function isInteger(obj) {
  return Math.floor(obj) === obj;
}
// 过期判断
function isValid(t) {
  return t != 0 && t <= Date.now();
}
// 清理聊天文件
async function cleanUpload() {
  try {
    if (_d.uploadSaveDay > 0) {
      const uploadDir = `${configObj.filepath}/upload`;
      const uploads = await queryData('upload', '*');
      const now = Date.now();
      const del = [];
      const list = [];
      for (let i = 0; i < uploads.length; i++) {
        const { id, url, time } = uploads[i];
        if (time < now - _d.uploadSaveDay * 24 * 60 * 60 * 1000) {
          del.push(id);
        } else {
          list.push(url);
        }
      }
      await deleteData(
        'upload',
        `WHERE id IN (${createFillString(del.length)})`,
        [...del]
      );
      if (_f.c.existsSync(uploadDir)) {
        const allUploadFile = await getAllFile(uploadDir);
        for (let i = 0; i < allUploadFile.length; i++) {
          const { path, name } = allUploadFile[i];
          const url = `${path.slice(uploadDir.length + 1)}/${name}`;
          if (!list.some((item) => item == url)) {
            await _delDir(`${path}/${name}`).catch(() => {});
          }
        }
        await delEmptyFolder(uploadDir).catch(() => {});
      }
    }
  } catch (error) {
    throw error;
  }
}
// 处理文件名
function hdFilename(str, fill) {
  return str.replace(/[\\\\/]/gi, fill || '');
}
// 同步更新数据
function syncUpdateData(req, flag, id = '') {
  msg.set(req._hello.userinfo.account, req._hello.temid, {
    type: 'updatedata',
    data: {
      flag,
      id,
    },
  });
}
// 上线通知
async function onlineMsg(req, pass) {
  const { account, hide, username } = req._hello.userinfo;
  const connect = msg.getConnect();
  if ((!connect.hasOwnProperty(account) && hide === 'n') || pass) {
    const meIsWhoFriend = await queryData('friends', '*', `WHERE friend=?`, [
      account,
    ]);
    Object.keys(connect).forEach((key) => {
      let des = '';
      const f = meIsWhoFriend.find((item) => item.account == key);
      if (f) {
        des = f.des;
      }
      msg.set(key, req._hello.temid, {
        type: 'online',
        data: { text: `${des || username} 已上线`, account },
      });
    });
  }
}
// 成为朋友
function becomeFriends(me, friend, islooK1 = 'y', islooK2 = 'y') {
  const time = Date.now();
  if (friend === 'chang') {
    return insertData('friends', [
      {
        account: me,
        friend,
        time,
        islooK: islooK1,
        des: '',
      },
    ]);
  }
  return insertData('friends', [
    {
      account: me,
      friend,
      time,
      islooK: islooK1,
      des: '',
    },
    {
      account: friend,
      friend: me,
      time,
      islooK: islooK2,
      des: '',
    },
  ]);
}
// 助手消息和转发消息
async function heperMsgAndForward(req, to, text) {
  try {
    const msg = await helloHelperMsg(to, text);
    forwardMsg(
      {
        _hello: {
          userinfo: {
            username: 'Hello助手',
          },
        },
      },
      msg
    ).catch((err) => {
      errLog(req, `转发信息失败(${err})`);
    });
  } catch (error) {
    throw error;
  }
}
// 转发消息
async function forwardMsg(req, obj) {
  try {
    if (obj._from === obj._to || obj._to === 'hello') return;
    const { username } = req._hello.userinfo;
    const meIsWhoFriend = await queryData('friends', '*', `WHERE friend=?`, [
      obj._from,
    ]);
    let uList = [];
    if (obj._to === 'chang') {
      uList = await queryData(
        'user',
        'forward_msg_link,account',
        `WHERE forward_msg_state=? AND account!=? AND state=?`,
        ['y', obj._from, '0']
      );
    } else {
      uList = await queryData(
        'user',
        'forward_msg_link,account',
        `WHERE forward_msg_state=? AND account=? AND state=?`,
        ['y', obj._to, '0']
      );
    }
    if (uList.length > 0) {
      const promises = uList.map((item) => {
        let { forward_msg_link, account } = item;
        let { link, type, header, body } =
          parseForwardMsgLink(forward_msg_link);
        if (!isurl(link)) {
          return Promise.resolve();
        }
        const f = meIsWhoFriend.find((y) => y.account == account);
        let des = f ? f.des : '';
        const msg = `来自Hello-${des || username}：${obj.data}`;
        link = tplReplace(link, { msg: encodeURIComponent(msg) });
        body = replaceObjectValue(body, msg);
        if (type === 'get') {
          return axios({
            method: type,
            url: link,
            headers: header,
            params: body,
            timeout: 5000,
          });
        } else if (type === 'post') {
          return axios({
            method: type,
            url: link,
            headers: header,
            data: body,
            timeout: 5000,
          });
        }
      });
      await Promise.all(promises);
    }
  } catch (error) {
    throw error;
  }
}
// 保存聊天消息
async function saveChatMsg(account, obj) {
  try {
    obj._from = account;
    obj.flag = obj._to === 'chang' ? 'chang' : `${account}-${obj._to}`;
    obj.id = nanoid();
    obj.time = Date.now();
    obj.date = formatDate({ template: '{0}-{1}-{2}', timestamp: obj.time });
    await insertData('chat', [obj]);
    return obj;
  } catch (error) {
    throw error;
  }
}
async function helloHelperMsg(to, text) {
  try {
    const obj = {
      _to: to,
      data: text,
      size: '',
      hash: '',
      type: 'text',
    };
    const msg = await saveChatMsg('hello', obj);
    await hdChatSendMsg(
      {
        _hello: {
          userinfo: {
            account: 'hello',
            username: 'Hello助手',
          },
        },
      },
      to,
      'addmsg',
      obj
    );
    return msg;
  } catch (error) {
    throw error;
  }
}
// 发送通知
async function hdChatSendMsg(req, to, flag, tt) {
  const { account, logo, username } = req._hello.userinfo;
  const data = {
    type: 'chat',
    data: {
      flag,
      to,
      from: {
        logo,
        account,
        username,
      },
    },
  };
  if (flag === 'addmsg') {
    data.data.msgData = tt;
  } else {
    data.data.tt = tt;
  }
  const t = Date.now() + '';
  const meIsWhoFriend = await queryData('friends', '*', `WHERE friend=?`, [
    account,
  ]);
  if (data.data.to === 'chang') {
    //群消息
    if (flag === 'addmsg') {
      await updateData('friends', { islooK: 'n', time: t }, `WHERE friend=?`, [
        'chang',
      ]);
    }
    Object.keys(msg.getConnect()).forEach((key) => {
      //通知所有用户
      let des = '';
      const f = meIsWhoFriend.find((item) => item.account == key);
      if (f) {
        des = f.des;
      }
      data.data.from.des = des;
      msg.set(key, key === account ? nanoid() : req._hello.temid, data);
    });
  } else {
    if (flag === 'addmsg' && data.data.to !== account) {
      const change = await updateData(
        'friends',
        { islooK: 'n', time: t },
        `WHERE account=? AND friend=?`,
        [data.data.to, account]
      );
      if (change.changes == 0) {
        await becomeFriends(account, data.data.to, 'y', 'n');
      }
    }
    if (data.data.to === account) {
      msg.set(account, nanoid(), data);
    } else {
      let des = '';
      const f = meIsWhoFriend.find((item) => item.account == data.data.to);
      if (f) {
        des = f.des;
      }
      data.data.from.des = des;
      msg.set(data.data.to, req._hello.temid, data);
      if (flag !== 'shake') {
        msg.set(account, nanoid(), data);
      }
    }
  }
}
// 文件名格式
function isFilename(name) {
  return !/[?\\\\/<>*|]/g.test(name);
}
// 处理分页
function createPagingData(list, pageSize, pageNo) {
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
function isEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}
// 验证日期
function isValidDate(dateString) {
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
function isRoot(req) {
  return req._hello.userinfo.account === 'root';
}
async function getSearchConfig() {
  const p = `${configObj.filepath}/data/searchConfig.json`;
  const logop = `${configObj.filepath}/searchlogo`;
  if (!_f.c.existsSync(logop)) {
    await _f.cp(resolve(__dirname, `../img/searchlogo`), logop);
  }
  if (!_f.c.existsSync(p)) {
    await _f.cp(resolve(__dirname, `../data/searchConfig.json`), p);
  }
  return JSON.parse(await _f.p.readFile(p));
}
async function playInConfig() {
  const p = `${configObj.filepath}/data/playIn.json`;
  const logop = `${configObj.filepath}/playerlogo`;
  if (!_f.c.existsSync(logop)) {
    await _f.cp(resolve(__dirname, `../img/playerlogo`), logop);
  }
  if (!_f.c.existsSync(p)) {
    await _f.cp(resolve(__dirname, `../data/playIn.json`), p);
  }
  return JSON.parse(await _f.p.readFile(p));
}
function myShuffle(arr) {
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
// 解析forward_msg_link
function parseForwardMsgLink(str) {
  const res = parseObjectJson(str);
  return (
    res || {
      link: '',
      type: 'get',
      header: {},
      body: {},
    }
  );
}
function parseObjectJson(str) {
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
module.exports = {
  replaceObjectValue,
  parseObjectJson,
  parseForwardMsgLink,
  myShuffle,
  getSearchConfig,
  playInConfig,
  isValidDate,
  isRoot,
  isEmail,
  createPagingData,
  hdFilename,
  syncUpdateData,
  hdChatSendMsg,
  isFilename,
  cleanUpload,
  isValid,
  isInteger,
  isParentDir,
  errLog,
  getPermissions,
  isTextFile,
  getRootDir,
  _hdPath,
  hdPath,
  compressFile,
  compressDir,
  uncompress,
  getAllFile,
  delEmptyFolder,
  getPathFilename,
  getFileDir,
  getIn,
  getImgInfo,
  getTimePath,
  isVideoFile,
  parseLrc,
  createFillString,
  getRandomName,
  setCookie,
  validaString,
  _type,
  validationValue,
  forwardMsg,
  isMusicFile,
  getCity,
  getSongInfo,
  deepClone,
  getMusicObj,
  getWordIdx,
  compressionImg,
  getCompressionSize,
  isImgFile,
  getHost,
  bookSort,
  getDirSize,
  readMenu,
  handleMusicList,
  arrSortMinToMax,
  writelog,
  getClientIp,
  getWordCount,
  _delDir,
  formatDate,
  getSuffix,
  encryption,
  isurl,
  _send,
  _success,
  _nologin,
  _nothing,
  _err,
  _setTimeout,
  delay,
  onlineMsg,
  jwten,
  jwtde,
  getWordContent,
  splitWord,
  receiveFiles,
  mergefile,
  nanoid,
  randomNum,
  paramErr,
  encodeStr,
  extractIP,
  uLog,
  unique,
  becomeFriends,
  saveChatMsg,
  helloHelperMsg,
  tplReplace,
  heperMsgAndForward,
};
