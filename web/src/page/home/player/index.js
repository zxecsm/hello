import $ from 'jquery';
import imgTianjia from '../../../images/img/tianjia.png';
import imgHistory from '../../../images/img/history.jpg';
import imgMusic from '../../../images/img/music.jpg';
import loadSvg from '../../../images/img/loading.svg';
import {
  _setData,
  _getData,
  _setTimeout,
  throttle,
  debounce,
  _getTarget,
  imgjz,
  arrSortMinToMax,
  formatDate,
  copyText,
  _position,
  isImgFile,
  downloadFile,
  unique,
  isMusicFile,
  ContentScroll,
  toCenter,
  toSetSize,
  creatSelect,
  formartSongTime,
  longPress,
  isMobile,
  getFiles,
  isBigScreen,
  getFilePath,
  createShare,
  isInteger,
  LazyLoad,
  wrapInput,
  myDrag,
  myResize,
  myToMax,
  myToRest,
  _mySlide,
  isRoot,
  formatNum,
  isFullScreen,
  concurrencyTasks,
  getScreenSize,
  upStr,
  _animate,
  getCenterPointDistance,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import realtime from '../../../js/plugins/realtime';
import { popWindow, setZidx } from '../popWindow.js';
import {
  reqPlayerAddList,
  reqPlayerCloseCollectSong,
  reqPlayerCollectSong,
  reqPlayerDeleteList,
  reqPlayerDeleteMv,
  reqPlayerDeleteSong,
  reqPlayerEditList,
  reqPlayerEditSong,
  reqPlayerGetLastPlay,
  reqPlayerList,
  reqPlayerMoveList,
  reqPlayerMoveSong,
  reqPlayerGetPlayList,
  reqPlayerRepeat,
  reqPlayerShare,
  reqPlayerSongToList,
  reqPlayerUp,
  reqPlayerRandomList,
  reqPlayerImport,
} from '../../../api/player.js';
import {
  changeMiniPlayerBg,
  closeEditLrcBox,
  closeMvBox,
  hideMiniLrcBox,
  hideMiniPlayer,
  pauseVideo,
  playMv,
  setMvplayVolume,
  showEditLrc,
  showMiniLrcBox,
  showMiniPlayer,
} from './widget.js';
import {
  changePlayState,
  closeLrcHeadContentScrollName,
  hdSongInfo,
  hideLrcBox,
  hideLrcFootWrap,
  lrcScroll,
  lrcWrapIsHide,
  musicPlay,
  pauseSong,
  playNextSong,
  playPrevSong,
  setAudioSrc,
  setLrcBg,
  setPlayingSongInfo,
  setRemotePlayState,
  setSongCurrentTime,
  setSongPlayVolume,
  showLrcBox,
  showLrcFootWrap,
  songIspaused,
  toggleLrcMenuWrapBtnsState,
  updateLrcHeadSongInfo,
  updatePlayingSongTotalTime,
  updateSongProgress,
} from './lrc.js';
import {
  hideMusicSearchList,
  getSearchSongs,
  searchWrapIsHide,
  unBindSearchListLazyImg,
} from './search.js';
import {
  playingListHighlight,
  renderPlayingList,
  setPlayingList,
  showPlayingList,
  unBindPlayListLazyImg,
  updateNewPlayList,
  updatePlayingList,
} from './playlist.js';
import { hideRightMenu } from '../rightSetting/index.js';
import pagination from '../../../js/plugins/pagination/index.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { showSongInfo } from '../../../js/utils/showinfo.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import { _tpl, deepClone } from '../../../js/utils/template.js';
import notifyMusicControlPanel from './notifyMusicControlPanel.js';
import md5 from '../../../js/utils/md5.js';
import _path from '../../../js/utils/path.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import percentBar from '../../../js/plugins/percentBar/index.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
const $musicPlayerBox = $('.music_player_box'),
  $musicFootProgress = $musicPlayerBox.find('.music_foot_progress'),
  $musicPlayerBg = $musicPlayerBox.find('.music_palyer_bg'),
  $musicHeadWrap = $musicPlayerBox.find('.head_wrap'),
  $msuicContentBox = $musicPlayerBox.find('.content_box'),
  $songListWrap = $musicPlayerBox.find('.song_list_wrap'),
  $songListUl = $songListWrap.find('ul'),
  $listItemsWarp = $musicPlayerBox.find('.list_items_wrap'),
  $songItemsBox = $listItemsWarp.find('.items_box'),
  $musicFootBox = $musicPlayerBox.find('.music_foot_box'),
  $playingSongLogo = $musicFootBox.find('.logo_img'),
  $miniPlayer = $('.mini_player');
let mediaVolume = _getData('mediaVolume'),
  musicPageSize = _getData('songListPageSize'),
  curSongListSort = _getData('songListSort'),
  playerIsTop = _getData('playerIsTop');
function switchPlayerTop() {
  playerIsTop = !playerIsTop;
  setTop();
  _setData('playerIsTop', playerIsTop);
  setZidx($musicPlayerBox[0], 'music', hideMusicPlayBox, playerIsTop);
}
setTop();
function setTop() {
  if (playerIsTop) {
    $musicHeadWrap.find('.top').attr('class', 'top iconfont icon-zhiding1');
  } else {
    $musicHeadWrap.find('.top').attr('class', 'top iconfont icon-zhiding');
  }
}
// 更新底部播放进度
export function updatePlayerBottomProgress(val) {
  $musicFootProgress.css({ width: val });
}
// 播放器是隐藏
export function musicPlayerIsHide() {
  return $musicPlayerBox.is(':hidden');
}
// 获取播放器左偏移
export function getMusicPlayerOffsetLeft() {
  return $musicPlayerBox[0].offsetLeft;
}
// 设置媒体音量
export function setMediaVolume(val) {
  if (val === undefined) {
    return mediaVolume;
  }
  mediaVolume = val;
}
//音乐播放器
let temPlaylist = [], // 打开歌单临时歌单列表
  musicList = [],
  curPlayingList = []; // 当前正在播放的列表
export function setMusicList(val) {
  if (val === undefined) {
    return musicList;
  }
  musicList = val;
}
export function setCurPlayingList(val) {
  if (val === undefined) {
    return curPlayingList;
  }
  curPlayingList = val;
}
// 歌曲封面懒加载
const songListLazyImg = new LazyLoad();
const songsLazyImg = new LazyLoad();
export function hdMusicImgCache(list) {
  return [...list].filter((item) => {
    const $img = $(item);
    const u = $img.attr('data-src');
    const cache = cacheFile.hasUrl(u, 'image');
    if (cache) {
      $img.css('background-image', `url(${cache})`).addClass('load');
    }
    return !cache;
  });
}
export function musicLoadImg(item) {
  const $img = $(item);
  let u = $img.attr('data-src');
  imgjz(u)
    .then((cache) => {
      $img.css('background-image', `url(${cache})`).addClass('load');
    })
    .catch(() => {
      $img.css('background-image', `url(${imgMusic})`).addClass('load');
    });
}
// 分享歌曲
export function shareSongList(e, arr, cb) {
  if (arr.length === 0) {
    _msg.error('分享列表为空');
    return;
  }
  if (arr.length > _d.maxSongList) {
    _msg.error(`分享列表限制${_d.maxSongList}首`);
    return;
  }
  createShare(e, { title: '分享歌曲' }, ({ close, inp, loading }) => {
    const { title, pass, expireTime } = inp;
    loading.start();
    reqPlayerShare({ list: arr, title, pass, expireTime })
      .then((result) => {
        loading.end();
        if (result.code === 1) {
          close(1);
          cb && cb();
          openInIframe(`/sharelist`, '分享列表');
        }
      })
      .catch(() => {
        loading.end();
      });
  });
}
// 歌曲取消收藏
export function songCloseCollect(id, cb) {
  reqPlayerCloseCollectSong({ id })
    .then((result) => {
      if (result.code === 1) {
        _msg.success(result.codeText);
        cb && cb();
        getSongList();
        return;
      }
    })
    .catch(() => {});
}
// 收藏歌曲
export function songCollect(ids, cb) {
  if (musicList[1].len + ids.length > _d.maxSongList) {
    _msg.error(`收藏限制${_d.maxSongList}首`);
    return;
  }
  reqPlayerCollectSong({
    ids,
  })
    .then((result) => {
      if (result.code === 1) {
        getSongList();
        _msg.success(result.codeText);
        cb && cb();
        return;
      }
    })
    .catch(() => {});
}
function unBindMusicPlayerLazyImg() {
  songListLazyImg.unBind();
  songsLazyImg.unBind();
  unBindPlayListLazyImg();
  unBindSearchListLazyImg();
}
// 隐藏播放器
export function hideMusicPlayBox() {
  popWindow.remove('music');
  if (isBigScreen()) {
    if (!musicPlayerIsHide()) {
      showMiniPlayer();
      showMiniLrcBox(1);
    }
  }
  const mBox = $musicPlayerBox[0];
  let to = {
    transform: `translateY(100%) scale(0)`,
    opacity: 0,
  };
  if (isBigScreen()) {
    const { x, y } = getCenterPointDistance(mBox, $miniPlayer[0]);
    to = {
      transform: `translate(${x}px,${y}px) scale(0)`,
      opacity: 0,
    };
  }
  _animate(
    mBox,
    {
      to,
    },
    (target) => {
      target.style.display = 'none';
      $songItemsBox.html('');
      $songListUl.html('');
      closeMusicTitleScroll();
      unBindMusicPlayerLazyImg();
    }
  );
}
// 关闭播放器
export function closeMusicPlayer() {
  _animate(
    $musicPlayerBox[0],
    {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
      popWindow.remove('music');
      $songItemsBox.html('');
      $songListUl.html('');
      closeMusicTitleScroll();
      unBindMusicPlayerLazyImg();
    }
  );
  closeMvBox();
  closeEditLrcBox();
  hideMiniPlayer();
  hideMiniLrcBox();
  pauseSong();
  pauseVideo();
}
// 设置当前开启的歌单id
export function setCurOpenSongListId(val) {
  if (val === undefined) {
    return $songListWrap.listId;
  }
  $songListWrap.listId = val;
}
// 返回按钮
function musicBackBtn() {
  if (!searchWrapIsHide()) {
    musicSearchInput.setValue('').focus();
    hideMusicSearchList();
  } else if (!lrcWrapIsHide()) {
    hideLrcBox();
  } else if (
    $msuicContentBox.find('.list_items_wrap').css('transform') === 'none'
  ) {
    $songListWrap.listId = '';
    $songListWrap.removeClass('open');
    $msuicContentBox.find('.list_items_wrap').removeClass('open');
    _setTimeout(() => {
      $songItemsBox.html('');
    }, 800);
    $musicHeadWrap.find('.song_list_name').css('opacity', 0).text('');
  } else if (!musicPlayerIsHide()) {
    hideMusicPlayBox();
  }
}
const handleRemoteVol = debounce(function () {
  if (setRemotePlayState()) {
    realtime.send({
      type: 'vol',
      data: { value: mediaVolume },
    });
  }
}, 500);
// 音量调节
function adjustVolume(e) {
  percentBar(e, mediaVolume, function (per) {
    mediaVolume = per;
    setPlayVolume();
    handleRemoteVol(per);
  });
}
// 歌曲搜索框
const musicSearchInput = wrapInput(
  $musicHeadWrap.find('.search_music_inp input')[0],
  {
    focus(e) {
      $(e.target).parent().addClass('focus');
      $musicHeadWrap.find('.search_btn').css('display', 'none');
    },
    blur(e) {
      const $inpBox = $(e.target).parent();
      $inpBox.removeClass('focus');
      if (musicSearchInput.getValue().trim() === '') {
        $inpBox.fadeOut(300, () => {
          $musicHeadWrap.find('.search_btn').slideDown(_d.speed);
        });
        hideMusicSearchList();
      }
    },
    update(val) {
      if (val === '') {
        $musicHeadWrap
          .find('.search_music_inp .clean_btn')
          .css('display', 'none');
      } else {
        $musicHeadWrap
          .find('.search_music_inp .clean_btn')
          .css('display', 'block');
      }
    },
    keyup(e) {
      if (e.key === 'Enter') {
        getSearchSongs(1, 1);
      }
    },
  }
);
export function setSearchMusicInputValue(val) {
  if (val === undefined) {
    return musicSearchInput.getValue('').trim();
  }
  musicSearchInput.setValue(val).focus();
}
$musicHeadWrap
  .on('click', '.back', musicBackBtn)
  .on('click', '.close', closeMusicPlayer)
  .on('click', '.hide', hideMusicPlayBox)
  .on('click', '.top', switchPlayerTop)
  .on('click', '.search_btn', () => {
    musicSearchInput.target.parentNode.style.display = 'flex';
    musicSearchInput.setValue('').focus();
  })
  .on('click', '.search_music_inp .clean_btn', function () {
    musicSearchInput.setValue('').focus();
    hideMusicSearchList();
  })
  .on('click', '.search_music_inp .inp_search_btn', function () {
    getSearchSongs(1, 1);
  })
  .on('click', '.volume', adjustVolume);
// 获取收藏歌曲
export function getCollectSongs() {
  let obj = {};
  if (musicList) {
    obj = musicList[1].item.reduce((total, item) => {
      total[item.id] = 'y';
      return total;
    }, {});
  }
  return obj;
}
// 删除歌曲
export function delSong(
  e,
  listId,
  ids,
  title,
  cb,
  text,
  loading = { start() {}, end() {} }
) {
  let opt = {};
  if (title === 'del') {
    opt = {
      e,
      text: `确认删除：${text || '选中的歌曲'}？`,
      confirm: { type: 'danger', text: '删除' },
    };
  } else if (title === 'clean') {
    opt = { e, text: '确认清空：歌单？' };
  } else {
    opt = { e, text: `确认移除：${text || '选中歌曲'}？` };
  }
  _pop(opt, (type) => {
    if (type === 'confirm') {
      loading.start();
      reqPlayerDeleteSong({
        listId,
        ids,
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            _msg.success(result.codeText);
            getSongList();
            cb && cb();
          }
        })
        .catch(() => {
          loading.end();
        });
    }
  });
}
// 移动歌曲
export function moveSongToList(e, pid, ar) {
  let list = [];
  let cIdx = 0;
  musicList.forEach((v, i) => {
    if (v.id === pid) {
      cIdx = i;
    }
    if (i < 3 || v.id === pid) return;
    let p = getFilePath(v.pic, 1);
    if (v.pic === 'history') {
      p = imgHistory;
    } else if (v.pic === 'default') {
      p = imgMusic;
    }
    list.push({ ...v, pic: p });
  });
  if (list.length <= 0) {
    _msg.error('没有可选歌单');
    return;
  }
  const html = _tpl(
    `
    <div v-for="v in list" :data-name="v.name" cursor="y" class="item" :data-id="v.id">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="v.pic"/>
      <span style="margin-left:10px;">{{v.name}}</span>
    </div>
    `,
    {
      list,
      pid,
    }
  );
  rMenu.rightMenu(
    e,
    html,
    function ({ close, box, e, loading }) {
      let _this = _getTarget(box, e, '.item');
      if (_this) {
        let $this = $(_this),
          tid = $this.attr('data-id'),
          listname = $this.attr('data-name');
        const toObj = musicList.find((item) => item.id === tid);
        if (toObj.len + ar.length > _d.maxSongList) {
          _msg.error(`歌单限制${_d.maxSongList}首`);
          return;
        }
        _pop(
          {
            e,
            text: `确认${
              pid === 'all' || cIdx < 3 ? '添加到' : '移动到'
            }：${listname}？`,
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqPlayerSongToList({
                fromId: pid,
                toId: tid,
                ids: ar,
              })
                .then((result) => {
                  loading.end();
                  if (result.code === 1) {
                    close(true);
                    _msg.success(result.codeText);
                    getSongList();
                    return;
                  }
                })
                .catch(() => {
                  loading.end();
                });
            }
          }
        );
      }
    },
    `${pid === 'all' || cIdx < 3 ? '添加歌曲' : '移动歌曲'}到歌单`
  );
}
// 编辑歌曲信息
export function editSongInfo(e, sobj) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        artist: {
          value: sobj.artist,
          beforeText: '歌手名：',
          placeholder: '歌手名',
          verify(val) {
            if (val === '') {
              return '请输入歌手名';
            } else if (val.length > _d.fieldLenght.title) {
              return '歌手名过长';
            }
          },
        },
        title: {
          value: sobj.title,
          beforeText: '歌曲名：',
          placeholder: '歌曲名',
          verify(val) {
            if (val === '') {
              return '请输入歌曲名';
            } else if (val.length > _d.fieldLenght.title) {
              return '歌曲名过长';
            }
          },
        },
        album: {
          value: sobj.album,
          placeholder: '专辑',
          beforeText: '专辑：',
          verify(val) {
            if (val === '') {
              return '请输入专辑名';
            } else if (val.length > _d.fieldLenght.title) {
              return '专辑名过长';
            }
          },
        },
        year: {
          value: sobj.year,
          placeholder: '年份',
          beforeText: '年份：',
          inputType: 'number',
          verify(val) {
            if (val.length > 10) {
              return '年份过长';
            }
          },
        },
        duration: {
          value: sobj.duration,
          placeholder: '时长(秒)',
          beforeText: '时长(秒)：',
          inputType: 'number',
          verify(val) {
            const num = parseFloat(val);
            if (val === '') {
              return '请输入时长';
            } else if (isNaN(num) || num < 0) {
              return '请输入正整数';
            }
          },
        },
        play_count: {
          value: sobj.play_count,
          placeholder: '播放量',
          beforeText: '播放量：',
          inputType: 'number',
          verify(val) {
            const num = parseInt(val);
            if (val === '') {
              return '请输入播放量';
            } else if (isNaN(num) || num < 0) {
              return '请输入正整数';
            }
          },
        },
        collect_count: {
          value: sobj.collect_count,
          placeholder: '收藏量',
          beforeText: '收藏量：',
          inputType: 'number',
          verify(val) {
            const num = parseInt(val);
            if (val === '') {
              return '请输入收藏量';
            } else if (isNaN(num) || num < 0) {
              return '请输入正整数';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqPlayerEditSong({
        ...inp,
        id: sobj.id,
      })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close(true);
            _msg.success(res.codeText);
            getSongList();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑歌曲信息'
  );
}
// 删除MV
export function delMv(e, id, cb, text, loading = { start() {}, end() {} }) {
  if (!isRoot()) return;
  _pop(
    {
      e,
      text: `确认删除MV${text ? `：${text}` : ''}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqPlayerDeleteMv({ id })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
              getSongList();
              cb && cb();
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    }
  );
}
// 远程调节音量
export const remoteVol = debounce(function () {
  realtime.send({
    type: 'vol',
    data: { value: mediaVolume },
  });
}, 500);
// 设置音量
export function setPlayVolume() {
  setSongPlayVolume(mediaVolume);
  setMvplayVolume(mediaVolume);
  _setData('mediaVolume', mediaVolume);

  $musicHeadWrap
    .find('.volume')
    .attr('class', `volume iconfont ${getVolumeIcon(mediaVolume)}`);
}
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
// 拖动歌单
(function () {
  let fromDom = null;
  $songListWrap
    .on('dragstart', '.song_list_item', function () {
      fromDom = this;
    })
    .on('drop', '.song_list_item', function () {
      if (fromDom) {
        const fIdx = $(fromDom).index(),
          tIdx = $(this).index(),
          fromId = $(fromDom).attr('data-id'),
          toId = $(this).attr('data-id');
        if (fIdx > 2 && tIdx > 2 && fIdx !== tIdx) {
          reqPlayerMoveList({ fromId, toId })
            .then((result) => {
              if (result.code === 1) {
                getSongList();
                return;
              }
            })
            .catch(() => {});
        }
        fromDom = null;
      }
    })
    .on('dragover', '.song_list_item', function (e) {
      e.preventDefault();
    });
})();
let playId = '';
// 获取歌单
export function getSongList(cb) {
  if (musicPlayerIsHide()) return;
  if ($songListUl.children().length === 0) {
    songListLoading();
  }
  const id = $songListWrap.listId;
  reqPlayerGetLastPlay()
    .then((result) => {
      if (result.code === 1) {
        if (musicPlayerIsHide()) return;
        if (songIspaused()) {
          const _musicinfo = result.data;
          let { currentTime = 0, duration = 0, lastplay } = _musicinfo;
          setPlayingSongInfo(hdSongInfo(lastplay));
          updateSongInfo();
          setSongCurrentTime(parseFloat(currentTime) || 0);
          updateSongProgress();
          updatePlayingSongTotalTime(parseFloat(duration) || 0);
        } else {
          initMusicTitleScroll();
        }
        reqPlayerList({
          id,
          pageNo: songPageNo,
          pageSize: musicPageSize,
          sort: curSongListSort,
          playId,
        })
          .then((result) => {
            if (result.code === 1) {
              musicList = result.data;
              cb && cb();
              toggleLrcMenuWrapBtnsState();
              renderPlayingList().then(() => {
                playingListHighlight();
              });
              renderSongList();
              getSearchSongs();
              return;
            }
          })
          .catch(() => {});
      }
    })
    .catch(() => {});
  if (setPlayingList().length === 0) {
    reqPlayerGetPlayList()
      .then(async (result) => {
        if (result.code === 1) {
          setPlayingList(result.data);
          curPlayingList = deepClone(setPlayingList());
          await renderPlayingList();
          playingListHighlight(true);
          return;
        }
      })
      .catch(() => {});
  }
}
// 歌单加载
function songListLoading() {
  let str = '';
  new Array(15).fill(null).forEach(() => {
    str += `<li style="pointer-events: none;" class="song_list_item">
      <div class="list_logo" style="background-color:var(--color8);background-image:none;box-shadow: none;"></div>
      </li>`;
  });
  $songListUl.html(str);
}
// 生成歌单列表
function renderSongList() {
  if (musicPlayerIsHide()) return;
  let arr = musicList;
  const html = _tpl(
    `
    <li v-for="item in arr" class="song_list_item" :data-id="item.id" cursor="y" draggable="true">
      <div class="list_logo">
        <div class="logo" :data-src="getPic(item.pic)"></div>
      </div>
      <span>{{item.name}}</sapn>
    </li>
    <li cursor="y" class="add_song_list"><img :src="imgTianjia"/></li>
    `,
    {
      arr,
      imgTianjia,
      getPic(pic) {
        let p = getFilePath(pic, 1);
        if (pic === 'history') {
          p = imgHistory;
        } else if (pic === 'default') {
          p = imgMusic;
        }
        return p;
      },
    }
  );
  $songListUl.html(html);

  songListLazyImg.bind(
    hdMusicImgCache($songListUl[0].querySelectorAll('.logo')),
    musicLoadImg
  );
  if (!$songListWrap.listId) return;
  renderSongs();
}
let songPageNo = 1; // 歌曲列表页号
// 获取歌曲列表
function getSongs(gao) {
  songsLoading();
  let id = $songListWrap.listId;
  if (!id) return;
  reqPlayerList({
    id,
    pageNo: songPageNo,
    pageSize: musicPageSize,
    sort: curSongListSort,
    playId,
  })
    .then((result) => {
      if (result.code === 1) {
        musicList = result.data;
        if (!id) return;
        renderSongs(gao);
        return;
      }
    })
    .catch(() => {});
}
// 歌曲列表加载
function songsLoading() {
  let str = '';
  str += `<div style="pointer-events: none;" class="items_list_top_wrap">
        <div style="background-color:var(--color8);background-image:none" class="song_list_cover"></div>
        <div style="background-color:var(--color8); height: 40px;width: 100px;margin: 30px;" class="song_list_info"></div>
      </div>
      <div style="pointer-events: none; height: 40px;width: 100%;padding: 0 5px;overflow:hidden;">
          <div style="background-color:var(--color8);height: 40px;width:50%;float:left;"></div>
          <div style="background-color:var(--color8);height: 40px;width:30%;float:right;"></div>
      </div>`;
  new Array(10).fill(null).forEach(() => {
    str += `<div style="pointer-events: none;" data-flag="default" class="song_item">
        <div style="background-color:var(--color8);background-image:none" class="song_logo_box"></div>
        <div class="song_info_wrap">
          <span style="background-color:var(--color8);margin: 8px 0 0 0;width: 110px;height:15px" class="song_name"></span>
          <span style="background-color:var(--color8);margin: 5px 0 0 0;width: 110px;height:15px" class="artist_name"></span>
        </div>
        <div style="background-color:var(--color8);width:100px;height: 40px;margin: 10px 0 0 10px;" class="set_song_btn"></div>
      </div>`;
  });
  $songItemsBox.html(str);
}
export async function hdLoadedSong(list) {
  const loadedSongs = await cacheFile.getList('music');
  return list.map((item) => {
    const isLoaded = loadedSongs.some(
      (s) =>
        s.name === cacheFile.getHash(getFilePath(`/music/${item.url}`), 'music')
    );
    return { ...item, isLoaded };
  });
}
// 生成歌曲列表
async function renderSongs(gao) {
  const listId = $songListWrap.listId;
  if (!listId) return;
  const ind = musicList.findIndex((item) => item.id === listId);
  if (ind < 0) return;
  const songListInfo = deepClone(musicList[ind]);
  if (listId !== 'all' && ind > 0) {
    // 排序
    if (curSongListSort === 'artist') {
      songListInfo.item = arrSortMinToMax(songListInfo.item, 'artist_pinyin');
    } else if (curSongListSort === 'title') {
      songListInfo.item = arrSortMinToMax(songListInfo.item, 'title_pinyin');
    } else if (curSongListSort === 'playCount') {
      songListInfo.item.sort((a, b) => {
        return b.play_count - a.play_count;
      });
    } else if (curSongListSort === 'collectCount') {
      songListInfo.item.sort((a, b) => {
        return b.collect_count - a.collect_count;
      });
    }
  }
  const scObj = ind === 1 ? {} : getCollectSongs();
  let pic = getFilePath(songListInfo.pic, 1);
  if (songListInfo.pic === 'history') {
    pic = imgHistory;
  } else if (songListInfo.pic === 'default') {
    pic = imgMusic;
  }
  // 分页
  let slist = [];
  let pageTotal;
  let total;
  if (listId === 'all') {
    const { item, pageNo, totalPage } = songListInfo;
    slist = item;
    songPageNo = pageNo;
    pageTotal = totalPage;
    total = songListInfo.total;
  } else {
    pageTotal = Math.ceil(songListInfo.item.length / musicPageSize);
    songPageNo < 1
      ? (songPageNo = pageTotal)
      : songPageNo > pageTotal
      ? (songPageNo = 1)
      : null;
    slist = songListInfo.item.slice(
      (songPageNo - 1) * musicPageSize,
      songPageNo * musicPageSize
    );
    total = songListInfo.item.length;
  }
  slist = await hdLoadedSong(slist);
  const html = _tpl(
    `
    <div class="items_list_top_wrap">
      <div class="song_list_cover">
        <div class="logo" :data-src="pic"></div>
      </div>
      <div class="song_list_info">
        <div class="song_list_name" :title="name">{{songListInfo.name}}</div>
        <div v-if="songListInfo.des" class="song_list_des">{{songListInfo.des}}</div>
      </div>
    </div>
    <div class="items_list_top_menu">
      <div v-if="listId !== 'all'" cursor="y" class="play_list_btn iconfont icon-65zanting"></div>
      <div class="list_total_num">{{listId === 'all' ? '一共' : '播放全部'}}
        <span>({{songListInfo.len}})</span>
      </div>
      <div v-if="listId === 'all'" cursor="y" class="random_song_list_btn"><i class="iconfont icon-suiji"></i></div>
      <div v-if="ind > 2 || isRoot()" cursor="y" class="edit_song_list_btn"><i class="iconfont icon-bianji"></i></div>
      <div v-if="ind === 2" cursor="y" class="upload_song_btn"><i class="iconfont icon-upload"></i></div>
      <div v-else cursor="y" class="share_song_list_btn"><i class="iconfont icon-fenxiang_2"></i></div>
      <div cursor="y" class="checked_song_btn"><i class="iconfont icon-duoxuan"></i></div>
      <div v-if="ind > 0" cursor="y" class="sort_songs"><i class="iconfont icon-paixu"></i></div>
    </div>
    <div v-for="{title,artist,mv,id,pic:picc,isLoaded} in slist" class="song_item" :data-id="id" draggable="true" :data-issc="issc(id)" cursor="y">
      <div cursor="y" check="n" class="check_state"></div>
      <div v-if="isLoaded" class="downloaded iconfont icon-jiaobiao"></div>
      <div class="song_logo_box">
        <div class="logo" :data-src="getFilePath('/music/'+picc, 1)"></div>
        <div class="play_gif"></div>
      </div>
      <div class="song_info_wrap">
        <span class="song_name">{{title}}</span>
        <span class="artist_name">
          <i class="viptu iconfont icon-vip1"></i>
          <i class="artist_name_text">{{artist}}</i>
        </span>
      </div>
      <div v-if="mv" class="play_mv iconfont icon-shipin2"></div>
      <div v-if="ind != 1" class="like_hear iconfont {{issc(id) ? 'icon-hear-full active' : 'icon-hear'}}"></div>
      <div title="添加到播放列表" class="add_song_playing_btn iconfont icon-icon-test"></div>
      <div class="set_song_btn iconfont icon-icon"></div>
    </div>
    <div v-if="pageTotal > 1" v-html="getPaging()" style="padding:20px 0;text-align:center;line-height: 26px;" class="song_list_paging jzxz"></div>
    <div class="check_all_menu_wrap">
      <div cursor="y" x='1' class="check_all_song_btn">全选</div>
      <div cursor="y" class="share_all_song_btn">分享</div>
      <div v-if="ind != 1" cursor="y" class="collect_songs_btn">收藏</div>
      <div cursor="y" class="add_song_btn">添加到</div>
      <div v-if="ind > 2" cursor="y" class="move_song_btn">移动到</div>
      <div cursor="y" class="download_song_btn">下载</div>
      <div v-if="ind != 2" cursor="y" class="remove_song_btn">移除</div>
      <div v-if="isRoot()" cursor="y" class="del_songs_btn">删除</div>
      <div v-if="ind < 2" cursor="y" class="clear_all_song_btn">清空</div>
      <div cursor="y" class="cancel_btn">取消</div>
    </div>
    `,
    {
      pic,
      songListInfo,
      ind,
      isRoot,
      listId,
      getFilePath,
      pageTotal,
      getPaging() {
        return pgnt.getHTML({
          pageNo: songPageNo,
          total,
          pageSize: musicPageSize,
        });
      },
      slist,
      issc(id) {
        return scObj.hasOwnProperty(id);
      },
    }
  );
  $songItemsBox.html(html)._check = false;
  temPlaylist = songListInfo.item;
  if (!gao) {
    highlightPlayingSong();
  } else {
    highlightPlayingSong(1);
  }
  $msuicContentBox.find('.list_items_wrap').scroll();
  songsLazyImg.bind(
    hdMusicImgCache(
      $msuicContentBox.find('.list_items_wrap')[0].querySelectorAll('.logo')
    ),
    musicLoadImg
  );
}
const pgnt = pagination($songItemsBox[0], {
  small: true,
  showTotal: false,
  select: [],
  toTop: false,
  change(val) {
    songPageNo = val;
    $msuicContentBox.find('.list_items_wrap')[0].scrollTop = 0;
    if ($songListWrap.listId === 'all') {
      getSongs();
      return;
    }
    renderSongs();
  },
});
// 添加歌单
function addSongList(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          placeholder: '标题',
          beforeText: '标题：',
          verify(val) {
            if (val === '') {
              return '请输入标题';
            } else if (val.length > _d.fieldLenght.title) {
              return '标题过长';
            }
          },
        },
        des: {
          type: 'textarea',
          beforeText: '描述：',
          placeholder: '描述',
          verify(val) {
            if (val.length > _d.fieldLenght.des) {
              return '描述过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      loading.start();
      reqPlayerAddList({ name: inp.title, des: inp.des })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText);
            getSongList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '添加歌单'
  );
}
//打开列表
$songListWrap
  .on(
    'click',
    '.song_list_item',
    debounce(
      function () {
        $songListWrap.addClass('open').listId = $(this).attr('data-id');
        $msuicContentBox.find('.list_items_wrap').addClass('open').scrollTop(0);
        songPageNo = 1;
        getSongs();
      },
      1000,
      true
    )
  )
  .on('click', '.add_song_list', function (e) {
    // 添加歌单
    addSongList(e);
  })
  .on('contextmenu', '.song_list_item', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    const id = $(this).attr('data-id');
    songListMenu(e, id);
  })
  .on('mouseenter', '.song_list_item', function () {
    const id = $(this).attr('data-id');
    const index = musicList.findIndex((item) => item.id === id);
    const { des, name } = musicList[index];
    const str = `名称：${name || '--'}\n描述：${des || '--'}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.song_list_item', function () {
    toolTip.hide();
  })
  .on('click', '.song_list_item span', function (e) {
    e.stopPropagation();
    const id = $(this).parent().attr('data-id');
    songListMenu(e, id);
  });
longPress($songListWrap[0], '.song_list_item', function (e) {
  const id = $(this).attr('data-id');
  let ev = e.changedTouches[0];
  songListMenu(ev, id);
});
// 删除歌单
function deleteSongList(e, name, id, cb, loading = { start() {}, end() {} }) {
  _pop(
    {
      e,
      text: `确认移除歌单：${name}？`,
      confirm: { type: 'danger', text: '移除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqPlayerDeleteList({ id })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              cb && cb();
              _msg.success(result.codeText);
              getSongList();
              return;
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    }
  );
}
// 歌单菜单
function songListMenu(e, sid) {
  const index = musicList.findIndex((item) => item.id === sid);
  const { des, name, num } = musicList[index];
  const data = [];

  if (isRoot() || index > 2) {
    data.push({
      id: '1',
      text: '编辑',
      beforeIcon: 'iconfont icon-bianji',
    });
  }
  if (index !== 2) {
    data.push(
      {
        id: '2',
        text: '导入歌曲',
        beforeIcon: 'iconfont icon-upload',
      },
      {
        id: '3',
        text: '导出歌曲',
        beforeIcon: 'iconfont icon-download',
      }
    );
  }
  if (index > 2) {
    data.push({
      id: '4',
      text: '移除歌单',
      beforeIcon: 'iconfont icon-shibai',
    });
  }
  if (data.length === 0) return;

  rMenu.selectMenu(
    e,
    data,
    async ({ e, close, id, loading }) => {
      if (id === '1') {
        editSongList(e, { name, des, num }, sid);
      } else if (id === '2') {
        close();
        try {
          const text = await upStr('.json');
          if (text) {
            const list = JSON.parse(text);
            const res = await reqPlayerImport({ id: sid, list });

            if (res.code === 1) {
              _msg.success(res.codeText);
              getSongList();
            }
          }
        } catch {
          _msg.error();
        }
      } else if (id === '3') {
        _pop(
          {
            e,
            text: '确认导出？',
          },
          async (type) => {
            if (type === 'confirm') {
              downloadFile([
                {
                  fileUrl: `/api/player/export/?id=${sid}`,
                  filename: `${name}.json`,
                },
              ]);
              close();
            }
          }
        );
      } else if (id === '4') {
        deleteSongList(e, name, sid, close, loading);
      }
    },
    name
  );
}
// 获取歌曲信息
function getSongInfo(id) {
  const p = musicList.find((item) => item.id === $songListWrap.listId);
  return p.item.find((item) => item.id === id);
}
// 获取选中的歌曲
function getCheckSongs() {
  const $songs = $msuicContentBox.find('.list_items_wrap .song_item'),
    $selectarr = $songs.filter(
      (_, item) => $(item).find('.check_state').attr('check') === 'y'
    );
  const arr = [];
  $selectarr.each((i, v) => {
    arr.push(getSongInfo(v.getAttribute('data-id')));
  });
  return arr;
}
// 编辑歌单
function editSongList(e, obj, sid) {
  const { name, des } = obj;
  const option = {
    subText: '提交',
    items: {
      idx: {
        beforeText: '序号',
        inputType: 'number',
        placeholder: '序号',
        value: obj.num + 1,
        verify(val) {
          let value = parseFloat(val);
          if (!isInteger(value) || value <= 0) {
            return '请输正整数';
          }
        },
      },
      title: {
        beforeText: '标题：',
        placeholder: '标题',
        value: name,
        verify(val) {
          if (val === '') {
            return '请输入标题';
          } else if (val.length > _d.fieldLenght.title) {
            return '标题过长';
          }
        },
      },
      des: {
        beforeText: '描述：',
        type: 'textarea',
        placeholder: '描述',
        value: des || '',
        verify(val) {
          if (val.length > _d.fieldLenght.des) {
            return '描述过长';
          }
        },
      },
    },
  };
  if (obj.num < 3) {
    delete option.items.idx;
  }
  rMenu.inpMenu(
    e,
    option,
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      let nname = inp.title,
        idx = inp.idx - 1,
        ndes = inp.des;
      let toId = '';
      if (idx != obj.num) {
        const lastNum = musicList.length - 1;
        idx = idx > lastNum ? lastNum : idx < 3 ? 3 : idx;
        toId = (musicList.find((item) => item.num === idx) || {}).id || '';
      }
      loading.start();
      reqPlayerEditList({
        id: sid,
        name: nname,
        des: ndes,
        toId,
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            getSongList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑歌单'
  );
}
// 上传歌曲封面
export async function updateSongCover(obj) {
  try {
    const files = await getFiles({
      accept: 'image/*',
    });
    if (files.length === 0) return;
    const file = files[0];
    const controller = new AbortController();
    const signal = controller.signal;

    const upPro = new UpProgress(() => {
      controller.abort();
    });
    const { name, size } = file;
    const pro = upPro.add(file.name);
    if (!isImgFile(name)) {
      pro.fail();
      _msg.error(`封面格式错误`);
      return;
    }
    if (size <= 0 || size >= 5 * 1024 * 1024) {
      pro.fail();
      _msg.error(`封面限制0-5M`);
      return;
    }
    const result = await reqPlayerUp(
      {
        name,
        id: obj.id,
        type: 'cover',
      },
      file,
      function (percent) {
        pro.update(percent);
      },
      signal
    );
    if (result.code === 1) {
      pro.close();
      getSongList();
    } else {
      pro.fail();
    }
  } catch {
    _msg.error('上传封面失败');
    return;
  }
}
// 上传MV
export async function upMv(obj) {
  const files = await getFiles({
    accept: 'video/*',
  });
  if (files.length === 0) return;
  const file = files[0];
  const { name, size } = file;
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  const pro = upPro.add(name);
  if (!/\.(mp4)$/i.test(name)) {
    pro.fail();
    _msg.error(`MV 格式错误`);
    return;
  }
  if (size <= 0 || size >= 200 * 1024 * 1024) {
    pro.fail();
    _msg.error(`MV限制0-200M`);
    return;
  }
  try {
    const result = await reqPlayerUp(
      {
        name,
        id: obj.id,
        type: 'mv',
      },
      file,
      (percent) => {
        pro.update(percent);
      },
      signal
    );
    if (result.code === 1) {
      pro.close();
      realtime.send({ type: 'updatedata', data: { flag: 'music' } });
      getSongList();
    } else {
      pro.fail();
    }
  } catch {
    pro.fail();
  }
}
// 上传歌曲
async function upSong() {
  const files = await getFiles({
    multiple: true,
    accept: 'audio/*',
  });
  if (files.length === 0) return;
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size } = file;
    const pro = upPro.add(name);
    if (!isMusicFile(name)) {
      pro.fail();
      _msg.error(`歌曲格式错误`);
      return;
    }
    if (size <= 0 || size >= 30 * 1024 * 1024) {
      pro.fail();
      _msg.error(`歌曲限制0-30M`);
      return;
    }
    try {
      //文件切片
      let { HASH } = await md5.fileSlice(
        file,
        (percent) => {
          pro.loading(percent);
        },
        signal
      );
      let isrepeat = await reqPlayerRepeat({ HASH }); //是否已经存在文件

      if (isrepeat.code === 1) {
        //文件已经存在操作
        pro.close('歌曲已存在');
        return;
      }
      const result = await reqPlayerUp(
        {
          name,
          HASH,
          type: 'song',
        },
        file,
        (percent) => {
          pro.update(percent);
        },
        signal
      );
      if (result.code === 1) {
        pro.close();
      } else {
        pro.fail();
      }
    } catch {
      pro.fail();
    }
  });
  realtime.send({ type: 'updatedata', data: { flag: 'music' } });
  getSongList();
}
// 歌曲歌曲选中
function switchSongChecked() {
  const $checkMenu = $msuicContentBox.find('.check_all_menu_wrap'),
    $checks = $msuicContentBox.find('.list_items_wrap .check_state');
  if ($songItemsBox._check) {
    $checkMenu.css('display', 'none');
    $checks.css('display', 'none');
    $songItemsBox._check = false;
  } else {
    $checkMenu.css('display', 'block');
    $checks.css('display', 'block');
    $songItemsBox._check = true;
  }
  $checks.attr('check', 'n').css('background-color', 'transparent');
  $msuicContentBox.find('.list_items_wrap .check_all_song_btn').attr('x', '1');
}
// 播放歌单
function playSongListBtn(e, list) {
  if (list.length === 0) {
    _msg.error('播放列表为空');
    return;
  }
  updateNewPlayList(list);
  changePlayingAnimate(e);
  musicPlay(curPlayingList[0]);
}
// 隐藏跳转按钮
let hidePositionBtn = debounce(function () {
  $listItemsWarp.find('.position_btn').stop().fadeOut(_d.speed);
}, 10000);
// 歌曲列表滚动
function hdSongsScroll() {
  $listItemsWarp.find('.position_btn').css('display', 'block');
  hidePositionBtn();
  if (this.scrollTop > 115) {
    $msuicContentBox.find('.items_list_top_menu').addClass('sct');
    $msuicContentBox.find('.items_list_top_wrap').addClass('lbxma');
    $musicHeadWrap
      .find('.song_list_name')
      .text($songItemsBox.find('.song_list_name').text())
      .css('opacity', 1);
  } else {
    $msuicContentBox.find('.items_list_top_menu').removeClass('sct');
    $msuicContentBox.find('.items_list_top_wrap').removeClass('lbxma');
    $musicHeadWrap.find('.song_list_name').css('opacity', 0).text('');
  }
}
// 添加歌曲到播放列表
export function addSongToPlayList(e, arr) {
  if (arr.length === 0) return;
  setPlayingList([...setPlayingList(), ...arr]);
  curPlayingList = [...curPlayingList, ...arr];
  setPlayingList(setPlayingList().reverse());
  curPlayingList.reverse();
  setPlayingList(unique(setPlayingList(), ['id']));
  curPlayingList = unique(curPlayingList, ['id']);
  setPlayingList(setPlayingList().reverse());
  curPlayingList.reverse();
  changePlayingAnimate(e);
  updatePlayingList();
}
// 歌曲菜单
function songMenu(e, idx, sobj) {
  const data = [
    {
      id: '1',
      text: '分享歌曲',
      beforeIcon: 'iconfont icon-fenxiang_2',
    },
    {
      id: '2',
      text: '复制歌曲名',
      beforeIcon: 'iconfont icon-fuzhi',
    },
    {
      id: '3',
      text: '编辑歌词',
      beforeIcon: 'iconfont icon-bianji',
    },
    {
      id: '4',
      text: '封面',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: '5',
      text: '歌曲信息',
      beforeIcon: 'iconfont icon-about',
    },
    {
      id: '6',
      text: '添加到',
      beforeIcon: `iconfont icon-icon-test`,
    },
  ];
  if (
    idx > 0 &&
    $songListWrap.listId != 'all' &&
    curSongListSort === 'default'
  ) {
    data.unshift({
      id: '14',
      text: '置顶',
      beforeIcon: 'iconfont icon-zhiding',
    });
  }
  if (idx > 2) {
    data.push({
      id: '11',
      text: '移动到',
      beforeIcon: `iconfont icon-moveto`,
    });
  }
  data.push({
    id: '7',
    text: '下载',
    beforeIcon: 'iconfont icon-download',
  });
  if (isRoot()) {
    data.push({
      id: '12',
      text: '上传封面',
      beforeIcon: 'iconfont icon-upload',
    });
    data.push({
      id: '13',
      text: '上传 MV',
      beforeIcon: 'iconfont icon-upload',
    });
    data.push({
      id: '8',
      text: '编辑歌曲信息',
      beforeIcon: 'iconfont icon-bianji',
    });
    if (sobj.mv) {
      data.push({
        id: '10',
        text: '删除 MV',
        beforeIcon: 'iconfont icon-shanchu',
      });
    }
  }
  if (idx != 2) {
    data.push({
      id: '15',
      text: '移除',
      beforeIcon: 'iconfont icon-shibai',
    });
  }
  if (isRoot()) {
    data.push({
      id: '9',
      text: '删除',
      beforeIcon: `iconfont icon-shanchu`,
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        shareSongList(e, [sobj.id]);
      } else if (id === '9') {
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
      } else if (id === '15') {
        let id = $songListWrap.listId;
        delSong(
          e,
          id,
          [sobj.id],
          '',
          () => {
            close();
          },
          `${sobj.artist} - ${sobj.title}`,
          loading
        );
      } else if (id === '7') {
        close();
        const fname = `${sobj.artist}-${sobj.title}`;
        downloadFile(
          [
            {
              fileUrl: sobj.uurl,
              filename: `${fname}.${_path.extname(sobj.url)[2]}`,
            },
          ],
          'music'
        );
      } else if (id === '6') {
        moveSongToList(e, 'all', [sobj.id]);
      } else if (id === '2') {
        close();
        copyText(sobj.artist + ' - ' + sobj.title);
      } else if (id === '8') {
        if (!isRoot()) return;
        editSongInfo(e, sobj);
      } else if (id === '3') {
        close();
        showEditLrc(sobj);
      } else if (id === '4') {
        close();
        const u1 = sobj.ppic;
        imgPreview([
          {
            u1,
            u2: `${u1}&t=1`,
          },
        ]);
      } else if (id === '5') {
        showSongInfo(e, sobj, '', loading);
      } else if (id === '10') {
        delMv(
          e,
          sobj.id,
          () => {
            close();
          },
          `${sobj.artist} - ${sobj.title}`,
          loading
        );
      } else if (id === '11') {
        const id = $songListWrap.listId;
        moveSongToList(e, id, [sobj.id]);
      } else if (id === '12') {
        close();
        updateSongCover(sobj);
      } else if (id === '13') {
        close();
        upMv(sobj);
      } else if (id === '14') {
        close();
        const list = musicList[idx].item || [];
        const toId = list[0].id;
        if (toId === sobj.id) return;
        reqPlayerMoveSong({
          listId: $songListWrap.listId,
          fromId: sobj.id,
          toId: toId,
        })
          .then((result) => {
            if (result.code === 1) {
              getSongList();
              return;
            }
          })
          .catch(() => {});
      }
    },
    `${sobj.artist} - ${sobj.title}`
  );
}
// 处理歌曲排序
function hdSongsSort(e) {
  const data = [
    {
      id: '1',
      text: '默认排序',
      param: { value: 'default' },
    },
    {
      id: '2',
      text: '按歌手名排序',
      param: { value: 'artist' },
    },
    {
      id: '3',
      text: '按歌曲名排序',
      param: { value: 'title' },
    },
    {
      id: '4',
      text: '按播放量排序',
      param: { value: 'playCount' },
    },
    {
      id: '5',
      text: '按收藏量排序',
      param: { value: 'collectCount' },
    },
  ];
  data.forEach((item) => {
    if (item.param.value === curSongListSort) {
      item.active = true;
    } else {
      item.active = false;
    }
  });
  rMenu.selectMenu(
    e,
    data,
    ({ resetMenu, close, id, param }) => {
      if (id) {
        curSongListSort = param.value;
        resetMenu(data);
        _setData('songListSort', curSongListSort);
        songPageNo = 1;
        close();
        $msuicContentBox.find('.list_items_wrap')[0].scrollTop = 0;
        if ($songListWrap.listId === 'all') {
          getSongs();
          return;
        }
        renderSongs();
      }
    },
    '选择歌曲排序方式'
  );
}
const playRandomList = debounce(
  function (e) {
    reqPlayerRandomList()
      .then((res) => {
        if (res.code === 1) {
          playSongListBtn(e, res.data);
        }
      })
      .catch(() => {});
  },
  1000,
  1
);
$msuicContentBox
  .find('.list_items_wrap')
  .on('click', '.edit_song_list_btn', function (e) {
    const id = $songListWrap.listId;
    const index = musicList.findIndex((item) => item.id === id);
    const { des, name, num } = musicList[index];
    editSongList(e, { name, des, num }, id);
  })
  .on('click', '.random_song_list_btn', playRandomList)
  .on('click', '.share_song_list_btn', function (e) {
    const id = $songListWrap.listId;
    const index = musicList.findIndex((item) => item.id === id);
    if (index < 0) return;
    const arr = musicList[index].item.map((item) => item.id);
    shareSongList(e, arr);
  })
  .on('click', '.upload_song_btn', async function (e) {
    // 上传歌曲
    _pop(
      {
        e,
        text: '请阅读上传指南后，再上传歌曲！',
        confirm: { text: '开始上传' },
        cancel: { text: '查看指南' },
      },
      (type) => {
        if (type === 'confirm') {
          upSong();
        } else if (type === 'cancel') {
          openInIframe('/note/?v=about', '关于');
        }
      }
    );
  })
  .on('scroll', hdSongsScroll)
  .on('click', '.play_list_btn', (e) => {
    playSongListBtn(e, temPlaylist);
  })
  .on('click', '.add_song_playing_btn', function (e) {
    //添加到播放列表
    const $this = $(this);
    const mobj = getSongInfo($this.parent().attr('data-id'));
    addSongToPlayList(e, [mobj]);
  })
  .on('click', '.checked_song_btn', switchSongChecked)
  .on('click', '.check_all_song_btn', function () {
    // 全选/全不选
    const $this = $(this),
      $checks = $msuicContentBox.find('.list_items_wrap .check_state');
    let num = 0;
    if ($this.attr('x') === '1') {
      $checks.attr('check', 'y').css('background-color', _d.checkColor);
      $this.attr('x', '2');
      num = $checks.length;
    } else {
      $checks.attr('check', 'n').css('background-color', 'transparent');
      $this.attr('x', '1');
      num = 0;
    }
    _msg.botMsg(`选中：${num}项`);
  })
  .on('click', '.cancel_btn', switchSongChecked)
  .on('click', '.share_all_song_btn', function (e) {
    const arr = getCheckSongs().map((item) => item.id);
    if (arr.length === 0) return;
    shareSongList(e, arr, switchSongChecked);
  })
  .on('click', '.download_song_btn', function () {
    const arr = getCheckSongs();
    if (arr.length === 0) return;
    downloadFile(
      arr.reduce((pre, cur) => {
        const fname = `${cur.artist}-${cur.title}`;
        pre.push({
          fileUrl: getFilePath(`/music/${cur.url}`),
          filename: `${fname}.${_path.extname(cur.url)[2]}`,
        });
        return pre;
      }, []),
      'music'
    );
    switchSongChecked();
  })
  .on(
    'click',
    '.collect_songs_btn',
    debounce(
      function () {
        //收藏选中
        const arr = getCheckSongs().map((item) => item.id);
        if (arr.length === 0) return;
        songCollect(arr);
      },
      1000,
      true
    )
  )
  .on('click', '.del_songs_btn', function (e) {
    // 删除选中
    const arr = getCheckSongs().map((item) => item.id);
    if (arr.length === 0) return;
    delSong(e, 'all', arr, 'del');
  })
  .on('click', '.remove_song_btn', function (e) {
    // 移除选中
    const id = $songListWrap.listId;
    const arr = getCheckSongs().map((item) => item.id);
    if (arr.length === 0 || id === 'all') return;
    delSong(e, id, arr, '');
  })
  .on('click', '.clear_all_song_btn', function (e) {
    // 清空
    const id = $songListWrap.listId;
    const idx = musicList.findIndex((item) => item.id === id);
    if (idx > 1 || id === 'all') return;
    delSong(
      e,
      id,
      musicList[idx].item.map((y) => y.id),
      'clean'
    );
  })
  .on('click', '.move_song_btn', function (e) {
    // 全选移动
    const id = $songListWrap.listId;
    const arr = getCheckSongs().map((item) => item.id);
    if (arr.length === 0) return;
    moveSongToList(e, id, arr);
  })
  .on('click', '.add_song_btn', function (e) {
    const arr = getCheckSongs();
    if (arr.length === 0) return;
    const data = [
      { id: '1', text: '播放列表' },
      { id: '2', text: '歌单' },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ e, close, id }) => {
        if (id === '1') {
          close();
          // 选中添加到播放列表
          addSongToPlayList(e, arr);
          switchSongChecked();
        } else if (id === '2') {
          moveSongToList(
            e,
            'all',
            arr.map((item) => item.id)
          );
        }
      },
      '添加歌曲到'
    );
  })
  .on('click', '.song_info_wrap', function (e) {
    const $this = $(this).parent();
    playSongList($this.attr('data-id'), e);
  })
  .on('click', '.artist_name_text', function (e) {
    e.stopPropagation();
    musicSearchInput.setValue(this.innerText).focus();
    getSearchSongs(1, 1);
  })
  .on('click', '.song_logo_box', function () {
    const $this = $(this).parent();
    playSongList($this.attr('data-id'));
    showLrcBox();
  })
  .on('click', '.play_mv', function (e) {
    const $this = $(this).parent();
    const sobj = getSongInfo($this.attr('data-id'));
    updateNewPlayList(temPlaylist);
    changePlayingAnimate(e);
    playMv(sobj);
  })
  .on(
    'click',
    '.like_hear',
    throttle(function () {
      const $this = $(this).parent();
      const issc = $this.attr('data-issc');
      const sobj = getSongInfo($this.attr('data-id'));
      if (issc === 'true') {
        songCloseCollect(sobj.id);
      } else {
        songCollect([sobj.id]);
      }
    }, 2000)
  )
  .on('click', '.set_song_btn', function (e) {
    const $this = $(this).parent();
    const sobj = hdSongInfo(getSongInfo($this.attr('data-id')));
    const idx = musicList.findIndex((item) => item.id === $songListWrap.listId);
    if (idx < 0) return;
    songMenu(e, idx, sobj);
  })
  .on('mouseenter', '.song_item', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    if ($songListWrap.listId) {
      songTooltip(getSongInfo(id));
    }
  })
  .on('mouseleave', '.song_item', function () {
    toolTip.hide();
  })
  .on('contextmenu', '.song_item', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    if ($songItemsBox._check) return;
    switchSongChecked();
    checkedSong(this.querySelector('.check_state'));
  })
  .on('click', '.sort_songs', hdSongsSort)
  .on('click', '.to_top', function () {
    $msuicContentBox.find('.list_items_wrap').scrollTop(0);
  })
  .on('click', '.to_bot', function () {
    $msuicContentBox
      .find('.list_items_wrap')
      .scrollTop(
        $msuicContentBox.find('.list_items_wrap').prop('scrollHeight')
      );
  })
  .on('click', '.get_location', function () {
    const idx = temPlaylist.findIndex(
      (item) => item.id === setPlayingSongInfo().id
    );
    if ($songListWrap.listId === 'all') {
      if (idx >= 0) {
        highlightPlayingSong(true);
        return;
      }
      playId = setPlayingSongInfo().id;
      getSongs(1);
      playId = '';
      return;
    }
    if (idx >= 0) {
      const page = Math.ceil((idx + 1) / musicPageSize);
      if (page != songPageNo) {
        songPageNo = page;
        renderSongs(1);
        return;
      }
      highlightPlayingSong(true);
    }
  })
  .on('click', '.music_list_setting', function (e) {
    creatSelect(
      e,
      { data: [50, 100, 200], active: musicPageSize },
      ({ value, close }) => {
        musicPageSize = value;
        _setData('songListPageSize', musicPageSize);
        songPageNo = 1;
        $msuicContentBox.find('.list_items_wrap')[0].scrollTop = 0;
        if ($songListWrap.listId === 'all') {
          getSongs();
        } else {
          renderSongs();
        }
        close();
      }
    );
  })
  .on('click', '.check_state', function () {
    checkedSong(this);
  });
