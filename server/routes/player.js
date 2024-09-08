const express = require('express'),
  route = express.Router();
const {
  insertData,
  updateData,
  queryData,
  deleteData,
  runSqlite,
} = require('../utils/sqlite');
const {
  handleMusicList,
  getSuffix,
  deepClone,
  getSongInfo,
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  nanoid,
  isImgFile,
  getMusicObj,
  isMusicFile,
  validaString,
  _type,
  validationValue,
  paramErr,
  _delDir,
  parseLrc,
  getWordCount,
  unique,
  splitWord,
  createFillString,
  getTimePath,
  getFileDir,
  getPathFilename,
  isValid,
  errLog,
  syncUpdateData,
  createPagingData,
  arrSortMinToMax,
  uLog,
  isRoot,
  myShuffle,
  concurrencyTasks,
} = require('../utils/utils');
const { _d } = require('../data/data');
const configObj = require('../data/config');
const _f = require('../utils/f');
const shareVerify = require('../utils/shareVerify');
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
    const { account } = req._hello.userinfo;
    const { id, flag = '' } = req.query;
    if (!validaString(id, 1, 50, 1) || !validaString(flag, 0, 70)) {
      paramErr(res, req);
      return;
    }
    if (!account) {
      const [sid, pass] = flag.split('/');
      const share = (
        await queryData('share', '*', `WHERE id=? AND type=? AND pass=?`, [
          sid,
          'music',
          pass,
        ])
      )[0];
      if (!share || isValid(share.valid)) {
        _success(res, 'ok', errData);
        return;
      } else {
        const arr = JSON.parse(share.data);
        if (!arr.some((item) => item == id)) {
          _success(res, 'ok', errData);
          return;
        }
      }
    }
    const songInfo = (
      await queryData('musics', 'lrc,title,artist', `WHERE id=?`, [id])
    )[0];
    if (!songInfo) {
      _success(res, 'ok', errData);
      return;
    }
    await uLog(req, `获取歌词(${songInfo.artist}-${songInfo.title})`);
    await runSqlite(`update musics set play_count=play_count+1 where id=?`, [
      id,
    ]);
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
    const { id } = req.query;
    const info = (await queryData('musics', '*', `WHERE id=?`, [id]))[0];
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
    if (!validaString(id, 1, 50, 1) || !validaString(pass, 0, 20)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const ip = req._hello.ip;
    if (shareVerify.verify(ip, id)) {
      const share = (
        await queryData('getshare', '*', `WHERE id=? AND type=?`, [id, 'music'])
      )[0];
      if (!share) {
        _err(res, '分享已被取消')(req, id, 1);
        return;
      }
      if (isValid(share.valid)) {
        _err(res, '分享已过期')(req, id, 1);
        return;
      }
      if (share.pass && pass !== share.pass) {
        if (pass) {
          shareVerify.add(ip, id);
        }
        await uLog(req, `提取码错误(${id})`);
        _nothing(res, '提取码错误');
        return;
      }
      const data = JSON.parse(share.data);
      const mObj = getMusicObj(await queryData('musics', '*'));
      for (let i = 0; i < data.length; i++) {
        if (mObj.hasOwnProperty(data[i])) {
          data[i] = mObj[data[i]];
        } else {
          data.splice(i, 1);
          i--;
        }
      }
      if (data.length == 0) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }
      if (account && account != share.account) {
        const fArr = await queryData('friends', '*', `WHERE account=?`, [
          account,
        ]);
        const f = fArr.find((item) => item.friend == share.account);
        if (f) {
          share.username = f.des || share.username;
        }
      }
      _success(res, '读取歌曲分享成功', {
        ...share,
        data,
      })(req, id, 1);
    } else {
      _err(res, '提取码多次错误，请10分钟后再试')(req, id, 1);
    }
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
    let { word } = req.query;
    if (!validaString(word, 1, 100)) {
      paramErr(res, req);
      return;
    }
    word = splitWord(word);
    let list = await queryData('musics', '*');
    list.reverse();
    const sArr = [];
    list.forEach((item) => {
      const { title, artist } = item;
      const str = `${title}${artist}`;
      const sNum = getWordCount(word, str);
      if (sNum > 0) {
        sArr.push({
          ...item,
          sNum,
        });
      }
    });
    sArr.sort((a, b) => {
      return b.sNum - a.sNum;
    });
    _success(res, 'ok', {
      list: sArr.slice(0, maxSonglistCount),
      splitWord: word,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
async function getMusicList(account) {
  let arr = await queryData('musicinfo', 'data', `WHERE account=?`, [account]);
  if (arr.length == 0) {
    arr = [
      { name: '播放历史', pic: 'img/history.jpg', item: [], id: 'history' },
      { name: '收藏', pic: 'img/music.jpg', item: [], id: 'favorites' },
    ];
    await insertData('musicinfo', [
      {
        account,
        data: JSON.stringify(arr),
      },
    ]);
    return arr;
  }
  return JSON.parse(arr[0].data);
}
// 获取列表
route.get('/list', async (req, res) => {
  try {
    let { account } = req._hello.userinfo,
      {
        id = '',
        pageNo = 1,
        pageSize = 50,
        sort = 'default',
        playId = '',
      } = req.query;
    if (!validaString(id, 0, 50, 1)) {
      paramErr(res, req);
      return;
    }
    let musics = await queryData('musics', '*'),
      mObj = getMusicObj(musics),
      uArr = await getMusicList(account);
    let flag = false;
    uArr.forEach((item) => {
      for (let i = 0; i < item.item.length; i++) {
        let y = item.item[i];
        if (mObj.hasOwnProperty(y.id)) {
          item.item[i] = mObj[y.id];
        } else {
          flag = true;
          item.item.splice(i, 1);
          i--;
        }
      }
    });
    if (flag) {
      const sList = deepClone(uArr);
      sList.forEach((item) => {
        item.item = item.item.map((y) => ({ id: y.id }));
      });
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(sList),
        },
        `WHERE account=?`,
        [account]
      );
    }
    uArr.splice(2, 0, { id: 'all', item: musics.reverse() });
    for (let i = 0; i < 3; i++) {
      uArr[i].name = _d.songList[i].name;
      uArr[i].des = _d.songList[i].des;
    }
    uArr = handleMusicList(uArr); //处理封面
    id ? null : (id = uArr[1].id);
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
        !validaString(playId, 0, 50, 1) ||
        isNaN(pageNo) ||
        isNaN(pageSize) ||
        pageNo < 1 ||
        pageSize < 1 ||
        pageSize > 200
      ) {
        paramErr(res, req);
        return;
      }
    }
    uArr = uArr.map((item, i) => {
      item.num = i;
      if (item.id !== id && i != 1) {
        delete item.item;
      } else {
        if (id === 'all') {
          if (sort === 'artist') {
            item.item = arrSortMinToMax(item.item, 'artist');
          } else if (sort === 'title') {
            item.item = arrSortMinToMax(item.item, 'title');
          } else if (sort === 'playCount') {
            item.item.sort((a, b) => {
              return b.play_count - a.play_count;
            });
          } else if (sort === 'collectCount') {
            item.item.sort((a, b) => {
              return b.collect_count - a.collect_count;
            });
          }
          if (playId) {
            const idx = item.item.findIndex((item) => item.id === playId);
            if (idx >= 0) {
              pageNo = Math.ceil((idx + 1) / pageSize);
            }
          }
          const obj = createPagingData(item.item, pageSize, pageNo);
          item.item = obj.data;
          item.totalPage = obj.totalPage;
          item.pageNo = obj.pageNo;
          item.total = obj.total;
        }
        item.item = item.item.map((o, idx) => ({ ...o, num: idx }));
      }
      return item;
    });
    _success(res, 'ok', uArr);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 最后播放
route.post('/last-play', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { history, lastplay, currentTime, duration } = req.body;
    currentTime = +currentTime;
    duration = +duration;
    if (
      !validationValue(history, ['y', 'n']) ||
      !_type.isObject(lastplay) ||
      !validaString(lastplay.id, 1, 50, 1) ||
      isNaN(duration) ||
      isNaN(currentTime) ||
      duration < 0 ||
      currentTime < 0
    ) {
      paramErr(res, req);
      return;
    }
    const change = await updateData(
      'last_play',
      {
        song_id: lastplay.id,
        c_time: currentTime,
        duration,
      },
      `WHERE account=?`,
      [account]
    );
    if (change.changes == 0) {
      await insertData('last_play', [
        {
          account,
          song_id: lastplay.id,
          c_time: currentTime,
          duration,
        },
      ]);
    }
    // 增加播放历史记录
    if (history === 'y') {
      const arr = await getMusicList(account);
      arr[0].item.unshift({ id: lastplay.id });
      arr[0].item = unique(arr[0].item, ['id']).slice(0, maxSonglistCount);
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(arr),
        },
        `WHERE account=?`,
        [account]
      );
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
      await queryData('last_play', '*', `WHERE account=?`, [account])
    )[0];
    const obj = {
      currentTime: 0,
      duration: 0,
      lastplay: {},
    };
    if (lastm) {
      const { song_id, c_time, duration } = lastm;
      obj.currentTime = c_time;
      obj.duration = duration;
      const lastplay = (
        await queryData('musics', '*', `WHERE id=?`, [song_id])
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
// 随机播放500
route.get('/random-list', async (req, res) => {
  try {
    const musics = myShuffle(await queryData('musics', '*'));
    _success(res, 'ok', musics.slice(-500));
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
      !data.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const change = await updateData(
      'playing',
      {
        data: JSON.stringify(data.slice(0, maxSonglistCount)),
      },
      `WHERE account=?`,
      [account]
    );
    if (change.changes == 0) {
      await insertData('playing', [
        {
          account,
          data: JSON.stringify(data),
        },
      ]);
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
    let arr = await queryData('playing', 'data', `WHERE account=?`, [account]);
    if (arr.length > 0) {
      const musics = await queryData('musics', '*');
      const mObj = getMusicObj(musics);
      arr = JSON.parse(arr[0].data);
      for (let i = 0; i < arr.length; i++) {
        if (mObj.hasOwnProperty(arr[i])) {
          arr[i] = mObj[arr[i]];
        } else {
          arr.splice(i, 1);
          i--;
        }
      }
    }
    _success(res, 'ok', arr);
  } catch (error) {
    _err(res)(req, error);
  }
});
async function songlistMoveLocation(account, fId, tId) {
  if (fId == tId) return;
  const list = await getMusicList(account);
  const fIdx = list.findIndex((item) => item.id === fId),
    tIdx = list.findIndex((item) => item.id === tId);
  if (fIdx > 1 && tIdx > 1 && fIdx !== tIdx) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));
    await updateData(
      'musicinfo',
      {
        data: JSON.stringify(list),
      },
      `WHERE account=?`,
      [account]
    );
  }
}
// 歌单位置
route.post('/move-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { fromId, toId } = req.body;
    if (!validaString(fromId, 1, 50, 1) || !validaString(toId, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
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
    const { account } = req._hello.userinfo;
    const { id } = req.body;
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    const idx = list.findIndex((item) => item.id === id);
    if (idx > 1) {
      list.splice(idx, 1)[0];
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(list),
        },
        `WHERE account=?`,
        [account]
      );
      syncUpdateData(req, 'music');
      _success(res, '删除歌单成功')(req, id, 1);
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
    const { account } = req._hello.userinfo;
    const { id, name, des = '', toId = '' } = req.body;
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(name, 1, 100) ||
      !validaString(des, 0, 300) ||
      !validaString(toId, 0, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    const idx = list.findIndex((item) => item.id === id);
    if (id == 'all' && isRoot(req)) {
      _d.songList[2].name = name;
      _d.songList[2].des = des;
      _success(res);
    } else if (idx < 2 && idx >= 0 && isRoot(req)) {
      _d.songList[idx].name = name;
      _d.songList[idx].des = des;
      _success(res);
    } else if (idx > 1) {
      list[idx].name = name;
      list[idx].des = des;
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(list),
        },
        `WHERE account=?`,
        [account]
      );
      if (toId) {
        await songlistMoveLocation(account, id, toId);
      }
      syncUpdateData(req, 'music');
      _success(res, '更新歌单信息成功')(req, id, 1);
    } else {
      _err(res, '无权更新当前歌单信息')(req, id, 1);
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
      !validaString(id, 1, 50, 1) ||
      !validaString(title, 1, 100) ||
      !validaString(artist, 1, 100) ||
      !validaString(album, 1, 100) ||
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
      _err(res, '无权更新歌曲信息')(req, id, 1);
      return;
    }
    await updateData(
      'musics',
      { title, artist, album, year, duration, play_count, collect_count },
      `WHERE id=?`,
      [id]
    );
    syncUpdateData(req, 'music');
    _success(res, '更新歌曲信息成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 添加歌单
route.post('/add-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { name, des = '' } = req.body;
    if (!validaString(name, 1, 100) || !validaString(des, 0, 300)) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    const id = nanoid();
    list.push({
      name,
      des,
      item: [],
      id,
    });
    await updateData(
      'musicinfo',
      {
        data: JSON.stringify(list),
      },
      `WHERE account=?`,
      [account]
    );
    syncUpdateData(req, 'music');
    _success(res, '添加歌单成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 歌曲移动位置
async function songMoveLocation(account, listId, fromId, toId) {
  if (fromId == toId) return;
  const list = await getMusicList(account);
  const idx = list.findIndex((item) => item.id === listId);
  if (idx > 0) {
    const fIdx = list[idx].item.findIndex((item) => item.id == fromId),
      tIdx = list[idx].item.findIndex((item) => item.id == toId);
    if (fIdx < 0 || tIdx < 0 || fIdx == tIdx) return;
    list[idx].item.splice(tIdx, 0, ...list[idx].item.splice(fIdx, 1));
    await updateData(
      'musicinfo',
      {
        data: JSON.stringify(list),
      },
      `WHERE account=?`,
      [account]
    );
  }
}
// 移动歌曲
route.post('/move-song', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { fromId, toId, listId } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !validaString(fromId, 1, 50, 1) ||
      !validaString(toId, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
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
    const { account } = req._hello.userinfo;
    const { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    const add = ids.map((item) => ({ id: item }));
    list[1].item = unique([...add, ...list[1].item], ['id']).slice(
      0,
      maxSonglistCount
    );
    await updateData(
      'musicinfo',
      {
        data: JSON.stringify(list),
      },
      `WHERE account=?`,
      [account]
    );
    await runSqlite(
      `update musics set collect_count=collect_count+1 WHERE id IN (${createFillString(
        ids.length
      )})`,
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
    const { account } = req._hello.userinfo;
    const { id } = req.body;
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    list[1].item = list[1].item.filter((v) => v.id !== id);
    await updateData(
      'musicinfo',
      {
        data: JSON.stringify(list),
      },
      `WHERE account=?`,
      [account]
    );
    syncUpdateData(req, 'music');
    _success(res, '移除收藏歌曲成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除
route.post('/delete-song', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { listId, ids } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    if (listId == 'all') {
      if (!isRoot(req)) {
        _err(res, '无权删除歌曲')(req, `${listId}-${ids.length}`, 1);
        return;
      }
      const dels = await queryData(
        'musics',
        'url',
        `WHERE id IN (${createFillString(ids.length)})`,
        [...ids]
      );
      await concurrencyTasks(dels, 5, async (del) => {
        const { url } = del;
        await _delDir(`${configObj.filepath}/music/${getFileDir(url)}`).catch(
          () => {}
        );
      });
      await deleteData(
        'musics',
        `WHERE id IN (${createFillString(ids.length)})`,
        [...ids]
      );
    } else {
      const list = await getMusicList(account);
      const idx = list.findIndex((item) => item.id === listId);
      if (idx >= 0) {
        list[idx].item = list[idx].item.filter(
          (item) => !ids.some((y) => y == item.id)
        );
        await updateData(
          'musicinfo',
          { data: JSON.stringify(list) },
          `WHERE account=?`,
          [account]
        );
      }
    }
    syncUpdateData(req, 'music');
    _success(res, `${listId == 'all' ? '删除' : '移除'}歌曲成功`)(
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
    const { account } = req._hello.userinfo;
    let { listId, toId, ids } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !validaString(toId, 1, 50, 1) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const list = await getMusicList(account);
    ids = ids.map((item) => ({ id: item }));
    const i = list.findIndex((item) => item.id === listId),
      ii = list.findIndex((item) => item.id === toId);
    if (
      (listId == 'all' && ii > 1 && listId !== toId) ||
      (i >= 0 && i < 2 && ii > 1)
    ) {
      list[ii].item = unique([...ids, ...list[ii].item], ['id']).slice(
        0,
        maxSonglistCount
      );
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(list),
        },
        `WHERE account=?`,
        [account]
      );
      syncUpdateData(req, 'music');
      _success(res, '添加歌曲成功')(req, `${ids.length}=>${toId}`, 1);
      return;
    }
    if ((i > 1 && ii > 1, listId !== toId)) {
      list[i].item = list[i].item.filter(
        (item) => !ids.some((y) => y.id == item.id)
      );
      list[ii].item = unique([...ids, ...list[ii].item], ['id']).slice(
        0,
        maxSonglistCount
      );
      await updateData(
        'musicinfo',
        {
          data: JSON.stringify(list),
        },
        `WHERE account=?`,
        [account]
      );
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
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const dels = await queryData('musics', 'mv', `WHERE id=?`, [id]);
    for (let i = 0; i < dels.length; i++) {
      const { mv } = dels[i];
      if (mv) {
        await _delDir(`${configObj.filepath}/music/${mv}`).catch(() => {});
      }
    }
    await updateData('musics', { mv: '' }, `WHERE id=?`, [id]);
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
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const musicinfo = (await queryData('musics', 'lrc', `WHERE id=?`, [id]))[0];
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
    const { id, text } = req.body;
    if (!isRoot(req)) {
      _err(res, '无权操作')(req, id, 1);
      return;
    }
    if (!validaString(id, 1, 50, 1) || !validaString(text)) {
      paramErr(res, req);
      return;
    }
    const musicinfo = (await queryData('musics', 'lrc', `WHERE id=?`, [id]))[0];
    if (!musicinfo) {
      _err(res, '歌曲不存在')(req, id, 1);
    }
    const url = `${configObj.filepath}/music/${musicinfo.lrc}`;
    await _f.mkdir(`${configObj.filepath}/music/${getFileDir(musicinfo.lrc)}`);
    await _f.p.writeFile(url, text);
    _success(res, '更新歌词成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 分享
route.post('/share', async (req, res) => {
  try {
    let { list, title, valid, pass = '' } = req.body;
    valid = parseInt(valid);
    if (
      !validaString(title, 1, 100) ||
      !validaString(pass, 0, 20) ||
      isNaN(valid) ||
      valid > 999 ||
      !_type.isArray(list) ||
      list.length == 0 ||
      !list.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const id = nanoid();
    const obj = {
      id,
      valid: valid == 0 ? 0 : Date.now() + valid * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(list.slice(0, maxSonglistCount)),
      account,
      type: 'music',
    };
    await insertData('share', [obj]);
    syncUpdateData(req, 'sharelist');
    _success(res, '分享歌曲成功', { id })(req, `${list.length}=>${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 歌曲上传
route.post('/up', async (req, res) => {
  try {
    const { HASH = '', name, type, id = '' } = req.query;
    if (
      !validaString(name, 1, 255) ||
      !validaString(HASH, 0, 50, 1) ||
      !validationValue(type, ['song', 'cover', 'mv']) ||
      !validaString(id, 0, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    if (type === 'song') {
      if (!validaString(HASH, 1, 50, 1)) {
        paramErr(res, req);
        return;
      }
      if (!isMusicFile(name)) {
        _err(res, '歌曲格式错误')(req, name, 1);
        return;
      }
      const song = (await queryData('musics', '*', `WHERE hash=?`, [HASH]))[0];
      if (song) {
        _err(res, '歌曲已存在')(req, HASH, 1);
        return;
      }
      const creat_time = Date.now();
      const timePath = getTimePath(creat_time);
      const suffix = getSuffix(name)[1];
      const tDir = `${configObj.filepath}/music/${timePath}/${HASH}`;
      const tName = `${HASH}.${suffix}`;
      await _f.mkdir(tDir);
      await receiveFiles(req, tDir, tName, 20);
      const songInfo = await getSongInfo(`${tDir}/${tName}`);
      let { album, year, title, duration, artist, pic, lrc, picFormat } =
        songInfo;
      if (pic) {
        await _f.p.writeFile(
          `${tDir}/${HASH}.${getPathFilename(picFormat)[0]}`,
          pic
        );
        pic = `${timePath}/${HASH}/${HASH}.${getPathFilename(picFormat)[0]}`;
      }
      await _f.p.writeFile(`${tDir}/${HASH}.lrc`, lrc);
      const sid = nanoid();
      await insertData('musics', [
        {
          id: sid,
          artist,
          title,
          duration,
          mv: '',
          collect_count: 0,
          play_count: 0,
          album,
          year,
          hash: HASH,
          pic,
          url: `${timePath}/${HASH}/${tName}`,
          lrc: `${timePath}/${HASH}/${HASH}.lrc`,
          creat_time,
        },
      ]);
      _success(res, '上传歌曲成功')(req, sid, 1);
    } else if (type === 'cover') {
      if (!validaString(id, 1, 50, 1)) {
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
        await queryData('musics', 'url,pic', `WHERE id=?`, [id])
      )[0];
      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }
      const { url, pic } = songInfo;
      const tDir = `${configObj.filepath}/music/${getFileDir(url)}`;
      const tName = `${getPathFilename(url)[1]}.${getSuffix(name)[1]}`;
      await _f.mkdir(tDir);
      await receiveFiles(req, tDir, tName, 5);
      if (getPathFilename(pic)[0] != tName) {
        if (pic) {
          await _delDir(`${tDir}/${getPathFilename(pic)[0]}`).catch(() => {});
        }
        await updateData(
          'musics',
          { pic: `${getSuffix(url)[0]}.${getSuffix(name)[1]}` },
          `WHERE id=?`,
          [id]
        );
      }
      syncUpdateData(req, 'music');
      _success(res, '上传封面成功')(req, id, 1);
    } else if (type === 'mv') {
      if (!validaString(id, 1, 50, 1)) {
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
        await queryData('musics', 'url,mv', `WHERE id=?`, [id])
      )[0];
      if (!songInfo) {
        _err(res, '歌曲不存在')(req, id, 1);
        return;
      }
      const { url, mv } = songInfo;
      const tDir = `${configObj.filepath}/music/${getFileDir(url)}`;
      const tName = `${getPathFilename(url)[1]}.${getSuffix(name)[1]}`;
      await _f.mkdir(tDir);
      await receiveFiles(req, tDir, tName, 200);
      if (getPathFilename(mv)[0] != tName) {
        if (mv) {
          await _delDir(`${tDir}/${getPathFilename(mv)[0]}`).catch(() => {});
        }
        await updateData(
          'musics',
          { mv: `${getSuffix(url)[0]}.${getSuffix(name)[1]}` },
          `WHERE id=?`,
          [id]
        );
      }
      _success(res, '上传MV成功')(req, id, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 歌曲重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;
    if (!validaString(HASH, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const songInfo = (
      await queryData('musics', '*', `WHERE hash=?`, [HASH])
    )[0];
    if (songInfo) {
      if (_f.c.existsSync(`${configObj.filepath}/music/${songInfo.url}`)) {
        _success(res);
        return;
      }
      await deleteData('musics', `WHERE id=?`, [songInfo.id]);
    }
    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 保存分享
route.get('/save-share', async function (req, res) {
  try {
    const { account } = req._hello.userinfo;
    const { id, name } = req.query;
    if (!validaString(id, 1, 50, 1) || !validaString(name, 1, 100)) {
      paramErr(res, req);
      return;
    }
    let arr = await queryData('share', 'data', `WHERE id=? AND type=?`, [
      id,
      'music',
    ]);
    if (arr.length < 0) {
      _err(res, '分享已取消')(req, id, 1);
      return;
    }
    arr = JSON.parse(arr[0].data);
    arr = arr.map((item) => ({ id: item })).slice(0, maxSonglistCount);
    const songList = await getMusicList(account);
    const lid = nanoid();
    songList.push({
      name,
      id: lid,
      item: arr,
      des: '',
    });
    await updateData(
      'musicinfo',
      { data: JSON.stringify(songList) },
      `WHERE account=?`,
      [account]
    );
    syncUpdateData(req, 'music');
    _success(res, '保存歌单成功')(req, `${arr.length}=>${lid}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
