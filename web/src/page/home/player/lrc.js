import $ from 'jquery';
import {
  _setData,
  _getData,
  _setTimeout,
  throttle,
  myShuffle,
  copyText,
  _position,
  downloadFile,
  ContentScroll,
  getMinIndex,
  percentToValue,
  formartSongTime,
  getFilePath,
  _mySlide,
  _getTarget,
  isRoot,
  getFileReader,
} from '../../../js/utils/utils.js';
import _msg from '../../../js/plugins/message/index.js';
import realtime from '../../../js/plugins/realtime/index.js';
import {
  closeMvBox,
  initMiniLrc,
  miniLrcUpdateLrc,
  miniPlayerLoading,
  miniPlayerPause,
  miniplayerPlaying,
  playMv,
  showEditLrc,
} from './widget.js';
import {
  delSong,
  getMusicPlayerOffsetLeft,
  highlightPlayingSong,
  moveSongToList,
  musicFootBoxPlayBtnLoading,
  musicFootBoxPlayBtnPause,
  musicFootBoxPlayBtnPlaying,
  musicPlayBgOpacity,
  musicPlayerIsHide,
  resetPlayingSongLogo,
  setCurPlayingList,
  setMusicList,
  setSearchMusicInputValue,
  shareSongList,
  showMusicPlayerBox,
  songCloseCollect,
  songCollect,
  startPlayingSongLogo,
  stopPlayingSongLogo,
  updatePlayerBottomProgress,
  updateSongInfo,
} from './index.js';
import {
  playingListHighlight,
  setPlayingList,
  showPlayingList,
} from './playlist.js';
import _d from '../../../js/common/config.js';
import { reqPlayerLrc } from '../../../api/player.js';
import { resetLastPlayCount, updateLastPlay } from '../timer.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { showSongInfo } from '../../../js/utils/showinfo.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { _tpl, deepClone } from '../../../js/utils/template.js';
import notifyMusicControlPanel from './notifyMusicControlPanel.js';
import _path from '../../../js/utils/path.js';
import { getSearchSongs } from './search.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import percentBar from '../../../js/plugins/percentBar/index.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
const $myAudio = $(new Audio()),
  $musicLrcWrap = $('.music_player_box .music_lrc_wrap'),
  $lrcBg = $musicLrcWrap.find('.lrc_bg'),
  $lrcHead = $musicLrcWrap.find('.lrc_head'),
  $lrcListWrap = $musicLrcWrap.find('.lrc_list_wrap'),
  $lrcMenuWrap = $musicLrcWrap.find('.lrc_menu_wrap'),
  $lrcFootWrap = $musicLrcWrap.find('.lrc_foot_wrap'),
  $lrcProgressBar = $lrcFootWrap.find('.progress_bar'),
  $lrcFootBtnWrap = $lrcFootWrap.find('.foot_btn_wrap');
$myAudio[0].preload = 'none';
let curPlaySpeed = _getData('songPlaySpeed'),
  lrcState = _getData('lrcState');
let activeLrcIndex = 0,
  remotePlayState = false,
  lrcList = [],
  playingSongInfo = {}, // 正在播放的歌曲信息
  songPlayMode = 'order';
