import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import '../../js/common/common';
import {
  LazyLoad,
  _getData,
  _myOpen,
  _setData,
  computeSize,
  createShare,
  debounce,
  downloadFile,
  fileLogoType,
  formatDate,
  getFilePath,
  getFiles,
  getPaging,
  getScreenSize,
  getSuffix,
  getWordCount,
  hdFilename,
  hdPath,
  imgPreview,
  imgjz,
  isFilename,
  isIframe,
  isImgFile,
  isLogin,
  isMobile,
  isParentDir,
  isRoot,
  isVideoFile,
  longPress,
  mixedSort,
  myOpen,
  setPageScrollTop,
  splitWord,
  toLogin,
  wrapInput,
} from '../../js/utils/utils';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _d from '../../js/common/config';
import curmb from './crumb/index';
import { editFileIsHiden, openFile } from './edit';
import { UpProgress } from '../../js/plugins/UpProgress';
import _pop from '../../js/plugins/popConfirm';
import { maskLoading } from '../../js/plugins/loadingBar';
import bus from '../../js/utils/bus';
import loadfailImg from '../../images/img/loadfail.png';
import {
  reqFileBreakpoint,
  reqFileCopy,
  reqFileCreateDir,
  reqFileCreateFile,
  reqFileDelete,
  reqFileMerge,
  reqFileMode,
  reqFileMove,
  reqFileReadDir,
  reqFileReadDirSize,
  reqFileReadFile,
  reqFileRename,
  reqFileRepeat,
  reqFileShare,
  reqFileUnZip,
  reqFileUp,
  reqFileZip,
} from '../../api/file';
import toolTip from '../../js/plugins/tooltip';
import { showFileInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import fileSlice from '../../js/utils/fileSlice';
import realtime from '../../js/plugins/realtime';
import { _tpl } from '../../js/utils/template';
_d.isFilePage = true;
const $contentWrap = $('.content_wrap');
const $pagination = $('.pagination');
const $curmbBox = $('.crumb_box');
const $search = $('.search');
const $header = $('.header');
const $footer = $('.footer');
let pageSize = _getData('filesPageSize');
let fileUrl = _getData('fileUrl');
let fileShowGrid = _getData('fileShowGrid');
// 更改显示模式
function changeListShowModel() {
  $header
    .find('.h_showmodel_btn')
    .attr(
      'class',
      `h_btn h_showmodel_btn iconfont ${
        fileShowGrid ? 'icon-liebiao' : 'icon-liebiao1'
      }`
    );
  $contentWrap
    .find('.container')
    .attr('class', `container ${fileShowGrid ? 'grid' : ''}`);
}
changeListShowModel();
let pageNo = 1;
let waitObj = {};
let isChecking;
if (!isLogin()) {
  toLogin();
}
// 同步数据
realtime.init().add((res) => {
  res.forEach((item) => {
    const {
      type,
      data: { flag },
    } = item;
    if (type === 'updatedata' && flag === 'file') {
      openDir();
    } else if (type === 'pastefiledata') {
      waitObj = item.data;
      if (waitObj.type) {
        showPaste();
      } else {
        hidePaste();
      }
    }
  });
});
// 绑定面包屑
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
// 显示搜索
function openSearch() {
  $search.stop().slideDown(_d.speed, () => {
    wInput.target.focus();
  });
}
// 隐藏搜索
function closeSearch() {
  if (wInput.getValue()) {
    wInput.setValue('');
  }
  $search.stop().slideUp(_d.speed);
}
// 生成列表
async function renderList(top) {
  closeCheck();
  $contentWrap.list = await hdSort($contentWrap.originList);
  const paging = getPaging($contentWrap.list, pageNo, pageSize);
  const totalPage = paging.totalPage;
  pageNo = paging.pageNo;
  const html = _tpl(
    `
    <template v-if="list.length > 0">
      <ul v-for="{type, name, size, time, id} in list" draggable="true" class="file_item" :data-id="id">
        <li class="check_state" check="n"></li>
        <li cursor="y" class="logo iconfont {{hdLogo(name,type) || 'is_img'}}"></li>
        <li cursor="y" class="name">
          <span class="text">{{getText(name,type).a}}<span class="suffix">{{getText(name,type).b}}</span>
          </span>
        </li>
        <li :cursor="type == 'file' ? '' : 'cursor'" class="size">{{size ? computeSize(size) : type == 'file' ? '--' : '计算'}}</li>
        <li class="date">{{formatDate({template: '{0}-{1}-{2} {3}:{4}',timestamp: time})}}</li>
      </ul>
      <i v-for="item in 10" class='fill'></i>
    </template>
    <p v-else>{{_d.emptyList}}</p>
    `,
    {
      formatDate,
      list: paging.list,
      hdLogo(name, type) {
        let logo = '';
        if (!isImgFile(name)) {
          if (type == 'file') {
            logo = fileLogoType(name);
          } else {
            logo = 'icon-24gl-folder';
          }
          return logo;
        }
      },
      computeSize,
      getText(name, type) {
        let [a, b] = getSuffix(name);
        if (type == 'file') {
          b = b ? '.' + b : '';
        } else {
          a = name;
          b = '';
        }
        return { a, b };
      },
      _d,
    }
  );
  if (paging.list.length > 0) {
    $pagination.css('display', 'block');
    pgnt.render({
      pageNo,
      pageTotal: totalPage,
      pageSize,
      total: $contentWrap.list.length,
      small: getScreenSize().w <= _d.screen,
    });
  } else {
    $pagination.css('display', 'none');
  }
  $contentWrap.find('.container').html(html);
  $contentWrap.addClass('open');
  $pagination.addClass('open');
  $header.addClass('open');
  $curmbBox.addClass('open');
  lazyImg.bind($contentWrap[0].querySelectorAll('.logo.is_img'), (item) => {
    const $item = $(item);
    const { path, name } = getFileItem($item.parent().data('id'));
    if (isImgFile(name)) {
      const url = getFilePath(`/file/${path}/${name}`, 1);
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
~(function () {
  let fromDom = null;
  $contentWrap
    .on('dragstart', '.file_item', function () {
      fromDom = this;
    })
    .on('drop', '.file_item', function (e) {
      if (fromDom) {
        const $this = $(this),
          fromId = $(fromDom).attr('data-id'),
          toId = $this.attr('data-id');
        const data = [getFileItem(fromId)];
        const toData = getFileItem(toId);
        if (fromId !== toId && toData.type === 'dir') {
          _pop(
            { e, text: `${data[0].name} 移动到：${toData.name}？` },
            (type) => {
              if (type === 'confirm') {
                reqFileMove({ data, path: `${fileUrl}/${toData.name}` })
                  .then((res) => {
                    if (res.code == 0) {
                      _msg.success(res.codeText);
                      openDir();
                    }
                  })
                  .catch(() => {});
              }
            }
          );
        }
        fromDom = null;
      }
    })
    .on('dragover', '.file_item', function (e) {
      e.preventDefault();
    });
})();
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
    const word = await splitWord(val);
    list = list.filter((item) => {
      return getWordCount(word, item.name) > 0;
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
openDir(fileUrl, 1);
bus.on('refreshList', openDir);
// 打开目录
async function openDir(path, top) {
  try {
    if (!path) {
      path = fileUrl;
    }
    fileUrl = path = hdPath('/' + path);
    _setData('fileUrl', fileUrl);
    curmb.setPath(path);
    const res = await reqFileReadDir({ path });
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
// 获取文件信息
function getFileItem(id) {
  return $contentWrap.list.find((item) => item.id == id);
}
// 读取文件和目录
async function readFileAndDir(obj) {
  const { type, name, path } = obj;
  const p = `${path}/${name}`;
  if (type == 'dir') {
    pageNo = 1;
    openDir(p, 1);
  } else if (type == 'file') {
    try {
      const res = await reqFileReadFile({ path: p });
      if (res.code == 0) {
        if (res.data.type == 'text') {
          openFile(res.data.data, p);
        } else if (res.data.type == 'other') {
          const fPath = getFilePath(`/file/${p}`);
          if (isImgFile(p)) {
            const list = $contentWrap.list.filter(
              (item) => item.type == 'file' && isImgFile(item.name)
            );
            const arr = list.map((item) => {
              const p = `${item.path}/${item.name}`;
              return {
                u1: getFilePath(`/file/${p}`),
                u2: getFilePath(`/file/${p}`, 1),
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
    reqFileReadDirSize({ path: p })
      .then((res) => {
        if (res.code == 0) {
          this.innerText = computeSize(res.data.size);
        }
      })
      .catch(() => {});
  })
  .on('click', '.name', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      showFileInfo(e, getFileItem(id));
    } else {
      readFileAndDir(getFileItem(id));
    }
  })
  .on('click', '.check_state', function (e) {
    e.stopPropagation();
    hdCheckItem(this);
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
    rightList(
      e,
      getFileItem(this.dataset.id),
      this.querySelector('.check_state')
    );
  });
longPress($contentWrap[0], '.file_item', function (e) {
  const ev = e.changedTouches[0];
  rightList(
    ev,
    getFileItem(this.dataset.id),
    this.querySelector('.check_state')
  );
});
// 操作菜单
function rightList(e, obj, el) {
  let data = [
    {
      id: 'share',
      text: '分享',
      beforeIcon: 'iconfont icon-fenxiang_2',
    },
  ];
  if (obj.type == 'file') {
    data.push({
      id: 'download',
      text: '下载',
      beforeIcon: 'iconfont icon-xiazai1',
    });
  }
  if ($footer.is(':hidden')) {
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
      text: '重命名',
      beforeIcon: 'iconfont icon-bianji',
    },
    {
      id: 'copy',
      text: '复制',
      beforeIcon: 'iconfont icon-fuzhi',
    },
    {
      id: 'cut',
      text: '剪切',
      beforeIcon: 'iconfont icon-jiandao',
    },
  ];
  if (getSuffix(obj.name)[1].toLowerCase() == 'zip') {
    data.push({
      id: 'decompress',
      text: '解压',
      beforeIcon: 'iconfont icon-yasuobao1',
    });
  } else {
    data.push({
      id: 'compress',
      text: '压缩',
      beforeIcon: 'iconfont icon-yasuobao1',
    });
  }
  data.push({
    id: 'info',
    text: '属性',
    beforeIcon: 'iconfont icon-about',
  });
  if (isRoot()) {
    data.push({
      id: 'mode',
      text: '权限',
      beforeIcon: 'iconfont icon-user_root',
    });
    data.push({
      id: 'fdel',
      text: '强制删除',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  data.push({
    id: 'del',
    text: '删除',
    beforeIcon: 'iconfont icon-shanchu',
  });
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close }) => {
      // 编辑列表
      if (id == 'download') {
        close();
        downloadFile(getFilePath(`/file/${obj.path}/${obj.name}`), obj.name);
      } else if (id == 'share') {
        hdShare(e, obj);
      } else if (id == 'rename') {
        hdRename(e, obj, () => {
          close();
        });
      } else if (id == 'copy') {
        waitObj = {
          type: 'copy',
          data: [obj],
        };
        realtime.send({ type: 'pastefiledata', data: waitObj });
        showPaste();
        close();
      } else if (id == 'del') {
        hdDel(e, [obj], () => {
          close();
        });
      } else if (id == 'fdel') {
        hdDel(
          e,
          [obj],
          () => {
            close();
          },
          'y'
        );
      } else if (id == 'cut') {
        waitObj = {
          type: 'cut',
          data: [obj],
        };
        realtime.send({ type: 'pastefiledata', data: waitObj });
        showPaste();
        close();
      } else if (id == 'compress') {
        hdCompress(e, obj, () => {
          close();
        });
      } else if (id == 'decompress') {
        hdDeCompress(e, obj, () => {
          close();
        });
      } else if (id == 'info') {
        showFileInfo(e, obj);
      } else if (id == 'check') {
        close();
        if (!isChecking) {
          startCheck();
          hdCheckItem(el);
        }
      } else if (id == 'mode') {
        editFileMode(e, obj);
      }
    },
    obj.name
  );
}
// 编辑权限
function editFileMode(e, obj) {
  rMenu.inpMenu(
    e,
    {
      items: {
        mode: {
          placeholder: '777',
          beforeText: '权限码：',
          value: obj.mode.split(' ')[1],
          inputType: 'number',
          verify(val) {
            if (!/^[0-7]{3}$/.test(val)) {
              return '请输入正确权限码';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const mode = inp.mode;
        if (obj.mode.split(' ')[1] === mode) return;
        reqFileMode({ data: obj, mode })
          .then((res) => {
            if (res.code == 0) {
              close(1);
              openDir();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '修改权限'
  );
}
// 分享
function hdShare(e, obj) {
  createShare(
    e,
    { name: obj.name, title: `分享${obj.type == 'file' ? '文件' : '文件夹'}` },
    ({ close, inp }) => {
      const { title, pass, valid } = inp;
      reqFileShare({ data: obj, title, pass, valid })
        .then((result) => {
          if (parseInt(result.code) === 0) {
            close(1);
            _myOpen(`/sharelist`, '分享列表');
          }
        })
        .catch(() => {});
    }
  );
}
// 粘贴文件
function pasteFile(e) {
  if (!editFileIsHiden() || waitObj.type) return;
  const files = [];
  const data = e.clipboardData || window.clipboardData;
  [...data.items].forEach((item) => {
    const blob = item.getAsFile();
    if (blob) {
      files.push(blob);
    }
  });
  if (files.length === 0) return;
  e.preventDefault();
  hdUp(files);
}
document.addEventListener('paste', pasteFile);
// 拖拽文件上传
~(function () {
  $contentWrap[0].addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  $contentWrap[0].addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  $contentWrap[0].addEventListener('drop', function (e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (files.length == 0) return;
    hdUp(files);
  });
})();
// 解压
async function hdDeCompress(e, obj, cb) {
  _pop(
    {
      e,
      text: `确认解压文件：${obj.name}？`,
    },
    async (type) => {
      if (type == 'confirm') {
        try {
          const res = await reqFileUnZip({ data: obj });
          if (res.code == 0) {
            _msg.success(res.codeText);
            openDir();
            cb && cb();
          }
        } catch (error) {
          if (error.statusText == 'timeout') {
            _msg.success(`文件后台处理中`);
          }
          openDir();
        }
      }
    }
  );
}
// 压缩
async function hdCompress(e, obj, cb) {
  _pop(
    {
      e,
      text: `确认压缩${obj.type == 'dir' ? '文件夹' : '文件'}：${obj.name}？`,
    },
    async (type) => {
      if (type == 'confirm') {
        try {
          const res = await reqFileZip({ data: obj });
          if (res.code == 0) {
            _msg.success(res.codeText);
            openDir();
            cb && cb();
          }
        } catch (error) {
          if (error.statusText == 'timeout') {
            _msg.success(`文件后台处理中`);
          }
          openDir();
        }
      }
    }
  );
}
// 选中
function hdCheckItem(el) {
  const $el = $(el);
  if ($el.attr('check') == 'y') {
    $el.css('background-color', 'transparent').attr('check', 'n');
  } else {
    $el.css('background-color', _d.checkColor).attr('check', 'y');
  }
  renderFoot();
}
if (isIframe()) {
  $header.find('.h_go_home').remove();
}
// 上传
async function hdUp(files) {
  maskLoading.start();
  let rep = true;
  let state = true;
  for (let i = 0; i < files.length; i++) {
    const { name, size, webkitRelativePath } = files[i];
    let path = fileUrl;
    if (webkitRelativePath) {
      path = `${path}/${webkitRelativePath}`;
    } else {
      path = `${path}/${name}`;
    }
    path = hdPath(path);
    const pro = new UpProgress(name);
    if (size == 0) {
      pro.fail();
      _msg.error(`不能上传空文件`);
      continue;
    }
    const res = await reqFileRepeat({ path });
    if (state) {
      if (res.code == 0) {
        state = false;
        const type = await _pop.p({
          top: true,
          text: '覆盖重名文件？',
          cancel: { text: '跳过' },
        });
        if (type == 'confirm') {
          rep = true;
        } else {
          rep = false;
        }
      }
    }
    if (!rep && res.code == 0) {
      pro.close('跳过重名文件');
      continue;
    }
    try {
      //文件切片
      const { chunks, count, HASH } = await fileSlice(files[i], (percent) => {
        pro.loading(percent);
      });
      const breakpointarr = (await reqFileBreakpoint({ HASH })).data; //断点续传

      function compale(index) {
        pro.update(index / count);
      }
      let index = breakpointarr.length;
      compale(index);
      for (let j = 0; j < chunks.length; j++) {
        let { filename, file } = chunks[j];
        if (breakpointarr.includes(filename)) {
          continue;
        }
        await reqFileUp({ name: filename, HASH }, file);
        index++;
        compale(index);
      }
      try {
        const mergeRes = await reqFileMerge({
          HASH,
          count,
          path,
        }); //合并切片
        if (parseInt(mergeRes.code) === 0) {
          pro.close();
        } else {
          pro.fail();
        }
      } catch (error) {
        if (error.statusText == 'timeout') {
          pro.close(`文件后台处理中`);
        } else {
          pro.fail();
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      pro.fail();
    }
  }
  maskLoading.end();
  realtime.send({ type: 'updatedata', data: { flag: 'file' } });
  openDir();
}
// 新建文件
function createFile(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: '文件名',
          verify(val) {
            if (val.trim() == '') {
              return '请输入名称';
            } else if (val.trim().length > 255) {
              return '名称过长';
            } else if (!isFilename(val.trim())) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    debounce(
      async function ({ close, inp }) {
        try {
          const name = hdFilename(inp.name);
          const res = await reqFileCreateFile({
            path: fileUrl,
            name,
          });
          if (res.code == 0) {
            _msg.success(res.codeText);
            openDir();
            openFile('', fileUrl + '/' + name);
            close(1);
          }
          // eslint-disable-next-line no-unused-vars
        } catch (error) {}
      },
      500,
      true
    ),
    '新建文本'
  );
}
// 创建目录
function createDir(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: '文件夹名',
          verify(val) {
            if (val.trim() == '') {
              return '请输入名称';
            } else if (val.trim().length > 255) {
              return '名称过长';
            } else if (!isFilename(val.trim())) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    debounce(
      async function ({ close, inp }) {
        try {
          const name = inp.name;
          const res = await reqFileCreateDir({
            path: fileUrl,
            name,
          });
          if (res.code == 0) {
            _msg.success(res.codeText);
            openDir();
            close(1);
          }
          // eslint-disable-next-line no-unused-vars
        } catch (error) {}
      },
      500,
      true
    ),
    '新建文件夹'
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
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_check_item_btn', function () {
    if ($footer.is(':hidden')) {
      startCheck();
    } else {
      closeCheck();
    }
  })
  .on('click', '.h_upload_btn', function (e) {
    let data = [
      { id: 1, text: '上传文件', beforeIcon: 'iconfont icon-24gl-fileText' },
      {
        id: 2,
        text: '上传文件夹',
        beforeIcon: 'iconfont icon-24gl-folder',
      },
    ];
    rMenu.selectMenu(
      e,
      data,
      async ({ close, id }) => {
        if (id == 1) {
          const files = await getFiles({
            multiple: true,
          });
          if (files.length == 0) return;
          hdUp(files);
          close();
        } else if (id == 2) {
          const files = await getFiles({
            webkitdirectory: true,
          });
          if (files.length == 0) return;
          hdUp(files);
          close();
        }
      },
      '上传选项'
    );
  })
  .on('click', '.h_add_item_btn', function (e) {
    let data = [
      { id: 1, text: '新建文本', beforeIcon: 'iconfont icon-24gl-fileText' },
      {
        id: 2,
        text: '新建文件夹',
        beforeIcon: 'iconfont icon-24gl-folder',
      },
    ];
    rMenu.selectMenu(
      e,
      data,
      async ({ e, id }) => {
        if (id == 1) {
          createFile(e);
        } else if (id == 2) {
          createDir(e);
        }
      },
      '新建选项'
    );
  })
  .on('click', '.h_sort_btn', hdFileSort)
  .on('click', '.paste_btn .text', function () {
    const { type, data } = waitObj;
    if (type == 'copy') {
      hdCopy(data);
    } else if (type == 'cut') {
      hdCut(data);
    }
  })
  .on('click', '.paste_btn .close', () => {
    waitObj = {};
    realtime.send({ type: 'pastefiledata', data: waitObj });
    hidePaste();
  })
  .on('mouseenter', '.paste_btn', function () {
    const { type, data } = waitObj;
    let str = `操作：${type === 'copy' ? '复制' : '剪切'}`;
    data.forEach((item) => {
      const { name, type, size } = item;
      str += `\n${type == 'file' ? '文件' : '目录'}：${name}${
        size ? ` (${computeSize(size)})` : ''
      }`;
    });
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.paste_btn', function () {
    toolTip.hide();
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
// 复制
async function hdCopy(data, cb) {
  try {
    if (
      !data.every((item) => {
        const { path, name } = item;
        const f = hdPath(`${path}/${name}`);
        const t = hdPath(`${fileUrl}/${name}`);
        return !isParentDir(f, t);
      })
    ) {
      _msg.error('无效操作');
      return;
    }
    const res = await reqFileCopy({ data, path: fileUrl });
    if (res.code == 0) {
      _msg.success(res.codeText);
      openDir();
      cb && cb();
    }
  } catch (error) {
    if (error.statusText == 'timeout') {
      _msg.success(`文件后台处理中`);
    }
    openDir();
  }
}
// 移动
async function hdCut(data, cb) {
  try {
    if (
      !data.every((item) => {
        const { path, name } = item;
        const f = hdPath(`${path}/${name}`);
        const t = hdPath(`${fileUrl}/${name}`);
        return f !== t && !isParentDir(f, t);
      })
    ) {
      _msg.error('无效操作');
      return;
    }
    const res = await reqFileMove({ data, path: fileUrl });
    if (res.code == 0) {
      _msg.success(res.codeText);
      openDir();
      waitObj = {};
      realtime.send({ type: 'pastefiledata', data: waitObj });
      hidePaste();
      cb && cb();
    }
  } catch (error) {
    if (error.statusText == 'timeout') {
      _msg.success(`文件后台处理中`);
    }
    openDir();
    waitObj = {};
    realtime.send({ type: 'pastefiledata', data: waitObj });
    hidePaste();
  }
}
// 获取选中
function getCheckItem() {
  const $cItem = $contentWrap.find('.file_item');
  return $cItem.filter(
    (_, item) => $(item).find('.check_state').attr('check') == 'y'
  );
}
function getCheckDatas() {
  let arr = [];
  getCheckItem().each((_, item) => {
    arr.push(getFileItem($(item).data('id')));
  });
  return arr;
}
// 开启选中
function startCheck() {
  isChecking = true;
  const $cItem = $contentWrap.find('.check_state');
  $cItem
    .css({
      display: 'block',
      'background-color': 'transparent',
    })
    .attr('check', 'n');
  renderFoot();
  $footer.stop().slideDown(_d.speed);
}
// 关闭选中
function closeCheck() {
  isChecking = false;
  const $cItem = $contentWrap.find('.check_state');
  $cItem.css('display', 'none');
  $footer.stop().slideUp(_d.speed);
}
// 更新底部菜单
function renderFoot() {
  const items = $contentWrap.find('.file_item');
  const checkData = getCheckDatas();
  const len = checkData.length;
  const html = _tpl(
    `
    <span cursor="y" :data-check="items.length == len ? 'y' : 'n'" class="iconfont {{items.length == len ? 'icon-xuanzeyixuanze' : 'icon-xuanzeweixuanze'}}"></span>
    <template v-if="len > 0">
      <button cursor="y" class="f_copy btn btn_primary">复制</button>
      <button cursor="y" class="f_cut btn btn_primary">剪切</button>
      <template v-if="len == 1">
        <button cursor="y" class="f_share btn btn_primary">分享</button>
        <button cursor="y" class="f_rename btn btn_primary">重命名</button>
        <button v-if="isZip()" cursor="y" class="f_decompress btn btn_primary">解压缩</button>
        <button v-else cursor="y" class="f_compress btn btn_primary">压缩</button>
      </template>
      <button v-if="checkIsFile()" cursor="y" class="f_download btn btn_primary">下载</button>
      <button v-if="isRoot()" cursor="y" class="f_fdelete btn btn_danger">强制删除</button>
      <button cursor="y" class="f_delete btn btn_danger">删除</button>
    </template>
    <button cursor="y" class="f_close btn btn_info">取消</button>
    `,
    {
      items,
      len,
      isZip() {
        return getSuffix(checkData[0].name)[1].toLowerCase() == 'zip';
      },
      checkIsFile() {
        return checkData.every((item) => item.type == 'file');
      },
      isRoot,
    }
  );
  if (!$footer.is(':hidden')) {
    _msg.botMsg(`选中：${len}项`);
  }
  $footer.find('.container').html(html);
}
function switchCheckAll(el) {
  const $this = $(el);
  const $items = $contentWrap.find('.file_item');
  if ($this.data('check') == 'y') {
    $items
      .find('.check_state')
      .css({
        'background-color': 'transparent',
      })
      .attr('check', 'n');
    renderFoot();
  } else {
    $items
      .find('.check_state')
      .css({
        'background-color': _d.checkColor,
      })
      .attr('check', 'y');
    renderFoot();
  }
}
$footer
  .on('click', 'span', function () {
    switchCheckAll(this);
  })
  .on('click', '.f_download', function () {
    getCheckDatas().forEach((item) => {
      const { name, path, type } = item;
      if (type == 'file') {
        downloadFile(getFilePath(`/file/${path}/${name}`), name);
      }
    });
  })
  .on('click', '.f_copy', function () {
    waitObj = {
      type: 'copy',
      data: getCheckDatas(),
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  })
  .on('click', '.f_cut', function () {
    waitObj = {
      type: 'cut',
      data: getCheckDatas(),
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  })
  .on('click', '.f_rename', function (e) {
    const obj = getCheckDatas()[0];
    hdRename(e, obj);
  })
  .on('click', '.f_close', function () {
    closeCheck();
  })
  .on('click', '.f_delete', function (e) {
    hdDel(e, getCheckDatas());
  })
  .on('click', '.f_fdelete', function (e) {
    hdDel(e, getCheckDatas(), null, 'y');
  })
  .on('click', '.f_compress', function (e) {
    hdCompress(e, getCheckDatas()[0]);
  })
  .on('click', '.f_decompress', function (e) {
    hdDeCompress(e, getCheckDatas()[0]);
  })
  .on('click', '.f_share', function (e) {
    hdShare(e, getCheckDatas()[0]);
  });
// 删除
function hdDel(e, arr, cb, force = 'n') {
  let text = '';
  if (arr.length == 1) {
    text = arr[0].name;
  }
  _pop(
    {
      e,
      text: `确认${force === 'n' ? '' : '强制'}删除：${text || '选中的文件'}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    async (type) => {
      if (type == 'confirm') {
        try {
          const res = await reqFileDelete({ data: arr, force });
          if (res.code == 0) {
            _msg.success(res.codeText);
            openDir();
            cb && cb();
          }
          // eslint-disable-next-line no-unused-vars
        } catch (error) {}
      }
    }
  );
}
// 重命名
function hdRename(e, obj, cb) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: `${obj.type == 'file' ? '文件名' : '文件夹名'}`,
          value: obj.name,
          verify(val) {
            if (val.trim() == '') {
              return '请输入名称';
            } else if (val.trim().length > 255) {
              return '名称过长';
            } else if (!isFilename(val.trim())) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    debounce(
      async function ({ close, inp }) {
        try {
          let name = inp.name;
          const res = await reqFileRename({ data: obj, name });
          if (res.code == 0) {
            openDir();
            close();
            cb && cb();
            _msg.success(res.codeText);
          }
          // eslint-disable-next-line no-unused-vars
        } catch (error) {}
      },
      500,
      true
    ),
    `重命名${obj.type == 'file' ? '文件' : '文件夹'}`
  );
}
// 显示/隐藏粘贴
function showPaste() {
  $header
    .find('.paste_btn')
    .html(
      _tpl(
        `<span cursor="y" class="text">粘贴({{waitObj.data.length}})</span><span cursor="y" class="close iconfont icon-guanbi"></span>`,
        { waitObj }
      )
    )
    .css('display', 'block');
}
function hidePaste() {
  $header.find('.paste_btn').css('display', 'none');
}
document.addEventListener('keydown', function (e) {
  if (!editFileIsHiden()) return;
  const key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  const isFocus = $('input').is(':focus') || $('textarea').is(':focus');
  if (isFocus) return;
  if (ctrl && key === 'a') {
    e.preventDefault();
    if (!isChecking) {
      startCheck();
    }
    switchCheckAll($footer.find('span')[0]);
  } else if (ctrl && key === 'v') {
    const { type, data } = waitObj;
    if (type == 'copy') {
      hdCopy(data);
    } else if (type == 'cut') {
      hdCut(data);
    }
  }
  const data = getCheckDatas();
  if (data.length === 0) return;
  if (ctrl && key === 'c') {
    waitObj = {
      type: 'copy',
      data,
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  } else if (ctrl && key === 'x') {
    waitObj = {
      type: 'cut',
      data,
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  }
});
