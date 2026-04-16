import express from 'express';

import {
  receiveFiles,
  mergefile,
  syncUpdateData,
  concurrencyTasks,
  errorNotifyMsg,
  formatDate,
  createPagingData,
  getDuplicates,
  isMusicFile,
  isImgFile,
  writelog,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { getFriendInfo, heperMsgAndForward } from '../chat/chat.js';

import fileSize from './cacheFileSize.js';

import {
  readMenu,
  getUniqueFilename,
  sortFileList,
  hasSameNameFile,
  readFavorites,
  readHistoryDirs,
  writeHistoryDirs,
  writeFavorites,
  fileToMusic,
  fileToBg,
} from './file.js';

import { fieldLength } from '../config.js';

import { validShareState, validShareAddUserState } from '../user/user.js';

import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import taskState from '../../utils/taskState.js';
import zipper from '../../utils/zip.js';
import fileList from './cacheFileList.js';
import nanoid from '../../utils/nanoid.js';
import _crypto from '../../utils/crypto.js';
import V from '../../utils/validRules.js';
import request from '../../utils/request.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 分享文件
route.post(
  '/get-share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      pass: V.string().trim().default('').allowEmpty().max(fieldLength.sharePass),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, pass, captchaId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const share = await validShareAddUserState(res, ['file', 'dir'], id, pass, captchaId);

    if (share.state === 3) {
      return resp.ok(res, share.text)();
    }

    if (share.state === 2) {
      return resp.success(res, share.text, {
        id: share.id,
        needCaptcha: share.needCaptcha,
      })();
    }

    if (share.state === 0) {
      return resp.notFound(res, share.text)();
    }

    let { username, logo, email, exp_time, title, account: acc, data } = share.data;

    if (account && account != acc) {
      const f = await getFriendInfo(account, acc, 'des');
      const des = f ? f.des : '';
      username = des || username;
    }

    resp.success(res, '获取文件分享成功', {
      username,
      logo,
      email,
      exp_time,
      account: acc,
      data,
      title,
      token: await jwt.set(
        { type: 'share', data: { id, types: ['file', 'dir'] } },
        fieldLength.shareTokenExp,
      ),
    })();
  }),
);

