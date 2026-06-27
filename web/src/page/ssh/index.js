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
  reqSSHGetHistoryCommands,
  reqSSHHistoryCommands,
  reqSSHMoveQuick,
  reqSSHMoveQuickGroup,
  reqSSHMoveToGroup,
  reqSSHQuickList,
  reqSSHSftpList,
  reqSSHSftpUp,
} from '../../api/ssh.js';
import {
  _getTarget,
  _myOpen,
  _setTimeout,
  concurrencyTasks,
  debounce,
  downloadFiles,
  getFiles,
  isDarkMode,
  isIframe,
  isMobile,
  longPress,
  myOpen,
  pageErr,
  queryURLParams,
  toggleUserSelect,
  wrapInput,
} from '../../js/utils/utils.js';
import localData from '../../js/common/localData.js';
import { _tpl } from '../../js/utils/template.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import _d from '../../js/common/config.js';
import _msg from '../../js/plugins/message/index.js';
import { MouseElementTracker } from '../../js/utils/boxSelector.js';
import toolTip from '../../js/plugins/tooltip/index.js';
import _path from '../../js/utils/path.js';
import { UpProgress } from '../../js/plugins/UpProgress/index.js';
const $app = $('#app'),
  $sshBox = $app.find('.ssh_box'),
  $logText = $sshBox.find('.log_text'),
  $footer = $app.find('.footer'),
  $resize = $footer.find('.resize'),
  $shortcuts = $footer.find('.shortcuts'),
  $quickGroup = $footer.find('.quick_group'),
  $quickCommands = $footer.find('.quick_commands');
const urlParams = queryURLParams(myOpen());
const { HASH, p = '' } = urlParams;
const sshInfo = localData.get('sshInfo');
if (!HASH) {
  pageErr();
}
let historyCommands = [];
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
  cursorBlink: false, // 光标是否闪烁
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
function updateHistoryCommands() {
  reqSSHGetHistoryCommands()
    .then((res) => {
      if (res.code === 1) {
        historyCommands = res.data;
      }
    })
    .catch(() => {});
}
updateHistoryCommands();
function saveCommandHistory(command) {
  if (!command) return;
  reqSSHHistoryCommands({ command })
    .then(() => {
      updateHistoryCommands();
    })
    .catch(() => {});
}
const wInput = wrapInput($sshBox.find('.t_menu .inp_box input')[0], {
  update(val) {
    if (val === '') {
      $sshBox.find('.t_menu .inp_box .clear').css('display', 'none');
    } else {
      $sshBox.find('.t_menu .inp_box .clear').css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
  },
  blur(e) {
    $(e.target).parent().removeClass('focus');
  },
  keyup(e) {
    const key = e.key.toLowerCase();
    if (key === 'enter') {
      const command = wInput.getValue();
      saveCommandHistory(command);
      sendSSH(command, 1);
      wInput.setValue('').focus();
    } else if (['arrowdown', 'arrowup'].includes(key)) {
      let command = '';
      if (historyCommands.length === 0) return;

      let idx = historyCommands.findIndex((item) => item === wInput.getValue());

      if (key === 'arrowup') {
        if (--idx < 0) {
          command = historyCommands[historyCommands.length - 1];
        } else {
          command = historyCommands[idx];
        }
      } else if (key === 'arrowdown') {
        if (++idx >= historyCommands.length) {
          command = historyCommands[0];
        } else {
          command = historyCommands[idx];
        }
      }

      wInput.setValue(command);
    }
  },
});
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
    } else if (type === 'updatedata') {
      if (data.flag === 'quickCommand') {
        renderList();
      } else if (data.flag === 'historyCommands') {
        updateHistoryCommands();
      }
    }
    otherWindowMsg(item);
  });
});

