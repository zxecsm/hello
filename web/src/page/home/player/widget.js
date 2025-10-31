import $ from 'jquery';
import _d from '../../../js/common/config';
import { popWindow, setZidx } from '../popWindow';
import {
  ContentScroll,
  _animate,
  _getTarget,
  debounce,
  getScreenSize,
  getTextSize,
  isFullScreen,
  isMobile,
  isRoot,
  myDrag,
  myResize,
  myToMax,
  myToRest,
  savePopLocationInfo,
  toCenter,
  toSetSize,
} from '../../../js/utils/utils';
import _msg from '../../../js/plugins/message';
import {
  changePlayState,
  hdSongInfo,
  initMusicLrc,
  pauseSong,
  playNextSong,
  playPrevSong,
  setCurPlaySpeed,
  setPlayingSongInfo,
  showWillPlaySongInfo,
  toggleLrcMenuWrapBtnsState,
} from './lrc';
import {
  highlightPlayingSong,
  showMusicPlayerBox,
  updateSongInfo,
} from './index';
import { reqPlayerEditLrc, reqPlayerReadLrc } from '../../../api/player';
import { playingListHighlight } from './playlist';
import { updateLastPlay } from '../timer';
import { hideIframeMask, showIframeMask } from '../iframe';
import { _tpl, deepClone } from '../../../js/utils/template';
import { initRainCodeSleep } from '../../../js/common/codeRain';
import cacheFile from '../../../js/utils/cacheFile';
import toolTip from '../../../js/plugins/tooltip';
import localData from '../../../js/common/localData';

const $miniPlayer = $('.mini_player'),
  $miniLrcWrap = $('.mini_lrc_wrap'),
  $editLrcWrap = $('.edit_lrc_wrap'),
  $musicMvWrap = $('.music_mv_wrap'),
  $myVideo = $musicMvWrap.find('.my_video');
let miniPlayerCoord = localData.get('miniPlayerCoord'),
  miniLrcCoord = localData.get('miniLrcCoord'),
  mvIsTop = localData.get('mvIsTop'),
  editLrcIsTop = localData.get('editLrcIsTop');
// 显示/隐藏迷你播放器
export function showMiniPlayer() {
  $miniPlayer.stop().show(_d.speed);
  const { left, top } = miniPlayerCoord;
  const { w, h } = getScreenSize();
  // 超出屏幕恢复默认
  if (left > w || top > h) {
    $miniPlayer[0].style.left = '';
    $miniPlayer[0].style.top = '';
  }
  setZidx($miniPlayer[0], 0, 0, miniPlayerCoord.isTop);
}
function switchMiniPlayerTopState() {
  miniPlayerCoord.isTop = !miniPlayerCoord.isTop;
  setTop($miniPlayer, miniPlayerCoord.isTop);
  localData.set('miniPlayerCoord', miniPlayerCoord);
  setZidx($miniPlayer[0], 0, 0, miniPlayerCoord.isTop);
}
function switchMvTopState() {
  mvIsTop = !mvIsTop;
  setTop($musicMvWrap, mvIsTop);
  localData.set('mvIsTop', mvIsTop);
  setZidx($musicMvWrap[0], 'mv', closeMvBox, mvIsTop);
}
function switchEditLrcTopState() {
  editLrcIsTop = !editLrcIsTop;
  setTop($editLrcWrap, editLrcIsTop);
  localData.set('editLrcIsTop', editLrcIsTop);
  setZidx($editLrcWrap[0], 'editlrc', closeEditLrcBox, editLrcIsTop);
}
function switchMiniLrcTopState() {
  miniLrcCoord.isTop = !miniLrcCoord.isTop;
  setTop($miniLrcWrap, miniLrcCoord.isTop);
  localData.set('miniLrcCoord', miniLrcCoord);
  setZidx($miniLrcWrap[0], 0, 0, miniLrcCoord.isTop);
}
setTop($miniLrcWrap, miniLrcCoord.isTop);
setTop($editLrcWrap, editLrcIsTop);
setTop($musicMvWrap, mvIsTop);
setTop($miniPlayer, miniPlayerCoord.isTop);
function setTop(el, isTop) {
  if (isTop) {
    el.find('.top').attr('class', 'top iconfont icon-zhiding1');
  } else {
    el.find('.top').attr('class', 'top iconfont icon-zhiding');
  }
}
export function hideMiniPlayer() {
  $miniPlayer.stop().hide(_d.speed);
}
// MV是隐藏
export function musicMvIsHide() {
  return $musicMvWrap.is(':hidden');
}
// mv是暂停
export function mvIspaused() {
  return $myVideo[0].paused;
}
// 显示/隐藏迷你歌词
export function showMiniLrcBox(once) {
  if (once && $miniLrcWrap._isone) return;
  $miniLrcWrap.stop().fadeIn(_d.speed);
  const { left, top } = miniLrcCoord;
  const { w, h } = getScreenSize();
  // 超出屏幕恢复默认
  if (left > w || top > h) {
    miniLrcCoord = localData.defaultData.miniLrcCoord;
    $miniLrcWrap[0].style.left = miniLrcCoord.left + 'px';
    $miniLrcWrap[0].style.top = miniLrcCoord.top + 'px';
  }
  setZidx($miniLrcWrap[0], 0, 0, miniLrcCoord.isTop);
}
export function hideMiniLrcBox() {
  $miniLrcWrap.stop().fadeOut(_d.speed);
}
// 更换背景
export function changeMiniPlayerBg(url) {
  $miniPlayer.css('background-image', `url("${url}")`);
}
// 设置MV音量
export function setMvplayVolume(value) {
  $myVideo[0].volume = value;
}
$miniLrcWrap
  .on('click', '.close', function () {
    hideMiniLrcBox();
    $miniLrcWrap._isone = true;
  })
  .on('click', '.top', switchMiniLrcTopState);
