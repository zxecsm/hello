import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import {
  toLogin,
  showQcode,
  isIframe,
  myOpen,
  getScreenSize,
  formatDate,
  createShare,
  getExpState,
  copyText,
  isLogin,
  _getTarget,
  isMobile,
  longPress,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import pagination from '../../js/plugins/pagination';
import _d from '../../js/common/config';
import realtime from '../../js/plugins/realtime';
import {
  reqUserDeleteShare,
  reqUserEditShare,
  reqUserShareList,
  reqUserShareState,
} from '../../api/user';
import { _tpl } from '../../js/utils/template';
import { otherWindowMsg } from '../home/home';
import rMenu from '../../js/plugins/rightMenu';
import { BoxSelector } from '../../js/utils/boxSelector';
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
    if (type === 'updatedata' && flag === 'sharelist') {
      getShareList();
    }
    otherWindowMsg(item);
  });
});
const $contentWrap = $('.content_wrap'),
  $headBtns = $contentWrap.find('.head_btns'),
  $shareList = $contentWrap.find('.share_list'),
  $footer = $('.footer');
let pageNo = 1;
let sList = [];
let sPageSize = 20;
function getState(exp_time) {
  let v = '永久';
  const state = getExpState(exp_time);
  if (state > 0) {
    v = formatDate({
      template: '{0}-{1}-{2} {3}:{4}',
      timestamp: exp_time,
    });
  } else if (state < 0) {
    v = '已过期';
  }
  return v;
}
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
  const $itemBox = $shareList.find('li'),
    $checkArr = $itemBox.filter((_, item) => $(item).find('.check_state').attr('check') === 'y');
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
const shareBoxSelector = new BoxSelector($shareList[0], {
  selectables: 'li',
  onSelectStart({ e, container }) {
    const item = _getTarget(container, e, 'li');
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
shareBoxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
function startSelect() {
  $shareList.find('li .check_state').css('display', 'block');
  $footer
    .stop()
    .slideDown(_d.speed, () => {
      shareBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $shareList
    .find('li .check_state')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $footer
    .stop()
    .slideUp(_d.speed, () => {
      shareBoxSelector.stop();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
// 生成列表
function renderShareList(total, pageNo, top) {
  const html = _tpl(
    `
    <p v-if="total === 0">{{_d.emptyList}}</p>
    <template v-else>
      <li v-for="{id,type,title,pass,exp_time,state} in sList" :data-id="id" :data-url="getUrlAndLogo(type,id,pass).url">
        <div cursor="y" check="n" class="check_state"></div>
        <div cursor="y" class="item_type_logo iconfont {{getUrlAndLogo(type,id,pass).logo}}"></div>
        <div title="点击复制分享链接" class="title">名称：<span>{{title}}</span> ； 提取码：<span>{{pass || '无'}}</span> ； 有效期：<span :style="getExpState(exp_time) < 0 ? 'color:red;' : ''">{{getState(exp_time)}}</span> ； </div>
        <div cursor="y" class="state iconfont {{state === 1 ? 'icon-kaiguan-kai1 active' : 'icon-kaiguan-guan'}}"></div>
        <div cursor="y" class="copy_link iconfont icon-erweima"></div>
        <div cursor="y" class="edit iconfont icon-bianji"></div>
        <div cursor="y" class="delete iconfont icon-shanchu"></div>
      </li>
      <div v-html="getPaging()" class="pagination" style="padding: 2rem 0"></div>
    </template>
    `,
    {
      total,
      _d,
      sList,
      getUrlAndLogo(type, id, pass) {
        let logo = 'icon-cat_full_foot',
          url = _d.originURL;
        if (type === 'music') {
          logo = `icon-yinle1`;
          url += `/sharemusic?s=${id}`;
        } else if (type === 'bookmk') {
          logo = `icon-shuqian`;
          url += `/sharebm?s=${id}`;
        } else if (type === 'file') {
          logo = `icon-gl-fileText`;
          url += `/sharefile?s=${id}`;
        } else if (type === 'dir') {
          logo = `icon-gl-folder`;
          url += `/sharefile?s=${id}`;
        }
        if (pass) url += `&p=${pass}`;
        return { logo, url };
      },
      getExpState,
      getState,
      getPaging() {
        return pgnt.getHTML({
          pageNo,
          pageSize: sPageSize,
          total,
          small: getScreenSize().w <= _d.screen,
        });
      },
    },
  );
  stopSelect();
  $shareList.html(html).addClass('open');
  $headBtns.addClass('open');
  if (top) {
    $shareList.scrollTop(0);
  }
}
// 分页
const pgnt = pagination($shareList[0], {
  change(val) {
    pageNo = val;
    getShareList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  changeSize(val) {
    sPageSize = val;
    pageNo = 1;
    getShareList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  toTop() {
    $shareList.scrollTop(0);
  },
});
// 获取分享数据
function getShareList(top) {
  reqUserShareList({ pageNo, pageSize: sPageSize })
    .then((res) => {
      if (res.code === 1) {
        const { data, total } = res.data;
        pageNo = res.data.pageNo;
        sList = data;
        renderShareList(total, pageNo, top);
      }
    })
    .catch(() => {});
}
// 获取分享信息
function getShareItem(id) {
  return sList.find((item) => item.id === id) || {};
}
getShareList(1);
// 删除
function deleteShare(e, ids, text = '') {
  rMenu.pop(
    {
      e,
      text: `确认删除：${text || '选中分享'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        reqUserDeleteShare({ ids })
          .then((res) => {
            if (res.code === 1) {
              _msg.success(res.codeText);
              getShareList();
            }
          })
          .catch(() => {});
      }
    },
  );
}
// 编辑
function editShare(e, obj) {
  createShare(
    e,
    {
      title: '编辑分享项',
      name: obj.title,
      expireTime: getExpState(obj.exp_time),
      pass: obj.pass,
    },
    ({ close, inp, loading }) => {
      const { title, pass, expireTime } = inp;
      loading.start();
      reqUserEditShare({ id: obj.id, title, pass, expireTime })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(1);
            getShareList();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
  );
}
function changeShareState(ids, state) {
  reqUserShareState({ ids, state })
    .then((res) => {
      if (res.code === 1) {
        _msg.success(res.codeText);
        getShareList();
      }
    })
    .catch(() => {});
}
longPress($shareList[0], 'li', function () {
  if (isSelecting()) return;
  startSelect();
  checkedItem(this.querySelector('.check_state'));
});
$shareList
  .on('click', '.check_state', function () {
    checkedItem(this);
  })
  .on('click', '.delete', function (e) {
    const obj = getShareItem($(this).parent().attr('data-id'));
    deleteShare(e, [obj.id], obj.title);
  })
  .on('click', '.edit', function (e) {
    const obj = getShareItem($(this).parent().attr('data-id'));
    editShare(e, obj);
  })
  .on('click', '.state', function () {
    const obj = getShareItem($(this).parent().attr('data-id'));
    changeShareState([obj.id], obj.state === 1 ? 0 : 1);
  })
  .on('click', '.copy_link', function (e) {
    const $this = $(this);
    const url = $this.parent().attr('data-url');
    const id = $this.parent().attr('data-id');
    const obj = getShareItem(id);
    showQcode(e, url, obj.title).catch(() => {});
  })
  .on('contextmenu', 'li', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    startSelect();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('click', '.item_type_logo', function () {
    const $this = $(this);
    const url = $this.parent().attr('data-url');
    const id = $this.parent().attr('data-id');
    const obj = getShareItem(id);
    const str = `分享名称：${obj.title}\n分享链接：${url}\n访问密码：${
      obj.pass || '无'
    }\n有效期：${getState(obj.exp_time)}`;
    copyText(str);
  });
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
$headBtns
  .on('click', '.select', function () {
    if (isSelecting()) {
      stopSelect();
    } else {
      startSelect();
    }
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  });
// 获取选中项
function getCheckItems() {
  const $itemBox = $shareList.find('li'),
    $checkArr = $itemBox.filter((_, item) => $(item).find('.check_state').attr('check') === 'y');
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
    deleteShare(e, ids);
  })
  .on('click', '.f_close', function () {
    stopSelect();
  })
  .on('click', '.f_on', function () {
    const ids = getCheckItems();
    if (ids.length === 0) return;
    changeShareState(ids, 1);
  })
  .on('click', '.f_off', function () {
    const ids = getCheckItems();
    if (ids.length === 0) return;
    changeShareState(ids, 0);
  })
  .on('click', 'span', switchCheckAll);
function switchCheckAll() {
  const $checkBtn = $footer.find('span');
  let che = $checkBtn.attr('check');
  che === 'y' ? (che = 'n') : (che = 'y');
  $checkBtn.attr({
    class: che === 'y' ? 'iconfont icon-xuanzeyixuanze' : 'iconfont icon-xuanzeweixuanze',
    check: che,
  });
  const $itemBox = $shareList.find('li');
  $itemBox
    .find('.check_state')
    .attr('check', che)
    .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
  _msg.botMsg(`选中：${che === 'y' ? $itemBox.length : 0}项`);
}
