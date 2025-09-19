import $ from 'jquery';
import defaultIcon from '../../../images/img/default-icon.png';

import {
  myOpen,
  debounce,
  _getTarget,
  imgjz,
  isurl,
  _position,
  loadingImg,
  longPress,
  isMobile,
  createShare,
  isInteger,
  LazyLoad,
  _mySlide,
  _setTimeout,
} from '../../../js/utils/utils.js';

import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';

import {
  reqBmkAddBmk,
  reqBmkAddGroup,
  reqBmkDeleteBmk,
  reqBmkDeleteGroup,
  reqBmkEditBmk,
  reqBmkEditGroup,
  reqBmkList,
  reqBmkGroupShareState,
  reqBmkMoveBmk,
  reqBmkMoveGroup,
  reqBmkParseSiteInfo,
  reqBmkShare,
  reqBmkToGroup,
  reqBmkDeleteLogo,
} from '../../../api/bmk.js';

import { upLogo } from '../rightSetting/index.js';

import {
  checkedHomeBm,
  openCheckState,
  getHomeBmList,
  showHomeFootMenu,
  hideSearchBox,
} from '../searchBox/index.js';

import { popWindow } from '../popWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { _tpl } from '../../../js/utils/template.js';
import _path from '../../../js/utils/path.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import {
  BoxSelector,
  MouseElementTracker,
} from '../../../js/utils/boxSelector.js';
import localData from '../../../js/common/localData.js';

const $asideBtn = $('.aside_btn'),
  $asideWrap = $('.aside_wrap'),
  $aside = $asideWrap.find('.aside');

let asidePageSize = localData.get('asidePageSize');
let bookmark = [];

// 设置书签数据
export function setBookMark(val) {
  if (val === undefined) {
    return bookmark;
  }
  bookmark = val;
}
const bmMouseElementTracker = new MouseElementTracker($aside.find('.list')[0], {
  delay: 300,
  onStart({ e }) {
    const item = _getTarget($aside[0], e, '.list .bm_item');
    if (isSelecting() || !item || !e.target.className.includes('bm_logo'))
      return true;
    $aside.bmfromDom = item;
    const obj = getBmItemData(
      $(item).parent().prev().attr('data-id'),
      item.dataset.id
    );
    bmMouseElementTracker.changeInfo(obj.title);
  },
  onMove() {
    allowSlide.update();
  },
  onEnd({ dropElement }) {
    if (!isSelecting() && $aside.bmfromDom) {
      const to = dropElement
        ? _getTarget($aside[0], { target: dropElement }, '.list .bm_item')
        : null;
      if (to) {
        const pid = $(to).parent().prev().attr('data-id');
        const toId = to.dataset.id;
        const fromId = $aside.bmfromDom.dataset.id;
        if (fromId !== toId) {
          dragMoveBookmark(pid, fromId, toId);
        }
      }
      $aside.bmfromDom = null;
    }
  },
});

// 书签移动位置
export function dragMoveBookmark(groupId, fromId, toId) {
  reqBmkMoveBmk({ groupId, fromId, toId })
    .then((result) => {
      if (result.code === 1) {
        getHomeBmList();
        getBookMarkList();
        return;
      }
    })
    .catch(() => {});
}

// 分组移动位置
function bmListMove(fromId, toId) {
  reqBmkMoveGroup({ fromId, toId })
    .then((result) => {
      if (result.code === 1) {
        getBookMarkList();
        return;
      }
    })
    .catch(() => {});
}

const bmListMouseElementTracker = new MouseElementTracker(
  $aside.find('.list')[0],
  {
    delay: 300,
    onStart({ e }) {
      const item = _getTarget($aside[0], e, '.list .list_title');
      if (!item || isSelecting() || e.target.tagName !== 'I') return true;
      $aside.bmListfromDom = item;
      const obj = getBmListTitleData(item.dataset.id);
      bmListMouseElementTracker.changeInfo(obj.title);
    },
    onMove() {
      allowSlide.update();
    },
    onEnd({ dropElement }) {
      if (!isSelecting() && $aside.bmListfromDom) {
        const to = dropElement
          ? _getTarget($aside[0], { target: dropElement }, '.list .list_title')
          : null;
        if (to) {
          const toId = to.dataset.id;
          const fromId = $aside.bmListfromDom.dataset.id;
          if (fromId !== toId) {
            bmListMove(fromId, toId);
          }
        }
        $aside.bmListfromDom = null;
      }
    },
  }
);

