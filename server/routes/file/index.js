import express from 'express';

import {
  _nologin,
  validaString,
  _success,
  _err,
  paramErr,
  receiveFiles,
  mergefile,
  validationValue,
  _type,
  _nothing,
  syncUpdateData,
  uLog,
  concurrencyTasks,
  errorNotifyMsg,
  formatDate,
  errLog,
  createPagingData,
  getDuplicates,
  isurl,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { getFriendInfo } from '../chat/chat.js';

import fileSize from './cacheFileSize.js';

import {
  getRootDir,
  getTrashDir,
  getCurPath,
  readMenu,
  getUniqueFilename,
  sortFileList,
  hasSameNameFile,
  readFavorites,
  readHistoryDirs,
  writeHistoryDirs,
  writeFavorites,
} from './file.js';

import { fieldLength } from '../config.js';

import { validShareState, validShareAddUserState } from '../user/user.js';

import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import taskState from '../../utils/taskState.js';
import zipper from '../../utils/zip.js';
import fileList from './cacheFileList.js';
import axios from 'axios';
import nanoid from '../../utils/nanoid.js';

const route = express.Router();

// 分享文件
route.post('/get-share', async (req, res) => {
  try {
    const { id, pass = '' } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(pass, 0, fieldLength.sharePass)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const share = await validShareAddUserState(req, ['file', 'dir'], id, pass);

    if (share.state === 3) {
      _nothing(res, share.text);
      return;
    }

    if (share.state === 0) {
      _err(res, share.text)(req, id, 1);
      return;
    }

    let {
      username,
      logo,
      email,
      exp_time,
      title,
      account: acc,
      data,
    } = share.data;

    if (account && account != acc) {
      const f = await getFriendInfo(account, acc, 'des');
      const des = f ? f.des : '';
      username = des || username;
    }

    _success(res, '获取文件分享成功', {
      username,
      logo,
      email,
      exp_time,
      account: acc,
      data,
      title,
      token: jwt.set(
        { type: 'share', data: { id, types: ['file', 'dir'] } },
        fieldLength.shareTokenExp
      ),
    })(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取目录
function fileListSortAndCacheSize(list, rootP, sortType, isDesc, hidden) {
  list = list.reduce((pre, cur) => {
    const fullPath = _path.normalize(rootP, cur.path, cur.name);

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
route.post('/read-dir', async (req, res) => {
  try {
    let {
      path,
      pageNo,
      pageSize,
      sortType = 'time',
      isDesc = 1,
      subDir = 0,
      update = 0,
      word = '',
      token = '',
      hidden = 0,
    } = req.body;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    const temid = req._hello.temid;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(token, 0, fieldLength.url) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLength.maxPagesize ||
      !validationValue(subDir, [1, 0]) ||
      !validationValue(isDesc, [1, 0]) ||
      !validationValue(update, [1, 0]) ||
      !validationValue(hidden, [1, 0]) ||
      !validaString(word, 0, fieldLength.searchWord) ||
      !validationValue(sortType, ['name', 'time', 'size', 'type']) ||
      !validaString(temid, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!token && !account) {
      _nologin(res);
      return;
    }

    let p = '';
    let rootP = '';
    const acc = token ? temid : account;

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        _err(res, share.text)(req);
        return;
      }

      const { data, account } = share.data;

      const { name } = data;

      // 用户根目录
      rootP = _path.normalize(getRootDir(account), data.path, name);

      p = _path.normalize(rootP, path);
    } else {
      p = getCurPath(account, path);
      rootP = getRootDir(account);
    }

    let favorites = null;
    if (account && !token) {
      try {
        // 保存路径历史
        const list = (await readHistoryDirs(account)).filter(
          (item) => item !== path
        );

        list.push(path);

        if (list.length > fieldLength.cdHistoryLength) {
          list.slice(-fieldLength.cdHistoryLength);
        }

        await writeHistoryDirs(account, list);

        favorites = await readFavorites(account);
      } catch (error) {
        await errLog(req, error);
      }
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const hdType = word ? '搜索文件' : '读取文件列表';
    const taskKey = taskState.add(acc, `${hdType}...`, controller);

    const cacheList = fileList.get(acc, `${p}_${word}`);

    // 有缓存则返回缓存
    if (update === 0 && cacheList) {
      taskState.delete(taskKey);

      _success(
        res,
        'ok',
        createPagingData(
          fileListSortAndCacheSize(cacheList, rootP, sortType, isDesc, hidden),
          pageSize,
          pageNo
        )
      );

      return;
    }

    // 超时获取不到则当任务处理
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;

      _success(res, 'ok', { key: taskKey });
    }, 1000);

    try {
      let arr = [];
      let count = 0;

      if (await _f.exists(p)) {
        const stack = [p];

        while (stack.length > 0 && !signal.aborted) {
          const currentPath = stack.pop();
          const list = await readMenu(currentPath);

          for (const item of list) {
            if (signal.aborted) break;

            count++;
            taskState.update(taskKey, `${hdType}...${count}`);

            const fullPath = _path.normalize(item.path, item.name);

            if (item.type === 'dir' && subDir === 1 && word) {
              stack.push(fullPath);
            }

            // 去除路径前缀
            const path = _path.normalize('/' + item.path.slice(rootP.length));

            const obj = {
              ...item,
              path,
            };

            if (
              obj.type === 'file' &&
              obj.fileType === 'symlink' &&
              _path.isPathWithin(rootP, obj.linkTarget)
            ) {
              obj.linkTarget = _path.normalize(
                '/' + item.linkTarget.slice(rootP.length)
              );
            }

            if (favorites && item.type === 'dir') {
              obj.favorite = favorites.includes(
                _path.normalize(path, item.name)
              )
                ? 1
                : 0;
            }

            if (!req._hello.isRoot) {
              delete obj.mode;
              delete obj.gid;
              delete obj.uid;
            }

            // 关键词过滤
            if (
              !word ||
              (word && obj.name.toLowerCase().includes(word.toLowerCase()))
            ) {
              arr.push(obj);
            }
          }
        }
      }

      taskState.delete(taskKey);

      // 未超时直接返回结果
      if (timer) {
        clearTimeout(timer);
        timer = null;

        _success(
          res,
          'ok',
          createPagingData(
            fileListSortAndCacheSize(arr, rootP, sortType, isDesc, hidden),
            pageSize,
            pageNo
          )
        );
      } else {
        // 超时缓存结果
        fileList.add(acc, `${p}_${word}`, arr);
      }
    } catch (error) {
      taskState.delete(taskKey);

      // 未超时直接返回失败
      if (timer) {
        clearTimeout(timer);
        timer = null;
        _err(res, `${hdType}失败`)(req, error, 1);
      } else {
        await errLog(req, `${hdType}失败(${error})`);
        if (account) {
          errorNotifyMsg(req, `${hdType}失败`);
        }
      }
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取文件
route.post('/read-file', async (req, res) => {
  try {
    const { path = '', token = '' } = req.body;

    if (
      !validaString(path, 0, fieldLength.url) ||
      !validaString(token, 0, fieldLength.url)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!token && !account) {
      _nologin(res);
      return;
    }

    let p = '';

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        _err(res, share.text)(req);
        return;
      }

      const { data, account } = share.data;

      const { name, type } = data;

      const rootP = _path.normalize(getRootDir(account), data.path, name);

      if (type === 'file') {
        p = rootP;
      } else if (type === 'dir') {
        p = _path.normalize(rootP, path);
      }
    } else {
      p = getCurPath(account, path);
    }

    if (!(await _f.exists(p))) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    const stat = await _f.fsp.lstat(p);

    if ((await _f.getType(stat)) === 'dir') {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    // 文本文件并且小于等于10M直接返回
    if (stat.size <= fieldLength.textFileSize && (await _f.isTextFile(p))) {
      //文本文件
      _success(res, 'ok', {
        type: 'text',
        data: (await _f.readFile(p, null, '')).toString(),
      });
    } else {
      _success(res, 'ok', {
        type: 'other',
      });
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 验证登录态
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 获取访问路径历史
route.get('/cd-history', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    _success(res, 'ok', await readHistoryDirs(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取收藏目录
route.get('/favorites', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    _success(res, 'ok', await readFavorites(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 收藏目录
route.post('/favorites', async (req, res) => {
  try {
    const { data, type = 'add' } = req.body;

    if (
      !validationValue(type, ['add', 'del']) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLength.filename) ||
      !validaString(data.path, 1, fieldLength.url) ||
      !validationValue(data.type, ['dir'])
    ) {
      paramErr(res, req);
      return;
    }

    const path = _path.normalize(data.path, data.name);

    const { account } = req._hello.userinfo;
    const list = (await readFavorites(account)).filter((item) => item !== path);

    if (type === 'add') {
      list.push(path);
    }

    await writeFavorites(account, list);

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, `${type === 'add' ? '' : '移除'}收藏文件夹成功`)(
      req,
      _path.normalize(getRootDir(account), path),
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取目录大小
route.get('/read-dir-size', async (req, res) => {
  try {
    const { path } = req.query;

    if (!validaString(path, 1, fieldLength.url)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `读取文件夹大小...`, controller);

    _success(res, 'ok', { key: taskKey });

    try {
      let size = 0;
      let count = 0;

      await _f.readDirSize(p, {
        signal,
        progress({ size: s, count: c }) {
          if (s) size += s;
          if (c) count++;
          taskState.update(
            taskKey,
            `读取文件夹大小...${count} (${_f.formatBytes(size)})`
          );
        },
      });

      taskState.delete(taskKey);
      await uLog(req, `读取文件夹大小成功(${p}-${_f.formatBytes(size)})`);
      if (!signal.aborted) {
        fileSize.add(p, size);
        syncUpdateData(req, 'file');
      }
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `读取文件夹大小失败(${p}-${error})`);
      errorNotifyMsg(req, `读取文件夹大小失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 新建文件
route.post('/create-file', async (req, res) => {
  try {
    const { path, name } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(name, 1, fieldLength.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!_path.isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, path);
    const fpath = _path.normalize(dir, name);

    // 过滤回收站
    if ((await _f.exists(fpath)) || getTrashDir(account) === fpath) {
      _err(res, '已存在重名文件')(req, fpath, 1);
      return;
    }

    await _f.mkdir(dir);
    await _f.fsp.writeFile(fpath, '');

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, '新建文件成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 创建符号链接
route.post('/create-link', async (req, res) => {
  try {
    const { path, name, targetPath, isSymlink = 1 } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(targetPath, 1, fieldLength.url) ||
      !validaString(name, 1, fieldLength.filename) ||
      !validationValue(isSymlink, [0, 1])
    ) {
      paramErr(res, req);
      return;
    }

    if (!_path.isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const curPath = getCurPath(account, `${path}/${name}`);
    const tPath = getCurPath(account, targetPath);

    // 过滤回收站
    if ((await _f.exists(curPath)) || getTrashDir(account) === curPath) {
      _err(res, '已存在重名文件')(req, curPath, 1);
      return;
    }

    if (isSymlink) {
      await _f.symlink(tPath, curPath);
    } else {
      await _f.link(tPath, curPath);
    }

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, '新建符号链接成功')(req, `${curPath}=>${tPath}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分享
route.post('/share', async (req, res) => {
  try {
    let { data, title, expireTime, pass = '' } = req.body;
    expireTime = parseInt(expireTime);

    data.path = _path.normalize(data.path);

    if (
      !validaString(title, 1, fieldLength.title) ||
      !validaString(pass, 0, fieldLength.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLength.expTime ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLength.filename) ||
      !validaString(data.path, 1, fieldLength.url) ||
      _path.normalize(data.path, data.name) === '/' ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await db('share').insert({
      id: nanoid(),
      create_at: Date.now(),
      account,
      type: data.type,
      exp_time:
        expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(data),
    });

    syncUpdateData(req, 'sharelist');

    _success(res, `分享${data.type === 'dir' ? '文件夹' : '文件'}成功`)(
      req,
      _path.normalize(getRootDir(account), data.path, data.name),
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存文件
route.post('/save-file', async (req, res) => {
  try {
    const { path, text = '' } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(text, 0, 0, 0, 1) ||
      _f.getTextSize(text) > fieldLength.textFileSize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, path);

    const type = await _f.getType(fpath);
    if (!type || type === 'dir' || getTrashDir(account) === fpath) {
      _err(res, '文件不存在')(req, fpath, 1);
      return;
    }

    const stat = await _f.fsp.lstat(fpath);

    if (type === 'file') {
      try {
        if (stat.size > 0) {
          // 保存编辑历史版本
          const [, filename, , suffix] = _path.basename(fpath);

          const historyDir = _path.normalize(
            _path.dirname(fpath),
            appConfig.textFileHistoryDirName
          );

          await _f.mkdir(historyDir);

          const newName = `${filename}_${formatDate({
            template: `{0}{1}{2}-{3}{4}{5}`,
          })}${suffix ? `.${suffix}` : ''}`;

          await _f.cp(fpath, _path.normalize(historyDir, newName));
        }
      } catch (error) {
        await errLog(req, `保存文件历史版本失败(${fpath}-${error})`);
      }
    }

    await _f.fsp.writeFile(fpath, text);

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, '保存文件成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 复制
route.post('/copy', async (req, res) => {
  try {
    const { path, data, rename } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      getDuplicates(data, ['name']).length > 0 || // 不能有同名文件或文件夹
      !validationValue(rename, [1, 0]) ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          _path.normalize(item.path, item.name) !== '/' &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    if (!(await _f.exists(p))) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `复制文件...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;
      let size = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path, type } = task;

        const f = getCurPath(account, `${path}/${name}`);

        let to = _path.normalize(p, name);

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
            taskState.update(
              taskKey,
              `复制文件...${count} (${_f.formatBytes(size)})`
            );
          },
        });

        await uLog(
          req,
          `复制${type === 'dir' ? '文件夹' : '文件'}(${f}=>${to})`
        );
      });

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `复制文件失败(${error})`);
      errorNotifyMsg(req, `复制文件失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 是否存在同名文件
route.post('/same-name', async (req, res) => {
  try {
    const { path, data } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    if (!(await _f.exists(p))) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    _success(res, 'ok', { hasSameName: await hasSameNameFile(p, data) });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 移动
route.post('/move', async (req, res) => {
  try {
    const { path, data, rename } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      getDuplicates(data, ['name']).length > 0 ||
      !validationValue(rename, [1, 0]) ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          _path.normalize(item.path, item.name) !== '/' &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    if (!(await _f.exists(p))) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `移动文件...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;
      let size = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path, type } = task;

        const f = getCurPath(account, `${path}/${name}`);

        let t = _path.normalize(p, name);

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
            taskState.update(
              taskKey,
              `移动文件...${count} (${_f.formatBytes(size)})`
            );
          },
        });

        await uLog(
          req,
          `移动${type === 'dir' ? '文件夹' : '文件'}(${f}=>${t})`
        );
      });

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `移动文件失败(${error})`);
      errorNotifyMsg(req, `移动文件失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 压缩
route.post('/zip', async (req, res) => {
  try {
    const { data } = req.body;

    if (
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLength.filename) ||
      !validaString(data.path, 1, fieldLength.url) ||
      _path.normalize(data.path, data.name) === '/' ||
      !validationValue(data.type, ['file', 'dir'])
    ) {
      paramErr(res, req);
      return;
    }

    const flag = data.type === 'dir' ? '文件夹' : '文件';

    const { name, path } = data;

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    data.path = p;

    const f = _path.normalize(p, name);

    if (!(await _f.exists(f))) {
      _err(res, `${flag}不存在`)(req, f, 1);
      return;
    }

    const fname = (_path.extname(name)[0] || name) + '.zip';

    let t = _path.normalize(p, fname);

    if ((await _f.exists(t)) || t === getTrashDir(account)) {
      t = await getUniqueFilename(t);
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `压缩文件...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      await zipper.zip([data], t, {
        signal,
        progress({ size, count }) {
          taskState.update(
            taskKey,
            `压缩文件...${count} (${_f.formatBytes(size)})`
          );
        },
      });

      await uLog(req, `压缩${flag}(${f}=>${t})`);

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `压缩${flag}失败(${f}-${error})`);
      errorNotifyMsg(req, `压缩${flag}失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 解压缩
route.post('/unzip', async (req, res) => {
  try {
    const { data } = req.body;

    if (
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLength.filename) ||
      _path.extname(data.name)[2].toLowerCase() !== 'zip' ||
      !validaString(data.path, 1, fieldLength.url) ||
      !validationValue(data.type, ['file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { name, path } = data;

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);
    const f = _path.normalize(p, name);

    if (!(await _f.exists(f))) {
      _err(res, '解压文件不存在')(req, f, 1);
      return;
    }

    const fname = _path.extname(name)[0] || name;

    let t = _path.normalize(p, fname);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `解压文件...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      if ((await _f.exists(t)) || t === getTrashDir(account)) {
        t = await getUniqueFilename(t);
      }

      await zipper.unzip(f, t, {
        signal,
        progress({ size, count }) {
          taskState.update(
            taskKey,
            `解压文件...${count} (${_f.formatBytes(size)})`
          );
        },
      });

      await uLog(req, `解压文件(${f}=>${t})`);

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `解压文件失败(${f}-${error})`);
      errorNotifyMsg(req, `解压文件失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除
route.post('/delete', async (req, res) => {
  try {
    const { data, force = 0 } = req.body;

    if (
      !_type.isArray(data) ||
      !validationValue(force, [1, 0]) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          _path.normalize(item.path, item.name) !== '/' &&
          _path.normalize(item.path, item.name) !==
            `/${appConfig.trashDirName}` &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `删除文件...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;
      let size = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        let { path, name, type } = task;

        const p = getCurPath(account, `${path}/${name}`);

        let handleType = '删除';

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
              taskState.update(
                taskKey,
                `删除文件...${count} (${_f.formatBytes(size)})`
              );
            },
          });
        } else {
          await _f.mkdir(trashDir);

          let targetPath = _path.normalize(trashDir, name);
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
              taskState.update(
                taskKey,
                `放入回收站...${count} (${_f.formatBytes(size)})`
              );
            },
          });

          handleType = '回收';
        }

        await uLog(
          req,
          `${handleType}${type === 'dir' ? '文件夹' : '文件'}(${p})`
        );
      });

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `删除文件失败(${error})`);
      errorNotifyMsg(req, `删除文件失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清空回收站
route.get('/clear-trash', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `清空回收站...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;
      let size = 0;

      const trashDir = getTrashDir(account);

      if (await _f.exists(trashDir)) {
        const list = await _f.fsp.readdir(trashDir);

        await concurrencyTasks(list, 5, async (item) => {
          if (signal.aborted) return;

          const p = _path.normalize(trashDir, item);

          await _f.del(p, {
            signal,
            progress({ size: s, count: c }) {
              if (s) size += s;
              if (c) count++;
              taskState.update(
                taskKey,
                `删除文件...${count} (${_f.formatBytes(size)})`
              );
            },
          });
        });
      }

      await uLog(req, `清空回收站成功`);
      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `清空回收站失败(${error})`);
      errorNotifyMsg(req, `清空回收站失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 新建目录
route.post('/create-dir', async (req, res) => {
  try {
    const { path, name } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(name, 1, fieldLength.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!_path.isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, `${path}/${name}`);

    if (await _f.exists(fpath)) {
      _err(res, '已存在重名文件')(req, fpath, 1);
      return;
    }

    await _f.mkdir(fpath);

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, '新建文件夹成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重命名
route.post('/rename', async (req, res) => {
  try {
    const { data, name } = req.body;

    if (
      !validaString(name, 1, fieldLength.filename) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLength.filename) ||
      !validaString(data.path, 1, fieldLength.url) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    if (!_path.isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const flag = data.type === 'dir' ? '文件夹' : '文件';

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, data.path);

    const p = _path.normalize(dir, data.name),
      t = _path.normalize(dir, name);

    if (!(await _f.exists(p))) {
      _err(res, `${flag}不存在`)(req, p, 1);
      return;
    }

    if ((await _f.exists(t)) || getTrashDir(account) === t) {
      _err(res, '已存在重名文件')(req, t, 1);
      return;
    }

    await _f.rename(p, t);

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, `重命名${flag}成功`)(req, `${p}=>${t}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件权限
route.post('/mode', async (req, res) => {
  try {
    const { data, mode, r = 0 } = req.body;

    if (
      !_type.isString(mode) ||
      !/^[0-7]{3}$/.test(mode) ||
      !validationValue(r, [0, 1]) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req);
      return;
    }

    const { account } = req._hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `设置权限...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path } = task;

        const p = getCurPath(account, `${path}/${name}`);

        await _f.chmod(p, mode, {
          signal,
          progress({ count: c }) {
            if (c) count++;
            taskState.update(taskKey, `设置权限...${count}`);
          },
          recursive: r,
        });

        await uLog(req, `${r ? '递归' : ''}设置权限为${mode}(${p})`);
      });

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `设置权限失败(${error})`);
      errorNotifyMsg(req, `设置权限失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件用户组
route.post('/chown', async (req, res) => {
  try {
    let { data, uid = 0, gid = 0, r = 0 } = req.body;
    uid = parseInt(uid);
    gid = parseInt(gid);

    if (
      uid < 0 ||
      gid < 0 ||
      !validationValue(r, [0, 1]) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLength.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLength.filename) &&
          validaString(item.path, 1, fieldLength.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req);
      return;
    }

    const { account } = req._hello.userinfo;

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `设置用户组...`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path } = task;

        const p = getCurPath(account, `${path}/${name}`);

        await _f.chown(p, uid, gid, {
          signal,
          progress({ count: c }) {
            if (c) count++;
            taskState.update(taskKey, `设置用户组...${count}`);
          },
          recursive: r,
        });

        await uLog(
          req,
          `${r ? '递归' : ''}设置用户组为uid：${uid} gid：${gid}(${p})`
        );
      });

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `设置用户组失败(${error})`);
      errorNotifyMsg(req, `设置用户组失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传
route.post('/up', async (req, res) => {
  try {
    const { HASH, name } = req.query;

    if (
      !validaString(HASH, 1, fieldLength.id, 1) ||
      !validaString(name, 1, 20, 1) ||
      !/^_[0-9]+$/.test(name)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const path = _path.normalize(
      appConfig.appData,
      'tem',
      `${account}_${HASH}`
    );

    await _f.mkdir(path);

    await receiveFiles(req, path, name, 50);

    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 合并文件
route.post('/merge', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLength.operationTimeout);

  try {
    let { HASH, count, path } = req.body;
    count = parseInt(count);

    if (
      !validaString(HASH, 1, fieldLength.id, 1) ||
      !validaString(path, 1, fieldLength.url) ||
      isNaN(count) ||
      count < 1 ||
      count > fieldLength.maxFileSlice
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let targetPath = getCurPath(
      account,
      _path.dirname(path) + _path.sanitizeFilename(_path.basename(path)[0])
    );

    if (targetPath === getTrashDir(account)) {
      targetPath = await getUniqueFilename(targetPath);
    }

    // 存在先删除
    if (await _f.exists(targetPath)) {
      await _f.del(targetPath);
    } else {
      await _f.mkdir(_path.dirname(targetPath));
    }

    await mergefile(
      count,
      _path.normalize(appConfig.appData, 'tem', `${account}_${HASH}`),
      targetPath,
      HASH
    );

    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    fileList.clear(account);

    _success(res, `上传文件成功`)(req, targetPath, 1);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `上传文件失败`);
    }

    _err(res)(req, error);
  }
});

// 断点续传
route.post('/breakpoint', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const path = _path.normalize(
        appConfig.appData,
        'tem',
        `${account}_${HASH}`
      ),
      list = await _f.readdir(path);

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重复
route.post('/repeat', async (req, res) => {
  try {
    const { path } = req.body;

    if (!validaString(path, 1, fieldLength.url)) {
      paramErr(res, req);
      return;
    }

    const p = getCurPath(req._hello.userinfo.account, path);

    if (await _f.exists(p)) {
      _success(res);
      return;
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 离线下载
route.post('/download', async (req, res) => {
  try {
    const { url, path } = req.body;

    if (
      !validaString(path, 1, fieldLength.url) ||
      !validaString(url, 1, fieldLength.url) ||
      !isurl(url)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const targetPath = getCurPath(account, path);

    if (!(await _f.exists(targetPath))) {
      _err(res, '目标文件夹不存在')(req, targetPath, 1);
      return;
    }

    let outputFilePath = _path.normalize(
      targetPath,
      _path.sanitizeFilename(_path.basename(url)[0])
    );

    // 已存在添加后缀
    if (
      (await _f.exists(outputFilePath)) ||
      outputFilePath === getTrashDir(account)
    ) {
      outputFilePath = await getUniqueFilename(outputFilePath);
    }

    const filename = _path.basename(outputFilePath)[0];

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `下载文件: ${filename}`, controller);

    _success(res, 'ok', { key: taskKey });

    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        signal,
      });

      let downloadedBytes = 0;

      await _f.streamp.pipeline(
        response.data,
        new _f.stream.Transform({
          transform(chunk, _, callback) {
            downloadedBytes += chunk.length;
            taskState.update(
              taskKey,
              `下载文件: ${filename} (${_f.formatBytes(downloadedBytes)})`
            );
            callback(null, chunk);
          },
        }),
        _f.fs.createWriteStream(outputFilePath),
        { signal }
      );

      taskState.delete(taskKey);
      uLog(req, `离线下载文件: ${url}=>${outputFilePath}`);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `下载文件失败: ${url}(${error})`);
      errorNotifyMsg(req, `下载文件失败`);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
