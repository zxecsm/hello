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
  isFilename,
  uLog,
  concurrencyTasks,
  errorNotifyMsg,
  nanoid,
  formatDate,
  errLog,
  createPagingData,
  getDuplicates,
  isurl,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import { insertData } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { getFriendDes } from '../chat/chat.js';

import fileSize from './cacheFileSize.js';

import {
  getRootDir,
  getTrashDir,
  getCurPath,
  readMenu,
  getUniqueFilename,
  sortFileList,
  hasSameNameFile,
} from './file.js';

import { fieldLenght } from '../config.js';

import { validShareState, validShareAddUserState } from '../user/user.js';

import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import taskState from '../../utils/taskState.js';
import zipper from '../../utils/zip.js';
import fileList from './cacheFileList.js';
import axios from 'axios';

const route = express.Router();

// 分享文件
route.get('/share', async (req, res) => {
  try {
    const { id, pass = '' } = req.query;

    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(pass, 0, fieldLenght.sharePass)
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
      const des = await getFriendDes(account, acc);

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
        fieldLenght.shareTokenExp
      ),
    })(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取目录
function fileListSortAndCacheSize(list, rootP, sortType, isDesc, hidden) {
  list = list.reduce((pre, cur) => {
    const fullPath = _path.normalize(`${rootP}/${cur.path}/${cur.name}`);

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
route.get('/read-dir', async (req, res) => {
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
    } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    subDir = parseInt(subDir);
    isDesc = parseInt(isDesc);
    update = parseInt(update);
    hidden = parseInt(hidden);

    const temid = req._hello.temid;

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(token, 0, fieldLenght.url) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLenght.maxPagesize ||
      !validationValue(subDir, [1, 0]) ||
      !validationValue(isDesc, [1, 0]) ||
      !validationValue(update, [1, 0]) ||
      !validationValue(hidden, [1, 0]) ||
      !validaString(word, 0, fieldLenght.searchWord) ||
      !validationValue(sortType, ['name', 'time', 'size', 'type']) ||
      !validaString(temid, 1, fieldLenght.id, 1)
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
      rootP = _path.normalize(`${getRootDir(account)}/${data.path}/${name}`);

      p = _path.normalize(`${rootP}/${path}`);
    } else {
      p = getCurPath(account, path);
      rootP = getRootDir(account);
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const hdType = word ? '搜索文件' : '读取文件列表';
    const taskKey = taskState.add(acc, `${hdType}...0`, controller);

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
        async function readDir(p) {
          if (signal.aborted) return;

          const list = await readMenu(p);

          for (const item of list) {
            if (signal.aborted) return;

            count++;
            taskState.update(taskKey, `${hdType}...${count}`);

            const fullPath = _path.normalize(`${item.path}/${item.name}`);

            // 递归获取子目录
            if (item.type === 'dir' && subDir === 1 && word) {
              await readDir(fullPath);
            }

            // 去除路径前缀
            const path = _path.normalize('/' + item.path.slice(rootP.length));

            const obj = {
              ...item,
              path,
            };

            // 关键词过滤
            if (
              !word ||
              (word && obj.name.toLowerCase().includes(word.toLowerCase()))
            ) {
              arr.push(obj);
            }
          }
        }

        await readDir(p);
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
route.get('/read-file', async (req, res) => {
  try {
    const { path = '', token = '' } = req.query;

    if (
      !validaString(path, 0, fieldLenght.url) ||
      !validaString(token, 0, fieldLenght.url)
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

      const rootP = _path.normalize(
        `${getRootDir(account)}/${data.path}/${name}`
      );

      if (type === 'file') {
        p = rootP;
      } else if (type === 'dir') {
        p = _path.normalize(`${rootP}/${path}`);
      }
    } else {
      p = getCurPath(account, path);
    }

    if (!(await _f.exists(p))) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    const stat = await _f.fsp.lstat(p);

    if (stat.isDirectory()) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    // 文本文件并且小于等于10M直接返回
    if (
      stat.isFile() &&
      stat.size <= fieldLenght.textFileSize &&
      _f.isTextFile(p)
    ) {
      //文本文件
      _success(res, 'ok', {
        type: 'text',
        data: (await _f.fsp.readFile(p)).toString(),
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

// 读取目录大小
route.get('/read-dir-size', async (req, res) => {
  try {
    const { path } = req.query;

    if (!validaString(path, 1, fieldLenght.url)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `读取文件夹大小...0`, controller);

    _success(res, 'ok', { key: taskKey });

    try {
      let size = 0;
      let count = 0;

      if (await _f.exists(p)) {
        async function readDirSize(p) {
          if (signal.aborted) return;
          const list = await readMenu(p);

          for (const item of list) {
            if (signal.aborted) return;

            if (item.type === 'dir') {
              await readDirSize(_path.normalize(`${item.path}/${item.name}`));
            } else {
              size += item.size;
              count++;
              taskState.update(taskKey, `读取文件夹大小...${count}`);
            }
          }
        }

        await readDirSize(p);
      }

      taskState.delete(taskKey);
      if (!signal.aborted) {
        fileSize.add(p, size);
        syncUpdateData(req, 'file');
      }
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `读取文件夹大小失败(${error})`);
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
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(name, 1, fieldLenght.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const dir = getCurPath(req._hello.userinfo.account, path);
    const fpath = _path.normalize(`${dir}/${name}`);

    const { account } = req._hello.userinfo;

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

// 分享
route.post('/share', async (req, res) => {
  try {
    let { data, title, expireTime, pass = '' } = req.body;
    expireTime = parseInt(expireTime);

    if (
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(pass, 0, fieldLenght.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLenght.expTime ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      _path.normalize(`${data.path}/${data.name}`) === '/' ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await insertData('share', [
      {
        account,
        type: data.type,
        exp_time:
          expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
        title,
        pass,
        data: JSON.stringify(data),
      },
    ]);

    syncUpdateData(req, 'sharelist');

    _success(res, `分享${data.type === 'dir' ? '文件夹' : '文件'}成功`)(
      req,
      _path.normalize(`${data.path}/${data.name}`),
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
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(text, 0, 0, 0, 1) ||
      _f.getTextSize(text) > fieldLenght.textFileSize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, path);

    const stat = await _f.fsp.lstat(fpath);

    if (
      !(await _f.exists(fpath)) ||
      stat.isDirectory() ||
      getTrashDir(account) === fpath
    ) {
      _err(res, '文件不存在')(req, fpath, 1);
      return;
    }

    try {
      if (stat.size > 0) {
        // 保存编辑历史版本
        const [, filename, , suffix] = _path.basename(fpath);

        const historyDir = _path.normalize(
          `${_path.dirname(fpath)}/${appConfig.textFileHistoryDirName}`
        );

        await _f.mkdir(historyDir);

        const newName = `${filename}_${formatDate({
          template: `{0}{1}{2}-{3}{4}{5}`,
        })}${suffix ? `.${suffix}` : ''}`;

        await _f.cp(fpath, _path.normalize(`${historyDir}/${newName}`));
      }
    } catch (error) {
      await errLog(req, `保存文件历史版本失败(${error})`);
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
      !validaString(path, 1, fieldLenght.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      getDuplicates(data, ['name']).length > 0 || // 不能有同名文件或文件夹
      !validationValue(rename, [1, 0]) ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          _path.normalize(`${item.path}/${item.name}`) !== '/' &&
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
    const taskKey = taskState.add(account, `复制文件...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path, type } = task;

        const f = getCurPath(account, _path.normalize(`${path}/${name}`));

        let to = _path.normalize(`${p}/${name}`);

        if (_path.isPathWithin(f, to) || !name) return;

        // 已存在添加后缀
        if (((await _f.exists(to)) && rename === 1) || to === trashDir) {
          to = await getUniqueFilename(to);
        }

        if (f === to) return;

        await _f.cp(f, to, {
          signal,
          progress() {
            count++;
            taskState.update(taskKey, `复制文件...${count}`);
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
      !validaString(path, 1, fieldLenght.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
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
      !validaString(path, 1, fieldLenght.url) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      getDuplicates(data, ['name']).length > 0 ||
      !validationValue(rename, [1, 0]) ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          _path.normalize(`${item.path}/${item.name}`) !== '/' &&
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
    const taskKey = taskState.add(account, `移动文件...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        const { name, path, type } = task;

        const f = getCurPath(account, _path.normalize(`${path}/${name}`));

        let t = _path.normalize(`${p}/${name}`);

        if (f === t || _path.isPathWithin(f, t)) return;

        if (((await _f.exists(t)) && rename === 1) || t === trashDir) {
          t = await getUniqueFilename(t);
        }

        await _f.rename(f, t, {
          signal,
          progress() {
            count++;
            taskState.update(taskKey, `移动文件...${count}`);
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
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      _path.normalize(`${data.path}/${data.name}`) === '/' ||
      !validationValue(data.type, ['file', 'dir'])
    ) {
      paramErr(res, req);
      return;
    }

    const { name, path, type } = data;

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    data.path = p;

    const f = _path.normalize(`${p}/${name}`);

    const fname = (_path.extname(name)[0] || name) + '.zip';

    let t = _path.normalize(`${p}/${fname}`);

    if ((await _f.exists(t)) || t === getTrashDir(account)) {
      t = await getUniqueFilename(t);
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `压缩文件...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      await zipper.zip([data], t, {
        signal,
        progress(count) {
          taskState.update(taskKey, `压缩文件...${count}`);
        },
      });

      await uLog(req, `压缩${type === 'dir' ? '文件夹' : '文件'}(${f}=>${t})`);

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `压缩文件失败(${error})`);
      errorNotifyMsg(req, `压缩文件失败`);
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
      !validaString(data.name, 1, fieldLenght.filename) ||
      _path.extname(data.name)[2].toLowerCase() !== 'zip' ||
      !validaString(data.path, 1, fieldLenght.url) ||
      !validationValue(data.type, ['file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { name, path } = data;

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);
    const f = _path.normalize(`${p}/${name}`);

    const fname = _path.extname(name)[0] || name;

    let t = _path.normalize(`${p}/${fname}`);

    const controller = new AbortController();
    const signal = controller.signal;
    const taskKey = taskState.add(account, `解压文件...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      if ((await _f.exists(t)) || t === getTrashDir(account)) {
        t = await getUniqueFilename(t);
      }

      await zipper.unzip(f, t, {
        signal,
        progress() {
          count++;
          taskState.update(taskKey, `解压文件...${count}`);
        },
      });

      await uLog(req, `解压文件(${f}=>${t})`);

      taskState.delete(taskKey);
      syncUpdateData(req, 'file');
    } catch (error) {
      taskState.delete(taskKey);
      await errLog(req, `解压文件失败(${error})`);
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
      data.length > fieldLenght.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          _path.normalize(`${item.path}/${item.name}`) !== '/' &&
          _path.normalize(`${item.path}/${item.name}`) !==
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
    const taskKey = taskState.add(account, `删除文件...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;

      const trashDir = getTrashDir(account);

      await concurrencyTasks(data, 5, async (task) => {
        if (signal.aborted) return;

        let { path, name, type } = task;

        const p = getCurPath(account, _path.normalize(`${path}/${name}`));

        let handleType = '删除';

        if (
          force === 1 ||
          p === trashDir ||
          _path.isPathWithin(p, trashDir) ||
          _path.isPathWithin(trashDir, p)
        ) {
          await _f.del(p, {
            signal,
            progress() {
              count++;
              taskState.update(taskKey, `删除文件...${count}`);
            },
          });
        } else {
          await _f.mkdir(trashDir);

          let targetPath = _path.normalize(`${trashDir}/${name}`);
          if (await _f.exists(targetPath)) {
            targetPath = await getUniqueFilename(targetPath);
          }

          await _f.rename(p, targetPath, {
            signal,
            progress() {
              count++;
              taskState.update(taskKey, `放入回收站...${count}`);
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
    const taskKey = taskState.add(account, `清空回收站...0`, controller);

    fileList.clear(account);

    _success(res, 'ok', { key: taskKey });

    try {
      let count = 0;
      const trashDir = getTrashDir(account);

      if (await _f.exists(trashDir)) {
        const list = await _f.fsp.readdir(trashDir);

        await concurrencyTasks(list, 5, async (item) => {
          if (signal.aborted) return;

          const p = _path.normalize(`${trashDir}/${item}`);

          await _f.del(p, {
            signal,
            progress() {
              count++;
              taskState.update(taskKey, `删除文件...${count}`);
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
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(name, 1, fieldLenght.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, _path.normalize(`${path}/${name}`));

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
      !validaString(name, 1, fieldLenght.filename) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, data.path);

    const p = _path.normalize(`${dir}/${data.name}`),
      t = _path.normalize(`${dir}/${name}`);

    if ((await _f.exists(t)) || getTrashDir(account) === t) {
      _err(res, '已存在重名文件')(req, t, 1);
      return;
    }

    await _f.rename(p, t);

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, `重命名${data.type === 'dir' ? '文件夹' : '文件'}成功`)(
      req,
      `${p}=>${t}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件权限
route.post('/mode', async (req, res) => {
  try {
    const { data, mode } = req.body;

    if (
      !/^[0-7]{3}$/.test(mode) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, data.path);
    const p = _path.normalize(`${dir}/${data.name}`);

    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req, p, 1);
      return;
    }

    const txt = data.type === 'dir' ? '文件夹' : '文件';
    if (!(await _f.exists(p))) {
      _err(res, `${txt}不存在`)(req, p, 1);
      return;
    }

    await _f.fsp.chmod(p, mode.toString(8));

    syncUpdateData(req, 'file');

    fileList.clear(account);

    _success(res, `设置${txt}权限成功`)(req, `${p}-${mode}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传
route.post('/up', async (req, res) => {
  try {
    const { HASH, name } = req.query;

    if (
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(name, 1, 20, 1) ||
      !/^_[0-9]+$/.test(name)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const path = _path.normalize(`${appConfig.appData}/tem/${account}_${HASH}`);

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
  }, fieldLenght.operationTimeout);

  try {
    let { HASH, count, path } = req.body;
    count = parseInt(count);

    if (
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(path, 1, fieldLenght.url) ||
      isNaN(count) ||
      count < 1 ||
      count > fieldLenght.maxFileSlice
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let targetPath = getCurPath(account, path);

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
      _path.normalize(`${appConfig.appData}/tem/${account}_${HASH}`),
      targetPath
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

    if (!validaString(HASH, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let path = _path.normalize(`${appConfig.appData}/tem/${account}_${HASH}`),
      list = [];

    if (await _f.exists(path)) {
      list = await _f.fsp.readdir(path);
    }

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重复
route.post('/repeat', async (req, res) => {
  try {
    const { path } = req.body;

    if (!validaString(path, 1, fieldLenght.url)) {
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
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(url, 1, fieldLenght.url) ||
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
      `${targetPath}/${_path.basename(url)[0] || 'unknown'}`
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
    const taskKey = taskState.add(
      account,
      `下载文件: ${filename}(0)`,
      controller
    );

    _success(res, 'ok', { key: taskKey });

    async function handleError(error, responseData, writer) {
      // 销毁流
      if (responseData) responseData.destroy();
      if (writer) writer.destroy();
      taskState.delete(taskKey);
      await errLog(req, `下载文件失败(${error})`);
      errorNotifyMsg(req, `下载文件失败`);
    }

    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream', // 以流的形式接收数据
        signal, // 绑定 AbortController
      });

      // 获取文件总大小（从响应头中获取）
      const contentLength = response.headers['content-length'];
      if (contentLength && contentLength > fieldLenght.downloadFileSize) {
        await handleError('文件过大，下载取消', response.data);
        return;
      }

      // 创建一个可写流，将文件保存到本地
      const writer = _f.fs.createWriteStream(outputFilePath);

      // 监听下载进度
      let downloadedBytes = 0;
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;

        // 动态检查文件大小
        if (downloadedBytes > fieldLenght.downloadFileSize) {
          handleError('文件过大，下载取消', response.data, writer);
        }

        taskState.update(
          taskKey,
          `下载文件: ${filename}(${_f.formatBytes(downloadedBytes)})`
        );
      });

      // 将响应数据流通过管道传输到文件
      response.data.pipe(writer);

      // 监听流的结束事件
      writer.on('finish', () => {
        taskState.delete(taskKey);
        syncUpdateData(req, 'file');
      });

      // 监听流的错误事件
      writer.on('error', (err) => {
        handleError(err, response.data, writer);
      });

      // 监听响应流的错误事件
      response.data.on('error', (err) => {
        handleError(err, response.data, writer);
      });
    } catch (error) {
      handleError(error);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