$asideBtn.activeId = 'hide'; // 记录开启列表id
// 获取书签列表
export function getBookMarkList(
  activeId = $asideBtn.activeId,
  p,
  delayScroll = 0
) {
  if (asideWrapIsHide()) return;

  reqBmkList({ id: activeId })
    .then((result) => {
      if (result.code === 1) {
        bookmark = result.data;
        $asideBtn.activeId = activeId;
        renderAsideList(p, delayScroll);
      }
    })
    .catch(() => {});
}

let asidePageNo = 1;
let isSelectingBm = true; // 选中状态

// 切换书签和分组选中状态
function switchCheckState() {
  const $fMenu = $aside.find('.foot_menu .flex_wrap');
  if (isSelectingBm) {
    $fMenu.removeClass('liststate');
  } else {
    $fMenu.addClass('liststate');
  }
}
const bmListBoxSelector = new BoxSelector($aside.find('.list')[0], {
  selectables: '.list_title',
  onSelectStart({ e }) {
    const item = _getTarget($aside[0], e, '.list_title');
    if (item) return true;
  },
  onSelectEnd() {
    updateBmListSelectInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_bmlist');
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
bmListBoxSelector.stop();
const bmBoxSelector = new BoxSelector($aside.find('.list')[0], {
  selectables: '.bm_item',
  onSelectStart({ e }) {
    const item = _getTarget($aside[0], e, '.bm_item');
    if (item) return true;
  },
  onSelectEnd() {
    updateBmSelectInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_bm');
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
bmBoxSelector.stop();
// 生成列表
function renderAsideList(p, delayScroll = 0) {
  if (asideWrapIsHide()) return;
  stopSelect();
  let id = $asideBtn.activeId,
    _nav = bookmark.list;
  const html = _tpl(
    `
    <template v-for="item in _nav">
      <div class="list_title no_select" :data-id="item.id" :flag="item.id==id?'on':'off'">
        <div cursor="y" check="n" class="check_bmlist"></div>
        <i cursor="y" class="iconfont {{item.share === 1 ? 'icon-24gl-unlock4' : 'icon-24gl-unlock2 active'}}"></i>
        <em cursor="y">{{item.title}}</em>
      </div>
      <ul v-show="item.id==id">
        <template v-if="item.id==id">
          <li v-for="y in getBmList(item)" class="bm_item no_select" :data-id="y.id" cursor="y">
            <div cursor="y" check="n" class="check_bm"></div>
            <div class="bm_logo"></div>
            <div class="bm_name">{{y.title}}</div>
            <p>{{y.des || '描述'}}</p>
          </li>
          <div v-html="getPaging(item)"></div>
        </template>
      </ul>
    </template>
    <div cursor="y" title="添加分组" class="add_list_btn iconfont icon-tianjia"></div>
    `,
    {
      _nav,
      id,
      getBmList(item) {
        const pageTotal = Math.ceil(item.item.length / asidePageSize);
        asidePageNo < 1
          ? (asidePageNo = pageTotal)
          : asidePageNo > pageTotal
          ? (asidePageNo = 1)
          : null;
        return item.item.slice(
          (asidePageNo - 1) * asidePageSize,
          asidePageNo * asidePageSize
        );
      },
      getPaging(item) {
        const pageTotal = Math.ceil(item.item.length / asidePageSize);
        asidePageNo < 1
          ? (asidePageNo = pageTotal)
          : asidePageNo > pageTotal
          ? (asidePageNo = 1)
          : null;
        return asidePgnt.getHTML({
          pageNo: asidePageNo,
          pageSize: asidePageSize,
          total: item.item.length,
        });
      },
    }
  );

  const $aList = $aside.find('.list');
  $aList.html(html);
  if (p) {
    const curIdx = bookmark.list.findIndex(
      (item) => item.id === $asideBtn.activeId
    );
    if (curIdx >= 0) {
      _setTimeout(() => {
        const $listTitle = $aList.find('.list_title').eq(curIdx);
        $aList.stop().animate(
          {
            scrollTop: _position($listTitle[0]).top + $aList[0].scrollTop,
          },
          _d.speed
        );
      }, delayScroll);
    }
  }
  hdAsideListItemLogo();
}
// 分页
const asidePgnt = pagination($aside[0], {
  pageSize: asidePageSize,
  showTotal: false,
  small: true,
  select: [6, 12, 18, 24, 30, 36],
  change(val) {
    asidePageNo = val;
    renderAsideList(1);
  },
  changeSize(val) {
    asidePageSize = val;
    localData.set('asidePageSize', asidePageSize);
    asidePageNo = 1;
    renderAsideList(1);
  },
});

const asideLoadImg = new LazyLoad();

// 加载logo
function hdAsideListItemLogo() {
  if ($asideBtn.activeId === 'hide') return;
  const bmLogos = [...$aside[0].querySelectorAll('.bm_item')].filter((item) => {
    const $item = $(item);
    let { logo, link } = getBmItemData(
      $asideBtn.activeId,
      $item.attr('data-id')
    );

    if (logo) {
      logo = _path.normalize('/api/pub', logo);
    } else {
      logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
    }
    let $bm_logo = $item.find('.bm_logo');
    const cache = cacheFile.hasUrl(logo, 'image');
    if (cache) {
      $bm_logo.css('background-image', `url(${cache})`).addClass('load');
    }
    return !cache;
  });
  asideLoadImg.bind(bmLogos, (item) => {
    const $item = $(item);
    let { logo, link } = getBmItemData(
      $asideBtn.activeId,
      $item.attr('data-id')
    );

    if (logo) {
      logo = _path.normalize('/api/pub', logo);
    } else {
      logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
    }
    const $bm_logo = $item.find('.bm_logo');
    imgjz(logo)
      .then((cache) => {
        $bm_logo.css('background-image', `url(${cache})`).addClass('load');
      })
      .catch(() => {
        $bm_logo
          .css('background-image', `url(${defaultIcon})`)
          .addClass('load');
      });
  });
}

// 获取分组信息
function getBmListTitleData(id) {
  return bookmark.list.find((item) => item.id === id) || {};
}

// 获取书签信息
function getBmItemData(groupId, id) {
  const p = bookmark.list.find((item) => item.id === groupId);
  return p?.item?.find((item) => item.id === id) || {};
}

// 获取选中书签
function getAsideCheckBmItem() {
  const $bmItem = $aside.find('.bm_item'),
    $checkArr = $bmItem.filter(
      (_, item) => $(item).find('.check_bm').attr('check') === 'y'
    );
  const arr = [];
  $checkArr.each((_, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  return arr;
}

// 选中的分组
function getAsideCheckBmList() {
  const $bmItem = $aside.find('.list_title'),
    $checkArr = $bmItem.filter(
      (_, item) => $(item).find('.check_bmlist').attr('check') === 'y'
    );
  const arr = [];
  $checkArr.each((_, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  return arr;
}

// 新增分组
function addBmList(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          placeholder: '标题',
          verify(val) {
            if (val === '') {
              return '请输入标题';
            } else if (val.length > _d.fieldLength.title) {
              return '标题过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      loading.start();
      reqBmkAddGroup({ title: inp.text })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText);
            getBookMarkList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '添加书签分组'
  );
}

// 删除书签
export function delBm(e, arr, cb, text, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${text || '选中的书签'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqBmkDeleteBmk({ ids: arr })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
              cb && cb();
              getBookMarkList();
              getHomeBmList();
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    }
  );
}

// 切换分组打开状态
function switchListOpenState() {
  const $this = $(this).parent(),
    id = $this.attr('data-id');
  if ($this.attr('flag') === 'on') {
    $this.next().css('display', 'none').html('');
    $asideBtn.activeId = 'hide';
    $this.attr('flag', 'off');
    return;
  }
  $this.next().css('display', 'block');
  loadingImg($this.next()[0]);
  asidePageNo = 1;
  getBookMarkList(id, 1);
}

// 全选/全不选
function hdCheckAll() {
  let che = $(this).attr('check');
  che === 'y' ? (che = 'n') : (che = 'y');
  $aside.find('.foot_menu .flex_wrap div').attr({
    class:
      che === 'y'
        ? 'iconfont icon-xuanzeyixuanze'
        : 'iconfont icon-xuanzeweixuanze',
    check: che,
  });
  if (isSelectingBm) {
    const $sidenav = $aside.find('.bm_item');
    $sidenav
      .find('.check_bm')
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $sidenav.length : 0}项`);
  } else {
    const $sidenav = $aside.find('.list_title');
    $sidenav
      .find('.check_bmlist')
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $sidenav.length : 0}项`);
  }
}

export function tooltipBookmark(obj) {
  const { title, link, des } = obj;
  const str = `名称：${title || '--'}\n链接：${link || '--'}\n描述：${
    des || '--'
  }`;
  toolTip.setTip(str).show();
}

$asideWrap
  .on('click', '.list_title em', debounce(switchListOpenState, 500, true))
  .on('click', '.list_title i', function (e) {
    // 菜单
    const $this = $(this).parent();
    asideListMenu(
      e,
      getBmListTitleData($this.attr('data-id')),
      $this.find('.check_bmlist')[0]
    );
  })
  .on('click', '.bm_item', function () {
    const { link } = getBmItemData(
      $asideBtn.activeId,
      this.getAttribute('data-id')
    );
    myOpen(link, '_blank');
  })
  .on('mouseenter', '.bm_item .bm_logo', function () {
    tooltipBookmark(
      getBmItemData($asideBtn.activeId, this.parentNode.getAttribute('data-id'))
    );
  })
  .on('mouseleave', '.bm_item .bm_logo', function () {
    toolTip.hide();
  })
  .on('click', '.add_list_btn', addBmList)
  .on('contextmenu', '.list_title', function (e) {
    //操作列表
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    const $this = $(this);
    asideListMenu(
      e,
      getBmListTitleData($this.attr('data-id')),
      $this.find('.check_bmlist')[0]
    );
  })
  .on('click', '.bm_logo', function (e) {
    e.stopPropagation();
    const $this = $(this).parent();
    const groupId = $asideBtn.activeId;
    bookMarkSetting(
      e,
      {
        groupId,
        ...getBmItemData(groupId, $this.attr('data-id')),
      },
      0,
      this.parentNode.querySelector('.check_bm')
    );
  })
  .on('contextmenu', '.bm_item', function (e) {
    //操作书签
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    const $this = $(this);
    const groupId = $asideBtn.activeId;
    bookMarkSetting(
      e,
      {
        groupId,
        ...getBmItemData(groupId, $this.attr('data-id')),
      },
      0,
      this.querySelector('.check_bm')
    );
  })
  .on('click', '.foot_menu .flex_wrap div', hdCheckAll)
  .on('click', '.check_bm', function (e) {
    e.stopPropagation();
    checkAsideBm(this);
  })
  .on('click', '.check_bmlist', function () {
    checkAsideBmList(this);
  })
  .on('click', '.delete_bm', function (e) {
    if (isSelectingBm) {
      const arr = getAsideCheckBmItem();
      if (arr.length === 0) return;
      delBm(e, arr);
    } else {
      const arr = getAsideCheckBmList();
      if (arr.length === 0) return;
      delBmList(e, arr);
    }
  })
  .on('click', '.move_bm', function (e) {
    const arr = getAsideCheckBmItem();
    const groupId = $asideBtn.activeId;
    if (arr.length === 0) return;
    moveBookMark(e, groupId, arr);
  })
  .on('click', '.clock_bm', function () {
    if (isSelectingBm) return;
    const arr = getAsideCheckBmList();
    if (arr.length === 0) return;
    changeBmListState(0, arr);
  })
  .on('click', '.open_bm', function () {
    if (isSelectingBm) return;
    const arr = getAsideCheckBmList();
    if (arr.length === 0) return;
    changeBmListState(1, arr);
  })
  .on('click', '.close', stopSelect)
  .on('click', function (e) {
    if (_getTarget(this, e, '.aside_wrap', 1)) {
      hideAside();
    }
  });

// 选中书签
function checkAsideBm(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateBmSelectInfo();
}
function updateBmSelectInfo() {
  const $sidenav = $aside.find('.bm_item'),
    $checkArr = $sidenav.filter(
      (_, item) => $(item).find('.check_bm').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $sidenav.length) {
    $aside.find('.foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $aside.find('.foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}

// 选中分组
function checkAsideBmList(el) {
  const $this = $(el),
    check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateBmListSelectInfo();
}
function updateBmListSelectInfo() {
  const $sidenav = $aside.find('.list_title'),
    $checkArr = $sidenav.filter(
      (_, item) => $(item).find('.check_bmlist').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $sidenav.length) {
    $aside.find('.foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $aside.find('.foot_menu .flex_wrap div').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}

// 移动书签
export function moveBookMark(e, pid, arr) {
  let data = [
    {
      id: 'home',
      text: '主页',
      beforeIcon: 'iconfont icon-liebiao1',
      param: { id: 'home', title: '主页' },
    },
  ];
  if (pid === 'home') {
    data = [];
  }
  bookmark.list.forEach((item) => {
    if (item.id != pid) {
      data.push({
        id: item.id,
        text: item.title,
        beforeIcon: 'iconfont icon-liebiao1',
        param: { id: item.id, title: item.title },
      });
    }
  });
  if (data.length === 0) {
    _msg.error('没有可移动的书签分组');
    return;
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, param, loading }) => {
      if (id) {
        const groupId = param.id,
          groupTitle = param.title;
        rMenu.pop({ e, text: `确认移动到：${groupTitle}？` }, (type) => {
          if (type === 'confirm') {
            loading.start();
            reqBmkToGroup({ ids: arr, groupId })
              .then((result) => {
                loading.end();
                if (result.code === 1) {
                  close(true);
                  _msg.success(result.codeText);
                  getBookMarkList();
                  getHomeBmList();
                }
              })
              .catch(() => {
                loading.end();
              });
          }
        });
      }
    },
    '移动书签到分组'
  );
}

// 分组菜单
longPress($aside[0], '.list_title', function (e) {
  if (bmListMouseElementTracker.active || isSelecting()) return;
  const $this = $(this),
    ev = e.changedTouches[0];
  asideListMenu(
    ev,
    getBmListTitleData($this.attr('data-id')),
    $this.find('.check_bmlist')[0]
  );
});

// 书签菜单
longPress($aside[0], '.bm_item', function (e) {
  if (bmMouseElementTracker.active || isSelecting()) return;
  const $this = $(this),
    ev = e.changedTouches[0];
  const groupId = $asideBtn.activeId;
  bookMarkSetting(
    ev,
    {
      groupId,
      ...getBmItemData(groupId, $this.attr('data-id')),
    },
    0,
    this.querySelector('.check_bm')
  );
});

// 添加书签
export function addBookMark(e, pid) {
  rMenu.inpMenu(
    e,
    {
      subText: '添加',
      items: {
        link: {
          beforeText: '网址：',
          placeholder: 'https://',
          verify(val) {
            if (val.length > _d.fieldLength.url) {
              return '网址过长';
            } else if (!isurl(val)) {
              return '请输入正确的网址';
            }
          },
        },
      },
    },
    function ({ e, inp, close, loading }) {
      const u = inp.link;
      loading.start();
      reqBmkParseSiteInfo({ u })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            const { title, des } = result.data;
            rMenu.inpMenu(
              e,
              {
                subText: '提交',
                items: {
                  title: {
                    placeholder: '标题',
                    beforeText: '标题：',
                    value: title,
                    verify(val) {
                      if (val === '') {
                        return '请输入书签标题';
                      } else if (val.length > _d.fieldLength.title) {
                        return '标题过长';
                      }
                    },
                  },
                  link: {
                    beforeText: '网址：',
                    placeholder: 'https://',
                    value: u,
                    verify(val) {
                      if (val.length > _d.fieldLength.url) {
                        return '网址过长';
                      } else if (!isurl(val)) {
                        return '请输入正确的网址';
                      }
                    },
                  },
                  des: {
                    beforeText: '描述：',
                    value: des,
                    type: 'textarea',
                    placeholder: '描述',
                    verify(val) {
                      if (val.length > _d.fieldLength.des) {
                        return '描述过长';
                      }
                    },
                  },
                },
              },
              function ({ close, inp, loading }) {
                const title = inp.title,
                  link = inp.link,
                  des = inp.des;
                loading.start();
                reqBmkAddBmk({
                  groupId: pid,
                  bms: [
                    {
                      title,
                      link,
                      des,
                    },
                  ],
                })
                  .then((result) => {
                    loading.end();
                    if (result.code === 1) {
                      close(true);
                      _msg.success(result.codeText);
                      if ($asideBtn.activeId === pid) {
                        getBookMarkList();
                      }
                      if (pid === 'home') {
                        getHomeBmList();
                      }
                    }
                  })
                  .catch(() => {
                    loading.end();
                  });
              },
              '添加书签'
            );
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '添加书签'
  );
}

// 编辑分组
function editBmList(e, obj) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        idx: {
          beforeText: '序号',
          inputType: 'number',
          placeholder: '序号',
          value: obj.num + 1,
          verify(val) {
            const value = parseFloat(val);
            if (!isInteger(value) || value <= 0) {
              return '请输正整数';
            }
          },
        },
        text: {
          beforeText: '标题',
          placeholder: '标题',
          value: obj.title,
          verify(val) {
            if (val === '') {
              return '请输入标题';
            } else if (val.length > _d.fieldLength.title) {
              return '标题过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      const title = inp.text;
      let idx = inp.idx - 1;
      let toId = '';
      if (idx !== obj.num) {
        const lastNum = bookmark.list.length - 1;
        if (idx > lastNum) {
          idx = lastNum;
        }
        toId = (bookmark.list.find((item) => item.num === idx) || {}).id || '';
      }
      loading.start();
      reqBmkEditGroup({ id: obj.id, title, toId })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            getBookMarkList();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑书签分组'
  );
}

// 分享分组
function shareBmList(e, obj) {
  createShare(
    e,
    { name: obj.title, title: '分享书签分组' },
    ({ close, inp, loading }) => {
      const { title, pass, expireTime } = inp;
      loading.start();
      reqBmkShare({ id: obj.id, title, pass, expireTime })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            hideAside();
            close(1);
            openInIframe(`/sharelist`, '分享列表');
          }
        })
        .catch(() => {
          loading.end();
        });
    }
  );
}

// 删除分组
function delBmList(e, arr, cb, text, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${text || '选中的分组'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqBmkDeleteGroup({ ids: arr })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              cb && cb();
              _msg.success(result.codeText);
              getBookMarkList();
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    }
  );
}

// 更改分组状态
function changeBmListState(share, arr, cb, loading = { start() {}, end() {} }) {
  loading.start();
  reqBmkGroupShareState({
    ids: arr,
    share,
  })
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        cb && cb();
        _msg.success(res.codeText);
        getBookMarkList();
      }
    })
    .catch(() => {
      loading.end();
    });
}

// 操作列表
function asideListMenu(e, obj, el) {
  let data = [
    {
      id: 'share',
      text: obj.share === 1 ? '锁定' : '公开',
      beforeIcon: 'iconfont icon-suo',
    },
    {
      id: 'check',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    },
  ];
  data = [
    ...data,
    {
      id: 'rename',
      text: '编辑分组',
      beforeIcon: 'iconfont icon-bianji',
    },
    {
      id: 'add',
      text: '添加书签',
      beforeIcon: 'iconfont icon-icon-test',
    },
    {
      id: 'toshare',
      text: '分享',
      beforeIcon: 'iconfont icon-fenxiang_2',
    },
    {
      id: 'del',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close, loading }) => {
      // 编辑列表
      if (id === 'rename') {
        editBmList(e, obj);
      } else if (id === 'add') {
        // 新增书签
        addBookMark(e, obj.id);
      } else if (id === 'toshare') {
        //分享列表
        shareBmList(e, obj);
      } else if (id === 'del') {
        //删除列表
        delBmList(
          e,
          [obj.id],
          () => {
            close();
          },
          obj.title,
          loading
        );
      } else if (id === 'share') {
        changeBmListState(
          obj.share === 1 ? 0 : 1,
          [obj.id],
          () => {
            close();
          },
          loading
        );
      } else if (id === 'check') {
        isSelectingBm = false;
        startSelect();
        checkAsideBmList(el);
        close();
      }
    },
    obj.title
  );
}

// 上传书签logo
function upBmLogo(obj) {
  upLogo(
    'bookmark',
    (result) => {
      _msg.success(result.codeText);
      getBookMarkList();
      getHomeBmList();
    },
    obj.id
  );
}

// 编辑书签
function editBm(e, obj, isHome) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        idx: {
          placeholder: '序号',
          inputType: 'number',
          beforeText: '序号：',
          value: obj.num + 1,
          verify(val) {
            const value = parseFloat(val);
            if (!isInteger(value) || value <= 0) {
              return '请输正整数';
            }
          },
        },
        title: {
          placeholder: '标题',
          beforeText: '标题：',
          value: obj.title,
          verify(val) {
            if (val === '') {
              return '请输入书签标题';
            } else if (val.length > _d.fieldLength.title) {
              return '标题过长';
            }
          },
        },
        link: {
          beforeText: '网址：',
          placeholder: 'https://',
          value: obj.link,
          verify(val) {
            if (val.length > _d.fieldLength.url) {
              return '网址过长';
            } else if (!isurl(val)) {
              return '请输入正确的网址';
            }
          },
        },
        des: {
          beforeText: '描述：',
          type: 'textarea',
          placeholder: '描述',
          value: obj.des,
          verify(val) {
            if (val.length > _d.fieldLength.des) {
              return '描述过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      let an = inp.title,
        al = inp.link,
        idx = inp.idx - 1,
        des = inp.des;
      const pid = isHome ? 'home' : obj.group_id;
      let tid = '';
      if (idx != obj.num) {
        let lastNum = 0;
        if (pid === 'home') {
          lastNum = bookmark.home.length - 1;
          if (idx > lastNum) {
            idx = lastNum;
          }
          tid = (bookmark.home.find((item) => item.num === idx) || {}).id || '';
        } else {
          const arr =
            (bookmark.list.find((item) => item.id === pid) || {}).item || [];
          lastNum = arr.length - 1;
          if (idx > lastNum) {
            idx = lastNum;
          }
          tid = (arr.find((item) => item.num === idx) || {}).id || '';
        }
      }
      const requestObj = {
        groupId: pid,
        id: obj.id,
        des,
        title: an,
        link: al,
        toId: tid,
      };
      loading.start();
      reqBmkEditBmk(requestObj)
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            getBookMarkList();
            getHomeBmList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑书签'
  );
}
// 设置logo
function setBmLogo(e, obj, isHome) {
  const data = [
    {
      id: '1',
      text: '自定义图标',
    },
  ];
  if (obj.logo) {
    data.push({
      id: '2',
      text: '使用自动获取图标',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        close(1);
        upBmLogo(obj, isHome);
      } else if (id === '2') {
        rMenu.pop(
          {
            e,
            text: '确认清除：自定义图标，使用自动获取图标？',
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqBmkDeleteLogo({ id: obj.id })
                .then((res) => {
                  loading.end();
                  if (res.code === 1) {
                    close(1);
                    getHomeBmList();
                    getBookMarkList();
                  }
                })
                .catch(() => {
                  loading.end();
                });
            }
          }
        );
      }
    },
    '图标设置'
  );
}
// 操作书签
export function bookMarkSetting(e, obj, isHome, el) {
  let data = [
    {
      id: '1',
      text: '弹窗打开',
      beforeIcon: 'iconfont icon-24gl-minimize',
    },
    {
      id: '2',
      text: '书签图标',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: '3',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    },
  ];
  data = [
    ...data,
    {
      id: '4',
      text: '编辑书签',
      beforeIcon: 'iconfont icon-bianji',
    },
    {
      id: '5',
      text: '移动到',
      beforeIcon: 'iconfont icon-moveto',
    },
    {
      id: '6',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        close();
        hideAside();
        openInIframe(obj.link, obj.title);
      } else if (id === '2') {
        setBmLogo(e, obj, isHome);
      } else if (id === '3') {
        //多选
        if (isHome) {
          showHomeFootMenu();
          openCheckState();
          checkedHomeBm(el);
        } else {
          isSelectingBm = true;
          startSelect();
          checkAsideBm(el);
        }
        close();
      } else if (id === '4') {
        // 修改书签
        editBm(e, obj, isHome);
      } else if (id === '5') {
        // 移动书签
        moveBookMark(e, isHome ? 'home' : obj.groupId, [obj.id]);
      } else if (id === '6') {
        // 删除书签
        delBm(
          e,
          [obj.id],
          () => {
            close();
          },
          obj.title,
          loading
        );
      }
    },
    obj.title
  );
}

// 侧栏是隐藏
function asideWrapIsHide() {
  return $asideWrap.is(':hidden');
}

// 侧栏底部菜单是隐藏
function isSelecting() {
  return !$aside.find('.foot_menu').is(':hidden');
}
function stopSelect() {
  const $check = isSelectingBm
    ? $aside.find('.bm_item .check_bm')
    : $aside.find('.list_title .check_bmlist');
  $check
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $aside
    .find('.foot_menu')
    .stop()
    .slideUp(_d.speed, () => {
      bmListBoxSelector.stop();
      bmBoxSelector.stop();
    });
}
function startSelect() {
  switchCheckState();
  if (isSelectingBm) {
    const $sidenav = $aside.find('.bm_item');
    $sidenav.find('.check_bm').css('display', 'block');
  } else {
    $aside.find('ul').css('display', 'none').html('');
    const $sidenav = $aside.find('.list_title');
    $asideBtn.activeId = 'hide';
    $sidenav.attr('flag', 'off');
    $sidenav.find('.check_bmlist').css('display', 'block');
  }
  $aside
    .find('.foot_menu')
    .stop()
    .slideDown(_d.speed, () => {
      if (isSelectingBm) {
        bmBoxSelector.start();
      } else {
        bmListBoxSelector.start();
      }
    })
    .find('.flex_wrap div')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
// 显示隐藏侧边
export function toggleAside() {
  if (asideWrapIsHide()) {
    showAside();
  } else {
    hideAside();
  }
}

$asideBtn.on('click', toggleAside);

// 显示和隐藏侧栏
export function showAside() {
  hideSearchBox();
  popWindow.add('aside', hideAside);
  loadingImg($aside.find('.list')[0]);
  $asideWrap.outerWidth();
  $asideWrap.css('display', 'block').addClass('open');
  $asideBtn.fadeOut(_d.speed);
  getBookMarkList($asideBtn.activeId, 1, 0);
}

export function hideAside() {
  popWindow.remove('aside');
  $asideBtn.fadeIn(_d.speed);
  $asideWrap
    .removeClass('open')
    .stop()
    .fadeOut(_d.speed, () => {
      asideLoadImg.unBind();
      $aside.find('.list').html('');
    });
}

// 手势
const allowSlide = {
  time: 0,
  update() {
    this.time = Date.now();
  },
  allow() {
    return Date.now() - this.time > 1000;
  },
};
_mySlide({
  el: '.aside_wrap',
  left() {
    if (!isSelecting() && allowSlide.allow()) {
      hideAside();
    }
  },
});
