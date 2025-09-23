import express from 'express';

import {
  insertData,
  updateData,
  queryData,
  deleteData,
  fillString,
  incrementField,
  createSearchSql,
  createScoreSql,
  getTableRowCount,
  allSqlite,
} from '../../utils/sqlite.js';

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
  validaString,
  _type,
  validationValue,
  paramErr,
  unique,
  getTimePath,
  errLog,
  syncUpdateData,
  createPagingData,
  uLog,
  concurrencyTasks,
  getSplitWord,
  tplReplace,
  myShuffle,
  normalizePageNo,
  isFilename,
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
const maxSonglistCount = 2000;

const route = express.Router();

// 获取歌词
route.post('/lrc', async (req, res) => {
  const errData = [
    {
      t: 0,
      p: '未找到歌词',
      fy: '',
    },
  ];

  try {
    const { id, token = '' } = req.body;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!account) {
      if (!validaString(token, 1, fieldLength.url)) {
        paramErr(res, req);
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
      await incrementField('songs', { play_count: 1 }, `where id = ?`, [id]);
    }

    const songInfo = (await queryData('songs', 'lrc', `WHERE id = ?`, [id]))[0];

    if (!songInfo) {
      _success(res, 'ok', errData);
      return;
    }

    const url = _path.normalize(appConfig.appData, 'music', songInfo.lrc);

    if (await _f.exists(url)) {
      const str = (await _f.fsp.readFile(url)).toString(),
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
});

// 歌曲信息
route.post('/song-info', async (req, res) => {
  try {
    const { id, token = '' } = req.body;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!account) {
      if (!validaString(token, 1, fieldLength.url)) {
        paramErr(res, req);
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

    const info = (
      await queryData(
        'songs',
        'title,artist,duration,album,year,collect_count,play_count,create_at',
        `WHERE id = ?`,
        [id]
      )
    )[0];

    if (!info) {
      _err(res, '歌曲不存在')(req, id, 1);
      return;
    }

    _success(res, 'ok', info);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分享
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

    const share = await validShareAddUserState(req, ['music'], id, pass);

    if (share.state === 0) {
      _err(res, share.text)(req, id, 1);
      return;
    }

    if (share.state === 3) {
      _nothing(res, share.text);
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

    const { account } = req._hello.userinfo;

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
      token: jwt.set(
        { type: 'share', data: { id, types: ['music'] } },
        fieldLength.shareTokenExp
      ),
    })(req, id, 1);
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

// 搜索
route.get('/search', async (req, res) => {
  try {
    let { word, pageNo = 1 } = req.query;
    pageNo = parseInt(pageNo);

    if (
      !validaString(word, 1, fieldLength.searchWord) ||
      isNaN(pageNo) ||
      pageNo < 1
    ) {
      paramErr(res, req);
      return;
    }

    const pageSize = 100;

    const splitWord = getSplitWord(word);

    const curSplit = splitWord.slice(0, 10);

    const searchSql = createSearchSql(curSplit, ['title', 'artist']);
    const scoreSql = createScoreSql(curSplit, ['title', 'artist']);

    let where = `WHERE (${searchSql.sql}) ${scoreSql.sql}`;

    const valArr = [...searchSql.valArr, ...scoreSql.valArr];

    const total = await getTableRowCount('songs', where, valArr);

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];

    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      where += ` LIMIT ? OFFSET ?`;

      valArr.push(pageSize, offset);

      list = await queryData('songs', '*', where, valArr);
    }

    _success(res, 'ok', {
      ...result,
      data: list,
      splitWord,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取列表
route.get('/list', async (req, res) => {
  try {
    let {
      id = '',
      pageNo = 1,
      pageSize = 50,
      sort = 'default',
      playId = '',
      onlyMv = 0,
    } = req.query;

    if (!validaString(id, 0, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    if (id === 'all') {
      if (playId) {
        onlyMv = 0;
      }

      pageNo = parseInt(pageNo);
      pageSize = parseInt(pageSize);
      onlyMv = parseInt(onlyMv);
      if (
        !validationValue(sort, [
          'default',
          'artist',
          'title',
          'playCount',
          'collectCount',
        ]) ||
        !validationValue(onlyMv, [0, 1]) ||
        !validaString(playId, 0, fieldLength.id, 1) ||
        isNaN(pageNo) ||
        isNaN(pageSize) ||
        pageNo < 1 ||
        pageSize < 1 ||
        pageSize > fieldLength.maxPagesize
      ) {
        paramErr(res, req);
        return;
      }
    }

    const { account } = req._hello.userinfo;

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
    const newSong = await queryData(
      'songs',
      '*',
      `ORDER BY create_at DESC LIMIT ?`,
      [1]
    );

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
          let where = ``;

          let offsetWhere = '';

          if (onlyMv === 1) {
            where = `WHERE mv != '' `;
            offsetWhere = `WHERE mv != '' `;
          }
          // 如果是所有歌曲歌单，则在服务端分页处理
          const total = await getTableRowCount('songs', where);

          pageNo = normalizePageNo(total, pageSize, pageNo);

          let list = [];

          if (total > 0) {
            let offset = (pageNo - 1) * pageSize;

            // 排序后获取当前播放歌曲位置offset
            const template = `WITH OrderedSongs AS (
                                SELECT id, {{field}}, ROW_NUMBER() OVER ({{order}}) AS row_num
                                FROM songs
                              )
                              SELECT row_num
                              FROM OrderedSongs
                              WHERE id = ?`;

            // 排序
            if (sort === 'artist') {
              const order = 'ORDER BY artist_pinyin ASC';

              offsetWhere = tplReplace(template, { field: 'artist', order });

              where += order;
            } else if (sort === 'title') {
              const order = `ORDER BY title_pinyin ASC`;

              offsetWhere = tplReplace(template, { field: 'title', order });

              where += order;
            } else if (sort === 'playCount') {
              const order = `ORDER BY play_count DESC`;

              offsetWhere = tplReplace(template, {
                field: 'play_count',
                order,
              });

              where += order;
            } else if (sort === 'collectCount') {
              const order = `ORDER BY collect_count DESC`;

              offsetWhere = tplReplace(template, {
                field: 'collect_count',
                order,
              });

              where += order;
            } else {
              const order = `ORDER BY create_at DESC`;

              offsetWhere = tplReplace(template, {
                field: 'title',
                order,
              });

              where += order;
            }

            if (playId) {
              // 定位到正则播放歌曲所在页
              const row = await allSqlite(offsetWhere, [playId]);
              if (row[0]) {
                pageNo = Math.ceil(row[0].row_num / pageSize);
                offset = (pageNo - 1) * pageSize;
              }
            }

            where += ` LIMIT ? OFFSET ?`;

            list = await queryData('songs', '*', where, [pageSize, offset]);
          }

          const obj = createPagingData(Array(total), pageSize, pageNo);

          item.item = list;
          item.totalPage = obj.totalPage;
          item.pageNo = obj.pageNo;
          item.total = obj.total;
          item.len = total;
        }

        item.item = item.item.map((m, idx) => ({ ...m, num: idx }));
      }
    }

    _success(res, 'ok', songList);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 导出歌单
route.get('/export', async (req, res) => {
  try {
    const { id } = req.query;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const songListObj = (await getMusicList(account)).find(
      (item) => item.id === id
    );

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
});

// 导入歌单
route.post('/import', async (req, res) => {
  try {
    const { list, id } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !_type.isArray(list) ||
      list.length > maxSonglistCount ||
      !list.every((song) => validaString(song.id, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const songLists = await getMusicList(account);

    const idx = songLists.findIndex((item) => item.id === id);

    if (idx < 0) {
      _err(res, '歌单不存在')(req, id, 1);
      return;
    }

    const newSongList = unique(
      [...list.map((item) => ({ id: item.id })), ...songLists[idx].item],
      ['id']
    );

    if (newSongList.length > maxSonglistCount) {
      _err(res, `歌单限制${maxSonglistCount}首`)(req);
      return;
    }

    songLists[idx].item = newSongList;

    await updateSongList(account, songLists);

    syncUpdateData(req, 'music');

    _success(res, '导入歌曲成功')(
      req,
      `${songLists[idx].name}-${id}-${list.length}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 最后播放
route.post('/last-play', async (req, res) => {
  try {
    let { history, lastplay, currentTime, duration } = req.body;
    currentTime = +currentTime;
    duration = +duration;

    if (
      !validationValue(history, [1, 0]) ||
      !_type.isObject(lastplay) ||
      !validaString(lastplay.id, 1, fieldLength.id, 1) ||
      isNaN(duration) ||
      isNaN(currentTime) ||
      duration < 0 ||
      currentTime < 0
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const change = await updateData(
      'last_play',
      {
        song_id: lastplay.id,
        play_current_time: currentTime,
        duration,
      },
      `WHERE account = ?`,
      [account]
    );

    if (change.changes === 0) {
      await insertData(
        'last_play',
        [
          {
            account,
            song_id: lastplay.id,
            play_current_time: currentTime,
            duration,
          },
        ],
        'account'
      );
    }

    // 增加播放历史记录
    if (history === 1) {
      // 自增播放次数
      await incrementField('songs', { play_count: 1 }, `where id = ?`, [
        lastplay.id,
      ]);

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
});

// 最后播放记录
route.get('/last-play', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const lastm = (
      await queryData(
        'last_play',
        'song_id,play_current_time,duration',
        `WHERE account = ?`,
        [account]
      )
    )[0];

    const obj = {
      currentTime: 0,
      duration: 0,
      lastplay: {},
    };

    if (lastm) {
      const { song_id, play_current_time, duration } = lastm;

      obj.currentTime = play_current_time;
      obj.duration = duration;

      const lastplay = (
        await queryData('songs', '*', `WHERE id = ?`, [song_id])
      )[0];

      if (lastplay) {
        obj.lastplay = lastplay;
      }
    }

    _success(res, 'ok', obj);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 随机播放200
route.get('/random-list', async (req, res) => {
  try {
    // 获取总行数
    let total = await getTableRowCount('songs');

    if (total === 0) {
      _err(res, '音乐库为空')(req);
      return;
    }

    let offset = 0;

    // 计算随机偏移
    if (total > maxSonglistCount) {
      total -= maxSonglistCount;
      offset = Math.floor(Math.random() * total);
    }

    const list = await queryData('songs', '*', `LIMIT ? OFFSET ?`, [
      maxSonglistCount,
      offset,
    ]);

    _success(res, 'ok', myShuffle(list));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 播放列表
route.post('/playlist', async (req, res) => {
  try {
    const { data } = req.body;
    if (
      !_type.isArray(data) ||
      data.length > maxSonglistCount ||
      !data.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const change = await updateData(
      'playing_list',
      {
        data: JSON.stringify(data),
      },
      `WHERE account=?`,
      [account]
    );

    if (change.changes === 0) {
      await insertData(
        'playing_list',
        [
          {
            account,
            data: JSON.stringify(data),
          },
        ],
        'account'
      );
    }

    syncUpdateData(req, 'playinglist');
    _success(res, '更新播放列表成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 播放列表
route.get('/playlist', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const playing = (
      await queryData('playing_list', 'data', `WHERE account = ?`, [account])
    )[0];

    let list = [];

    if (playing) {
      list = JSON.parse(playing.data);

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
route.post('/move-list', async (req, res) => {
  try {
    const { fromId, toId } = req.body;

    if (
      !validaString(fromId, 1, fieldLength.id, 1) ||
      !validaString(toId, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await songlistMoveLocation(account, fromId, toId);

    syncUpdateData(req, 'music');

    _success(res, '歌单移动位置成功')(req, `${fromId}-${toId}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除歌单
route.post('/delete-list', async (req, res) => {
  try {
    const { id } = req.body;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

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
});

// 歌单编辑
route.post('/edit-list', async (req, res) => {
  try {
    const { id, name, des = '', toId = '' } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(name, 1, fieldLength.title) ||
      !validaString(des, 0, fieldLength.des) ||
      !validaString(toId, 0, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    const idx = list.findIndex((item) => item.id === id);

    const log = `${id}-${name}${des ? `-${des}` : ''}`;

    if (id === 'all' && req._hello.isRoot) {
      _d.songList[2].name = name;
      _d.songList[2].des = des;
      _success(res, '更新歌单信息成功')(req, log, 1);
    } else if (idx < 2 && idx >= 0 && req._hello.isRoot) {
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
});

// 编辑歌曲
route.post('/edit-song', async (req, res) => {
  try {
    let {
      id,
      title,
      artist,
      album,
      year,
      duration,
      collect_count,
      play_count,
    } = req.body;
    duration = parseFloat(duration);
    collect_count = parseInt(collect_count);
    play_count = parseInt(play_count);

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !validaString(artist, 1, fieldLength.title) ||
      !validaString(album, 1, fieldLength.title) ||
      !validaString(year, 0, 10) ||
      isNaN(duration) ||
      duration < 0 ||
      isNaN(collect_count) ||
      collect_count < 0 ||
      isNaN(play_count) ||
      play_count < 0
    ) {
      paramErr(res, req);
      return;
    }

    if (!req._hello.isRoot) {
      _err(res, '无权更新歌曲信息')(req, `${id}-${artist}-${title}`, 1);
      return;
    }

    const songInfo = (
      await queryData('songs', 'url,hash,artist,title', `WHERE id = ?`, [id])
    )[0];

    if (!songInfo) {
      _err(res, '歌曲不存在')(req, id, 1);
      return;
    }

    let newHASH = '';

    try {
      const songUrl = _path.normalize(appConfig.appData, 'music', songInfo.url);

      // 写入歌曲文件
      await nodeID3.update(
        {
          title,
          artist,
          album,
          year,
        },
        songUrl
      );

      // 重新计算歌曲HASH
      newHASH = await _crypto.getFileMD5Hash(songUrl);
    } catch {
      await errLog(
        req,
        `写入元数据到歌曲文件失败(${songInfo.artist}-${songInfo.title})`
      );
    }

    await updateData(
      'songs',
      {
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
      },
      `WHERE id = ?`,
      [id]
    );

    syncUpdateData(req, 'music');

    _success(res, '更新歌曲信息成功')(req, `${id}-${artist}-${title}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加歌单
route.post('/add-list', async (req, res) => {
  try {
    const { name, des = '' } = req.body;

    if (
      !validaString(name, 1, fieldLength.title) ||
      !validaString(des, 0, fieldLength.des)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

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

    _success(res, '添加歌单成功')(
      req,
      `${id}-${name}${des ? `-${des}` : ''}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 移动歌曲
route.post('/move-song', async (req, res) => {
  try {
    const { fromId, toId, listId } = req.body;

    if (
      !validaString(listId, 1, fieldLength.id, 1) ||
      !validaString(fromId, 1, fieldLength.id, 1) ||
      !validaString(toId, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await songMoveLocation(account, listId, fromId, toId);

    syncUpdateData(req, 'music');

    _success(res, '歌曲移动位置成功')(req, `${listId}: ${fromId}=>${toId}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 收藏歌曲
route.post('/collect-song', async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

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
    await incrementField(
      'songs',
      { collect_count: 1 },
      `WHERE id IN (${fillString(ids.length)})`,
      [...ids]
    );

    syncUpdateData(req, 'music');

    _success(res, '收藏歌曲成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 移除收藏
route.post('/close-collect-song', async (req, res) => {
  try {
    const { id } = req.body;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    list[1].item = list[1].item.filter((v) => v.id !== id);

    await updateSongList(account, list);

    syncUpdateData(req, 'music');

    _success(res, '移除收藏歌曲成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除
route.post('/delete-song', async (req, res) => {
  try {
    const { listId, ids } = req.body;

    if (
      !validaString(listId, 1, fieldLength.id, 1) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > maxSonglistCount ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (listId === 'all') {
      // 限制删除数量
      if (ids.length > fieldLength.maxPagesize) {
        paramErr(res, req);
        return;
      }

      if (!req._hello.isRoot) {
        _err(res, '无权删除歌曲')(req, `${listId}-${ids.length}`, 1);
        return;
      }

      const dels = await queryData(
        'songs',
        'url,artist,title',
        `WHERE id IN (${fillString(ids.length)})`,
        [...ids]
      );

      await concurrencyTasks(dels, 5, async (del) => {
        const { url, artist, title } = del;

        await _delDir(
          _path.normalize(appConfig.appData, 'music', _path.dirname(url))
        );

        await uLog(req, `删除歌曲(${artist}-${title})`);
      });

      await deleteData('songs', `WHERE id IN (${fillString(ids.length)})`, [
        ...ids,
      ]);
    } else {
      const list = await getMusicList(account);

      const idx = list.findIndex((item) => item.id === listId);

      if (idx >= 0) {
        list[idx].item = list[idx].item.filter(
          (item) => !ids.some((y) => y === item.id)
        );

        await updateSongList(account, list);
      }
    }

    syncUpdateData(req, 'music');

    _success(res, `${listId === 'all' ? '删除' : '移除'}歌曲成功`)(
      req,
      `${listId}-${ids.length}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
    return;
  }
});

// 音乐移动到歌单
route.post('/song-to-list', async (req, res) => {
  try {
    let { fromId, toId, ids } = req.body;

    if (
      !validaString(fromId, 1, fieldLength.id, 1) ||
      !validaString(toId, 1, fieldLength.id, 1) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

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
      list[fIdx].item = list[fIdx].item.filter(
        (item) => !ids.some((y) => y.id === item.id)
      );

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
});

// 删除mv
route.post('/delete-mv', async (req, res) => {
  try {
    const { id } = req.body;

    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req, id, 1);
      return;
    }

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const dels = await queryData('songs', 'mv,title,artist', `WHERE id = ?`, [
      id,
    ]);

    for (let i = 0; i < dels.length; i++) {
      const { mv, artist, title } = dels[i];
      if (mv) {
        await _delDir(_path.normalize(appConfig.appData, 'music', mv));
        await uLog(req, `删除MV(${artist}-${title})`);
      }
    }

    await updateData('songs', { mv: '' }, `WHERE id = ?`, [id]);

    syncUpdateData(req, 'music');

    _success(res, '删除MV成功');
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取歌词
route.get('/read-lrc', async (req, res) => {
  try {
    const { id } = req.query;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const musicinfo = (
      await queryData('songs', 'lrc', `WHERE id = ?`, [id])
    )[0];

    if (!musicinfo) {
      _err(res, '歌曲不存在')(req, id, 1);
    }

    const url = _path.normalize(appConfig.appData, 'music', musicinfo.lrc);

    if (await _f.exists(url)) {
      const str = (await _f.fsp.readFile(url)).toString();
      _success(res, 'ok', str);
    } else {
      await _f.mkdir(_path.dirname(url));
      await _f.fsp.writeFile(url, '');

      _success(res, 'ok', '');
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑歌词
route.post('/edit-lrc', async (req, res) => {
  try {
    const { id, text = '' } = req.body;

    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req, id, 1);
      return;
    }

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(text, 0, 0, 0, 1) ||
      _f.getTextSize(text) > fieldLength.lrcSize
    ) {
      paramErr(res, req);
      return;
    }

    const musicinfo = (
      await queryData('songs', 'url,lrc,artist,title,hash', `WHERE id = ?`, [
        id,
      ])
    )[0];

    if (!musicinfo) {
      _err(res, '歌曲不存在')(req, id, 1);
    }

    const url = _path.normalize(appConfig.appData, 'music', musicinfo.lrc);

    await _f.mkdir(_path.dirname(url));

    await _f.fsp.writeFile(url, text);

    try {
      const songUrl = _path.normalize(
        appConfig.appData,
        'music',
        musicinfo.url
      );

      // 写入歌曲文件
      await nodeID3.update(
        {
          unsynchronisedLyrics: {
            language: 'eng',
            text,
          },
        },
        songUrl
      );

      const newHASH = await _crypto.getFileMD5Hash(songUrl);

      if (newHASH && newHASH !== musicinfo.hash) {
        await updateData(
          'songs',
          {
            hash: newHASH,
          },
          `WHERE id = ?`,
          [id]
        );
      }
    } catch {
      await errLog(
        req,
        `写入元数据到歌曲文件失败(${musicinfo.artist}-${musicinfo.title}`
      );
    }

    _success(res, '更新歌词成功')(
      req,
      `${id}-${musicinfo.artist}-${musicinfo.title}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分享
route.post('/share', async (req, res) => {
  try {
    let { list, title, expireTime, pass = '' } = req.body;
    expireTime = parseInt(expireTime);

    if (
      !validaString(title, 1, fieldLength.title) ||
      !validaString(pass, 0, fieldLength.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLength.expTime ||
      !_type.isArray(list) ||
      list.length === 0 ||
      list.length > maxSonglistCount ||
      !list.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const id = nanoid();
    const obj = {
      id,
      exp_time:
        expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(list),
      account,
      type: 'music',
    };

    await insertData('share', [obj]);

    syncUpdateData(req, 'sharelist');

    _success(res, '分享歌曲成功', { id })(
      req,
      `${title}-${id}-${list.length}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 歌曲上传
route.post('/up', async (req, res) => {
  try {
    const { HASH = '', name, type, id = '' } = req.query;

    if (
      !validaString(name, 1, fieldLength.filename) ||
      !isFilename(name) ||
      !validaString(HASH, 0, fieldLength.id, 1) ||
      !validationValue(type, ['song', 'cover', 'mv']) ||
      !validaString(id, 0, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    if (type === 'song') {
      if (!validaString(HASH, 1, fieldLength.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!isMusicFile(name)) {
        _err(res, '歌曲格式错误')(req, name, 1);
        return;
      }

      const song = (
        await queryData('songs', 'id,artist,title', `WHERE hash = ?`, [HASH])
      )[0];

      if (song) {
        _err(res, '歌曲已存在')(req, `${song.artist}-${song.title}`, 1);
        return;
      }

      const songId = nanoid();

      const timePath = getTimePath(Date.now());

      const suffix = _path.extname(name)[2];

      const tDir = _path.normalize(
        appConfig.appData,
        'music',
        timePath,
        songId
      );
      const tName = `${songId}.${suffix}`;

      await _f.mkdir(tDir);

      await receiveFiles(req, tDir, tName, 50);

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

      if (pic) {
        // 提取封面
        await _f.fsp.writeFile(
          _path.normalize(tDir, `${songId}.${_path.basename(picFormat)[0]}`),
          pic
        );
        pic = _path.normalize(
          timePath,
          songId,
          `${songId}.${_path.basename(picFormat)[0]}`
        );
      }

      await _f.fsp.writeFile(_path.normalize(tDir, `${songId}.lrc`), lrc);

      await insertData('songs', [
        {
          id: songId,
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
        },
      ]);

      _success(res, '上传歌曲成功')(req, `${songId}-${artist}-${title}`, 1);
    } else if (type === 'cover') {
      if (!validaString(id, 1, fieldLength.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!req._hello.isRoot) {
        _err(res, '无权上传封面')(req, id, 1);
        return;
      }

      if (!isImgFile(name)) {
        _err(res, '封面格式错误')(req, name, 1);
        return;
      }

      const songInfo = (
        await queryData('songs', 'url,pic,hash,title,artist', `WHERE id = ?`, [
          id,
        ])
      )[0];

      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      const { url, pic, title, artist, hash } = songInfo;

      const tDir = _path.normalize(
        appConfig.appData,
        'music',
        _path.dirname(url)
      );
      const tName = `${_path.basename(url)[1]}.${_path.extname(name)[2]}`;

      await _f.mkdir(tDir);

      await receiveFiles(req, tDir, tName, 5);

      // 如果上传封面文件和现有的封面文件名不同，删除现有的
      if (_path.basename(pic)[0] !== tName) {
        if (pic) {
          await _delDir(_path.normalize(tDir, _path.basename(pic)[0]));
        }
      }

      let newHASH = '';

      try {
        const songUrl = _path.normalize(appConfig.appData, 'music', url);

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
          songUrl
        );

        newHASH = await _crypto.getFileMD5Hash(songUrl);
      } catch {
        await errLog(req, `写入元数据到歌曲文件失败(${artist}-${title})`);
      }

      if (_path.basename(pic)[0] !== tName || (newHASH && newHASH !== hash)) {
        await updateData(
          'songs',
          {
            pic: `${_path.extname(url)[0]}.${_path.extname(name)[2]}`,
            hash: newHASH || hash,
          },
          `WHERE id = ?`,
          [id]
        );
      }

      syncUpdateData(req, 'music');

      _success(res, '上传封面成功')(req, `${id}-${artist}-${title}`, 1);
    } else if (type === 'mv') {
      if (!validaString(id, 1, fieldLength.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!req._hello.isRoot) {
        _err(res, '无权上传MV')(req, id, 1);
        return;
      }

      if (!/\.(mp4)$/i.test(name)) {
        _err(res, 'MV格式错误')(req, name, 1);
        return;
      }

      const songInfo = (
        await queryData('songs', 'url,mv,title,artist', `WHERE id = ?`, [id])
      )[0];

      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      const { url, mv, title, artist } = songInfo;

      const tDir = _path.normalize(
        appConfig.appData,
        'music',
        _path.dirname(url)
      );
      const tName = `${_path.basename(url)[1]}.${_path.extname(name)[2]}`;

      await _f.mkdir(tDir);
      await receiveFiles(req, tDir, tName, 200);

      if (_path.basename(mv)[0] != tName) {
        // 上传和现有文件名不同上传现有的
        if (mv) {
          await _delDir(_path.normalize(tDir, _path.basename(mv)[0]));
        }

        await updateData(
          'songs',
          { mv: `${_path.extname(url)[0]}.${_path.extname(name)[2]}` },
          `WHERE id = ?`,
          [id]
        );
      }
      _success(res, '上传MV成功')(req, `${id}-${artist}-${title}`, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 歌曲重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const songInfo = (
      await queryData('songs', 'url,id', `WHERE hash = ?`, [HASH])
    )[0];

    if (songInfo) {
      const url = _path.normalize(appConfig.appData, 'music', songInfo.url);

      if (await _f.exists(url)) {
        _success(res);
        return;
      }

      // 歌曲不存在删除数据和歌曲目录，重新上传
      await deleteData('songs', `WHERE id = ?`, [songInfo.id]);

      await _delDir(_path.dirname(url));
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存分享
route.post('/save-share', async function (req, res) {
  try {
    const { name, token = '' } = req.body;

    if (
      !validaString(name, 1, fieldLength.title) ||
      !validaString(token, 0, fieldLength.url)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const share = await validShareState(token, 'music');

    if (share.state === 0) {
      _err(res, share.text)(req);
      return;
    }

    const data = share.data.data
      .map((item) => ({ id: item }))
      .slice(0, maxSonglistCount);

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
});

export default route;
