import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../file/index.less';
import './index.less';
import '../../js/common/common';
import {
  LazyLoad,
  _getData,
  _getDataTem,
  _myOpen,
  _setData,
  _setDataTem,
  computeSize,
  copyText,
  downloadFile,
  enterPassCode,
  fileLogoType,
  formatDate,
  getFilePath,
  getPaging,
  getScreenSize,
  getSuffix,
  getTextImg,
  getWordCount,
  hdOnce,
  hdPath,
  imgPreview,
  imgjz,
  isImgFile,
  isMobile,
  isVideoFile,
  longPress,
  mixedSort,
  myOpen,
  pageErr,
  queryURLParams,
  setPageScrollTop,
  userLogoMenu,
  wrapInput,
} from '../../js/utils/utils';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _d from '../../js/common/config';
import curmb from '../file/crumb/index';
import { openFile, setReadOnly } from '../file/edit';
import bus from '../../js/utils/bus';
import loadfailImg from '../../images/img/loadfail.png';
import {
  reqFileGetShare,
  reqFileReadDir,
  reqFileReadDirSize,
  reqFileReadFile,
} from '../../api/file';
import toolTip from '../../js/plugins/tooltip';
import { showFileInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
_d.isFilePage = true;
const $contentWrap = $('.content_wrap');
const $pagination = $('.pagination');
const $curmbBox = $('.crumb_box');
const $search = $('.search');
const $header = $('.header');
const $shareInfo = $('.share_info');
const $fileBox = $('.file_box');
let pageSize = _getData('filesPageSize');
let fileUrl = _getDataTem('fileUrl') || '/';
let fileShowGrid = _getData('fileShowGrid');
let urlparmes = queryURLParams(myOpen()),
  HASH = urlparmes.HASH;
if (!HASH) {
  pageErr();
}
let passCode = _getDataTem('passCode', HASH) || '';
let shareObj = {};
let uObj = {};
setReadOnly(true);
const verifyCode = hdOnce(() => {
  enterPassCode(({ close, val }) => {
    passCode = val;
    getShareData(close);
  });
});
// 获取分享数据
function getShareData(close) {
  reqFileGetShare({ id: HASH, pass: passCode })
    .then((res) => {
      if (res.code == 0) {
        _setDataTem('passCode', passCode, HASH);
        close && close();
        let { username, logo, account, data, valid, title, email } = res.data;
        uObj = { username, account, email };
        shareObj = data;
        logo = logo
          ? hdPath(`/api/pub/logo/${account}/${logo}`)
          : getTextImg(username);
        imgjz(
          logo,
          () => {
            $shareInfo.find('.logo').css('background-image', `url(${logo})`);
          },
          () => {
            $shareInfo
              .find('.logo')
              .css('background-image', `url(${getTextImg(username)})`);
          }
        );
        $shareInfo.find('.from').text(username);
        $shareInfo.find('.title').text(title);
        $shareInfo.find('.valid').text(
          valid == 0
            ? '永久'
            : formatDate({
                template: '{0}-{1}-{2} {3}:{4}',
                timestamp: valid,
              })
        );
        if (data.type == 'file') {
          $contentWrap.remove();
          $pagination.remove();
          $curmbBox.remove();
          $search.remove();
          $header.remove();
          const [a, b] = getSuffix(data.name);
          $fileBox.find('.name').html(
            _tpl(
              `
              <template>
              {{a}}<span class="suffix">{{b?'.'+b:''}}</span>
              </template>
              `,
              { a, b }
            )
          );
          $fileBox.find('.download').text(`下载 (${computeSize(data.size)})`);
          if (isImgFile(data.name)) {
            const url =
              getFilePath(`/sharefile/${HASH}`, 1) +
              '&pass=' +
              encodeURIComponent(passCode);
            imgjz(
              url,
              (img) => {
                $fileBox.find('.logo').html(img);
              },
              (img) => {
                img.src = loadfailImg;
                $fileBox.find('.logo').html(img);
              }
            );
          } else {
            $fileBox
              .find('.logo')
              .attr('class', `logo iconfont ${fileLogoType(data.name)}`);
          }
          $shareInfo.addClass('open');
          $fileBox.addClass('open');
        } else if (data.type == 'dir') {
          $fileBox.remove();
          openDir(fileUrl, 1);
        }
      } else if (res.code == 3) {
        if (passCode) {
          _msg.error('提取码错误');
        }
        verifyCode();
      }
    })
    .catch(() => {});
}
getShareData();
// 显示模式
function changeListShowModel() {
  $header
    .find('.h_showmodel_btn')
    .attr(
      'class',
      `h_btn h_showmodel_btn iconfont ${
        fileShowGrid ? 'icon-liebiao1' : 'icon-liebiao'
      }`
    );
  $contentWrap
    .find('.container')
    .attr('class', `container ${fileShowGrid ? 'grid' : ''}`);
}
changeListShowModel();
let pageNo = 1;
// 面包屑
curmb.bind($curmbBox.find('.container')[0], (path) => {
  pageNo = 1;
  openDir(path, 1);
});
$contentWrap.list = [];
$contentWrap.originList = [];
let fileSort = _getData('fileSort');
// 搜索
const wInput = wrapInput($search.find('.inp_box input')[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $search.find('.inp_box i').css('display', 'none');
    } else {
      $search.find('.inp_box i').css('display', 'block');
    }
    pageNo = 1;
    renderList(1);
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    $(target).parent().removeClass('focus');
  },
});
$search.on('click', '.inp_box i', function () {
  wInput.setValue('');
  wInput.target.focus();
});
function openSearch() {
  $search.stop().slideDown(_d.speed, () => {
    wInput.target.focus();
  });
}
function closeSearch() {
  if (wInput.getValue()) {
    wInput.setValue('');
  }
  $search.stop().slideUp(_d.speed);
}
// 生成列表
async function renderList(top) {
  $contentWrap.list = await hdSort($contentWrap.originList);
  const paging = getPaging($contentWrap.list, pageNo, pageSize);
  pageNo = paging.pageNo;
  const html = _tpl(
    `
    <template v-if="paging.list.length > 0">
      <ul v-for="{type,name,size,time,id} in paging.list" class="file_item" :data-id="id">
        <li class="check_state" check="n"></li>
        <li cursor="y" class="logo iconfont {{getLogo(name,type) || 'is_img'}}"></li>
        <li cursor="y" class="name"><span class="text">{{getText(name,type).a}}<span class="suffix">{{getText(name,type).b}}</span></span></li>
        <li :cursor="type == 'file' ? '' : 'y'" class="size">{{size ? computeSize(size) : type == 'file' ? '--' : '计算'}}</li>
        <li class="date">{{formatDate({template: '{0}-{1}-{2} {3}:{4}',timestamp: time})}}</li>
      </ul>
      <i v-for="item in 10" class='fill'></i>
    </template>
    <p v-else>{{_d.emptyList}}</p>
    `,
    {
      _d,
      paging,
      formatDate,
      computeSize,
      getLogo(name, type) {
        let logo = '';
        if (!isImgFile(name)) {
          if (type == 'file') {
            logo = fileLogoType(name);
          } else {
            logo = 'icon-24gl-folder';
          }
        }
        return logo;
      },
      getText(name, type) {
        let [a, b] = getSuffix(name);
        if (type == 'file') {
          if (b) {
            b = '.' + b;
          }
        } else {
          a = name;
          b = '';
        }
        return { a, b };
      },
    }
  );
  if (paging.list.length > 0) {
    $pagination.css('display', 'block');
    pgnt.render({
      pageNo,
      pageSize,
      total: $contentWrap.list.length,
      small: getScreenSize().w <= _d.screen,
    });
  } else {
    $pagination.css('display', 'none');
  }
  $contentWrap.find('.container').html(html);
  $shareInfo.addClass('open');
  $contentWrap.addClass('open');
  $pagination.addClass('open');
  $curmbBox.addClass('open');
  $header.addClass('open');
  lazyImg.bind($contentWrap[0].querySelectorAll('.logo.is_img'), (item) => {
    const $item = $(item);
    const { path, name } = getFileItem($item.parent().data('id'));
    if (isImgFile(name)) {
      const url =
        getFilePath(`/sharefile/${HASH}/${path}/${name}`, 1) +
        '&pass=' +
        encodeURIComponent(passCode);
      imgjz(
        url,
        () => {
          $item.css('background-image', `url(${url})`);
        },
        () => {
          $item.css('background-image', `url(${loadfailImg})`);
        }
      );
    }
  });
  if (top) {
    setPageScrollTop(0);
  }
}
const lazyImg = new LazyLoad();
// 分页
const pgnt = pagination($pagination.find('.container')[0], {
  change(val) {
    pageNo = val;
    renderList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  changeSize(val) {
    pageSize = val;
    pageNo = 1;
    renderList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
    _setData('filesPageSize', pageSize);
  },
  toTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  },
});
// 排序
async function hdSort(list) {
  list = [...list];
  const { type, isDes } = fileSort;
  const val = wInput.getValue().trim();
  if (val) {
    list = list.filter((item) => {
      return getWordCount([val], item.name) > 0;
    });
  }
  list.sort((a, b) => {
    if (type == 'time' || type == 'type') {
      if (isDes || type == 'type') {
        return b.time - a.time;
      }
      return a.time - b.time;
    } else if (type == 'name') {
      if (isDes) {
        return mixedSort(b.name, a.name);
      }
      return mixedSort(a.name, b.name);
    } else if (type == 'size') {
      if (isDes) {
        return b.size - a.size;
      }
      return a.size - b.size;
    }
  });
  if (type == 'type') {
    const files = list.filter((item) => item.type == 'file');
    const dirs = list.filter((item) => item.type == 'dir');
    if (isDes) {
      list = [...files, ...dirs];
    } else {
      list = [...dirs, ...files];
    }
  }
  return list;
}
bus.on('refreshList', openDir);
// 打开目录
async function openDir(path, top) {
  try {
    if (!path) {
      path = fileUrl;
    }
    fileUrl = path = hdPath('/' + path);
    _setDataTem('fileUrl', fileUrl);
    curmb.setPath(path);
    const res = await reqFileReadDir({
      path,
      flag: `${HASH}/${passCode}`,
    });
    if (res.code == 0) {
      $contentWrap.originList = res.data.map((item, idx) => ({
        id: idx + 1,
        ...item,
      }));
      if (top && wInput.getValue()) {
        wInput.setValue('');
      } else {
        renderList(top);
      }
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {}
}
function getFileItem(id) {
  return $contentWrap.list.find((item) => item.id == id);
}
async function readFileAndDir(obj) {
  const { type, name, path } = obj;
  const p = `${path}/${name}`;
  if (type == 'dir') {
    pageNo = 1;
    openDir(p, 1);
  } else if (type == 'file') {
    try {
      const res = await reqFileReadFile({
        path: p,
        flag: `${HASH}/${passCode}`,
      });
      if (res.code == 0) {
        if (res.data.type == 'text') {
          openFile(res.data.data, p);
        } else if (res.data.type == 'other') {
          const fPath =
            getFilePath(`/sharefile/${HASH}/${p}`) +
            '&pass=' +
            encodeURIComponent(passCode);
          if (isImgFile(p)) {
            const list = $contentWrap.list.filter(
              (item) => item.type == 'file' && isImgFile(item.name)
            );
            const arr = list.map((item) => {
              const p = `${item.path}/${item.name}`;
              return {
                u1:
                  getFilePath(`/sharefile/${HASH}/${p}`) +
                  '&pass=' +
                  encodeURIComponent(passCode),
                u2:
                  getFilePath(`/sharefile/${HASH}/${p}`, 1) +
                  '&pass=' +
                  encodeURIComponent(passCode),
              };
            });
            if (arr.length == 0) return;
            imgPreview(
              arr,
              list.findIndex((item) => item.id == obj.id)
            );
          } else if (isVideoFile(p)) {
            _myOpen(`/videoplay/#${encodeURIComponent(fPath)}`, obj.name);
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(p)) {
            _myOpen(fPath, obj.name);
          } else {
            downloadFile(fPath, name);
          }
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {}
  }
}
$fileBox
  .on('click', '.name', readFile)
  .on('click', '.logo', readFile)
  .on('click', '.download', function () {
    const p = `/sharefile/${HASH}`;
    const fPath = getFilePath(p) + '&pass=' + encodeURIComponent(passCode);
    downloadFile(fPath, shareObj.name);
  });
// 读取文件
async function readFile() {
  if (shareObj.type == 'file') {
    try {
      const res = await reqFileReadFile({
        flag: `${HASH}/${passCode}`,
      });
      if (res.code == 0) {
        if (res.data.type == 'text') {
          openFile(res.data.data, shareObj.name);
        } else if (res.data.type == 'other') {
          const fPath =
            getFilePath(`/sharefile/${HASH}`) +
            '&pass=' +
            encodeURIComponent(passCode);
          if (isImgFile(shareObj.name)) {
            imgPreview([
              {
                u1: fPath,
                u2:
                  getFilePath(`/sharefile/${HASH}`, 1) +
                  '&pass=' +
                  encodeURIComponent(passCode),
              },
            ]);
          } else if (isVideoFile(shareObj.name)) {
            _myOpen(`/videoplay/#${encodeURIComponent(fPath)}`, shareObj.name);
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(shareObj.name)) {
            _myOpen(fPath, shareObj.name);
          } else {
            downloadFile(fPath, shareObj.name);
          }
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {}
  }
}
$contentWrap
  .on('click', '.logo', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      readFileAndDir(getFileItem(id));
    } else {
      showFileInfo(e, getFileItem(id));
    }
  })
  .on('click', '.size', function () {
    const id = this.parentNode.dataset.id;
    const { type, name, path } = getFileItem(id);
    if (type === 'file') return;
    const p = `${path}/${name}`;
    reqFileReadDirSize({ path: p, flag: `${HASH}/${passCode}` })
      .then((res) => {
        if (res.code == 0) {
          this.innerText = computeSize(res.data.size);
        }
      })
      .catch((error) => {
        if (error.statusText == 'timeout') {
          _msg.success(`文件夹文件较多后台计算中`);
        }
      });
  })
  .on('click', '.name', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      showFileInfo(e, getFileItem(id));
    } else {
      readFileAndDir(getFileItem(id));
    }
  })
  .on('mouseenter', '.file_item', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    const { name, type, path, mode, size, time } = getFileItem(id);
    const str = `name：${name}\ntype：${type}\npath：${path}\nmode：${mode}\nsize：${
      size ? computeSize(size) : '--'
    }\ntime：${formatDate({
      template: '{0}-{1}-{2} {3}:{4}',
      timestamp: time,
    })}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.file_item', function () {
    toolTip.hide();
  })
  .on('contextmenu', '.file_item', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    rightList(e, getFileItem(this.dataset.id));
  });
longPress($contentWrap[0], '.file_item', function (e) {
  const ev = e.changedTouches[0];
  rightList(ev, getFileItem(this.dataset.id));
});
// 菜单
function rightList(e, obj) {
  let data = [];
  if (obj.type == 'file') {
    data.push(
      {
        id: 'download',
        text: '下载',
        beforeIcon: 'iconfont icon-xiazai1',
      },
      {
        id: 'copy',
        text: '复制链接',
        beforeIcon: 'iconfont icon-fuzhi',
      }
    );
  }
  data.push({
    id: 'info',
    text: '属性',
    beforeIcon: 'iconfont icon-about',
  });
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close }) => {
      if (id == 'copy') {
        close();
        copyText(
          getFilePath(`/sharefile/${HASH}/${obj.path}/${obj.name}`) +
            '&pass=' +
            encodeURIComponent(passCode)
        );
      } else if (id == 'download') {
        close();
        downloadFile(
          getFilePath(`/sharefile/${HASH}/${obj.path}/${obj.name}`) +
            '&pass=' +
            encodeURIComponent(passCode),
          obj.name
        );
      } else if (id == 'info') {
        showFileInfo(e, obj);
      }
    },
    obj.name
  );
}
$shareInfo.on('click', '.logo', function (e) {
  const { account, username, email } = uObj;
  userLogoMenu(e, account, username, email);
});
// 排序
function hdFileSort(e) {
  const { type, isDes } = fileSort;
  const data = [
    {
      id: '1',
      text: '名称排序',
      param: { value: 'name' },
    },
    {
      id: '2',
      text: '时间排序',
      param: { value: 'time' },
    },
    {
      id: '3',
      text: '大小排序',
      param: { value: 'size' },
    },
    {
      id: '4',
      text: '类别排序',
      param: { value: 'type' },
    },
    {
      id: '5',
      text: '升序',
      param: { value: false },
      beforeIcon: 'iconfont icon-jiantou_qiehuanxiangshang',
    },
    {
      id: '6',
      text: '降序',
      param: { value: true },
      beforeIcon: 'iconfont icon-jiantou_qiehuanxiangxia',
    },
  ];
  data.forEach((item) => {
    if (item.param.value === isDes || item.param.value === type) {
      item.active = true;
    } else {
      item.active = false;
    }
  });
  rMenu.selectMenu(
    e,
    data,
    ({ close, id, param }) => {
      if (id) {
        if (id > 0 && id <= 4) {
          fileSort.type = param.value;
        } else {
          fileSort.isDes = param.value;
        }
        close();
        pageNo = 1;
        renderList(1);
        _setData('fileSort', fileSort);
      }
    },
    '选择列表排序方式'
  );
}
$header
  .on('click', '.h_showmodel_btn', function () {
    fileShowGrid = !fileShowGrid;
    _setData('fileShowGrid', fileShowGrid);
    changeListShowModel();
  })
  .on('click', '.h_search_btn', function () {
    if ($search.is(':hidden')) {
      setPageScrollTop(0);
      openSearch();
    } else {
      closeSearch();
    }
  })
  .on('click', '.h_sort_btn', hdFileSort);
