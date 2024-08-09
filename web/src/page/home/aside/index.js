import $ from 'jquery';
import imgMrLogo from '../../../images/img/mrlogo.png';
import {
  myOpen,
  _setData,
  _getData,
  debounce,
  _getTarget,
  imgjz,
  isurl,
  encodeHtml,
  _position,
  loadingImg,
  longPress,
  isMobile,
  createShare,
  hdPath,
  isInteger,
  LazyLoad,
  _mySlide,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import {
  reqBmkAddBmk,
  reqBmkAddList,
  reqBmkChangeLogo,
  reqBmkDeleteBmk,
  reqBmkDeleteList,
  reqBmkEditBmk,
  reqBmkEditList,
  reqBmkList,
  reqBmkListState,
  reqBmkMoveBmk,
  reqBmkMoveList,
  reqBmkParseSiteInfo,
  reqBmkShare,
  reqBmkToList,
} from '../../../api/bmk.js';
import { upLogo } from '../rightSetting/index.js';
import {
  checkedHomeBm,
  homeFootMenuIsHide,
  openCheckState,
  getHomeBmList,
  showHomeFootMenu,
} from '../searchBox/index.js';
import { setMainTransform, setUserInfo } from '../index.js';
import { backWindow } from '../backWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
const $asideBtn = $('.aside_btn'),
  $asideWrap = $('.aside_wrap'),
  $aside = $asideWrap.find('.aside');
let asidePageSize = _getData('asidePageSize');
let bookmark = [];
// 设置书签数据
export function setBookMark(val) {
  if (val === undefined) {
    return bookmark;
  }
  bookmark = val;
}
// 拖动移动书签位置
~(function () {
  let fromDom = null;
  $aside
    .find('.list')
    .on('dragstart', '.bm_item', function () {
      fromDom = this;
    })
    .on('drop', '.bm_item', function () {
      if (fromDom) {
        const $this = $(this),
          $fromDom = $(fromDom),
          pid = $this.parent().prev().attr('data-id'),
          fromId = $fromDom.attr('data-id'),
          toId = $this.attr('data-id');
        if (fromId != toId) {
          dragMoveBookmark(pid, fromId, toId);
        }
        fromDom = null;
      }
    })
    .on('dragover', '.bm_item', function (e) {
      e.preventDefault();
    });
})();
// 书签移动位置
export function dragMoveBookmark(listId, fromId, toId) {
  reqBmkMoveBmk({ listId, fromId, toId })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        getHomeBmList();
        getBookMarkList();
        return;
      }
    })
    .catch(() => {});
}
// 分组移动位置
function bmListMove(fromId, toId) {
  reqBmkMoveList({ fromId, toId })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        getBookMarkList();
        return;
      }
    })
    .catch(() => {});
}
// 拖动移动分组位置
~(function () {
  let fromDom = null;
  $aside
    .find('.list')
    .on('dragstart', '.list_title', function () {
      fromDom = this;
    })
    .on('drop', '.list_title', function () {
      if (fromDom) {
        const $this = $(this),
          fromId = $(fromDom).attr('data-id'),
          toId = $this.attr('data-id');
        if (fromId !== toId) {
          bmListMove(fromId, toId);
        }
        fromDom = null;
      }
    })
    .on('dragover', '.list_title', function (e) {
      e.preventDefault();
    });
})();
$asideBtn.activeId = 'hide'; // 记录开启列表id
// 获取书签列表
export function getBookMarkList(p) {
  if (asideWrapIsHide()) return;
  const id = $asideBtn.activeId;
  reqBmkList({ id })
    .then((result) => {
      if (result.code === 0) {
        bookmark = result.data;
        if (!$asideBtn.activeId) {
          if (bookmark.list.length > 0) {
            $asideBtn.activeId = bookmark.list[0].id;
          }
        }
        renderAsideList(p);
      }
    })
    .catch(() => {});
}
let asidePageNo = 1;
let bmCheckState = true; // 选中状态
// 切换书签和分组选中状态
function switchCheckState() {
  const $fMenu = $aside.find('.foot_menu');
  if (bmCheckState) {
    $fMenu.removeClass('liststate');
  } else {
    $fMenu.addClass('liststate');
  }
}
// 生成列表
function renderAsideList(p) {
  if (asideWrapIsHide()) return;
  $aside.find('.foot_menu').stop().slideUp(_d.speed).find('div').attr({
    class: 'iconfont icon-xuanzeweixuanze',
    check: 'n',
  });
  let id = $asideBtn.activeId,
    _nav = bookmark.list,
    str = '';
  _nav.forEach((item) => {
    let name = encodeHtml(item.name);
    if (item.id === id) {
      str += `<div class="list_title jzxz" data-id="${
        item.id
      }" flag="on" draggable="true">
      <div cursor check="n" class="check_bmlist"></div>
      <i cursor class="iconfont ${
        item.share == 'y' ? 'icon-24gl-unlock4' : 'icon-24gl-unlock2 active'
      }"></i>
        <em cursor>${name}</em>
        </div>
        <ul style="display:'block'">`;
      const pageTotal = Math.ceil(item.item.length / asidePageSize);
      asidePageNo < 1
        ? (asidePageNo = pageTotal)
        : asidePageNo > pageTotal
        ? (asidePageNo = 1)
        : null;
      item.item
        .slice((asidePageNo - 1) * asidePageSize, asidePageNo * asidePageSize)
        .forEach((y) => {
          const name = encodeHtml(y.name);
          const des = y.des ? encodeHtml(y.des) : '';
          str += `<li class="bm_item jzxz" data-id="${
            y.id
          }" cursor draggable="true">
          <div cursor check="n" class="check_bm"></div>
          <div class="bm_logo"></div>
          <div class="bm_name">${name}</div>
          <p>${des || '描述'}</p>
          </li>`;
        });
      str += asidePgnt.getHTML({
        pageNo: asidePageNo,
        pageSize: asidePageSize,
        total: item.item.length,
      });
      str += '</ul>';
    } else {
      str += `<div data-id="${
        item.id
      }" flag="off" draggable="true" class="list_title jzxz">
      <div cursor check="n" class="check_bmlist"></div>
      <i cursor class="iconfont ${
        item.share == 'y' ? 'icon-24gl-unlock4' : 'icon-24gl-unlock2 active'
      }"></i>
      <em cursor>${name}</em></div>
      <ul style="display:'none'"></ul>`;
    }
  });
  str += `<div cursor title="添加分组" class="add_list_btn iconfont icon-jiajian1"></div>`;
  const $aList = $aside.find('.list');
  $aList.html(str);
  if (p) {
    const curIdx = bookmark.list.findIndex(
      (item) => item.id == $asideBtn.activeId
    );
    if (curIdx >= 0) {
      const $listTitle = $aList.find('.list_title').eq(curIdx);
      $aList.stop().animate(
        {
          scrollTop: _position($listTitle[0]).top + $aList[0].scrollTop - 5,
        },
        _d.speed
      );
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
    _setData('asidePageSize', asidePageSize);
    asidePageNo = 1;
    renderAsideList(1);
  },
});
const asideLoadImg = new LazyLoad();
// 加载logo
function hdAsideListItemLogo() {
  if ($asideBtn.activeId === 'hide') return;
  asideLoadImg.bind($aside[0].querySelectorAll('.bm_item'), (item) => {
    const $item = $(item);
    let { logo, link } = getBmItemData(
      $asideBtn.activeId,
      $item.attr('data-id')
    );
    if (logo) {
      logo = hdPath(`/api/pub/${logo}`);
    } else {
      logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
    }
    let $bm_logo = $item.find('.bm_logo');
    imgjz(
      logo,
      () => {
        $bm_logo.css('background-image', `url(${logo})`).addClass('load');
      },
      () => {
        $bm_logo.css('background-image', `url(${imgMrLogo})`).addClass('load');
      }
    );
  });
}
// 获取分组信息
function getBmListTitleData(id) {
  return bookmark.list.find((item) => item.id === id);
}
// 获取书签信息
function getBmItemData(listId, id) {
  const p = bookmark.list.find((item) => item.id === listId);
  return p.item.find((item) => item.id == id);
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
            if (val.trim() == '') {
              return '请输入标题';
            } else if (val.trim().length > 100) {
              return '标题过长';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        reqBmkAddList({ name: inp.text })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close();
              _msg.success(result.codeText);
              getBookMarkList();
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '添加书签分组'
  );
}
// 删除书签
export function delBm(e, arr, cb, text) {
  _pop(
    {
      e,
      text: `确认删除：${text || '选中的书签'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type == 'confirm') {
        reqBmkDeleteBmk({ ids: arr })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              cb && cb();
              getBookMarkList();
              getHomeBmList();
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 切换分组打开状态
function switchListOpenState() {
  const $this = $(this).parent(),
    id = $this.attr('data-id');
  $asideBtn.activeId = id;
  if ($this.attr('flag') === 'on') {
    $this.next().css('display', 'none').html('');
    $asideBtn.activeId = 'hide';
    $this.attr('flag', 'off');
    return;
  }
  $this.next().css('display', 'block');
  loadingImg($this.next()[0]);
  asidePageNo = 1;
  getBookMarkList(1);
}
// 全选/全不选
function hdCheckAll() {
  let che = $(this).attr('check');
  che === 'y' ? (che = 'n') : (che = 'y');
  $aside.find('.foot_menu div').attr({
    class:
      che === 'y'
        ? 'iconfont icon-xuanzeyixuanze'
        : 'iconfont icon-xuanzeweixuanze',
    check: che,
  });
  if (bmCheckState) {
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
  const { name, link, des } = obj;
  const str = `名称：${name || '--'}\n链接：${link || '--'}\n描述：${
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
  .on('mouseenter', '.bm_item', function () {
    tooltipBookmark(
      getBmItemData($asideBtn.activeId, this.getAttribute('data-id'))
    );
  })
  .on('mouseleave', '.bm_item', function () {
    toolTip.hide();
  })
  .on('click', '.add_list_btn', addBmList)
  .on('contextmenu', '.list_title', function (e) {
    //操作列表
    e.preventDefault();
    if (isMobile()) return;
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
    const listId = $asideBtn.activeId;
    bookMarkSetting(
      e,
      {
        listId,
        ...getBmItemData(listId, $this.attr('data-id')),
      },
      0,
      this.parentNode.querySelector('.check_bm')
    );
  })
  .on('contextmenu', '.bm_item', function (e) {
    //操作书签
    e.preventDefault();
    if (isMobile()) return;
    const $this = $(this);
    const listId = $asideBtn.activeId;
    bookMarkSetting(
      e,
      {
        listId,
        ...getBmItemData(listId, $this.attr('data-id')),
      },
      0,
      this.querySelector('.check_bm')
    );
  })
  .on('click', '.foot_menu div', hdCheckAll)
  .on('click', '.check_bm', function (e) {
    e.stopPropagation();
    checkAsideBm(this);
  })
  .on('click', '.check_bmlist', function () {
    checkAsideBmList(this);
  })
  .on('click', '.delete_bm', function (e) {
    if (bmCheckState) {
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
    const listId = $asideBtn.activeId;
    if (arr.length === 0) return;
    moveBookMark(e, listId, arr);
  })
  .on('click', '.clock_bm', function () {
    if (bmCheckState) return;
    const arr = getAsideCheckBmList();
    if (arr.length === 0) return;
    changeBmListState('n', arr);
  })
  .on('click', '.open_bm', function () {
    if (bmCheckState) return;
    const arr = getAsideCheckBmList();
    if (arr.length === 0) return;
    changeBmListState('y', arr);
  })
  .on('click', '.close', function () {
    let $check = [];
    if (bmCheckState) {
      $check = $aside.find('.bm_item .check_bm');
    } else {
      $check = $aside.find('.list_title .check_bmlist');
    }
    $check
      .css('display', 'none')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $aside.find('.foot_menu').stop().slideUp(_d.speed);
  })
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
  const $sidenav = $aside.find('.bm_item'),
    $checkArr = $sidenav.filter(
      (_, item) => $(item).find('.check_bm').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $sidenav.length) {
    $aside.find('.foot_menu div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $aside.find('.foot_menu div').attr({
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
  const $sidenav = $aside.find('.list_title'),
    $checkArr = $sidenav.filter(
      (_, item) => $(item).find('.check_bmlist').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $sidenav.length) {
    $aside.find('.foot_menu div').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $aside.find('.foot_menu div').attr({
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
      beforeIcon: 'iconfont icon-shoucang',
      param: { id: 'home', name: '主页' },
    },
  ];
  if (pid == 'home') {
    data = [];
  }
  bookmark.list.forEach((item) => {
    if (item.id != pid) {
      data.push({
        id: item.id,
        text: item.name,
        beforeIcon: 'iconfont icon-shoucang',
        param: { id: item.id, name: item.name },
      });
    }
  });
  if (data.length == 0) {
    _msg.error('没有可移动的书签分组');
    return;
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, param }) => {
      if (id) {
        const listId = param.id,
          listname = param.name;
        _pop({ e, text: `确认移动到：${listname}？` }, (type) => {
          if (type == 'confirm') {
            reqBmkToList({ ids: arr, listId })
              .then((result) => {
                if (parseInt(result.code) === 0) {
                  close(true);
                  _msg.success(result.codeText);
                  getBookMarkList();
                  getHomeBmList();
                }
              })
              .catch(() => {});
          }
        });
      }
    },
    '移动书签到分组'
  );
}
// 分组菜单
longPress($aside[0], '.list_title', function (e) {
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
  const $this = $(this),
    ev = e.changedTouches[0];
  const listId = $asideBtn.activeId;
  bookMarkSetting(
    ev,
    {
      listId,
      ...getBmItemData(listId, $this.attr('data-id')),
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
            if (val.trim().length > 1000) {
              return '网址过长';
            } else if (!isurl(val)) {
              return '请输入正确的网址';
            }
          },
        },
      },
    },
    debounce(
      function ({ e, inp, close }) {
        const u = inp.link;
        reqBmkParseSiteInfo({ url: u })
          .then((result) => {
            if (result.code == 0) {
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
                        if (val.trim() == '') {
                          return '请输入书签标题';
                        } else if (val.trim().length > 100) {
                          return '标题过长';
                        }
                      },
                    },
                    link: {
                      beforeText: '网址：',
                      placeholder: 'https://',
                      value: u,
                      verify(val) {
                        if (val.trim().length > 1000) {
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
                        if (val.trim().length > 300) {
                          return '描述过长';
                        }
                      },
                    },
                  },
                },
                debounce(
                  function ({ close, inp }) {
                    const name = inp.title,
                      link = inp.link,
                      des = inp.des;
                    reqBmkAddBmk({
                      listId: pid,
                      bms: [
                        {
                          name,
                          link,
                          des,
                        },
                      ],
                    })
                      .then((result) => {
                        if (parseInt(result.code) === 0) {
                          close(true);
                          _msg.success(result.codeText);
                          if ($asideBtn.activeId == pid) {
                            getBookMarkList();
                          }
                          if (pid == 'home') {
                            getHomeBmList();
                          }
                        }
                      })
                      .catch(() => {});
                  },
                  1000,
                  true
                ),
                '添加书签'
              );
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
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
            const value = parseFloat(val.trim());
            if (!isInteger(value) || value <= 0) {
              return '请输正整数';
            }
          },
        },
        text: {
          beforeText: '标题',
          placeholder: '标题',
          value: obj.name,
          verify(val) {
            if (val.trim() == '') {
              return '请输入标题';
            } else if (val.trim().length > 100) {
              return '标题过长';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const name = inp.text;
        let idx = inp.idx - 1;
        if (name === obj.name && idx == obj.num) return;
        let toId = '';
        if (idx != obj.num) {
          const lastNum = bookmark.list.length - 1;
          if (idx > lastNum) {
            idx = lastNum;
          }
          toId = (bookmark.list.find((item) => item.num == idx) || {}).id || '';
        }
        reqBmkEditList({ id: obj.id, name, toId })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close(true);
              _msg.success(result.codeText);
              getBookMarkList();
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '编辑书签分组'
  );
}
// 分享分组
function shareBmList(e, obj) {
  createShare(
    e,
    { name: obj.name, title: '分享书签分组' },
    ({ close, inp }) => {
      const { title, pass, valid } = inp;
      reqBmkShare({ id: obj.id, title, pass, valid })
        .then((result) => {
          if (parseInt(result.code) === 0) {
            hideAside();
            close(1);
            openInIframe(`/sharelist`, '分享列表');
          }
        })
        .catch(() => {});
    }
  );
}
// 删除分组
function delBmList(e, arr, cb, text) {
  _pop(
    {
      e,
      text: `确认删除：${text || '选中的分组'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type == 'confirm') {
        reqBmkDeleteList({ ids: arr })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              cb && cb();
              _msg.success(result.codeText);
              getBookMarkList();
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 更改分组状态
function changeBmListState(share, arr, cb) {
  reqBmkListState({
    ids: arr,
    share,
  }).then((res) => {
    if (res.code == 0) {
      cb && cb();
      _msg.success(res.codeText);
      getBookMarkList();
    }
  });
}
// 操作列表
function asideListMenu(e, obj, el) {
  let data = [
    {
      id: 'share',
      text: obj.share == 'y' ? '锁定' : '公开',
      beforeIcon: 'iconfont icon-suo',
    },
  ];
  if (asideFootMenuIsHide()) {
    data.push({
      id: 'check',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    });
  }
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
    ({ e, id, close }) => {
      // 编辑列表
      if (id == 'rename') {
        editBmList(e, obj);
      } else if (id == 'add') {
        // 新增书签
        addBookMark(e, obj.id);
      } else if (id == 'toshare') {
        //分享列表
        shareBmList(e, obj);
      } else if (id == 'del') {
        //删除列表
        delBmList(
          e,
          [obj.id],
          () => {
            close();
          },
          obj.name
        );
      } else if (id == 'share') {
        changeBmListState(obj.share == 'y' ? 'n' : 'y', [obj.id], () => {
          close();
        });
      } else if (id == 'check') {
        bmCheckState = false;
        switchCheckState();
        $aside.find('.foot_menu').stop().slideDown(_d.speed).find('div').attr({
          class: 'iconfont icon-xuanzeweixuanze',
          check: 'n',
        });
        $aside.find('ul').css('display', 'none').html('');
        const $sidenav = $aside.find('.list_title');
        $asideBtn.activeId = 'hide';
        $sidenav.attr('flag', 'off');
        $sidenav.find('.check_bmlist').css('display', 'block');
        checkAsideBmList(el);
        close();
      }
    },
    obj.name
  );
}
// 上传书签logo
function upBmLogo(obj) {
  upLogo((purl) => {
    reqBmkChangeLogo({
      id: obj.id,
      logo: `/logo/${setUserInfo().account}/${purl}`,
    }).then((result) => {
      if (parseInt(result.code) === 0) {
        _msg.success(result.codeText);
        getBookMarkList();
        getHomeBmList();
        return;
      }
    });
  });
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
            const value = parseFloat(val.trim());
            if (!isInteger(value) || value <= 0) {
              return '请输正整数';
            }
          },
        },
        title: {
          placeholder: '标题',
          beforeText: '标题：',
          value: obj.name,
          verify(val) {
            if (val.trim() == '') {
              return '请输入书签标题';
            } else if (val.trim().length > 100) {
              return '标题过长';
            }
          },
        },
        link: {
          beforeText: '网址：',
          placeholder: 'https://',
          value: obj.link,
          verify(val) {
            if (val.trim().length > 1000) {
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
            if (val.trim().length > 300) {
              return '描述过长';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        let an = inp.title,
          al = inp.link,
          idx = inp.idx - 1,
          des = inp.des;
        if (
          an === obj.name &&
          al === obj.link &&
          des === obj.des &&
          idx == obj.num
        )
          return;
        const pid = isHome ? 'home' : obj.listId;
        let tid = '';
        if (idx != obj.num) {
          let lastNum = 0;
          if (pid == 'home') {
            lastNum = bookmark.home.length - 1;
            if (idx > lastNum) {
              idx = lastNum;
            }
            tid =
              (bookmark.home.find((item) => item.num == idx) || {}).id || '';
          } else {
            const arr =
              (bookmark.list.find((item) => item.id == pid) || {}).item || [];
            lastNum = arr.length - 1;
            if (idx > lastNum) {
              idx = lastNum;
            }
            tid = (arr.find((item) => item.num == idx) || {}).id || '';
          }
        }
        const requestObj = {
          listId: pid,
          id: obj.id,
          des,
          name: an,
          link: al,
          toId: tid,
        };
        reqBmkEditBmk(requestObj)
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close(true);
              _msg.success(result.codeText);
              getBookMarkList();
              getHomeBmList();
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
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
    ({ e, close, id }) => {
      if (id == '1') {
        close(1);
        upBmLogo(obj, isHome);
      } else if (id == '2') {
        _pop(
          {
            e,
            text: '确认清除：自定义图标，使用自动获取图标？',
          },
          (type) => {
            if (type == 'confirm') {
              reqBmkChangeLogo({ id: obj.id })
                .then((res) => {
                  if (res.code == 0) {
                    close(1);
                    getHomeBmList();
                    getBookMarkList();
                  }
                })
                .catch(() => {});
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
  ];
  if ((!isHome && asideFootMenuIsHide()) || (isHome && homeFootMenuIsHide())) {
    data.push({
      id: '3',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    });
  }
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
    ({ e, close, id }) => {
      if (id == '1') {
        close();
        hideAside();
        openInIframe(obj.link, obj.name);
      } else if (id == '2') {
        setBmLogo(e, obj, isHome);
      } else if (id == '3') {
        //多选
        if (isHome) {
          showHomeFootMenu();
          openCheckState();
          checkedHomeBm(el);
        } else {
          bmCheckState = true;
          switchCheckState();
          $aside
            .find('.foot_menu')
            .stop()
            .slideDown(_d.speed)
            .find('div')
            .attr({
              class: 'iconfont icon-xuanzeweixuanze',
              check: 'n',
            });
          const $sidenav = $aside.find('.bm_item');
          $sidenav.find('.check_bm').css('display', 'block');
          checkAsideBm(el);
        }
        close();
      } else if (id == '4') {
        // 修改书签
        editBm(e, obj, isHome);
      } else if (id == '5') {
        // 移动书签
        moveBookMark(e, isHome ? 'home' : obj.listId, [obj.id]);
      } else if (id == '6') {
        // 删除书签
        delBm(
          e,
          [obj.id],
          () => {
            close();
          },
          obj.name
        );
      }
    },
    obj.name
  );
}
// 侧栏是隐藏
function asideWrapIsHide() {
  return $asideWrap.is(':hidden');
}
// 侧栏底部菜单是隐藏
function asideFootMenuIsHide() {
  return $aside.find('.foot_menu').is(':hidden');
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
  backWindow.add('aside', hideAside);
  $asideWrap.css('display', 'block');
  const menuw = $aside.outerWidth();
  loadingImg($aside.find('.list')[0]);
  setMainTransform(menuw);
  $aside.css({
    transform: 'translateX(0px)',
  });
  $asideBtn.find('.boxtop').addClass('active');
  $asideBtn.find('.boxdow').addClass('active');
  $asideBtn.find('.boxcon').css('opacity', '0');
  getBookMarkList(1);
}
function hideAside() {
  backWindow.remove('aside');
  const menuw = $aside.outerWidth();
  setMainTransform();
  $aside.css({
    transform: `translateX(-${menuw}px)`,
  });
  $asideBtn.find('.boxtop').removeClass('active');
  $asideBtn.find('.boxdow').removeClass('active');
  $asideBtn.find('.boxcon').css('opacity', '1');
  $asideWrap.stop().fadeOut(_d.speed, () => {
    asideLoadImg.unBind();
    $aside.find('.list').html('');
  });
}
// 手势
_mySlide({
  el: '.aside_wrap',
  left() {
    hideAside();
  },
});
