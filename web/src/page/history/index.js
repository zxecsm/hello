import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import {
  myOpen,
  _setData,
  _getData,
  isurl,
  toLogin,
  scrollState,
  throttle,
  isIframe,
  wrapInput,
  getScreenSize,
  isMobile,
  longPress,
  hdTitleHighlight,
  copyText,
  isLogin,
  pageScrollTop,
  wave,
  darkMode,
  _getTarget,
  toggleUserSelect,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import _pop from '../../js/plugins/popConfirm';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import realtime from '../../js/plugins/realtime';
import {
  reqSearchConfig,
  reqSearchDelete,
  reqSearchHistoryList,
  reqSearchSave,
} from '../../api/search';
import rMenu from '../../js/plugins/rightMenu';
import changeDark from '../../js/utils/changeDark';
import { _tpl } from '../../js/utils/template';
import { BoxSelector } from '../../js/utils/boxSelector';
const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $footer = $('.footer');
if (!isLogin()) {
  toLogin();
}
// 同步数据
realtime.init().add((res) => {
  res.forEach((item) => {
    const {
      type,
      data: { flag },
    } = item;
    if (type === 'updatedata' && flag === 'history') {
      renderList();
    }
  });
});
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
// 加载
function listLoading() {
  let str = '';
  new Array(10).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:40px;margin-bottom:6px;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  pageScrollTop(0);
}
let curPageSize = _getData('historyPageSize'),
  hList = [];
$contentWrap.pagenum = 1;
function getItemInfo(id) {
  return hList.find((item) => item.id === id);
}
function renderList(y) {
  const pagenum = $contentWrap.pagenum,
    word = wInput.getValue().trim();
  if (word.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  if (y) {
    listLoading();
  }
  const showpage = curPageSize;
  reqSearchHistoryList({
    word,
    pageNo: pagenum,
    pageSize: showpage,
  })
    .then((result) => {
      if (result.code === 1) {
        const { total, data, pageNo, splitWord } = result.data;
        hList = data;
        $contentWrap.pagenum = pageNo;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <ul v-for="{id, content} in list" class="item_box" :data-id="id">
              <div cursor="y" check="n" class="check_state"></div>
              <li class="item_type iconfont icon-history"></li>
              <li cursor="y" v-html="hdTitleHighlight(splitWord,content)" class="item_title"></li>
              <li cursor="y" class="del_item iconfont icon-shanchu"></li>
            </ul>
            <div v-html="getPagin()" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            list: data,
            _d,
            hdTitleHighlight,
            splitWord,
            getPagin() {
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
      }
    })
    .catch(() => {});
}
// 分页
const pgnt = pagination($contentWrap[0], {
  change(val) {
    $contentWrap.pagenum = val;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  changeSize(val) {
    curPageSize = val;
    _setData('historyPageSize', curPageSize);
    $contentWrap.pagenum = 1;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
renderList(true);
reqSearchConfig()
  .then((res) => {
    if (res.code === 1) {
      _d.searchEngineData = res.data.searchEngineData;
    }
  })
  .catch(() => {});
// 获取搜索引擎
function getSearchEngine() {
  return (
    _d.searchEngineData[_getData('searchengine')] || _d.searchEngineData[0]
  );
}
// 删除
function deleteHistory(e, ids, isCheck) {
  _pop(
    {
      e,
      text: `确认删除：${isCheck ? '选中的' : ''}历史记录？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        reqSearchDelete({ ids })
          .then((result) => {
            if (result.code === 1) {
              _msg.success(result.codeText);
              renderList();
            }
          })
          .catch(() => {});
      }
    }
  );
}
$contentWrap
  .on('click', '.del_item', function (e) {
    const $this = $(this);
    const id = $this.parent().attr('data-id');
    deleteHistory(e, [id]);
  })
  .on('click', '.item_title', function () {
    const { content } = getItemInfo($(this).parent().attr('data-id'));
    if (isurl(content)) {
      myOpen(content, '_blank');
    } else {
      const url = getSearchEngine().searchlink.replace(
        /\{\{(.*?)\}\}/g,
        content
      );
      myOpen(url, '_blank');
    }
  })
  .on('contextmenu', '.item_box', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    hdCheckItemBtn();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('click', '.item_type', function () {
    const { content } = getItemInfo($(this).parent().attr('data-id'));
    copyText(content);
  })
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
longPress($contentWrap[0], '.item_box', function () {
  if (isSelecting()) return;
  hdCheckItemBtn();
  checkedItem(this.querySelector('.check_state'));
});
// 选中
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
if (isIframe()) {
  $headWrap.find('.h_go_home').remove();
}
const boxSelector = new BoxSelector(document, {
  selectables: '.content_wrap .item_box',
  onSelectStart({ e }) {
    const item = _getTarget($contentWrap[0], e, '.content_wrap .item_box');
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
            display: 'block',
            'background-color': _d.checkColor,
          })
          .attr('check', 'y');
      } else if (!needCheck && isChecked && !isKeepOld) {
        $cItem
          .css({
            display: 'block',
            'background-color': 'transparent',
          })
          .attr('check', 'n');
      }
    });
  },
});
boxSelector.stop();
// 开启选中
function hdCheckItemBtn() {
  if (isSelecting()) {
    stopSelect();
  } else {
    startSelect();
  }
  $footer.find('span').attr({
    class: 'iconfont icon-xuanzeweixuanze',
    check: 'n',
  });
}
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
      boxSelector.start();
      toggleUserSelect(false);
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
      boxSelector.stop();
      toggleUserSelect();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
// 添加历史
function addHistory(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          type: 'textarea',
          verify(val) {
            if (val === '') {
              return '请输入需要添加的内容';
            } else if (val.length > _d.fieldLenght.searchHistory) {
              return '内容过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const content = inp.text;
      loading.start();
      reqSearchSave({ content })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            $contentWrap.pagenum = 1;
            renderList(true);
            close();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '添加搜索历史'
  );
}
$headWrap
  .on('click', '.h_check_item_btn', hdCheckItemBtn)
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_add_item_btn', addHistory)
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    $contentWrap.pagenum = 1;
    renderList(true);
  })
  .on('click', '.inp_box .search_btn', function () {
    $contentWrap.pagenum = 1;
    renderList(true);
  });

$footer
  .on('click', '.f_delete', function (e) {
    const $itemBox = $contentWrap.find('.item_box'),
      $checkArr = $itemBox.filter(
        (_, item) => $(item).find('.check_state').attr('check') === 'y'
      );
    if ($checkArr.length === 0) return;
    const arr = [];
    $checkArr.each((i, v) => {
      arr.push(v.getAttribute('data-id'));
    });
    deleteHistory(e, arr, 1);
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
  const $itemBox = $contentWrap.find('.item_box');
  $itemBox
    .find('.check_state')
    .attr('check', che)
    .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
  _msg.botMsg(`选中：${che === 'y' ? $itemBox.length : 0}项`);
}
// 滚动
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