term.onData((d) => handleTermInput(d));
function sendSSH(text, enter = false) {
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
function commandRightMenu(e) {
  const data = [
    {
      id: 'add',
      text: '添加命令',
      beforeIcon: 'iconfont icon-tianjia',
    },
    {
      id: 'manage',
      text: '管理命令',
      beforeIcon: 'iconfont icon-shezhi',
    },
  ];
  rMenu.selectMenu(e, data, ({ e, close, id }) => {
    if (id === 'add') {
      addCommand(e);
    } else if (id === 'manage') {
      close();
      _myOpen(`/file#${_d.sshConfigDir}`, '文件管理', 'file');
    }
  });
}
longPress($quickCommands[0], function (e) {
  if (e.target !== $quickCommands[0]) return;
  commandRightMenu(e.changedTouches[0]);
});
$quickCommands
  .on('contextmenu', function (e) {
    if (e.target !== $quickCommands[0] || isMobile()) return;
    e.preventDefault();
    commandRightMenu(e);
  })
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
            return rMenu.validString(val, 1, _d.fieldLength.sshQuickLength);
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
            return rMenu.validString(val, 1, _d.fieldLength.sshQuickLength);
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
const quickMouseElementTracker = new MouseElementTracker(
  $footer[0],
  {
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
  },
  $quickCommands[0],
);
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
let scrollTimer = null;

const handleAction = (element) => {
  for (const cls of element.classList) {
    const key = classToKey[cls];
    if (!key) continue;

    const out = keyMap[key] || key;

    if (out) sendSSH(out);
    break; // 找到第一个匹配的 class 就处理
  }
  term.focus();
};

const stopAction = () => {
  if (scrollTimer) {
    clearInterval(scrollTimer);
    scrollTimer = null;
  }
};
const continuousKeys = ['.up', '.down', '.left', '.right'];
$shortcuts
  .on('click', `.esc,.tab,${continuousKeys.join(',')}`, function () {
    handleAction(this);
  })
  .on('touchend touchcancel', continuousKeys.join(','), function () {
    stopAction();
  });
continuousKeys.forEach((key) => {
  longPress($shortcuts[0], key, function () {
    scrollTimer = setInterval(() => {
      handleAction(this);
    }, 50);
  });
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
function updateFullHeightState(state) {
  const fullHeight = $sshBox.find('.t_menu .full_height')[0];
  if (state) {
    $app.addClass('full_height');
    fullHeight.className = 'btn btn_info iconfont icon-shang full_height';
  } else {
    $app.removeClass('full_height');
    fullHeight.className = 'btn btn_info iconfont icon-xiala full_height';
  }
}
updateFullHeightState(sshInfo.isFullHeight);
function updateFullWidthState(state) {
  const fullWidth = $sshBox.find('.t_menu .full_width')[0];
  if (state) {
    $app.addClass('full_width');
    fullWidth.className = 'btn btn_info iconfont icon-zuoyoushousuo full_width';
  } else {
    $app.removeClass('full_width');
    fullWidth.className = 'btn btn_info iconfont icon-kuandukuoda full_width';
  }
}
async function hdUp(files, path) {
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  }, files.length);
  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name } = file;
    const pro = upPro.add(name);

    try {
      const result = await reqSSHSftpUp(
        { path, name },
        file,
        (percent) => {
          pro.update(percent);
        },
        signal,
      );
      if (result.code === 1) {
        pro.close();
      } else {
        pro.fail();
        _msg.error(`上传失败：${name}`, null, { reside: true });
      }
    } catch {
      pro.fail();
      _msg.error(`上传失败：${name}`, null, { reside: true });
    }
  });
}
updateFullWidthState(sshInfo.isFullWidth);
function selectDir(e, path = '/', loading) {
  loading && loading.start();
  reqSSHSftpList({ path })
    .then((res) => {
      loading && loading.end();
      if (res.code === 1) {
        const list = res.data;
        if (list.length === 0) return _msg.error(`${path} 为空目录`);
        rMenu.selectMenu(
          e,
          list.map((item, i) => {
            const { type, name } = item;
            return {
              id: `${i + 1}`,
              text: name,
              beforeIcon: type === 'dir' ? 'iconfont icon-gl-folder' : 'iconfont icon-gl-fileText',
              afterIcon: type === 'dir' ? 'iconfont icon-upload' : '',
              param: { value: item },
            };
          }),
          ({ e, id, box, close, loading, param }) => {
            if (!box || !id) return;
            const icon = _getTarget(box, e, '.item .icon-upload');
            const { name } = param.value;
            const tPath = _path.normalizeNoSlash(path, name);
            if (icon) {
              getFiles({ multiple: true })
                .then((files) => {
                  if (files.length === 0) return;
                  close(1);
                  hdUp(files, tPath);
                })
                .catch(() => {});
            } else {
              if (param.value.type === 'dir') {
                selectDir(e, tPath, loading);
              } else {
                downloadFiles([
                  {
                    fileUrl: `${_d.apiPath}/ssh/sftp-down?path=${decodeURIComponent(tPath)}&id=${_d.temid}`,
                    filename: name,
                  },
                ]);
              }
            }
          },
          path,
        );
      }
    })
    .catch(() => {
      loading && loading.end();
    });
}
$sshBox
  .on('click', '.t_menu .full_height', function () {
    sshInfo.isFullHeight = !sshInfo.isFullHeight;
    localData.set('sshInfo', sshInfo);
    updateFullHeightState(sshInfo.isFullHeight);
    updateTermSize();
  })
  .on('click', '.t_menu .full_width', function () {
    sshInfo.isFullWidth = !sshInfo.isFullWidth;
    localData.set('sshInfo', sshInfo);
    updateFullWidthState(sshInfo.isFullWidth);
    updateTermSize();
  })
  .on('click', '.t_menu .file_transfer_btn', selectDir)
  .on('click', '.t_menu .send_btn', function () {
    const command = wInput.getValue();
    saveCommandHistory(command);
    sendSSH(command, 1);
    wInput.setValue('').focus();
  })
  .on('click', '.t_menu .clear', function () {
    wInput.setValue('').focus();
  })
  .on('click', '.t_menu .history_btn', function (e) {
    if (historyCommands.length === 0) return;
    const data = historyCommands.map((item, idx) => ({
      id: idx + 1 + '',
      text: item,
      beforeIcon: 'iconfont icon-history',
      param: { value: item },
    }));
    rMenu.selectMenu(
      e,
      data.reverse(),
      ({ close, id, param }) => {
        if (id) {
          wInput.setValue(param.value).focus();
          close();
        }
      },
      '历史命令',
    );
  })
  .on('click', '.t_menu .log_btn', function () {
    if ($logText.css('display') === 'none') {
      this.className = 'btn btn_info iconfont icon-terminal log_btn';
      $logText.show();
      $logText.text(getAllText(term)).scrollTop($logText[0].scrollHeight);
    } else {
      $logText.hide();
      this.className = 'btn btn_info iconfont icon-fuzhi log_btn';
      $logText.text('');
    }
  });
