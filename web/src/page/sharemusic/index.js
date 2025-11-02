import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import imgMusic from '../../images/img/music.jpg';
import {
  queryURLParams,
  myOpen,
  _setTimeout,
  throttle,
  debounce,
  imgjz,
  _getTarget,
  copyText,
  myShuffle,
  _mySlide,
  downloadFile,
  ContentScroll,
  myDrag,
  toCenter,
  toSetSize,
  myResize,
  myToMax,
  myToRest,
  getMinIndex,
  percentToValue,
  formartSongTime,
  _position,
  getTextImg,
  formatDate,
  getFilePath,
  enterPassCode,
  userLogoMenu,
  LazyLoad,
  hdOnce,
  formatNum,
  isFullScreen,
  isIframe,
  getScreenSize,
  loadImg,
  pageErr,
  _animate,
  savePopLocationInfo,
  getStaticPath,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import {
  reqPlayerGetShare,
  reqPlayerLrc,
  reqPlayerSaveShare,
} from '../../api/player';
import pagination from '../../js/plugins/pagination';
import toolTip from '../../js/plugins/tooltip';
import { showSongInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl, deepClone } from '../../js/utils/template';
import { initRainCodeSleep } from '../../js/common/codeRain';
import notifyMusicControlPanel from '../home/player/notifyMusicControlPanel';
import _path from '../../js/utils/path';
import { imgCache } from '../../js/utils/imgCache';
import imgPreview from '../../js/plugins/imgPreview';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg, waitLogin } from '../home/home';
import localData from '../../js/common/localData';
const urlparmes = queryURLParams(myOpen()),
  shareId = urlparmes.s,
  $myAudio = $(new Audio()),
  $musicPlayerWrap = $('.music_player_wrap'),
  $userInfo = $musicPlayerWrap.find('.user_info'),
  $lrcBg = $musicPlayerWrap.find('.lrc_bg'),
  $lrcHead = $musicPlayerWrap.find('.lrc_head'),
  $lrcListWrap = $musicPlayerWrap.find('.lrc_list_wrap'),
  $lrcMenuWrap = $musicPlayerWrap.find('.lrc_menu_wrap'),
  $lrcFootWrap = $musicPlayerWrap.find('.lrc_foot_wrap'),
  $lrcProgressBar = $lrcFootWrap.find('.progress_bar'),
  $lrcFootBtnWrap = $lrcFootWrap.find('.foot_btn_wrap'),
  $playingListWrap = $musicPlayerWrap.find('.playing_list_mask'),
  $pMusicListBox = $playingListWrap.find('.p_music_list_wrap'),
  $musicMvWrap = $('.music_mv_wrap'),
  $myVideo = $musicMvWrap.find('.my_video');
$myAudio[0].preload = 'none';
if (!shareId) {
  pageErr();
}
if (!isIframe()) {
  waitLogin(() => {
    // 同步数据
    realtime.init().add((res) => {
      res.forEach((item) => {
        otherWindowMsg(item);
      });
    });
  });
}
const lrcHeadContentScrollName = new ContentScroll(
  $lrcHead.find('.song_name div')[0]
);
const lrcHeadContentScrollArtist = new ContentScroll(
  $lrcHead.find('.artist_name div')[0]
);
const defaultTitle = document.title;
let playingList = null,
  curPlayingList = null,
  playingSongInfo = null,
  curPlaySpeed = localData.get('songPlaySpeed'),
  lrcState = localData.get('lrcState'),
  mediaVolume = localData.get('mediaVolume'),
  userInfo = null,
  passCode = localData.session.get('passCode', shareId) || '',
  shareToken = '';
