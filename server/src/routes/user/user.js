import appConfig from '../../config/index.js';

import { resolve } from 'path';

import { db, transaction } from '../../utils/db/sqlite.js';

import _f from '../../utils/fs/f.js';
import { _delDir } from '../file/file.js';

import shareVerify from '../../utils/security/shareVerify.js';
import { isValidShare, getDirname } from '../../utils/common/utils.js';
import jwt from '../../utils/security/jwt.js';
import captcha from '../../utils/security/captcha.js';
import { getUserInfoCached, clearUserInfoCache } from '../../utils/db/userCache.js';

const __dirname = getDirname(import.meta);

// 获取字体列表
export async function getFontList() {
  const p = appConfig.fontDir();
  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../resources/fonts`), p);
  }
  return _f.readdir(p);
}

// 获取用户信息
export async function getUserInfo(account, fields = '*') {
  // 全字段查询走缓存，其余按字段查询仍直接读库
  if (fields === '*') return getUserInfoCached(account);

  return db('user').select(fields).where({ account, state: 1 }).findOne();
}

// 删除用户数据
export async function deleteUser(account) {
  // 只按 account 过滤的表
  const accountTables = [
    'bmk',
    'bmk_group',
    'count_down',
    'history',
    'note',
    'note_category',
    'share',
    'ssh',
    'ssh_category',
    'todo',
  ];

  // account 唯一、单条删除即可的表
  const singleTables = ['last_play', 'playing_list', 'song_list', 'collect_bg'];

  // 所有数据库删除一次提交；失败时整体回滚
  transaction(() => {
    db('user').where({ account }).delete();

    for (const table of accountTables) {
      db(table).where({ account }).batchDelete();
    }

    for (const table of singleTables) {
      db(table).where({ account }).delete();
    }

    db('chat')
      .where({ $or: [{ _from: account }, { _to: account }] })
      .batchDelete();

    db('friends')
      .where({ $or: [{ account }, { friend: account }] })
      .batchDelete();
  });

  // 事务提交后再清缓存、删文件
  clearUserInfoCache(account);

  await _delDir(appConfig.userRootDir(account));
}

// 验证分享
export async function validShareState(shareToken, t) {
  const jwtData = await jwt.get(shareToken);
  if (!jwtData) {
    return {
      state: 0,
      text: '访问令牌已过期',
    };
  }

  const {
    data: { id, types },
    type,
    update_at,
  } = jwtData.data;

  if (type !== 'share' || !id || !types || !types.includes(t)) {
    return {
      state: 0,
      text: '访问令牌错误',
    };
  }

  const share = db('share')
    .select('id,exp_time,data,account,update_at')
    .where({ id, state: 1, type: { in: types } })
    .findOne();

  if (!share)
    return {
      state: 0,
      text: '分享已取消',
    };

  if (share.update_at !== update_at)
    return {
      state: 0,
      text: '访问令牌失效',
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
export async function validShareAddUserState(res, types, id, pass, captchaId) {
  const needCaptcha = !shareVerify.verify(id);
  if (needCaptcha && !captcha.consume(captchaId, id)) {
    return {
      state: 2,
      id,
      needCaptcha,
      text: '需要验证验证码，请完成验证',
    };
  }

  const share = db('share AS s')
    .join('user AS u', { 'u.account': { value: 's.account', raw: true } }, { type: 'LEFT' })
    .select('u.username,u.logo,s.exp_time,s.title,s.account,s.data,s.pass,s.update_at')
    .where({ 's.id': id, 's.state': 1, 's.type': { in: types } })
    .findOne();

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
      shareVerify.add(id);
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
}
