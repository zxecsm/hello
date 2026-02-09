import express from 'express';

import { allSql, db } from '../../utils/sqlite.js';

import {
  deepClone,
  getSongInfo,
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  isMusicFile,
  paramErr,
  unique,
  getTimePath,
  errLog,
  syncUpdateData,
  createPagingData,
  uLog,
  concurrencyTasks,
  getSplitWord,
  myShuffle,
  normalizePageNo,
  parseJson,
  validate,
} from '../../utils/utils.js';

import { _d } from '../../data/data.js';

import appConfig from '../../data/config.js';

import _crypto from '../../utils/crypto.js';

import _f from '../../utils/f.js';

import { _delDir } from '../file/file.js';

import {
  handleMusicList,
  parseLrc,
  batchGetMusics,
  getMusicList,
  updateSongList,
  songlistMoveLocation,
  songMoveLocation,
  nodeID3,
} from './player.js';

import { getFriendInfo } from '../chat/chat.js';

import { validShareState, validShareAddUserState } from '../user/user.js';

import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import pinyin from '../../utils/pinyin.js';
import jwt from '../../utils/jwt.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';
const maxSonglistCount = 2000;

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

// 获取歌词
route.post(
  '/lrc',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  async (req, res) => {
    const errData = [
      {
        t: 0,
        p: '未找到歌词',
        fy: '',
      },
    ];

    try {
      const { id, token } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (!account) {
        if (!token) {
          paramErr(res, req, 'token 不能为空', 'body');
          return;
        }

        const share = await validShareState(token, 'music');

        if (share.state === 0) {
          errData[0].p = share.text;

          await errLog(req, share.text);

          _success(res, 'ok', errData);
          return;
        }

        const { data } = share.data;

        if (!data.some((item) => item === id)) {
          _success(res, 'ok', errData);
          return;
        }
      }

      if (token) {
        // 自增播放次数
        await db('songs').where({ id }).increment({ play_count: 1 });
      }

      const songInfo = await db('songs').select('lrc').where({ id }).findOne();
      if (!songInfo) {
        _success(res, 'ok', errData);
        return;
      }

      const url = appConfig.musicDir(songInfo.lrc);

      if ((await _f.getType(url)) === 'file') {
        const str = (await _f.readFile(url, null, '')).toString(),
          lrcList = parseLrc(str);

        lrcList.unshift({
          t: 0,
          p: '',
          fy: '',
        });

        if (lrcList.length === 1) {
          _success(res, 'ok', errData);
        } else {
          _success(res, 'ok', lrcList);
        }
      } else {
        _success(res, 'ok', errData);
      }
    } catch (error) {
      await errLog(req, error);
      _success(res, 'ok', errData);
    }
  },
);

