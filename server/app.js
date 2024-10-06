import os from 'os';
//Cookie
import cookieParser from 'cookie-parser';

import express from 'express';

// 获取访问设备信息
import UAParser from 'ua-parser-js';

import {
  writelog,
  getClientIp,
  getIn,
  _err,
  debounce,
  getDirname,
} from './utils/utils.js';

import { resolve } from 'path';

import configObj from './data/config.js';

import verifyLimit from './utils/verifyLimit.js';

import { heperMsgAndForward } from './routes/chat/chat.js';

import { jwtde, setCookie } from './utils/jwt.js';

import { getUserInfo } from './routes/user/user.js';

import './data/createData.js';

import bgRoute from './routes/bg/index.js';
import bmkRoute from './routes/bmk/index.js';
import chatRoute from './routes/chat/index.js';
import countRoute from './routes/count/index.js';
import fileRoute from './routes/file/index.js';
import getfaviconRoute from './routes/getfavicon/index.js';
import getfileRoute from './routes/getfile/index.js';
import noteRoute from './routes/note/index.js';
import notepadRoute from './routes/notepad/index.js';
import picRoute from './routes/pic/index.js';
import playerRoute from './routes/player/index.js';
import rootRoute from './routes/root/index.js';
import searchRoute from './routes/search/index.js';
import todoRoute from './routes/todo/index.js';
import userRoute from './routes/user/index.js';

const __dirname = getDirname(import.meta);

const app = express();

//Cookie
app.use(cookieParser());
app.use(express.json({ limit: '20000kb' }));
app.use(express.urlencoded({ extended: true, limit: '20000kb' }));
app.use(express.static(resolve(__dirname, 'static')));

const reqLimit = verifyLimit({ space: 10, count: 500 }, false);

const informReqLimit = debounce(
  async (req) => {
    try {
      const { os, ip } = req._hello;
      await heperMsgAndForward(req, 'root', `[${os}(${ip})] 请求频率超过限制`);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {}
  },
  5000,
  1
);

app.use(async (req, res, next) => {
  try {
    const _clientConfig = new UAParser(req.headers['user-agent']).getResult(); //获取访问设备信息

    const osName = `${getIn(_clientConfig, ['os', 'name']) || 'other'}${
      getIn(_clientConfig, ['os', 'version']) || ''
    }`;
    const browser = getIn(_clientConfig, ['browser', 'name']);
    const osVendor = getIn(_clientConfig, ['device', 'vendor']);
    const osModel = getIn(_clientConfig, ['device', 'model']);
    const cpu = getIn(_clientConfig, ['cpu', 'architecture']);

    req._hello = {
      path: req.path,
      temid: req.headers['temid'],
      jwt: jwtde(req.cookies.token),
      ip: getClientIp(req),
      os: `${osName} (${browser || ''}${cpu ? ' ' + cpu : ''}${
        osVendor ? ' ' + osVendor + ' ' + osModel : ''
      })`,
      method: req.method.toLocaleLowerCase(),
    };

    const { jwt, ip, method, path } = req._hello;

    const flag = jwt.userinfo.account || '';

    if (reqLimit.verify(ip, flag)) {
      reqLimit.add(ip, flag);

      await writelog(req, `${method}(${path})`);
      next();
    } else {
      informReqLimit(req);
      _err(res, '请求频率超过限制')(req);
    }
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    _err(res);
  }
});

app.use(
  '/api/pub/font',
  express.static(`${configObj.filepath}/font`, { maxAge: 2592000000 })
);
app.use(
  '/api/pub/share',
  express.static(`${configObj.filepath}/share`, { maxAge: 2592000000 })
);
app.use(
  '/api/pub/logo',
  express.static(`${configObj.filepath}/logo`, { maxAge: 2592000000 })
);
app.use(
  '/api/pub/picture',
  express.static(`${configObj.filepath}/pic`, { maxAge: 2592000000 })
);
app.use(
  '/api/pub/searchlogo',
  express.static(`${configObj.filepath}/searchlogo`, { maxAge: 2592000000 })
);
app.use(
  '/api/pub/playerlogo',
  express.static(`${configObj.filepath}/playerlogo`, { maxAge: 2592000000 })
);
app.use('/api/getfavicon', getfaviconRoute);

app.use(async (req, res, next) => {
  try {
    req._hello.userinfo = {};

    const {
      userinfo: { account },
      iat,
      exp,
    } = req._hello.jwt;

    if (account && account !== 'hello') {
      const user = await getUserInfo(account, '*');

      if (user) {
        //对比token生成的时间
        if ((user.exp_token_time || 0) < iat) {
          req._hello.userinfo = user;
          if (Date.now() / 1000 - iat >= (exp - iat) / 2) {
            const { account, username } = req._hello.userinfo;
            setCookie(res, { account, username });
          }
        }
      }
    }
    next();
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    _err(res);
  }
});

app.use('/api/user', userRoute);
app.use('/api/bg', bgRoute);
app.use('/api/pic', picRoute);
app.use('/api/root', rootRoute);
app.use('/api/player', playerRoute);
app.use('/api/bmk', bmkRoute);
app.use('/api/chat', chatRoute);
app.use('/api/search', searchRoute);
app.use('/api/note', noteRoute);
app.use('/api/getfile', getfileRoute);
app.use('/api/todo', todoRoute);
app.use('/api/count', countRoute);
app.use('/api/file', fileRoute);
app.use('/api/notepad', notepadRoute);

app.use((req, res) => {
  res.sendFile(resolve(__dirname, 'data/404.html'));
});

app.listen(configObj.port, () => {
  const arr = getLocahost().map(
    (item) =>
      `http://${item}${configObj.port === 80 ? '' : `:${configObj.port}`}`
  );
  // eslint-disable-next-line no-console
  console.log(`
  __   __  ______  __     __       __ 
 |  | |  ||  ____||  |   |  |    / __ \\
 |  |_|  || |____ |  |   |  |   | |  | |
 |   _   ||  ____||  |   |  |   | |  | |
 |  | |  || |____ |  |__ |  |__ | |__| |
 |__| |__||______||_____||_____| \\ __ / 
 `);
  // eslint-disable-next-line no-console
  console.log(`服务开启成功，访问地址为：\n${arr.join('\n')}`);
});

function getLocahost() {
  const obj = os.networkInterfaces();
  let arr = [];
  Object.keys(obj).forEach((item) => {
    let value = obj[item];
    if (Object.prototype.toString.call(value).slice(8, -1) === 'Array') {
      arr = [
        ...arr,
        ...value
          .filter((item) => item.family === 'IPv4')
          .map((item) => item.address),
      ];
    }
  });
  return arr;
}
