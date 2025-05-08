import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../notes/index.less';
import './index.less';
import loadingSvg from '../../images/img/loading.svg';
import defaultIcon from '../../images/img/default-icon.png';

import {
  throttle,
  pageScrollTop,
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
  _getTarget,
  toggleUserSelect,
  LazyLoad,
  imgjz,
} from '../../js/utils/utils';

import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import realtime from '../../js/plugins/realtime';

import {
  reqBmkAddBmk,
  reqBmkDeleteBmk,
  reqBmkEditBmk,
  reqBmkList,
  reqBmkSearch,
  reqBmkToGroup,
} from '../../api/bmk';

import { showBmkInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import { CreateTabs } from '../notes/tabs';
import { BoxSelector } from '../../js/utils/boxSelector';
import { otherWindowMsg, waitLogin } from '../home/home';
import _path from '../../js/utils/path';
import cacheFile from '../../js/utils/cacheFile';
import localData from '../../js/common/localData';

const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $categoryTag = $('.category_tag'),
  $footer = $('.footer');

let runState = 'own'; // 运行状态
const urlParams = queryURLParams(myOpen());
let { HASH } = urlParams;

if (urlParams.acc && urlParams.acc !== localData.get('account')) {
  runState = 'other';
  $footer.find('.f_move_to').text('添加到');
  $footer.find('.f_delete').remove();
} else {
  if (!isLogin()) {
    toLogin();
  }
}
waitLogin(() => {
  // 同步数据
  realtime.init().add((res) => {
    res.forEach((item) => {
      if (!urlParams.acc || urlParams.acc === localData.get('account')) {
        const {
          type,
          data: { flag },
        } = item;
        if (type === 'updatedata' && flag === 'bookmark') {
          updataCategory();
        }
      }
      otherWindowMsg(item);
    });
  });
});
// 搜索书签
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
      bmksPageNo = 1;
      renderList(true);
    }
  },
});

function updataCategory() {
  reqBmkList({ account: urlParams.acc || '' })
    .then((res) => {
      if (res.code === 1) {
        $contentWrap.groupList = res.data.list;
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
    const cInfo = $contentWrap.groupList.find((item) => item.id === id);
    if (cInfo) {
      res.push({ ...cInfo, title: cInfo.title });
    }
  });
  return res;
}

updataCategory();
// 添加分组条件
function hdCategoryAdd(e, cb, hasList) {
  if (hasList.length >= 10) {
    _msg.error('分组最多10个');
    return;
  }

  const filterList = $contentWrap.groupList.filter(
    (item) => !hasList.some((i) => i.id === item.id)
  );

  const data = [];
  if (filterList.length === 0) {
    _msg.error('没有可选分组');
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
});

// 列表加载
function listLoading() {
  let str = '';
  new Array(10).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;height:40px;margin-bottom:6px;background-color: var(--color9);" class="item_box"></ul>`;
  });
  $contentWrap.html(str);
  pageScrollTop(0);
}

let bmksPageNo = 1;
let bmPageSize = localData.get('bmPageSize');

$contentWrap.list = [];
$contentWrap.groupList = [];

