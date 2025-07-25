import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import './notes.less';
import {
  throttle,
  _myOpen,
  pageScrollTop,
  myOpen,
  toLogin,
  scrollState,
  showQcode,
  queryURLParams,
  isIframe,
  wrapInput,
  getScreenSize,
  longPress,
  isMobile,
  hdTitleHighlight,
  isInteger,
  formatDate,
  isLogin,
  isValidDate,
  formatNum,
  downloadFile,
  getFileReader,
  getFiles,
  concurrencyTasks,
  _getTarget,
  LazyLoad,
  imgjz,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import realtime from '../../js/plugins/realtime';
import {
  reqNoteCategory,
  reqNoteDelete,
  reqNoteEditInfo,
  reqNoteSearch,
  reqNoteSetCategory,
  reqNoteState,
  reqNoteTop,
  reqNoteUpNote,
} from '../../api/note';
import { CreateTabs } from './tabs';
import {
  isHideCategoryBox,
  renderCategoryList,
  showCategoryBox,
} from './category';
import toolTip from '../../js/plugins/tooltip';
import rMenu from '../../js/plugins/rightMenu';
import { showNoteInfo } from '../../js/utils/showinfo';
import { _tpl } from '../../js/utils/template';
import { UpProgress } from '../../js/plugins/UpProgress';
import { BoxSelector } from '../../js/utils/boxSelector';
import { otherWindowMsg, waitLogin } from '../home/home';
import imgPreview from '../../js/plugins/imgPreview';
import cacheFile from '../../js/utils/cacheFile';
import loadingSvg from '../../images/img/loading.svg';
import localData from '../../js/common/localData';
const $headWrap = $('.head_wrap'),
  $contentWrap = $('.content_wrap'),
  $categoryTag = $('.category_tag'),
  $footer = $('.footer');
let runState = 'own';
let noteCategoryList = [];
const urlParams = queryURLParams(myOpen());
let { HASH } = urlParams;
if (urlParams.acc && urlParams.acc !== localData.get('account')) {
  runState = 'other';
  $headWrap.find('.h_add_item_btn').remove();
  $headWrap.find('.h_check_item_btn').remove();
  $categoryTag.find('.setting_category').remove();
} else {
  if (!isLogin()) {
    toLogin();
  }
}
waitLogin(() => {
  realtime.init().add((res) => {
    res.forEach((item) => {
      if (!urlParams.acc || urlParams.acc === localData.get('account')) {
        const {
          type,
          data: { flag },
        } = item;
        if (type === 'updatedata') {
          if (flag === 'note' || flag === 'category') {
            if (flag === 'category') {
              if (isHideCategoryBox()) {
                updataCategory();
              } else {
                renderCategoryList();
              }
            }
            renderList();
          }
        }
      }
      otherWindowMsg(item);
    });
  });
});

export function setNoteCategoryList(val) {
  if (val === undefined) {
    return noteCategoryList;
  }
  noteCategoryList = val;
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
function updataCategory() {
  reqNoteCategory({ account: urlParams.acc || '' })
    .then((res) => {
      if (res.code === 1) {
        noteCategoryList = res.data;
        const list = categoryToArr(HASH || '');
        if (runState === 'own' && HASH && HASH.includes('locked')) {
          list.unshift({
            id: 'locked',
            title: '私密笔记',
          });
        }
        tabsObj.list = list;
        $categoryTag.addClass('open');
      }
    })
    .catch(() => {});
}
updataCategory();
// 添加分类条件
function hdCategoryAdd(e, cb, hasList, hasLocked = false) {
  if (hasList.length >= 10) {
    _msg.error('分类最多10个');
    return;
  }

  const filterList = noteCategoryList.filter(
    (item) => !hasList.some((i) => i.id === item.id)
  );
  if (
    hasLocked &&
    runState === 'own' &&
    !hasList.some((item) => item.id === 'locked')
  ) {
    filterList.unshift({
      id: 'locked',
      title: '私密笔记',
    });
  }
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
$contentWrap.pagenum = 1;
let notePageSize = localData.get('notePageSize');
let noteList = [];

const noteBoxSelector = new BoxSelector(document, {
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
noteBoxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
function startSelect() {
  $contentWrap.find('.item_box .check_state').css('display', 'block');
  $footer
    .stop()
    .slideDown(_d.speed, () => {
      noteBoxSelector.start();
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
      noteBoxSelector.stop();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
const imgLazy = new LazyLoad();
// 生成列表
export function renderList(y) {
  let pagenum = $contentWrap.pagenum,
    word = wInput.getValue().trim();
  if (word.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  let showpage = notePageSize;
  const category = tabsObj.list.map((item) => item.id);

  if (category.length > 10) {
    _msg.error('分组过多');
    return;
  }

  if (y) {
    listLoading();
  }
  reqNoteSearch({
    account: urlParams.acc || '',
    word,
    pageNo: pagenum,
    pageSize: showpage,
    category,
  })
    .then((result) => {
      if (result.code === 1) {
        const { total, data, pageNo, splitWord } = result.data;
        noteList = data;
        $contentWrap.pagenum = pageNo;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <template v-for="{title,share,id,con,top,categoryArr,images} in data">
              <ul class="item_box" :data-id="id">
                <div cursor="y" check="n" class="check_state"></div>
                <li class="item_type iconfont icon-jilu"></li>
                <li v-html="hdTitleHighlight(splitWord,title)" cursor="y" class="item_title"></li>
                <li v-if="top != 0 && !word && category.length === 0" class="top_btn iconfont icon-zhiding" style="color: var(--color5);"></li>
                <li v-if="runState === 'own'" cursor="y" class="lock_state iconfont {{share === 0? 'icon-24gl-unlock2 open': 'icon-24gl-unlock4'}}"></li>
                <li v-if="runState === 'own'" cursor="y" class="set_btn iconfont icon-maohao"></li>
              </ul>
              <div v-if="categoryArr.length > 0 || (con && con.length > 0)" class="item_info">
                <template v-if="categoryArr.length > 0">
                  <span cursor="y" v-for="cgs in categoryArr" :data-id="cgs.id" class="category">
                    <span style="color:var(--icon-color);margin-right:0.4rem;">#</span>{{cgs.title}}
                  </span>
                  <br/>
                </template>
                <img class="default_size" :src="loadingSvg" v-if="images.length > 0" cursor="y" :data-src="images[0]" />
                <span v-if="con && con.length > 0" v-html="hdHighlight(con)"></span>
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
            runState,
            loadingSvg,
            hdHighlight,
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
    $contentWrap.pagenum = 1;
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
// 获取笔记信息
function getNoteInfo(id) {
  return noteList.find((item) => item.id === id) || {};
}
// 搜索高亮显示
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
// 分页
const pgnt = pagination($contentWrap[0], {
  change(val) {
    $contentWrap.pagenum = val;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  changeSize(val) {
    notePageSize = val;
    localData.set('notePageSize', notePageSize);
    $contentWrap.pagenum = 1;
    renderList(true);
    _msg.botMsg(`第 ${$contentWrap.pagenum} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
// 删除笔记
function deleteNote(e, ids, cb, title, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${title || '选中的笔记'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqNoteDelete({ ids })
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
// 置顶笔记
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
            if (val === '') {
              return '请输入权重数';
            } else if (
              !isInteger(+val) ||
              val < 0 ||
              val > _d.fieldLength.top
            ) {
              return `最大限制${_d.fieldLength.top}`;
            }
          },
        },
      },
    },
    function ({ inp, close, loading, isDiff }) {
      if (!isDiff()) return;
      const w = inp.num;
      loading.start();
      reqNoteTop({ id: obj.id, top: w })
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
    '置顶笔记'
  );
}
function categoryToArr(category) {
  const cArr = category.split('-').filter((item) => item);
  return noteCategoryList.filter((item) => cArr.includes(item.id));
}
// 笔记添加分类
function noteEditCategory(e, obj) {
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
        reqNoteSetCategory({
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
function verifyDate(obj) {
  let { create_at, update_at } = obj;
  create_at = new Date(create_at).getTime();
  update_at = new Date(update_at).getTime();
  if (create_at > update_at) {
    _msg.error('创建日期不能大于更新日期');
    return false;
  }
  return true;
}
function editNoteInfo(e, obj) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          beforeText: '标题：',
          value: obj.title,
          verify(val) {
            if (val === '') {
              return '请输入标题';
            } else if (val.length > _d.fieldLength.title) {
              return '标题内容过长';
            }
          },
        },
        count: {
          beforeText: '阅读量：',
          value: obj.visit_count,
          verify(val) {
            const num = parseInt(val);
            if (!val.trim()) {
              return '请输入阅读量';
            } else if (isNaN(num) || num < 0) {
              return '请输入正整数';
            }
          },
        },
        create_at: {
          beforeText: '创建日期：',
          placeholder: 'YYYY-MM-DD',
          inputType: 'date',
          value: formatDate({
            template: '{0}-{1}-{2}',
            timestamp: obj.create_at,
          }),
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
        update_at: {
          beforeText: '更新日期：',
          placeholder: 'YYYY-MM-DD',
          inputType: 'date',
          value: formatDate({
            template: '{0}-{1}-{2}',
            timestamp: obj.update_at,
          }),
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff() || !verifyDate(inp)) return;
      loading.start();
      reqNoteEditInfo({
        id: obj.id,
        title: inp.title,
        create_at: inp.create_at,
        update_at: inp.update_at,
        visit_count: inp.count,
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
    '编辑笔记信息'
  );
}
$contentWrap
  .on('click', '.set_btn', function (e) {
    if (runState !== 'own') return;
    const $this = $(this).parent();
    const obj = getNoteInfo($this.attr('data-id'));
    const { id: noteid, title, top } = obj;
    const data = [
      { id: '1', text: '置顶', beforeIcon: 'iconfont icon-zhiding' },
      { id: '2', text: '分类', beforeIcon: 'iconfont icon-liebiao1' },
      { id: '3', text: '二维码', beforeIcon: 'iconfont icon-erweima' },
      { id: '4', text: '笔记信息', beforeIcon: 'iconfont icon-bianji' },
      { id: '7', text: '历史版本', beforeIcon: 'iconfont icon-history' },
      { id: '5', text: '笔记内容', beforeIcon: 'iconfont icon-bianji' },
      {
        id: '6',
        text: '删除',
        beforeIcon: 'iconfont icon-shanchu',
      },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ close, e, id, loading }) => {
        if (id === '1') {
          toTop(e, { id: noteid, top });
        } else if (id === '2') {
          noteEditCategory(e, obj);
        } else if (id === '3') {
          showQcode(
            e,
            `${_d.originURL}/note?v=${encodeURIComponent(noteid)}`,
            title
          );
        } else if (id === '4') {
          editNoteInfo(e, obj);
        } else if (id === '5') {
          close();
          e.stopPropagation();
          _myOpen(`/edit#${encodeURIComponent(noteid)}`, title);
        } else if (id === '6') {
          deleteNote(e, [noteid], close, title, loading);
        } else if (id === '7') {
          close();
          e.stopPropagation();
          _myOpen(`/file#/${_d.noteHistoryDirName}/${noteid}`, '文件管理');
        }
      },
      title
    );
  })
  .on('click', '.item_title', function (e) {
    e.stopPropagation();
    const val = wInput.getValue().trim();
    const { title, id } = getNoteInfo($(this).parent().attr('data-id'));
    _myOpen(
      `/note?v=${encodeURIComponent(id)}${
        val ? '#' + encodeURIComponent(val) : ''
      }`,
      title
    );
  })
  .on('click', 'img', function () {
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
    imgPreview(arr, idx);
  })
  .on('click', '.item_info .category', function () {
    tabsObj.list = categoryToArr(this.dataset.id);
  })
  .on('contextmenu', '.item_box', function (e) {
    if (runState !== 'own') return;
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    hdCheckItemBtn();
    checkedItem(this.querySelector('.check_state'));
  })
  .on('mouseenter', '.item_box .item_type', function () {
    const { create_at, update_at, category, visit_count, top } = getNoteInfo(
      $(this).parent().attr('data-id')
    );
    const arr = categoryToArr(category).map((item) => item.title);
    const str = `创建：${formatDate({
      template: '{0}-{1}-{2}',
      timestamp: create_at,
    })}\n更新：${formatDate({
      template: '{0}-{1}-{2}',
      timestamp: update_at,
    })}\n分类：${arr.join('-') || '--'}\n阅读：${formatNum(
      visit_count
    )}\n权重：${top}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.item_box .item_type', function () {
    toolTip.hide();
  })
  .on('click', '.item_type', function (e) {
    const obj = getNoteInfo($(this).parent().attr('data-id'));
    const arr = categoryToArr(obj.category).map((item) => item.title);
    showNoteInfo(e, obj, arr);
  })
  .on(
    'click',
    '.lock_state',
    throttle(function () {
      if (runState !== 'own') return;
      const $this = $(this).parent();
      const obj = getNoteInfo($this.attr('data-id'));
      changeNoteState([obj.id], obj.share === 0 ? 1 : 0);
    }, 2000)
  )
  .on('click', '.check_state', function () {
    checkedItem(this);
  });
// 切换笔记状态
function changeNoteState(ids, share) {
  reqNoteState({ ids, share })
    .then((result) => {
      if (result.code === 1) {
        _msg.success(result.codeText);
        renderList();
      }
    })
    .catch(() => {});
}
if (isIframe()) {
  $headWrap.find('.h_go_home').remove();
}
longPress($contentWrap[0], '.item_box', function () {
  if (isSelecting()) return;
  hdCheckItemBtn();
  checkedItem(this.querySelector('.check_state'));
});
// 选中笔记
function checkedItem(el) {
  if (runState !== 'own') return;
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
  if (runState !== 'own') return;
  if (isSelecting()) {
    stopSelect();
  } else {
    startSelect();
  }
}
// 上传笔记
async function upNote() {
  const files = await getFiles({ multiple: 'multiple', accept: '.md' });
  if (files.length === 0) return;

  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });

  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size } = file;
    const pro = upPro.add(name);

    if (!/\.md$/i.test(name)) {
      pro.fail();
      _msg.error(`笔记文件格式错误`);
      return;
    }

    if (size > _d.fieldLength.noteSize) {
      pro.fail();
      _msg.error(`笔记内容过长`);
      return;
    }

    try {
      const content = await getFileReader(file, 'text');

      const res = await reqNoteUpNote(
        { title: name.slice(0, -3), content },
        (percent) => {
          pro.update(percent);
        },
        signal
      );

      if (res.code === 1) {
        pro.close();
      } else {
        pro.fail();
      }
    } catch {
      pro.fail();
    }
  });

  realtime.send({ type: 'updatedata', data: { flag: 'note' } });
  $contentWrap.pagenum = 1;
  renderList(true);
}
$headWrap
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_add_item_btn', function (e) {
    if (runState !== 'own') return;
    e.stopPropagation();
    const data = [
      { id: 'add', text: '新建笔记', beforeIcon: 'iconfont icon-tianjia' },
      { id: 'up', text: '上传笔记', beforeIcon: 'iconfont icon-upload' },
    ];
    rMenu.selectMenu(e, data, ({ close, id }) => {
      close();
      if (id === 'add') {
        _myOpen('/edit#new', '新笔记');
      } else if (id === 'up') {
        upNote();
      }
    });
  })
  .on('click', '.h_check_item_btn', hdCheckItemBtn)
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    $contentWrap.pagenum = 1;
    renderList(true);
  })
  .on('click', '.inp_box .search_btn', function () {
    $contentWrap.pagenum = 1;
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
    if (runState !== 'own') return;
    const ids = getCheckItems();
    if (ids.length === 0) return;
    deleteNote(e, ids);
  })
  .on('click', '.f_download', function () {
    const ids = getCheckItems();
    if (ids.length === 0) return;
    downloadFile(
      ids.map((id) => ({
        fileUrl: `/api/note/read?v=${id}&download=1`,
        filename: getNoteInfo(id).title + '.md',
      }))
    );
    stopSelect();
  })
  .on('click', '.f_clock', function () {
    if (runState !== 'own') return;
    const ids = getCheckItems();
    if (ids.length === 0) return;
    changeNoteState(ids, 0);
  })
  .on('click', '.f_open', function () {
    if (runState !== 'own') return;
    const ids = getCheckItems();
    if (ids.length === 0) return;
    changeNoteState(ids, 1);
  })
  .on('click', '.f_close', function () {
    if (runState !== 'own') return;
    stopSelect();
  })
  .on('click', 'span', switchCheckAll);

function switchCheckAll() {
  if (runState !== 'own') return;
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