// 设置正在播放歌曲信息
export function setPlayingSongInfo(val) {
  if (val === undefined) {
    return playingSongInfo;
  }
  playingSongInfo = val;
}
// 获取播放速度
export function setCurPlaySpeed(val) {
  if (val === undefined) {
    return curPlaySpeed;
  }
  curPlaySpeed = val;
}
// 设置远程播放状态
export function setRemotePlayState(val) {
  if (val === undefined) {
    return remotePlayState;
  }
  remotePlayState = val;
}
// 设置播放模式
export function setSongPlayMode(val) {
  if (val === undefined) {
    return songPlayMode;
  }
  songPlayMode = val;
}
// 歌词框是隐藏
export function lrcWrapIsHide() {
  return $musicLrcWrap.css('transform') !== 'none';
}
// 设置歌曲音量
export function setSongPlayVolume(value) {
  $myAudio[0].volume = value;
}
// 歌曲是暂停
export function songIspaused() {
  return $myAudio[0].paused;
}
// 设置播放进度
export function setSongCurrentTime(value) {
  if (value === undefined) {
    return $myAudio[0].currentTime;
  }
  $myAudio[0].currentTime = value;
}
// 更新总时长
export function updatePlayingSongTotalTime(val) {
  $lrcProgressBar.find('.total_time').text(formartSongTime(val));
}
// 歌曲路径
export async function setAudioSrc(val) {
  const cache = await cacheFile.read(val, 'music');
  if (cache) {
    val = cache;
  }
  $myAudio.attr('src', val);
}
// 背景
export function setLrcBg(val) {
  $lrcBg.css('background-image', `url("${val}")`).removeClass('lrcbgss');
}
// 操作按钮框
export function showLrcFootWrap() {
  $lrcFootWrap.stop().slideDown(_d.speed, () => {
    $lrcFootWrap._flag = 'y';
    lrcScroll();
  });
}
// 隐藏底部操作框
export function hideLrcFootWrap() {
  $lrcFootWrap.stop().slideUp(_d.speed, () => {
    $lrcFootWrap._flag = 'n';
    lrcScroll();
  });
}
// 播放模式切换
export function switchPlayMode() {
  if (remotePlayState) {
    realtime.send({
      type: 'playmode',
      data: { state: songPlayMode },
    });
  }
  let text = '';
  let icon = '';
  switch (songPlayMode) {
    case 'order':
      {
        songPlayMode = 'random';
        $myAudio.attr('loop', null);
        icon = 'iconfont icon-suiji';
        text = '随机播放';
        setCurPlayingList(myShuffle(deepClone(setPlayingList())));
      }
      break;
    case 'random':
      {
        songPlayMode = 'loop';
        $myAudio.attr('loop', 'loop');
        icon = 'iconfont icon-ttpodicon';
        text = '单曲播放';
      }
      break;
    case 'loop':
      {
        songPlayMode = 'order';
        $myAudio.attr('loop', null);
        icon = 'iconfont icon-shunxubofang';
        text = '顺序播放';
        setCurPlayingList(deepClone(setPlayingList()));
      }
      break;
  }
  $lrcFootBtnWrap
    .find('.random_play_btn')
    .attr('class', `random_play_btn ${icon}`);
  _msg.msg({ message: text, icon });
}
// 上一曲
export function playPrevSong() {
  let index;
  if (setCurPlayingList().length === 0) {
    _msg.error('播放列表为空');
    pauseSong();
    return;
  }
  index = setCurPlayingList().findIndex((x) => x.id === playingSongInfo.id);
  index--;
  index < 0 ? (index = setCurPlayingList().length - 1) : null;
  musicPlay(setCurPlayingList()[index]);
}
// 下一曲
export function playNextSong() {
  updatePlayerBottomProgress(0);
  $lrcProgressBar.find('.pro2').width('0');
  let index;
  if (setCurPlayingList().length === 0) {
    _msg.error('播放列表为空');
    pauseSong();
    return;
  }
  index = setCurPlayingList().findIndex((x) => x.id === playingSongInfo.id);
  index++;
  index > setCurPlayingList().length - 1 ? (index = 0) : null;
  musicPlay(setCurPlayingList()[index]);
}
// 播放状态
export function changePlayState() {
  if (songIspaused()) {
    playSong();
  } else {
    pauseSong();
  }
}
$lrcFootBtnWrap
  .on('click', '.random_play_btn', switchPlayMode)
  .on('click', '.playing_list_btn', showPlayingList)
  .on('click', '.prev_play_btn', playPrevSong)
  .on('click', '.next_play', playNextSong)
  .on('click', '.play_btn', changePlayState);
// 暂停
export function pauseSong() {
  $myAudio[0].pause();
  document.title = _d.title;
  $lrcProgressBar.find('.dolt').css('animation-play-state', 'paused');
  stopPlayingSongLogo();
  musicFootBoxPlayBtnPause();
  $lrcFootBtnWrap
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'none');
  miniPlayerPause();
}
// 播放音乐
function playSong() {
  closeMvBox();
  if (!playingSongInfo.hash) {
    _msg.error('请选择需要播放的歌曲');
    return;
  }
  if (remotePlayState) {
    //远程播放
    realtime.send({
      type: 'play',
      data: { state: 1, obj: playingSongInfo },
    });
  } else {
    document.title = `\xa0\xa0\xa0♪正在播放：${playingSongInfo.artist} - ${playingSongInfo.title}`;
    $myAudio[0].play();
    renderLrc();
  }
  //保持播放速度
  $myAudio[0].playbackRate = curPlaySpeed[1];
}