// 歌曲信息
route.post(
  '/song-info',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  async (req, res) => {
    try {
      const { id, token } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (!account) {
        if (!token) {
          paramErr(res, req, 'token 不能为空', 'body');
          return;
        }

        const share = await validShareState(token, 'music');

        if (share.state === 0) {
          _err(res, share.text)(req, id, 1);
          return;
        }

        const { data } = share.data;

        if (!data.some((item) => item === id)) {
          _err(res, '歌曲不存在')(req, id, 1);
          return;
        }
      }

      const info = await db('songs')
        .select(
          'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at',
        )
        .where({ id })
        .findOne();

      if (!info) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      info.pic = !!info.pic;
      info.lrc = !!info.lrc;
      info.url = !!info.url;
      info.mv = !!info.mv;
      _success(res, 'ok', info);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 分享
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
  async (req, res) => {
    try {
      const { id, pass, captchaId } = req[kValidate];

      const share = await validShareAddUserState(req, ['music'], id, pass, captchaId);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      if (share.state === 2) {
        _success(res, share.text, {
          id: share.id,
          needCaptcha: share.needCaptcha,
        })(req, share.id, 1);
        return;
      }

      if (share.state === 3) {
        _nothing(res, share.text);
        return;
      }

      let { username, logo, email, exp_time, title, account: acc, data } = share.data;

      // 通过id分批读取音乐信息并策略化
      const mObj = await batchGetMusics(data);

      for (let i = 0; i < data.length; i++) {
        if (mObj.hasOwnProperty(data[i])) {
          data[i] = mObj[data[i]];
        } else {
          data.splice(i, 1);
          i--;
        }
      }

      if (data.length === 0) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      const { account } = req[kHello].userinfo;

      if (account && account != acc) {
        const f = await getFriendInfo(account, acc, 'des');
        const des = f ? f.des : '';

        username = des || username;
      }

      _success(res, '读取歌曲分享成功', {
        username,
        logo,
        email,
        exp_time,
        account: acc,
        data,
        title,
        token: await jwt.set(
          { type: 'share', data: { id, types: ['music'] } },
          fieldLength.shareTokenExp,
        ),
      })(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 搜索
route.get(
  '/search',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      word: V.string().trim().min(1).max(fieldLength.searchWord),
    }),
  ),
  async (req, res) => {
    try {
      const { word, pageNo } = req[kValidate];

      const pageSize = 100;

      const splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      const songdb = db('songs')
        .select(
          'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at',
        )
        .search(curSplit, ['title', 'artist'], {
          sort: true,
        });

      const total = await songdb.count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      let list = [];

      if (total > 0) {
        const offset = (result.pageNo - 1) * pageSize;

        list = (await songdb.page(pageSize, offset).find()).map((m) => ({
          ...m,
          pic: !!m.pic,
          lrc: !!m.lrc,
          url: !!m.url,
          mv: !!m.mv,
        }));
      }

      _success(res, 'ok', {
        ...result,
        data: list,
        splitWord,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 获取列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(50).min(1).max(fieldLength.maxPagesize),
      sort: V.string()
        .trim()
        .default('default')
        .enum(['default', 'artist', 'title', 'playCount', 'collectCount']),
      playId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      onlyMv: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  async (req, res) => {
    try {
      let { id, pageNo, pageSize, sort, playId, onlyMv } = req[kValidate];

      if (id === 'all' && playId) onlyMv = 0;

      const { account } = req[kHello].userinfo;

      let songList = await getMusicList(account);

      let ids = []; // 需要获取歌曲信息的ids

      songList.forEach((list) => {
        const { item, id: listid } = list;

        if (item.length === 0) return;

        if (listid === id) {
          ids.push(...item.map((m) => m.id));
        } else {
          ids.push(item[0].id);
        }
      });

      // 通过id分批读取音乐信息并策略化
      const musicsObj = await batchGetMusics(ids);

      let hasChange = false;

      songList.forEach((list) => {
        if (list.id === id) {
          for (let i = 0; i < list.item.length; i++) {
            const m = list.item[i];

            if (musicsObj.hasOwnProperty(m.id)) {
              list.item[i] = musicsObj[m.id];
            } else {
              hasChange = true;
              list.item.splice(i, 1);
              i--;
            }
          }
        } else {
          if (list.item.length > 0) {
            const m = list.item[0];

            if (musicsObj.hasOwnProperty(m.id)) {
              list.item[0] = musicsObj[m.id];
            }
          }
        }
      });

      // 如果有已删除的歌曲，则删除并更新列表数据
      if (hasChange) {
        const list = deepClone(songList);

        list.forEach((item) => {
          item.item = item.item.map((y) => ({ id: y.id }));
        });

        await updateSongList(account, list);
      }

      // 所有歌曲歌单获取最新一首用来读取封面
      const newSong = await db('songs').select('id,pic').orderBy('serial', 'DESC').limit(1).find();

      songList.splice(2, 0, { id: 'all', item: newSong });

      // 更新默认歌单列表信息
      for (let i = 0; i < 3; i++) {
        songList[i].name = _d.songList[i].name;
        songList[i].des = _d.songList[i].des;
      }

      // 更新歌单封面
      songList = handleMusicList(songList);

      // 歌单id没有默认为收藏歌单
      id ? null : (id = songList[1].id);

      for (let i = 0; i < songList.length; i++) {
        const item = songList[i];

        item.num = i;

        if (item.id !== id && i != 1) {
          // 过滤非选择的歌单
          delete item.item;
        } else {
          if (item.id === 'all') {
            const songDB = db('songs').select(
              'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at',
            );
            if (onlyMv === 1) {
              songDB.where({ mv: { '!=': '' } });
            }
            const total = await songDB.count();

            pageNo = normalizePageNo(total, pageSize, pageNo);

            let list = [];

            if (total > 0) {
              let offset = (pageNo - 1) * pageSize;
              const orderMap = {
                artist: ['artist_pinyin', 'ASC'],
                title: ['title_pinyin', 'ASC'],
                playCount: ['play_count', 'DESC'],
                collectCount: ['collect_count', 'DESC'],
                default: ['serial', 'DESC'],
              };
              const [orderField, orderDir] = orderMap[sort] || orderMap.default;
              songDB.orderBy(orderField, orderDir);

              if (playId) {
                // 定位到正则播放歌曲所在页
                const row = await songDB.clone().select('serial').where({ id: playId }).findOne();
                if (row) {
                  let count = 0;
                  if (sort === 'default') {
                    count = await songDB
                      .clone()
                      .where({
                        serial: {
                          [`${orderDir === 'ASC' ? '<=' : '>='}`]: row.serial,
                        },
                      })
                      .count();
                  } else {
                    count =
                      (
                        await allSql(
                          `WITH OrderedSongs AS (
                                SELECT id, ${orderField}, ROW_NUMBER() OVER (ORDER BY ${orderField} ${orderDir}) AS row_num
                                FROM songs
                              )
                              SELECT row_num
                              FROM OrderedSongs
                              WHERE id = ?`,
                          [playId],
                        )
                      )[0]?.row_num || 0;
                  }
                  pageNo = Math.ceil(count / pageSize);
                  offset = (pageNo - 1) * pageSize;
                }
              }

              list = await songDB.page(pageSize, offset).find();
            }

            const obj = createPagingData(Array(total), pageSize, pageNo);

            item.item = list;
            item.totalPage = obj.totalPage;
            item.pageNo = obj.pageNo;
            item.total = obj.total;
            item.len = total;
          }

          item.item = item.item.map((m, idx) => ({
            ...m,
            num: idx,
            mv: !!m.mv,
            pic: !!m.pic,
            url: !!m.url,
            lrc: !!m.lrc,
          }));
        }
      }

      _success(res, 'ok', songList);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 导出歌单
route.get(
  '/export',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const songListObj = (await getMusicList(account)).find((item) => item.id === id);

      if (!songListObj) {
        _err(res, '歌单不存在')(req, id, 1);
        return;
      }

      const musicsObj = await batchGetMusics(songListObj.item.map((m) => m.id));

      const list = songListObj.item.reduce((pre, cur) => {
        if (!musicsObj.hasOwnProperty(cur.id)) return pre;

        pre.push(musicsObj[cur.id]);
        return pre;
      }, []);

      await uLog(req, `导出歌单(${songListObj.name}-${id}-${list.length})`);
      res.send(JSON.stringify(list));
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 导入歌单
route.post(
  '/import',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      list: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(maxSonglistCount),
    }),
  ),
  async (req, res) => {
    try {
      const { list, id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const songLists = await getMusicList(account);

      const idx = songLists.findIndex((item) => item.id === id);

      if (idx < 0) {
        _err(res, '歌单不存在')(req, id, 1);
        return;
      }

      const newSongList = unique(
        [...list.map((item) => ({ id: item.id })), ...songLists[idx].item],
        ['id'],
      );

      if (newSongList.length > maxSonglistCount) {
        _err(res, `歌单限制${maxSonglistCount}首`)(req);
        return;
      }

      songLists[idx].item = newSongList;

      await updateSongList(account, songLists);

      syncUpdateData(req, 'music');

      _success(res, '导入歌曲成功')(req, `${songLists[idx].name}-${id}-${list.length}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 最后播放
route.post(
  '/last-play',
  validate(
    'body',
    V.object({
      history: V.number().toInt().enum([1, 0]),
      lastplay: V.object({
        id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      }),
      currentTime: V.number().toNumber().min(0),
      duration: V.number().toNumber().min(0),
    }),
  ),
  async (req, res) => {
    try {
      const { history, lastplay, currentTime, duration } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const change = await db('last_play').where({ account }).update({
        song_id: lastplay.id,
        play_current_time: currentTime,
        duration,
      });
      if (change.changes === 0) {
        await db('last_play').insert({
          create_at: new Date(),
          account,
          song_id: lastplay.id,
          play_current_time: currentTime,
          duration,
        });
      }

      // 增加播放历史记录
      if (history === 1) {
        // 自增播放次数
        await db('songs').where({ id: lastplay.id }).increment({ play_count: 1 });

        const list = await getMusicList(account);

        list[0].item.unshift({ id: lastplay.id });
        list[0].item = unique(list[0].item, ['id']).slice(0, maxSonglistCount);

        await updateSongList(account, list);

        syncUpdateData(req, 'music');
      } else {
        syncUpdateData(req, 'musicinfo');
      }
      _success(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 最后播放记录
route.get('/last-play', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;

    const lastm = await db('last_play')
      .select('song_id,play_current_time,duration')
      .where({ account })
      .findOne();

    const obj = {
      currentTime: 0,
      duration: 0,
      lastplay: {},
    };

    if (lastm) {
      const { song_id, play_current_time, duration } = lastm;

      obj.currentTime = play_current_time;
      obj.duration = duration;

      const lastplay = await db('songs')
        .select(
          'id,pic,lrc,url,mv,title,artist,duration,album,year,collect_count,play_count,create_at',
        )
        .where({ id: song_id })
        .findOne();

      if (lastplay) {
        lastplay.mv = !!lastplay.mv;
        lastplay.pic = !!lastplay.pic;
        lastplay.url = !!lastplay.url;
        lastplay.lrc = !!lastplay.lrc;
        obj.lastplay = lastplay;
      }
    }

    _success(res, 'ok', obj);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 随机播放列表
route.get('/random-list', async (req, res) => {
  try {
    const list = await db('songs').getRandom({ limit: maxSonglistCount });

    if (list.length === 0) {
      _err(res, '音乐库为空')(req);
      return;
    }

    _success(res, 'ok', myShuffle(list));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 播放列表
route.post(
  '/playlist',
  validate(
    'body',
    V.object({
      data: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric()).max(
        maxSonglistCount,
      ),
    }),
  ),
  async (req, res) => {
    try {
      const { data } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const change = await db('playing_list')
        .where({ account })
        .update({
          data: JSON.stringify(data),
        });

      if (change.changes === 0) {
        await db('playing_list').insert({
          create_at: Date.now(),
          account,
          data: JSON.stringify,
        });
      }

      syncUpdateData(req, 'playinglist');
      _success(res, '更新播放列表成功')(req);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 播放列表
route.get('/playlist', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;

    const playing = await db('playing_list').select('data').where({ account }).findOne();

    let list = [];

    if (playing) {
      list = parseJson(playing.data, []);

      const mObj = await batchGetMusics(list);

      for (let i = 0; i < list.length; i++) {
        if (mObj.hasOwnProperty(list[i])) {
          list[i] = mObj[list[i]];
        } else {
          list.splice(i, 1);
          i--;
        }
      }
    }

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 歌单位置
route.post(
  '/move-list',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { fromId, toId } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await songlistMoveLocation(account, fromId, toId);

      syncUpdateData(req, 'music');

      _success(res, '歌单移动位置成功')(req, `${fromId}-${toId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 删除歌单
route.post(
  '/delete-list',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      const idx = list.findIndex((item) => item.id === id);

      // 过滤默认歌单
      if (idx > 1) {
        const songListTitle = list.splice(idx, 1)[0].name;

        await updateSongList(account, list);

        syncUpdateData(req, 'music');

        _success(res, '删除歌单成功')(req, `${songListTitle}-${id}`, 1);
        return;
      }

      _err(res, '无权删除默认歌单')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 歌单编辑
route.post(
  '/edit-list',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      name: V.string().trim().min(1).max(fieldLength.title),
      des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
      toId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id, name, des, toId } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      const idx = list.findIndex((item) => item.id === id);

      const log = `${id}-${name}${des ? `-${des}` : ''}`;

      if (id === 'all' && req[kHello].isRoot) {
        _d.songList[2].name = name;
        _d.songList[2].des = des;
        _success(res, '更新歌单信息成功')(req, log, 1);
      } else if (idx < 2 && idx >= 0 && req[kHello].isRoot) {
        _d.songList[idx].name = name;
        _d.songList[idx].des = des;
        _success(res, '更新歌单信息成功')(req, log, 1);
      } else if (idx > 1) {
        list[idx].name = name;
        list[idx].des = des;

        await updateSongList(account, list);

        if (toId) {
          await songlistMoveLocation(account, id, toId);
        }

        syncUpdateData(req, 'music');

        _success(res, '更新歌单信息成功')(req, log, 1);
      } else {
        _err(res, '无权更新当前歌单信息')(req, log, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 编辑歌曲
route.post(
  '/edit-song',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      artist: V.string().trim().min(1).max(fieldLength.title),
      album: V.string().trim().min(1).max(fieldLength.title),
      year: V.string().trim().default('').allowEmpty().max(10),
      duration: V.number().toNumber().min(0),
      collect_count: V.number().toInt().min(0),
      play_count: V.number().toInt().min(0),
    }),
  ),
  async (req, res) => {
    try {
      const { id, title, artist, album, year, duration, collect_count, play_count } =
        req[kValidate];

      if (!req[kHello].isRoot) {
        _err(res, '无权更新歌曲信息')(req, `${id}-${artist}-${title}`, 1);
        return;
      }

      const songInfo = await db('songs').select('url,hash,artist,title').where({ id }).findOne();

      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      let newHASH = '';

      try {
        const songUrl = appConfig.musicDir(songInfo.url);

        // 写入歌曲文件
        await nodeID3.update(
          {
            title,
            artist,
            album,
            year,
          },
          songUrl,
        );

        // 重新计算歌曲HASH
        newHASH = await _crypto.sampleHash(songUrl);
      } catch {
        await errLog(req, `写入元数据到歌曲文件失败(${songInfo.artist}-${songInfo.title})`);
      }

      await db('songs')
        .where({ id })
        .update({
          title,
          title_pinyin: pinyin(title),
          artist,
          artist_pinyin: pinyin(artist),
          album,
          year,
          duration,
          play_count,
          collect_count,
          hash: newHASH || songInfo.hash,
        });

      syncUpdateData(req, 'music');

      _success(res, '更新歌曲信息成功')(req, `${id}-${artist}-${title}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 添加歌单
route.post(
  '/add-list',
  validate(
    'body',
    V.object({
      name: V.string().trim().min(1).max(fieldLength.title),
      des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
    }),
  ),
  async (req, res) => {
    try {
      const { name, des } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      if (list.length >= fieldLength.songList + 2) {
        _err(res, `歌单限制${fieldLength.songList}`)(req);
        return;
      }

      const id = nanoid();
      list.push({
        name,
        des,
        item: [],
        id,
      });

      await updateSongList(account, list);

      syncUpdateData(req, 'music');

      _success(res, '添加歌单成功')(req, `${id}-${name}${des ? `-${des}` : ''}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 移动歌曲
route.post(
  '/move-song',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      listId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { fromId, toId, listId } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await songMoveLocation(account, listId, fromId, toId);

      syncUpdateData(req, 'music');

      _success(res, '歌曲移动位置成功')(req, `${listId}: ${fromId}=>${toId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 收藏歌曲
route.post(
  '/collect-song',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  async (req, res) => {
    try {
      const { ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      const add = ids.map((item) => ({ id: item }));

      const newSongList = unique([...add, ...list[1].item], ['id']);

      if (newSongList.length > maxSonglistCount) {
        _err(res, `歌单限制${maxSonglistCount}首`)(req);
        return;
      }

      list[1].item = newSongList;

      await updateSongList(account, list);

      // 更新歌曲收藏记录
      await db('songs')
        .where({ id: { in: ids } })
        .increment({ collect_count: 1 });

      syncUpdateData(req, 'music');

      _success(res, '收藏歌曲成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 移除收藏
route.post(
  '/close-collect-song',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      list[1].item = list[1].item.filter((v) => v.id !== id);

      await updateSongList(account, list);

      syncUpdateData(req, 'music');

      _success(res, '移除收藏歌曲成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 删除
route.post(
  '/delete-song',
  validate(
    'body',
    V.object({
      listId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(maxSonglistCount),
    }),
  ),
  async (req, res) => {
    try {
      const { listId, ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (listId === 'all') {
        // 限制删除数量
        if (ids.length > fieldLength.maxPagesize) {
          paramErr(res, req, `ids.length 不能大于: ${fieldLength.maxPagesize}`, 'body');
          return;
        }

        if (!req[kHello].isRoot) {
          _err(res, '无权删除歌曲')(req, `${listId}-${ids.length}`, 1);
          return;
        }

        const dels = await db('songs')
          .select('url,artist,title')
          .where({ id: { in: ids } })
          .find();

        await concurrencyTasks(dels, 5, async (del) => {
          const { url, artist, title } = del;

          await _delDir(appConfig.musicDir(_path.dirname(url)));

          await uLog(req, `删除歌曲(${artist}-${title})`);
        });

        await db('songs')
          .where({ id: { in: ids } })
          .delete();
      } else {
        const list = await getMusicList(account);

        const idx = list.findIndex((item) => item.id === listId);

        if (idx >= 0) {
          list[idx].item = list[idx].item.filter((item) => !ids.some((y) => y === item.id));

          await updateSongList(account, list);
        }
      }

      syncUpdateData(req, 'music');

      _success(res, `${listId === 'all' ? '删除' : '移除'}歌曲成功`)(
        req,
        `${listId}-${ids.length}`,
        1,
      );
    } catch (error) {
      _err(res)(req, error);
      return;
    }
  },
);

// 音乐移动到歌单
route.post(
  '/song-to-list',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  async (req, res) => {
    try {
      let { fromId, toId, ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await getMusicList(account);

      ids = ids.map((item) => ({ id: item }));

      const fIdx = list.findIndex((item) => item.id === fromId),
        tIdx = list.findIndex((item) => item.id === toId);

      if (
        (fromId === 'all' && tIdx > 1 && fromId !== toId) ||
        (fIdx >= 0 && fIdx < 2 && tIdx > 1)
      ) {
        // 从所有歌曲歌单和默认歌单添加到非默认歌单
        const newSongList = unique([...ids, ...list[tIdx].item], ['id']);

        if (newSongList.length > maxSonglistCount) {
          _err(res, `歌单限制${maxSonglistCount}首`)(req);
          return;
        }

        list[tIdx].item = newSongList;

        await updateSongList(account, list);

        syncUpdateData(req, 'music');

        _success(res, '添加歌曲成功')(req, `${ids.length}=>${toId}`, 1);
        return;
      }
      if (fIdx > 1 && tIdx > 1 && fromId !== toId) {
        // 从非默认歌单移动到非默认歌单
        const newSongList = unique([...ids, ...list[tIdx].item], ['id']);

        if (newSongList.length > maxSonglistCount) {
          _err(res, `歌单限制${maxSonglistCount}首`)(req);
          return;
        }

        // 原歌单删除选中歌曲
        list[fIdx].item = list[fIdx].item.filter((item) => !ids.some((y) => y.id === item.id));

        list[tIdx].item = newSongList;

        await updateSongList(account, list);

        syncUpdateData(req, 'music');

        _success(res, '移动歌曲成功')(req, `${ids.length}=>${toId}`, 1);
        return;
      }
      _err(res, '无权操作')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 删除mv
route.post(
  '/delete-mv',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      if (!req[kHello].isRoot) {
        _err(res, '无权操作')(req, id, 1);
        return;
      }

      const dels = await db('songs').select('mv,artist,title').where({ id }).find();

      for (let i = 0; i < dels.length; i++) {
        const { mv, artist, title } = dels[i];
        if (mv) {
          await _delDir(appConfig.musicDir(mv));
          await uLog(req, `删除MV(${artist}-${title})`);
        }
      }

      await db('songs').where({ id }).update({ mv: '' });

      syncUpdateData(req, 'music');

      _success(res, '删除MV成功');
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 读取歌词
route.get(
  '/read-lrc',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const musicinfo = await db('songs').select('lrc').where({ id }).findOne();

      if (!musicinfo) {
        _err(res, '歌曲不存在')(req, id, 1);
      }

      const url = appConfig.musicDir(musicinfo.lrc);

      if ((await _f.getType(url)) === 'file') {
        const str = (await _f.readFile(url, null, '')).toString();
        _success(res, 'ok', str);
      } else {
        await _f.writeFile(url, '');

        _success(res, 'ok', '');
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 编辑歌词
route.post(
  '/edit-lrc',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      text: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.lrcSize,
          `文本内容不能超过: ${fieldLength.lrcSize} 字节`,
        ),
    }),
  ),
  async (req, res) => {
    try {
      const { id, text } = req[kValidate];

      if (!req[kHello].isRoot) {
        _err(res, '无权操作')(req, id, 1);
        return;
      }

      const musicinfo = await db('songs')
        .select('url,lrc,artist,title,hash')
        .where({ id })
        .findOne();

      if (!musicinfo) {
        _err(res, '歌曲不存在')(req, id, 1);
      }

      const url = appConfig.musicDir(musicinfo.lrc);

      await _f.writeFile(url, text);

      try {
        const songUrl = appConfig.musicDir(musicinfo.url);

        // 写入歌曲文件
        await nodeID3.update(
          {
            unsynchronisedLyrics: {
              language: 'eng',
              text,
            },
          },
          songUrl,
        );

        const newHASH = await _crypto.sampleHash(songUrl);

        if (newHASH && newHASH !== musicinfo.hash) {
          await db('songs').where({ id }).update({ hash: newHASH });
        }
      } catch {
        await errLog(req, `写入元数据到歌曲文件失败(${musicinfo.artist}-${musicinfo.title}`);
      }

      _success(res, '更新歌词成功')(req, `${id}-${musicinfo.artist}-${musicinfo.title}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
      list: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(maxSonglistCount),
    }),
  ),
  async (req, res) => {
    try {
      const { list, title, expireTime, pass } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const id = nanoid();
      const create_at = Date.now();
      const obj = {
        id,
        create_at,
        exp_time: expireTime === 0 ? 0 : create_at + expireTime * 24 * 60 * 60 * 1000,
        title,
        pass,
        data: JSON.stringify(list),
        account,
        type: 'music',
      };

      await db('share').insert(obj);

      syncUpdateData(req, 'sharelist');

      _success(res, '分享歌曲成功', { id })(req, `${title}-${id}-${list.length}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 歌曲上传
route.post(
  '/up',
  validate(
    'query',
    V.object({
      name: V.string().trim().min(1).max(fieldLength.filename),
      HASH: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      type: V.string().trim().enum(['song', 'cover', 'mv']),
      id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { HASH, name, type, id } = req[kValidate];

      if (type === 'song') {
        if (!HASH) {
          paramErr(res, req, 'HASH 不能为空', 'query');
          return;
        }

        if (!isMusicFile(name)) {
          _err(res, '歌曲格式错误')(req, name, 1);
          return;
        }

        const song = await db('songs').select('id,artist,title').where({ hash: HASH }).findOne();

        if (song) {
          _err(res, '歌曲已存在')(req, `${song.artist}-${song.title}`, 1);
          return;
        }

        const songId = nanoid();

        const create_at = Date.now();

        const timePath = getTimePath(create_at);

        const suffix = _path.extname(name)[2];

        const tDir = appConfig.musicDir(timePath, songId);
        const tName = `${songId}.${suffix}`;

        await receiveFiles(req, tDir, tName, fieldLength.maxSongSize, HASH);

        // 读取歌曲元数据
        const songInfo = await getSongInfo(_path.normalize(tDir, tName));

        let {
          album = '',
          year = '',
          title,
          duration,
          artist,
          pic = '',
          lrc = '',
          picFormat,
        } = songInfo;

        picFormat = _path.basename(picFormat)[0];
        if (picFormat && pic) {
          // 提取封面
          await _f.writeFile(_path.normalize(tDir, `${songId}.${picFormat}`), pic);
          pic = _path.normalize(timePath, songId, `${songId}.${picFormat}`);
        }

        await _f.writeFile(_path.normalize(tDir, `${songId}.lrc`), lrc);

        await db('songs').insert({
          id: songId,
          create_at,
          artist,
          artist_pinyin: pinyin(artist),
          title,
          title_pinyin: pinyin(title),
          duration,
          album,
          year,
          hash: HASH,
          pic,
          url: _path.normalize(timePath, songId, tName),
          lrc: _path.normalize(timePath, songId, `${songId}.lrc`),
        });

        _success(res, '上传歌曲成功')(req, `${songId}-${artist}-${title}`, 1);
      } else if (type === 'cover') {
        if (!id) {
          paramErr(res, req, 'id 不能为空', 'query');
          return;
        }

        if (!req[kHello].isRoot) {
          _err(res, '无权上传封面')(req, id, 1);
          return;
        }

        if (!isImgFile(name)) {
          _err(res, '封面图片格式不支持')(req, name, 1);
          return;
        }

        const songInfo = await db('songs')
          .select('url,pic,hash,title,artist')
          .where({ id })
          .findOne();

        if (!songInfo) {
          _err(res, '歌曲不存在')(req, id, 1);
          return;
        }

        const { url, pic, title, artist, hash } = songInfo;

        const tDir = appConfig.musicDir(_path.dirname(url));
        const tName = `${_path.basename(url)[1]}.${_path.extname(name)[2]}`;

        await receiveFiles(req, tDir, tName, fieldLength.maxSongPicSize, HASH);

        // 如果上传封面文件和现有的封面文件名不同，删除现有的
        if (_path.basename(pic)[0] !== tName) {
          if (pic) {
            await _delDir(_path.normalize(tDir, _path.basename(pic)[0]));
          }
        }

        let newHASH = '';

        try {
          const songUrl = appConfig.musicDir(url);

          // 写入歌曲文件
          await nodeID3.update(
            {
              image: {
                type: {
                  id: 3,
                  name: 'front cover',
                },
                imageBuffer: await _f.fsp.readFile(_path.normalize(tDir, tName)),
              },
            },
            songUrl,
          );

          newHASH = await _crypto.sampleHash(songUrl);
        } catch {
          await errLog(req, `写入元数据到歌曲文件失败(${artist}-${title})`);
        }

        if (_path.basename(pic)[0] !== tName || (newHASH && newHASH !== hash)) {
          await db('songs')
            .where({ id })
            .update({
              pic: `${_path.extname(url)[0]}.${_path.extname(name)[2]}`,
              hash: newHASH || hash,
            });
        }

        syncUpdateData(req, 'music');

        _success(res, '上传封面成功')(req, `${id}-${artist}-${title}`, 1);
      } else if (type === 'mv') {
        if (!id) {
          paramErr(res, req, 'id 不能为空', 'query');
          return;
        }

        if (!req[kHello].isRoot) {
          _err(res, '无权上传MV')(req, id, 1);
          return;
        }

        if (!/\.(mp4)$/i.test(name)) {
          _err(res, 'MV格式错误')(req, name, 1);
          return;
        }

        const songInfo = await db('songs').select('url,mv,title,artist').where({ id }).findOne();

        if (!songInfo) {
          _err(res, '歌曲不存在')(req, id, 1);
          return;
        }

        const { url, mv, title, artist } = songInfo;

        const tDir = appConfig.musicDir(_path.dirname(url));
        const tName = `${_path.basename(url)[1]}.${_path.extname(name)[2]}`;

        await receiveFiles(req, tDir, tName, fieldLength.maxMvSize, HASH);

        if (_path.basename(mv)[0] != tName) {
          // 上传和现有文件名不同上传现有的
          if (mv) {
            await _delDir(_path.normalize(tDir, _path.basename(mv)[0]));
          }

          await db('songs')
            .where({ id })
            .update({
              mv: `${_path.extname(url)[0]}.${_path.extname(name)[2]}`,
            });
        }
        _success(res, '上传MV成功')(req, `${id}-${artist}-${title}`, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 歌曲重复
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { HASH } = req[kValidate];

      const songInfo = await db('songs').select('url,id').where({ hash: HASH }).findOne();

      if (songInfo) {
        const url = appConfig.musicDir(songInfo.url);

        if ((await _f.getType(url)) === 'file') {
          _success(res);
          return;
        }

        // 歌曲不存在删除数据和歌曲目录，重新上传
        await db('songs').where({ id: songInfo.id }).delete();

        await _delDir(_path.dirname(url));
      }

      _nothing(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 保存分享
route.post(
  '/save-share',
  validate(
    'body',
    V.object({
      name: V.string().trim().min(1).max(fieldLength.title),
      token: V.string().trim().min(1).max(fieldLength.url),
    }),
  ),
  async function (req, res) {
    try {
      const { name, token } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const share = await validShareState(token, 'music');

      if (share.state === 0) {
        _err(res, share.text)(req);
        return;
      }

      const data = share.data.data.map((item) => ({ id: item })).slice(0, maxSonglistCount);

      const songList = await getMusicList(account);
      const id = nanoid();

      songList.push({
        name,
        id,
        item: data,
        des: '',
      });
      await updateSongList(account, songList);

      syncUpdateData(req, 'music');

      _success(res, '保存歌单成功')(req, `${data.length}=>${name}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

export default route;
