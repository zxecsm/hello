import NodeID3 from 'node-id3';

import { db } from '../../utils/sqlite.js';

import { batchTask, parseJson, unique } from '../../utils/utils.js';

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
      v.pic = m.id;
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

    const list = await db('songs')
      .select(
        'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at'
      )
      .where({ id: { in: arr } })
      .find();

    list.forEach((item) => {
      item.mv = !!item.mv;
      item.pic = !!item.pic;
      item.url = !!item.url;
      item.lrc = !!item.lrc;
      res[item.id] = item;
    });

    return true;
  }, 800);

  return res;
}

// 获取歌曲列表
export async function getMusicList(account) {
  let songListObj = await db('song_list')
    .select('data')
    .where({ account })
    .findOne();

  const list = [
    { name: '播放历史', pic: 'img/history.jpg', item: [], id: 'history' },
    { name: '收藏', pic: 'img/music.jpg', item: [], id: 'favorites' },
  ];
  if (!songListObj) {
    await db('song_list').insert({
      create_at: Date.now(),
      account,
      data: JSON.stringify(list),
    });
    return list;
  }
  return parseJson(songListObj.data, list);
}

// 更新歌曲列表
export function updateSongList(account, data) {
  return db('song_list')
    .where({ account })
    .update({
      data: JSON.stringify(data),
    });
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