//歌词处理
async function renderLrc() {
  if (!playingSongInfo.id || lrcList.length > 0) return;
  const id = playingSongInfo.id;
  const cache = await cacheFile.read(id, 'music');
  let list = [];
  if (cache) {
    try {
      const response = await fetch(cache);
      const blob = await response.blob();
      list = JSON.parse(await getFileReader(blob, 'text'));
    } catch {
      await cacheFile.delete(id, 'music');
      lrcList = [];
      return;
    }
  } else {
    try {
      const result = await reqPlayerLrc({
        id,
      });

      if (result.code === 1) {
        list = result.data;
        await cacheFile.add(id, 'music', new Blob([JSON.stringify(list)]));
      } else {
        throw '';
      }
    } catch {
      lrcList = [];
      return;
    }
  }

  if (id !== playingSongInfo.id) return;
  list = list.map((item, idx) => {
    item.idx = idx;
    return item;
  });
  lrcList = list;
  const hasfy = !list.every((item) => item.fy === '');
  if (hasfy) {
    $lrcMenuWrap.find('.lrc_translate_btn').stop().show(_d.speed);
  } else {
    $lrcMenuWrap.find('.lrc_translate_btn').stop().hide(_d.speed);
  }
  const showFy = _getData('showSongTranslation') && hasfy ? true : false;
  const html = _tpl(
    `
          <div v-for="{p,fy} in list">
            <p class="elrc">{{p}}</p>
            <p v-show="showFy" class="lrcfy">{{fy}}</p>
          </div>
          `,
    {
      list,
      showFy,
    }
  );
  $lrcListWrap
    .find('.lrc_items')
    .css({
      'text-align': lrcState.position,
      'font-size': percentToValue(14, 30, lrcState.size),
    })
    .html(html);
  computeLrcIndex();
  lrcScroll(true);
}
// 计算歌词索引
function computeLrcIndex() {
  const cTime = Math.round(setSongCurrentTime());
  activeLrcIndex = getMinIndex(lrcList.map((item) => Math.abs(cTime - item.t)));
}
// 滚动歌词
export function lrcScroll(immedia) {
  if (lrcWrapIsHide() || musicPlayerIsHide()) return;
  const $lrc = $lrcListWrap.find('.lrc_items');
  if (lrcList.length === 0) return;
  const $lrcdiv = $lrc.children('div'),
    $activediv = $lrcdiv.eq(activeLrcIndex),
    wH = $lrcListWrap.outerHeight(),
    lrcmtop = parseFloat(
      window.getComputedStyle($lrc[0]).transform.slice(7).split(',').slice(-1)
    ),
    mtop = lrcmtop - _position($activediv[0]).top + wH * 0.4;
  $lrcdiv.removeClass('active');
  $activediv.addClass('active');
  if (immedia) {
    $lrc.css({
      transition: '0s',
      transform: `translateY(${mtop}px)`,
    });
  } else {
    $lrc.css({
      transition: 'transform .5s ease-in-out',
      transform: `translateY(${mtop}px)`,
    });
  }
}
// 显示/隐藏歌词
$lrcListWrap.on('click', function () {
  if ($lrcFootWrap._flag !== 'y') return;
  if (this._isop) {
    $lrcListWrap.css('opacity', 1);
    $lrcBg.removeClass('open');
    this._isop = false;
  } else {
    $lrcListWrap.css('opacity', 0);
    $lrcBg.addClass('open');
    this._isop = true;
  }
});
// 更新播放进度
export const updateSongProgress = throttle(function () {
  $lrcProgressBar
    .find('.current_time')
    .text(formartSongTime(setSongCurrentTime()));
  setSongProgressBar(setSongCurrentTime() / playingSongInfo.duration, true);
}, 500);
// 歌曲加载中
function songLoading() {
  if (songIspaused()) return;
  $lrcProgressBar
    .find('.dolt')
    .css('animation', 'bgcolor .3s infinite linear alternate');
  miniPlayerLoading();
  $lrcFootBtnWrap
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'fontcolor .5s infinite linear alternate');
  musicFootBoxPlayBtnLoading();
}
// 歌曲开始播放
function songStartPlaying() {
  if (songIspaused()) return;
  $lrcProgressBar
    .find('.dolt')
    .css('animation', 'bgcolor 2s infinite linear alternate');
  $lrcFootBtnWrap
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-zanting')
    .css('animation', 'none');
  miniplayerPlaying();
  musicFootBoxPlayBtnPlaying();
  startPlayingSongLogo();
}
// 更新播放时间
function songTimeUpdate() {
  if (songIspaused()) return;
  const curPlayTime = Math.round(this.currentTime);
  // 播放50%以上缓存歌曲
  if (this.currentTime / playingSongInfo.duration > 0.5) {
    if ($myAudio._songid !== playingSongInfo.id) {
      $myAudio._songid = playingSongInfo.id;
      cacheFile.add(playingSongInfo.uurl, 'music');
    }
  }
  updateSongProgress();
  if ($myAudio._flag === curPlayTime) return;
  const list = lrcList || [];
  list
    .filter((item) => item.t === curPlayTime)
    // 多句同时间排队执行，100ms执行一次
    .forEach((item) => {
      lrcCount++;
      $myAudio._flag = curPlayTime;
      _setTimeout(() => {
        activeLrcIndex = item.idx;
        lrcCount--;
        if (lrcCount > 0) {
          lrcScroll(true);
        } else {
          lrcScroll();
        }
        miniLrcUpdateLrc(list, activeLrcIndex);
      }, lrcCount * 100);
    });
}
let lrcCount = -1; //歌词计数
$myAudio
  .on('loadedmetadata', function () {
    //元数据加载完
  })
  .on('waiting', songLoading)
  .on('playing', songStartPlaying)
  .on('error', function () {
    const url = playingSongInfo.uurl;
    cacheFile.delete(url, 'music');
    _msg.error('歌曲加载失败');
    pauseSong();
  })
  .on('ended', function () {
    if (songPlayMode === 'loop') return;
    playNextSong();
  })
  .on('timeupdate', songTimeUpdate);

