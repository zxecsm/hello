const express = require('express'),
  route = express.Router();

const {
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
} = require('../../utils/sqlite');

const {
  deepClone,
  getSongInfo,
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  nanoid,
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
  isRoot,
  concurrencyTasks,
  getSplitWord,
  tplReplace,
} = require('../../utils/utils');

const { _d } = require('../../data/data');

const configObj = require('../../data/config');

const _f = require('../../utils/f');

const {
  _delDir,
  getPathFilename,
  getSuffix,
  getFileDir,
} = require('../file/file');

const {
  handleMusicList,
  parseLrc,
  batchGetMusics,
  getMusicList,
  updateSongList,
  songlistMoveLocation,
  songMoveLocation,
} = require('./player');

const { getFriendDes } = require('../chat/chat');

const {
  validShareState,
  validShareAddUserState,
  splitShareFlag,
} = require('../user/user');

const { fieldLenght } = require('../config');

const maxSonglistCount = 2000;

// 获取歌词
route.get('/lrc', async (req, res) => {
  const errData = [
    {
      t: 0,
      p: '未找到歌词',
      fy: '',
    },
  ];

  try {
    const { id, flag = '' } = req.query;

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!account) {
      if (!validaString(flag, 1, fieldLenght.shareFlag)) {
        paramErr(res, req);
        return;
      }

      const [sid, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['music'], sid, pass);

      if (share.state === 0) {
        errData[0].p = share.text;

        await errLog(req, `${share.text}-(${sid})`);

        _success(res, 'ok', errData);
        return;
      }

      const { data } = share.data;

      if (!data.some((item) => item === id)) {
        _success(res, 'ok', errData);
        return;
      }
    }

    const songInfo = (
      await queryData('songs', 'lrc,title,artist', `WHERE id = ?`, [id])
    )[0];

    if (!songInfo) {
      _success(res, 'ok', errData);
      return;
    }

    await uLog(req, `获取歌词(${songInfo.artist}-${songInfo.title})`);

    await incrementField('songs', { play_count: 1 }, `where id = ?`, [id]);

    const url = `${configObj.filepath}/music/${songInfo.lrc}`;

    if (_f.c.existsSync(url)) {
      const str = (await _f.p.readFile(url)).toString(),
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
route.get('/song-info', async (req, res) => {
  try {
    const { id, flag = '' } = req.query;

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!account) {
      if (!validaString(flag, 1, fieldLenght.shareFlag)) {
        paramErr(res, req);
        return;
      }

      const [sid, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['music'], sid, pass);

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
      const des = await getFriendDes(account, acc);

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
    })(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 拦截器
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
    const { word } = req.query;

    if (!validaString(word, 1, fieldLenght.searchWord)) {
      paramErr(res, req);
      return;
    }

    const splitWord = getSplitWord(word);

    const curSplit = splitWord.slice(0, 10);

    const searchSql = createSearchSql(curSplit, ['title', 'artist']);
    const scoreSql = createScoreSql(curSplit, ['title', 'artist']);

    let where = `WHERE (${searchSql.sql}) ${scoreSql.sql} LIMIT ?`;

    const valArr = [...searchSql.valArr, ...scoreSql.valArr, maxSonglistCount];

    const list = await queryData('songs', '*', where, valArr);

    _success(res, 'ok', {
      list,
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
    } = req.query;

    if (!validaString(id, 0, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    if (id === 'all') {
      pageNo = parseInt(pageNo);
      pageSize = parseInt(pageSize);
      if (
        !validationValue(sort, [
          'default',
          'artist',
          'title',
          'playCount',
          'collectCount',
        ]) ||
        !validaString(playId, 0, fieldLenght.id, 1) ||
        isNaN(pageNo) ||
        isNaN(pageSize) ||
        pageNo < 1 ||
        pageSize < 1 ||
        pageSize > fieldLenght.maxPagesize
      ) {
        paramErr(res, req);
        return;
      }
    }

    const { account } = req._hello.userinfo;

    let songList = await getMusicList(account);

    let ids = [];

    songList.forEach((list) => {
      const { item, id: listid } = list;

      if (item.length === 0) return;

      if (listid === id) {
        ids.push(...item.map((m) => m.id));
      } else {
        ids.push(item[0].id);
      }
    });

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

    if (hasChange) {
      const list = deepClone(songList);

      list.forEach((item) => {
        item.item = item.item.map((y) => ({ id: y.id }));
      });

      await updateSongList(account, list);
    }

    const newSong = await queryData(
      'songs',
      '*',
      `ORDER BY create_at DESC LIMIT ?`,
      [1]
    );

    songList.splice(2, 0, { id: 'all', item: newSong });

    for (let i = 0; i < 3; i++) {
      songList[i].name = _d.songList[i].name;
      songList[i].des = _d.songList[i].des;
    }

    songList = handleMusicList(songList);

    id ? null : (id = songList[1].id);

    for (let i = 0; i < songList.length; i++) {
      const item = songList[i];

      item.num = i;

      if (item.id !== id && i != 1) {
        delete item.item;
      } else {
        if (item.id === 'all') {
          const total = await getTableRowCount('songs');

          let list = [];

          if (total > 0) {
            let offset = (pageNo - 1) * pageSize;

            // 排序后获取offset
            const template = `WITH OrderedUsers AS (
                                SELECT id, {{field}}, ROW_NUMBER() OVER ({{order}}) AS row_num
                                FROM songs
                              )
                              SELECT row_num
                              FROM OrderedUsers
                              WHERE id = ?`;

            let where = ``;

            let offsetWhere = '';

            if (sort === 'artist') {
              const order = 'ORDER BY artist ASC';

              offsetWhere = tplReplace(template, { field: 'artist', order });

              where += order;
            } else if (sort === 'title') {
              const order = `ORDER BY title ASC`;

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
              const row = await allSqlite(offsetWhere, [playId]);
              if (row[0]) {
                pageNo = Math.ceil(row[0].row_num / pageSize);
                offset = (pageNo - 1) * pageSize;
              }
            }

            where += ` LIMIT ? OFFSET ?`;

            list = await queryData('songs', '*', where, [pageSize, offset]);
          }

          const obj = createPagingData([...Array(total)], pageSize, pageNo);

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

// 最后播放
route.post('/last-play', async (req, res) => {
  try {
    let { history, lastplay, currentTime, duration } = req.body;
    currentTime = +currentTime;
    duration = +duration;

    if (
      !validationValue(history, [1, 0]) ||
      !_type.isObject(lastplay) ||
      !validaString(lastplay.id, 1, fieldLenght.id, 1) ||
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
    const limit = 200;

    // 获取总行数
    let total = await getTableRowCount('songs');

    if (total === 0) {
      _err(res, '音乐库为空')(req);
      return;
    }

    let offset = 0;

    if (total > limit) {
      total -= limit;
      offset = Math.floor(Math.random() * total);
    }

    const list = await queryData('songs', '*', `LIMIT ? OFFSET ?`, [
      limit,
      offset,
    ]);

    _success(res, 'ok', list);
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
      !data.every((item) => validaString(item, 1, fieldLenght.id, 1))
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
      !validaString(fromId, 1, fieldLenght.id, 1) ||
      !validaString(toId, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await songlistMoveLocation(account, fromId, toId);

    syncUpdateData(req, 'music');

    _success(res, '歌单移动位置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除歌单
route.post('/delete-list', async (req, res) => {
  try {
    const { id } = req.body;

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    const idx = list.findIndex((item) => item.id === id);

    if (idx > 1) {
      const songListTitle = list.splice(idx, 1)[0].name;

      await updateSongList(account, list);

      syncUpdateData(req, 'music');

      _success(res, '删除歌单成功')(req, songListTitle, 1);
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
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(name, 1, fieldLenght.title) ||
      !validaString(des, 0, fieldLenght.des) ||
      !validaString(toId, 0, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    const idx = list.findIndex((item) => item.id === id);

    const log = `${name}${des ? `-${des}` : ''}`;

    if (id === 'all' && isRoot(req)) {
      _d.songList[2].name = name;
      _d.songList[2].des = des;
      _success(res, '更新歌单信息成功')(req, log, 1);
    } else if (idx < 2 && idx >= 0 && isRoot(req)) {
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
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(artist, 1, fieldLenght.title) ||
      !validaString(album, 1, fieldLenght.title) ||
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

    if (!isRoot(req)) {
      _err(res, '无权更新歌曲信息')(req, `${artist}-${title}`, 1);
      return;
    }

    await updateData(
      'songs',
      { title, artist, album, year, duration, play_count, collect_count },
      `WHERE id = ?`,
      [id]
    );

    syncUpdateData(req, 'music');

    _success(res, '更新歌曲信息成功')(req, `${artist}-${title}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加歌单
route.post('/add-list', async (req, res) => {
  try {
    const { name, des = '' } = req.body;

    if (
      !validaString(name, 1, fieldLenght.title) ||
      !validaString(des, 0, fieldLenght.des)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    if (list.length >= fieldLenght.songList + 2) {
      _err(res, `歌单限制${fieldLenght.songList}`)(req);
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

    _success(res, '添加歌单成功')(req, `${name}${des ? `-${des}` : ''}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 移动歌曲
route.post('/move-song', async (req, res) => {
  try {
    const { fromId, toId, listId } = req.body;

    if (
      !validaString(listId, 1, fieldLenght.id, 1) ||
      !validaString(fromId, 1, fieldLenght.id, 1) ||
      !validaString(toId, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await songMoveLocation(account, listId, fromId, toId);

    syncUpdateData(req, 'music');

    _success(res, '歌曲移动位置成功')(req);
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
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await getMusicList(account);

    const add = ids.map((item) => ({ id: item }));

    list[1].item = unique([...add, ...list[1].item], ['id']).slice(
      0,
      maxSonglistCount
    );

    await updateSongList(account, list);

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

    if (!validaString(id, 1, fieldLenght.id, 1)) {
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
      !validaString(listId, 1, fieldLenght.id, 1) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (listId === 'all') {
      if (!isRoot(req)) {
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

        await _delDir(`${configObj.filepath}/music/${getFileDir(url)}`);

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

// 音乐移动目录
route.post('/song-to-list', async (req, res) => {
  try {
    let { fromId, toId, ids } = req.body;

    if (
      !validaString(fromId, 1, fieldLenght.id, 1) ||
      !validaString(toId, 1, fieldLenght.id, 1) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
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
      list[tIdx].item = unique([...ids, ...list[tIdx].item], ['id']).slice(
        0,
        maxSonglistCount
      );

      await updateSongList(account, list);

      syncUpdateData(req, 'music');

      _success(res, '添加歌曲成功')(req, `${ids.length}=>${toId}`, 1);
      return;
    }
    if ((fIdx > 1 && tIdx > 1, fromId !== toId)) {
      list[fIdx].item = list[fIdx].item.filter(
        (item) => !ids.some((y) => y.id === item.id)
      );

      list[tIdx].item = unique([...ids, ...list[tIdx].item], ['id']).slice(
        0,
        maxSonglistCount
      );

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

    if (!isRoot(req)) {
      _err(res, '无权操作')(req, id, 1);
      return;
    }

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const dels = await queryData('songs', 'mv,title,artist', `WHERE id = ?`, [
      id,
    ]);

    for (let i = 0; i < dels.length; i++) {
      const { mv, artist, title } = dels[i];
      if (mv) {
        await _delDir(`${configObj.filepath}/music/${mv}`);
        await uLog(req, `删除MV(${artist}-${title})`);
      }
    }

    await updateData('songs', { mv: '' }, `WHERE id = ?`, [id]);

    syncUpdateData(req, 'music');

    _success(res, '删除MV成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取歌词
route.get('/read-lrc', async (req, res) => {
  try {
    const { id } = req.query;

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const musicinfo = (
      await queryData('songs', 'lrc', `WHERE id = ?`, [id])
    )[0];

    if (!musicinfo) {
      _err(res, '歌曲不存在')(req, id, 1);
    }

    const url = `${configObj.filepath}/music/${musicinfo.lrc}`;

    if (_f.c.existsSync(url)) {
      const str = (await _f.p.readFile(url)).toString();
      _success(res, 'ok', str);
    } else {
      await _f.mkdir(
        `${configObj.filepath}/music/${getFileDir(musicinfo.lrc)}`
      );
      await _f.p.writeFile(url, '');

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

    if (!isRoot(req)) {
      _err(res, '无权操作')(req, id, 1);
      return;
    }

    if (!validaString(id, 1, fieldLenght.id, 1) || !validaString(text)) {
      paramErr(res, req);
      return;
    }

    const musicinfo = (
      await queryData('songs', 'lrc,artist,title', `WHERE id = ?`, [id])
    )[0];

    if (!musicinfo) {
      _err(res, '歌曲不存在')(req, id, 1);
    }

    const url = `${configObj.filepath}/music/${musicinfo.lrc}`;

    await _f.mkdir(`${configObj.filepath}/music/${getFileDir(musicinfo.lrc)}`);

    await _f.p.writeFile(url, text);

    _success(res, '更新歌词成功')(
      req,
      `${musicinfo.artist}-${musicinfo.title}`,
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
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(pass, 0, fieldLenght.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLenght.expTime ||
      !_type.isArray(list) ||
      list.length === 0 ||
      list.length > maxSonglistCount ||
      !list.every((item) => validaString(item, 1, fieldLenght.id, 1))
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

    _success(res, '分享歌曲成功', { id })(req, `${title}-${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 歌曲上传
route.post('/up', async (req, res) => {
  try {
    const { HASH = '', name, type, id = '' } = req.query;

    if (
      !validaString(name, 1, fieldLenght.filename) ||
      !validaString(HASH, 0, fieldLenght.id, 1) ||
      !validationValue(type, ['song', 'cover', 'mv']) ||
      !validaString(id, 0, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    if (type === 'song') {
      if (!validaString(HASH, 1, fieldLenght.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!isMusicFile(name)) {
        _err(res, '歌曲格式错误')(req, name, 1);
        return;
      }

      const song = (
        await queryData('songs', 'id', `WHERE hash = ?`, [HASH])
      )[0];

      if (song) {
        _err(res, '歌曲已存在')(req, HASH, 1);
        return;
      }

      const timePath = getTimePath(Date.now());

      const suffix = getSuffix(name)[1];

      const tDir = `${configObj.filepath}/music/${timePath}/${HASH}`;
      const tName = `${HASH}.${suffix}`;

      await _f.mkdir(tDir);

      await receiveFiles(req, tDir, tName, 20);

      const songInfo = await getSongInfo(`${tDir}/${tName}`);

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
        await _f.p.writeFile(
          `${tDir}/${HASH}.${getPathFilename(picFormat)[0]}`,
          pic
        );
        pic = `${timePath}/${HASH}/${HASH}.${getPathFilename(picFormat)[0]}`;
      }

      await _f.p.writeFile(`${tDir}/${HASH}.lrc`, lrc);

      await insertData('songs', [
        {
          artist,
          title,
          duration,
          album,
          year,
          hash: HASH,
          pic,
          url: `${timePath}/${HASH}/${tName}`,
          lrc: `${timePath}/${HASH}/${HASH}.lrc`,
        },
      ]);

      _success(res, '上传歌曲成功')(req, `${artist}-${title}`, 1);
    } else if (type === 'cover') {
      if (!validaString(id, 1, fieldLenght.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!isRoot(req)) {
        _err(res, '无权上传封面')(req, id, 1);
        return;
      }

      if (!isImgFile(name)) {
        _err(res, '封面格式错误')(req, name, 1);
        return;
      }

      const songInfo = (
        await queryData('songs', 'url,pic,title,artist', `WHERE id = ?`, [id])
      )[0];

      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }

      const { url, pic, title, artist } = songInfo;

      const tDir = `${configObj.filepath}/music/${getFileDir(url)}`;
      const tName = `${getPathFilename(url)[1]}.${getSuffix(name)[1]}`;

      await _f.mkdir(tDir);

      await receiveFiles(req, tDir, tName, 5);

      if (getPathFilename(pic)[0] != tName) {
        if (pic) {
          await _delDir(`${tDir}/${getPathFilename(pic)[0]}`);
        }
        await updateData(
          'songs',
          { pic: `${getSuffix(url)[0]}.${getSuffix(name)[1]}` },
          `WHERE id = ?`,
          [id]
        );
      }

      syncUpdateData(req, 'music');

      _success(res, '上传封面成功')(req, `${artist}-${title}`, 1);
    } else if (type === 'mv') {
      if (!validaString(id, 1, fieldLenght.id, 1)) {
        paramErr(res, req);
        return;
      }

      if (!isRoot(req)) {
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

      const tDir = `${configObj.filepath}/music/${getFileDir(url)}`;
      const tName = `${getPathFilename(url)[1]}.${getSuffix(name)[1]}`;

      await _f.mkdir(tDir);
      await receiveFiles(req, tDir, tName, 200);

      if (getPathFilename(mv)[0] != tName) {
        if (mv) {
          await _delDir(`${tDir}/${getPathFilename(mv)[0]}`);
        }

        await updateData(
          'songs',
          { mv: `${getSuffix(url)[0]}.${getSuffix(name)[1]}` },
          `WHERE id = ?`,
          [id]
        );
      }
      _success(res, '上传MV成功')(req, `${artist}-${title}`, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 歌曲重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const songInfo = (
      await queryData('songs', 'url,id', `WHERE hash = ?`, [HASH])
    )[0];

    if (songInfo) {
      if (_f.c.existsSync(`${configObj.filepath}/music/${songInfo.url}`)) {
        _success(res);
        return;
      }
      await deleteData('songs', `WHERE id = ?`, [songInfo.id]);
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存分享
route.get('/save-share', async function (req, res) {
  try {
    const { id, name, pass = '' } = req.query;

    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(name, 1, fieldLenght.title) ||
      !validaString(pass, 0, fieldLenght.sharePass)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const share = await validShareState(req, ['music'], id, pass);

    if (share.state === 0) {
      _err(res, share.text)(req, id, 1);
      return;
    }

    const data = share.data.data
      .map((item) => ({ id: item }))
      .slice(0, maxSonglistCount);

    const songList = await getMusicList(account);

    songList.push({
      name,
      id: nanoid(),
      item: data,
      des: '',
    });
    await updateSongList(account, songList);

    syncUpdateData(req, 'music');

    _success(res, '保存歌单成功')(req, `${data.length}=>${name}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

module.exports = route;