// 选中歌曲
function checkedSong(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  const $checks = $msuicContentBox.find('.list_items_wrap .check_state'),
    $checkArr = $checks.filter((_, item) => $(item).attr('check') === 'y');
  _msg.botMsg(`选中：${$checkArr.length}项`);
}
// 长按选中
longPress(
  $msuicContentBox.find('.list_items_wrap')[0],
  '.song_item',
  function () {
    if ($songItemsBox._check) return;
    switchSongChecked();
    checkedSong(this.querySelector('.check_state'));
  }
);
export function songTooltip(obj) {
  const {
    title,
    artist,
    album,
    year,
    duration,
    create_at,
    play_count,
    collect_count,
  } = obj;
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
}
// 播放歌单歌曲
function playSongList(id, e) {
  const sobj = getSongInfo(id);
  updateNewPlayList(temPlaylist);
  if (setPlayingSongInfo().id === sobj.id) {
    changePlayState();
  } else {
    if (e) {
      changePlayingAnimate(e);
    }
    musicPlay(sobj);
  }
}
// 移动歌曲
(function () {
  let fromDom = null;
  $msuicContentBox
    .find('.list_items_wrap')
    .on('dragstart', '.song_item', function () {
      fromDom = this;
    })
    .on('drop', '.song_item', function () {
      if (fromDom) {
        const fid = $(fromDom).attr('data-id'),
          tid = $(this).attr('data-id'),
          id = $songListWrap.listId,
          index = musicList.findIndex((item) => item.id === id);
        if (
          curSongListSort === 'default' &&
          fid != tid &&
          index > 0 &&
          id !== 'all'
        ) {
          reqPlayerMoveSong({ listId: id, fromId: fid, toId: tid })
            .then((result) => {
              if (result.code === 1) {
                getSongList();
                return;
              }
            })
            .catch(() => {});
        }
        fromDom = null;
      }
    })
    .on('dragover', '.song_item', function (e) {
      e.preventDefault();
    });
})();

