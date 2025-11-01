import appConfig from '../../data/config.js';

import { resolve } from 'path';

import {
  queryData,
  deleteData,
  batchDeleteData,
  fillString,
} from '../../utils/sqlite.js';

import _f from '../../utils/f.js';
import { _delDir, getRootDir } from '../file/file.js';

import shareVerify from '../../utils/shareVerify.js';
import { isValidShare, errLog, getDirname } from '../../utils/utils.js';
import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';

const __dirname = getDirname(import.meta);

// 获取字体列表
export async function getFontList() {
  const p = _path.normalize(appConfig.appData, 'font');
  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../font`), p);
  }
  return _f.readdir(p);
}

// 获取用户信息
export async function getUserInfo(account, fields = '*') {
  return (
    await queryData('user', fields, `WHERE state = ? AND account = ?`, [
      1,
      account,
    ])
  )[0];
}

// 获取外部播放器配置
export async function playInConfig() {
  const p = _path.normalize(appConfig.appData, '/data/playIn.json');

  const logop = _path.normalize(appConfig.appData, 'playerlogo');

  if (!(await _f.exists(logop))) {
    await _f.cp(resolve(__dirname, `../../img/playerlogo`), logop);
  }

  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../data/playIn.json`), p);
  }

  return JSON.parse(await _f.fsp.readFile(p));
}

// 删除用户数据
export async function deleteUser(account) {
  await deleteData('user', `WHERE account = ?`, [account]);

  await batchDeleteData('bmk', 'id', `WHERE account = ?`, [account]);

  await batchDeleteData('bmk_group', 'id', `WHERE account = ?`, [account]);

  await batchDeleteData('chat', 'id', `WHERE _from = ? OR _to = ?`, [
    account,
    account,
  ]);

  await batchDeleteData('count_down', 'id', `WHERE account = ?`, [account]);

  await batchDeleteData('friends', 'id', `WHERE account = ? OR friend = ?`, [
    account,
    account,
  ]);

  await batchDeleteData('history', 'id', `WHERE account = ?`, [account]);

  await deleteData('last_play', `WHERE account = ?`, [account]);

  await batchDeleteData('note', 'id', `WHERE account = ?`, [account]);

  await batchDeleteData('note_category', 'id', `WHERE account = ?`, [account]);

  await deleteData('playing_list', `WHERE account = ?`, [account]);

  await batchDeleteData('share', 'id', `WHERE account = ?`, [account]);

  await deleteData('song_list', `WHERE account = ?`, [account]);

  await batchDeleteData('todo', 'id', `WHERE account = ?`, [account]);

  await _delDir(_path.normalize(appConfig.appData, 'logo', account));

  await _delDir(getRootDir(account));
}

// 验证分享
export async function validShareState(shareToken, t) {
  const jwtData = jwt.get(shareToken);
  if (!jwtData) {
    return {
      state: 0,
      text: '访问令牌已过期',
    };
  }

  const {
    data: { id, types },
    type,
  } = jwtData.data;

  if (type !== 'share' || !id || !types || !types.includes(t)) {
    return {
      state: 0,
      text: '访问令牌错误',
    };
  }

  const share = (
    await queryData(
      'share',
      'exp_time,data,account',
      `WHERE id = ? AND type IN (${fillString(types.length)})`,
      [id, ...types]
    )
  )[0];

  if (!share)
    return {
      state: 0,
      text: '分享已取消',
    };

  if (isValidShare(share.exp_time))
    return {
      state: 0,
      text: '分享已过期',
    };

  share.data = JSON.parse(share.data);

  return {
    state: 1,
    data: share,
  };
}

// 验证分享
export async function validShareAddUserState(req, types, id, pass) {
  const { ip } = req._hello;

  if (shareVerify.verify(ip, id)) {
    const share = (
      await queryData(
        'share_user_view',
        'username,logo,email,exp_time,title,account,data,pass',
        `WHERE id = ? AND type IN (${fillString(types.length)})`,
        [id, ...types]
      )
    )[0];

    if (!share)
      return {
        state: 0,
        text: '分享已取消',
      };

    if (isValidShare(share.exp_time))
      return {
        state: 0,
        text: '分享已过期',
      };

    if (share.pass && pass !== share.pass) {
      // 进入页面第一次空提取码不计算
      if (pass) {
        shareVerify.add(ip, id);
        await errLog(req, `提取码错误(${id})`);
      }

      return {
        state: 3,
        text: '提取码错误',
      };
    }

    share.data = JSON.parse(share.data);

    return {
      state: 1,
      data: share,
    };
  } else {
    return {
      state: 0,
      text: '提取码多次错误，请10分钟后再试',
    };
  }
}
