import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import {
  imgjz,
  copyText,
  isImgFile,
  toLogin,
  getScreenSize,
  longPress,
  isMobile,
  getFiles,
  isIframe,
  myOpen,
  getFilePath,
  LazyLoad,
  isRoot,
  isLogin,
  concurrencyTasks,
  _getTarget,
  getPicPath,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import pagination from '../../js/plugins/pagination';
import { UpProgress } from '../../js/plugins/UpProgress';
import _msg from '../../js/plugins/message';
import loadfailImg from '../../images/img/loadfail.png';
import {
  reqPicDelete,
  reqPicList,
  reqPicRepeat,
  reqPicUp,
} from '../../api/pic';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import md5 from '../../js/utils/md5';
import _path from '../../js/utils/path';
import cacheFile from '../../js/utils/cacheFile';
import imgPreview from '../../js/plugins/imgPreview';
import { BoxSelector } from '../../js/utils/boxSelector';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg } from '../home/home';
import localData from '../../js/common/localData';
if (!isLogin()) {
  toLogin();
}
if (!isIframe()) {
  realtime.init().add((res) => {
    res.forEach((item) => {
      otherWindowMsg(item);
    });
  });
}
const $contentWrap = $('.content_wrap'),
  $imgList = $contentWrap.find('.img_list'),
  $footer = $('.footer');
