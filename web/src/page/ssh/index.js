import $ from 'jquery';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import '../../js/common/common.js';
import realtime from '../../js/plugins/realtime/index.js';
import { otherWindowMsg } from '../home/home.js';
import {
  reqSSHAddQuick,
  reqSSHAddQuickGroup,
  reqSSHConnect,
  reqSSHDeleteQuick,
  reqSSHDeleteQuickGroup,
  reqSSHEditQuick,
  reqSSHEditQuickGroup,
  reqSSHMoveQuick,
  reqSSHMoveQuickGroup,
  reqSSHMoveToGroup,
  reqSSHQuickList,
} from '../../api/ssh.js';
import {
  _getTarget,
  _setTimeout,
  debounce,
  getTextSize,
  isDarkMode,
  isIframe,
  myOpen,
  pageErr,
  queryURLParams,
} from '../../js/utils/utils.js';
import localData from '../../js/common/localData.js';
import { _tpl } from '../../js/utils/template.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import _d from '../../js/common/config.js';
import _msg from '../../js/plugins/message/index.js';
import { MouseElementTracker } from '../../js/utils/boxSelector.js';
import toolTip from '../../js/plugins/tooltip/index.js';
const $app = $('#app'),
  $sshBox = $app.find('.ssh_box'),
  $logText = $app.find('.log_text'),
  $footer = $('.footer'),
  $shortcuts = $footer.find('.shortcuts'),
  $quickGroup = $footer.find('.quick_group'),
  $quickCommands = $footer.find('.quick_commands');
const urlParams = queryURLParams(myOpen());
const { HASH, p = '' } = urlParams;
if (!HASH) {
  pageErr();
}
// xterm.js
// 现代深色主题 (类似 VS Code Default Dark+)
const darkTheme = {
  background: '#0f0f0f',
  foreground: '#d4d4d4',
  cursor: '#ffffff',
  selectionBackground: '#3a3d41',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
};

// 现代浅色主题 (类似 GitHub Light)
const lightTheme = {
  background: '#ffffff',
  foreground: '#24292e',
  cursor: '#888888',
  selectionBackground: '#c8e1ff',
  black: '#24292e',
  red: '#d73a49',
  green: '#28a745',
  yellow: '#dbab09',
  blue: '#0366d6',
  magenta: '#5a32a3',
  cyan: '#0598bc',
  white: '#6a737d',
};

const term = new Terminal({
  fontFamily: _d.codeFontFamily,
  allowProposedApi: true, // 是否允许使用实验性 API
  disableStdin: false, // 是否禁用输入
  fontSize: 14,
  cursorBlink: true, // 光标是否闪烁
  cursorStyle: 'block', // block | bar | underline 光标样式
  scrollOnUserInput: true, // 输入时是否自动滚动到底部
  scrollback: 5000, // 回滚行数
});
// 加载插件
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
const webLinks = new WebLinksAddon();
term.loadAddon(webLinks);

term.open(document.getElementById('terminal'));
// 更新终端大小
const updateTermSize = debounce(() => {
  fitAddon.fit();
  realtime.send({ type: 'ssh', data: { type: 'size', cols: term.cols, rows: term.rows } });
}, 500);
window.addEventListener('resize', () => {
  updateTermSize();
});
function getAllText(term) {
  const buffer = term.buffer.active;
  let result = '';

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    result += line.translateToString(true) + '\n';
  }

  return result;
}
reqSSHConnect({ id: HASH, defaultPath: p })
  .then((res) => {
    if (res.code === 1) {
      const { title, host, port, username } = res.data;
      const data = `${title}：${username}@${host}:${port}`;
      _setTimeout(() => {
        if (isIframe()) {
          try {
            // 更新标题
            window.parent.openInIframe.iframes.get(window.iframeId).updateTitle(data);
          } catch {}
        }
      }, 1000);
      document.title = data;
    }
  })
  .catch(() => {});
let sizeFlag = false;
realtime.init().add((res) => {
  res.forEach((item) => {
    const { type, data } = item;
    if (type === 'ssh') {
      if (!sizeFlag) {
        sizeFlag = true;
        updateTermSize();
      }
      term.write(data);
    } else if (type === 'updatedata' && data.flag === 'quickCommand') {
      renderList();
    }
    otherWindowMsg(item);
  });
});

