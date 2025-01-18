import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import './index.less';
import {
  _setData,
  _getData,
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
  wave,
  darkMode,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import realtime from '../../js/plugins/realtime';
import {
  reqUserDeleteTrash,
  reqUserRecoverTrash,
  reqUserTrashList,
} from '../../api/user';
import toolTip from '../../js/plugins/tooltip';
import rMenu from '../../js/plugins/rightMenu';
import { showBmkInfo } from '../../js/utils/showinfo';
import { reqSearchConfig } from '../../api/search';
import changeDark from '../../js/utils/changeDark';
import { _tpl } from '../../js/utils/template';
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
    if (type === 'updatedata' && flag === 'trash') {
      renderList();
    }
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
    str += `<ul style="pointer-events: none;height:40px;margin-bottom:6px;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  pageScrollTop(0);
}
let curPageSize = _getData('trashPageSize');
$contentWrap.pagenum = 1;
$contentWrap.list = [];
function getListItem(id) {
  return $contentWrap.list.find((item) => item.id === id);
}
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
  myOpen(`/trash/#${encodeURIComponent(HASH)}`);
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
            <ul v-for="{title,id,link,content} in list" class="item_box" :data-id="id" :data-type="HASH">
              <div cursor="y" check="n" class="check_state"></div>
              <li class="item_type iconfont {{slogo}}"></li>
              <li v-html="getTitle(title,content,link)" :cursor="HASH !== 'bmk_group' ? 'y' : ''" class="item_title"></li>
              <li cursor="y" class="set_btn iconfont icon-icon"></li>
            </ul>
            <div v-html="getPaging()" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            list: data,
            _d,
            HASH,
            slogo,
            getTitle(title, content, link) {
              title ? null : (title = content);
              link ? (title = `${title} (${link})`) : null;
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
        $contentWrap.html(html).addClass('open');
        $headWrap.addClass('open');
        $headWrap._checkState = false;
        $footer.stop().slideUp(_d.speed);
        if (y) {
          pageScrollTop(0);
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
    _setData('trashPageSize', curPageSize);
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
  _pop({ e, text: `确认恢复：${isCheck ? '选中的' : ''}${text}？` }, (type) => {
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
  });
}
function hdDel(e, ids, t, cb, isCheck, loading = { start() {}, end() {} }) {
  const text = getTypeText(t);
  _pop(
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
reqSearchConfig()
  .then((res) => {
    if (res.code === 1) {
      _d.searchEngineData = res.data.searchEngineData;
    }
  })
  .catch(() => {});
function getSearchEngine() {
  return (
    _d.searchEngineData[_getData('searchengine')] || _d.searchEngineData[0]
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
          _myOpen(`/edit/#${encodeURIComponent(id)}`, obj.title);
        } else if (flag === '4') {
          close();
          e.stopPropagation();
          _myOpen(`/file/#/${_d.noteHistoryDirName}/${obj.id}`, '文件管理');
        }
      },
      obj.title || obj.content
    );
  })
  .on('contextmenu', '.item_box', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    if (!$footer.is(':hidden')) return;
    hdCheckItemBtn();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('mouseenter', '.item_box', function () {
    const $this = $(this);
    const type = $this.attr('data-type');
    if (type === 'bmk') {
      const obj = getListItem($this.attr('data-id'));
      const { title, link, des } = obj;
      const str = `名称：${title || '--'}\n链接：${link || '--'}\n描述：${
        des || '--'
      }`;
      toolTip.setTip(str).show();
    }
  })
  .on('mouseleave', '.item_box', function () {
    toolTip.hide();
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
        const url = getSearchEngine().searchlink.replace(
          /\{\{(.*?)\}\}/g,
          obj.content
        );
        myOpen(url, '_blank');
      }
    } else if (type === 'note') {
      e.stopPropagation();
      _myOpen(`/note/?v=${encodeURIComponent(obj.id)}`, obj.title);
    }
  })
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
longPress($contentWrap[0], '.item_box', function () {
  if (!$footer.is(':hidden')) return;
  hdCheckItemBtn();
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
  const $itemBox = $contentWrap.find('.item_box'),
    $checkArr = $itemBox.filter(
      (_, item) => $(item).find('.check_state').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length > 0) {
    $footer.stop().slideDown(_d.speed);
  } else {
    $footer.stop().slideUp(_d.speed);
  }
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
  const $itemBox = $contentWrap.find('.item_box');
  if ($headWrap._checkState) {
    $itemBox.find('.check_state').css('display', 'none');
    $headWrap._checkState = false;
    $footer.stop().slideUp(_d.speed);
  } else {
    $itemBox
      .find('.check_state')
      .css('display', 'block')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $headWrap._checkState = true;
    $footer.stop().slideDown(_d.speed);
  }
  $footer.find('span').attr({
    class: 'iconfont icon-xuanzeweixuanze',
    check: 'n',
  });
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
  .on('click', '.f_close', function () {
    let $itemBox = $contentWrap.find('.item_box');
    $itemBox
      .find('.check_state')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $footer.stop().slideUp(_d.speed);
  })
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
    if (!$headWrap._checkState) {
      hdCheckItemBtn();
    }
    switchCheckAll();
  }
});
if (!isIframe()) wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
