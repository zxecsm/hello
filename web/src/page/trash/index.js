import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import './index.less';
import '../bmk/index.less';
import {
  pageScrollTop,
  toLogin,
  scrollState,
  throttle,
  queryURLParams,
  myOpen,
  isIframe,
  wrapInput,
  getScreenSize,
  isurl,
  _myOpen,
  longPress,
  isMobile,
  hdTitleHighlight,
  copyText,
  isLogin,
  _getTarget,
  LazyLoad,
  imgjz,
  getFaviconPath,
  getFilePath,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import realtime from '../../js/plugins/realtime';
import {
  reqUserDeleteTrash,
  reqUserRecoverTrash,
  reqUserTrashList,
} from '../../api/user';
import rMenu from '../../js/plugins/rightMenu';
import { showBmkInfo } from '../../js/utils/showinfo';
import { reqSearchConfig } from '../../api/search';
import { _tpl } from '../../js/utils/template';
import { BoxSelector } from '../../js/utils/boxSelector';
import { otherWindowMsg } from '../home/home';
import imgPreview from '../../js/plugins/imgPreview';
import cacheFile from '../../js/utils/cacheFile';
import loadingSvg from '../../images/img/loading.svg';
import defaultIcon from '../../images/img/default-icon.png';
import localData from '../../js/common/localData';
if (!isLogin()) {
  toLogin();
}
// 数据同步
realtime.init().add((res) => {
  res.forEach((item) => {
    const {
      type,
      data: { flag },
    } = item;
    if (type === 'updatedata') {
      if (flag === 'trash') {
        renderList();
      } else if (flag === 'searchConfig') {
        updateSearchConfig();
      }
    }
    otherWindowMsg(item);
  });
});
const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $footer = $('.footer');
let { HASH } = queryURLParams(myOpen());
if (!HASH) {
  HASH = 'note';
}
// 搜索
const wInput = wrapInput($headWrap.find('.inp_box input')[0], {
  update(val) {
    if (val === '') {
      $headWrap.find('.inp_box .clean_btn').css('display', 'none');
    } else {
      $headWrap.find('.inp_box .clean_btn').css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
  },
  blur(e) {
    $(e.target).parent().removeClass('focus');
  },
  keyup(e) {
    if (e.key === 'Enter') {
      $contentWrap.pagenum = 1;
      renderList(true);
    }
  },
});
function listLoading() {
  let str = '';
  new Array(10).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:4rem;margin-bottom:0.6rem;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  pageScrollTop(0);
}
let curPageSize = localData.get('trashPageSize');
$contentWrap.pagenum = 1;
$contentWrap.list = [];
function getListItem(id) {
  return $contentWrap.list.find((item) => item.id === id) || {};
}
const trashBoxSelector = new BoxSelector(document, {
  selectables: '.item_box',
  onSelectStart({ e }) {
    if (
      _getTarget($contentWrap[0], e, '.item_box') ||
      _getTarget($contentWrap[0], e, '.item_info')
    )
      return true;
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
trashBoxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
function startSelect() {
  $contentWrap
    .find('.item_box .check_state')
    .css('display', 'block')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $footer
    .stop()
    .slideDown(_d.speed, () => {
      trashBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $contentWrap.find('.item_box .check_state').css('display', 'none');
  $footer
    .stop()
    .slideUp(_d.speed, () => {
      trashBoxSelector.stop();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function hdHighlight(con) {
  return _tpl(
    `
    <template v-for="{type,value} in con">
      <template v-if="type === 'text'">{{value}}</template>
      <template v-else-if="type === 'icon'">
        <span style="color:var(--btn-danger-color);">{{value}}</span><br/>
      </template>
      <span v-else-if="type === 'word'" style="color:var(--btn-danger-color);">{{value}}</span>
    </template>
    `,
    {
      con,
    }
  );
}
const imgLazy = new LazyLoad();
const bmLogoLazy = new LazyLoad();
function renderList(y) {
  let pagenum = $contentWrap.pagenum,
    a = wInput.getValue().trim(),
    slogo = 'icon-liebiao1';
  if (a.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  if (y) {
    listLoading();
  }
  myOpen(`#${encodeURIComponent(HASH)}`);
  pagenum ? null : (pagenum = 1);
  let btnText = '书签分组';
  if (HASH === 'note') {
    slogo = 'icon-jilu';
    btnText = '笔记';
  } else if (HASH === 'history') {
    slogo = 'icon-history';
    btnText = '历史记录';
  } else if (HASH === 'bmk') {
    slogo = 'icon-shuqian';
    btnText = '书签';
  }
  $headWrap.find('.select_btn').text(btnText);
  let showpage = curPageSize;
  reqUserTrashList({
    word: a,
    pageNo: pagenum,
    pageSize: showpage,
    type: HASH,
  })
    .then((result) => {
      if (result.code === 1) {
        let { total, data, pageNo, splitWord } = result.data;
        $contentWrap.list = data;
        $contentWrap.pagenum = pageNo;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <template v-for="{title,id,link,content,con,des,group_title,categoryArr,images} in list">
              <ul class="item_box" :data-id="id" :data-type="HASH">
                <div cursor="y" check="n" class="check_state"></div>
                <li class="item_type iconfont {{slogo}}"></li>
                <li v-html="getTitle(title,content)" :cursor="HASH !== 'bmk_group' ? 'y' : ''" class="item_title"></li>
                <li cursor="y" class="set_btn iconfont icon-maohao"></li>
              </ul>
              <div v-if="(categoryArr.length > 0 || (con && con.length > 0)) && HASH === 'note'" class="item_info">
                <template v-if="categoryArr.length > 0">
                  <span v-for="cgs in categoryArr" class="category">
                    <span style="color:var(--icon-color);margin-right:0.4rem;">#</span>{{cgs.title}}
                  </span>
                  <br/>
                </template>
                <img class="default_size" v-for="img in images" :src="loadingSvg" cursor="y" :data-src="img.src" :alt="img.alt" :title="img.alt" />
                <span v-if="con && con.length > 0" v-html="hdHighlight(con)"></span>
              </div>
              <div class="item_info" v-else-if="HASH === 'bmk'">
                <span class="category">
                  <span style="color:var(--icon-color);margin-right:0.4rem;">#</span>{{group_title}}
                </span>
                <br/>
                <div class="logo"></div>
                <a cursor="y" v-html="hdTitleHighlight(splitWord, link)" href="{{link}}" target="_blank"></a>
                <br/>
                <span v-html="hdTitleHighlight(splitWord, des)"></span>
              </div>
            </template >
            <div v-html="getPaging()" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            list: data,
            _d,
            HASH,
            slogo,
            splitWord,
            hdHighlight,
            loadingSvg,
            hdTitleHighlight,
            getTitle(title, content) {
              title ? null : (title = content);
              return hdTitleHighlight(splitWord, title);
            },
            getPaging() {
              return pgnt.getHTML({
                pageNo,
                pageSize: showpage,
                total,
                small: getScreenSize().w <= _d.screen,
              });
            },
          }
        );
        stopSelect();
        $contentWrap.html(html).addClass('open');
        $headWrap.addClass('open');
        if (y) {
          pageScrollTop(0);
        }
        if (HASH === 'note') {
          imgLazy.bind(
            [...$contentWrap[0].querySelectorAll('img')].filter((item) => {
              const url = item.getAttribute('data-src');
              const cache = cacheFile.hasUrl(url, 'image');
              if (cache) {
                item.src = cache;
                item.classList.remove('default_size');
              }
              return !cache;
            }),
            (item) => {
              const url = item.getAttribute('data-src');
              imgjz(url)
                .then((cache) => {
                  item.src = cache;
                  item.classList.remove('default_size');
                })
                .catch(() => {
                  item.style.display = 'none';
                });
            }
          );
        } else if (HASH === 'bmk') {
          bmLogoLazy.bind(
            [...$contentWrap[0].querySelectorAll('.logo')].filter((item) => {
              const $item = $(item);
              let { logo, link } = getListItem(
                $item.parent().prev().attr('data-id')
              );

              if (logo) {
                logo = getFilePath(logo);
              } else {
                logo = getFaviconPath(link);
              }
              const cache = cacheFile.hasUrl(logo, 'image');
              if (cache) {
                $item.css('background-image', `url(${cache})`).addClass('load');
              }
              return !cache;
            }),
            (item) => {
              const $item = $(item);
              let { logo, link } = getListItem(
                $item.parent().prev().attr('data-id')
              );

              if (logo) {
                logo = getFilePath(logo);
              } else {
                logo = getFaviconPath(link);
              }
              imgjz(logo)
                .then((cache) => {
                  $item
                    .css('background-image', `url(${cache})`)
                    .addClass('load');
                })
                .catch(() => {
                  $item
                    .css('background-image', `url(${defaultIcon})`)
                    .addClass('load');
                });
            }
          );
        }
      }
    })
    .catch(() => {});
}
const pgnt = pagination($contentWrap[0], {
  change(val) {
    $contentWrap.pagenum = val;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  changeSize(val) {
    curPageSize = val;
    localData.set('trashPageSize', curPageSize);
    $contentWrap.pagenum = 1;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
renderList(true);
if (isIframe()) {
  $headWrap.find('.h_go_home').remove();
}
function getTypeText(type) {
  switch (type) {
    case 'note':
      return '笔记';
    case 'bmk_group':
      return '书签分组';
    case 'bmk':
      return '书签';
    case 'history':
      return '历史记录';
    default:
      return '';
  }
}
$headWrap
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_check_item_btn', hdCheckItemBtn)
  .on('click', '.select_btn', function (e) {
    const data = [
      {
        text: '笔记',
        beforeIcon: 'iconfont icon-jilu',
        param: { value: 'note' },
      },
      {
        text: '书签分组',
        beforeIcon: 'iconfont icon-liebiao1',
        param: { value: 'bmk_group' },
      },
      {
        text: '书签',
        beforeIcon: 'iconfont icon-shuqian',
        param: { value: 'bmk' },
      },
      {
        text: '历史记录',
        beforeIcon: 'iconfont icon-history',
        param: { value: 'history' },
      },
      {
        text: '文件',
        beforeIcon: 'iconfont icon-gl-fileText',
        param: { value: 'file' },
      },
    ];
    data.forEach((item, idx) => {
      item.id = idx + 1 + '';
      if (item.param.value === HASH) {
        item.active = true;
      } else {
        item.active = false;
      }
    });
    rMenu.selectMenu(
      e,
      data,
      ({ close, id, param }) => {
        if (id) {
          close();
          if (param.value === 'file') {
            _myOpen(`/file#${_d.trashDir}`, '文件管理');
            return;
          }
          if (HASH !== param.value) {
            wInput.setValue('');
            HASH = param.value;
          }
          $contentWrap.pagenum = 1;
          renderList(true);
        }
      },
      '选择列表类型'
    );
  })
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    $contentWrap.pagenum = 1;
    renderList(true);
  })
  .on('click', '.inp_box .search_btn', function () {
    $contentWrap.pagenum = 1;
    renderList(true);
  });
function hdRecover(e, ids, t, cb, isCheck, loading = { start() {}, end() {} }) {
  const text = getTypeText(t);
  rMenu.pop(
    { e, text: `确认恢复：${isCheck ? '选中的' : ''}${text}？` },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqUserRecoverTrash({
          ids,
          type: t,
        })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
              renderList();
              cb && cb();
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
function hdDel(e, ids, t, cb, isCheck, loading = { start() {}, end() {} }) {
  const text = getTypeText(t);
  rMenu.pop(
    {
      e,
      text: `确认删除：${isCheck ? '选中的' : ''}${text}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqUserDeleteTrash({
          ids,
          type: t,
        })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
              renderList();
              cb && cb();
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
function updateSearchConfig() {
  reqSearchConfig()
    .then((res) => {
      if (res.code === 1) {
        if (Array.isArray(res.data.searchEngineData)) {
          _d.searchEngineData = [
            _d.defaultSearchEngineData,
            ...res.data.searchEngineData,
          ];
        }
        if (res.data.searchengineid) {
          localData.set('searchengine', res.data.searchengineid);
        }
      }
    })
    .catch(() => {});
}
updateSearchConfig();
function getSearchEngine() {
  return (
    _d.searchEngineData.find((s) => s.id === localData.get('searchengine')) ||
    _d.searchEngineData[0]
  );
}
$contentWrap
  .on('click', '.set_btn', function (e) {
    const $this = $(this);
    const id = $this.parent().attr('data-id');
    const obj = getListItem(id);
    const t = $this.parent().attr('data-type');
    let data = [];
    if (t === 'note') {
      data.push(
        {
          id: '1',
          text: '笔记内容',
          beforeIcon: 'iconfont icon-bianji',
        },
        { id: '4', text: '历史版本', beforeIcon: 'iconfont icon-history' }
      );
    }
    data = [
      ...data,
      { id: '2', text: '恢复', beforeIcon: 'iconfont icon-Undo' },
      {
        id: '3',
        text: '删除',
        beforeIcon: 'iconfont icon-shanchu',
      },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ e, close, id: flag, loading }) => {
        if (flag === '2') {
          hdRecover(
            e,
            [id],
            t,
            () => {
              close();
            },
            false,
            loading
          );
        } else if (flag === '3') {
          hdDel(
            e,
            [id],
            t,
            () => {
              close();
            },
            false,
            loading
          );
        } else if (flag === '1') {
          close();
          e.stopPropagation();
          _myOpen(`/edit#${encodeURIComponent(id)}`, obj.title);
        } else if (flag === '4') {
          close();
          e.stopPropagation();
          _myOpen(`/file#${_d.noteHistoryDir}/${obj.id}`, '文件管理');
        }
      },
      obj.title || obj.content
    );
  })
  .on('contextmenu', '.item_box', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    startSelect();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('click', '.item_type', function (e) {
    const $this = $(this).parent();
    const type = $this.attr('data-type');
    const obj = getListItem($this.attr('data-id'));
    if (type === 'bmk') {
      showBmkInfo(e, obj);
    } else if (type === 'history') {
      copyText(obj.content);
    } else if (type === 'note' || type === 'bmk_group') {
      copyText(obj.title);
    }
  })
  .on('click', '.item_title', function (e) {
    const $this = $(this);
    const type = $this.parent().attr('data-type');
    const obj = getListItem($this.parent().attr('data-id'));
    if (type === 'bmk') {
      myOpen(obj.link, '_blank');
    } else if (type === 'history') {
      if (isurl(obj.content)) {
        myOpen(obj.content, '_blank');
      } else {
        const url = getSearchEngine().link.replace(
          /\{\{(.*?)\}\}/g,
          obj.content
        );
        myOpen(url, '_blank');
      }
    } else if (type === 'note') {
      e.stopPropagation();
      _myOpen(`/note?v=${encodeURIComponent(obj.id)}`, obj.title);
    }
  })
  .on('click', 'img', function (e) {
    if (HASH !== 'note') return;
    const imgs = $contentWrap.find('img');
    let idx = 0;
    const arr = [];
    imgs.each((i, item) => {
      if (item === this) {
        idx = i;
      }
      arr.push({
        u1: item.getAttribute('data-src'),
      });
    });
    imgPreview(arr, idx, { x: e.clientX, y: e.clientY });
  })
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
longPress($contentWrap[0], '.item_box', function () {
  if (isSelecting()) return;
  startSelect();
  checkedItem(this.querySelector('.check_state'));
});
function checkedItem(el) {
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
  const $itemBox = $contentWrap.find('.item_box'),
    $checkArr = $itemBox.filter(
      (_, item) => $(item).find('.check_state').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $itemBox.length) {
    $footer.find('span').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $footer.find('span').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
function hdCheckItemBtn() {
  if (isSelecting()) {
    stopSelect();
  } else {
    startSelect();
  }
}
// 获取选中项
function getCheckItems() {
  const $itemBox = $contentWrap.find('.item_box'),
    $checkArr = $itemBox.filter(
      (_, item) => $(item).find('.check_state').attr('check') === 'y'
    );
  const arr = [];
  $checkArr.each((i, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  return arr;
}
$footer
  .on('click', '.f_delete', function (e) {
    const ids = getCheckItems();
    if (ids.length === 0) return;
    hdDel(e, ids, HASH, false, 1);
  })
  .on('click', '.f_recover', function (e) {
    const ids = getCheckItems();
    if (ids.length === 0) return;
    hdRecover(e, ids, HASH, false, 1);
  })
  .on('click', '.f_close', stopSelect)
  .on('click', 'span', switchCheckAll);
function switchCheckAll() {
  const $checkBtn = $footer.find('span');
  let che = $checkBtn.attr('check');
  che === 'y' ? (che = 'n') : (che = 'y');
  $checkBtn.attr({
    class:
      che === 'y'
        ? 'iconfont icon-xuanzeyixuanze'
        : 'iconfont icon-xuanzeweixuanze',
    check: che,
  });
  let $itemBox = $contentWrap.find('.item_box');
  $itemBox
    .find('.check_state')
    .attr('check', che)
    .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
  _msg.botMsg(`选中：${che === 'y' ? $itemBox.length : 0}项`);
}
scrollState(
  window,
  throttle(function ({ type }) {
    if (type === 'up') {
      $headWrap.removeClass('open');
    } else {
      $headWrap.addClass('open');
    }
  }, 1000)
);
document.addEventListener('keydown', function (e) {
  const key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  const isFocus = $('input').is(':focus') || $('textarea').is(':focus');
  if (isFocus) return;
  e.preventDefault();
  if (ctrl && key === 'a') {
    if (!isSelecting()) {
      startSelect();
    }
    switchCheckAll();
  }
});