notifyMusicControlPanel
  .bind('play', playSong)
  .bind('pause', pauseSong)
  .bind('previoustrack', playPrevSong)
  .bind('nexttrack', playNextSong)
  .bind('seekbackward', () => {
    setSongCurrentTime(Math.max(setSongCurrentTime() - 10, 0));
  })
  .bind('seekforward', () => {
    setSongCurrentTime(
      Math.min(setSongCurrentTime() + 10, playingSongInfo.duration)
    );
  });
// 滚动歌曲信息
const lrcHeadContentScrollName = new ContentScroll(
  $lrcHead.find('.song_name div')[0]
);
const lrcHeadContentScrollArtist = new ContentScroll(
  $lrcHead.find('.artist_name i')[0]
);
export function updateLrcHeadSongInfo(obj) {
  lrcHeadContentScrollName.init(obj.title);
  lrcHeadContentScrollArtist.init(obj.artist);
}
export function closeLrcHeadContentScrollName() {
  lrcHeadContentScrollName.close();
  lrcHeadContentScrollArtist.close();
}
// 设置歌曲进度条位置
function setSongProgressBar(percent, y) {
  percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
  const pro1W = pro1.offsetWidth,
    doltW = dolt.offsetWidth;
  const val = (pro1W - doltW) * percent + doltW / 2 + 'px';
  const per = percent * 100 + '%';
  if (doltW) {
    $lrcProgressBar.find('.pro2').css('width', val);
  } else {
    $lrcProgressBar.find('.pro2').css('width', per);
  }
  updatePlayerBottomProgress(per);
  if (!y) {
    setSongCurrentTime(percent * playingSongInfo.duration);
  }
}
// 隐藏歌词
export function hideLrcBox() {
  $musicLrcWrap.removeClass('active');
}
// 远程播放按钮状态
export function playerRemoteBtnState(flag) {
  if (flag) {
    $lrcHead.find('.remote_play').addClass('red');
  } else {
    $lrcHead.find('.remote_play').removeClass('red');
  }
}
// 远程播放
$lrcHead
  .on('click', '.remote_play', function () {
    initMusicLrc();
    if (remotePlayState) {
      remotePlayState = !remotePlayState;
      _msg.success('关闭远程播放');
      playerRemoteBtnState();
      realtime.send({
        type: 'play',
        data: { state: 0 },
      });
    } else {
      if (!playingSongInfo.hash) return;
      remotePlayState = !remotePlayState;
      _msg.success('开启远程播放');
      lrcList = [];
      pauseSong();
      playerRemoteBtnState(1);
      realtime.send({
        type: 'play',
        data: { state: 1, obj: playingSongInfo },
      });
    }
  })
  .on('click', '.close', hideLrcBox)
  .on('click', '.artist_name_text', function (e) {
    e.stopPropagation();
    setSearchMusicInputValue(playingSongInfo.artist);
    getSearchSongs(1, 1);
  });
