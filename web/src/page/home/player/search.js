import $ from 'jquery';
import {
  getSuffix,
  throttle,
  debounce,
  _getTarget,
  copyText,
  downloadFile,
  imgPreview,
  loadingImg,
  hdTitleHighlight,
  getFilePath,
  LazyLoad,
  _mySlide,
  isRoot,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import {
  addSongToPlayList,
  changePlayingAnimate,
  delMv,
  delSong,
  editSongInfo,
  getCollectSongs,
  moveSongToList,
  musicLoadImg,
  musicPlayerIsHide,
  setSearchMusicInputValue,
  shareSongList,
  songCloseCollect,
  songCollect,
  songTooltip,
  upMv,
  updateSongCover,
} from './index.js';
import {
  changePlayState,
  hdSongInfo,
  musicPlay,
  setPlayingSongInfo,
} from './lrc.js';
import { playMv, showEditLrc } from './widget.js';
import { updateNewPlayList } from './playlist.js';
import { reqPlayerSearch } from '../../../api/player.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { showSongInfo } from '../../../js/utils/showinfo.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
const $searchMusicWrap = $('.music_player_box .search_music_wrap');
let searchMusicList = [];
let searchMusicPageNo = 1;
// 搜索列表是隐藏
export function searchWrapIsHide() {
  return $searchMusicWrap.is(':hidden');
}
// 解绑图片加载
export function unBindSearchListLazyImg() {
  searchListLazyImg.unBind();
}
// 隐藏搜索列表
export function hideMusicSearchList() {
  searchMusicList = [];
  $searchMusicWrap.css('display', 'none').find('ul').html('');
  unBindSearchListLazyImg();
}
// 显示搜索列表
export function showMusicSearchList() {
  $searchMusicWrap.css('display', 'block');
  searchMusicPageNo = 1;
  loadingImg($searchMusicWrap.find('ul')[0]);
}
const searchListLazyImg = new LazyLoad();
function getSearchSongItemData(id) {
  return searchMusicList.find((item) => item.id == id);
}
$searchMusicWrap.splitWord = '';
// 获取搜索列表
export const _getSearchSongs = debounce(getSearchSongs, 1000);
export function getSearchSongs(update) {
  const word = setSearchMusicInputValue();
  if (word !== '') {
    if (word.length > 100) {
      _msg.error('搜索内容过长');
      return;
    }
    reqPlayerSearch({ word })
      .then((result) => {
        if (parseInt(result.code) === 0) {
          const { list: arr, splitWord } = result.data;
          searchMusicList = arr;
          $searchMusicWrap.splitWord = splitWord;
          if (arr.length > 0) {
            if (!update) {
              $searchMusicWrap.find('ul').html('');
            }
            renderSearchSongs(arr, update);
          } else {
            $searchMusicWrap
              .find('ul')
              .html(
                `<p style="padding: 20px 0;text-align: center;pointer-events: none;">${_d.emptyList}</p>`
              );
          }
          return;
        }
      })
      .catch(() => {});
  }
}
// 生成搜索列表
function renderSearchSongs(list, update) {
  const val = $searchMusicWrap.splitWord;
  let arr = [];
  if (update) {
    arr = list.slice(0, searchMusicPageNo * 50);
  } else {
    arr = list.slice((searchMusicPageNo - 1) * 50, searchMusicPageNo * 50);
  }
  if (arr.length == 0) return;
  if (musicPlayerIsHide() || searchWrapIsHide()) return;
  const scObj = getCollectSongs();
  let str = '';
  arr.forEach((v) => {
    const { artist, title, mv, id, pic } = v;
    let issc = scObj.hasOwnProperty(id);
    str += `<li class="song_item" data-id="${id}" data-issc="${issc}" cursor>
          <div class="add_palying_list iconfont icon-icon-test"></div>
          <div class="logo_wrap">
          <div class="logo" data-src="${getFilePath(`/music/${pic}`, 1)}"></div>
          </div>
          <div class="song_info_wrap">
            <span class="song_name">${hdTitleHighlight(val, title)}</span>
            <span class="artist_name">${hdTitleHighlight(val, artist)}</span>
          </div>
          ${mv ? `<div class="play_mv iconfont icon-shipin2"></div>` : ''}
          <div class="like_hear iconfont ${
            issc ? 'icon-hear-full active' : 'icon-hear'
          }"></div>
          <div class="set_menu iconfont icon-icon"></div>
        </li>`;
  });
  if (update) {
    $searchMusicWrap.find('ul').html(str);
  } else {
    $searchMusicWrap.find('ul').append(str);
  }
  searchListLazyImg.bind(
    $searchMusicWrap.find('ul')[0].querySelectorAll('.logo'),
    musicLoadImg
  );
}
// 歌曲菜单
function searchListSongSetting(e, sobj) {
  sobj = hdSongInfo(sobj);
  let data = [
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
      beforeIcon: 'iconfont icon-icon-test',
    },
    {
      id: '7',
      text: '下载',
      beforeIcon: 'iconfont icon-xiazai1',
    },
  ];
  if (isRoot()) {
    data.push({
      id: '11',
      text: '上传封面',
      beforeIcon: 'iconfont icon-shangchuan1',
    });
    data.push({
      id: '12',
      text: '上传 MV',
      beforeIcon: 'iconfont icon-shangchuan1',
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
    data.push({
      id: '9',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id }) => {
      if (id == '1') {
        shareSongList(e, [sobj.id]);
      } else if (id == '9') {
        delSong(
          e,
          'all',
          [sobj.id],
          'del',
          () => {
            close();
          },
          `${sobj.artist} - ${sobj.title}`
        );
      } else if (id == '7') {
        close();
        let fname = `${sobj.artist} - ${sobj.title}`;
        downloadFile(sobj.uurl, `${fname}.${getSuffix(sobj.url)[1]}`);
      } else if (id == '6') {
        moveSongToList(e, 'all', [sobj.id]);
      } else if (id == '2') {
        close();
        copyText(sobj.artist + ' - ' + sobj.title);
      } else if (id == '8') {
        if (!isRoot()) return;
        editSongInfo(e, sobj);
      } else if (id == '3') {
        close();
        showEditLrc(sobj);
      } else if (id == '4') {
        close();
        sobj = hdSongInfo(sobj);
        let u1 = sobj.ppic;
        imgPreview([
          {
            u1,
            u2: `${u1}&t=1`,
          },
        ]);
      } else if (id == '5') {
        showSongInfo(e, sobj);
      } else if (id == '10') {
        delMv(
          e,
          sobj.id,
          () => {
            close();
          },
          `${sobj.artist} - ${sobj.title}`
        );
      } else if (id == '11') {
        close();
        updateSongCover(sobj);
      } else if (id == '12') {
        close();
        upMv(sobj);
      }
    },
    `${sobj.artist} - ${sobj.title}`
  );
}
// 播放搜索列表
function playSearchList(id, e) {
  const obj = getSearchSongItemData(id);
  updateNewPlayList(searchMusicList);
  if (setPlayingSongInfo().id == obj.id) {
    changePlayState();
    return;
  }
  changePlayingAnimate(e);
  musicPlay(obj);
}
$searchMusicWrap
  .find('ul')
  .on(
    'scroll',
    debounce(function () {
      if (
        searchMusicList.length > 0 &&
        this.clientHeight + this.scrollTop > this.scrollHeight - 50
      ) {
        searchMusicPageNo++;
        renderSearchSongs(searchMusicList);
      }
    }, 500)
  )
  .on('click', '.song_info_wrap', function (e) {
    const $this = $(this).parent();
    playSearchList($this.attr('data-id'), e);
  })
  .on('click', '.set_menu', function (e) {
    const $this = $(this).parent();
    const sobj = getSearchSongItemData($this.attr('data-id'));
    searchListSongSetting(e, sobj);
  })
  .on('click', '.add_palying_list', function (e) {
    const $this = $(this).parent();
    const mobj = getSearchSongItemData($this.attr('data-id'));
    addSongToPlayList(e, [mobj]);
  })
  .on('mouseenter', '.song_item', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    songTooltip(getSearchSongItemData(id));
  })
  .on('mouseleave', '.song_item', function () {
    toolTip.hide();
  })
  .on(
    'click',
    '.like_hear',
    throttle(function () {
      const $this = $(this).parent();
      const issc = $this.attr('data-issc');
      const sobj = getSearchSongItemData($this.attr('data-id'));
      if (issc == 'true') {
        songCloseCollect(sobj.id);
      } else {
        songCollect([sobj.id]);
      }
    }, 2000)
  )
  .on('click', '.play_mv', function (e) {
    const $this = $(this).parent();
    const sobj = getSearchSongItemData($this.attr('data-id'));
    updateNewPlayList(searchMusicList);
    changePlayingAnimate(e);
    playMv(sobj);
  })
  .on('click', '.logo_wrap', function (e) {
    const $this = $(this).parent();
    showSongInfo(e, getSearchSongItemData($this.attr('data-id')));
  });
$searchMusicWrap.on('click', function (e) {
  if (_getTarget(this, e, '.search_music_wrap', 1)) {
    setSearchMusicInputValue('');
  }
});
_mySlide({
  el: '.search_music_wrap',
  right() {
    setSearchMusicInputValue('');
  },
});