let defaultShareTitle = '';
const verifyCode = hdOnce(() => {
  enterPassCode(({ close, val, loading }) => {
    passCode = val;
    getShareData(close, loading);
  });
});
function adjustVolume(e) {
  rMenu.percentBar(e, mediaVolume, function (per) {
    mediaVolume = per;
    setPlayVolume();
  });
}
export function setPlayVolume() {
  $myAudio[0].volume = mediaVolume;
  $myVideo[0].volume = mediaVolume;
  localData.set('mediaVolume', mediaVolume, 200);

  $lrcMenuWrap
    .find('.volume_btn')
    .attr('class', `volume_btn iconfont ${getVolumeIcon(mediaVolume)}`);
}
setPlayVolume();
export function getVolumeIcon(mediaVolume) {
  let icon = '';
  if (mediaVolume <= 0) {
    icon = 'icon-24gl-volumeCross';
  } else if (mediaVolume < 0.2) {
    icon = 'icon-24gl-volumeZero';
  } else if (mediaVolume < 0.5) {
    icon = 'icon-24gl-volumeLow';
  } else if (mediaVolume < 0.8) {
    icon = 'icon-24gl-volumeMiddle';
  } else {
    icon = 'icon-24gl-volumeHigh';
  }

  return icon;
}
// 获取分享数据
function getShareData(close, loading = { start() {}, end() {} }) {
  loading.start();
  reqPlayerGetShare({ id: shareId, pass: passCode })
    .then((resObj) => {
      loading.end();
      if (resObj.code === 1) {
        localData.session.set('passCode', passCode, shareId);
        close && close();
        const { account, username, logo, title, exp_time, email, token } =
          resObj.data;
        defaultShareTitle = title;
        shareToken = token;
        userInfo = { account, username, email };
        if (logo) {
          imgjz(getStaticPath(`/logo/${account}/${logo}`))
            .then((cache) => {
              $lrcHead
                .find('.user_logo')
                .css('background-image', `url(${cache})`);
            })
            .catch(() => {
              $lrcHead
                .find('.user_logo')
                .css('background-image', `url(${getTextImg(username)})`);
            });
        } else {
          $lrcHead
            .find('.user_logo')
            .css('background-image', `url(${getTextImg(username)})`);
        }
        $userInfo.find('.from').text(username);
        $userInfo.find('.title').text(title);
        $userInfo.find('.valid').text(
          exp_time === 0
            ? '永久'
            : formatDate({
                template: '{0}-{1}-{2} {3}:{4}',
                timestamp: exp_time,
              })
        );

        playingList = resObj.data.data;
        curPlayingList = deepClone(playingList);
        const pSongInfo = localData.session.get('playingSongInfo');
        if (pSongInfo) {
          playingSongInfo = initSongInfo(
            playingList.find((item) => item.id === pSongInfo.id) ||
              playingList[0]
          );
        } else {
          playingSongInfo = initSongInfo(playingList[0]);
        }
        toggleMvBtnState();
        updateSongInfo();
        $lrcProgressBar
          .find('.total_time')
          .text(formartSongTime(playingSongInfo.duration));
      } else if (resObj.code === 3) {
        if (passCode) {
          _msg.error('提取码错误');
        }
        verifyCode();
      }
    })
    .catch(() => {
      loading.end();
      $musicPlayerWrap.css('display', 'none');
    });
}
getShareData();
$lrcHead.on('click', '.user_logo', (e) => {
  const { account, username, email } = userInfo;
  userLogoMenu(e, account, username, email);
});
// 更新mv按钮状态
function toggleMvBtnState() {
  if (playingSongInfo && playingSongInfo.mv) {
    $lrcMenuWrap.find('.play_mv_btn').stop().show(_d.speed);
  } else {
    $lrcMenuWrap.find('.play_mv_btn').stop().hide(_d.speed);
  }
}
// 处理音乐信息
function initSongInfo(obj) {
  obj = deepClone(obj);
  obj.ppic =
    getFilePath(`sharemusic/${obj.id}/${obj.pic}`) +
    `&token=${encodeURIComponent(shareToken)}`;
  obj.uurl =
    getFilePath(`sharemusic/${obj.id}/${obj.url}`) +
    `&token=${encodeURIComponent(shareToken)}`;
  obj.mmv =
    getFilePath(`sharemusic/${obj.id}/${obj.mv}`) +
    `&token=${encodeURIComponent(shareToken)}`;
  return obj;
}
// 更新音乐信息
async function updateSongInfo() {
  if (!playingSongInfo) return;
  const id = playingSongInfo.id;
  lrcHeadContentScrollName.init(playingSongInfo.title);
  lrcHeadContentScrollArtist.init(playingSongInfo.artist);
  $myAudio.attr('src', playingSongInfo.uurl);
  loadImg(playingSongInfo.ppic)
    .then(() => {
      if (id !== playingSongInfo.id) return;
      $lrcBg
        .css('background-image', `url("${playingSongInfo.ppic}")`)
        .removeClass('lrcbgss');
      _setTimeout(() => {
        if (id !== playingSongInfo.id) return;
        notifyMusicControlPanel.updateMetadata({
          title: playingSongInfo.title,
          artist: playingSongInfo.artist,
          album: playingSongInfo.album,
          artwork: [{ src: playingSongInfo.ppic }],
        });
      }, 1000);
    })
    .catch(() => {
      if (id !== playingSongInfo.id) return;
      $lrcBg.css('background-image', `url(${imgMusic})`).removeClass('lrcbgss');
      _setTimeout(() => {
        if (id !== playingSongInfo.id) return;
        notifyMusicControlPanel.updateMetadata({
          title: playingSongInfo.title,
          artist: playingSongInfo.artist,
          album: playingSongInfo.album,
          artwork: [{ src: imgMusic }],
        });
      }, 1000);
    });
}
// 初始歌词
function lrcInit() {
  $myAudio._lrcList = [];
  $myAudio.curLrcIdx = 0;
  $lrcListWrap.find('.lrc_items').html('');
}
let songPlayMode = 'order';
// 切换播放模式
function changePlayMode() {
  let text = '';
  let icon = '';
  switch (songPlayMode) {
    case 'order':
      {
        songPlayMode = 'random';
        $myAudio.attr('loop', null);
        icon = 'iconfont icon-suiji';
        text = '随机播放';
        curPlayingList = myShuffle(deepClone(playingList));
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
        curPlayingList = deepClone(playingList);
      }
      break;
  }
  $lrcFootBtnWrap
    .find('.random_play_btn')
    .attr('class', `random_play_btn ${icon}`);
  _msg.msg({ message: text, icon });
}
function getNextSongInfo() {
  let index = curPlayingList.findIndex((x) => x.id === playingSongInfo.id);
  index++;
  index > curPlayingList.length - 1 ? (index = 0) : null;
  return curPlayingList[index] || {};
}
function getPrevSongInfo() {
  let index = curPlayingList.findIndex((x) => x.id === playingSongInfo.id);
  index--;
  index < 0 ? (index = curPlayingList.length - 1) : null;
  return curPlayingList[index] || {};
}
// 上一曲
function playPrevSong() {
  if (curPlayingList.length === 0) {
    _msg.error('播放列表为空');
    pauseSong();
    return;
  }
  musicPlay(getPrevSongInfo());
}
// 下一曲
function playNextSong() {
  $lrcProgressBar.find('.pro2').width('0');
  if (curPlayingList.length === 0) {
    _msg.error('播放列表为空');
    pauseSong();
    return;
  }
  musicPlay(getNextSongInfo());
}
function showWillPlaySongInfo(type) {
  const { artist, title } =
    type === 'next' ? getNextSongInfo() : getPrevSongInfo();
  let str = '播放列表为空';
  if (artist && title) {
    str = `${type === 'next' ? '下一曲' : '上一曲'}：${artist} - ${title}`;
  }
  toolTip.setTip(str).show();
}
// 播放状态
$lrcFootBtnWrap
  .on('click', '.random_play_btn', changePlayMode)
  .on('click', '.playing_list_btn', function () {
    playListLoading();
    $playingListWrap.stop().fadeIn(100, () => {
      $pMusicListBox.stop().slideDown(_d.speed, () => {
        const idx = playingList.findIndex((v) => playingSongInfo.id === v.id);
        if (idx >= 0) {
          playingPageNum = Math.ceil((idx + 1) / playingSize);
        } else {
          playingPageNum = 1;
        }
        renderPlayList();
        playingListHighlight(true);
      });
    });
  })
  .on('click', '.prev_play_btn', () => {
    playPrevSong();
    showWillPlaySongInfo('prev');
  })
  .on('mouseenter', '.prev_play_btn', showWillPlaySongInfo.bind(null, 'prev'))
  .on('mouseleave', '.prev_play_btn', toolTip.hide)
  .on('click', '.next_play', () => {
    playNextSong();
    showWillPlaySongInfo('next');
  })
  .on('mouseenter', '.next_play', showWillPlaySongInfo.bind(null, 'next'))
  .on('mouseleave', '.next_play', toolTip.hide)
  .on('click', '.play_btn', playState);