// 读取目录
function fileListSortAndCacheSize(list, rootP, sortType, isDesc, hidden) {
  list = list.reduce((pre, cur) => {
    const fullPath = _path.normalizeNoSlash(rootP, cur.path, cur.name);

    // 隐藏隐藏文件
    if (hidden === 1 && cur.name.startsWith('.')) return pre;

    if (cur.type === 'dir') {
      // 读取缓存目录大小
      cur.size = fileSize.get(fullPath);
    }

    pre.push(cur);

    return pre;
  }, []);

  return sortFileList(list, sortType, isDesc);
}
route.post(
  '/read-dir',
  validate(
    'body',
    V.object({
      path: V.string().min(1).notEmpty().max(fieldLength.url),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().default(20).toInt().min(1).max(fieldLength.maxPagesize),
      sortType: V.string().trim().default('time').enum(['name', 'time', 'size', 'type']),
      isDesc: V.number().default(1).toInt().enum([0, 1]),
      subDir: V.number().default(0).toInt().enum([0, 1]),
      update: V.number().default(0).toInt().enum([0, 1]),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
      hidden: V.number().default(0).toInt().enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, pageNo, pageSize, sortType, isDesc, subDir, update, word, token, hidden } =
      res.locals.ctx;

    let temid = res.locals.hello.temid;
    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    const { account } = res.locals.hello.userinfo;

    if (!token && !account) {
      return resp.unauthorized(res)();
    }

    let p = '';
    let rootP = '';
    let accFlag = '';

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        return resp.forbidden(res, share.text)();
      }

      const { data, account, id: shareID } = share.data;

      const { name } = data;

      // 用户根目录
      rootP = appConfig.userRootDir(account, data.path, name);

      p = _path.normalizeNoSlash(rootP, path);
      accFlag = shareID + account || temid;
    } else {
      p = appConfig.userRootDir(account, path);
      rootP = appConfig.userRootDir(account);
      accFlag = account;
    }

    let favorites = null;
    if (account && !token) {
      try {
        // 保存路径历史
        let list = (await readHistoryDirs(account)).filter((item) => item !== path);

        list.push(path);

        if (list.length > fieldLength.cdHistoryLength) {
          list = list.slice(-fieldLength.cdHistoryLength);
        }

        await writeHistoryDirs(account, list);

        favorites = await readFavorites(account);
      } catch (error) {
        await writelog(res, error, 500);
      }
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const hdType = word ? '搜索文件' : '读取文件列表';
    const taskKey = taskState.add(accFlag, `${hdType}...`, controller);

    const cacheList = fileList.get(accFlag, `${p}_${word}`);

    // 有缓存则返回缓存
    if (update === 0 && cacheList) {
      fileList.resetExpireTime(accFlag, `${p}_${word}`);
      taskState.delete(taskKey);

      return resp.success(
        res,
        'ok',
        createPagingData(
          fileListSortAndCacheSize(cacheList, rootP, sortType, isDesc, hidden),
          pageSize,
          pageNo,
        ),
      )();
    }

    // 超时获取不到则当任务处理
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;

      resp.success(res, 'ok', { key: taskKey })();
    }, 1000);

    try {
      let arr = [];
      let count = 0;

      if (await _f.getType(p)) {
        const stack = [p];

        while (stack.length > 0 && !signal.aborted) {
          const currentPath = stack.pop();
          const list = await readMenu(currentPath);

          for (const item of list) {
            if (signal.aborted) break;

            count++;
            taskState.update(taskKey, `${hdType}...${count}`);

            const fullPath = _path.normalizeNoSlash(item.path, item.name);

            if (item.type === 'dir' && subDir === 1 && word) {
              stack.push(fullPath);
            }

            // 去除路径前缀
            const path = _path.normalizeNoSlash('/' + item.path.slice(rootP.length));

            const obj = {
              ...item,
              path,
            };

            if (
              obj.type === 'file' &&
              obj.fileType === 'symlink' &&
              _path.isPathWithin(rootP, obj.linkTarget, 1)
            ) {
              obj.linkTarget = _path.normalizeNoSlash('/' + item.linkTarget.slice(rootP.length));
            }

            if (favorites && item.type === 'dir') {
              obj.favorite = favorites.includes(_path.normalizeNoSlash(path, item.name)) ? 1 : 0;
            }

            if (!res.locals.hello.isRoot) {
              delete obj.mode;
              delete obj.gid;
              delete obj.uid;
            }

            // 关键词过滤
            if (!word || (word && obj.name.toLowerCase().includes(word.toLowerCase()))) {
              arr.push(obj);
            }
          }
        }
      }

      // 未超时直接返回结果
      if (timer) {
        clearTimeout(timer);
        timer = null;
        taskState.delete(taskKey);

        resp.success(
          res,
          'ok',
          createPagingData(
            fileListSortAndCacheSize(arr, rootP, sortType, isDesc, hidden),
            pageSize,
            pageNo,
          ),
        )();
      } else {
        taskState.done(taskKey);
        // 超时缓存结果
        fileList.add(accFlag, `${p}_${word}`, arr);
      }
    } catch (error) {
      taskState.delete(taskKey);

      // 未超时直接返回失败
      if (timer) {
        clearTimeout(timer);
        timer = null;
        resp.forbidden(res, `${hdType}失败`)(error, 1);
      } else {
        await writelog(res, `${hdType}失败(${error})`, 500);
        if (account) {
          errorNotifyMsg(res, `${hdType}失败`);
        }
      }
    }
  }),
);

// 读取文件
route.post(
  '/read-file',
  validate(
    'body',
    V.object({
      path: V.string().default('').allowEmpty().max(fieldLength.url),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, token } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (!token && !account) {
      return resp.unauthorized(res)();
    }

    let p = '';

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        return resp.forbidden(res, share.text)();
      }

      const { data, account } = share.data;

      const { name, type } = data;

      const rootP = appConfig.userRootDir(account, data.path, name);

      if (type === 'file') {
        p = rootP;
      } else if (type === 'dir') {
        p = _path.normalizeNoSlash(rootP, path);
      }
    } else {
      p = appConfig.userRootDir(account, path);
    }

    const stat = await _f.lstat(p);

    if (!stat || (await _f.getType(stat)) === 'dir') {
      return resp.forbidden(res, '文件不存在')();
    }

    // 文本文件并且小于等于10M直接返回
    if (stat.size <= fieldLength.textFileSize && (await _f.isTextFile(p))) {
      //文本文件
      resp.success(res, 'ok', {
        type: 'text',
        data: (await _f.readFile(p, null, '')).toString(),
      })();
    } else {
      resp.success(res, 'ok', {
        type: 'other',
      })();
    }
  }),
);

