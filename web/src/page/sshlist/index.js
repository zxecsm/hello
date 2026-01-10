import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import {
  throttle,
  _myOpen,
  pageScrollTop,
  myOpen,
  toLogin,
  scrollState,
  queryURLParams,
  isIframe,
  wrapInput,
  getScreenSize,
  longPress,
  isMobile,
  hdTitleHighlight,
  isLogin,
  _getTarget,
  getTextSize,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import realtime from '../../js/plugins/realtime';
import { CreateTabs } from '../notes/tabs/index';
import {
  isHideCategoryBox,
  renderCategoryList,
  showCategoryBox,
} from './category';
import toolTip from '../../js/plugins/tooltip';
import rMenu from '../../js/plugins/rightMenu';
import { showSSHInfo } from '../../js/utils/showinfo';
import { _tpl } from '../../js/utils/template';
import { BoxSelector } from '../../js/utils/boxSelector';
import { otherWindowMsg } from '../home/home';
import localData from '../../js/common/localData';
import {
  reqSSHAdd,
  reqSSHCategory,
  reqSSHDelete,
  reqSSHEdit,
  reqSSHSearch,
  reqSSHSetCategory,
  reqSSHTop,
} from '../../api/ssh';
const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $categoryTag = $('.category_tag'),
  $footer = $('.footer');
let sshCategoryList = [];
const urlParams = queryURLParams(myOpen());
let { HASH } = urlParams;
if (!isLogin()) {
  toLogin();
}
realtime.init().add((res) => {
  res.forEach((item) => {
    const {
      type,
      data: { flag },
    } = item;
    if (type === 'updatedata') {
      if (flag === 'ssh' || flag === 'sshCategory') {
        renderCategoryList(1);
      }
    }
    otherWindowMsg(item);
  });
});

export function setSSHCategoryList(val) {
  if (val === undefined) {
    return sshCategoryList;
  }
  sshCategoryList = val;
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
      sshPageNo = 1;
      renderList(true);
    }
  },
});
function updataCategory() {
  reqSSHCategory()
    .then((res) => {
      if (res.code === 1) {
        sshCategoryList = res.data;
        const list = categoryToArr(HASH || '');
        tabsObj.list = list;
        $categoryTag.addClass('open');
      }
    })
    .catch(() => {});
}
updataCategory();
// 添加分类条件
function hdCategoryAdd(e, cb, hasList) {
  if (hasList.length >= 10) {
    _msg.error('分类最多10个');
    return;
  }

  const filterList = sshCategoryList.filter(
    (item) => !hasList.some((i) => i.id === item.id)
  );

  const data = [];
  if (filterList.length === 0) {
    _msg.error('没有可选分类');
    return;
  }
  filterList.forEach((item) => {
    const { id, title } = item;
    data.push({
      id,
      text: title,
      param: item,
      beforeIcon: 'iconfont icon-liebiao1',
    });
  });
  rMenu.selectMenu(
    e,
    data,
    ({ id, param, close }) => {
      if (id) {
        cb && cb({ param, close });
      }
    },
    '选择分类'
  );
}
$categoryTag
  .on('click', '.setting_category', showCategoryBox)
  .on('click', '.clean_category', function () {
    tabsObj.list = [];
  });
function listLoading() {
  let str = '';
  new Array(10).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:4rem;margin-bottom:0.6rem;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  pageScrollTop(0);
}
// 渲染列表
let sshPageNo = 1;
let sshPageSize = localData.get('sshPageSize');
let sshList = [];