// 播放状态
function playState() {
  if ($myAudio[0].paused) {
    playSong();
  } else {
    pauseSong();
  }
}
// 播放歌曲
function musicPlay(obj) {
  $myAudio[0].currentTime = 0; //时间进度归零
  playingSongInfo = initSongInfo(obj); //初始化音乐数据
  localData.session.set('playingSongInfo', playingSongInfo);
  const songText = `${playingSongInfo.artist} - ${playingSongInfo.title}`;
  $lrcProgressBar
    .find('.total_time')
    .text(formartSongTime(playingSongInfo.duration));
  _msg.msg({ message: songText, icon: 'iconfont icon-yinle1' });
  playingListHighlight(false);
  $lrcBg.addClass('lrcbgss'); //背景透明
  updateSongInfo();
  lrcInit();
  toggleMvBtnState();
  playSong();
}
const musicMvContentScroll = new ContentScroll(
  $musicMvWrap.find('.m_top_space p')[0]
);
// MV播放
function playMv(obj) {
  const mvBox = $musicMvWrap[0];
  const isHide = $musicMvWrap.is(':hidden');
  $musicMvWrap.css('display', 'flex');
  playingSongInfo = initSongInfo(obj);
  localData.session.set('playingSongInfo', playingSongInfo);
  updateSongInfo();
  pauseSong();
  $myVideo.attr('src', playingSongInfo.mmv);
  toggleMvBtnState();
  playVideo();
  if (!$musicMvWrap.once) {
    $musicMvWrap.once = true;
    toSetSize(mvBox, 600, 600);
    toCenter(mvBox);
  } else {
    myToRest(mvBox, false, false);
  }
  if (isHide) {
    _animate(mvBox, {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
      direction: 'reverse',
    });
  }
  musicMvContentScroll.init(
    `${playingSongInfo.artist} - ${playingSongInfo.title}`
  );
  playingListHighlight(false);
  lrcInit();
  $myVideo[0].playbackRate = curPlaySpeed[1];
}
$myVideo
  .on('error', function () {
    _msg.error(`MV 加载失败`);
  })
  .on('timeupdate', initRainCodeSleep);
