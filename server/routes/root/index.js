import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _connect from '../../utils/connect.js';
import mailer from '../../utils/email.js';
import _f from '../../utils/f.js';
import _2fa from '../../utils/_2fa.js';

import { runSql, db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  _success,
  _err,
  paramErr,
  createPagingData,
  isEmail,
  concurrencyTasks,
  validate,
} from '../../utils/utils.js';

import { becomeFriends, cleanUpload } from '../chat/chat.js';

import { fieldLength } from '../config.js';

import {
  _delDir,
  cleanEmptyDirectories,
  getAllFile,
  readMenu,
} from '../file/file.js';

import { deleteUser } from '../user/user.js';
import _path from '../../utils/path.js';
import { cleanFavicon, cleanSiteInfo } from '../bmk/bmk.js';
import _crypto from '../../utils/crypto.js';
import { getSystemUsage } from '../../utils/sys.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';

const route = express.Router();

// 验证管理员
route.use((req, res, next) => {
  if (!req._hello.isRoot) {
    _err(res, '无权操作')(req);
  } else {
    next();
  }
});

// 配置邮箱
route.post(
  '/email',
  validate(
    'body',
    V.object({
      state: V.number().toInt().enum([0, 1]),
      user: V.string().trim().default('').allowEmpty().max(fieldLength.email),
      pass: V.string().trim().default('').allowEmpty().max(100),
      host: V.string().trim().default('').allowEmpty().max(fieldLength.email),
      secure: V.number().toInt().enum([0, 1]),
      port: V.number().toInt().default(465).min(0),
    })
  ),
  async (req, res) => {
    try {
      const { user, pass, host, secure, port, state } = req._vdata;
      if (state === 1 && !isEmail(user)) {
        paramErr(res, req, 'user 必须为邮箱格式', 'body');
        return;
      }
      if (state === 1 && !host) {
        paramErr(res, req, 'host 不能为空', 'body');
        return;
      }

      _d.email = {
        user,
        pass,
        host,
        secure: secure === 1 ? true : false,
        port,
        state: state === 1 ? true : false,
      };

      _success(res, '更新邮箱配置成功')(req);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取用户列表
route.get(
  '/user-list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().min(1).default(1),
      pageSize: V.number()
        .toInt()
        .min(1)
        .max(fieldLength.userPageSize)
        .default(10),
    })
  ),
  async (req, res) => {
    try {
      const { pageNo, pageSize } = req._vdata;

      const total = await db('user')
        .where({ account: { '!=': appConfig.notifyAccount } })
        .count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      const offset = (result.pageNo - 1) * pageSize;

      let list = await db('user')
        .select('account,username,update_at,email,state,hide')
        .where({
          account: { '!=': appConfig.notifyAccount },
        })
        .orderBy('update_at', 'desc')
        .page(pageSize, offset)
        .find();

      const cons = _connect.getConnects();

      list = list.map((item) => {
        const con = cons[item.account];
        return {
          ...item,
          os: con ? con.onlines.map((item) => `${item.os}(${item.ip})`) : [],
          online: Date.now() - item.update_at >= 1000 * 30 ? 0 : 1,
        };
      });

      _success(res, 'ok', {
        ...result,
        registerState: _d.registerState,
        trashState: _d.trashState,
        cacheExp: _d.cacheExp,
        pubApi: _d.pubApi,
        email: _d.email,
        faviconSpareApi: _d.faviconSpareApi,
        data: list,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 备用图标api
route.post(
  '/favicon-spare-api',
  validate(
    'body',
    V.object({
      link: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.url)
        .httpUrl(),
    })
  ),
  async (req, res) => {
    try {
      const { link } = req._vdata;

      _d.faviconSpareApi = link;

      _success(res, '设置图标备用api接口成功')(req, link, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 账号状态
route.post(
  '/account-state',
  validate(
    'body',
    V.object({
      account: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.notifyAccount, appConfig.adminAccount]),
      state: V.number().toInt().default(1).enum([1, 0]),
    })
  ),
  async (req, res) => {
    try {
      const { account, state } = req._vdata;

      await db('user').where({ account }).update({ state });

      if (state === 1) {
        _success(res, '激活账号成功')(req, account, 1);
      } else {
        _success(res, '关闭账号成功')(req, account, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 刪除账号
route.post(
  '/delete-account',
  validate(
    'body',
    V.object({
      account: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.notifyAccount, appConfig.adminAccount]),
    })
  ),
  async (req, res) => {
    try {
      const { account } = req._vdata;

      await deleteUser(account); // 删除账号数据

      _success(res, '销毁账号成功')(req, account, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 清理歌曲文件
route.get('/clean-music-file', async (req, res) => {
  try {
    const musicDir = appConfig.musicDir();

    if (await _f.exists(musicDir)) {
      const songs = await db('songs').select('url').find();
      const allMusicFile = await getAllFile(musicDir);

      await concurrencyTasks(allMusicFile, 5, async (item) => {
        const { path, name } = item;

        const url = `${path.slice(musicDir.length + 1)}/${
          _path.extname(name)[0]
        }`;
        if (!songs.some((item) => _path.extname(item.url)[0] === url)) {
          await _delDir(_path.normalize(path, name));
        }
      });

      await cleanEmptyDirectories(musicDir);
    }
    _success(res, '清理歌曲文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理壁纸文件
route.get('/clean-bg-file', async (req, res) => {
  try {
    const bgDir = appConfig.bgDir();

    if (await _f.exists(bgDir)) {
      const bgs = await db('bg').find();
      const allBgFile = await getAllFile(bgDir);

      await concurrencyTasks(allBgFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalize(path.slice(bgDir.length + 1), name);
        if (!bgs.some((item) => item.url === url)) {
          await _delDir(_path.normalize(path, name));
        }
      });

      await cleanEmptyDirectories(bgDir);
    }
    _success(res, '清理壁纸文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理图床文件
route.get('/clean-pic-file', async (req, res) => {
  try {
    const picDir = appConfig.picDir();

    if (await _f.exists(picDir)) {
      const pics = await db('pic').find();
      const allPicFile = await getAllFile(picDir);

      await concurrencyTasks(allPicFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalize(path.slice(picDir.length + 1), name);
        if (!pics.some((item) => item.url === url)) {
          await _delDir(_path.normalize(path, name));
        }
      });

      await cleanEmptyDirectories(picDir);
    }
    _success(res, '清理图床文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理缩略图文件
route.get(
  '/clean-thumb-file',
  validate(
    'query',
    V.object({
      type: V.string()
        .trim()
        .enum(['pic', 'music', 'bg', 'upload', 'all', 'file']),
    })
  ),
  async (req, res) => {
    try {
      const { type } = req._vdata;

      const delP =
        type === 'all' ? appConfig.thumbDir() : appConfig.thumbDir(type);

      await _delDir(delP);

      _success(res, '清理缩略图文件成功')(req, type, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 设置注册状态
route.post('/register-state', async (req, res) => {
  try {
    _d.registerState = !_d.registerState;

    _success(
      res,
      `${_d.registerState ? '开启' : '关闭'}注册成功`,
      _d.registerState
    )(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 更新tokenKey
route.post('/update-tokenkey', async (req, res) => {
  try {
    _d.tokenKey = _crypto.generateSecureKey();

    _success(res, '更新tokenKey成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取日志
route.get(
  '/log',
  validate(
    'query',
    V.object({
      name: V.string().notEmpty().min(1).max(fieldLength.filename),
    })
  ),
  async (req, res) => {
    try {
      const { name } = req._vdata;

      const log = (await _f.readFile(appConfig.logDir(name), null, ''))
        .toString()
        .split('\n')
        .filter(Boolean)
        .reverse();

      _success(res, 'ok', log);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 日志文件列表
route.get('/log-list', async (req, res) => {
  try {
    const list = (await readMenu(appConfig.logDir())).filter(
      (f) => f.type === 'file'
    );

    list.sort((a, b) => b.time - a.time);
    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除日志
route.post(
  '/delete-log',
  validate(
    'body',
    V.object({
      name: V.string().notEmpty().min(1).max(fieldLength.filename),
    })
  ),
  async (req, res) => {
    try {
      const { name } = req._vdata;

      if (name === 'all') {
        await _delDir(appConfig.logDir());
      } else {
        await _delDir(appConfig.logDir(name));
      }

      _success(res, '删除日志成功')(req, name, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 回收站状态
route.post('/trash-state', async (req, res) => {
  try {
    _d.trashState = !_d.trashState;

    _success(
      res,
      `${_d.trashState ? '开启' : '关闭'}文件回收站成功`,
      _d.trashState
    )(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 公开api状态
route.post(
  '/pub-api-state',
  validate(
    'body',
    V.object({
      randomBgApi: V.number().toInt().enum([0, 1]),
      siteInfoApi: V.number().toInt().enum([0, 1]),
      faviconApi: V.number().toInt().enum([0, 1]),
      echoApi: V.number().toInt().enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { randomBgApi, siteInfoApi, faviconApi, echoApi } = req._vdata;

      _d.pubApi = {
        randomBgApi: !!randomBgApi,
        siteInfoApi: !!siteInfoApi,
        faviconApi: !!faviconApi,
        echoApi: !!echoApi,
      };

      _success(res, `修改接口状态成功`, _d.pubApi)(req);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 文件缓存时间
route.post(
  '/change-cache-time',
  validate(
    'body',
    V.object({
      uploadSaveDay: V.number().toInt().min(0).max(fieldLength.expTime),
      faviconCache: V.number().toInt().min(0).max(fieldLength.expTime),
      siteInfoCache: V.number().toInt().min(0).max(fieldLength.expTime),
    })
  ),
  async (req, res) => {
    try {
      const { uploadSaveDay, faviconCache, siteInfoCache } = req._vdata;

      const uploadSaveDayIschange = _d.cacheExp.uploadSaveDay !== uploadSaveDay;
      const faviconCacheIschange = _d.cacheExp.faviconCache !== faviconCache;
      const siteInfoCacheIschange = _d.cacheExp.siteInfoCache !== siteInfoCache;

      _d.cacheExp = {
        uploadSaveDay,
        faviconCache,
        siteInfoCache,
      };

      if (uploadSaveDayIschange) {
        await cleanUpload(req);
      }

      if (faviconCacheIschange) {
        await cleanFavicon(req);
      }

      if (siteInfoCacheIschange) {
        await cleanSiteInfo(req);
      }

      _success(res, `修改文件缓存过期时间成功`, _d.cacheExp)(req);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 清理数据库
route.post('/clean-database', async (req, res) => {
  try {
    await runSql('VACUUM;');
    _success(res, '清理数据库成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 自定义代码
route.post(
  '/custom-code',
  validate(
    'body',
    V.object({
      body: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `文本内容不能超过: ${fieldLength.customCodeSize} 字节`
        ),
      head: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `文本内容不能超过: ${fieldLength.customCodeSize} 字节`
        ),
    })
  ),
  async (req, res) => {
    try {
      const { body, head } = req._vdata;

      await _f.writeFile(appConfig.customDir('custom_head.html'), head);
      await _f.writeFile(appConfig.customDir('custom_body.html'), body);

      _success(res, '添加自定义代码成功')(req);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// tipsFlag
route.post(
  '/tips',
  validate(
    'bosy',
    V.object({
      flag: V.string().trim().enum(['close', 'update']),
    })
  ),
  async (req, res) => {
    try {
      const { flag } = req._vdata;

      if (flag === 'close') {
        _d.tipsFlag = 0;
      } else if (flag === 'update') {
        _d.tipsFlag = nanoid();
      }

      const temId = nanoid();

      Object.keys(_connect.getConnects()).forEach((key) => {
        _connect.send(key, temId, {
          type: 'updatedata',
          data: {
            flag: 'tips',
          },
        });
      });

      _success(res, '修改tips状态成功')(req, _d.tipsFlag, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 测试邮箱
route.post(
  '/test-email',
  validate(
    'body',
    V.object({
      email: V.string().trim().min(1).max(fieldLength.email).email(),
    })
  ),
  async (req, res) => {
    try {
      const { email } = req._vdata;

      if (!_d.email.state) {
        _err(res, '未开启邮箱验证');
        return;
      }

      await mailer.sendMail(email, 'Hello账号验证邮件', '测试邮件');
      _success(res, '测试邮件发送成功')(req, email, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 测试两步验证
route.post(
  '/test-tfa',
  validate(
    'body',
    V.object({ token: V.string().trim().min(6).max(6).alphanumeric() })
  ),
  async (req, res) => {
    try {
      const { token } = req._vdata;

      const verify = req._hello.userinfo.verify;

      if (!verify) {
        _err(res, '未开启两步验证')(req);
      } else if (_2fa.verify(verify, token)) {
        _success(res, '验证码正确')(req);
      } else {
        _err(res, '验证码错误')(req);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 创建帐号
route.post(
  '/create-account',
  validate(
    'body',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { username, password } = req._vdata;

      const userInfo = await db('user')
        .select('account')
        .where({ username })
        .findOne();
      if (userInfo) {
        _err(res, '用户名已注册')(req, username, 1);
        return;
      }

      // 写入用户数据
      const account = nanoid();

      await db('user').insert({
        create_at: Date.now(),
        update_at: 0,
        account,
        username,
        chat_id: nanoid(),
        password: await _crypto.hashPassword(password),
      });

      await becomeFriends(account, appConfig.chatRoomAccount);
      await becomeFriends(account, appConfig.notifyAccount);

      _success(res, '创建账号成功', { account, username })(
        req,
        `${username}-${account}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 系统状态
route.get('/sys-status', async (req, res) => {
  try {
    _success(res, 'ok', await getSystemUsage());
  } catch (error) {
    _err(res)(req, error);
  }
});

// 定期清理聊天过期文件
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '003000') {
    await cleanUpload();

    // 定期清理LOG文件
    const list = (await readMenu(appConfig.logDir())).filter(
      (f) => f.type === 'file'
    );

    if (list.length > 200) {
      list.sort((a, b) => b.time - a.time);
      for (const item of list.slice(200)) {
        const { name, path } = item;
        const p = _path.normalize(path, name);
        await _delDir(p);
      }
    }
  }
});

export default route;
