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
  // 非字符串或空值直接返回空数组
  if (!lrc || typeof lrc !== 'string') return [];

  // 时间标签 + 后面的内容（内容到下一个 [ 或行尾为止）
  // 兼容格式：[00:18.63] [00:18.6] [00:18] [00:18:63] [0:18.63]
  // 捕获组：1=分 2=秒 3=毫秒(可选) 4=该标签后的内容
  const LINE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]([^\[]*)/g;

  // key -> { time, lines }，相同时间标签的内容归到同一组
  const groups = new Map();
  let m;
  while ((m = LINE.exec(lrc)) !== null) {
    const [, min, sec, ms, raw] = m;

    // 去掉内容首尾空白；为空说明这个时间标签后面紧跟另一个标签，跳过
    const content = raw.trim();
    if (!content) continue;

    // 用原始时间字符串做 key，避免毫秒精度被数值转换抹掉
    const key = `${min}:${sec}${ms != null ? '.' + ms : ''}`;

    // 首次遇到该时间标签，计算时间（秒）并建组
    if (!groups.has(key)) {
      // 毫秒位数兼容：1 位=百毫秒，2 位=十毫秒，3 位=毫秒
      const milliseconds = ms != null ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) : 0;
      groups.set(key, {
        time: parseInt(min, 10) * 60 + parseInt(sec, 10) + milliseconds / 1000,
        lines: [],
      });
    }

    // 相同时间标签再次出现时，作为该组的后续行（翻译）
    groups.get(key).lines.push(content);
  }

  // 同时间标签多行 → 第一行原文，后续行翻译；单行则为纯原文
  const result = [];
  for (const { time, lines } of groups.values()) {
    if (lines.length) {
      result.push({ t: Math.round(time), p: lines[0], fy: lines.slice(1).join('\n') });
    }
  }

  // 按时间升序排序
  result.sort((a, b) => a.t - b.t);
  return result;
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
        'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at',
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
  let songListObj = await db('song_list').select('data').where({ account }).findOne();

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
