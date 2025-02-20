import NodeID3 from 'node-id3';

import {
  queryData,
  fillString,
  insertData,
  updateData,
} from '../../utils/sqlite.js';

import { batchTask, unique } from '../../utils/utils.js';
import _path from '../../utils/path.js';

export const nodeID3 = NodeID3.Promise;

// 处理歌单封面
export function handleMusicList(arr) {
  arr.forEach((v, i) => {
    v.len = v.item.length;
    if (i === 0) {
      v.pic = 'history';
      return;
    }
    const m = v.item[0];
    if (v.len > 0 && m && m.pic) {
      v.pic = _path.normalize(`/music`, m.pic);
    } else {
      v.pic = 'default';
    }
  });
  return arr;
}

// 解析歌词
export function parseLrc(lrc) {
  const reg = /\[(\d+\:\d+(\.\d+)?)\]([^\[\n\r]+)/gi,
    res = [];

  lrc.replace(reg, (...[, $1, , $2]) => {
    const parr = $2.split('<=>'),
      tarr = $1.split(':');

    res.push({
      t: parseInt(tarr[0] * 60) + Math.round(tarr[1]),
      p: parr[0].trim(),
      fy: parr[1] ? parr[1].trim() : '',
    });
  });
  res.sort((a, b) => a.t - b.t);
  return res;
}

// 分批读取音乐信息
export async function batchGetMusics(ids) {
  ids = unique(ids);

  const res = {};

  await batchTask(async (offset, limit) => {
    const arr = ids.slice(offset, offset + limit);

    if (arr.length === 0) return false;

    const list = await queryData(
      'songs',
      '*',
      `WHERE id IN (${fillString(arr.length)})`,
      [...arr]
    );
    list.forEach((item) => {
      res[item.id] = item;
    });

    return true;
  }, 800);

  return res;
}

// 获取歌曲列表
export async function getMusicList(account) {
  let songListObj = (
    await queryData('song_list', 'data', `WHERE account = ?`, [account])
  )[0];
  if (!songListObj) {
    const list = [
      { name: '播放历史', pic: 'img/history.jpg', item: [], id: 'history' },
      { name: '收藏', pic: 'img/music.jpg', item: [], id: 'favorites' },
    ];
    await insertData(
      'song_list',
      [
        {
          account,
          data: JSON.stringify(list),
        },
      ],
      'account'
    );
    return list;
  }
  return JSON.parse(songListObj.data);
}

// 更新歌曲列表
export function updateSongList(account, data) {
  return updateData(
    'song_list',
    {
      data: JSON.stringify(data),
    },
    `WHERE account = ?`,
    [account]
  );
}

// 歌单移动位置
export async function songlistMoveLocation(account, fId, tId) {
  if (fId === tId) return;

  const list = await getMusicList(account);

  const fIdx = list.findIndex((item) => item.id === fId),
    tIdx = list.findIndex((item) => item.id === tId);

  if (fIdx > 1 && tIdx > 1 && fIdx !== tIdx) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));
    await updateSongList(account, list);
  }
}

// 歌曲移动位置
export async function songMoveLocation(account, listId, fromId, toId) {
  if (fromId === toId) return;

  const list = await getMusicList(account);

  const idx = list.findIndex((item) => item.id === listId);

  if (idx > 0) {
    const fIdx = list[idx].item.findIndex((item) => item.id === fromId),
      tIdx = list[idx].item.findIndex((item) => item.id === toId);

    if (fIdx < 0 || tIdx < 0 || fIdx === tIdx) return;

    list[idx].item.splice(tIdx, 0, ...list[idx].item.splice(fIdx, 1));

    await updateSongList(account, list);
  }
}
