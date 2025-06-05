import $ from 'jquery';
import {
  throttle,
  debounce,
  _getTarget,
  longPress,
  isMobile,
  getFilePath,
  LazyLoad,
  _mySlide,
  myShuffle,
  loadingImg,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import {
  changePlayingAnimate,
  getCollectSongs,
  hdLoadedSong,
  hdMusicImgCache,
  moveSongToList,
  musicLoadImg,
  setCurPlayingList,
  setSearchMusicInputValue,
  shareSongList,
  songCloseCollect,
  songCollect,
  songTooltip,
} from './index.js';
import {
  changePlayState,
  musicPlay,
  setPlayingSongInfo,
  setSongPlayMode,
} from './lrc.js';
import { playMv } from './widget.js';
import { reqPlayerPlayList } from '../../../api/player.js';
import pagination from '../../../js/plugins/pagination/index.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { showSongInfo } from '../../../js/utils/showinfo.js';
import { _tpl, deepClone } from '../../../js/utils/template.js';
import { getSearchSongs } from './search.js';
import { BoxSelector } from '../../../js/utils/boxSelector.js';
const $playingListWrap = $('.music_player_box .playing_list_mask'),
  $pMusicListBox = $playingListWrap.find('.p_music_list_wrap');
let playingList = [];
// 设置播放列表
export function setPlayingList(val) {
  if (val === undefined) {
    return playingList;
  }
  playingList = val;
}
let playingPageNo = 1;
let playingPageSize = 100;
const playListLazyImg = new LazyLoad();
// 播放列表歌曲信息
function getPlayingItemData(id) {
  return playingList.find((item) => item.id === id) || {};
}
// 对比播放列表
export function diffPlayingList(arr) {
  const res =
    playingList.length !== arr.length ||
    !arr.every(
      (item, idx) =>
        item.id === playingList[idx].id &&
        item.title === playingList[idx].title &&
        item.artist === playingList[idx].artist
    );
  return res;
}
// 更新新播放列表
export function updateNewPlayList(list) {
  if (diffPlayingList(list)) {
    setCurPlayingList(
      setSongPlayMode() === 'random'
        ? myShuffle(deepClone(list))
        : deepClone(list)
    );
    playingList = deepClone(list);
    updatePlayingList(1);
  }
}
// 显示播放列表
export function showPlayingList() {
  loadingImg($pMusicListBox.find('.p_foot')[0]);
  $playingListWrap.stop().fadeIn(100, () => {
    $pMusicListBox.stop().slideDown(_d.speed, async () => {
      if (!playingList) {
        playingList = [];
      }
      const idx = playingList.findIndex(
        (v) => setPlayingSongInfo().id === v.id
      );
      if (idx >= 0) {
        playingPageNo = Math.ceil((idx + 1) / playingPageSize);
      } else {
        playingPageNo = 1;
      }
      await renderPlayingList();
      playingListHighlight(true);
    });
  });
}
const playListBoxSelector = new BoxSelector($pMusicListBox.find('.p_foot')[0], {
  selectables: '.song_item',
  onSelectStart({ e }) {
    const item = _getTarget($pMusicListBox[0], e, '.song_item');
    if (item) return true;
  },
  onSelectEnd() {
    updateSelectInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_state');
      const isChecked = $cItem.attr('check') === 'y';
      if (needCheck && !isChecked) {
        $cItem
          .css({
            'background-color': _d.checkColor,
          })
          .attr('check', 'y');
      } else if (!needCheck && isChecked && !isKeepOld) {
        $cItem
          .css({
            'background-color': 'transparent',
          })
          .attr('check', 'n');
      }
    });
  },
});
playListBoxSelector.stop();
// 生成播放列表
export async function renderPlayingList() {
  if ($pMusicListBox.is(':hidden')) return;
  stopSelect();
  const scObj = getCollectSongs();
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
  let totalPage = Math.ceil(playingList.length / playingPageSize);
  playingPageNo < 1
    ? (playingPageNo = totalPage)
    : playingPageNo > totalPage
    ? (playingPageNo = 1)
    : null;
  let arr = playingList.slice(
    (playingPageNo - 1) * playingPageSize,
    playingPageNo * playingPageSize
  );
  arr = await hdLoadedSong(arr);
  const html = _tpl(
    `
    <li v-for="{title,artist,mv,id,pic,isLoaded} in arr" class="song_item" cursor="y" :data-id="id" :data-issc="issc(id)">
      <div cursor="y" check="n" class="check_state"></div>
      <div v-if="isLoaded" class="downloaded iconfont icon-jiaobiao"></div>
      <div class="logo_wrap">
        <div class="logo" :data-src="getFilePath('/music/'+pic, 1)">
          <div class="play_gif"></div>
        </div>
      </div>
      <div class="song_info_wrap">
        <span class = "song_name">{{title}}</span>
        <span class="artist_name">
          <i class="artist_name_text">{{artist}}</i>
        </span>
      </div>
      <div v-if="mv" class="play_mv iconfont icon-shipin2"></div>
      <div class="like_hear iconfont {{issc(id) ? 'icon-hear-full active' : 'icon-hear'}}"></div>
      <div cursor="y" class="del iconfont icon-close-bold"></div>
    </li>
    <div v-if="totalPage > 1" v-html="getPaging()" style="padding:2rem 0;text-align:center;line-height: 2.6rem;" class="playing_list_paging no_select"></div>
    `,
    {
      arr,
      issc(id) {
        return scObj.hasOwnProperty(id);
      },
      getFilePath,
      totalPage,
      getPaging() {
        return pgnt.getHTML({
          pageNo: playingPageNo,
          total: playingList.length,
        });
      },
    }
  );
  $pMusicListBox.find('.p_foot').html(html);
  playListLazyImg.bind(
    hdMusicImgCache(
      $pMusicListBox.find('.p_foot')[0].querySelectorAll('.logo')
    ),
    musicLoadImg
  );
}
// 分页
const pgnt = pagination($pMusicListBox[0], {
  pageSize: playingPageSize,
  small: true,
  showTotal: false,
  select: [],
  toTop: false,
  async change(val) {
    playingPageNo = val;
    $pMusicListBox.find('.p_foot')[0].scrollTop = 0;
    await renderPlayingList();
    playingListHighlight();
  },
});
// 开启/关闭播放列表选中
function switchPlayingChecked() {
  if (isCheckedPlayingList()) {
    stopSelect();
  } else {
    startSelect();
  }
}
function isCheckedPlayingList() {
  return !$pMusicListBox.find('.p_foot_menu').is(':hidden');
}
function stopSelect() {
  $pMusicListBox
    .find('.p_foot_menu')
    .stop()
    .slideUp(_d.speed, () => {
      playListBoxSelector.stop();
    });
  $pMusicListBox.find('.check_state').css('display', 'none');
}
function startSelect() {
  $pMusicListBox
    .find('.p_foot_menu')
    .stop()
    .slideDown(_d.speed, () => {
      playListBoxSelector.start();
    })
    .find('.flex_wrap div')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  $pMusicListBox
    .find('.check_state')
    .css({
      display: 'block',
      'background-color': 'transparent',
    })
    .attr('check', 'n');
}
// 长按选中
longPress($pMusicListBox.find('.p_foot')[0], '.song_item', function () {
  if (!isCheckedPlayingList()) {
    startSelect();
    checkedPlayingListItem(this.querySelector('.check_state'));
  }
});
$pMusicListBox
  .on('click', '.check_btn', switchPlayingChecked)
  .on('click', '.p_foot_menu .flex_wrap div', function () {
    const $this = $(this);
    let state = $this.attr('check');
    state = state === 'y' ? 'n' : 'y';
    const $item = $pMusicListBox.find('.check_state');
    $this.attr({
      class:
        state === 'y'
          ? 'iconfont icon-xuanzeyixuanze'
          : 'iconfont icon-xuanzeweixuanze',
      check: state,
    });
    $item
      .attr('check', state)
      .css('background-color', state === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${state === 'y' ? $item.length : 0}项`);
  })
  .on('click', '.delete_btn', async function () {
    const arr = getPlayingListCheck();
    if (arr.length === 0) return;
    const obj = {};
    arr.forEach((item) => {
      obj[item] = true;
    });
    playingList = playingList.filter((v) => !obj[v.id]);
    setCurPlayingList(setCurPlayingList().filter((v) => !obj[v.id]));
    await renderPlayingList();
    playingListHighlight();
    updatePlayingList();
  })
  .on('click', '.move_btn', function (e) {
    const arr = getPlayingListCheck();
    if (arr.length === 0) return;
    moveSongToList(e, 'all', arr);
  })
  .on('click', '.collect_songs_btn', function () {
    const arr = getPlayingListCheck();
    if (arr.length === 0) return;
    songCollect(arr);
  })
  .on('click', '.close', stopSelect)
  .on('click', '.clear_playing_list', function () {
    if (playingList.length === 0) return;
    playingList = [];
    setCurPlayingList([]);
    renderPlayingList();
    updatePlayingList();
  })
  .on('click', '.share_playing_list', function (e) {
    const arr = playingList.map((item) => item.id);
    if (arr.length === 0) {
      _msg.error('播放列表为空');
      return;
    }
    shareSongList(e, arr);
  });
// 播放播放列表歌曲
function playPlayingList(id, e) {
  let obj = getPlayingItemData(id);
  if (setPlayingSongInfo().id === obj.id) {
    changePlayState();
    return;
  }
  changePlayingAnimate(e);
  musicPlay(obj);
}
// 选中播放列表歌曲
function checkedPlayingListItem(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateSelectInfo();
}
function updateSelectInfo() {
  const $item = $pMusicListBox.find('.song_item');
  const $checkArr = $item.filter((_, item) => {
    const $item = $(item);
    return (
      $item.attr('data-id') && $item.find('.check_state').attr('check') === 'y'
    );
  });
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $item.length) {
    $pMusicListBox.find('.p_foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $pMusicListBox.find('.p_foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
// 获取选中歌曲
function getPlayingListCheck() {
  const res = [];
  $pMusicListBox.find('.check_state').each((_, item) => {
    if (item.getAttribute('check') === 'y') {
      res.push(item.parentNode.dataset.id);
    }
  });
  return res;
}
$pMusicListBox
  .find('.p_foot')
  .on('click', '.check_state', function () {
    checkedPlayingListItem(this);
  })
  .on('contextmenu', '.song_item', function (e) {
    e.preventDefault();
    if (isMobile() || isCheckedPlayingList()) return;
    startSelect();
    checkedPlayingListItem(this.querySelector('.check_state'));
  })
  .on('mouseenter', '.song_item .logo_wrap', function () {
    songTooltip(getPlayingItemData($(this).parent().attr('data-id')));
  })
  .on('mouseleave', '.song_item .logo_wrap', function () {
    toolTip.hide();
  })
  .on('click', '.song_info_wrap', function (e) {
    const $this = $(this).parent();
    playPlayingList($this.attr('data-id'), e);
  })
  .on('click', '.artist_name_text', function (e) {
    e.stopPropagation();
    setSearchMusicInputValue(this.innerText);
    getSearchSongs(1, 1);
    $pMusicListBox.css('display', 'none').find('.p_foot').html('');
    $playingListWrap.css('display', 'none');
  })
  .on('click', '.play_mv', function (e) {
    const $this = $(this).parent();
    const sobj = getPlayingItemData($this.attr('data-id'));
    changePlayingAnimate(e);
    playMv(sobj);
  })
  .on('click', '.del', async function (e) {
    e.stopPropagation();
    const $this = $(this);
    const id = $this.parent().attr('data-id');
    playingList = playingList.filter((v) => v.id !== id);
    setCurPlayingList(setCurPlayingList().filter((v) => v.id !== id));
    await renderPlayingList();
    playingListHighlight();
    updatePlayingList();
  })
  .on('click', '.logo_wrap', function (e) {
    const $this = $(this).parent();
    showSongInfo(e, getPlayingItemData($this.attr('data-id')));
  })
  .on(
    'click',
    '.like_hear',
    throttle(function () {
      const $this = $(this).parent();
      const issc = $this.attr('data-issc');
      const sobj = getPlayingItemData($this.attr('data-id'));
      if (issc === 'true') {
        songCloseCollect(sobj.id);
      } else {
        songCollect([sobj.id]);
      }
    }, 2000)
  );
// 更新播放列表
export const updatePlayingList = debounce(function (msg) {
  if (playingList.length > _d.maxSongList) {
    _msg.error(`播放列表限制${_d.maxSongList}首`);
    playingList = playingList.slice(0, _d.maxSongList);
  }
  reqPlayerPlayList({
    data: playingList.map((item) => item.id),
  })
    .then(() => {
      if (msg) {
        _msg.msg({
          message: `已创建新播放列表，包含 ${playingList.length} 首歌曲`,
          type: 'warning',
          icon: 'iconfont icon-31liebiao',
          duration: 5000,
        });
      }
    })
    .catch(() => {});
}, 1000);
// 高亮正在播放歌曲
export function playingListHighlight(isPosition) {
  if (
    $pMusicListBox.is(':hidden') ||
    !setPlayingSongInfo().hash ||
    !playingList
  )
    return;
  const $song_item = $pMusicListBox.find('.p_foot').find('.song_item');
  $song_item.removeClass('active').find('.play_gif').removeClass('show');
  const idx = Array.prototype.findIndex.call(
    $song_item,
    (item) => item.dataset.id === setPlayingSongInfo().id
  );
  if (idx < 0) return;
  const cur = $song_item.eq(idx);
  if (isPosition) {
    const sp = $pMusicListBox.find('.p_foot').scrollTop() + cur.position().top;
    $pMusicListBox.find('.p_foot').scrollTop(sp);
  }
  cur.addClass('active').find('.play_gif').addClass('show');
}
// 关闭图片加载
export function unBindPlayListLazyImg() {
  playListLazyImg.unBind();
}
//隐藏播放列表
$playingListWrap.on('click', function (e) {
  if (_getTarget(this, e, '.playing_list_mask', 1)) {
    $pMusicListBox.stop().slideUp(_d.speed, () => {
      $pMusicListBox.find('.p_foot').html('');
      $playingListWrap.stop().fadeOut(100);
      unBindPlayListLazyImg();
    });
  }
});
_mySlide({
  el: '.playing_list_mask',
  right() {
    if (isCheckedPlayingList()) return;
    $pMusicListBox.stop().slideUp(_d.speed, () => {
      $pMusicListBox.find('.p_foot').html('');
      $playingListWrap.stop().fadeOut(100);
    });
  },
});
