import $ from 'jquery';
import loadfailImg from '../../../images/img/loadfail.png';
import {
  _setData,
  _getData,
  debounce,
  _getTarget,
  imgjz,
  _mySlide,
  isImgFile,
  downloadFile,
  imgPreview,
  getScreenSize,
  longPress,
  isMobile,
  getFiles,
  isBigScreen,
  getPathFilename,
  getFilePath,
  LazyLoad,
  isRoot,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import pagination from '../../../js/plugins/pagination';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import realtime from '../../../js/plugins/realtime';
import {
  reqBgDelete,
  reqBgList,
  reqBgRepeat,
  reqBgUp,
} from '../../../api/bg.js';
import { hideRightMenu } from '../rightSetting/index.js';
import { setBg } from '../index.js';
import { backWindow, setZidx } from '../backWindow.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import fileSlice from '../../../js/utils/fileSlice.js';
const $allBgWrap = $('.all_bg_wrap'),
  $bgList = $allBgWrap.find('.bg_list'),
  $bgFooter = $allBgWrap.find('.bg_footer');
let bgList = [];
// 上传壁纸
async function hdUpBg(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { name, size } = file;
    const pro = new UpProgress(name);
    if (!isImgFile(name)) {
      pro.fail();
      _msg.error(`图片格式错误`);
      continue;
    }
    if (size <= 0 || size >= 20 * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片大小必须0~20M范围`);
      continue;
    }
    try {
      //文件切片
      const { HASH } = await fileSlice(files[i], (percent) => {
        pro.loading(percent);
      });
      const isrepeat = await reqBgRepeat({
        HASH,
      }); //是否已经存在文件

      if (parseInt(isrepeat.code) === 0) {
        pro.close('壁纸已存在');
        //文件已经存在操作
        continue;
      }
      const result = await reqBgUp({ name, HASH }, file, (percent) => {
        pro.update(percent);
      });
      if (parseInt(result.code) === 0) {
        pro.close();
      } else {
        pro.fail();
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      pro.fail();
    }
  }
  realtime.send({ type: 'updatedata', data: { flag: 'bg' } });
  bgpage = 1;
  renderBgList(true);
}
// 关闭壁纸库
function closeBgBox() {
  $allBgWrap.stop().fadeOut(_d.speed, () => {
    bglazyImg.unBind();
    backWindow.remove('bg');
    $bgList.html('');
  });
}
$allBgWrap
  .on('click', '.upload_bg', async function () {
    const files = await getFiles({
      multiple: true,
      accept: '.jpg,.jpeg,.png,.ico,.svg,.webp,.gif',
    });
    if (files.length == 0) return;
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
    if (files.length == 0) return;
    hdUpBg(files);
  });
})();
// 删除壁纸
export function delBg(e, ids, cb, isCheck) {
  _pop(
    {
      e,
      text: `确认删除：${isCheck ? '选中的' : ''}壁纸？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type == 'confirm') {
        reqBgDelete(ids)
          .then((result) => {
            if (parseInt(result.code) === 0) {
              cb && cb();
              _msg.success(result.codeText);
              renderBgList();
              return;
            }
          })
          // eslint-disable-next-line no-unused-vars
          .catch((err) => {});
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
      beforeIcon: 'iconfont icon-xiazai1',
    },
  ];
  if (isRoot()) {
    if ($bgFooter.is(':hidden')) {
      data.push({
        id: '3',
        text: '选中',
        beforeIcon: 'iconfont icon-duoxuan',
      });
    }
    data.push({
      id: '4',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id }) => {
      if (id == '1') {
        $allBgWrap.stop().fadeOut(_d.speed, () => {
          $bgList.html('');
        });
        setBg(obj, close);
      } else if (id == '4') {
        if (isRoot()) {
          delBg(e, [obj.id], () => {
            close();
          });
        }
      } else if (id == '2') {
        close();
        downloadFile(
          getFilePath(`/bg/${obj.url}`),
          getPathFilename(obj.url)[0]
        );
      } else if (id == '3') {
        close();
        $bgList.find('.check_level').css('display', 'block');
        $bgFooter.stop().slideDown(_d.speed).find('span').attr({
          class: 'iconfont icon-xuanzeweixuanze',
          check: 'n',
        });
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
  new Array(50).fill(null).forEach(() => {
    str += `<div style="pointer-events: none;" class="bg_item">
            <div class="bg_img"></div>
            </div>`;
  });
  $bgList.html(str).scrollTop(0);
}
// 获取壁纸信息
function getBgItem(id) {
  return bgList.find((item) => item.id == id);
}
const defaultRes = `<p style='text-align: center;'>${_d.emptyList}</p>`;
// 壁纸库是隐藏
function bgBoxIsHide() {
  return $allBgWrap.is(':hidden');
}
// 获取壁纸列表
export function renderBgList(y) {
  if (bgBoxIsHide()) return;
  if (y) {
    bgLoading();
  }
  let str = '',
    type = isBigScreen() ? 'bg' : 'bgxs',
    showpage = _getData('bgPageSize');
  reqBgList({ type, pageNo: bgpage, pageSize: showpage })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        if (bgBoxIsHide()) return;
        let { total, data, pageNo } = result.data;
        bgpage = pageNo;
        bgList = data;
        if (data.length == 0) {
          str += defaultRes;
        } else {
          data.forEach((v) => {
            const { id, url } = v;
            str += `<div class="bg_item" data-id="${id}">
                  <div check="n" class="check_level"></div>
                  <i cursor class="menu_btn iconfont icon-shoucang"></i>
                  <div class="bg_img" data-src="${getFilePath(
                    `/bg/${url}`
                  )}"></div>
                      </div>`;
          });
          str += `<div class="bg_paging_box">`;
          str += bgPgnt.getHTML({
            pageNo,
            pageSize: showpage,
            total,
            small: getScreenSize().w <= _d.screen,
          });
          str += `</div > `;
        }
        $bgList.html(str);
        $bgFooter.stop().slideUp(_d.speed);
        if (y) {
          $bgList.scrollTop(0);
        }
        bglazyImg.bind($bgList[0].querySelectorAll('.bg_img'), (item) => {
          const $img = $(item);
          const url = $img.attr('data-src') + '&t=1';
          imgjz(
            url,
            () => {
              $img
                .css({
                  'background-image': `url(${url})`,
                })
                .addClass('load');
            },
            () => {
              $img.css({
                'background-image': `url(${loadfailImg})`,
              });
            }
          );
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
    _setData('bgPageSize', val);
    bgpage = 1;
    renderBgList(true);
    _msg.botMsg(`第 ${bgpage} 页`);
  },
  toTop() {
    $bgList.stop().animate(
      {
        scrollTop: 0,
      },
      _d.speed
    );
  },
});
// 预览
function hdPreview() {
  const $this = $(this);
  const idx = $this.index('.bg_img');
  const arr = [];
  $bgList.find('.bg_img').each((_, item) => {
    const $item = $(item);
    const u1 = $item.attr('data-src');
    const u2 = `${u1}&t=1`;
    arr.push({
      u2,
      u1,
    });
  });
  imgPreview(arr, idx);
}
$bgList
  .on('contextmenu', '.bg_img', function (e) {
    e.preventDefault();
    if (isMobile()) return;
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
  let ev = e.changedTouches[0];
  let obj = getBgItem($(this).parent().data('id'));
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
  .on('click', '.f_close', function () {
    const $bgItems = $bgList.find('.bg_item');
    $bgItems
      .find('.check_level')
      .css('display', 'none')
      .attr('check', 'n')
      .css('background-color', 'transparent');
    $bgFooter.stop().slideUp(_d.speed);
  })
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
  $allBgWrap.stop().slideDown(_d.speed, () => {
    renderBgList(true);
  });
  setZidx($allBgWrap[0], 'bg', closeBgBox);
}
window.addEventListener(
  'resize',
  debounce(function () {
    renderBgList(true);
  }, 500)
);
// 壁纸
_mySlide({
  el: '.all_bg_wrap',
  right() {
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
