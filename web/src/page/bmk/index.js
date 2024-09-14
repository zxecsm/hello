import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import {
  _setData,
  _getData,
  throttle,
  debounce,
  setPageScrollTop,
  myOpen,
  toLogin,
  scrollState,
  queryURLParams,
  isurl,
  isIframe,
  wrapInput,
  getScreenSize,
  longPress,
  isMobile,
  hdTitleHighlight,
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
import toolTip from '../../js/plugins/tooltip/index';
import {
  reqBmkAddBmk,
  reqBmkDeleteBmk,
  reqBmkEditBmk,
  reqBmkList,
  reqBmkSearch,
  reqBmkToList,
} from '../../api/bmk';
import { showBmkInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import changeDark from '../../js/utils/changeDark';
import { _tpl } from '../../js/utils/template';
import { CreateTabs } from '../notes/tabs';
const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $categoryTag = $('.category_tag'),
  $footer = $('.footer');
let runState = 'own'; // 运行状态
const urlParams = queryURLParams(myOpen());
let { HASH } = urlParams;
if (urlParams.acc && urlParams.acc !== _getData('account')) {
  runState = 'other';
  $footer.find('.f_move_to').text('添加到');
  $footer.find('.f_delete').remove();
} else {
  if (isLogin()) {
    // 同步数据
    realtime.init().add((res) => {
      res.forEach((item) => {
        const {
          type,
          data: { flag },
        } = item;
        if (type === 'updatedata' && flag === 'bookmark') {
          updataCategory();
        }
      });
    });
  } else {
    toLogin();
  }
}
// 搜索书签
const wInput = wrapInput($headWrap.find('.inp_box input')[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $headWrap.find('.inp_box i').css('display', 'none');
    } else {
      $headWrap.find('.inp_box i').css('display', 'block');
    }
    bmksPageNo = 1;
    _renderList(true);
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    $(target).parent().removeClass('focus');
  },
});
function updataCategory() {
  reqBmkList({ acc: urlParams.acc || '' })
    .then((res) => {
      if (res.code == 0) {
        $contentWrap.booklist = res.data.list;
        if (isLogin()) {
          $contentWrap.booklist.unshift({ id: 'home', name: '主页' });
        }
        tabsObj.list = categoryToArr(HASH || '');
        $categoryTag.addClass('open');
      }
    })
    .catch(() => {});
}
function categoryToArr(category) {
  const c = category.split('-').filter((item) => item);
  const res = [];
  c.forEach((id) => {
    const cInfo = $contentWrap.booklist.find((item) => item.id === id);
    if (cInfo) {
      res.push({ ...cInfo, title: cInfo.name });
    }
  });
  return res;
}
updataCategory();
// 添加分组条件
function hdCategoryAdd(e, cb) {
  const data = [];
  if ($contentWrap.booklist.length === 0) {
    _msg.error('没有可选分组');
    return;
  }
  $contentWrap.booklist.forEach((item) => {
    const { id, name } = item;
    data.push({
      id,
      text: name,
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
    '选择分组'
  );
}
$categoryTag.on('click', '.clean_category', function () {
  tabsObj.list = [];
});
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
    bmksPageNo = 1;
    renderList(1);
  },
  add({ e, add }) {
    hdCategoryAdd(e, ({ param, close }) => {
      close();
      add({ ...param, title: param.name });
    });
  },
});
// 列表加载
function listLoading() {
  let str = '';
  new Array(50).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:40px;margin-bottom:6px;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  setPageScrollTop(0);
}
let bmksPageNo = 1;
let bmPageSize = _getData('bmPageSize');
const _renderList = debounce(renderList, 1000);
$contentWrap.list = [];
$contentWrap.booklist = [];
function getItemObj(id) {
  return $contentWrap.list.find((item) => item.id == id);
}
// 分页
const pgnt = pagination($contentWrap[0], {
  change(val) {
    bmksPageNo = val;
    renderList(true);
    _msg.botMsg(`第 ${bmksPageNo} 页`);
  },
  changeSize(val) {
    bmPageSize = val;
    _setData('bmPageSize', bmPageSize);
    bmksPageNo = 1;
    renderList(true);
    _msg.botMsg(`第 ${bmksPageNo} 页`);
  },
  toTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  },
});
// 生成列表
function renderList(y) {
  let pagenum = bmksPageNo,
    word = wInput.getValue().trim();
  if (word.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  if (y) {
    listLoading();
  }
  let showpage = bmPageSize;
  const category = tabsObj.list.map((item) => item.id);
  reqBmkSearch({
    word,
    pageNo: pagenum,
    pageSize: showpage,
    acc: urlParams.acc,
    category,
  })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const { total, data, splitWord, pageNo } = result.data;
        $contentWrap.list = data;
        bmksPageNo = pageNo;
        const html = _tpl(
          `
          <p v-if="data.length === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <ul v-for="{id,link,name} in data" class="item_box" :data-id="id">
              <div cursor="y" check="n" class="check_state"></div>
              <li class="item_type iconfont icon-shuqian"></li>
              <li v-html="hdTitleHighlight(splitWord, name + ' (' + link + ')')" cursor="y" class="item_title"></li>
              <li cursor="y" class="set_btn iconfont icon-icon"></li>
            </ul>
            <div v-html="paginnation" class="pagingbox"></div>
          </template>
          `,
          {
            data,
            hdTitleHighlight,
            splitWord,
            _d,
            paginnation: pgnt.getHTML({
              pageNo,
              pageSize: showpage,
              total,
              small: getScreenSize().w <= _d.screen,
            }),
          }
        );
        closeCheck();
        $contentWrap.html(html).addClass('open');
        $headWrap.addClass('open');
        if (y) {
          setPageScrollTop(0);
        }
      }
    })
    .catch(() => {});
}

