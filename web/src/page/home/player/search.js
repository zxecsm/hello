import $ from 'jquery';
import {
  throttle,
  _getTarget,
  copyText,
  downloadFile,
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
  hdLoadedSong,
  hdMusicImgCache,
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
import { _tpl } from '../../../js/utils/template.js';
import _path from '../../../js/utils/path.js';
import pagination from '../../../js/plugins/pagination/index.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
const $searchMusicWrap = $('.music_player_box .search_music_wrap');
let searchMusicList = [];
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
const searchListLazyImg = new LazyLoad();
function getSearchSongItemData(id) {
  return searchMusicList.find((item) => item.id === id) || {};
}
let searchMusicPageNo = 1;
// 获取搜索列表
export function getSearchSongs(top, pageNo = searchMusicPageNo) {
  const word = setSearchMusicInputValue();
  if (word !== '') {
    if (word.length > 100) {
      _msg.error('搜索内容过长');
      return;
    }
    $searchMusicWrap.css('display', 'block');
    if (top) {
      loadingImg($searchMusicWrap.find('ul')[0]);
    }
    reqPlayerSearch({ word, pageNo })
      .then(async (result) => {
        if (result.code === 1) {
          const { splitWord, total, totalPage, pageNo, data } = result.data;
          searchMusicPageNo = pageNo;
          searchMusicList = data;
          if (musicPlayerIsHide() || searchWrapIsHide()) return;
          const scObj = getCollectSongs();
          searchMusicList = await hdLoadedSong(searchMusicList);
          const html = _tpl(
            `
            <p v-if="total === 0" style="padding: 2rem 0;text-align: center;pointer-events: none;">${_d.emptyList}</p>
            <template v-else>
              <li v-for="{artist,title,mv,id,isLoaded} in searchMusicList" class="song_item" :data-id="id" :data-issc="issc(id)" cursor="y">
                <div v-if="isLoaded" class="downloaded iconfont icon-jiaobiao"></div>
                <div class="logo_wrap">
                  <div class="logo" :data-src="getFilePath('/music/pic/'+id, { w: 256 })"></div>
                </div>
                <div class="song_info_wrap">
                  <span v-html="hdTitleHighlight(splitWord, title)" class="song_name"></span>
                  <span v-html="hdTitleHighlight(splitWord, artist)" class="artist_name"></span>
                </div>
                <div v-if="mv" class="play_mv iconfont icon-shipin2"></div>
                <div class="add_palying_list iconfont icon-icon-test"></div>
                <div class="like_hear iconfont {{issc(id) ? 'icon-hear-full active' : 'icon-hear'}}"></div>
                <div class="set_menu iconfont icon-maohao"></div>
              </li>
              <div v-if="totalPage > 1" v-html="getPaging()" style="padding:2rem 0;text-align:center;line-height: 2.6rem;" class="playing_list_paging no_select"></div>
            </template>`,
            {
              _d,
              searchMusicList,
              issc(id) {
                return scObj.hasOwnProperty(id);
              },
              getFilePath,
              totalPage,
              total,
              hdTitleHighlight,
              splitWord,
              getPaging() {
                return pgnt.getHTML({
                  pageNo,
                  total,
                });
              },
            }
          );
          $searchMusicWrap.find('ul').html(html);
          searchListLazyImg.bind(
            hdMusicImgCache(
              $searchMusicWrap.find('ul')[0].querySelectorAll('.logo')
            ),
            musicLoadImg
          );
          return;
        }
      })
      .catch(() => {});
  }
}
// 分页
const pgnt = pagination($searchMusicWrap[0], {
  pageSize: 100,
  small: true,
  showTotal: false,
  select: [],
  toTop: false,
  change(val) {
    getSearchSongs(1, val);
  },
});
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
      beforeIcon: 'iconfont icon-download',
    },
  ];
  if (isRoot()) {
    data.push({
      id: '11',
      text: '上传封面',
      beforeIcon: 'iconfont icon-upload',
    });
    data.push({
      id: '12',
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
    data.push({
      id: '9',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
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
      } else if (id === '7') {
        close();
        let fname = `${sobj.artist} - ${sobj.title}`;
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
        sobj = hdSongInfo(sobj);
        let u1 = sobj.ppic;
        imgPreview(
          [
            {
              u1,
              u2: getFilePath(`/music/pic/${sobj.id}`, { w: 256 }),
            },
          ],
          0,
          { x: e.clientX, y: e.clientY }
        );
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
        close();
        updateSongCover(sobj);
      } else if (id === '12') {
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
  if (setPlayingSongInfo().id === obj.id) {
    changePlayState();
    return;
  }
  changePlayingAnimate(e);
  musicPlay(obj);
}
$searchMusicWrap
  .find('ul')
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
  .on('mouseenter', '.song_item .logo_wrap', function () {
    songTooltip(getSearchSongItemData($(this).parent().attr('data-id')));
  })
  .on('mouseleave', '.song_item .logo_wrap', function () {
    toolTip.hide();
  })
  .on(
    'click',
    '.like_hear',
    throttle(function () {
      const $this = $(this).parent();
      const issc = $this.attr('data-issc');
      const sobj = getSearchSongItemData($this.attr('data-id'));
      if (issc === 'true') {
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
    hideMusicSearchList();
  }
});
_mySlide({
  el: '.search_music_wrap',
  right() {
    setSearchMusicInputValue('');
    hideMusicSearchList();
  },
});