function pauseVideo() {
  $myVideo[0].pause();
}
function playVideo() {
  pauseSong();
  $myVideo[0].play();
}
// 暂停
function pauseSong() {
  $myAudio[0].pause();
  document.title = defaultTitle;
  $lrcProgressBar.find('.dolt').css('animation-play-state', 'paused');
  $lrcFootBtnWrap
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'none');
}
// 播放
function playSong() {
  pauseVideo();
  if (!$musicMvWrap.is(':hidden')) {
    _animate(
      $musicMvWrap[0],
      {
        to: {
          transform: `translateY(100%) scale(0)`,
          opacity: 0,
        },
      },
      (target) => {
        target.style.display = 'none';
      }
    );
    musicMvContentScroll.close();
  }
  if (!playingSongInfo) return;
  document.title = `\xa0\xa0\xa0♪正在播放：${playingSongInfo.artist} - ${playingSongInfo.title}`;
  $myAudio[0].play();
  if ($myAudio._lrcList.length === 0) {
    musiclrc();
  }
  //保持播放速度
  $myAudio[0].playbackRate = curPlaySpeed[1];
}
//歌词处理
$myAudio._lrcList = [];
function musiclrc() {
  if (!playingSongInfo) return;
  const id = playingSongInfo.id;
  reqPlayerLrc({
    id,
    token: shareToken,
  })
    .then((result) => {
      if (result.code === 1) {
        let list = result.data;
        if (id !== playingSongInfo.id) return;
        list = list.map((item, idx) => {
          item.idx = idx;
          return item;
        });
        $myAudio._lrcList = list;
        let hasfy = !list.every((item) => item.fy === '');
        if (hasfy) {
          $lrcMenuWrap.find('.lrc_translate_btn').stop().show(_d.speed);
        } else {
          $lrcMenuWrap.find('.lrc_translate_btn').stop().hide(_d.speed);
        }
        const showFy =
          localData.get('showSongTranslation') && hasfy ? true : false;
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
        setActionLrcIndex();
        lrcScroll(true);
      }
    })
    .catch(() => {
      $myAudio._lrcList = [];
    });
}
// 设置最接近播放进度的歌词索引
function setActionLrcIndex() {
  const cTime = Math.round($myAudio[0].currentTime);
  $myAudio.curLrcIdx = getMinIndex(
    $myAudio._lrcList.map((item) => Math.abs(cTime - item.t))
  );
}
// 滚动歌词
function lrcScroll(immedia) {
  const $lrc = $lrcListWrap.find('.lrc_items');
  if ($myAudio._lrcList.length === 0) return;
  const $lrcdiv = $lrc.children('div'),
    $activediv = $lrcdiv.eq($myAudio.curLrcIdx),
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
      transition: 'transform 0.3s ease-in-out',
      transform: `translateY(${mtop}px)`,
    });
  }
}
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
const upprog = throttle(function () {
  $lrcProgressBar
    .find('.current_time')
    .text(formartSongTime($myAudio[0].currentTime));
  proTime($myAudio[0].currentTime / playingSongInfo.duration, true);
}, 500);
// 音乐事件
let lrcCount = -1; //歌词计数
$myAudio
  .on('loadedmetadata', function () {
    //元数据加载完
  })
  .on('waiting', function () {
    //缺少数据加载效果
    if ($myAudio[0].paused) return;
    $lrcProgressBar
      .find('.dolt')
      .css('animation', 'bgcolor .3s infinite linear alternate');
    $lrcFootBtnWrap
      .find('.play_btn')
      .attr('class', 'play_btn iconfont icon-65zanting')
      .css('animation', 'fontcolor .5s infinite linear alternate');
  })
  .on('playing', function () {
    //准备开始播放
    if ($myAudio[0].paused) return;
    $lrcProgressBar
      .find('.dolt')
      .css('animation', 'bgcolor 2s infinite linear alternate');
    $lrcFootBtnWrap
      .find('.play_btn')
      .attr('class', 'play_btn iconfont icon-zanting')
      .css('animation', 'none');
  })
  .on('error', function () {
    _msg.error('歌曲加载失败');
    pauseSong();
  })
  .on('ended', function () {
    if (songPlayMode === 'loop') return;
    playNextSong();
  })
  .on('timeupdate', function () {
    if ($myAudio[0].paused) return;
    const curTime = Math.round(this.currentTime);
    upprog();
    if ($myAudio._flag === curTime) return;
    const list = $myAudio._lrcList || [];
    list
      .filter((item) => item.t === curTime)
      .forEach((item) => {
        lrcCount++;
        $myAudio._flag = curTime;
        _setTimeout(() => {
          $myAudio.curLrcIdx = item.idx;
          lrcCount--;
          if (lrcCount > 0) {
            lrcScroll(true);
          } else {
            lrcScroll();
          }
        }, lrcCount * 100);
      });
  });
