import $ from 'jquery';
import loadfailImg from '../../../images/img/loadfail.png';
import {
  debounce,
  _getTarget,
  imgjz,
  _mySlide,
  isImgFile,
  downloadFile,
  getScreenSize,
  longPress,
  isMobile,
  getFiles,
  isBigScreen,
  getFilePath,
  LazyLoad,
  isRoot,
  concurrencyTasks,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import pagination from '../../../js/plugins/pagination';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import realtime from '../../../js/plugins/realtime';
import {
  reqBgDelete,
  reqBgList,
  reqBgRepeat,
  reqBgUp,
} from '../../../api/bg.js';
import { hideRightMenu } from '../rightSetting/index.js';
import { setBg } from '../index.js';
import { popWindow, setZidx } from '../popWindow.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { _tpl } from '../../../js/utils/template.js';
import md5 from '../../../js/utils/md5.js';
import _path from '../../../js/utils/path.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
import { BoxSelector } from '../../../js/utils/boxSelector.js';
import localData from '../../../js/common/localData.js';
const $allBgWrap = $('.all_bg_wrap'),
  $bgList = $allBgWrap.find('.bg_list'),
  $bgFooter = $allBgWrap.find('.bg_footer');
let bgList = [];
// 上传壁纸
async function hdUpBg(files) {
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size } = file;
    const pro = upPro.add(name);
    if (!isImgFile(name)) {
      pro.fail();
      _msg.error(`壁纸格式错误`);
      return;
    }
    if (size <= 0 || size >= 10 * 1024 * 1024) {
      pro.fail();
      _msg.error(`壁纸限制0-10M`);
      return;
    }
    try {
      //文件切片
      const { HASH } = await md5.fileSlice(
        file,
        (percent) => {
          pro.loading(percent);
        },
        signal
      );
      const isrepeat = await reqBgRepeat({
        HASH,
      }); //是否已经存在文件

      if (isrepeat.code === 1) {
        pro.close('壁纸已存在');
        //文件已经存在操作
        return;
      }
      const result = await reqBgUp(
        { name, HASH },
        file,
        (percent) => {
          pro.update(percent);
        },
        signal
      );
      if (result.code === 1) {
        pro.close();
      } else {
        pro.fail();
      }
    } catch {
      pro.fail();
    }
  });
  realtime.send({ type: 'updatedata', data: { flag: 'bg' } });
  bgpage = 1;
  renderBgList(true);
}
// 关闭壁纸库
export function closeBgBox() {
  $allBgWrap.stop().fadeOut(_d.speed, () => {
    bglazyImg.unBind();
    popWindow.remove('bg');
    $bgList.html('');
  });
}
$allBgWrap
  .on('click', '.upload_bg', async function () {
    const files = await getFiles({
      multiple: true,
      accept: 'image/*',
    });
    if (files.length === 0) return;
    hdUpBg(files);
  })
  .on('click', '.b_close_btn', closeBgBox);
