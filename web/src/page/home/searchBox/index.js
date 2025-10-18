import $ from 'jquery';
import './cat.less';
import defaultIcon from '../../../images/img/default-icon.png';
import imgTianjia from '../../../images/img/tianjia.png';
import {
  myOpen,
  debounce,
  _getTarget,
  imgjz,
  isurl,
  loadingImg,
  wrapInput,
  longPress,
  isMobile,
  hdTitleHighlight,
  getIn,
  getWordCount,
  LazyLoad,
  copyText,
  throttle,
  _position,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import {
  addBookMark,
  bookMarkSetting,
  delBm,
  dragMoveBookmark,
  hideAside,
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
import { popWindow, setZidx } from '../popWindow.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { showBmk, showHistory } from '../rightSetting/index.js';
import { _tpl } from '../../../js/utils/template.js';
import _path from '../../../js/utils/path.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import {
  BoxSelector,
  MouseElementTracker,
} from '../../../js/utils/boxSelector.js';
import localData from '../../../js/common/localData.js';
const $searchBoxMask = $('.search_box_mask'),
  $searchLogo = $searchBoxMask.find('.search_logo'),
  $searchInpWrap = $searchBoxMask.find('.search_inp_wrap'),
  $homeBmWrap = $searchBoxMask.find('.home_bm_wrap'),
  $homeFootMenu = $searchBoxMask.find('.home_foot_menu'),
  $searchBoxBtn = $('.search_box_btn'),
  $pageBg = $('.page_bg');
let curSearchIdx = localData.get('searchengine'),
  searchWordIdx = localData.get('searchWordIdx');
let searchList = [];
// 底部菜单是隐藏
function homeFootMenuIsHide() {
  return $homeFootMenu.is(':hidden');
}
// 显示底部菜单
export function showHomeFootMenu() {
  $homeFootMenu
    .stop()
    .slideDown(_d.speed, () => {
      homeBmBoxSelector.start();
    })
    .find('.flex_wrap div')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $homeBmWrap
    .find('.home_bm_item .check_home_bm')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $homeFootMenu
    .stop()
    .slideUp(_d.speed, () => {
      homeBmBoxSelector.stop();
    })
    .find('.flex_wrap div')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
// 搜索框是隐藏
export function searchBoxIsHide() {
  return $searchBoxMask.is(':hidden');
}
// 拖动移动书签
const homeBmMouseElementTracker = new MouseElementTracker($homeBmWrap[0], {
  delay: 300,
  onStart({ e }) {
    const item = _getTarget($homeBmWrap[0], e, '.home_bm_item');
    if (
      !item ||
      !homeFootMenuIsHide() ||
      !e.target.className.includes('home_bm_logo') ||
      e.target.getAttribute('x') === 'add'
    )
      return true;

    $homeBmWrap.homeBmfromDom = item;
    const obj = getHomeBmData(item.dataset.id);
    if (!obj) return true;
    homeBmMouseElementTracker.changeInfo(obj.title);
  },
  onEnd({ dropElement }) {
    if (homeFootMenuIsHide() && $homeBmWrap.homeBmfromDom) {
      const to = dropElement
        ? _getTarget($homeBmWrap[0], { target: dropElement }, '.home_bm_item')
        : null;
      if (to) {
        let fromId = $homeBmWrap.homeBmfromDom.dataset.id,
          toId = to.dataset.id;
        if (fromId && toId && fromId !== toId) {
          dragMoveBookmark('home', fromId, toId);
        }
      }
      $homeBmWrap.homeBmfromDom = null;
    }
  },
});
// 书签列表
export function getHomeBmList() {
  if (searchBoxIsHide()) return;
  if ($homeBmWrap.find('ul').children().length === 0) {
    bmsLoading();
  }
  reqBmkList({ id: 'home' })
    .then((result) => {
      if (result.code === 1) {
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
  new Array(14).fill(null).forEach(() => {
    str += `<li style="pointer-events: none;" class="home_bm_item">
              <div style="background-color:${color};background-image:none;" class="home_bm_logo"></div>
              <p></p>
              </li>`;
  });
  $homeBmWrap.find('ul').html(str);
}
// 获取书签信息
function getHomeBmData(id) {
  return setBookMark().home.find((item) => item.id === id) || {};
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

const homeBmBoxSelector = new BoxSelector($homeBmWrap[0], {
  selectables: '.home_bm_item',
  onSelectStart({ e }) {
    const item = _getTarget($homeBmWrap[0], e, '.home_bm_item');
    if (item) return true;
  },
  onSelectEnd() {
    updateSelectingInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_home_bm');
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
homeBmBoxSelector.stop();
// 生成列表
function renderHomeBmList() {
  if (searchBoxIsHide()) return;
  stopSelect();
  let list = setBookMark().home;
  const html = _tpl(
    `
    <li v-for="{id,title} in list" class="home_bm_item" :data-id="id">
      <div cursor="y" check="n" class="check_home_bm"></div>
      <div class="home_bm_logo" cursor="y"></div>
      <p cursor="y">{{title}}</p>
    </li>
    <li class="home_bm_item">
      <div cursor="y" x="add" style="background-image:url({{imgTianjia}})" class="home_bm_logo">
      </div>
      <p></p>
    </li>
    `,
    {
      list,
      imgTianjia,
    }
  );
  $homeBmWrap.find('ul').html(html);
  lazyLoadHomeBmLogo();
}
// 加载logo
const homeLoadImg = new LazyLoad();
function lazyLoadHomeBmLogo() {
  const logos = [
    ...$homeBmWrap.find('ul')[0].querySelectorAll('.home_bm_item'),
  ].filter((item) => {
    const $item = $(item);
    const flag = $item.find('.home_bm_logo').attr('x');
    if (flag === 'add') return;
    let { logo, link } = getHomeBmData($item.attr('data-id'));
    const $homeBmLogo = $item.find('.home_bm_logo');
    if (logo) {
      logo = _path.normalize('/api/pub', logo);
    } else {
      logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
    }
    const cache = cacheFile.hasUrl(logo, 'image');
    if (cache) {
      $homeBmLogo
        .css({
          'background-image': `url(${cache})`,
        })
        .addClass('load');
    }
    return !cache;
  });
  homeLoadImg.bind(logos, (item) => {
    const $item = $(item);
    const flag = $item.find('.home_bm_logo').attr('x');
    if (flag === 'add') return;
    let { logo, link } = getHomeBmData($item.attr('data-id'));
    const $homeBmLogo = $item.find('.home_bm_logo');
    if (logo) {
      logo = _path.normalize('/api/pub', logo);
    } else {
      logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
    }
    imgjz(logo)
      .then((cache) => {
        $homeBmLogo
          .css({
            'background-image': `url(${cache})`,
          })
          .addClass('load');
      })
      .catch(() => {
        $homeBmLogo
          .css({
            'background-image': `url(${defaultIcon})`,
          })
          .addClass('load');
      });
  });
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
  .on('contextmenu', '.home_bm_item', function (e) {
    e.preventDefault();
    if (isMobile() || !homeFootMenuIsHide()) return;
    const $this = $(this);
    const id = $this.attr('data-id');
    if (!id) return;
    bookMarkSetting(
      e,
      getHomeBmData(id),
      'home',
      this.querySelector('.check_home_bm')
    );
  })
  .on('mouseenter', '.home_bm_item p', function () {
    const id = $(this).parent().attr('data-id');
    if (id) {
      tooltipBookmark(getHomeBmData(id));
    }
  })
  .on('mouseleave', '.home_bm_item p', function () {
    toolTip.hide();
  })
  .on('click', '.type_logo', function (e) {
    const $this = $(this).parent();
    const { type, content, link, des, title, group_title } = getSearchItem(
      $this.attr('data-id')
    );
    let str = '';
    if (type === 'ss') {
      copyText(content);
    } else if (type === 'note') {
      copyText(title);
    } else if (type === 'bmk') {
      str = `分组：${group_title}\n名称：${title || '--'}\n链接：${
        link || '--'
      }\n描述：${des || '--'}`;
    }
    if (str) {
      rMenu.rightInfo(e, str);
    }
  })
  .on('mouseenter', '.search_item .type_logo', function () {
    const { type, content, link, des, title, group_title } = getSearchItem(
      $(this).parent().attr('data-id')
    );
    let str = '';
    if (type === 'ss') {
      str = content;
    } else if (type === 'note') {
      str = title;
    } else if (type === 'bmk') {
      str = `分组：${group_title}\n名称：${title || '--'}\n链接：${
        link || '--'
      }\n描述：${des || '--'}`;
    }
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.search_item .type_logo', function () {
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
  .on('click', '.home_foot_menu .flex_wrap div', function () {
    let che = $(this).attr('check');
    che === 'y' ? (che = 'n') : (che = 'y');
    $homeFootMenu.find('.flex_wrap div').attr({
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
  .on('click', '.close', stopSelect)
  .on('click', function (e) {
    if (_getTarget(this, e, '.search_box_mask', 1)) {
      hideSearchBox();
    }
  });
// 隐藏搜索框
export function hideSearchBox() {
  popWindow.remove('search');
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
// 选中书签
export function checkedHomeBm(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateSelectingInfo();
}
function updateSelectingInfo() {
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
    $homeFootMenu.find('.flex_wrap div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $homeFootMenu.find('.flex_wrap div').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
// 长按菜单
longPress($searchBoxMask[0], '.home_bm_item', function (e) {
  if (homeBmMouseElementTracker.active || !homeFootMenuIsHide()) return;
  const $this = $(this),
    ev = e.changedTouches[0];
  const id = $this.attr('data-id');
  if (!id) return;
  bookMarkSetting(
    ev,
    getHomeBmData(id),
    'home',
    this.querySelector('.check_home_bm')
  );
});
// 显示搜索框
export function showSearchBox() {
  hideAside();
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
  return localData.get('searchOpenPop');
}
// 搜索框处理
const searchInput = wrapInput($searchInpWrap.find('.inp_box input')[0], {
  update(val) {
    if (val.trim() === '') {
      $searchInpWrap.find('.translate_btn').css('display', 'none');
      $searchInpWrap.find('.search_submit').css('display', 'none');
    } else {
      $searchInpWrap.find('.translate_btn').css('display', 'block');
      $searchInpWrap.find('.search_submit').css('display', 'block');
    }
    if (val === '') {
      $searchInpWrap.find('.inp_box i').css('display', 'none');
    } else {
      $searchInpWrap.find('.inp_box i').css('display', 'block');
    }
  },
  focus() {
    $searchInpWrap.find('.search_list_box').css('display', 'block');
    $searchInpWrap.find('.content').addClass('active');
    hdSearchBoxInput(searchInput.getValue());
  },
  keyup(e) {
    e.stopPropagation();
    e.preventDefault();
    const key = e.key;
    if (key === 'Enter') {
      toSearch(searchInput.getValue().trim());
    }
  },
  input() {
    _hdSearchBoxInput(searchInput.getValue());
  },
  keydown(e) {
    selectSearchItem(e);
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
    if (res.code === 1) {
      _d.searchEngineData = res.data.searchEngineData;
      _d.translator = res.data.translator;
      switchSearchEngine();
    }
  })
  .catch(() => {});
// 切换搜索引擎
function switchSearchEngine() {
  const { icon, logo, color } = getSearchEngine();
  $searchInpWrap.find('.content').css('box-shadow', `0 0 0.2rem ${color}`);
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
    u = action.replace(/\{\{(.*?)\}\}/g, encodeURIComponent(val));
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
      if (result.code === 1) {
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
  const u = _d.translator.replace(/\{\{(.*?)\}\}/g, encodeURIComponent(word));
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
  const $activeItem = $searchItem.eq(searchResultIdx);
  if ($activeItem.length > 0) {
    const value = $activeItem.text().trim();
    searchInput.setValue(value);
    $searchInpWrap
      .find('.search_list_box')
      .scrollTop(_position($activeItem[0]).top);
  }
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
    const u = `/note?v=${id}`;
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
  }
}
$searchInpWrap
  .on('click', '.search_submit', () => {
    const val = searchInput.getValue().trim();
    toSearch(val);
  })
  .on('click', '.translate_btn', toTranslator)
  .on('click', '.inp_box i', function () {
    searchInput.setValue('').focus();
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
    searchInput.setValue(xx).focus();
  });
// 保存搜索历史
function saveSearchText(str) {
  str = str.trim();
  if (str === '' || str.length > 100) return;
  reqSearchSave({ content: str })
    .then(() => {})
    .catch(() => {});
}
// 获取搜索项
function getSearchItem(id) {
  return searchList.find((item) => item.id === id) || {};
}
// 生成列表
function renderSearchList() {
  const list = searchList;
  const splitWord = $searchInpWrap.splitWord;
  let searchstr = '';
  if (list.length > 0) {
    searchstr = _tpl(
      `
      <li v-for="{ type, id, title, content, flag } in list" :data-type="type" :data-id="id" class="search_item">
        <template v-if="type === 'ss'">
          <span class="type_logo iconfont {{flag === 'ts' ? 'icon-tishi' : 'icon-history'}}"></span>
          <span v-html="hdTitleHighlight(splitWord, content)" cursor="y" class="text"></span>
          <span v-if="flag != 'ts'" cursor="y" class="dellss iconfont icon-close-bold"></span>
        </template>
        <template v-else-if="type === 'note'">
          <span class="type_logo iconfont icon-jilu"></span>
          <span v-html="hdTitleHighlight(splitWord, title)" cursor="y" class="text"></span>
        </template>
        <template v-else-if="type === 'bmk'">
          <span class="type_logo iconfont icon-shuqian"></span>
          <span v-html="hdTitleHighlight(splitWord, title)" cursor="y" class="text"></span>
        </template>
      </li>
      `,
      {
        list,
        hdTitleHighlight,
        splitWord,
      }
    );
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
      if (result.code === 1) {
        const { splitWord, list } = result.data;
        $searchInpWrap.splitWord = splitWord;
        searchList = list;
        renderSearchList();
      }
      const wordLink = getSearchWordLink();
      if (wordLink.link && val) {
        const script = document.createElement('script');
        script.src = wordLink.link.replace(
          /\{\{(.*?)\}\}/g,
          encodeURIComponent(val)
        );
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
  if (type === 'close') return;
  if (type === 'Google') {
    res = getIn(res, [1]);
    if (res && res.length > 0) {
      res = res.map((item) => item[0]);
    } else {
      res = [];
    }
  } else if (type === 'Baidu') {
    res = getIn(res, ['s'], []);
  } else if (type === 'Bing') {
    res = getIn(res, ['AS', 'Results'], []);
    let arr = [];
    res.forEach((item) => {
      let ar = getIn(item, ['Suggests'], []);
      ar.forEach((titem) => {
        arr.push(titem.Txt);
      });
    });
    res = arr;
  } else {
    res = [];
  }
  if (!res || res.length === 0) return;
  const val = $searchInpWrap.splitWord;
  res = res.map((item, idx) => ({
    content: item,
    flag: 'ts',
    type: 'ss',
    id: idx + 1 + '',
    sNum: getWordCount(val, item),
  }));
  searchList = [...searchList, ...res];
  searchList.sort((a, b) => b.sNum - a.sNum);
  renderSearchList();
}
longPress($searchInpWrap.find('.search_list_box')[0], 'li', function () {
  const text = $(this).text().trim();
  searchInput.setValue(text).focus();
});
// 切换搜索提示词服务
function switchSearchCallWord(e) {
  const data = [];
  const obj = getSearchWordLink();
  _d.searchWord.forEach((item, idx) => {
    const { type } = item;
    data.push({
      id: idx + 1 + '',
      text: type === 'close' ? '关闭' : type,
      active: obj.type === type,
    });
  });
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      if (id) {
        searchWordIdx = id - 1;
        localData.set('searchWordIdx', searchWordIdx);
        close(1);
        _msg.success();
      }
    },
    '选择提示词服务'
  );
}
// 搜索设置
function searchSetting(e) {
  const openInPop = localData.get('searchOpenPop');
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
      const curItem = data.find((item) => item.id === id);
      if (id === '1') {
        switchSearchCallWord(e);
      } else if (id === '2') {
        const flag = param.openInPop;
        if (flag) {
          curItem.param.openInPop = false;
          curItem.afterIcon = 'iconfont icon-kaiguan-guan';
          localData.set('searchOpenPop', false);
          _msg.success('关闭成功');
        } else {
          curItem.param.openInPop = true;
          curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
          localData.set('searchOpenPop', true);
          _msg.success('开启成功');
        }
        resetMenu(data);
      } else if (id === '3') {
        close();
        showHistory();
      } else if (id === '5') {
        selectSearch(e);
      } else if (id === '4') {
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
  const html = _tpl(
    `
    <div v-for="{name,icon},i in _d.searchEngineData" cursor="y" class="item {{getSearchEngine().name === name ? 'active' : ''}}" :xi="i">
      <img style="width: 4rem;height: 4rem;border-radius: 0.4rem;" :data-src="icon"/>
      <span style="margin-left:1rem;">{{name}}</span>
    </div>
    `,
    {
      _d,
      getSearchEngine,
    }
  );
  rMenu.rightMenu(
    e,
    html,
    function ({ close, e, box, loading }) {
      const _this = _getTarget(box, e, '.item');
      if (_this) {
        $searchLogo.find('.logo_box').removeClass('active');
        const xi = $(_this).attr('xi'),
          { logo } = _d.searchEngineData[xi];
        loading.start();
        imgjz(logo)
          .then(() => {
            curSearchIdx = xi;
            switchSearchEngine();
            localData.set('searchengine', xi);
            _msg.success('切换成功');
            loading.end();
            close(true);
          })
          .catch(() => {
            curSearchIdx = xi;
            switchSearchEngine();
            localData.set('searchengine', xi);
            _msg.success('切换成功');
            loading.end();
            close(true);
          });
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
localData.onChange(({ key }) => {
  if (!key || key === 'htmlFontSize') {
    setCatSize();
  }
});
