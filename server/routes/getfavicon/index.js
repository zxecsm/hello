import express from 'express';

import { resolve } from 'path';

import cheerio from '../bmk/cheerio.js';

import axios from 'axios';

import { _err, errLog, getDirname, tplReplace } from '../../utils/utils.js';

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

// 提取图标
function extractIconUrl($, prefix, protocol) {
  const links = $('link');
  for (const el of links) {
    const { rel, href } = el.attribs;
    if (href && rel?.includes('icon')) {
      if (/^data:image/i.test(href)) continue;
      if (/^http/i.test(href)) return href;
      // //aa.com/img/xxx.png
      if (/^\/\//.test(href)) return protocol + href;
      // /img/xxx.png
      if (/^\//.test(href)) return prefix + href;
      // ./img/xxx.png
      if (/^\./.test(href)) return prefix + href.slice(1);
      // img/xxx.png
      return prefix + '/' + href;
    }
  }
  return `${prefix}/favicon.ico`;
}

route.get('/', async (req, res) => {
  const urlStr = req.query.u;
  let iconPath = '',
    missFlagPath = '';

  try {
    const u = new URL(urlStr);

    // 检查接口是否开启
    if (!_d.pubApi.faviconApi && !req._hello.userinfo.account) {
      return _err(res, '接口未开放')(req, urlStr, 1);
    }

    iconPath = _path.normalize(
      `${appConfig.appData}/favicon/${_crypto.getStringHash(u.host)}.png`
    );

    missFlagPath = `${iconPath}.miss`;

    if (await _f.exists(iconPath)) {
      res.sendFile(iconPath, { dotfiles: 'allow' });
      return;
    }

    if (await _f.exists(missFlagPath)) {
      res.sendFile(defaultIcon, { dotfiles: 'allow' });
      return;
    }

    const prefix = `${u.protocol}//${u.host}`;

    await _f.mkdir(_path.dirname(iconPath));

    try {
      // 自行解析获取图标
      const htmlResp = await axios.get(prefix, { timeout: 5000 });
      const contentType = htmlResp.headers['content-type'] || '';
      if (!contentType.includes('text/html'))
        throw new Error(`只允许获取HTML文件`);

      const $ = cheerio.load(htmlResp.data);
      await downFile(extractIconUrl($, prefix, u.protocol), iconPath);
    } catch (err) {
      // 调用备用接口获取图标
      if (_d.faviconSpareApi) {
        await downFile(
          tplReplace(_d.faviconSpareApi, {
            host: u.host,
            protocol: u.protocol,
            port: u.port,
          }),
          iconPath
        );
      } else {
        throw err;
      }
    }

    if (await _f.exists(iconPath)) {
      try {
        // 压缩图标
        const buf = await compressionImg(iconPath);

        await _f.fsp.writeFile(iconPath, buf);
      } catch (error) {
        await errLog(req, `${error}(${urlStr})`);
      }
      res.sendFile(iconPath, { dotfiles: 'allow' });
    } else {
      throw new Error(`获取图标失败`);
    }
  } catch (error) {
    if (missFlagPath) {
      try {
        await _f.fsp.writeFile(missFlagPath, '');
      } catch (err) {
        await errLog(req, `${err}(${urlStr})`);
      }
    }

    await errLog(req, `${error}(${urlStr})`);

    res.sendFile(defaultIcon, { dotfiles: 'allow' });
  }
});

export default route;
