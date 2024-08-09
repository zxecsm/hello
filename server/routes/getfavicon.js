const express = require('express');
const route = express.Router();
const { resolve } = require('path');
const cheerio = require('cheerio');
const { default: axios } = require('axios');
const {
  compressionImg,
  errLog,
  readMenu,
  _delDir,
  writelog,
} = require('../utils/utils');
const configObj = require('../data/config');
const _f = require('../utils/f');
const timedTask = require('../utils/timedTask');
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '001000') {
    const now = Date.now();
    const fList = await readMenu(`${configObj.filepath}/favicon`);
    let num = 0;
    for (let i = 0; i < fList.length; i++) {
      const { name, path, time } = fList[i];
      if (now - time > 7 * 24 * 60 * 60 * 1000) {
        await _delDir(`${path}/${name}`);
        num++;
      }
    }
    if (num) {
      await writelog(false, `删除过期图标：${num}`, 'user');
    }
  }
});
async function downFile(url, path) {
  try {
    const res = await axios({
      method: 'get',
      url,
      responseType: 'arraybuffer',
      timeout: 5000,
      maxContentLength: 1024 * 200,
      maxBodyLength: 1024 * 200,
    });
    await _f.p.writeFile(path, res.data);
  } catch (error) {
    throw error;
  }
}
route.get('/', async (req, res) => {
  let p = '';
  try {
    const u = new URL(req.query.u);
    const eu = encodeURIComponent(u.host);
    p = decodeURI(`${configObj.filepath}/favicon/${eu}.png`);
    if (_f.c.existsSync(p)) {
      res.sendFile(p);
      return;
    }
    const prefix = `${u.protocol}//${u.host}`;
    await _f.mkdir(`${configObj.filepath}/favicon`);
    const result = await axios({
      method: 'get',
      url: prefix,
      timeout: 5000,
    });
    const contentType = result.headers['content-type'];
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`只允许获取HTML文件`);
    }
    const $ = cheerio.load(result.data);
    const arr = $('link');
    let icon = null;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i],
        { rel, href } = item.attribs;
      if (item.name === 'link' && href && rel && rel.includes('icon')) {
        icon = item;
        break;
      }
    }
    let iconUrl = `${prefix}/favicon.ico`;
    if (icon) {
      const href = icon.attribs.href;
      if (!/^data\:image/i.test(href)) {
        if (/^http/i.test(href)) {
          iconUrl = href;
        } else if (/^\/\//.test(href)) {
          // '//aa.com/img/xxx.png
          iconUrl = u.protocol + href;
        } else if (/^\//.test(href)) {
          // '/img/xxx.png'
          iconUrl = prefix + href;
        } else if (/^\./.test(href)) {
          // './img/xxx.png'
          iconUrl = prefix + href.slice(1);
        } else {
          // 'img/xxx.png'
          iconUrl = prefix + '/' + href;
        }
      }
    }
    await downFile(iconUrl, p);
    if (_f.c.existsSync(p)) {
      try {
        const buf = await compressionImg(p);
        await _f.p.writeFile(p, buf);
        // eslint-disable-next-line no-unused-vars
      } catch (error) {}
      res.sendFile(p);
    } else {
      throw new Error(`图标不存在`);
    }
  } catch (error) {
    const dPath = resolve(__dirname, '../img/default-icon.png');
    if (p) {
      try {
        await _f.cp(dPath, p);
        // eslint-disable-next-line no-unused-vars
      } catch (error) {}
    }
    await errLog(req, `${error}(${req.query.u})`);
    res.sendFile(dPath);
  }
});

module.exports = route;