// 上传
async function hdUpFile(files) {
  const fData = [];
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
      _msg.error(`图片格式错误`);
      return;
    }
    if (size <= 0 || size >= _d.fieldLength.maxPicSize * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片限制0-${_d.fieldLength.maxPicSize}MB`);
      return;
    }
    try {
      //文件切片
      let HASH = await md5.sampleHash(file);
      const isrepeat = await reqPicRepeat({
        HASH,
      }); //是否已经存在文件

      if (isrepeat.code === 1) {
        pro.close('文件已存在');
        const { url } = isrepeat.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: getPicPath(url, 1),
        });
        //文件已经存在操作
        return;
      }
      const result = await reqPicUp(
        {
          name,
          HASH,
        },
        file,
        (percent) => {
          pro.update(percent);
        },
        signal
      );
      if (result.code === 1) {
        const { url } = result.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: getPicPath(url, 1),
        });
        pro.close();
      } else {
        pro.fail();
      }
    } catch {
      pro.fail();
    }
  });
  picPageNo = 1;
  renderImgList(true);
  showLink(fData);
}
// 粘贴上传
document.body.addEventListener('paste', function (e) {
  let files = [];
  let data = e.clipboardData || window.clipboardData;
  [...data.items].forEach((item) => {
    let blob = item.getAsFile();
    if (blob && isImgFile(blob.name)) {
      files.push(blob);
    }
  });
  if (files.length === 0) return;
  e.preventDefault();
  hdUpFile(files);
});
if (isIframe()) {
  $contentWrap.find('.go_home').remove();
}
$contentWrap
  .on('click', '.uoload_img_btn', async function (e) {
    e.stopPropagation();
    const files = await getFiles({
      multiple: true,
      accept: 'image/*',
    });
    if (files.length === 0) return;
    hdUpFile(files);
  })
  .on('click', '.go_home', function () {
    myOpen('/');
  });
// 拖拽上传
~(function () {
  document.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  document.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    hdUpFile(files);
  });
})();
// 获取壁纸
let picPageNo = 1;
let curPageSize = localData.get('bgPageSize');
renderImgList(true);
// 图片列表加载
function imgListLoading() {
  let str = '';
  new Array(12).fill(null).forEach(() => {
    str += `<div style="pointer-events: none;" class="img_item">
        <div class="img"></div>
            </div>`;
  });
  $imgList.html(str).scrollTop(0);
}
if (!isRoot()) {
  $imgList.remove();
}
// 获取图片信息
function getPicItem(id) {
  return $imgList.list.find((item) => item.id === id) || {};
}
const picBoxSelector = new BoxSelector($imgList[0], {
  selectables: '.img_item',
  onSelectStart({ e }) {
    const item = _getTarget($imgList[0], e, '.img_item');
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
picBoxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
function stopSelect() {
  $imgList
    .find('.img_item .check_level')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $footer.stop().slideUp(_d.speed, () => {
    picBoxSelector.stop();
  });
}
function startSelect() {
  $footer
    .stop()
    .slideDown(_d.speed, () => {
      picBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
$imgList.list = [];
// 生成列表
function renderImgList(y) {
  if (!isRoot()) return;
  if (y) {
    imgListLoading();
  }
  let showpage = curPageSize;
  reqPicList({ pageNo: picPageNo, pageSize: showpage })
    .then((result) => {
      if (result.code === 1) {
        const { total, data, pageNo } = result.data;
        picPageNo = pageNo;
        $imgList.list = data;
        const html = _tpl(
          `
          <p v-if="total === 0" style='text-align: center;'>{{_d.emptyList}}</p>
          <template v-else>
            <div v-for="{id} in data" class="img_item" :data-id="id">
              <div check="n" class="check_level"></div>
              <i cursor="y" class="menu_btn iconfont icon-shoucang"></i>
              <div class="img"></div>
            </div>
            <div v-html="getPaging()" class="pagingbox"></div>
          </template>
          `,
          {
            total,
            data,
            _d,
            getPaging() {
              return pgnt.getHTML({
                pageNo,
                pageSize: showpage,
                total,
                small: getScreenSize().w <= _d.screen,
              });
            },
          }
        );
        stopSelect();
        $imgList.html(html).addClass('open');
        if (y) {
          $imgList.scrollTop(0);
        }
        const imgs = [...$imgList[0].querySelectorAll('.img')].filter(
          (item) => {
            const $img = $(item);
            const obj = getPicItem($img.parent().attr('data-id'));
            if (!obj) return;
            const url = getFilePath(`/pic/${obj.url}`, { t: 1 });
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
        bglazyImg.bind(imgs, async (item) => {
          const $img = $(item);
          const obj = getPicItem($img.parent().attr('data-id'));
          if (!obj) return;
          const url = getFilePath(`/pic/${obj.url}`, { t: 1 });
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
      }
    })
    .catch(() => {});
}
const bglazyImg = new LazyLoad();
// 分页
const pgnt = pagination($imgList[0], {
  select: [20, 40, 60, 80, 100],
  change(val) {
    picPageNo = val;
    renderImgList(true);
    _msg.botMsg(`第 ${picPageNo} 页`);
  },
  changeSize(val) {
    curPageSize = val;
    localData.set('bgPageSize', curPageSize);
    picPageNo = 1;
    renderImgList(true);
    _msg.botMsg(`第 ${picPageNo} 页`);
  },
  toTop() {
    $imgList.scrollTop(0);
  },
});
// 复制
function copyLink(e, pobj) {
  const data = [];
  const obj = {
    url: getPicPath(pobj.url, 1),
    filename: pobj.hash,
  };
  typeTemplateArr.forEach((item, idx) => {
    const { type, template } = item;
    const text = template.replace(/\{\{(.*?)\}\}/g, function () {
      const key = arguments[1];
      return obj[key];
    });
    data.push({
      id: idx + 1 + '',
      text: type,
      param: { text },
    });
  });
  rMenu.selectMenu(
    e,
    data,
    ({ param, close, id }) => {
      if (id) {
        close();
        copyText(param.text);
      }
    },
    '选择复制链接类型'
  );
}
// 删除
function deletePic(e, ids, cb, isCheck, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${isCheck ? '选中的' : ''}图片？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqPicDelete(ids)
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              cb && cb();
              _msg.success(result.codeText);
              renderImgList();
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
function picMenu(e, pobj, el) {
  const data = [
    { id: '1', text: '复制链接', beforeIcon: 'iconfont icon-fuzhi' },
    { id: '2', text: '选中', beforeIcon: 'iconfont icon-duoxuan' },
    {
      id: '3',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        copyLink(e, pobj);
      } else if (id === '3') {
        deletePic(e, [pobj.id], close, false, loading);
      } else if (id === '2') {
        close();
        $imgList.find('.check_level').css('display', 'block');
        startSelect();
        checkedImg(el);
      }
    },
    '操作图片'
  );
}
$imgList
  .on('click', '.img', function (e) {
    const $this = $(this);
    const idx = $this.index('.img');
    const arr = [];
    $imgList.find('.img').each((_, item) => {
      const $item = $(item);
      const obj = getPicItem($item.parent().attr('data-id'));
      const u1 = getPicPath(obj.url);
      const u2 = getFilePath(`/pic/${obj.url}`, { t: 1 });
      arr.push({
        u2,
        u1,
      });
    });
    imgPreview(arr, idx, { x: e.clientX, y: e.clientY });
  })
  .on('contextmenu', '.img', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    picMenu(
      e,
      getPicItem($(this).parent().data('id')),
      this.parentNode.querySelector('.check_level')
    );
  })
  .on('click', '.menu_btn', function (e) {
    e.preventDefault();
    picMenu(
      e,
      getPicItem($(this).parent().data('id')),
      this.parentNode.querySelector('.check_level')
    );
  })
  .on('click', '.check_level', function () {
    checkedImg(this);
  });
// 选中
function checkedImg(el) {
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
  const $imgItem = $imgList.find('.img_item'),
    $checkArr = $imgItem.filter(
      (_, item) => $(item).find('.check_level').attr('check') === 'y'
    );
  _msg.botMsg(`选中：${$checkArr.length}项`);
  if ($checkArr.length === $imgItem.length) {
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
longPress($imgList[0], '.img', function (e) {
  if (isSelecting()) return;
  const ev = e.changedTouches[0];
  picMenu(
    ev,
    getPicItem($(this).parent().data('id')),
    this.parentNode.querySelector('.check_level')
  );
});
// url模板
const typeTemplateArr = [
  {
    type: 'url',
    template: '{{url}}',
  },
  {
    type: 'markdown',
    template: '![{{filename}}]({{url}})',
  },
  {
    type: 'html',
    template: '<img src="{{url}}" alt="{{filename}}" title="{{filename}}" />',
  },
  {
    type: 'bbcode',
    template: '[img]{{url}}[/img]',
  },
  {
    type: 'markdown with link',
    template: '[![{{filename}}]({{url}})]({{url}})',
  },
];
// 显示图片连接
const showLink = (function () {
  const $tabMask = $('.tab_mask'),
    $head = $tabMask.find('.head'),
    $content = $tabMask.find('.content');
  function render(data) {
    if (data.length === 0) return;
    const htmlH = _tpl(
      `
      <span v-for="{type},idx in typeTemplateArr" :data-idx="idx" cursor="y" :class="idx === 0 ? 'active' : ''">{{type}}</span>
      `,
      {
        typeTemplateArr,
      }
    );
    const htmlC = _tpl(
      `
      <ul v-for="{type,template},idx in typeTemplateArr" :class="idx === 0 ? 'active' : ''">
        <li v-for="obj in data" :data-text="getText(template,obj)">{{getText(template,obj)}}<i cursor="y" class="iconfont icon-fuzhi"></i></li>
      </ul>
      `,
      {
        typeTemplateArr,
        data,
        getText(template, obj) {
          return template.replace(/\{\{(.*?)\}\}/g, function () {
            const key = arguments[1];
            return obj[key];
          });
        },
      }
    );
    $head.html(htmlH);
    $content.html(htmlC);
    $tabMask.stop().fadeIn(_d.speed);
  }
  $tabMask.on('click', function (e) {
    if (e.target === this) {
      $tabMask.stop().fadeOut(_d.speed, () => {
        $content.html('');
        $head.html('');
      });
    }
  });
  $content.on('click', 'i', function () {
    const text = $(this).parent().attr('data-text');
    copyText(text);
  });
  $head.on('click', 'span', function () {
    const $this = $(this),
      idx = $this.attr('data-idx'),
      $span = $head.find('span'),
      $ul = $content.find('ul');
    $span.removeClass('active');
    $this.addClass('active');
    $ul.removeClass('active');
    $ul.eq(idx).addClass('active');
  });
  return render;
})();
$footer
  .on('click', '.f_delete', function (e) {
    const $imgItem = $imgList.find('.img_item'),
      $checkArr = $imgItem.filter(
        (_, item) => $(item).find('.check_level').attr('check') === 'y'
      );
    if ($checkArr.length === 0) return;
    const arr = [];
    $checkArr.each((i, v) => {
      arr.push(v.getAttribute('data-id'));
    });
    deletePic(e, arr, false, 1);
  })
  .on('click', '.f_close', stopSelect)
  .on('click', 'span', function () {
    let che = $(this).attr('check');
    che === 'y' ? (che = 'n') : (che = 'y');
    $footer.find('span').attr({
      class:
        che === 'y'
          ? 'iconfont icon-xuanzeyixuanze'
          : 'iconfont icon-xuanzeweixuanze',
      check: che,
    });
    let $imgItem = $imgList.find('.img_item');
    $imgItem
      .find('.check_level')
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $imgItem.length : 0}项`);
  });
