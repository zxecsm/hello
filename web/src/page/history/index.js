import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import {
  myOpen,
  _setData,
  _getData,
  debounce,
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
  setPageScrollTop,
  wave,
  darkMode,
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
  change(val) {
    val = val.trim();
    if (val == '') {
      $headWrap.find('.inp_box i').css('display', 'none');
    } else {
      $headWrap.find('.inp_box i').css('display', 'block');
    }
    $contentWrap.pagenum = 1;
    _renderList(true);
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    $(target).parent().removeClass('focus');
  },
});
// 加载
function listLoading() {
  let str = '';
  new Array(50).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:40px;margin-bottom:6px;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  setPageScrollTop(0);
}
let curPageSize = _getData('historyPageSize'),
  hList = [];
$contentWrap.pagenum = 1;
function getItemInfo(id) {
  return hList.find((item) => item.id === id);
}
const defaultRes = `<p style='text-align: center;'>${_d.emptyList}</p>`;
const _renderList = debounce(renderList, 1000);
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
      if (parseInt(result.code) === 0) {
        let str = '';
        const { total, data, pageNo, splitWord } = result.data;
        hList = data;
        $contentWrap.pagenum = pageNo;
        if (data.length === 0) {
          str += defaultRes;
        } else {
          data.forEach((v) => {
            const { id, data } = v;
            str += `<ul class="item_box" data-id="${id}">
                          <div cursor check="n" class="check_state"></div>
                        <li class="item_type iconfont icon-history"></li>
                        <li cursor class="item_title">${hdTitleHighlight(
                          splitWord,
                          data
                        )}</li>
                        <li cursor class="del_item iconfont icon-shanchu"></li>
                        </ul>`;
          });
        }
        str += `<div class="pagingbox">`;
        str += pgnt.getHTML({
          pageNo,
          pageSize: showpage,
          total,
          small: getScreenSize().w <= _d.screen,
        });
        str += `</div > `;
        $contentWrap.html(str).addClass('open');
        $headWrap.addClass('open');
        $headWrap._flag = false;
        $footer.stop().slideUp(_d.speed);
        if (y) {
          setPageScrollTop(0);
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
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  },
});
renderList(true);
reqSearchConfig()
  .then((res) => {
    if (res.code == 0) {
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
      if (type == 'confirm') {
        reqSearchDelete({ ids })
          .then((result) => {
            if (parseInt(result.code) === 0) {
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
    const { data } = getItemInfo($(this).parent().attr('data-id'));
    if (isurl(data)) {
      myOpen(data, '_blank');
    } else {
      const url = getSearchEngine().searchlink.replace(/\{\{\}\}/, data);
      myOpen(url, '_blank');
    }
  })
  .on('contextmenu', '.item_box', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    if (!$footer.is(':hidden')) return;
    hdCheckItemBtn();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('click', '.item_type', function () {
    const { data } = getItemInfo($(this).parent().attr('data-id'));
    copyText(data);
  })
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
longPress($contentWrap[0], '.item_box', function () {
  if (!$footer.is(':hidden')) return;
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
// 开启选中
function hdCheckItemBtn() {
  const $itemBox = $contentWrap.find('.item_box');
  if ($headWrap._flag) {
    $itemBox.find('.check_state').css('display', 'none');
    $headWrap._flag = false;
    $footer.stop().slideUp(_d.speed);
  } else {
    $itemBox
      .find('.check_state')
      .css('display', 'block')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $headWrap._flag = true;
    $footer.stop().slideDown(_d.speed);
  }
  $footer.find('span').attr({
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
            if (val.trim() == '') {
              return '请输入需要添加的内容';
            } else if (val.trim().length > 100) {
              return '内容过长';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const data = inp.text;
        reqSearchSave({ data })
          .then((res) => {
            if (res.code == 0) {
              $contentWrap.pagenum = 1;
              renderList(true);
              close();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '添加搜索历史'
  );
}
$headWrap
  .on('click', '.h_check_item_btn', hdCheckItemBtn)
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_add_item_btn', addHistory)
  .on('click', '.inp_box i', function () {
    wInput.setValue('');
    wInput.target.focus();
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
  .on('click', '.f_close', function () {
    const $itemBox = $contentWrap.find('.item_box');
    $itemBox
      .find('.check_state')
      .css('display', 'none')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $headWrap._flag = false;
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
    if (type == 'up') {
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
    if (!$headWrap._flag) {
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
