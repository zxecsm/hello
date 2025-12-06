import express from 'express';

import {
  _nologin,
  _success,
  _err,
  receiveFiles,
  mergefile,
  _nothing,
  syncUpdateData,
  uLog,
  concurrencyTasks,
  errorNotifyMsg,
  formatDate,
  errLog,
  createPagingData,
  getDuplicates,
  validate,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { getFriendInfo } from '../chat/chat.js';

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
import _crypto from '../../utils/crypto.js';
import V from '../../utils/validRules.js';

const route = express.Router();

// 分享文件
route.post(
  '/get-share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      pass: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.sharePass),
    })
  ),
  async (req, res) => {
    try {
      const { id, pass } = req._vdata;

      const { account } = req._hello.userinfo;

      const share = await validShareAddUserState(
        req,
        ['file', 'dir'],
        id,
        pass
      );

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
        token: await jwt.set(
          { type: 'share', data: { id, types: ['file', 'dir'] } },
          fieldLength.shareTokenExp
        ),
      })(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

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
route.post(
  '/read-dir',
  validate(
    'body',
    V.object({
      path: V.string().min(1).notEmpty().max(fieldLength.url),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .default(20)
        .toInt()
        .min(1)
        .max(fieldLength.maxPagesize),
      sortType: V.string()
        .trim()
        .default('time')
        .enum(['name', 'time', 'size', 'type']),
      isDesc: V.number().default(1).toInt().enum([0, 1]),
      subDir: V.number().default(0).toInt().enum([0, 1]),
      update: V.number().default(0).toInt().enum([0, 1]),
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
      hidden: V.number().default(0).toInt().enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const {
        path,
        pageNo,
        pageSize,
        sortType,
        isDesc,
        subDir,
        update,
        word,
        token,
        hidden,
      } = req._vdata;

      const temid = req._hello.temid;

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
        rootP = appConfig.userRootDir(account, data.path, name);

        p = _path.normalize(rootP, path);
      } else {
        p = appConfig.userRootDir(account, path);
        rootP = appConfig.userRootDir(account);
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
            fileListSortAndCacheSize(
              cacheList,
              rootP,
              sortType,
              isDesc,
              hidden
            ),
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
                _path.isPathWithin(rootP, obj.linkTarget, 1)
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
  }
);

// 读取文件
route.post(
  '/read-file',
  validate(
    'body',
    V.object({
      path: V.string().default('').allowEmpty().max(fieldLength.url),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { path, token } = req._vdata;

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

        const rootP = appConfig.userRootDir(account, data.path, name);

        if (type === 'file') {
          p = rootP;
        } else if (type === 'dir') {
          p = _path.normalize(rootP, path);
        }
      } else {
        p = appConfig.userRootDir(account, path);
      }

      const stat = await _f.lstat(p);

      if (!stat || (await _f.getType(stat)) === 'dir') {
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
  }
);

// 验证登录态
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 文件编辑历史记录
route.post(
  '/history-state',
  validate(
    'body',
    V.object({
      state: V.number().toInt().default(0).enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { state = 0 } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('user')
        .where({ account, state: 1 })
        .update({ file_history: state });

      _success(res, `${state === 0 ? '关闭' : '开启'}文件历史记录成功`)(req);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);
route.get('/history-state', async (req, res) => {
  try {
    const { file_history } = req._hello.userinfo;
    _success(res, 'ok', { file_history });
  } catch (error) {
    _err(res)(req, error);
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
    })
  ),
  async (req, res) => {
    try {
      const { data, type } = req._vdata;

      const path = _path.normalize(data.path, data.name);

      const { account } = req._hello.userinfo;
      const list = (await readFavorites(account)).filter(
        (item) => item !== path
      );

      if (type === 'add') {
        list.push(path);
      }

      await writeFavorites(account, list);

      syncUpdateData(req, 'file');

      fileList.clear(account);

      _success(res, `${type === 'add' ? '' : '移除'}收藏文件夹成功`)(
        req,
        appConfig.userRootDir(account, path),
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 读取目录大小
route.get(
  '/read-dir-size',
  validate(
    'query',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { path } = req._vdata;

      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);

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
  }
);

// 新建文件
route.post(
  '/create-file',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      name: V.string().trim().min(1).max(fieldLength.filename),
    })
  ),
  async (req, res) => {
    try {
      const { path, name } = req._vdata;

      if (!_path.isFilename(name)) {
        _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
        return;
      }

      const { account } = req._hello.userinfo;

      const fpath = appConfig.userRootDir(account, `${path}/${name}`);

      // 过滤回收站
      if ((await _f.exists(fpath)) || appConfig.trashDir(account) === fpath) {
        _err(res, '已存在重名文件')(req, fpath, 1);
        return;
      }

      await _f.writeFile(fpath, '');

      syncUpdateData(req, 'file');

      fileList.clear(account);

      _success(res, '新建文件成功')(req, fpath, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { path, name, targetPath, isSymlink } = req._vdata;

      if (!_path.isFilename(name)) {
        _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
        return;
      }

      const { account } = req._hello.userinfo;

      const curPath = appConfig.userRootDir(account, `${path}/${name}`);
      const tPath = appConfig.userRootDir(account, targetPath);

      // 过滤回收站
      if (
        (await _f.exists(curPath)) ||
        appConfig.trashDir(account) === curPath
      ) {
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
  }
);

// 分享
route.post(
  '/share',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      expireTime: V.number().toInt().max(fieldLength.expTime),
      pass: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.sharePass),
      data: V.object({
        name: V.string().notEmpty().min(1).max(fieldLength.filename),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().enum(['dir', 'file']),
      }).custom(
        (obj) => _path.normalize(obj.path, obj.name) !== '/',
        'path/name 路径不能为: /'
      ),
    })
  ),
  async (req, res) => {
    try {
      const { data, title, expireTime, pass } = req._vdata;

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
        appConfig.userRootDir(account, data.path, data.name),
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
          `编辑文本文件不能超过: ${fieldLength.textFileSize} 字节`
        ),
    })
  ),
  async (req, res) => {
    try {
      const { path, text } = req._vdata;

      const { account, file_history } = req._hello.userinfo;

      const fpath = appConfig.userRootDir(account, path);

      const stat = await _f.lstat(fpath);
      const type = await _f.getType(stat);

      if (!type || type === 'dir' || appConfig.trashDir(account) === fpath) {
        _err(res, '文件不存在')(req, fpath, 1);
        return;
      }

      if (type === 'file') {
        if (file_history === 1) {
          try {
            if (stat.size > 0) {
              // 保存编辑历史版本
              const [, filename, , suffix] = _path.basename(fpath);

              const historyDir = _path.normalize(
                _path.dirname(fpath),
                appConfig.textFileHistoryDirName
              );

              const newName = `${filename}_${formatDate({
                template: `{0}{1}{2}-{3}{4}{5}`,
              })}${suffix ? `.${suffix}` : ''}`;

              await _f.cp(fpath, _path.normalize(historyDir, newName));
            }
          } catch (error) {
            await errLog(req, `保存文件历史版本失败(${fpath}-${error})`);
          }
        }
      }

      await _f.writeFile(fpath, text);

      syncUpdateData(req, 'file');

      fileList.clear(account);

      _success(res, '保存文件成功')(req, fpath, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
        }).custom(
          (obj) => _path.normalize(obj.path, obj.name) !== '/',
          'path/name 路径不能为: /'
        )
      )
        .min(1)
        .max(fieldLength.maxPagesize)
        .custom(
          (arr) => getDuplicates(arr, ['name']).length === 0,
          '不能有同名文件或文件夹'
        ),
    })
  ),
  async (req, res) => {
    try {
      const { path, data, rename } = req._vdata;

      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);

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

        const trashDir = appConfig.trashDir(account);

        await concurrencyTasks(data, 5, async (task) => {
          if (signal.aborted) return;

          const { name, path, type } = task;

          const f = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
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
        })
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { path, data } = req._vdata;

      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);

      if (!(await _f.exists(p))) {
        _err(res, '目标文件夹不存在')(req, p, 1);
        return;
      }

      _success(res, 'ok', { hasSameName: await hasSameNameFile(p, data) });
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
        }).custom(
          (obj) => _path.normalize(obj.path, obj.name) !== '/',
          'path/name 路径不能为: /'
        )
      )
        .min(1)
        .max(fieldLength.maxPagesize)
        .custom(
          (arr) => getDuplicates(arr, ['name']).length === 0,
          '不能有同名文件或文件夹'
        ),
    })
  ),
  async (req, res) => {
    try {
      const { path, data, rename } = req._vdata;
      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);

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

        const trashDir = appConfig.trashDir(account);

        await concurrencyTasks(data, 5, async (task) => {
          if (signal.aborted) return;

          const { name, path, type } = task;

          const f = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
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
      }).custom(
        (obj) => _path.normalize(obj.path, obj.name) !== '/',
        'path/name 路径不能为: /'
      ),
    })
  ),
  async (req, res) => {
    try {
      const { data } = req._vdata;

      const flag = data.type === 'dir' ? '文件夹' : '文件';

      const { name, path } = data;

      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);

      data.path = p;

      const f = _path.normalize(p, name);

      if (!(await _f.exists(f))) {
        _err(res, `${flag}不存在`)(req, f, 1);
        return;
      }

      const fname = (_path.extname(name)[0] || name) + '.zip';

      let t = _path.normalize(p, fname);

      if ((await _f.exists(t)) || t === appConfig.trashDir(account)) {
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
  }
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
          .custom(
            (v) => _path.extname(v)[2].toLowerCase() === 'zip',
            '必须是.zip文件'
          ),
        path: V.string().notEmpty().min(1).max(fieldLength.url),
        type: V.string().trim().equal('file'),
      }),
    })
  ),
  async (req, res) => {
    try {
      const { data } = req._vdata;

      const { name, path } = data;

      const { account } = req._hello.userinfo;

      const p = appConfig.userRootDir(account, path);
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
        if ((await _f.exists(t)) || t === appConfig.trashDir(account)) {
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
  }
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
        }).custom((obj) => {
          return (
            _path.normalize(obj.path, obj.name) !== '/' &&
            _path.normalize(obj.path, obj.name) !== `/${appConfig.trashDirName}`
          );
        }, `path/name 路径不能为: / 和 /${appConfig.trashDirName}`)
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { data, force } = req._vdata;

      const { account } = req._hello.userinfo;

      const controller = new AbortController();
      const signal = controller.signal;
      const taskKey = taskState.add(account, `删除文件...`, controller);

      fileList.clear(account);

      _success(res, 'ok', { key: taskKey });

      try {
        let count = 0;
        let size = 0;

        const trashDir = appConfig.trashDir(account);

        await concurrencyTasks(data, 5, async (task) => {
          if (signal.aborted) return;

          let { path, name, type } = task;

          const p = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
);

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

      const trashDir = appConfig.trashDir(account);

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
route.post(
  '/create-dir',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
      name: V.string().trim().min(1).max(fieldLength.filename),
    })
  ),
  async (req, res) => {
    try {
      const { path, name } = req._vdata;

      if (!_path.isFilename(name)) {
        _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
        return;
      }

      const { account } = req._hello.userinfo;

      const fpath = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { data, name } = req._vdata;

      if (!_path.isFilename(name)) {
        _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
        return;
      }

      const flag = data.type === 'dir' ? '文件夹' : '文件';

      const { account } = req._hello.userinfo;

      const dir = appConfig.userRootDir(account, data.path);

      const p = _path.normalize(dir, data.name),
        t = _path.normalize(dir, name);

      if (!(await _f.exists(p))) {
        _err(res, `${flag}不存在`)(req, p, 1);
        return;
      }

      if ((await _f.exists(t)) || appConfig.trashDir(account) === t) {
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
  }
);

// 文件权限
route.post(
  '/mode',
  validate(
    'body',
    V.object({
      mode: V.string()
        .trim()
        .pattern(/^[0-7]{3}$/, '必须是三位数字组成'),
      r: V.number().toInt().default(0).enum([0, 1]),
      data: V.array(
        V.object({
          name: V.string().notEmpty().min(1).max(fieldLength.filename),
          path: V.string().notEmpty().min(1).max(fieldLength.url),
          type: V.string().trim().enum(['dir', 'file']),
        })
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { data, mode, r } = req._vdata;

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

          const p = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
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
        })
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { data, uid, gid, r } = req._vdata;

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

          const p = appConfig.userRootDir(account, `${path}/${name}`);

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
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { HASH, name } = req._vdata;

      const { account } = req._hello.userinfo;

      const path = appConfig.temDir(`${account}_${HASH}`);

      await receiveFiles(req, path, name, fieldLength.maxFileChunk);

      _success(res);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
    }, fieldLength.operationTimeout);

    try {
      const { HASH, count, path } = req._vdata;

      const { account } = req._hello.userinfo;

      let targetPath = appConfig.userRootDir(
        account,
        `${_path.dirname(path)}/${_path.sanitizeFilename(
          _path.basename(path)[0]
        )}`
      );

      if (targetPath === appConfig.trashDir(account)) {
        targetPath = await getUniqueFilename(targetPath);
      }

      // 存在先删除
      if (await _f.exists(targetPath)) {
        await _f.del(targetPath);
      }

      await mergefile(
        count,
        appConfig.temDir(`${account}_${HASH}`),
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
  }
);

// 断点续传
route.post(
  '/breakpoint',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { HASH } = req._vdata;

      const { account } = req._hello.userinfo;

      const path = appConfig.temDir(`${account}_${HASH}`),
        list = await _f.readdir(path);

      _success(res, 'ok', list);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 重复
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { path } = req._vdata;

      const p = appConfig.userRootDir(req._hello.userinfo.account, path);

      if (await _f.exists(p)) {
        _success(res);
        return;
      }

      _nothing(res);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 离线下载
route.post(
  '/download',
  validate(
    'body',
    V.object({
      url: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
      path: V.string().notEmpty().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { url, path } = req._vdata;

      const { account } = req._hello.userinfo;

      const targetPath = appConfig.userRootDir(account, path);

      if (!(await _f.exists(targetPath))) {
        _err(res, '目标文件夹不存在')(req, targetPath, 1);
        return;
      }

      const filename = _path.sanitizeFilename(_path.basename(url)[0]);

      const controller = new AbortController();
      const signal = controller.signal;
      const taskKey = taskState.add(
        account,
        `下载文件: ${filename}`,
        controller
      );

      _success(res, 'ok', { key: taskKey });

      const temPath = appConfig.temDir(
        `${account}_${_crypto.getStringHash(url)}`
      );
      try {
        const stats = await _f.lstat(temPath);
        let downloadedBytes = stats ? stats.size : 0;

        const headers = {};
        if (downloadedBytes > 0) {
          headers.Range = `bytes=${downloadedBytes}-`;
        }

        const response = await axios({
          method: 'get',
          url,
          responseType: 'stream',
          signal,
          headers,
          decompress: false, // 防止 gzip 会导致续传失败
          validateStatus: (s) => s === 200 || s === 206,
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
              taskState.update(
                taskKey,
                `下载文件: ${filename} (${_f.formatBytes(downloadedBytes)})`
              );
              callback(null, chunk);
            },
          }),
          writer,
          { signal }
        );

        let outputFilePath = _path.normalize(targetPath, filename);

        // 已存在添加后缀
        if (
          (await _f.exists(outputFilePath)) ||
          outputFilePath === appConfig.trashDir(account)
        ) {
          outputFilePath = await getUniqueFilename(outputFilePath);
        }

        await _f.rename(temPath, outputFilePath);
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
  }
);

export default route;
