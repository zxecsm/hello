import express from 'express';

import { resolve } from 'path';

import cheerio from '../bmk/cheerio.js';

import axios from 'axios';

import { _err, errLog, getDirname } from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import timedTask from '../../utils/timedTask.js';
import { compressionImg } from '../../utils/img.js';
import _crypto from '../../utils/crypto.js';
import _path from '../../utils/path.js';
import { cleanFavicon } from '../bmk/bmk.js';
import { _d } from '../../data/data.js';

const route = express.Router();

const __dirname = getDirname(import.meta);

const defaultIcon = resolve(__dirname, '../../img/default-icon.png');

// 定期清理图标缓存
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '002000') {
    await cleanFavicon();
  }
});

// 下载图标
async function downFile(url, path) {
  const res = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    timeout: 5000,
    maxContentLength: 1024 * 200,
    maxBodyLength: 1024 * 200,
  });

  await _f.fsp.writeFile(path, res.data);
}

route.get('/', async (req, res) => {
  let p = '',
    miss = '';

  try {
    const u = new URL(req.query.u);

    // 检查接口是否开启
    if (!_d.pubApi.faviconApi && !req._hello.userinfo.account) {
      return _err(res, '接口未开放')(req, req.query.u, 1);
    }

    p = _path.normalize(
      `${appConfig.appData}/favicon/${_crypto.getStringHash(u.host)}.png`
    );

    miss = `${p}.miss`;

    if (await _f.exists(p)) {
      res.sendFile(p);
      return;
    }

    if (await _f.exists(miss)) {
      res.sendFile(defaultIcon);
      return;
    }

    const prefix = `${u.protocol}//${u.host}`;

    await _f.mkdir(_path.dirname(p));

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
    if (await _f.exists(p)) {
      try {
        const buf = await compressionImg(p);

        await _f.fsp.writeFile(p, buf);
      } catch (error) {
        await errLog(req, `${error}(${iconUrl})`);
      }
      res.sendFile(p);
    } else {
      throw new Error(`获取图标失败`);
    }
  } catch (error) {
    if (miss) {
      try {
        await _f.fsp.writeFile(miss, '');
      } catch (err) {
        await errLog(req, `${err}(${req.query.u})`);
      }
    }

    await errLog(req, `${error}(${req.query.u})`);

    res.sendFile(defaultIcon);
  }
});

export default route;