function getItemObj(id) {
  return $contentWrap.list.find((item) => item.id === id);
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
    localData.set('bmPageSize', val);
    bmksPageNo = 1;
    renderList(true);
    _msg.botMsg(`第 ${bmksPageNo} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
const loadImg = new LazyLoad();
// 生成列表
function renderList(y) {
  let pagenum = bmksPageNo,
    word = wInput.getValue().trim();

  if (word.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }

  let showpage = bmPageSize;
  const category = tabsObj.list.map((item) => item.id);
  if (category.length > 10) {
    _msg.error('分组过多');
    return;
  }
  if (y) {
    listLoading();
  }

  reqBmkSearch({
    word,
    pageNo: pagenum,
    pageSize: showpage,
    account: urlParams.acc,
    category,
  })
    .then((result) => {
      if (result.code === 1) {
        const { total, data, splitWord, pageNo } = result.data;
        $contentWrap.list = data;
        bmksPageNo = pageNo;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <template v-for="{id,link,title,des,group_title,group_id} in data">
              <ul class="item_box" :data-id="id">
                <div cursor="y" check="n" class="check_state"></div>
                <li class="item_type iconfont icon-shuqian"></li>
                <li v-html="hdTitleHighlight(splitWord, title)" cursor="y" class="item_title"></li>
                <li cursor="y" class="set_btn iconfont icon-icon"></li>
              </ul>
              <div class="item_info">
                <span cursor="y" :data-id="group_id" class="category">
                  <span style="color:var(--icon-color);margin-right:4px;">#</span>{{group_title}}
                </span>
                <br/>
                <div class="logo"></div>
                <a cursor="y" v-html="hdTitleHighlight(splitWord, link)" href="{{link}}" target="_blank"></a>
                <br/>
                <span v-html="hdTitleHighlight(splitWord, des)"></span>
              </div>
            </template>
            <div v-html="paginnation" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            data,
            loadingSvg,
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

        stopSelect();
        $contentWrap.html(html).addClass('open');
        $headWrap.addClass('open');

        if (y) {
          pageScrollTop(0);
        }

        loadImg.bind(
          [...$contentWrap[0].querySelectorAll('.logo')].filter((item) => {
            const $item = $(item);
            let { logo, link } = getItemObj(
              $item.parent().prev().attr('data-id')
            );

            if (logo) {
              logo = _path.normalize(`/api/pub/${logo}`);
            } else {
              logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
            }
            const cache = cacheFile.hasUrl(logo, 'image');
            if (cache) {
              $item.css('background-image', `url(${cache})`).addClass('load');
            }
            return !cache;
          }),
          (item) => {
            const $item = $(item);
            let { logo, link } = getItemObj(
              $item.parent().prev().attr('data-id')
            );

            if (logo) {
              logo = _path.normalize(`/api/pub/${logo}`);
            } else {
              logo = `/api/getfavicon?u=${encodeURIComponent(link)}`;
            }
            imgjz(logo)
              .then((cache) => {
                $item.css('background-image', `url(${cache})`).addClass('load');
              })
              .catch(() => {
                $item
                  .css('background-image', `url(${defaultIcon})`)
                  .addClass('load');
              });
          }
        );
      }
    })
    .catch(() => {});
}

// 移动书签
function movebmk(e, arr, loading = { start() {}, end() {} }) {
  loading.start();
  reqBmkList()
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        const data = [
          {
            id: 'home',
            text: '主页',
            beforeIcon: 'iconfont icon-liebiao1',
            param: { title: '主页' },
          },
        ];
        res.data.list.sort((a, b) => a.num - b.num);
        res.data.list.forEach((item) => {
          data.push({
            id: item.id,
            text: item.title,
            beforeIcon: 'iconfont icon-liebiao1',
            param: { title: item.title },
          });
        });
        rMenu.selectMenu(
          e,
          data,
          ({ e, close, id, param, loading }) => {
            if (id) {
              let toid = id,
                groupTitle = param.title;
              _pop(
                {
                  e,
                  text: `确认${
                    runState === 'own' ? '移动' : '添加'
                  }到：${groupTitle}？`,
                },
                (type) => {
                  if (type === 'confirm') {
                    if (runState === 'own') {
                      loading.start();
                      reqBmkToGroup({
                        ids: arr.map((item) => item.id),
                        groupId: toid,
                      })
                        .then((result) => {
                          loading.end();
                          if (result.code === 1) {
                            close(true);
                            _msg.success(result.codeText);
                            renderList();
                          }
                        })
                        .catch(() => {
                          loading.end();
                        });
                    } else if (runState === 'other') {
                      loading.start();
                      reqBmkAddBmk({
                        bms: arr.map((item) => ({
                          title: item.title,
                          link: item.link,
                          des: item.des,
                        })),
                        groupId: toid,
                      })
                        .then((result) => {
                          loading.end();
                          if (result.code === 1) {
                            close(true);
                            _msg.success(result.codeText);
                            renderList();
                          }
                        })
                        .catch(() => {
                          loading.end();
                        });
                    }
                  }
                }
              );
            }
          },
          `${runState === 'own' ? '移动' : '添加'}书签到分组`
        );
      }
    })
    .catch(() => {
      loading.end();
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
      runState === 'own' ? 'icon-moveto' : 'icon-icon-test'
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
    ({ e, close, id, loading }) => {
      if (id === '1') {
        if (runState !== 'own') return;
        rMenu.inpMenu(
          e,
          {
            subText: '提交',
            items: {
              title: {
                placeholder: '标题',
                beforeText: '标题：',
                value: obj.title,
                verify(val) {
                  if (val === '') {
                    return '请输入书签标题';
                  } else if (val.length > _d.fieldLenght.title) {
                    return '标题过长';
                  }
                },
              },
              link: {
                beforeText: '网址：',
                placeholder: 'https://',
                value: obj.link,
                verify(val) {
                  if (val.length > _d.fieldLenght.url) {
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
                  if (val.length > _d.fieldLenght.des) {
                    return '描述过长';
                  }
                },
              },
            },
          },
          function ({ close, inp, loading, isDiff }) {
            if (!isDiff()) return;
            const title = inp.title,
              link = inp.link,
              des = inp.des;
            const requestObj = {
              groupId: obj.group_id,
              id: obj.id,
              des,
              title,
              link,
            };
            loading.start();
            reqBmkEditBmk(requestObj)
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
          '编辑书签'
        );
      } else if (id === '2') {
        movebmk(e, [obj], loading);
      } else if (id === '3') {
        if (runState !== 'own') return;
        _pop(
          {
            e,
            text: `确认删除：${obj.title}？`,
            confirm: { type: 'danger', text: '删除' },
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqBmkDeleteBmk({ ids: [obj.id] })
                .then((result) => {
                  loading.end();
                  if (result.code === 1) {
                    _msg.success(result.codeText);
                    close();
                    renderList();
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
    },
    obj.title
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
  if (isMobile() || isSelecting()) return;
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
  .on('click', '.item_info .category', function () {
    tabsObj.list = $contentWrap.groupList.filter(
      (item) => item.id === this.dataset.id
    );
  })
  .on('click', '.item_type', function (e) {
    const $this = $(this).parent();
    const id = $this.attr('data-id');
    showBmkInfo(e, getItemObj(id));
  })
  .on('click', '.check_state', hdCheckItem);

// 长按选中
function bmkLongPress() {
  if (isSelecting()) return;
  checkedItemBtn();
  checkItem(this.querySelector('.check_state'));
}
longPress($contentWrap[0], '.item_box', bmkLongPress);
function isSelecting() {
  return !$footer.is(':hidden');
}
// 关闭/开启选中
function stopSelect() {
  $contentWrap.find('.item_box .check_state').css('display', 'none');
  $footer.stop().slideUp(_d.speed, () => {
    boxSelector.stop();
    toggleUserSelect();
  });
}

function startSelect() {
  $contentWrap
    .find('.item_box .check_state')
    .css('display', 'block')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $footer.stop().slideDown(_d.speed, () => {
    boxSelector.start();
    toggleUserSelect(false);
  });
  footerCheckIocnState('n');
}
// 选中
function checkItem(el) {
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
  if (isSelecting()) {
    stopSelect();
  } else {
    startSelect();
  }
}

function hdGoHome() {
  myOpen('/');
}

// 清空搜索框
function hdClearSearch() {
  wInput.setValue('').focus();
  bmksPageNo = 1;
  renderList(true);
}

$headWrap
  .on('click', '.h_check_item_btn', checkedItemBtn)
  .on('click', '.h_go_home', hdGoHome)
  .on('click', '.inp_box .clean_btn', hdClearSearch)
  .on('click', '.inp_box .search_btn', () => {
    bmksPageNo = 1;
    renderList(true);
  });

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
      if (type === 'confirm') {
        reqBmkDeleteBmk({ ids: arr.map((item) => item.id) })
          .then((result) => {
            if (result.code === 1) {
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
  .on('click', '.f_close', stopSelect)
  .on('click', 'span', hdCheckAll);
// 滚动状态
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
    hdCheckAll();
  }
});