term.onData((d) => handleTermInput(d));
function sendSSH(text, enter = false) {
  if (!text) return;
  if (enter) text += '\r';
  realtime.send({ type: 'ssh', data: { type: 'cmd', text } });
}
// 黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    term.options.theme = darkTheme;
  } else if (dark === 'n') {
    term.options.theme = lightTheme;
  } else if (dark === 's') {
    if (isDarkMode()) {
      term.options.theme = darkTheme;
    } else {
      term.options.theme = lightTheme;
    }
  }
}
window.changeTheme = changeTheme;
changeTheme(localData.get('dark'));
function setSSHSize() {
  term.options.fontSize = localData.get('htmlFontSize') * 1.4;
  updateTermSize();
}
setSSHSize();
localData.onChange(({ key }) => {
  if (!key || key === 'htmlFontSize') {
    setSSHSize();
  }
});
let curQuickGroupId = 'default';
let curQuickGroupList = [];
function getCurQuickGroup(id) {
  return curQuickGroupList.find((item) => item.id === id);
}
function getCommandInfo(gid, id) {
  return getCurQuickGroup(gid)?.commands.find((item) => item.id === id);
}
function renderQuickGroup() {
  const html = _tpl(
    `
    <div cursor="y" v-for="{id,title} in curQuickGroupList" :data-id=id class="quick_item {{curQuickGroupId === id ? 'active' : ''}}">
      <span class="title">{{title}}</span>
      <span class="set iconfont icon-maohao"></span>
    </div>
    <div class="add iconfont icon-tianjia" cursor="y"></div>
    `,
    {
      curQuickGroupList,
      curQuickGroupId,
    },
  );
  $quickGroup.html(html);
}
function renderCommand() {
  const html = _tpl(
    `
    <div cursor="y" v-for="{id,title} in list" :data-id=id class="command_item">
      <span class="icon iconfont icon-terminal"></span>
      <span class="title">{{title}}</span>
      <span class="close iconfont icon-shibai"></span>
    </div>
    <div class="add iconfont icon-tianjia" cursor="y"></div>
    `,
    {
      list: getCurQuickGroup(curQuickGroupId)?.commands || [],
    },
  );
  $quickCommands.html(html);
}
async function renderList() {
  try {
    const res = await reqSSHQuickList();
    if (res.code === 1) {
      curQuickGroupList = res.data;
      curQuickGroupId = getCurQuickGroup(curQuickGroupId)?.id || 'default';
      renderQuickGroup();
      renderCommand();
      $app.addClass('open');
    }
  } catch {}
}
renderList();

$quickGroup
  .on('click', '.add', addGroup)
  .on('click', '.title', (e) => {
    curQuickGroupId = e.target.parentNode.dataset.id;
    renderList();
  })
  .on('click', '.set', (e) => {
    hdGroupMenu(e, getCurQuickGroup(e.target.parentNode.dataset.id));
  });
function hdGroupMenu(e, obj) {
  const data = [{ id: 'edit', text: '编辑', beforeIcon: 'iconfont icon-bianji' }];
  if (obj.id !== 'default') {
    data.push({
      id: 'delete',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === 'edit') {
        hdGroupEdit(e, obj);
      } else if (id === 'delete') {
        hdGroupDelete(
          e,
          obj,
          () => {
            close();
          },
          loading,
        );
      }
    },
    obj.title,
  );
}
function hdGroupDelete(e, obj, cb, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${obj.title}？`,
      confirm: { text: '删除', type: 'danger' },
    },
    (t) => {
      if (t === 'confirm') {
        loading.start();
        reqSSHDeleteQuickGroup({ id: obj.id })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              cb && cb();
              renderList(1);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
  );
}
function hdGroupEdit(e, obj) {
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
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqSSHEditQuickGroup({ ...inp, id: obj.id })
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
    '编辑分组',
  );
}
let mouseGroupFromDom = null;
const groupMouseElementTracker = new MouseElementTracker($quickGroup[0], {
  delay: 300,
  onStart({ e }) {
    const item = _getTarget($quickGroup[0], e, '.quick_item');
    if (!item) return true;
    mouseGroupFromDom = item;
    const obj = getCurQuickGroup(item.dataset.id);
    if (obj.id === 'default') return true;
    groupMouseElementTracker.changeInfo(obj.title);
  },
  onEnd({ dropElement }) {
    if (mouseGroupFromDom) {
      const to = dropElement
        ? _getTarget($quickGroup[0], { target: dropElement }, '.quick_item')
        : null;
      if (to) {
        const toId = to.dataset.id;
        const fromId = mouseGroupFromDom.dataset.id;
        if (fromId !== toId && fromId !== 'default' && toId !== 'default') {
          moveGroup(fromId, toId);
        }
      }
    }
    mouseGroupFromDom = null;
  },
});
function moveGroup(fromId, toId) {
  reqSSHMoveQuickGroup({ fromId, toId })
    .then((res) => {
      if (res.code === 1) {
        renderList();
      }
    })
    .catch(() => {});
}

function addGroup(e) {
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
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqSSHAddQuickGroup(inp)
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
    '添加分组',
  );
}

$quickCommands
  .on('click', '.add', addCommand)
  .on('click', '.title', (e) => {
    const obj = getCommandInfo(curQuickGroupId, e.target.parentNode.dataset.id);
    sendSSH(obj.command, !!obj.enter);
    term.focus();
  })
  .on('click', '.icon', (e) => {
    hdComandMenu(e, getCommandInfo(curQuickGroupId, e.target.parentNode.dataset.id));
  })
  .on('mouseenter', '.icon', (e) => {
    const { command, enter } = getCommandInfo(curQuickGroupId, e.target.parentNode.dataset.id);
    const str = `命令：${command}\n自动执行：${enter ? '是' : '否'}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.icon', function () {
    toolTip.hide();
  })
  .on('click', '.close', (e) => {
    hdCommandDelete(e, getCommandInfo(curQuickGroupId, e.target.parentNode.dataset.id));
  });