notifyMusicControlPanel
  .bind('play', playSong)
  .bind('pause', pauseSong)
  .bind('previoustrack', playPrevSong)
  .bind('nexttrack', playNextSong)
  .bind('seekbackward', () => {
    $myAudio[0].currentTime = Math.max($myAudio[0].currentTime - 10, 0);
  })
  .bind('seekforward', () => {
    $myAudio[0].currentTime = Math.min(
      $myAudio[0].currentTime + 10,
      playingSongInfo.duration
    );
  });
//进度条
$lrcProgressBar
  .find('.probox')
  .on('mousemove', function (e) {
    const x = e.clientX,
      left = pro1.offsetLeft + $musicPlayerWrap[0].offsetLeft,
      percent = (x - left) / pro1.offsetWidth,
      time = playingSongInfo.duration * percent,
      idx = getMinIndex(
        $myAudio._lrcList.map((item) => Math.abs(time - item.t))
      ),
      lrc = $myAudio._lrcList[idx];
    let str = formartSongTime(time);
    if (lrc) {
      str += `${lrc.p ? `\n${lrc.p}` : ''}${
        localData.get('showSongTranslation') && lrc.fy ? `\n${lrc.fy}` : ''
      }`;
    }
    toolTip.setTip(str).show();
  })
  .on('mouseleave', function () {
    toolTip.hide();
  });
const probox = $lrcProgressBar.find('.probox')[0],
  pro1 = $lrcProgressBar.find('.pro1')[0],
  pro2 = $lrcProgressBar.find('.pro2')[0],
  dolt = $lrcProgressBar.find('.dolt')[0];