// 拖拽上传
~(function () {
  const allbg = $bgList[0];
  allbg.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  allbg.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  allbg.addEventListener('drop', function (e) {
    e.preventDefault();
    let files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    hdUpBg(files);
  });
})();
// 删除壁纸
export function delBg(e, ids, cb, isCheck, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${isCheck ? '选中的' : ''}壁纸？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqBgDelete(ids)
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              cb && cb();
              _msg.success(result.codeText);
              renderBgList();
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
// 菜单
function bgItemMenu(e, obj, el) {
  const data = [
    {
      id: '1',
      text: '设为壁纸',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: '2',
      text: '下载',
      beforeIcon: 'iconfont icon-download',
    },
  ];
  if (isRoot()) {
    data.push(
      {
        id: '3',
        text: '选中',
        beforeIcon: 'iconfont icon-duoxuan',
      },
      {
        id: '4',
        text: '删除',
        beforeIcon: 'iconfont icon-shanchu',
      }
    );
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        closeBgBox();
        setBg(obj, close);
      } else if (id === '4') {
        if (isRoot()) {
          delBg(
            e,
            [obj.id],
            () => {
              close();
            },
            false,
            loading
          );
        }
      } else if (id === '2') {
        close();
        downloadFile(
          [
            {
              fileUrl: getFilePath(`/bg/${obj.url}`),
              filename: _path.basename(obj.url)[0] || 'unknown',
            },
          ],
          'image'
        );
      } else if (id === '3') {
        close();
        startSelect();
        checkedBg(el);
      }
    },
    '壁纸选项'
  );
}
// 获取壁纸
let bgpage = 1;
// 加载
function bgLoading() {
  let str = '';
  new Array(12).fill(null).forEach(() => {
    str += `<div style="pointer-events: none;" class="bg_item">
            <div class="bg_img"></div>
            </div>`;
  });
  $bgList.html(str).scrollTop(0);
}
// 获取壁纸信息
function getBgItem(id) {
  return bgList.find((item) => item.id === id) || {};
}
// 壁纸库是隐藏
function bgBoxIsHide() {
  return $allBgWrap.is(':hidden');
}
function isSelecting() {
  return !$bgFooter.is(':hidden');
}
function startSelect() {
  $bgList.find('.bg_item .check_level').css('display', 'block');
  $bgFooter
    .stop()
    .slideDown(_d.speed, () => {
      bgBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $bgList
    .find('.bg_item .check_level')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $bgFooter.stop().slideUp(_d.speed, () => {
    bgBoxSelector.stop();
  });
}
const bgBoxSelector = new BoxSelector($bgList[0], {
  selectables: '.bg_item',
  onSelectStart({ e }) {
    const item = _getTarget($bgList[0], e, '.bg_item');
    if (item) return true;
  },
  onSelectEnd() {
    updateSelectInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_level');
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
bgBoxSelector.stop();
// 获取壁纸列表
export function renderBgList(y) {
  if (bgBoxIsHide()) return;
  if (y) {
    bgLoading();
  }
  let type = isBigScreen() ? 'bg' : 'bgxs',
    showpage = localData.get('bgPageSize');
  reqBgList({ type, pageNo: bgpage, pageSize: showpage })
    .then((result) => {
      if (result.code === 1) {
        if (bgBoxIsHide()) return;
        let { total, data, pageNo } = result.data;
        bgpage = pageNo;
        bgList = data;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <div v-for="{id, url} in data" class="bg_item" :data-id="id">
              <div check="n" class="check_level"></div>
              <i cursor="y" class="menu_btn iconfont icon-shoucang"></i>
              <div class="bg_img"></div>
            </div>
            <div v-html="getPaging()" class="bg_paging_box"></div>
          </template>
          `,
          {
            total,
            data,
            _d,
            getPaging() {
              return bgPgnt.getHTML({
                pageNo,
                pageSize: showpage,
                total,
                small: getScreenSize().w <= _d.screen,
              });
            },
          }
        );
        stopSelect();
        $bgList.html(html);
        if (y) {
          $bgList.scrollTop(0);
        }
        const bgImgs = [...$bgList[0].querySelectorAll('.bg_img')].filter(
          (item) => {
            const $img = $(item);
            const url = getFilePath(
              `/bg/${getBgItem($img.parent().data('id')).url}`,
              { t: 1 }
            );
            const cache = cacheFile.hasUrl(url, 'image');
            if (cache) {
              $img
                .css({
                  'background-image': `url(${cache})`,
                })
                .addClass('load');
            }
            return !cache;
          }
        );
        bglazyImg.bind(bgImgs, async (item) => {
          const $img = $(item);
          const url = getFilePath(
            `/bg/${getBgItem($img.parent().data('id')).url}`,
            { t: 1 }
          );
          imgjz(url)
            .then((cache) => {
              $img
                .css({
                  'background-image': `url(${cache})`,
                })
                .addClass('load');
            })
            .catch(() => {
              $img.css({
                'background-image': `url(${loadfailImg})`,
              });
            });
        });
        return;
      }
    })
    .catch(() => {});
}
// 懒加载
const bglazyImg = new LazyLoad();
// 分页
const bgPgnt = pagination($bgList[0], {
  select: [20, 40, 60, 80, 100],
  change(val) {
    bgpage = val;
    renderBgList(true);
    _msg.botMsg(`第 ${bgpage} 页`);
  },
  changeSize(val) {
    localData.set('bgPageSize', val);
    bgpage = 1;
    renderBgList(true);
    _msg.botMsg(`第 ${bgpage} 页`);
  },
  toTop() {
    $bgList.scrollTop(0);
  },
});
// 预览
function hdPreview() {
  const $this = $(this);
  const idx = $this.index('.bg_img');
  const arr = [];
  $bgList.find('.bg_img').each((_, item) => {
    const $item = $(item);
    const { url } = getBgItem($item.parent().data('id'));
    const u1 = getFilePath(`/bg/${url}`);
    const u2 = getFilePath(`/bg/${url}`, { t: 1 });
    arr.push({
      u2,
      u1,
    });
  });
  imgPreview(arr, idx, this);
}
$bgList
  .on('contextmenu', '.bg_img', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    const obj = getBgItem($(this).parent().data('id'));
    bgItemMenu(e, obj, this.parentNode.querySelector('.check_level'));
  })
  .on('click', '.menu_btn', function (e) {
    const obj = getBgItem($(this).parent().data('id'));
    bgItemMenu(e, obj, this.parentNode.querySelector('.check_level'));
  })
  .on('click', '.bg_img', hdPreview)
  .on('click', '.check_level', function () {
    checkedBg(this);
  });
longPress($bgList[0], '.bg_img', function (e) {
  if (isSelecting()) return;
  const ev = e.changedTouches[0];
  const obj = getBgItem($(this).parent().data('id'));
  bgItemMenu(ev, obj, this.parentNode.querySelector('.check_level'));
});
// 选中
function checkedBg(el) {
  const $this = $(el);
  const check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateSelectInfo();
}
function updateSelectInfo() {
  const $bgItems = $bgList.find('.bg_item'),
    $checkList = $bgItems.filter(
      (_, item) => $(item).find('.check_level').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkList.length}项`);
  if ($checkList.length === $bgItems.length) {
    $bgFooter.find('span').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $bgFooter.find('span').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
// 删除选中
function deleteCheckBg(e) {
  const $bgItems = $bgList.find('.bg_item'),
    $checkArr = $bgItems.filter(
      (_, item) => $(item).find('.check_level').attr('check') === 'y'
    );
  if ($checkArr.length === 0) return;
  const arr = [];
  $checkArr.each((_, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  delBg(e, arr, false, 1);
}
$bgFooter
  .on('click', '.f_delete', deleteCheckBg)
  .on('click', '.f_close', stopSelect)
  .on('click', 'span', function () {
    let che = $(this).attr('check');
    che === 'y' ? (che = 'n') : (che = 'y');
    $bgFooter.find('span').attr({
      class:
        che === 'y'
          ? 'iconfont icon-xuanzeyixuanze'
          : 'iconfont icon-xuanzeweixuanze',
      check: che,
    });
    const $bgItems = $bgList.find('.bg_item');
    $bgItems
      .find('.check_level')
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $bgItems.length : 0}项`);
  });
// 显示壁纸库
export function showBgBox() {
  hideRightMenu();
  setZidx($allBgWrap[0], 'bg', closeBgBox);
  const isHide = bgBoxIsHide();
  $allBgWrap.stop().slideDown(_d.speed, () => {
    if (isHide) renderBgList(true);
  });
}
let curScreenWidth = getScreenSize().w;
window.addEventListener(
  'resize',
  debounce(() => {
    const screenWidth = getScreenSize().w;
    if (curScreenWidth !== screenWidth) {
      curScreenWidth = screenWidth;
      renderBgList(true);
    }
  }, 500)
);
// 壁纸
_mySlide({
  el: '.all_bg_wrap',
  right() {
    if (isSelecting()) return;
    closeBgBox();
  },
});
// 层级
function bgIndex(e) {
  if (_getTarget(this, e, '.all_bg_wrap')) {
    setZidx($allBgWrap[0], 'bg', closeBgBox);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  bgIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  bgIndex(e.changedTouches[0]);
});
