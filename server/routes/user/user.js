import appConfig from '../../data/config.js';

import { resolve } from 'path';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';
import { _delDir } from '../file/file.js';

import shareVerify from '../../utils/shareVerify.js';
import { isValidShare, errLog, getDirname } from '../../utils/utils.js';
import jwt from '../../utils/jwt.js';
import captcha from '../../utils/captcha.js';

const __dirname = getDirname(import.meta);

// 获取字体列表
export async function getFontList() {
  const p = appConfig.fontDir();
  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../font`), p);
  }
  return _f.readdir(p);
}

// 获取用户信息
export async function getUserInfo(account, fields = '*') {
  return db('user').select(fields).where({ account, state: 1 }).findOne();
}

// 删除用户数据
export async function deleteUser(account) {
  await db('user').where({ account }).delete();

  await db('bmk').where({ account }).batchDelete();

  await db('bmk_group').where({ account }).batchDelete();

  await db('chat')
    .where({ $or: [{ _from: account }, { _to: account }] })
    .batchDelete();

  await db('count_down').where({ account }).batchDelete();

  await db('friends')
    .where({ $or: [{ account }, { friend: account }] })
    .batchDelete();

  await db('history').where({ account }).batchDelete();

  await db('last_play').where({ account }).delete();

  await db('note').where({ account }).batchDelete();

  await db('note_category').where({ account }).batchDelete();

  await db('playing_list').where({ account }).delete();

  await db('share').where({ account }).batchDelete();

  await db('song_list').where({ account }).delete();

  await db('todo').where({ account }).batchDelete();

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
  } = jwtData.data;

  if (type !== 'share' || !id || !types || !types.includes(t)) {
    return {
      state: 0,
      text: '访问令牌错误',
    };
  }

  const share = await db('share')
    .select('exp_time,data,account')
    .where({ id, type: { in: types } })
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

  share.data = JSON.parse(share.data);

  return {
    state: 1,
    data: share,
  };
}

// 验证分享
export async function validShareAddUserState(req, types, id, pass, captchaId) {
  const needCaptcha = !shareVerify.verify(id);
  if (needCaptcha && !captcha.consume(captchaId, id)) {
    return {
      state: 2,
      id,
      needCaptcha,
      text: '需要验证验证码，请完成验证',
    };
  }

  const share = await db('share_user_view')
    .select('username,logo,email,exp_time,title,account,data,pass')
    .where({ id, type: { in: types } })
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
}