$miniPlayer
  .on('click', '.play_btn', changePlayState)
  .on('click', '.next_btn', () => {
    playNextSong();
    showWillPlaySongInfo('next');
  })
  .on('mouseenter', '.next_btn', showWillPlaySongInfo.bind(null, 'next'))
  .on('mouseleave', '.next_btn', toolTip.hide)
  .on('click', '.prev_btn', () => {
    playPrevSong();
    showWillPlaySongInfo('prev');
  })
  .on('mouseenter', '.prev_btn', showWillPlaySongInfo.bind(null, 'prev'))
  .on('mouseleave', '.prev_btn', toolTip.hide)
  .on('click', '.top', switchMiniPlayerTopState)
  .on('mouseenter', function () {
    if (!setPlayingSongInfo().hash) return;
    $(this).attr(
      'title',
      `${setPlayingSongInfo().artist} - ${setPlayingSongInfo().title}`
    );
  })
  .on('click', '.to_max', function () {
    showMusicPlayerBox();
  })
  .on('click', '.show_lrc', toggleMiniLrc);
// 切换迷你歌词
function toggleMiniLrc() {
  $miniLrcWrap.fadeToggle(_d.speed)._isone = true;
  setZidx($miniLrcWrap[0], 0, 0, miniLrcCoord.isTop);
}
// 暂停
export function miniPlayerPause() {
  $miniPlayer
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'none');
}
// 加载
export function miniPlayerLoading() {
  $miniPlayer
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'fontcolor .5s infinite linear alternate');
}
// 播放
export function miniplayerPlaying() {
  $miniPlayer
    .find('.play_btn')
    .attr('class', 'play_btn iconfont icon-zanting')
    .css('animation', 'none');
}
// 更新歌词
export function miniLrcUpdateLrc(list, activeLrcIndex) {
  const showfy = localData.get('showSongTranslation');
  const curObj = list[activeLrcIndex] || {},
    nextObj = list[activeLrcIndex + 1] || {};
  let activep = '',
    activep1 = '';
  activep = _tpl(
    `<p>{{p}}</p><p v-if="showfy" class='fy' style="font-size: 0.6em">{{fy}}</p>`,
    { ...curObj, showfy }
  );
  if (activeLrcIndex + 1 === list.length) {
    activep1 = '';
  } else {
    activep1 = _tpl(
      `<p>{{p}}</p><p v-if="showfy" class='fy' style="font-size: 0.6em">{{fy}}</p>`,
      { ...nextObj, showfy }
    );
  }
  const $lb = $miniLrcWrap.find('.lrcbot');
  if ($lb.attr('x') === '0') {
    $lb.find('.one').html(activep).addClass('open');
    $lb.find('.tow').html(activep1).removeClass('open');
    $lb.attr('x', '1');
  } else {
    $lb.find('.one').html(activep1).removeClass('open');
    $lb.find('.tow').html(activep).addClass('open');
    $lb.attr('x', '0');
  }
}
export function initMiniLrc() {
  $miniLrcWrap.find('.lrcbot').find('.one').text('');
  $miniLrcWrap.find('.lrcbot').find('.tow').text('');
}
$editLrcWrap.find('textarea').on('keydown', function (e) {
  let key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key === 's') {
    saveLrc();
    e.preventDefault();
  }
});
// 关闭编辑歌词
export function closeEditLrcBox() {
  popWindow.remove('editlrc');
  _animate(
    $editLrcWrap[0],
    {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
      $editLrcWrap.find('textarea').val('');
    }
  );
  editLrcHeadContentScroll.close();
}
// 保存歌词
function saveLrc() {
  const val = $editLrcWrap.find('textarea').val();
  if ($editLrcWrap._val === val || !isRoot()) return;
  if (getTextSize(val) > _d.fieldLength.lrcSize) {
    _msg.error('歌词文本过长');
    return;
  }
  $editLrcWrap._val = val;
  reqPlayerEditLrc({
    id: $editLrcWrap._mobj.id,
    text: val,
  })
    .then((result) => {
      if (result.code === 1) {
        $editLrcWrap._val = val;
        _msg.success(result.codeText);
        cacheFile.delete($editLrcWrap._mobj.id, 'music');
        return;
      }
    })
    .catch(() => {});
}
$editLrcWrap
  .on('click', '.close', function () {
    closeEditLrcBox();
  })
  .on('click', '.save', saveLrc)
  .on('click', '.top', switchEditLrcTopState);