// 处理歌曲数据
export function hdSongInfo(obj) {
  obj = deepClone(obj);
  obj.title || (obj.title = '真相永远只有一个！');
  obj.artist || (obj.artist = '江户川柯南');
  obj.ppic = getFilePath(`/music/${obj.pic}`);
  obj.uurl = getFilePath(`/music/${obj.url}`);
  obj.mmv = getFilePath(`/music/${obj.mv}`);
  return obj;
}
// 初始化歌词
export function initMusicLrc() {
  activeLrcIndex = 0;
  initMiniLrc();
  lrcList = [];
  $lrcListWrap.find('.lrc_items').html('');
}
let playtimer = null;
export function getPlaytimer() {
  return playtimer;
}
// 播放歌曲
export function musicPlay(obj) {
  if (playtimer) {
    clearTimeout(playtimer);
    playtimer = null;
  }
  playingSongInfo = hdSongInfo(obj); //初始化音乐数据
  if (!playingSongInfo.hash) {
    _msg.error('请选择需要播放的歌曲');
    return;
  }
  setSongCurrentTime(0);
  updatePlayingSongTotalTime(playingSongInfo.duration);
  updatePlayerBottomProgress(0);
  $lrcBg.addClass('lrcbgss'); //背景透明
  musicPlayBgOpacity();
  resetPlayingSongLogo();
  updateSongInfo().then(playSong);
  initMusicLrc();
  toggleLrcMenuWrapBtnsState();
  // 高亮显示正在播放歌曲
  highlightPlayingSong(false);
  playingListHighlight(false);
  const text = `${playingSongInfo.artist} - ${playingSongInfo.title}`;
  _msg.msg({ message: text, icon: 'iconfont icon-yinle1' }, (type) => {
    if (type === 'click') {
      if (musicPlayerIsHide()) {
        showMusicPlayerBox();
      }
    }
  });
  playtimer = setTimeout(() => {
    clearTimeout(playtimer);
    playtimer = null;
    if (!remotePlayState) {
      //未开启远程
      resetLastPlayCount();
      updateLastPlay(1, 1);
    }
  }, 2000);
}
// 切换歌词下方按钮状态
export function toggleLrcMenuWrapBtnsState() {
  if (playingSongInfo.mv) {
    $lrcMenuWrap.find('.play_mv_btn').stop().show(_d.speed);
  } else {
    $lrcMenuWrap.find('.play_mv_btn').stop().hide(_d.speed);
  }
  if (setMusicList()[1].item.some((v) => v.id === playingSongInfo.id)) {
    $lrcMenuWrap
      .find('.collect_song_btn')
      .attr('class', 'collect_song_btn iconfont icon-hear-full active');
  } else {
    $lrcMenuWrap
      .find('.collect_song_btn')
      .attr('class', 'collect_song_btn iconfont icon-hear');
  }
}
// 显示歌词
export function showLrcBox() {
  $musicLrcWrap.addClass('active');
  lrcHeadContentScrollName.init(playingSongInfo.title);
  lrcHeadContentScrollArtist.init(playingSongInfo.artist);
  _setTimeout(() => {
    lrcScroll(true);
  }, 600);
  $lrcHead.find('.close').stop().fadeIn(_d.speed);
}
//进度条
// 进度条歌词
$lrcProgressBar
  .find('.probox')
  .on('mousemove', function (e) {
    const x = e.clientX,
      left = pro1.offsetLeft + getMusicPlayerOffsetLeft(),
      percent = (x - left) / pro1.offsetWidth,
      time = playingSongInfo.duration * percent,
      idx = getMinIndex(lrcList.map((item) => Math.abs(time - item.t))),
      lrc = lrcList[idx];
    let str = formartSongTime(time);
    if (lrc) {
      str += `${lrc.p ? `\n${lrc.p}` : ''}${
        _getData('showSongTranslation') && lrc.fy ? `\n${lrc.fy}` : ''
      }`;
    }
    toolTip.setTip(str).show();
  })
  .on('mouseleave', function () {
    toolTip.hide();
  });