// 验证登录态
route.use(
  asyncHandler((_, res, next) => {
    if (res.locals.hello.userinfo.account) {
      next();
    } else {
      resp.unauthorized(res)();
    }
  }),
);

// 文件编辑历史记录
route.post(
  '/history-state',
  validate(
    'body',
    V.object({
      state: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { state } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('user').where({ account, state: 1 }).update({ file_history: state });

    resp.success(res, `${state === 0 ? '关闭' : '开启'}文件历史记录成功`)();
  }),
);
route.get(
  '/history-state',
  asyncHandler(async (_, res) => {
    const { file_history } = res.locals.hello.userinfo;
    resp.success(res, 'ok', { file_history })();
  }),
);

// 获取访问路径历史
route.get(
  '/cd-history',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;
    resp.success(res, 'ok', await readHistoryDirs(account))();
  }),
);

// 获取收藏目录
route.get(
  '/favorites',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;
    resp.success(res, 'ok', await readFavorites(account))();
  }),
);

// 收藏目录
route.post(
  '/favorites',
  validate(
    'body',
    V.object({
      type: V.string().trim().default('add').enum(['add', 'del']),
      data: V.object({
        name: V.string().notEmpty().min(1).max(fieldLength.filename),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().equal('dir'),
      }),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, type } = res.locals.ctx;

    const path = _path.normalizeNoSlash(data.path, data.name);

    const { account } = res.locals.hello.userinfo;
    const list = (await readFavorites(account)).filter((item) => item !== path);

    if (type === 'add') {
      list.push(path);
    }

    await writeFavorites(account, list);

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, `${type === 'add' ? '' : '移除'}收藏文件夹成功`)();
  }),
);

// 读取目录大小
route.get(
  '/read-dir-size',
  validate(
    'query',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `读取文件夹大小...`, controller);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let size = 0;
      let count = 0;

      await _f.readDirSize(p, {
        signal,
        progress({ size: s, count: c }) {
          if (s) size += s;
          if (c) count++;
          taskState.update(taskKey, `读取文件夹大小...${count} (${_f.formatBytes(size)})`);
        },
      });

      taskState.done(taskKey);
      if (!signal.aborted) {
        fileSize.add(p, size);
        syncUpdateData(res, 'file');
      }
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `读取文件夹大小失败`;
      await writelog(res, `${errText}(${error})`, 500);
      errorNotifyMsg(res, errText);
    }
  }),
);

// 新建文件
route.post(
  '/create-file',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      name: V.string().trim().min(1).max(fieldLength.filename),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, name } = res.locals.ctx;

    if (!_path.isFilename(name)) {
      return resp.forbidden(res, '名称包含了不允许的特殊字符')();
    }

    const { account } = res.locals.hello.userinfo;

    const fpath = appConfig.userRootDir(account, `${path}/${name}`);

    // 过滤回收站
    if ((await _f.exists(fpath)) || appConfig.trashDir(account) === fpath) {
      return resp.forbidden(res, '已存在重名文件')();
    }

    await _f.writeFile(fpath, '');

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, '新建文件成功')();
  }),
);