function proTime(percent, y) {
  percent <= 0 ? (percent = 0) : percent >= 1 ? (percent = 1) : null;
  const val =
    (pro1.offsetWidth - dolt.offsetWidth) * percent +
    dolt.offsetWidth / 2 +
    'px';
  const per = percent * 100 + '%';
  if (dolt.offsetWidth) {
    pro2.style.width = val;
  } else {
    pro2.style.width = per;
  }
  if (!y) {
    $myAudio[0].currentTime = percent * playingSongInfo.duration;
  }
}
// 进度条处理
probox.addEventListener('touchstart', function (e) {
  $lrcProgressBar.find('.dolt').addClass('open');
  $lrcProgressBar.find('.pro1').addClass('open');
  let percent;
  mmove(e);
  function mmove(e) {
    e.preventDefault();
    const ev = e.targetTouches[0];
    const left = pro1.offsetLeft + $musicPlayerWrap[0].offsetLeft;
    const doltW = dolt.offsetWidth;
    percent = (ev.clientX - left - doltW / 2) / (pro1.offsetWidth - doltW);
    proTime(percent);
  }
  function mend() {
    setActionLrcIndex();
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
    const left = pro1.offsetLeft + $musicPlayerWrap[0].offsetLeft;
    const doltW = dolt.offsetWidth;
    percent = (e.clientX - left - doltW / 2) / (pro1.offsetWidth - doltW);
    proTime(percent);
  }
  function mup() {
    setActionLrcIndex();
    lrcScroll();
    document.removeEventListener('mousemove', mmove);
    document.removeEventListener('mouseup', mup);
  }
  document.addEventListener('mousemove', mmove);
  document.addEventListener('mouseup', mup);
});
document.onkeydown = function (e) {
  let key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key === 'ArrowLeft') playPrevSong();
  if (ctrl && key === 'ArrowRight') playNextSong();
  //暂停/播放
  if (key === ' ') {
    if ($musicMvWrap.is(':hidden')) {
      playState();
    } else {
      if ($myVideo[0].paused) {
        playVideo();
      } else {
        pauseVideo();
      }
    }
  }
};
//隐藏播放列表
$playingListWrap.on('click', function (e) {
  if (_getTarget(this, e, '.playing_list_mask', 1)) {
    $pMusicListBox.stop().slideUp(_d.speed, () => {
      $pMusicListBox.find('.p_foot').html('');
      $playingListWrap.stop().fadeOut(100);
    });
  }
});
function playListLoading() {
  let str = ``;
  new Array(10).fill(null).forEach(() => {
    str += `<li style="pointer-events: none;margin: 0.2rem 0;" class = "song_item"></li>`;
  });
  $pMusicListBox.find('.p_foot').html(str);
}
let playingPageNum = 1;
let playingSize = 100;
// 生成播放列表
function renderPlayList() {
  if ($pMusicListBox.is(':hidden')) return;
  if (!playingList || playingList.length === 0) {
    $pMusicListBox.find('.left').text(`正在播放(0)`);
    $pMusicListBox
      .find('.p_foot')
      .html(
        _tpl(
          `<p style="padding: 2rem 0;text-align: center;pointer-events: none;">{{_d.emptyList}}</p>`,
          { _d }
        )
      );
    return;
  }
  $pMusicListBox.find('.left').text(`正在播放(${playingList.length})`);
  const totalPage = Math.ceil(playingList.length / playingSize);
  playingPageNum < 1
    ? (playingPageNum = totalPage)
    : playingPageNum > totalPage
    ? (playingPageNum = 1)
    : null;
  const arr = playingList.slice(
    (playingPageNum - 1) * playingSize,
    playingPageNum * playingSize
  );
  const html = _tpl(
    `
    <li v-for="{title,artist,mv,id,pic} in arr" class="song_item" cursor="y" :data-id="id">
      <div class="logo_wrap">
        <div class="logo" :data-src="getPath(id,pic)">
          <div class="play_gif"></div>
        </div>
      </div>
      <div class="song_info_wrap">
        <span class = "song_name">{{title}}</span>
        <span class="artist_name"><i class="artist_name_text">{{artist}}</i></span>
      </div>
      <div v-if="mv" class="play_mv iconfont icon-shipin2"></div>
      <div cursor="y" class="del iconfont icon-close-bold"></div>
    </li>
    <div v-html="getPaging()" style="padding:2rem 0;text-align:center;" class="playing_list_paging no_select"></div>
    `,
    {
      arr,
      getPath(id, pic) {
        return (
          getFilePath(`sharemusic/${id}/${pic}`, 1) +
          `&token=${encodeURIComponent(shareToken)}`
        );
      },
      getPaging() {
        return pgnt.getHTML({
          pageNo: playingPageNum,
          total: playingList.length,
        });
      },
    }
  );
  $pMusicListBox.find('.p_foot').html(html);
  const logos = [
    ...$pMusicListBox.find('.p_foot')[0].querySelectorAll('.logo'),
  ].filter((item) => {
    const $img = $(item);
    const u = $img.attr('data-src');
    const cache = imgCache.get(u);
    if (cache) {
      $img.css('background-image', `url(${cache})`).addClass('load');
    }
    return !cache;
  });
  lazyImg.bind(logos, (item) => {
    const $img = $(item);
    const u = $img.attr('data-src');
    loadImg(u)
      .then(() => {
        $img.css('background-image', `url(${u})`).addClass('load');
        imgCache.add(u, u);
      })
      .catch(() => {
        $img.css('background-image', `url(${imgMusic})`).addClass('load');
      });
  });
}
// 分页
const pgnt = pagination($pMusicListBox[0], {
  pageSize: playingSize,
  small: true,
  showTotal: false,
  select: [],
  toTop: false,
  change(val) {
    playingPageNum = val;
    $pMusicListBox.find('.p_foot')[0].scrollTop = 0;
    renderPlayList();
    playingListHighlight();
  },
});
const lazyImg = new LazyLoad();
// 保存歌单
$pMusicListBox.on('click', '.save_playing_list', function (e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: '歌单名称',
          value: defaultShareTitle,
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLength.title) {
              return '名称过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      loading.start();
      reqPlayerSaveShare({ name: inp.name, token: shareToken })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            _msg.success(res.codeText);
            close();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '保存歌单'
  );
});
function getPlayingListItem(id) {
  return playingList.find((item) => item.id === id) || {};
}
$pMusicListBox
  .find('.p_foot')
  .on('click', '.song_info_wrap', function () {
    const $this = $(this).parent();
    const obj = getPlayingListItem($this.attr('data-id'));
    if (playingSongInfo.id === obj.id) {
      playState();
      return;
    }
    musicPlay(obj);
  })
  .on('click', '.play_mv', function (e) {
    e.stopPropagation();
    const $this = $(this).parent();
    const sobj = getPlayingListItem($this.attr('data-id'));
    playMv(sobj);
  })
  .on('mouseenter', '.song_item .logo_wrap', function () {
    const {
      title,
      artist,
      album,
      year,
      duration,
      create_at,
      play_count,
      collect_count,
    } = getPlayingListItem($(this).parent().attr('data-id'));
    const str = `歌曲：${title || '--'}\n歌手：${artist || '--'}\n专辑：${
      album || '--'
    }\n发布年份：${year || '--'}\n时长：${formartSongTime(
      duration
    )}\n播放量：${formatNum(play_count)}\n收藏量：${formatNum(
      collect_count
    )}\n添加时间：${formatDate({
      template: `{0}-{1}-{2}`,
      timestamp: create_at,
    })}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.song_item .logo_wrap', function () {
    toolTip.hide();
  })
  .on('click', '.del', function (e) {
    e.stopPropagation();
    const $this = $(this),
      id = $this.parent().attr('data-id');
    playingList = playingList.filter((v) => v.id !== id);
    curPlayingList = curPlayingList.filter((v) => v.id !== id);
    renderPlayList();
    playingListHighlight();
  })
  .on('click', '.logo_wrap', function (e) {
    const $this = $(this).parent();
    showSongInfo(e, getPlayingListItem($this.attr('data-id')), shareToken);
  });
// 高亮正在播放歌曲
function playingListHighlight(a) {
  if ($pMusicListBox.is(':hidden') || !playingSongInfo || !playingList) return;
  const $song_item = $pMusicListBox.find('.p_foot').find('.song_item');
  $song_item.removeClass('active').find('.play_gif').removeClass('show');
  const y = Array.prototype.findIndex.call(
    $song_item,
    (item) => item.dataset.id === playingSongInfo.id
  );
  if (y < 0) return;
  const cur = $song_item.eq(y);
  if (a) {
    const sp = $pMusicListBox.find('.p_foot').scrollTop() + cur.position().top;
    $pMusicListBox.find('.p_foot').scrollTop(sp);
  }
  cur.addClass('active').find('.play_gif').addClass('show');
}
myDrag({
  trigger: $musicMvWrap.find('.m_top_space')[0],
  target: $musicMvWrap[0],
  down({ target }) {
    target.style.transition = '0s';
  },
  dblclick({ target }) {
    if (isFullScreen(target)) {
      myToRest(target);
    } else {
      myToMax(target);
    }
  },
  up({ target, x, y, pointerX }) {
    const { h, w } = getScreenSize();
    if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
      myToMax(target);
    } else {
      savePopLocationInfo(target, { x, y });
      myToRest(target, pointerX);
    }
  },
});
myResize({
  target: $musicMvWrap[0],
  down({ target }) {
    target.style.transition = '0s';
  },
  up({ target, x, y }) {
    savePopLocationInfo(target, {
      x,
      y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    });
  },
});
$lrcMenuWrap
  .on('click', '.play_mv_btn', function (e) {
    e.stopPropagation();
    if (!playingSongInfo) return;
    playMv(playingSongInfo);
  })
  .on('click', '.lrc_translate_btn', () => {
    let showfy = localData.get('showSongTranslation');
    if (showfy) {
      $lrcListWrap.find('.lrc_items .lrcfy').css('display', 'none');
    } else {
      $lrcListWrap.find('.lrc_items .lrcfy').css('display', 'block');
    }
    lrcScroll(true);
    showfy = !showfy;
    localData.set('showSongTranslation', showfy);
  })
  .on('click', '.set_lrc_btn', function (e) {
    const data = [
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
        id: '10',
        text: '下载',
        beforeIcon: 'iconfont icon-download',
      },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ e, close, id, loading }) => {
        if (id === '1') {
          close();
          let { size } = lrcState;
          rMenu.percentBar(e, size, (percent) => {
            $lrcListWrap.find('.lrc_items').css({
              'font-size': percentToValue(14, 30, percent) + 'px',
            });
            lrcState.size = percent;
            localData.set('lrcState', lrcState, 200);
            lrcScroll(true);
          });
        } else if (id === '2') {
          close();
          lrcState.position = 'left';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'left',
          });
          localData.set('lrcState', lrcState);
        } else if (id === '3') {
          close();
          lrcState.position = 'center';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'center',
          });
          localData.set('lrcState', lrcState);
        } else if (id === '4') {
          close();
          lrcState.position = 'right';
          $lrcListWrap.find('.lrc_items').css({
            'text-align': 'right',
          });
          localData.set('lrcState', lrcState);
        } else if (id === '6') {
          close();
          let u1 = playingSongInfo.ppic;
          imgPreview(
            [
              {
                u1,
                u2: u1 + '?t=1',
              },
            ],
            0,
            { x: e.clientX, y: e.clientY }
          );
        } else if (id === '7') {
          close();
          copyText(playingSongInfo.artist + ' - ' + playingSongInfo.title);
        } else if (id === '8') {
          showSongInfo(e, playingSongInfo, shareToken, loading);
        } else if (id === '10') {
          close();
          let fname = `${playingSongInfo.artist}-${playingSongInfo.title}`;
          downloadFile([
            {
              fileUrl: playingSongInfo.uurl,
              filename: `${fname}.${_path.extname(playingSongInfo.url)[2]}`,
            },
          ]);
        }
      },
      playingSongInfo.artist + ' - ' + playingSongInfo.title
    );
  })
  .on('click', '.volume_btn', adjustVolume)
  .on('click', '.play_speed_btn', function (e) {
    const data = [];
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
          let { a, b } = param;
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
          localData.set('songPlaySpeed', curPlaySpeed);
          _msg.msg({ message: b + 'X', icon: 'iconfont icon-sudu' });
        }
      },
      '歌曲播放速度'
    );
  })
  .find('.play_speed_btn')
  .text(curPlaySpeed[0]);
(function hdScrollTitle() {
  if (!$myAudio[0].paused) {
    const title = document.title;
    const first = title.charAt(0),
      other = title.substring(1);
    document.title = other + first;
  }
  _setTimeout(hdScrollTitle, 1000);
})();
//桌面大小改变自适应
let dmwidth = window.innerWidth;
window.addEventListener(
  'resize',
  throttle(function () {
    dmwidth = window.innerWidth;
  }, 1000)
);
$musicMvWrap.on('click', '.m_close', function () {
  pauseVideo();
  _animate(
    $musicMvWrap[0],
    {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
    }
  );

  musicMvContentScroll.close();
});
// 播放列表
_mySlide({
  el: '.playing_list_mask',
  right() {
    $pMusicListBox.stop().slideUp(_d.speed, () => {
      $pMusicListBox.find('.p_foot').html('');
      $playingListWrap.stop().fadeOut(100);
    });
  },
});
_mySlide({
  el: '.video_box',
  right(e) {
    if (_getTarget(this, e, '.video_box', 1)) {
      $musicMvWrap.find('.m_close').click();
    }
  },
});
// 歌词
_mySlide({
  el: '.lrc_box',
  right(e) {
    if (_getTarget(this, e, '.lrc_foot_wrap')) return;
    playPrevSong();
  },
  left(e) {
    if (_getTarget(this, e, '.lrc_foot_wrap')) return;
    playNextSong();
  },
});
// 定时触发
function zidonghide(timemax, el, ell, fn, fn2, fel) {
  let time = timemax,
    timer = null;
  function fun() {
    time--;
    if (time <= 0) {
      fn2();
      return;
    }
    timer = _setTimeout(fun, 1000);
  }
  $(el)
    .on('mouseup touchstart mousemove', function (e) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      time = timemax;
      if (!_getTarget(this, e, fel)) {
        fn();
      }
      if (_getTarget(this, e, ell) && dmwidth > _d.screen) return;
      fun();
    })
    .on('mouseleave', function () {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      fn2();
    });
}
zidonghide(
  10,
  '.lrc_box',
  '.lrc_foot_wrap',
  debounce(
    function () {
      $lrcFootWrap.stop().slideDown(_d.speed, () => {
        $lrcFootWrap._flag = 'y';
        lrcScroll();
      });
    },
    500,
    true
  ),
  debounce(
    function () {
      $lrcFootWrap.stop().slideUp(_d.speed, () => {
        $lrcFootWrap._flag = 'n';
        lrcScroll();
      });
    },
    500,
    true
  ),
  '.lrc_menu_wrap'
);