const editLrcHeadContentScroll = new ContentScroll(
  $editLrcWrap.find('.song_info_text p')[0]
);
// 显示编辑歌词
export function showEditLrc(sobj) {
  if (!isRoot()) {
    $editLrcWrap.find('.save').remove();
  }
  const editBox = $editLrcWrap[0];
  setZidx(editBox, 'editlrc', closeEditLrcBox, editLrcIsTop);
  const isHide = $editLrcWrap.is(':hidden');
  $editLrcWrap.css('display', 'flex');
  editLrcHeadContentScroll.init(`${sobj.artist} - ${sobj.title}`);
  $editLrcWrap.find('textarea').val('');
  $editLrcWrap._mobj = deepClone(sobj);
  reqPlayerReadLrc({
    id: sobj.id,
  })
    .then((result) => {
      if (result.code === 1) {
        $editLrcWrap._val = result.data;
        $editLrcWrap.find('textarea').val(result.data);
        return;
      }
    })
    .catch(() => {});
  if (!$editLrcWrap._once) {
    $editLrcWrap._once = true;
    toSetSize(editBox, 600, 600);
    toCenter(editBox);
  } else {
    myToRest(editBox, false, false);
  }
  if (isHide) {
    _animate(editBox, {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
      direction: 'reverse',
    });
  }
}
// 暂停视频
export function pauseVideo() {
  $myVideo[0].pause();
}
// 播放视频
export function playVideo() {
  pauseSong();
  $myVideo[0].play();
}
// 关闭mv
export function closeMvBox() {
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
      popWindow.remove('mv');
    }
  );
  musicMvContentScroll.close();
}
$musicMvWrap
  .on('click', '.m_close', closeMvBox)
  .on('click', '.top', switchMvTopState);