// 创建符号链接
route.post(
  '/create-link',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      name: V.string().trim().min(1).max(fieldLength.filename),
      targetPath: V.string().notEmpty().min(1).max(fieldLength.url),
      isSymlink: V.number().toInt().default(1).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, name, targetPath, isSymlink } = res.locals.ctx;

    if (!_path.isFilename(name)) {
      return resp.forbidden(res, '名称包含了不允许的特殊字符')();
    }

    const { account } = res.locals.hello.userinfo;

    const curPath = appConfig.userRootDir(account, `${path}/${name}`);
    const tPath = appConfig.userRootDir(account, targetPath);

    const tType = await _f.getType(tPath);

    if (!tType) {
      return resp.forbidden(res, '目标路径不存在')();
    }

    // 过滤回收站
    if ((await _f.exists(curPath)) || appConfig.trashDir(account) === curPath) {
      return resp.forbidden(res, '已存在重名文件')();
    }

    if (isSymlink) {
      await _f.symlink(tPath, curPath);
    } else {
      if (tType === 'dir') {
        return resp.forbidden(res, '不能创建目录的硬链接')();
      }
      await _f.link(tPath, curPath);
    }

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, '新建符号链接成功')();
  }),
);

// 分享
route.post(
  '/share',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      expireTime: V.number().toInt().max(fieldLength.expTime),
      pass: V.string().trim().default('').allowEmpty().max(fieldLength.sharePass),
      data: V.object({
        name: V.string().notEmpty().min(1).max(fieldLength.filename),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().enum(['dir', 'file']),
        size: V.number().toNumber().min(0),
      }),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, title, expireTime, pass } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('share').insert({
      id: nanoid(),
      create_at: Date.now(),
      account,
      type: data.type,
      exp_time: expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(data),
    });

    syncUpdateData(res, 'sharelist');

    resp.success(res, `分享${data.type === 'dir' ? '文件夹' : '文件'}成功`)();
  }),
);

// 保存文件
route.post(
  '/save-file',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      text: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.textFileSize,
          `编辑文本文件不能超过: ${fieldLength.textFileSize} 字节`,
        ),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, text } = res.locals.ctx;

    const { account, file_history } = res.locals.hello.userinfo;

    const fpath = appConfig.userRootDir(account, path);

    const stat = await _f.lstat(fpath);
    const type = await _f.getType(stat);

    if (!type || type === 'dir' || appConfig.trashDir(account) === fpath) {
      return resp.forbidden(res, '文件不存在')();
    }

    if (type === 'file') {
      if (file_history === 1) {
        try {
          if (stat.size > 0) {
            // 保存编辑历史版本
            const [, filename, , suffix] = _path.basename(fpath);

            const historyDir = _path.normalizeNoSlash(
              _path.dirname(fpath),
              appConfig.textFileHistoryDirName,
            );

            const newName = `${filename}_${formatDate({
              template: `{0}{1}{2}-{3}{4}{5}`,
            })}${suffix ? `.${suffix}` : ''}`;

            await _f.cp(fpath, _path.normalizeNoSlash(historyDir, newName));
          }
        } catch (error) {
          await writelog(res, `保存文件历史版本失败(${error})`, 500);
        }
      }
    }

    await _f.writeFile(fpath, text);

    // 修改搜索引擎配置, 触发更新
    if (appConfig.searchConfigDir(account, 'config.json') === fpath) {
      syncUpdateData(res, 'searchConfig', '', 'all');
    }

    // 修改快捷命令配置, 触发更新
    if (appConfig.sshConfigDir(account, 'quick.json') === fpath) {
      syncUpdateData(res, 'quickCommand', '', 'all');
    }

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, '保存文件成功')();
  }),
);

// 复制
route.post(
  '/copy',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      rename: V.number().toInt().enum([0, 1]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize)
        .custom((arr) => getDuplicates(arr, ['name']).length === 0, '不能有同名文件或文件夹'),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, data, rename } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);

    if ((await _f.getType(p)) !== 'dir') {
      return resp.forbidden(res, '目标文件夹不存在')();
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `复制文件...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;
      let size = 0;

      const trashDir = appConfig.trashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) throw new Error('Operation aborted');

        const { name, path } = task;

        const f = appConfig.userRootDir(account, `${path}/${name}`);

        let to = _path.normalizeNoSlash(p, name);

        if (_path.isPathWithin(f, to) || !name) return;

        // 已存在添加后缀
        if (((await _f.exists(to)) && rename === 1) || to === trashDir) {
          to = await getUniqueFilename(to);
        }

        if (f === to) return;

        await _f.cp(f, to, {
          signal,
          progress({ size: s, count: c }) {
            if (s) size += s;
            if (c) count++;
            taskState.update(taskKey, `复制文件...${count} (${_f.formatBytes(size)})`);
          },
        });
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `复制文件失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 是否存在同名文件
route.post(
  '/same-name',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, data } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);

    if ((await _f.getType(p)) !== 'dir') {
      return resp.forbidden(res, '目标文件夹不存在')();
    }

    resp.success(res, 'ok', { hasSameName: await hasSameNameFile(p, data) })();
  }),
);

