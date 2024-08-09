import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import {
  myOpen,
  formatDate,
  encodeHtml,
  pageErr,
  debounce,
  setPageScrollTop,
  isIframe,
  getScreenSize,
  isInteger,
  isRoot,
  isEmail,
  addCustomCode,
  _getData,
  _setData,
  wave,
  darkMode,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import pagination from '../../js/plugins/pagination';
import _d from '../../js/common/config';
import {
  reqRootAccountState,
  reqRootCleanBgFile,
  reqRootCleanChatFile,
  reqRootCleanDatabase,
  reqRootCleanLogoFile,
  reqRootCleanMusicFile,
  reqRootCleanPicFile,
  reqRootCleanThumbFile,
  reqRootCleanTrashFile,
  reqRootCustomCode,
  reqRootDeleteAccount,
  reqRootEmail,
  reqRootRegisterState,
  reqRootTestEmail,
  reqRootTestTfa,
  reqRootTrashState,
  reqRootUpdateTokenKey,
  reqRootUserList,
} from '../../api/root';
import rMenu from '../../js/plugins/rightMenu';
import { reqUserCustomCode } from '../../api/user';
import changeDark from '../../js/utils/changeDark';
const $contentWrap = $('.content_wrap'),
  $paginationBox = $('.pagination_box'),
  $headBtns = $contentWrap.find('.head_btns'),
  $tableBox = $contentWrap.find('.table_box'),
  $list = $tableBox.find('tbody');
let dataObj = {};
let pageNo = 1;
let userList = [];
let uPageSize = 10;
if (isRoot()) {
  getUserList(1);
} else {
  myOpen('/');
}
// 生成用户列表
function renderUserList(pageNo, total, top) {
  let str = '';
  userList.forEach((v) => {
    let { account, username, time, email, state, online, hide } = v;
    username = encodeHtml(username);
    str += `<tr data-acc="${account}">
    <td>${formatDate({
      template: '{0}-{1}-{2} {3}:{4}',
      timestamp: time,
    })}</td>
    <td style="color:${online === 'y' ? 'green' : 'var(--color4)'};">${
      online === 'y' ? (hide === 'y' ? '隐身' : '在线') : '离线'
    }</td>
    <td>${username}</td>
    <td>${email || '--'}</td>
    <td>${account}</td>
    <td style="${state == 0 ? '' : 'color:var(--btn-danger-color);'}">${
      state == 0 ? '启用' : '停用'
    }</td>
    <td style="${account === 'root' ? 'opacity: 0;pointer-events: none;' : ''}">
    <button cursor class="user_state btn btn_primary">${
      state == 0 ? '停用' : '启用'
    }</button><button cursor class="del_account btn btn_danger">删除</button>
        </td>
        </tr>`;
  });
  pgnt.render({
    pageNo,
    pageSize: uPageSize,
    total,
    small: getScreenSize().w <= _d.screen,
  });
  $list.html(str);
  if (top) {
    setPageScrollTop(0);
  }
}
// 分页
const pgnt = pagination($paginationBox[0], {
  select: [10, 20, 40, 60, 100],
  change(val) {
    pageNo = val;
    getUserList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  changeSize(val) {
    uPageSize = val;
    pageNo = 1;
    getUserList(1);
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  toTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  },
});
// 获取用户列表
function getUserList(top) {
  reqRootUserList({ pageNo, pageSize: uPageSize })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const { registerState, trashState, uploadSaveDay, data, total } =
          (dataObj = result.data);
        pageNo = result.data.pageNo;
        userList = data;
        $headBtns
          .find('.register_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              registerState === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
            }`
          );
        $headBtns
          .find('.trash_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              trashState === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
            }`
          );
        $headBtns
          .find('.upload_save_day')
          .text(
            `${
              uploadSaveDay <= 0
                ? '聊天室文件保存时间: 无限制'
                : `聊天室文件保存时间: ${uploadSaveDay}天`
            }`
          );
        renderUserList(pageNo, total, top);
        $headBtns.addClass('open');
        $tableBox.addClass('open');
        $paginationBox.addClass('open');
        return;
      }
      pageErr();
    })
    .catch(() => {});
}
// 获取用户信息
function getUserInfo(acc) {
  return userList.find((item) => item.account === acc);
}
// 修改用户状态
function changeUserState(e, obj) {
  const { state, account, username } = obj;
  _pop(
    {
      e,
      text: `确认${state == 0 ? '停用' : '启用'}：${username}(${account})？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootAccountState({
          acc: account,
          flag: state == '0' ? '1' : '0',
        })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              getUserList();
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 删除
function deleteAccount(e, obj) {
  const { username, account } = obj;
  _pop(
    {
      e,
      text: `确认删除：${username}(${account})？`,
      confirm: { type: 'danger', text: '删除' },
    },
    (type) => {
      if (type == 'confirm') {
        reqRootDeleteAccount({ acc: account })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              getUserList();
            }
          })
          .catch(() => {});
      }
    }
  );
}
$list
  .on('click', '.user_state', function (e) {
    const $this = $(this).parent().parent();
    const uInfo = getUserInfo($this.attr('data-acc'));
    changeUserState(e, uInfo);
  })
  .on('click', '.del_account', function (e) {
    const $this = $(this).parent().parent();
    const obj = getUserInfo($this.attr('data-acc'));
    deleteAccount(e, obj);
  });
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
// 清理歌曲文件
function cleanMusicFile(e) {
  _pop(
    {
      e,
      text: `确认清理：歌曲文件？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootCleanMusicFile()
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 清理壁纸文件
function cleanBgFile(e) {
  _pop(
    {
      e,
      text: `确认清理：壁纸文件？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootCleanBgFile()
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 清理logo文件
function cleanLogoFile(e) {
  _pop(
    {
      e,
      text: `确认清理：logo文件？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootCleanLogoFile()
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 清理图床文件
function cleanPicFile(e) {
  _pop(
    {
      e,
      text: `确认清理：图床文件？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootCleanPicFile()
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 清空回收站
function cleanTrashFile(e) {
  _pop(
    {
      e,
      text: `确认清空：回收站？`,
    },
    (type) => {
      if (type == 'confirm') {
        reqRootCleanTrashFile()
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 清理压缩图
function cleanThumbFile(e) {
  const data = [
    {
      id: 'all',
      text: '所有',
    },
    {
      id: 'pic',
      text: '图床',
    },
    {
      id: 'bg',
      text: '壁纸',
    },
    {
      id: 'music',
      text: '歌曲封面',
    },
    {
      id: 'upload',
      text: '聊天室',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close }) => {
      const obj = data.find((item) => item.id == id);
      if (obj) {
        _pop(
          {
            e,
            text: `确认清空：${obj.text} 缩略图？`,
          },
          (type) => {
            if (type == 'confirm') {
              reqRootCleanThumbFile({ type: id })
                .then((result) => {
                  if (parseInt(result.code) === 0) {
                    close();
                    _msg.success(result.codeText);
                    return;
                  }
                })
                .catch(() => {});
            }
          }
        );
      }
    },
    '选择要清空的类型'
  );
}
// 切换注册状态
function changeRegisterState() {
  reqRootRegisterState()
    .then((res) => {
      if (res.code == 0) {
        $headBtns
          .find('.register_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              res.data === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
            }`
          );
        _msg.success(res.data === 'y' ? '开放注册成功' : '已关闭注册');
      }
    })
    .catch(() => {});
}
// 切换回收站状态
function changeTrashState() {
  reqRootTrashState()
    .then((res) => {
      if (res.code == 0) {
        $headBtns
          .find('.trash_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              res.data === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
            }`
          );
        _msg.success(
          res.data === 'y' ? '开放文件回收站成功' : '已关闭文件回收站'
        );
      }
    })
    .catch(() => {});
}
// 修改聊天文件保存时间
function changeChatFileSaveTime(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          value: dataObj.uploadSaveDay,
          inputType: 'number',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0 || val > 999) {
              return '请输入1000内正整数';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const day = parseInt(inp.text);
        reqRootCleanChatFile({ day }).then((res) => {
          if (res.code == 0) {
            close();
            dataObj.uploadSaveDay = day;
            $headBtns
              .find('.upload_save_day')
              .text(
                `${
                  dataObj.uploadSaveDay <= 0
                    ? '聊天室文件保存时间: 无限制'
                    : `聊天室文件保存时间: ${dataObj.uploadSaveDay}天`
                }`
              );
            _msg.success(res.codeText);
          }
        });
      },
      1000,
      true
    ),
    '设置聊天室文件保存时间（天）'
  );
}
// 更新token Key
function updateTokenKey(e) {
  _pop({ e, text: `确认更新：tokenKey？` }, (type) => {
    if (type == 'confirm') {
      reqRootUpdateTokenKey().then((res) => {
        if (res.code == 0) {
          _msg.success(res.codeText);
        }
      });
    }
  });
}
// 清理数据库空间
function cleanDatabase(e) {
  _pop({ e, text: `确认释放：数据库空间？` }, (type) => {
    if (type == 'confirm') {
      reqRootCleanDatabase().then((res) => {
        if (res.code == 0) {
          _msg.success(res.codeText);
        }
      });
    }
  });
}
// 配置邮箱
function setEmail(e) {
  const {
    user = '',
    pass = '',
    host = 'smtp.qq.com',
    secure,
    port = '465',
    state,
  } = dataObj.email;
  const html = `
  <div class="email_info_box">
  <div>邮箱验证：<span cursor data-state="${
    state ? 'y' : 'n'
  }" class="email_state iconfont ${
    state ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
  }"></span></div>
  <div>使用tls加密：<span cursor data-state="${
    secure ? 'y' : 'n'
  }" class='secure_state iconfont ${
    secure ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
  }'></span><span style="color:var(--color5);padding-left: 5px;">开启时，建议端口设置为465</span></div>
  <div>SMTP服务地址：<input class="inp" autocomplete="off" placeholder="smtp.qq.com" value="${encodeHtml(
    host
  )}"></div>
  <div>端口：<input class="inp" type="number" autocomplete="off" placeholder="通常为587或465" value="${encodeHtml(
    port
  )}"></div>
  <div>发件人邮箱：<input class="inp" autocomplete="off" value="${encodeHtml(
    user
  )}"></div>
  <div>密码：<input class="inp" autocomplete="off" placeholder="邮箱密码或者专用密码" value="${encodeHtml(
    pass
  )}"></div>
  <button cursor class="btn btn_primary">提交</button>
  </div>
  `;
  let inputs = [],
    initInpValue = [],
    curInpValue = [];
  function getInpValue() {
    return [...inputs].map((item) => item.value.trim());
  }
  rMenu.rightM({
    e,
    title: '配置邮箱验证',
    html,
    afterRender() {
      inputs = this.content.querySelectorAll('input,textarea');
      if (inputs.length > 0) {
        inputs[0].select();
        inputs[0].focus();
      }
      initInpValue = getInpValue();
    },
    readyToCloseAll({ e, close }) {
      curInpValue = getInpValue();
      if (
        curInpValue.every((item) => item == '') ||
        initInpValue.toString() == curInpValue.toString()
      ) {
        return true;
      } else {
        _pop({ e, text: '关闭：输入框？' }, (type) => {
          if (type == 'confirm') {
            close(1);
          }
        });
        return false;
      }
    },
    click: debounce(
      function ({ e, close }) {
        const target = e.target;
        const emailState = this.content.querySelector('.email_state');
        const secureState = this.content.querySelector('.secure_state');
        const btn = this.content.querySelector('.btn');
        if (emailState === target) {
          let state = emailState.dataset.state === 'y' ? 'n' : 'y';
          emailState.dataset.state = state;
          emailState.className = `email_state iconfont ${
            state === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
          }`;
        } else if (secureState === target) {
          let state = secureState.dataset.state === 'y' ? 'n' : 'y';
          secureState.dataset.state = state;
          secureState.className = `secure_state iconfont ${
            state === 'y' ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
          }`;
        } else if (btn === target) {
          const state = emailState.dataset.state;
          const secure = secureState.dataset.state;
          const inps = this.content.querySelectorAll('.inp');
          const host = inps[0].value.trim();
          const port = parseInt(inps[1].value.trim());
          const user = inps[2].value.trim();
          const pass = inps[3].value.trim();
          if (state === 'y') {
            if (host.length === 0) {
              _msg.error('请输入SMTP服务器地址');
              return;
            } else if (isNaN(port) || port < 0) {
              _msg.error('端口格式错误');
              return;
            } else if (!isEmail(user)) {
              _msg.error('发件人邮箱格式错误');
              return;
            }
          }
          const obj = {
            state,
            secure,
            host,
            port: port || 465,
            user,
            pass,
          };
          reqRootEmail(obj).then((res) => {
            if (res.code == 0) {
              close();
              dataObj.email = obj;
              dataObj.email.state = state === 'y' ? true : false;
              dataObj.email.secure = secure === 'y' ? true : false;
              _msg.success(res.codeText);
            }
          });
        }
      },
      1000,
      true
    ),
    keyup({ e }) {
      const tag = e.target.tagName.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        (tag === 'input' && e.key === 'Enter') ||
        (tag === 'textarea' && ctrl && e.key === 'Enter')
      ) {
        e.preventDefault();
        this.rightMask.querySelector('button').click();
      }
    },
  });
}
// 自定义代码
_d.isRootPage = true;
let customCode = { js: '', css: '' };
reqUserCustomCode()
  .then((res) => {
    if (res.code == 0) {
      customCode = res.data;
      addCustomCode(customCode);
    }
  })
  .catch(() => {});
function customCssJs(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        js: {
          beforeText: 'js代码：',
          value: customCode.js,
          type: 'textarea',
        },
        css: {
          beforeText: 'css代码：',
          value: customCode.css,
          type: 'textarea',
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const { js, css } = inp;
        if (js === customCode.js && css === customCode.css) return;
        reqRootCustomCode({ js, css })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close(true);
              _msg.success(result.codeText);
              customCode = { js, css };
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '自定义css/js'
  );
}
// 测试
function testEmail(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '发送',
      items: {
        email: {
          beforeText: '收件人邮箱：',
          value: _getData('testEmail') || '',
          verify(val) {
            val = val.trim();
            if (!isEmail(val)) {
              return '邮箱格式错误';
            }
          },
        },
      },
    },
    debounce(
      ({ inp }) => {
        _setData('testEmail', inp.email);
        reqRootTestEmail({ email: inp.email })
          .then((res) => {
            if (res.code == 0) {
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '发送测试邮件'
  );
}
function testTFA(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        token: {
          beforeText: '验证码：',
          inputType: 'number',
          value: _getData('testCode') || '',
          verify(val) {
            val = val.trim();
            if (val == '') {
              return '请输入验证码';
            } else if (val.length !== 6 || !isInteger(+val) || val < 0) {
              return '请输入6位正整数';
            }
          },
        },
      },
    },
    debounce(
      ({ inp }) => {
        _setData('testCode', inp.token);
        reqRootTestTfa({ token: inp.token })
          .then((res) => {
            if (res.code == 0) {
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '测试两步验证'
  );
}
function handleTest(e) {
  const data = [
    { id: 'email', text: '发送测试邮件', beforeIcon: 'iconfont icon-youxiang' },
    {
      id: 'tfa',
      text: '测试两步验证',
      beforeIcon: 'iconfont icon-shoujiyanzheng',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'email') {
        testEmail(e);
      } else if (id === 'tfa') {
        testTFA(e);
      }
    },
    '测试'
  );
}
$headBtns
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.del_music_file', cleanMusicFile)
  .on('click', '.del_bg_file', cleanBgFile)
  .on('click', '.del_logo_file', cleanLogoFile)
  .on('click', '.del_pic_file', cleanPicFile)
  .on('click', '.clear_trash', cleanTrashFile)
  .on('click', '.clear_thumb', cleanThumbFile)
  .on('click', '.register_state', changeRegisterState)
  .on('click', '.trash_state', changeTrashState)
  .on('click', '.upload_save_day', changeChatFileSaveTime)
  .on('click', '.set_token_key', updateTokenKey)
  .on('click', '.email_btn', setEmail)
  .on('click', '.custom_btn', customCssJs)
  .on('click', '.test_btn', handleTest)
  .on('click', '.clean_database', cleanDatabase);
if (!isIframe()) wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