const sshBoxSelector = new BoxSelector(document, {
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
sshBoxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
function startSelect() {
  $contentWrap.find('.item_box .check_state').css('display', 'block');
  $footer
    .stop()
    .slideDown(_d.speed, () => {
      sshBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $contentWrap
    .find('.item_box .check_state')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $footer
    .stop()
    .slideUp(_d.speed, () => {
      sshBoxSelector.stop();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
// 生成列表
export function renderList(y) {
  let pagenum = sshPageNo,
    word = wInput.getValue().trim();
  if (word.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  let showpage = sshPageSize;
  const category = tabsObj.list.map((item) => item.id);

  if (category.length > 10) {
    _msg.error('分组过多');
    return;
  }

  if (y) {
    listLoading();
  }
  reqSSHSearch({
    word,
    pageNo: pagenum,
    pageSize: showpage,
    category,
  })
    .then((result) => {
      if (result.code === 1) {
        const { total, data, pageNo, splitWord } = result.data;
        sshList = data;
        sshPageNo = pageNo;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <template v-for="{id,title,port,host,username,categoryArr,top} in data">
              <ul class="item_box" :data-id="id">
                <div cursor="y" check="n" class="check_state"></div>
                <li class="item_type iconfont icon-terminal"></li>
                <li v-html="hdTitleHighlight(splitWord,title)" cursor="y" class="item_title"></li>
                <li v-if="top != 0 && !word && category.length === 0" class="top_btn iconfont icon-zhiding" style="color: var(--color5);"></li>
                <li cursor="y" class="set_btn iconfont icon-maohao"></li>
              </ul>
              <div class="item_info">
                <template v-if="categoryArr.length > 0">
                  <span cursor="y" v-for="cgs in categoryArr" :data-id="cgs.id" class="category">
                    <span style="color:var(--icon-color);margin-right:0.4rem;">#</span>{{cgs.title}}
                  </span>
                  <br/>
                </template>
                <span v-html="hdTitleHighlight(splitWord, 'ssh -P'+' '+port+' '+username+'@'+host)"></span>
              </div>
            </template>
            <div v-html="getPaging()" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            data,
            word,
            splitWord,
            getPaging() {
              return pgnt.getHTML({
                pageSize: showpage,
                pageNo,
                total,
                small: getScreenSize().w <= _d.screen,
              });
            },
            category,
            hdTitleHighlight,
            _d,
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
function switchCleanBtnState() {
  const $clean = $categoryTag.find('.clean_category');
  if (tabsObj.list.length > 0) {
    $clean.css('display', 'block');
  } else {
    $clean.css('display', 'none');
  }
}
// 分类标签
const tabsObj = new CreateTabs({
  el: $categoryTag.find('.list')[0],
  change(data) {
    switchCleanBtnState();
    HASH = data.map((item) => item.id).join('-');
    myOpen(`#${HASH}`);
    sshPageNo = 1;
    renderList(1);
  },
  add({ e, add, data }) {
    hdCategoryAdd(
      e,
      ({ param, close }) => {
        close();
        add(param);
      },
      data,
      1
    );
  },
});
// 获取信息
function getSSHInfo(id) {
  return sshList.find((item) => item.id === id) || {};
}
// 分页
const pgnt = pagination($contentWrap[0], {
  change(val) {
    sshPageNo = val;
    renderList(true);
    _msg.botMsg(`第 ${sshPageNo} 页`);
  },
  changeSize(val) {
    sshPageSize = val;
    localData.set('sshPageSize', sshPageSize);
    sshPageNo = 1;
    renderList(true);
    _msg.botMsg(`第 ${sshPageNo} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
// 删除
function deleteSSH(e, ids, cb, title, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${title || '选中的SSH配置'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqSSHDelete({ ids })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              cb && cb();
              _msg.success(result.codeText);
              renderList();
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    }
  );
}
// 置顶
function toTop(e, obj) {
  rMenu.inpMenu(
    e,
    {
      items: {
        num: {
          beforeText: '权重数 (数值越大越靠前)：',
          value: obj.top,
          inputType: 'number',
          placeholder: '0：取消；数值越大越靠前',
          verify(val) {
            return (
              rMenu.validInteger(val) ||
              rMenu.validNumber(val, 0, _d.fieldLength.top)
            );
          },
        },
      },
    },
    function ({ inp, close, loading, isDiff }) {
      if (!isDiff()) return;
      const w = inp.num;
      loading.start();
      reqSSHTop({ id: obj.id, top: w })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close(1);
            renderList();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '置顶'
  );
}
function categoryToArr(category) {
  const cArr = category.split('-').filter(Boolean);
  return sshCategoryList.filter((item) => cArr.includes(item.id));
}
// 添加分类
function sshEditCategory(e, obj) {
  rMenu.selectTabs(
    e,
    categoryToArr(obj.category),
    {
      verify(data) {
        if (data.length > 10) {
          return '最多添加10个分类';
        }
      },
      add({ e, add, data }) {
        hdCategoryAdd(
          e,
          ({ param, close }) => {
            close();
            add(param);
          },
          data
        );
      },
      submit({ close, data, loading, isDiff }) {
        if (!isDiff()) return;
        loading.start();
        reqSSHSetCategory({
          id: obj.id,
          category: data.map((item) => item.id),
        })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              close(1);
              renderList();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      },
    },
    '编辑分类'
  );
}
function editSSHInfo(e, obj) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          beforeText: '标题：',
          value: obj.title,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.title);
          },
        },
        auth_type: {
          beforeText: '认证方式：',
          type: 'select',
          value: obj.auth_type,
          selectItem: [
            { value: 'password', text: '密码' },
            { value: 'key', text: '密钥' },
          ],
        },
        host: {
          beforeText: '主机：IP或域名',
          value: obj.host,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.filename);
          },
        },
        port: {
          beforeText: '端口：',
          value: obj.port,
          verify(val) {
            return rMenu.validInteger(val) || rMenu.validNumber(val, 1, 65535);
          },
        },
        username: {
          beforeText: '用户名：',
          value: obj.username,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.filename);
          },
        },
        password: {
          beforeText: '密码：',
          value: obj.password,
          inputType: 'password',
          verify(val) {
            return rMenu.validString(val, 0, _d.fieldLength.filename);
          },
        },
        private_key: {
          beforeText: '密钥：',
          value: obj.private_key,
          type: 'textarea',
          verify(val) {
            return getTextSize(val) > _d.fieldLength.customCodeSize
              ? '密钥过长'
              : '';
          },
        },
        passphrase: {
          beforeText: '密钥口令：',
          value: obj.passphrase,
          inputType: 'password',
          verify(val) {
            return rMenu.validString(val, 0, _d.fieldLength.filename);
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqSSHEdit({
        id: obj.id,
        ...inp,
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            renderList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑SSH配置'
  );
}
$contentWrap
  .on('click', '.set_btn', function (e) {
    const $this = $(this).parent();
    const obj = getSSHInfo($this.attr('data-id'));
    const { id: sshid, title, top } = obj;
    const data = [
      { id: '1', text: '置顶', beforeIcon: 'iconfont icon-zhiding' },
      { id: '2', text: '分类', beforeIcon: 'iconfont icon-liebiao1' },
      { id: '4', text: '编辑', beforeIcon: 'iconfont icon-bianji' },
      { id: '6', text: '删除', beforeIcon: 'iconfont icon-shanchu' },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ close, e, id, loading }) => {
        if (id === '1') {
          toTop(e, { id: sshid, top });
        } else if (id === '2') {
          sshEditCategory(e, obj);
        } else if (id === '4') {
          editSSHInfo(e, obj);
        } else if (id === '6') {
          deleteSSH(e, [sshid], close, title, loading);
        }
      },
      title
    );
  })
  .on('click', '.item_title', function (e) {
    e.stopPropagation();
    const { title, id } = getSSHInfo($(this).parent().attr('data-id'));
    _myOpen(`/ssh#${id}`, title);
  })
  .on('click', '.item_info .category', function () {
    tabsObj.list = categoryToArr(this.dataset.id);
  })
  .on('contextmenu', '.item_box', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    hdCheckItemBtn();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('mouseenter', '.item_box .item_type', function () {
    const { title, port, host, username, top, auth_type, categoryArr } =
      getSSHInfo($(this).parent().attr('data-id'));
    const arr = categoryArr.map((item) => item.title);
    const str = `标题：${title}\n分类：${arr.join('-') || '--'}\n认证方式：${
      auth_type === 'password' ? '密码' : '密钥'
    }\n用户名：${username}\n主机：${host}\n端口：${port}\n权重：${top}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.item_box .item_type', function () {
    toolTip.hide();
  })
  .on('click', '.item_type', function (e) {
    const obj = getSSHInfo($(this).parent().attr('data-id'));
    showSSHInfo(e, obj);
  })
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
if (isIframe()) {
  $headWrap.find('.h_go_home').remove();
}
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
// 开启选中
function hdCheckItemBtn() {
  if (isSelecting()) {
    stopSelect();
  } else {
    startSelect();
  }
}
$headWrap
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_add_item_btn', function (e) {
    rMenu.inpMenu(
      e,
      {
        subText: '提交',
        items: {
          title: {
            beforeText: '标题：',
            value: '',
            verify(val) {
              return rMenu.validString(val, 1, _d.fieldLength.title);
            },
          },
          auth_type: {
            beforeText: '认证方式：',
            type: 'select',
            value: 'password',
            selectItem: [
              { value: 'password', text: '密码' },
              { value: 'key', text: '密钥' },
            ],
          },
          host: {
            beforeText: '主机：IP或域名',
            value: '',
            verify(val) {
              return rMenu.validString(val, 1, _d.fieldLength.filename);
            },
          },
          port: {
            beforeText: '端口：',
            value: 22,
            verify(val) {
              return (
                rMenu.validInteger(val) || rMenu.validNumber(val, 1, 65535)
              );
            },
          },
          username: {
            beforeText: '用户名：',
            value: '',
            verify(val) {
              return rMenu.validString(val, 1, _d.fieldLength.filename);
            },
          },
          password: {
            beforeText: '密码：',
            value: '',
            inputType: 'password',
            verify(val) {
              return rMenu.validString(val, 0, _d.fieldLength.filename);
            },
          },
          private_key: {
            beforeText: '密钥：',
            value: '',
            type: 'textarea',
            verify(val) {
              return getTextSize(val) > _d.fieldLength.customCodeSize
                ? '密钥过长'
                : '';
            },
          },
          passphrase: {
            beforeText: '密钥口令：',
            value: '',
            inputType: 'password',
            verify(val) {
              return rMenu.validString(val, 0, _d.fieldLength.filename);
            },
          },
        },
      },
      function ({ close, inp, loading, isDiff }) {
        if (!isDiff()) return;
        loading.start();
        reqSSHAdd(inp)
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              close(true);
              _msg.success(result.codeText);
              renderList();
              return;
            }
          })
          .catch(() => {
            loading.end();
          });
      },
      '添加SSH配置'
    );
  })
  .on('click', '.h_check_item_btn', hdCheckItemBtn)
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    sshPageNo = 1;
    renderList(true);
  })
  .on('click', '.inp_box .search_btn', function () {
    sshPageNo = 1;
    renderList(true);
  });
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
    deleteSSH(e, ids);
  })
  .on('click', '.f_close', function () {
    stopSelect();
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
  if (!isHideCategoryBox()) return;
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