// mv标题滚动
const musicMvContentScroll = new ContentScroll(
  $musicMvWrap.find('.m_top_space p')[0]
);
// MV播放函数
export async function playMv(obj) {
  setPlayingSongInfo(hdSongInfo(obj));
  updateSongInfo();
  pauseSong();
  $myVideo.attr('src', setPlayingSongInfo().mmv);
  const mvBox = $musicMvWrap[0];
  const isHide = musicMvIsHide();
  playVideo();
  $musicMvWrap.css('display', 'flex');
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
    `${setPlayingSongInfo().artist} - ${setPlayingSongInfo().title}`
  );
  setZidx(mvBox, 'mv', closeMvBox, mvIsTop);
  highlightPlayingSong(false);
  playingListHighlight(false);
  toggleLrcMenuWrapBtnsState();
  updateLastPlay(1, 1);
  initMusicLrc();
  $myVideo[0].playbackRate = setCurPlaySpeed()[1];
}
$myVideo
  .on('error', function () {
    _msg.error(`MV 加载失败`);
  })
  .on('timeupdate', initRainCodeSleep);
myDrag({
  trigger: $miniPlayer[0],
  border: true,
  create({ target }) {
    if (miniPlayerCoord.left) {
      target.style.left = miniPlayerCoord.left + 'px';
      target.style.top = miniPlayerCoord.top + 'px';
    }
  },
  down() {
    showIframeMask();
  },
  up({ x, y }) {
    hideIframeMask();
    miniPlayerCoord.left = x;
    miniPlayerCoord.top = y;
    localData.set('miniPlayerCoord', miniPlayerCoord);
  },
});
myDrag({
  trigger: $miniLrcWrap[0],
  border: true,
  create({ target }) {
    target.style.left = miniLrcCoord.left + 'px';
    target.style.top = miniLrcCoord.top + 'px';
  },
  down() {
    showIframeMask();
  },
  up({ x, y }) {
    hideIframeMask();
    miniLrcCoord.left = x;
    miniLrcCoord.top = y;
    localData.set('miniLrcCoord', miniLrcCoord);
  },
});
myDrag({
  trigger: $musicMvWrap.find('.m_top_space')[0],
  target: $musicMvWrap[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  dblclick({ target }) {
    if (isFullScreen(target)) {
      myToRest(target);
    } else {
      myToMax(target);
    }
  },
  up({ target, x, y, pointerX }) {
    hideIframeMask();
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
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    savePopLocationInfo(target, {
      x,
      y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    });
  },
});
myDrag({
  trigger: $editLrcWrap.find('.song_info_text')[0],
  target: $editLrcWrap[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  dblclick({ target }) {
    if (isFullScreen(target)) {
      myToRest(target);
    } else {
      myToMax(target);
    }
  },
  up({ target, x, y, pointerX }) {
    hideIframeMask();
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
  target: $editLrcWrap[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    savePopLocationInfo(target, {
      x,
      y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    });
  },
});
// 层级
function hdIndex(e) {
  if (_getTarget(this, e, '.mini_player')) {
    setZidx($miniPlayer[0], 0, 0, miniPlayerCoord.isTop);
  } else if (_getTarget(this, e, '.mini_lrc_wrap')) {
    setZidx($miniLrcWrap[0], 0, 0, miniLrcCoord.isTop);
  } else if (_getTarget(this, e, '.music_mv_wrap')) {
    setZidx($musicMvWrap[0], 'mv', closeMvBox, mvIsTop);
  } else if (_getTarget(this, e, '.edit_lrc_wrap')) {
    setZidx($editLrcWrap[0], 'editlrc', closeEditLrcBox, editLrcIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  hdIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  hdIndex(e.changedTouches[0]);
});

//桌面大小改变自适应
window.addEventListener(
  'resize',
  debounce(function () {
    if (getScreenSize().w > _d.screen) {
      if ($miniLrcWrap.isshow) {
        $miniLrcWrap.css('display', 'block');
      }
      if ($miniPlayer.isshow) {
        $miniPlayer.css('display', 'block');
      }
    } else {
      if (!$miniLrcWrap.is(':hidden')) {
        $miniLrcWrap.css('display', 'none');
        $miniLrcWrap.isshow = true;
      } else {
        $miniLrcWrap.isshow = false;
      }
      if (!$miniPlayer.is(':hidden')) {
        $miniPlayer.css('display', 'none');
        $miniPlayer.isshow = true;
      } else {
        $miniPlayer.isshow = false;
      }
    }
  }, 1000)
);