const probox = $lrcProgressBar.find('.probox')[0],
  pro1 = $lrcProgressBar.find('.pro1')[0],
  dolt = $lrcProgressBar.find('.dolt')[0];
probox.addEventListener('touchstart', function (e) {
  $lrcProgressBar.find('.dolt').addClass('open');
  $lrcProgressBar.find('.pro1').addClass('open');
  let percent;
  mmove(e);
  function mmove(e) {
    e.preventDefault();
    const ev = e.targetTouches[0];
    const left = pro1.offsetLeft + getMusicPlayerOffsetLeft();
    const doltW = dolt.offsetWidth;
    percent = (ev.clientX - left - doltW / 2) / (pro1.offsetWidth - doltW);
    setSongProgressBar(percent);
  }
  function mend() {
    if (remotePlayState) {
      realtime.send({
        type: 'progress',
        data: { value: percent },
      });
    }
    computeLrcIndex();
    lrcScroll();
    $lrcProgressBar.find('.dolt').removeClass('open');
    $lrcProgressBar.find('.pro1').removeClass('open');
    probox.removeEventListener('touchmove', mmove);
    probox.removeEventListener('touchend', mend);
  }
  probox.addEventListener('touchmove', mmove);
  probox.addEventListener('touchend', mend);
});
probox.addEventListener('mousedown', function (e) {
  let percent;
  mmove(e);
  function mmove(e) {
    e.preventDefault();
    const left = pro1.offsetLeft + getMusicPlayerOffsetLeft();
    const doltW = dolt.offsetWidth;
    percent = (e.clientX - left - doltW / 2) / (pro1.offsetWidth - doltW);
    setSongProgressBar(percent);
  }
  function mup() {
    if (remotePlayState) {
      realtime.send({
        type: 'progress',
        data: { value: percent },
      });
    }
    computeLrcIndex();
    lrcScroll();
    document.removeEventListener('mousemove', mmove);
    document.removeEventListener('mouseup', mup);
  }
  document.addEventListener('mousemove', mmove);
  document.addEventListener('mouseup', mup);
});
$lrcMenuWrap
  .on(
    'click',
    '.collect_song_btn',
    throttle(function () {
      if (!playingSongInfo.hash) return;
      const $this = $(this);
      if (!$this.hasClass('active')) {
        songCollect([playingSongInfo.id], () => {
          $this.attr(
            'class',
            'collect_song_btn iconfont icon-hear-full active'
          );
        });
      } else {
        songCloseCollect(playingSongInfo.id, () => {
          $this.attr('class', 'collect_song_btn iconfont icon-hear');
        });
      }
    }, 2000)
  )
  .on('click', '.play_mv_btn', function () {
    if (!playingSongInfo.hash) return;
    playMv(playingSongInfo);
  })
  .on('click', '.lrc_translate_btn', () => {
    let showfy = _getData('showSongTranslation');
    if (showfy) {
      $lrcListWrap.find('.lrc_items .lrcfy').css('display', 'none');
    } else {
      $lrcListWrap.find('.lrc_items .lrcfy').css('display', 'block');
    }
    lrcScroll(true);
    showfy = !showfy;
    _setData('showSongTranslation', showfy);
  })
  .on('click', '.share_song_btn', function (e) {
    if (!playingSongInfo.hash) return;
    shareSongList(e, [playingSongInfo.id]);
  })
  .on('click', '.set_lrc_btn', function (e) {
    if (!playingSongInfo.hash) return;
    let data = [
      {
        id: '1',
        text: '字体大小',
        beforeIcon: 'iconfont icon-font-size',
      },
      {
        id: '2',
        text: '靠左',
        beforeIcon: 'iconfont icon-kaozuo1',
      },
      {
        id: '3',
        text: '居中',
        beforeIcon: 'iconfont icon-geci',
      },
      {
        id: '4',
        text: '靠右',
        beforeIcon: 'iconfont icon-kaoyou1',
      },
      {
        id: '5',
        text: '编辑歌词',
        beforeIcon: 'iconfont icon-bianji',
      },
      {
        id: '6',
        text: '封面',
        beforeIcon: 'iconfont icon-tupian',
      },
      {
        id: '7',
        text: '复制歌曲名',
        beforeIcon: 'iconfont icon-fuzhi',
      },
      {
        id: '8',
        text: '歌曲信息',
        beforeIcon: 'iconfont icon-about',
      },
      {
        id: '9',
        text: '添加到',
        beforeIcon: 'iconfont icon-icon-test',
      },
      {
        id: '10',
        text: '下载',
        beforeIcon: 'iconfont icon-download',
      },
    ];
    if (isRoot()) {
      data.push({
        id: '11',
        text: '删除',
        beforeIcon: 'iconfont icon-shanchu',
      });
    }
    rMenu.selectMenu(
      e,
      data,
      ({ e, close, id, loading }) => {
        if (id === '1') {
          close();
          const { size } = lrcState;
          percentBar(e, size, (percent) => {
            $lrcListWrap.find('.lrc_items').css({
              'font-size': percentToValue(14, 30, percent) + 'px',
            });
            lrcState.size = percent;
            _setData('lrcState', lrcState);
            lrcScroll(true);
          });
        } else if (id === '2') {
          close();
          lrcState.position = 'left';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'left',
          });
          _setData('lrcState', lrcState);
        } else if (id === '3') {
          close();
          lrcState.position = 'center';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'center',
          });
          _setData('lrcState', lrcState);
        } else if (id === '4') {
          close();
          lrcState.position = 'right';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'right',
          });
          _setData('lrcState', lrcState);
        } else if (id === '5') {
          if (!playingSongInfo.hash) return;
          close();
          showEditLrc(playingSongInfo);
        } else if (id === '6') {
          close();
          let u1 = playingSongInfo.ppic;
          imgPreview([
            {
              u1,
              u2: `${u1}&t=1`,
            },
          ]);
        } else if (id === '7') {
          close();
          copyText(playingSongInfo.artist + ' - ' + playingSongInfo.title);
        } else if (id === '9') {
          moveSongToList(e, 'all', [playingSongInfo.id]);
        } else if (id === '11') {
          if (!playingSongInfo.hash) return;
          let sobj = deepClone(playingSongInfo);
          delSong(
            e,
            'all',
            [sobj.id],
            'del',
            () => {
              close();
            },
            `${sobj.artist} - ${sobj.title}`,
            loading
          );
        } else if (id === '8') {
          showSongInfo(e, playingSongInfo, '', loading);
        } else if (id === '10') {
          close();
          const fname = `${playingSongInfo.artist}-${playingSongInfo.title}`;
          downloadFile(
            [
              {
                fileUrl: playingSongInfo.uurl,
                filename: `${fname}.${_path.extname(playingSongInfo.url)[2]}`,
              },
            ],
            'music'
          );
        }
      },
      `${playingSongInfo.artist} - ${playingSongInfo.title}`
    );
  })
  .on('click', '.play_speed_btn', function (e) {
    let data = [];
    [2, 1.75, 1.5, 1.25, 1, 0.75, 0.25].forEach((item, idx) => {
      data.push({
        id: idx + 1 + '',
        text: 'x' + item,
        beforeIcon: 'iconfont icon-sudu',
        param: {
          b: item,
          a: 'x' + item,
        },
        active: curPlaySpeed[1] === item ? true : false,
      });
    });
    rMenu.selectMenu(
      e,
      data,
      ({ id, resetMenu, param }) => {
        if (id) {
          const { a, b } = param;
          $lrcMenuWrap.find('.play_speed_btn').text(a);
          $myAudio[0].playbackRate = b;
          curPlaySpeed = [a, b];
          data.forEach((item) => {
            if (item.param.b === curPlaySpeed[1]) {
              item.active = true;
            } else {
              item.active = false;
            }
          });
          resetMenu(data);
          _setData('songPlaySpeed', curPlaySpeed);
          _msg.msg({ message: b + 'X', icon: 'iconfont icon-sudu' });
        }
      },
      '歌曲播放速度'
    );
  })
  .find('.play_speed_btn')
  .text(curPlaySpeed[0]);
_mySlide({
  el: '.music_lrc_wrap',
  right(e) {
    if (_getTarget(this, e, '.lrc_foot_wrap')) return;
    hideLrcBox();
  },
  down(e) {
    if (_getTarget(this, e, '.lrc_foot_wrap')) return;
    hideLrcBox();
  },
  left(e) {
    if (_getTarget(this, e, '.lrc_foot_wrap')) return;
    playNextSong();
  },
});