// 自动触发定时函数
function createAutoHide(timemax, el, ell, fn, fn2, fel) {
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
      if (_getTarget(this, e, ell) && isBigScreen()) return;
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
// 高亮正在播放歌曲
export function highlightPlayingSong(isPosition) {
  if (!$songListWrap.listId) return;
  if (temPlaylist != undefined) {
    if (
      $songListWrap.listId === 'all' ||
      temPlaylist.some((item) => item.id === setPlayingSongInfo().id)
    ) {
      $listItemsWarp.find('.get_location').stop().slideDown(_d.speed);
    } else {
      $listItemsWarp.find('.get_location').stop().slideUp(_d.speed);
    }
    const $songs = $msuicContentBox.find('.list_items_wrap .song_item');
    $songs.removeClass('active').find('.play_gif').removeClass('show');
    const idx = [].findIndex.call($songs, (item) => {
      const $item = $(item);
      return $item.attr('data-id') === setPlayingSongInfo().id;
    });

    if (idx >= 0) {
      if (isPosition) {
        const sp =
          $msuicContentBox.find('.list_items_wrap').scrollTop() +
          $songs.eq(idx).position().top -
          100;
        $msuicContentBox.find('.list_items_wrap').scrollTop(sp);
      }
      $songs.eq(idx).addClass('active').find('.play_gif').addClass('show');
    }
  }
}
$musicFootBox
  .on('click', '.right_btns .playing_list_btn', showPlayingList)
  .on('click', '.right_btns .next_btn', playNextSong)
  .on('click', '.right_btns .play_btn', changePlayState)
  .on('click', '.playing_song_info', showLrcBox);
// 底部歌曲信息滚动
const musicFootBoxContentScroll = new ContentScroll(
  $musicFootBox.find('.playing_song_info div')[0]
);
// 底部播放按钮暂停
export function musicFootBoxPlayBtnPause() {
  $musicFootBox
    .find('.right_btns .play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'none');
}
// 加载中
export function musicFootBoxPlayBtnLoading() {
  $musicFootBox
    .find('.right_btns .play_btn')
    .attr('class', 'play_btn iconfont icon-65zanting')
    .css('animation', 'fontcolor .5s infinite linear alternate');
}
// 开始播放
export function musicFootBoxPlayBtnPlaying() {
  $musicFootBox
    .find('.right_btns .play_btn')
    .attr('class', 'play_btn iconfont icon-zanting')
    .css('animation', 'none');
}
function initMusicTitleScroll() {
  musicFootBoxContentScroll.init(
    `${setPlayingSongInfo().artist} - ${setPlayingSongInfo().title}`
  );
  updateLrcHeadSongInfo(setPlayingSongInfo());
}
function closeMusicTitleScroll() {
  musicFootBoxContentScroll.close();
  closeLrcHeadContentScrollName();
}
// 更新歌曲信息
export async function updateSongInfo() {
  if (!musicPlayerIsHide()) {
    initMusicTitleScroll();
  }
  const songInfo = setPlayingSongInfo();
  const id = songInfo.id;
  await setAudioSrc(songInfo.uurl);
  $playingSongLogo
    .css('background-image', `url(${loadSvg})`)
    .removeClass('load');
  imgjz(songInfo.ppic)
    .then((cache) => {
      if (setPlayingSongInfo().id !== id) return;
      $playingSongLogo
        .css('background-image', `url(${cache})`)
        .addClass('load');
      setLrcBg(cache);
      changeMiniPlayerBg(cache);
      $musicPlayerBg
        .css('background-image', `url("${cache}")`)
        .removeClass('lrcbgss');
      _setTimeout(() => {
        if (setPlayingSongInfo().id !== id) return;
        notifyMusicControlPanel.updateMetadata({
          title: songInfo.title,
          artist: songInfo.artist,
          album: songInfo.album,
          artwork: [{ src: cache }],
        });
      }, 1000);
    })
    .catch(() => {
      if (setPlayingSongInfo().id !== id) return;
      $playingSongLogo
        .css('background-image', `url(${imgMusic})`)
        .addClass('load');
      setLrcBg(imgMusic);
      changeMiniPlayerBg(imgMusic);
      $musicPlayerBg
        .css('background-image', `url(${imgMusic})`)
        .removeClass('lrcbgss');
      _setTimeout(() => {
        if (setPlayingSongInfo().id !== id) return;
        notifyMusicControlPanel.updateMetadata({
          title: songInfo.title,
          artist: songInfo.artist,
          album: songInfo.album,
          artwork: [{ src: imgMusic }],
        });
      }, 1000);
    });
}
// 背景透明
export function musicPlayBgOpacity() {
  $musicPlayerBg.addClass('lrcbgss');
}
// 重置
export function resetPlayingSongLogo() {
  $playingSongLogo.css('animation', 'none');
}
// 停止
export function stopPlayingSongLogo() {
  $playingSongLogo.css('animation-play-state', 'paused');
}
// 开始
export function startPlayingSongLogo() {
  $playingSongLogo.css({
    animation: 'rotate360 8s infinite linear',
  });
}
$playingSongLogo.on('click', showLrcBox);
// 显示播放器
export function showMusicPlayerBox(cb) {
  hideRightMenu();
  if (!$musicPlayerBox._mflag) {
    createAutoHide(
      10,
      '.music_lrc_wrap',
      '.lrc_foot_wrap',
      debounce(showLrcFootWrap, 500, true),
      debounce(hideLrcFootWrap, 500, true),
      '.lrc_menu_wrap'
    );
    $musicPlayerBox._mflag = true;
  }
  const mBox = $musicPlayerBox[0];
  const isHide = musicPlayerIsHide();
  hideMiniPlayer();
  mBox.style.display = 'block';
  getSongList(cb);
  lrcScroll(true);
  if (!$musicPlayerBox._once) {
    $musicPlayerBox._once = true;
    toSetSize(mBox, 600, 800);
    toCenter(mBox);
    setPlayVolume();
  } else {
    myToRest(mBox);
  }
  setZidx(mBox, 'music', hideMusicPlayBox, playerIsTop);
  if (isHide) {
    const mini = $miniPlayer[0];
    let to = {
      transform: `translateY(100%) scale(0)`,
      opacity: 0,
    };
    if (isBigScreen() && !$miniPlayer.is(':hidden')) {
      const { x, y } = getCenterPointDistance(mBox, mini);
      to = {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      };
    }
    _animate(mBox, {
      to,
      direction: 'reverse',
    });
  }
}
// 播放歌曲音符落下动画
export const changePlayingAnimate = (function () {
  let timer = null;
  return function (e) {
    if (!e || !e.clientX) return;
    const $plb = $musicFootBox.find('.playing_list_btn');
    const x = e.clientX,
      y = e.clientY,
      { top, left } = _position($plb[0], true);
    const distance = Math.hypot(x - left, y - top);
    let duration = distance / 450;
    duration > 2 ? (duration = 2) : duration < 0.3 ? (duration = 0.3) : null;
    const oDiv = document.createElement('div');
    oDiv.className = 'iconfont icon-yinle1';
    oDiv.style.cssText = `
    color: var(--icon-color);
    font-size: 40px;
    position: fixed;
    top: ${y}px;
    left: ${x}px;
    pointer-events: none;
    z-index: 999;
    `;
    document.body.appendChild(oDiv);
    oDiv.clientHeight;
    oDiv.style.transition = `top ${duration}s ease-in-out, left ${duration}s ease-in-out`;
    oDiv.style.top = top + 'px';
    oDiv.style.left = left + 'px';
    _setTimeout(() => {
      oDiv.remove();
    }, duration * 1000);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(() => {
      $plb.addClass('run');
      _setTimeout(() => {
        $plb.removeClass('run');
      }, 1000);
    }, duration * 1000);
  };
})();
myDrag({
  trigger: $musicHeadWrap.find('.song_list_name')[0],
  target: $musicPlayerBox[0],
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
      target.dataset.x = x;
      target.dataset.y = y;
      myToRest(target, pointerX);
    }
  },
});
myResize({
  target: $musicPlayerBox[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    target.dataset.w = target.offsetWidth;
    target.dataset.h = target.offsetHeight;
    target.dataset.x = x;
    target.dataset.y = y;
  },
});
// 歌单
_mySlide({
  el: '.song_list_wrap',
  right() {
    musicBackBtn();
  },
});
// 歌单列表
_mySlide({
  el: '.list_items_wrap',
  right() {
    musicBackBtn();
  },
});
// 播放器底部控制
_mySlide({
  el: '.playing_song_info',
  right() {
    playPrevSong();
  },
  left() {
    playNextSong();
  },
});
// 层级
function musicPlayerIndex(e) {
  if (_getTarget(this, e, '.music_player_box')) {
    setZidx($musicPlayerBox[0], 'music', hideMusicPlayBox, playerIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  musicPlayerIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  musicPlayerIndex(e.changedTouches[0]);
});