function addCommand(e) {
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
        enter: {
          beforeText: '自动执行：',
          type: 'select',
          value: '0',
          selectItem: [
            { value: '1', text: '是' },
            { value: '0', text: '否' },
          ],
        },
        command: {
          beforeText: '命令：',
          value: '',
          type: 'textarea',
          verify(val) {
            return (
              rMenu.validString(val, 1) ||
              (getTextSize(val) > _d.fieldLength.customCodeSize ? '命令过长' : '')
            );
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqSSHAddQuick({ ...inp, id: curQuickGroupId })
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
    '添加快捷命令',
  );
}
function hdComandMenu(e, obj) {
  const data = [
    { id: 'edit', text: '编辑', beforeIcon: 'iconfont icon-bianji' },
    { id: 'move', text: '移动到', beforeIcon: 'iconfont icon-moveto' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'edit') {
        hdComandEdit(e, obj);
      } else if (id === 'move') {
        moveToGroup(e, obj);
      }
    },
    obj.title,
  );
}
function moveToGroup(e, obj) {
  let data = [];
  curQuickGroupList.forEach((item) => {
    if (item.id !== curQuickGroupId) {
      data.push({
        id: item.id,
        text: item.title,
        beforeIcon: 'iconfont icon-liebiao1',
        param: { id: item.id },
      });
    }
  });
  if (data.length === 0) {
    _msg.error('没有可移动的分组');
    return;
  }
  rMenu.selectMenu(
    e,
    data,
    ({ close, id, param, loading }) => {
      if (id) {
        const groupId = param.id;
        loading.start();
        reqSSHMoveToGroup({
          id: obj.id,
          fromId: curQuickGroupId,
          toId: groupId,
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
    },
    '移动命令到分组',
  );
}
function hdCommandDelete(e, obj) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${obj.title}？`,
      confirm: { text: '删除', type: 'danger' },
    },
    (t) => {
      if (t === 'confirm') {
        reqSSHDeleteQuick({ id: obj.id, groupId: curQuickGroupId })
          .then((res) => {
            if (res.code === 1) {
              renderList(1);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      }
    },
  );
}
function hdComandEdit(e, obj) {
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
        enter: {
          beforeText: '自动执行：',
          type: 'select',
          value: obj.enter + '',
          selectItem: [
            { value: '1', text: '是' },
            { value: '0', text: '否' },
          ],
        },
        command: {
          beforeText: '命令：',
          value: obj.command,
          type: 'textarea',
          verify(val) {
            return (
              rMenu.validString(val, 1) ||
              (getTextSize(val) > _d.fieldLength.customCodeSize ? '命令过长' : '')
            );
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      loading.start();
      reqSSHEditQuick({ ...inp, groupId: curQuickGroupId, id: obj.id })
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
    '编辑快捷命令',
  );
}
let mouseQuickFromDom = null;
const quickMouseElementTracker = new MouseElementTracker($footer[0], {
  delay: 300,
  onStart({ e }) {
    const item = _getTarget($footer[0], e, '.command_item');
    if (!item) return true;
    mouseQuickFromDom = item;
    const obj = getCommandInfo(curQuickGroupId, item.dataset.id);
    quickMouseElementTracker.changeInfo(obj.title);
  },
  onEnd({ dropElement }) {
    if (mouseQuickFromDom) {
      if (dropElement) {
        const to =
          _getTarget($footer[0], { target: dropElement }, '.command_item') ||
          _getTarget($footer[0], { target: dropElement }, '.quick_item');
        if (to) {
          const isToCommand = to.className.includes('command_item');
          const fromId = mouseQuickFromDom.dataset.id;
          const toId = to.dataset.id;
          if (isToCommand) {
            if (fromId !== toId) {
              moveQuickCommand(fromId, toId);
            }
          } else {
            if (curQuickGroupId !== toId) {
              reqSSHMoveToGroup({
                id: fromId,
                fromId: curQuickGroupId,
                toId,
              })
                .then((result) => {
                  if (result.code === 1) {
                    _msg.success(result.codeText);
                    renderList();
                  }
                })
                .catch(() => {});
            }
          }
        }
      }
    }
    mouseQuickFromDom = null;
  },
});
function moveQuickCommand(fromId, toId) {
  reqSSHMoveQuick({ groupId: curQuickGroupId, fromId, toId })
    .then((res) => {
      if (res.code === 1) {
        renderList();
      }
    })
    .catch(() => {});
}

let ctrlActive = false;
let altActive = false;

const classToKey = {
  esc: 'Escape',
  tab: 'Tab',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const keyMap = {
  Enter: '\r',
  Tab: '\t',
  Escape: '\x1b',
  Backspace: '\x08',

  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  ArrowLeft: '\x1b[D',
  ArrowRight: '\x1b[C',
};

function resetCtrlAlt() {
  ctrlActive = false;
  $shortcuts.find('.ctrl').removeClass('active');
  altActive = false;
  $shortcuts.find('.alt').removeClass('active');
}

$shortcuts.on('click', '.esc,.tab,.up,.down,.left,.right', function () {
  for (const cls of this.classList) {
    const key = classToKey[cls];
    if (!key) continue;

    const out = keyMap[key] || key;

    if (out) sendSSH(out);
    break; // 找到第一个匹配的 class 就处理
  }
  term.focus();
});

$shortcuts.on('click', '.ctrl', function () {
  ctrlActive = !ctrlActive;
  altActive = false;
  $(this).toggleClass('active', ctrlActive);
  $shortcuts.find('.alt').removeClass('active');
  if (ctrlActive) term.focus();
});

$shortcuts.on('click', '.alt', function () {
  altActive = !altActive;
  ctrlActive = false;
  $(this).toggleClass('active', altActive);
  $shortcuts.find('.ctrl').removeClass('active');
  if (altActive) term.focus();
});

// 处理 term 输入 + Ctrl/Alt
function handleTermInput(text) {
  if (!text) return;

  let out = text;

  // Ctrl 单字符
  if (ctrlActive && text.length === 1) {
    out = String.fromCharCode(text.toUpperCase().charCodeAt(0) - 64);
    resetCtrlAlt();
  }
  // Alt 单字符
  else if (altActive && text.length === 1) {
    out = '\x1b' + text;
    resetCtrlAlt();
  }

  sendSSH(out);
}

let isFullHeight = false;
let isFullWidth = false;
$sshBox
  .on('click', '.btns .full_height', function () {
    if (!isFullHeight) {
      $app.addClass('full_height');
      this.className = 'iconfont icon-shang full_height';
    } else {
      $app.removeClass('full_height');
      this.className = 'iconfont icon-xiala full_height';
    }
    isFullHeight = !isFullHeight;
    updateTermSize();
  })
  .on('click', '.btns .full_width', function () {
    if (!isFullWidth) {
      $app.addClass('full_width');
      this.className = 'iconfont icon-zuoyoushousuo full_width';
    } else {
      $app.removeClass('full_width');
      this.className = 'iconfont icon-kuandukuoda full_width';
    }
    isFullWidth = !isFullWidth;
    updateTermSize();
  })
  .on('click', '.btns .log_btn', function () {
    if ($logText.css('display') === 'none') {
      this.className = 'iconfont icon-terminal log_btn';
      $logText.show();
      $logText.text(getAllText(term)).scrollTop($logText[0].scrollHeight);
    } else {
      $logText.hide();
      this.className = 'iconfont icon-fuzhi log_btn';
      $logText.text('');
    }
  });
document.addEventListener('click', function (e) {
  if (
    $logText.css('display') === 'none' ||
    e.target === $logText[0] ||
    _getTarget($sshBox[0], e, '.btns')
  )
    return;
  $logText.hide();
  $sshBox.find('.btns .log_btn').removeClass('icon-terminal').addClass('icon-fuzhi');
});