// 移动
route.post(
  '/move',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      rename: V.number().toInt().enum([0, 1]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize)
        .custom((arr) => getDuplicates(arr, ['name']).length === 0, '不能有同名文件或文件夹'),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, data, rename } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);

    if ((await _f.getType(p)) !== 'dir') {
      return resp.forbidden(res, '目标文件夹不存在')();
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `移动文件...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;
      let size = 0;

      const trashDir = appConfig.trashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) throw new Error('Operation aborted');

        const { name, path } = task;

        const f = appConfig.userRootDir(account, `${path}/${name}`);

        let t = _path.normalizeNoSlash(p, name);

        if (_path.isPathWithin(f, t, true)) return;

        if (((await _f.exists(t)) && rename === 1) || t === trashDir) {
          t = await getUniqueFilename(t);
        }

        await _f.rename(f, t, {
          signal,
          progress({ size: s, count: c }) {
            if (!s && !c) return;
            if (s) size += s;
            if (c) count++;
            taskState.update(taskKey, `移动文件...${count} (${_f.formatBytes(size)})`);
          },
        });
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `移动文件失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 压缩
route.post(
  '/zip',
  validate(
    'body',
    V.object({
      data: V.object({
        name: V.string().notEmpty().min(1).max(fieldLength.filename),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().enum(['dir', 'file']),
      }),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data } = res.locals.ctx;

    const flag = data.type === 'dir' ? '文件夹' : '文件';

    const { name, path } = data;

    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);

    data.path = p;

    const f = _path.normalizeNoSlash(p, name);

    if (!(await _f.exists(f))) {
      return resp.forbidden(res, `${flag}不存在`)();
    }

    const fname = (_path.extname(name)[0] || name) + '.zip';

    let t = _path.normalizeNoSlash(p, fname);

    if ((await _f.exists(t)) || t === appConfig.trashDir(account)) {
      t = await getUniqueFilename(t);
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `压缩文件...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      await zipper.zip([data], t, {
        signal,
        progress({ size, count }) {
          taskState.update(taskKey, `压缩文件...${count} (${_f.formatBytes(size)})`);
        },
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `压缩${flag}失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 解压缩
route.post(
  '/unzip',
  validate(
    'body',
    V.object({
      data: V.object({
        name: V.string()
          .notEmpty()
          .min(1)
          .max(fieldLength.filename)
          .custom((v) => _path.extname(v)[2].toLowerCase() === 'zip', '必须是.zip文件'),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().equal('file'),
      }),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data } = res.locals.ctx;

    const { name, path } = data;

    const { account } = res.locals.hello.userinfo;

    const p = appConfig.userRootDir(account, path);
    const f = _path.normalizeNoSlash(p, name);

    if ((await _f.getType(f)) !== 'file') {
      return resp.forbidden(res, '解压文件不存在')();
    }

    const fname = _path.extname(name)[0] || name;

    let t = _path.normalizeNoSlash(p, fname);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `解压文件...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      if ((await _f.exists(t)) || t === appConfig.trashDir(account)) {
        t = await getUniqueFilename(t);
      }

      await zipper.unzip(f, t, {
        signal,
        progress({ size, count }) {
          taskState.update(taskKey, `解压文件...${count} (${_f.formatBytes(size)})`);
        },
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `解压文件失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 删除
route.post(
  '/delete',
  validate(
    'body',
    V.object({
      force: V.number().toInt().enum([1, 0]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, force } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `删除文件...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;
      let size = 0;

      const trashDir = appConfig.trashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) throw new Error('Operation aborted');

        let { path, name } = task;

        const p = appConfig.userRootDir(account, `${path}/${name}`);

        if (
          force === 1 ||
          _path.isPathWithin(p, trashDir, true) ||
          _path.isPathWithin(trashDir, p, true)
        ) {
          await _f.del(p, {
            signal,
            progress({ size: s, count: c }) {
              if (s) size += s;
              if (c) count++;
              taskState.update(taskKey, `删除文件...${count} (${_f.formatBytes(size)})`);
            },
          });
        } else {
          let targetPath = _path.normalizeNoSlash(trashDir, name);
          if (await _f.exists(targetPath)) {
            targetPath = await getUniqueFilename(targetPath);
          }

          taskState.update(taskKey, `放入回收站...`);
          await _f.rename(p, targetPath, {
            signal,
            progress({ size: s, count: c }) {
              if (!s && !c) return;
              if (s) size += s;
              if (c) count++;
              taskState.update(taskKey, `放入回收站...${count} (${_f.formatBytes(size)})`);
            },
          });
        }
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `删除文件失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 清空回收站
route.get(
  '/clear-trash',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `清空回收站...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;
      let size = 0;

      const trashDir = appConfig.trashDir(account);

      if ((await _f.getType(trashDir)) === 'dir') {
        const list = await _f.fsp.readdir(trashDir);

        await concurrencyTasks(list, 5, async (item) => {
          if (signal.aborted) throw new Error('Operation aborted');

          const p = _path.normalizeNoSlash(trashDir, item);

          await _f.del(p, {
            signal,
            progress({ size: s, count: c }) {
              if (s) size += s;
              if (c) count++;
              taskState.update(taskKey, `删除文件...${count} (${_f.formatBytes(size)})`);
            },
          });
        });
      }

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `清空回收站失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 新建目录
route.post(
  '/create-dir',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      name: V.string().trim().min(1).max(fieldLength.filename),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, name } = res.locals.ctx;

    if (!_path.isFilename(name)) {
      return resp.forbidden(res, '名称包含了不允许的特殊字符')();
    }

    const { account } = res.locals.hello.userinfo;

    const fpath = appConfig.userRootDir(account, `${path}/${name}`);

    if (await _f.exists(fpath)) {
      return resp.forbidden(res, '已存在重名文件')();
    }

    await _f.mkdir(fpath);

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, '新建文件夹成功')();
  }),
);

// 重命名
route.post(
  '/rename',
  validate(
    'body',
    V.object({
      name: V.string().trim().min(1).max(fieldLength.filename),
      data: V.object({
        name: V.string().notEmpty().min(1).max(fieldLength.filename),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().enum(['dir', 'file']),
      }),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, name } = res.locals.ctx;

    if (!_path.isFilename(name)) {
      return resp.forbidden(res, '名称包含了不允许的特殊字符')();
    }

    const flag = data.type === 'dir' ? '文件夹' : '文件';

    const { account } = res.locals.hello.userinfo;

    const dir = appConfig.userRootDir(account, data.path);

    const p = _path.normalizeNoSlash(dir, data.name),
      t = _path.normalizeNoSlash(dir, name);

    if (!(await _f.exists(p))) {
      return resp.forbidden(res, `${flag}不存在`)();
    }

    if ((await _f.exists(t)) || appConfig.trashDir(account) === t) {
      return resp.forbidden(res, '已存在重名文件')();
    }

    await _f.rename(p, t);

    syncUpdateData(res, 'file');

    fileList.clear(account);

    resp.success(res, `重命名${flag}成功`)();
  }),
);

// 文件权限
route.post(
  '/mode',
  validate(
    'body',
    V.object({
      mode: V.string()
        .trim()
        .pattern(/^[0-7]{3}$/, '必须为三位数字组成'),
      r: V.number().toInt().default(0).enum([0, 1]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, mode, r } = res.locals.ctx;

    if (!res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    const { account } = res.locals.hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `设置权限...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) throw new Error('Operation aborted');

        const { name, path } = task;

        const p = appConfig.userRootDir(account, `${path}/${name}`);

        await _f.chmod(p, mode, {
          signal,
          progress({ count: c }) {
            if (c) count++;
            taskState.update(taskKey, `设置权限...${count}`);
          },
          recursive: r,
        });
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `设置权限失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 文件用户组
route.post(
  '/chown',
  validate(
    'body',
    V.object({
      uid: V.number().toInt().default(0).min(0),
      gid: V.number().toInt().default(0).min(0),
      r: V.number().toInt().default(0).enum([0, 1]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { data, uid, gid, r } = res.locals.ctx;

    if (!res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    const { account } = res.locals.hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `设置用户组...`, controller);

    fileList.clear(account);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let count = 0;

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) throw new Error('Operation aborted');

        const { name, path } = task;

        const p = appConfig.userRootDir(account, `${path}/${name}`);

        await _f.chown(p, uid, gid, {
          signal,
          progress({ count: c }) {
            if (c) count++;
            taskState.update(taskKey, `设置用户组...${count}`);
          },
          recursive: r,
        });
      });

      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `设置用户组失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 上传
route.post(
  '/up',
  validate(
    'query',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      name: V.string()
        .trim()
        .min(1)
        .max(20)
        .pattern(/^_[0-9]+$/, '必须 _ 开头数字结尾'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, name } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const path = appConfig.temDir(`${account}_${HASH}`);

    await receiveFiles(req, path, name, fieldLength.maxFileChunk);

    resp.success(res)();
  }),
);

// 合并文件
route.post(
  '/merge',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      count: V.number().toInt().min(1).max(fieldLength.maxFileSlice),
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
    }, fieldLength.operationTimeout);

    try {
      const { HASH, count, path } = res.locals.ctx;

      const { account } = res.locals.hello.userinfo;

      let targetPath = appConfig.userRootDir(
        account,
        `${_path.dirname(path)}/${_path.sanitizeFilename(_path.basename(path)[0] || 'unknown')}`,
      );

      if (targetPath === appConfig.trashDir(account)) {
        targetPath = await getUniqueFilename(targetPath);
      }

      // 存在先删除
      if (await _f.exists(targetPath)) {
        await _f.del(targetPath);
      }

      await mergefile(count, appConfig.temDir(`${account}_${HASH}`), targetPath, HASH);

      if (timer) {
        clearTimeout(timer);
        timer = null;
      } else {
        syncUpdateData(res, 'file', '', 'all');
      }

      fileList.clear(account);

      resp.success(res, `上传文件成功`)();
    } catch (error) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      } else {
        errorNotifyMsg(res, `上传文件失败`);
      }

      resp.error(res)(error);
    }
  }),
);

// 断点续传
route.post(
  '/breakpoint',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { HASH } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const path = appConfig.temDir(`${account}_${HASH}`),
      list = await _f.readdir(path);

    resp.success(res, 'ok', list)();
  }),
);

// 重复
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path } = res.locals.ctx;

    const p = appConfig.userRootDir(res.locals.hello.userinfo.account, path);

    if (await _f.exists(p)) {
      return resp.success(res)();
    }

    resp.ok(res)();
  }),
);

// 补全路径
route.post(
  '/complete',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      type: V.string().trim().default('all').enum(['dir', 'file', 'all']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, type } = res.locals.ctx;

    const normalizePath = _path.normalize(path);
    if (normalizePath.endsWith('/')) {
      return resp.success(res, 'ok', normalizePath)();
    }

    const p = appConfig.userRootDir(res.locals.hello.userinfo.account, path);
    const name = _path.basename(p)[0];
    const dir = _path.dirname(p);

    const dirList = await _f.readdir(dir);
    if (!dirList || dirList.length === 0) {
      return resp.success(res, 'ok', normalizePath)();
    }

    let best = null;

    for (const item of dirList) {
      if (!item.startsWith(name)) continue;

      if (type !== 'all') {
        const t = await _f.getType(_path.normalizeNoSlash(dir, item));
        if (t !== type) continue;
      }

      if (!best || item.length < best.length) {
        best = item;
      }
    }

    const result = best || name;

    const base = _path.dirname(path);
    let resultPath = _path.normalizeNoSlash(base, result);

    const resultType = await _f.getType(_path.normalizeNoSlash(dir, result));
    if (resultType === 'dir') {
      resultPath += '/';
    }

    resp.success(res, 'ok', resultPath)();
  }),
);

// 离线下载
route.post(
  '/download',
  validate(
    'body',
    V.object({
      url: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { url, path } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const targetPath = appConfig.userRootDir(account, path);

    if ((await _f.getType(targetPath)) !== 'dir') {
      return resp.forbidden(res, '目标文件夹不存在')();
    }

    const filename = _path.sanitizeFilename(
      _path.basename(_path.trimEndSlash(new URL(url).pathname))[0] || 'unknown',
    );

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `下载文件: ${filename}`, controller);

    resp.success(res, 'ok', { key: taskKey })();

    const temPath = appConfig.temDir(`${account}_${_crypto.getStringHash(url)}`);
    try {
      const stats = await _f.lstat(temPath);
      let downloadedBytes = stats ? stats.size : 0;

      const headers = {};
      if (downloadedBytes > 0) {
        headers.Range = `bytes=${downloadedBytes}-`;
      }

      const response = await request({
        method: 'get',
        url,
        responseType: 'stream',
        signal,
        headers,
        decompress: false, // 防止 gzip 会导致续传失败
        validateStatus: (s) => s === 200 || s === 206,
        timeout: 0,
      });

      // 判断是否支持续传（206）
      const isResume = downloadedBytes > 0 && response.status === 206;

      if (!isResume && downloadedBytes > 0) {
        // 服务器不支持续传 → 重头下载
        downloadedBytes = 0;
      }

      // 写入模式：续传 append / 覆盖 write
      const writer = await _f.createWriteStream(temPath, {
        flags: downloadedBytes > 0 ? 'a' : 'w',
      });

      await _f.streamp.pipeline(
        response.data,
        new _f.stream.Transform({
          transform(chunk, _, callback) {
            downloadedBytes += chunk.length;
            taskState.update(taskKey, `下载文件: ${filename} (${_f.formatBytes(downloadedBytes)})`);
            callback(null, chunk);
          },
        }),
        writer,
        { signal },
      );

      let outputFilePath = _path.normalizeNoSlash(targetPath, filename);

      // 已存在添加后缀
      if ((await _f.exists(outputFilePath)) || outputFilePath === appConfig.trashDir(account)) {
        outputFilePath = await getUniqueFilename(outputFilePath);
      }

      await _f.rename(temPath, outputFilePath);
      taskState.done(taskKey);
      syncUpdateData(res, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `离线下载文件失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

// 添加到播放器和壁纸
route.post(
  '/add-file-to',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['music', 'bg']),
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { type, path } = res.locals.ctx;

    if (!res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    const typeName = type === 'music' ? '音乐' : '壁纸';
    const { account } = res.locals.hello.userinfo;

    const targetPath = appConfig.userRootDir(account, path);

    if ((await _f.getType(targetPath)) !== 'dir') {
      return resp.forbidden(res, '目标文件夹不存在')();
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `添加${typeName}...`, controller);

    resp.success(res, 'ok', { key: taskKey })();

    try {
      let skip = 0;
      let count = 0;
      let totalSize = 0;

      await _f.walk(
        targetPath,
        async ({ type: ftype, path: p, stat }) => {
          if (ftype !== 'dir') {
            try {
              const size = stat.size;
              if (
                (type === 'music' &&
                  isMusicFile(p) &&
                  size < fieldLength.maxSongSize * 1024 * 1024 &&
                  (await fileToMusic(p))) ||
                (type === 'bg' &&
                  isImgFile(p) &&
                  size < fieldLength.maxBgSize * 1024 * 1024 &&
                  (await fileToBg(p)))
              ) {
                totalSize += size;
                count++;
              } else {
                skip++;
              }
            } catch (error) {
              await writelog(res, `扫描添加${typeName}失败(${error})`, 500);
            }

            taskState.update(
              taskKey,
              `添加${typeName}...${count} (${_f.formatBytes(totalSize)}) 跳过 ${skip}`,
            );
          }
        },
        { signal, concurrency: 5 },
      );

      taskState.done(taskKey);
      syncUpdateData(res, type);
    } catch (error) {
      taskState.delete(taskKey);
      const errText = `扫描添加${typeName}失败`;
      await writelog(res, `${errText}(${error})`, 500);
      await heperMsgAndForward(res, account, errText);
    }
  }),
);

export default route;
