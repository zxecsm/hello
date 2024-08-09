import $ from 'jquery';
import imgMrLogo from '../../../images/img/mrlogo.png';
import imgTianjia from '../../../images/img/tianjia.png';
import {
  myOpen,
  _setData,
  _getData,
  debounce,
  _getTarget,
  imgjz,
  isurl,
  encodeHtml,
  loadingImg,
  wrapInput,
  longPress,
  isMobile,
  hdTitleHighlight,
  getIn,
  getWordCount,
  hdPath,
  LazyLoad,
  copyText,
  throttle,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import {
  addBookMark,
  bookMarkSetting,
  delBm,
  dragMoveBookmark,
  moveBookMark,
  setBookMark,
  tooltipBookmark,
} from '../aside/index.js';
import { reqBmkList } from '../../../api/bmk.js';
import {
  reqSearchConfig,
  reqSearchDelete,
  reqSearchList,
  reqSearchSave,
} from '../../../api/search.js';
import { setCurChatAccount, showChatRoom } from '../chat/index.js';
import { renderPlayingList, updateNewPlayList } from '../player/playlist.js';
import { showMusicPlayerBox } from '../player/index.js';
import { musicPlay } from '../player/lrc.js';
import { backWindow, setZidx } from '../backWindow.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { showBmk, showHistory } from '../rightSetting/index.js';
const $searchBoxMask = $('.search_box_mask'),
  $searchLogo = $searchBoxMask.find('.search_logo'),
  $searchInpWrap = $searchBoxMask.find('.search_inp_wrap'),
  $homeBmWrap = $searchBoxMask.find('.home_bm_wrap'),
  $homeFootMenu = $searchBoxMask.find('.home_foot_menu'),
  $searchBoxBtn = $('.search_box_btn'),
  $pageBg = $('.page_bg');
let curSearchIdx = _getData('searchengine'),
  searchWordIdx = _getData('searchWordIdx');
let searchList = [];
// 底部菜单是隐藏
export function homeFootMenuIsHide() {
  return $homeFootMenu.is(':hidden');
}
// 搜索框是隐藏
export function searchBoxIsHide() {
  return $searchBoxMask.is(':hidden');
}
// 拖动移动书签
~(function () {
  let fromDom = null;
  $homeBmWrap
    .find('ul')
    .on('dragstart', '.home_bm_item', function () {
      fromDom = this;
    })
    .on('drop', '.home_bm_item', function () {
      if (fromDom) {
        let fromId = $(fromDom).attr('data-id'),
          toId = $(this).attr('data-id');
        if (fromId && toId && fromId !== toId) {
          dragMoveBookmark('home', fromId, toId);
        }
        fromDom = null;
      }
    })
    .on('dragover', '.home_bm_item', function (e) {
      e.preventDefault();
    });
})();
// 书签列表
export function getHomeBmList() {
  if (searchBoxIsHide()) return;
  if ($homeBmWrap.find('ul').children().length === 0) {
    bmsLoading();
  }
  reqBmkList({ id: 'home' })
    .then((result) => {
      if (result.code === 0) {
        setBookMark(result.data);
        renderHomeBmList();
        return;
      }
    })
    .catch(() => {});
}
// 加载
function bmsLoading() {
  let str = '';
  let color = '#ffffff54';
  new Array(21).fill(null).forEach(() => {
    str += `<li style="pointer-events: none;" class="home_bm_item">
              <div style="background-color:${color};background-image:none;" class="home_bm_logo"></div>
              <p></p>
              </li>`;
  });
  $homeBmWrap.find('ul').html(str);
}
// 获取书签信息
function getHomeBmData(id) {
  return setBookMark().home.find((item) => item.id == id);
}
// 选中书签
function getHomeCheckBmItem() {
  const $homeBmItem = $homeBmWrap.find('.home_bm_item'),
    $checkArr = $homeBmItem.filter(
      (_, item) => $(item).find('.check_home_bm').attr('check') === 'y'
    );
  const arr = [];
  $checkArr.each((i, v) => {
    const $v = $(v);
    arr.push($v.attr('data-id'));
  });
  return arr;
}
// 显示底部菜单
export function showHomeFootMenu() {
  $homeFootMenu.stop().slideDown(_d.speed).find('div').attr({
    class: 'iconfont icon-xuanzeweixuanze',
    check: 'n',
  });
}
// 生成列表
function renderHomeBmList() {
  if (searchBoxIsHide()) return;
  $homeFootMenu.stop().slideUp(_d.speed).find('div').attr({
    class: 'iconfont icon-xuanzeweixuanze',
    check: 'n',
  });
  let list = setBookMark().home,
    str = '';
  list.forEach((v) => {
    let name = encodeHtml(v.name);
    str += `<li class="home_bm_item" data-id="${v.id}" draggable="true">
              <div cursor check="n" class="check_home_bm"></div>
              <div class="home_bm_logo" cursor></div>
              <p cursor>${name}</p>
              </li>`;
  });
  str += `<li class="home_bm_item">
                <div cursor x="add" style="background-image:url(${imgTianjia})" class="home_bm_logo">
                </div>
                <p></p>
              </li>`;
  $homeBmWrap.find('ul').html(str);
  lazyLoadHomeBmLogo();
}
// 加载logo
const homeLoadImg = new LazyLoad();
function lazyLoadHomeBmLogo() {
  homeLoadImg.bind(
    $homeBmWrap.find('ul')[0].querySelectorAll('.home_bm_item'),
    (item) => {
      const $item = $(item);
      const flag = $item.find('.home_bm_logo').attr('x');
      if (flag == 'add') return;
      let { logo, link } = getHomeBmData($item.attr('data-id'));
      const $homeBmLogo = $item.find('.home_bm_logo');
      if (logo) {
        logo = hdPath(`/api/pub/${logo}`);
      } else {
        logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
      }
      imgjz(
        logo,
        () => {
          $homeBmLogo
            .css({
              'background-image': `url(${logo})`,
            })
            .addClass('load');
        },
        () => {
          $homeBmLogo
            .css({
              'background-image': `url(${imgMrLogo})`,
            })
            .addClass('load');
        }
      );
    }
  );
}
$searchBoxMask
  .on('click', '.home_bm_logo', function (e) {
    const $this = $(this);
    if ($this.attr('x') === 'add') {
      addBookMark(e, 'home');
    } else {
      const { link } = getHomeBmData($this.parent().attr('data-id'));
      myOpen(link, '_blank');
    }
  })
  .on('contextmenu', '.home_bm_logo', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    const $this = $(this);
    const id = $this.parent().attr('data-id');
    if (!id) return;
    bookMarkSetting(
      e,
      getHomeBmData(id),
      'home',
      this.parentNode.querySelector('.check_home_bm')
    );
  })
  .on('mouseenter', '.home_bm_item', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    if (id) {
      tooltipBookmark(getHomeBmData(id));
    }
  })
  .on('mouseleave', '.home_bm_item', function () {
    toolTip.hide();
  })
  .on('click', '.type_logo', function (e) {
    const $this = $(this).parent();
    const { type, name, data, link, des, title, username, artist, group } =
      getSearchItemInfo($this.attr('data-id'));
    let str = '';
    if (type === 'ss') {
      copyText(data);
    } else if (type === 'note') {
      copyText(name);
    } else if (type === 'bmk') {
      str = `分组：${group.id === 'home' ? '主页' : group.name}\n名称：${
        name || '--'
      }\n链接：${link || '--'}\n描述：${des || '--'}`;
    } else if (type === 'music') {
      copyText(`${artist}-${title}`);
    } else if (type === 'user') {
      str = `用户：${username || '--'}\n备注：${des || '--'}`;
    }
    if (str) {
      rMenu.rightInfo(e, str);
    }
  })
  .on('mouseenter', '.search_item', function () {
    const $this = $(this);
    const { type, name, data, link, des, title, username, artist, group } =
      getSearchItemInfo($this.attr('data-id'));
    let str = '';
    if (type === 'ss') {
      str = data;
    } else if (type === 'note') {
      str = name;
    } else if (type === 'bmk') {
      str = `分组：${group.id === 'home' ? '主页' : group.name}\n名称：${
        name || '--'
      }\n链接：${link || '--'}\n描述：${des || '--'}`;
    } else if (type === 'music') {
      str = `${artist} - ${title}`;
    } else if (type === 'user') {
      str = `用户：${username || '--'}\n备注：${des || '--'}`;
    }
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.search_item', function () {
    toolTip.hide();
  })
  .on('click', '.home_bm_item p', function (e) {
    e.stopPropagation();
    const $this = $(this);
    const id = $this.parent().attr('data-id');
    if (!id) return;
    bookMarkSetting(
      e,
      getHomeBmData(id),
      'home',
      this.parentNode.querySelector('.check_home_bm')
    );
  })
  .on('click', '.home_foot_menu div', function () {
    let che = $(this).attr('check');
    che === 'y' ? (che = 'n') : (che = 'y');
    $homeFootMenu.find('div').attr({
      class:
        che === 'y'
          ? 'iconfont icon-xuanzeyixuanze'
          : 'iconfont icon-xuanzeweixuanze',
      check: che,
    });
    const $checks = $homeBmWrap.find('.home_bm_item').find('.check_home_bm');
    $checks
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $checks.length : 0}项`);
  })
  .on('click', '.check_home_bm', function (e) {
    e.stopPropagation();
    checkedHomeBm(this);
  })
  .on('click', '.delete_bm', function (e) {
    const arr = getHomeCheckBmItem();
    if (arr.length === 0) return;
    delBm(e, arr);
  })
  .on('click', '.move_bm', function (e) {
    const arr = getHomeCheckBmItem();
    if (arr.length === 0) return;
    if (setBookMark().list.length === 0) {
      _msg.error('没有可移动的分组');
      return;
    }
    moveBookMark(e, 'home', arr);
  })
  .on('click', '.close', function () {
    const $bms = $homeBmWrap.find('.home_bm_item');
    $bms
      .find('.check_home_bm')
      .css('display', 'none')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $homeFootMenu.stop().slideUp(_d.speed);
  })
  .on('click', function (e) {
    if (_getTarget(this, e, '.search_box_mask', 1)) {
      hideSearchBox();
    }
  });
// 隐藏搜索框
function hideSearchBox() {
  backWindow.remove('search');
  homeLoadImg.unBind();
  $homeBmWrap.find('ul').html('');
  $searchBoxMask.stop().hide(_d.speed);
  $searchBoxBtn.stop().slideDown(_d.speed);
  $pageBg.removeClass('sce');
}
// 开启选中状态
export function openCheckState() {
  $homeBmWrap.find('.home_bm_item .check_home_bm').css('display', 'block');
}
function getSearchItemInfo(id) {
  return searchList.find((item) => item.id == id);
}
// 选中书签
export function checkedHomeBm(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  const $bms = $homeBmWrap.find('.home_bm_item'),
    $checkArr = $bms.filter((_, item) => {
      const $item = $(item);
      return (
        $item.attr('data-id') &&
        $item.find('.check_home_bm').attr('check') === 'y'
      );
    });
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $bms.length - 1) {
    $homeFootMenu.find('div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $homeFootMenu.find('div').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
// 长按菜单
longPress($searchBoxMask[0], '.home_bm_logo', function (e) {
  const $this = $(this),
    ev = e.changedTouches[0];
  const id = $this.parent().attr('data-id');
  if (!id) return;
  bookMarkSetting(
    ev,
    getHomeBmData(id),
    'home',
    this.parentNode.querySelector('.check_home_bm')
  );
});
// 显示搜索框
export function showSearchBox() {
  $searchBoxMask.stop().show(_d.speed, () => {
    getHomeBmList();
    setCatSize();
  });
  setZidx($searchBoxMask[0], 'search', hideSearchBox);
  $searchBoxBtn.stop().slideUp(_d.speed);
  $pageBg.addClass('sce');
  $searchLogo.find('.logo_box').addClass('active');
}
$searchBoxBtn.on('click', showSearchBox);
// 是否弹窗打开搜索结果
function isSearchOpenPop() {
  return _getData('searchOpenPop');
}
// 搜索框处理
const searchInput = wrapInput($searchInpWrap.find('.inp_box input')[0], {
  change(val) {
    if (val.trim() == '') {
      $searchInpWrap.find('.inp_box i').css('display', 'none');
      $searchInpWrap.find('.translate_btn').css('display', 'none');
      $searchInpWrap.find('.search_submit').css('display', 'none');
    } else {
      $searchInpWrap.find('.inp_box i').css('display', 'block');
      $searchInpWrap.find('.translate_btn').css('display', 'block');
      $searchInpWrap.find('.search_submit').css('display', 'block');
    }
  },
  focus() {
    $searchInpWrap.find('.search_list_box').css('display', 'block');
    $searchInpWrap.find('.content').addClass('active');
    let val = searchInput.getValue();
    hdSearchBoxInput(val);
  },
});
// 获取搜索引擎
function getSearchEngine() {
  return _d.searchEngineData[curSearchIdx] || _d.searchEngineData[0];
}
// 获取提示词服务
function getSearchWordLink() {
  return _d.searchWord[searchWordIdx] || _d.searchWord[0];
}
reqSearchConfig()
  .then((res) => {
    if (res.code == 0) {
      _d.searchEngineData = res.data.searchEngineData;
      _d.translator = res.data.translator;
      switchSearchEngine();
    }
  })
  .catch(() => {});
// 切换搜索引擎
function switchSearchEngine() {
  const { icon, logo, color } = getSearchEngine();
  $searchInpWrap.find('.content').css('borderColor', color);
  $searchLogo.find('img').attr({ src: logo });
  $searchLogo.find('.logo_box').addClass('active');
  $searchBoxBtn.attr('src', icon);
  $searchInpWrap.find('.inp_box input').attr({
    placeholder: '输入搜索内容或网址',
  });
}
// 搜索提示词
function toSearch(val) {
  const action = getSearchEngine().searchlink;
  if (val === '') return;
  saveSearchText(val);
  let u = val;
  if (!isurl(val)) {
    u = action.replace(/\{\{\}\}/, encodeURIComponent(val));
  }
  if (isSearchOpenPop()) {
    openInIframe(u, val);
    return;
  }
  myOpen(u, '_blank');
}
const _hdSearchBoxInput = debounce(hdSearchBoxInput, 1000);
function hdSearchBoxInput(val) {
  getSearchList(val.trim());
}
// 搜索结果index
let searchResultIdx = -1;
// 删除历史记录
function delHistory(el, ids) {
  reqSearchDelete({ ids })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        _msg.success(result.codeText);
        el.remove();
        return;
      }
    })
    .catch(() => {});
}
// 翻译
function toTranslator() {
  const word = searchInput.getValue().trim();
  if (word === '') return;
  saveSearchText(word);
  const u = _d.translator.replace(/\{\{\}\}/, encodeURIComponent(word));
  if (isSearchOpenPop()) {
    openInIframe(u, word);
    return;
  }
  myOpen(u, '_blank');
}
// 选中搜索结果
function selectSearchItem(e) {
  const key = e.key,
    listlength =
      $searchInpWrap.find('.search_list_box ul').children('li').length - 1;
  if (key !== 'ArrowDown' && key !== 'ArrowUp') {
    searchResultIdx = -1;
    return;
  }
  if (key === 'ArrowDown') {
    searchResultIdx++;
    if (searchResultIdx > listlength) {
      searchResultIdx = 0;
    }
  } else if (key === 'ArrowUp') {
    searchResultIdx--;
    if (searchResultIdx < 0) {
      searchResultIdx = listlength;
    }
  }
  const $searchItem = $searchInpWrap.find('.search_list_box ul .search_item');
  $searchItem.removeClass('active').eq(searchResultIdx).addClass('active');
  const value = $searchItem.eq(searchResultIdx).text().trim();
  searchInput.setValue(value);
  const dw = parseInt(searchResultIdx * 41);
  $searchInpWrap.find('.search_list_box').scrollTop(dw);
}
// 点击搜索项
function hdClickSearchItem() {
  const $this = $(this).parent(),
    type = $this.data('type'),
    text = $this.text().trim(),
    id = $this.data('id');
  if (type === 'ss') {
    toSearch(text);
  } else if (type === 'note') {
    const u = `/note/?v=${id}`;
    if (isSearchOpenPop()) {
      openInIframe(u, text);
    } else {
      myOpen(u, '_blank');
    }
  } else if (type === 'bmk') {
    const { link } = getSearchItem(id);
    if (isSearchOpenPop()) {
      openInIframe(link, text);
    } else {
      myOpen(link, '_blank');
    }
  } else if (type === 'music') {
    showMusicPlayerBox(() => {
      const list = searchList.filter((item) => item.type == 'music');
      const obj = getSearchItem(id);
      updateNewPlayList(list);
      renderPlayingList();
      musicPlay(obj);
    });
  } else if (type === 'user') {
    setCurChatAccount(id);
    showChatRoom();
  }
}
$searchInpWrap
  .on('click', '.search_submit', () => {
    const val = searchInput.getValue().trim();
    toSearch(val);
  })
  .on('click', '.translate_btn', toTranslator)
  .on('keyup', '.inp_box input', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const key = e.key;
    if (key == 'Enter') {
      const val = searchInput.getValue().trim();
      toSearch(val);
    }
  })
  .on('keydown', '.inp_box input', selectSearchItem)
  .on('input', '.inp_box input', function () {
    let val = searchInput.getValue();
    _hdSearchBoxInput(val);
  })
  .on('click', '.inp_box i', function () {
    searchInput.setValue('');
    searchInput.target.focus();
  })
  .find('.search_list_box')
  .on('click', '.text', hdClickSearchItem)
  .on('click', '.dellss', function () {
    const $p = $(this).parent();
    const x = $p.data('id');
    delHistory($p, [x]);
  })
  .on('contextmenu', 'li', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    const xx = $(this).text().trim();
    searchInput.setValue(xx);
    searchInput.target.focus();
  });
// 保存搜索历史
function saveSearchText(str) {
  str = str.trim();
  if (str === '' || str.length > 100) return;
  reqSearchSave({ data: str })
    .then(() => {})
    .catch(() => {});
}
// 获取搜索项
function getSearchItem(id) {
  return searchList.find((item) => item.id == id);
}
// 生成列表
function renderSearchList() {
  const list = searchList;
  const splitWord = $searchInpWrap.splitWord;
  let searchstr = '';
  if (list.length > 0) {
    list.forEach((v) => {
      const { type, id, name, data, des, flag, title, username, artist } = v;
      if (type === 'ss') {
        searchstr += `<li data-type="${type}" data-id="${id}" class="search_item">
        <span class="type_logo iconfont ${
          flag == 'ts' ? 'icon-tishi' : 'icon-history'
        }"></span>
        <span cursor class="text">${hdTitleHighlight(splitWord, data)}</span>
        ${
          flag == 'ts'
            ? ''
            : '<span cursor class="dellss iconfont icon-guanbi"></span>'
        }
        </li>`;
      } else if (type === 'note') {
        searchstr += `<li data-type="${type}" data-id="${id}" class="search_item">
        <span class="type_logo iconfont icon-jilu"></span>
        <span cursor class="text">${hdTitleHighlight(splitWord, name)}</span>
        </li>`;
      } else if (type === 'bmk') {
        searchstr += `<li data-type="${type}" data-id="${id}" class="search_item">
        <span class="type_logo iconfont icon-shuqian"></span>
        <span cursor class="text">${hdTitleHighlight(splitWord, name)}</span>
        </li>`;
      } else if (type === 'music') {
        searchstr += `<li data-type="${type}" data-id="${id}" class="search_item">
        <span style="font-size:20px" class="type_logo iconfont icon-yinle1"></span>
        <span cursor class="text">${hdTitleHighlight(
          splitWord,
          `${artist}-${title}`
        )}</span>
        </li>`;
      } else if (type === 'user') {
        searchstr += `<li data-type="${type}" data-id="${id}" class="search_item">
        <span class="type_logo iconfont icon-chengyuan"></span>
        <span cursor class="text">
        ${hdTitleHighlight(splitWord, `${username}${des ? `(${des})` : ''}`)}
        </span>
        </li>`;
      }
    });
  }
  $searchInpWrap.find('.search_list_box ul').html(searchstr);
  searchResultIdx = -1;
}
// 获取搜索列表
function getSearchList(val) {
  const $sList = $searchInpWrap.find('.search_list_box ul');
  if (val.length > 100) {
    $sList.html('');
    return;
  }
  loadingImg($sList[0]);
  reqSearchList({ word: val })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const { splitWord, list } = result.data;
        $searchInpWrap.splitWord = splitWord;
        searchList = list;
        renderSearchList();
      }
      const wordLink = getSearchWordLink();
      if (wordLink.link && val) {
        const script = document.createElement('script');
        script.src = wordLink.link.replace(/\{\{\}\}/, encodeURIComponent(val));
        document.body.appendChild(script);
        document.body.removeChild(script);
      }
    })
    .catch(() => {});
}
window.baidu = {
  sug: hdSearchWord,
};
window.bing = {
  sug: hdSearchWord,
};
window.google = {
  ac: {
    h: hdSearchWord,
  },
};
// 处理提示词
function hdSearchWord(res) {
  const { type } = getSearchWordLink();
  if (type == 'close') return;
  if (type == 'Google') {
    res = getIn(res, [1]);
    if (res && res.length > 0) {
      res = res.map((item) => item[0]);
    } else {
      res = [];
    }
  } else if (type == 'Baidu') {
    res = getIn(res, ['s']) || [];
  } else if (type == 'Bing') {
    res = getIn(res, ['AS', 'Results']) || [];
    let arr = [];
    res.forEach((item) => {
      let ar = getIn(item, ['Suggests']) || [];
      ar.forEach((titem) => {
        arr.push(titem.Txt);
      });
    });
    res = arr;
  } else {
    res = [];
  }
  if (!res || res.length == 0) return;
  const val = $searchInpWrap.splitWord;
  res = res.map((item, idx) => ({
    data: item,
    flag: 'ts',
    type: 'ss',
    id: idx + 1,
    sNum: getWordCount(val, item),
  }));
  searchList = [...searchList, ...res];
  searchList.sort((a, b) => b.sNum - a.sNum);
  renderSearchList();
}
longPress($searchInpWrap.find('.search_list_box')[0], 'li', function () {
  const text = $(this).text().trim();
  searchInput.setValue(text);
  searchInput.target.focus();
});
// 切换搜索提示词服务
function switchSearchCallWord(e) {
  const data = [];
  const obj = getSearchWordLink();
  _d.searchWord.forEach((item, idx) => {
    const { type } = item;
    data.push({
      id: idx + 1,
      text: type == 'close' ? '关闭' : type,
      active: obj.type == type,
    });
  });
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      if (id) {
        searchWordIdx = id - 1;
        _setData('searchWordIdx', searchWordIdx);
        close(1);
        _msg.success();
      }
    },
    '选择提示词服务'
  );
}
// 搜索设置
function searchSetting(e) {
  const openInPop = _getData('searchOpenPop');
  const data = [
    {
      id: '3',
      text: '搜索历史',
      beforeIcon: 'iconfont icon-history',
    },
    {
      id: '4',
      text: '书签夹',
      beforeIcon: 'iconfont icon-shuqian',
    },
    {
      id: '5',
      text: '切换搜索引擎',
      beforeIcon: 'iconfont icon-search',
    },
    {
      id: '1',
      text: '切换搜索提示词服务',
      beforeIcon: 'iconfont icon-tishi',
    },
    {
      id: '2',
      text: '弹窗打开搜索结果',
      beforeIcon: 'iconfont icon-24gl-minimize',
      afterIcon: openInPop
        ? 'iconfont icon-kaiguan-kai1'
        : 'iconfont icon-kaiguan-guan',
      param: { openInPop },
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, resetMenu, id, param }) => {
      if (id == '1') {
        switchSearchCallWord(e);
      } else if (id == '2') {
        const flag = param.openInPop;
        if (flag) {
          data[4].param.openInPop = false;
          data[4].afterIcon = 'iconfont icon-kaiguan-guan';
          _setData('searchOpenPop', false);
          _msg.success('关闭成功');
        } else {
          data[4].param.openInPop = true;
          data[4].afterIcon = 'iconfont icon-kaiguan-kai1';
          _setData('searchOpenPop', true);
          _msg.success('开启成功');
        }
        resetMenu(data);
      } else if (id == '3') {
        close();
        showHistory();
      } else if (id == '5') {
        selectSearch(e);
      } else if (id == '4') {
        close();
        showBmk();
      }
    },
    '设置'
  );
}
$searchBoxMask
  .on('click', '.setting', searchSetting)
  .on('click', '.logo_box', selectSearch);
// 选中搜索引擎
function selectSearch(e) {
  let str = ``;
  _d.searchEngineData.forEach((v, i) => {
    let { name, icon } = v;
    str += `<div cursor class="item ${
      getSearchEngine().name == name ? 'active' : ''
    }" xi=${i}><img style="width: 40px;height: 40px;border-radius: 4px;" data-src="${icon}"><span style="margin-left:10px;">${name}</span></div>`;
  });
  rMenu.rightMenu(
    e,
    str,
    function ({ close, e, box }) {
      const _this = _getTarget(box, e, '.item');
      if (_this) {
        $searchLogo.find('.logo_box').removeClass('active');
        const xi = $(_this).attr('xi'),
          { logo } = _d.searchEngineData[xi];
        close(true);
        imgjz(
          logo,
          () => {
            curSearchIdx = xi;
            switchSearchEngine();
            _setData('searchengine', xi);
            _msg.success('切换成功');
          },
          () => {
            curSearchIdx = xi;
            switchSearchEngine();
            _setData('searchengine', xi);
            _msg.success('切换成功');
          }
        );
      }
    },
    '选择搜索引擎'
  );
}
document.addEventListener('click', function (e) {
  if (!_getTarget(this, e, '.search_box_mask .content')) {
    $searchInpWrap.find('.search_list_box').css('display', 'none');
    $searchInpWrap.find('.content').removeClass('active');
  }
});
// 层级
function searchIndex(e) {
  if (_getTarget(this, e, '.search_box_wrap')) {
    setZidx($searchBoxMask[0], 'search', hideSearchBox);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  searchIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  searchIndex(e.changedTouches[0]);
});
window.addEventListener('resize', throttle(setCatSize, 1000));
function setCatSize() {
  if (searchBoxIsHide()) return;
  const $content = $searchInpWrap.find('.content'),
    $cat = $content.find('.cat');
  let fontSize = (($content.width() - 200) / 2) * (100 / 150);
  fontSize = fontSize > 150 ? 150 : fontSize < 50 ? 50 : fontSize;
  $cat.css('font-size', parseInt(fontSize));
}