// 移动书签
function movebmk(e, arr) {
  reqBmkList().then((res) => {
    if (res.code == 0) {
      const data = [
        {
          id: 'home',
          text: '主页',
          beforeIcon: 'iconfont icon-liebiao1',
          param: { name: '主页' },
        },
      ];
      res.data.list.sort((a, b) => a.num - b.num);
      res.data.list.forEach((item) => {
        data.push({
          id: item.id,
          text: item.name,
          beforeIcon: 'iconfont icon-liebiao1',
          param: { name: item.name },
        });
      });
      rMenu.selectMenu(
        e,
        data,
        ({ e, close, id, param }) => {
          if (id) {
            let toid = id,
              listname = param.name;
            _pop(
              {
                e,
                text: `确认${
                  runState === 'own' ? '移动' : '添加'
                }到：${listname}？`,
              },
              (type) => {
                if (type == 'confirm') {
                  if (runState == 'own') {
                    reqBmkToList({
                      ids: arr.map((item) => item.id),
                      listId: toid,
                    })
                      .then((result) => {
                        if (parseInt(result.code) === 0) {
                          close(true);
                          _msg.success(result.codeText);
                          renderList();
                        }
                      })
                      .catch(() => {});
                  } else if (runState == 'other') {
                    reqBmkAddBmk({
                      bms: arr.map((item) => ({
                        name: item.name,
                        link: item.link,
                        des: item.des,
                      })),
                      listId: toid,
                    })
                      .then((result) => {
                        if (parseInt(result.code) === 0) {
                          close(true);
                          _msg.success(result.codeText);
                          renderList();
                        }
                      })
                      .catch(() => {});
                  }
                }
              }
            );
          }
        },
        `${runState === 'own' ? '移动' : '添加'}书签到分组`
      );
    }
  });
}
// 书签菜单
function bmMenu(e) {
  const $this = $(this);
  const id = $this.parent().attr('data-id'),
    obj = getItemObj(id);
  const data = [];
  if (runState === 'own') {
    data.push({
      id: '1',
      text: '编辑书签',
      beforeIcon: 'iconfont icon-bianji',
    });
  }
  data.push({
    id: '2',
    text: runState === 'own' ? '移动到' : '添加到',
    beforeIcon: `iconfont ${
      runState == 'own' ? 'icon-moveto' : 'icon-icon-test'
    }`,
  });
  if (runState === 'own') {
    data.push({
      id: '3',
      text: '删除',
      beforeIcon: `iconfont icon-shanchu`,
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id }) => {
      if (id == '1') {
        if (runState !== 'own') return;
        rMenu.inpMenu(
          e,
          {
            subText: '提交',
            items: {
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
                placeholder: '描述',
                type: 'textarea',
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
              const name = inp.title,
                link = inp.link,
                des = inp.des;
              if (name === obj.name && link === obj.link && des === obj.des)
                return;
              const requestObj = {
                listId: obj.listid,
                id: obj.id,
                des,
                name,
                link,
              };
              reqBmkEditBmk(requestObj)
                .then((result) => {
                  if (parseInt(result.code) === 0) {
                    close(true);
                    _msg.success(result.codeText);
                    renderList();
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
      } else if (id == '2') {
        movebmk(e, [obj]);
      } else if (id == '3') {
        if (runState !== 'own') return;
        _pop(
          {
            e,
            text: `确认删除：${obj.name}？`,
            confirm: { type: 'danger', text: '删除' },
          },
          (type) => {
            if (type == 'confirm') {
              reqBmkDeleteBmk({ ids: [obj.id] })
                .then((result) => {
                  if (parseInt(result.code) === 0) {
                    _msg.success(result.codeText);
                    close();
                    renderList();
                    return;
                  }
                })
                .catch(() => {});
            }
          }
        );
      }
    },
    obj.name
  );
}
// 打开书签
function openBmk() {
  const $this = $(this);
  const id = $this.parent().attr('data-id'),
    obj = getItemObj(id);
  myOpen(obj.link, '_blank');
}
// 书签右键
function bmkContextMenu(e) {
  e.preventDefault();
  if (isMobile()) return;
  if (!$footer.is(':hidden')) return;
  checkedItemBtn();
  checkItem(this.querySelector('.check_state'));
}
function hdCheckItem() {
  checkItem(this);
}
$contentWrap
  .on('click', '.set_btn', bmMenu)
  .on('click', '.item_title', openBmk)
  .on('contextmenu', '.item_box', bmkContextMenu)
  .on('mouseenter', '.item_box', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    const { name, link, des, group } = getItemObj(id);
    const str = `分组：${group.id === 'home' ? '主页' : group.name}\n名称：${
      name || '--'
    }\n链接：${link || '--'}\n描述：${des || '--'}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.item_box', function () {
    toolTip.hide();
  })
  .on('click', '.item_type', function (e) {
    const $this = $(this).parent();
    const id = $this.attr('data-id');
    showBmkInfo(e, getItemObj(id));
  })
  .on('click', '.check_state', hdCheckItem);
// 长按选中
function bmkLongPress() {
  if (!$footer.is(':hidden')) return;
  checkedItemBtn();
  checkItem(this.querySelector('.check_state'));
}
longPress($contentWrap[0], '.item_box', bmkLongPress);
// 选中
function checkItem(el) {
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
    footerCheckIocnState('y');
  } else {
    footerCheckIocnState('n');
  }
}
// 显示主页按钮
if (isIframe()) {
  $headWrap.find('.h_go_home').remove();
}
// 切换选中
function checkedItemBtn() {
  if ($headWrap._checkState) {
    closeCheck();
  } else {
    openCheck();
  }
}
function hdGoHome() {
  myOpen('/');
}
// 清空搜索框
function hdClearSearch() {
  wInput.setValue('').focus();
}
$headWrap
  .on('click', '.h_check_item_btn', checkedItemBtn)
  .on('click', '.h_go_home', hdGoHome)
  .on('click', '.inp_box i', hdClearSearch);
// 获取选中项
function getSelectItem() {
  const $itemBox = $contentWrap.find('.item_box'),
    $checkArr = $itemBox.filter(
      (_, item) => $(item).find('.check_state').attr('check') === 'y'
    );
  if ($checkArr.length === 0) return;
  let arr = [];
  $checkArr.each((i, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  $contentWrap.list;
  arr = arr.map((item) => {
    return getItemObj(item);
  });
  return arr;
}
// 删除选中
function hdDeleteCheck(e) {
  if (runState !== 'own') return;
  const arr = getSelectItem();
  _pop(
    {
      e,
      text: `确认删除：选中的书签？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type == 'confirm') {
        reqBmkDeleteBmk({ ids: arr.map((item) => item.id) })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              renderList();
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
function hdBmkMoveList(e) {
  const arr = getSelectItem();
  movebmk(e, arr);
}
// 关闭/开启选中
function closeCheck() {
  const $itemBox = $contentWrap.find('.item_box');
  $itemBox.find('.check_state').css('display', 'none');
  $headWrap._checkState = false;
  $footer.stop().slideUp(_d.speed);
}
function openCheck() {
  const $itemBox = $contentWrap.find('.item_box');
  $itemBox
    .find('.check_state')
    .css('display', 'block')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $headWrap._checkState = true;
  $footer.stop().slideDown(_d.speed);
  footerCheckIocnState('n');
}
// 全选/不选
function hdCheckAll() {
  let che = $footer.find('span').attr('check');
  che === 'y' ? (che = 'n') : (che = 'y');
  footerCheckIocnState(che);
  const $itemBox = $contentWrap.find('.item_box');
  $itemBox
    .find('.check_state')
    .attr('check', che)
    .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
  _msg.botMsg(`选中：${che === 'y' ? $itemBox.length : 0}项`);
}
function footerCheckIocnState(state) {
  $footer.find('span').attr({
    class:
      state === 'y'
        ? 'iconfont icon-xuanzeyixuanze'
        : 'iconfont icon-xuanzeweixuanze',
    check: state,
  });
}
$footer
  .on('click', '.f_delete', hdDeleteCheck)
  .on('click', '.f_move_to', hdBmkMoveList)
  .on('click', '.f_close', closeCheck)
  .on('click', 'span', hdCheckAll);
// 滚动状态
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
    if (!$headWrap._checkState) {
      openCheck();
    }
    hdCheckAll();
  }
});
if (!isIframe()) wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