document.addEventListener('click', function (e) {
  if (
    $logText.css('display') === 'none' ||
    e.target === $logText[0] ||
    _getTarget($sshBox[0], e, '.t_menu .log_btn')
  )
    return;
  $logText.hide();
  $sshBox.find('.t_menu .log_btn').removeClass('icon-terminal').addClass('icon-fuzhi');
});
~(function () {
  function updateHeigth(footerPercent) {
    $footer.css({
      height: footerPercent + '%',
    });
    $sshBox.css({
      height: 100 - footerPercent + '%',
    });
  }
  updateHeigth(sshInfo.footerPercent);
  let sshH, footH, y;
  function hdDown(e) {
    toggleUserSelect(false);
    sshH = $sshBox[0].offsetHeight;
    footH = $footer[0].offsetHeight;
    if (e.type === 'touchstart') {
      y = e.touches[0].clientY;
    } else if (e.type === 'mousedown') {
      y = e.clientY;
    }
    this.addEventListener('touchmove', hdMove);
    document.addEventListener('mousemove', hdMove);
    this.addEventListener('touchend', hdUp);
    document.addEventListener('mouseup', hdUp);
  }
  function hdMove(e) {
    e.preventDefault();
    let yy;
    if (e.type === 'touchmove') {
      yy = e.touches[0].clientY;
    } else if (e.type === 'mousemove') {
      yy = e.clientY;
    }
    const diff = yy - y;
    y = yy;
    footH -= diff;
    sshH += diff;
    if (footH > 100 && sshH > 100) {
      $footer.css({
        height: footH + 'px',
      });
      $sshBox.css({
        height: sshH + 'px',
      });
    }
  }
  function hdUp() {
    const sH = $sshBox[0].offsetHeight;
    const fH = $footer[0].offsetHeight;
    sshInfo.footerPercent = (fH / (sH + fH)) * 100;
    localData.set('sshInfo', sshInfo);
    updateHeigth(sshInfo.footerPercent);
    toggleUserSelect();
    updateTermSize();
    this.removeEventListener('touchmove', hdMove);
    document.removeEventListener('mousemove', hdMove);
    this.removeEventListener('touchend', hdUp);
    document.removeEventListener('mouseup', hdUp);
  }
  $resize[0].addEventListener('mousedown', hdDown);
  $resize[0].addEventListener('touchstart', hdDown);
})();
