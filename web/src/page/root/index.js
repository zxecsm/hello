import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import {
  myOpen,
  formatDate,
  pageErr,
  pageScrollTop,
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
  _myOpen,
  getTextSize,
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
  reqRootCleanFavicon,
  reqRootCleanLogoFile,
  reqRootCleanMusicFile,
  reqRootCleanPicFile,
  reqRootCleanSiteInfo,
  reqRootCleanThumbFile,
  reqRootCustomCode,
  reqRootDeleteAccount,
  reqRootEmail,
  reqRootRandomBgState,
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
import toolTip from '../../js/plugins/tooltip';
import { _tpl } from '../../js/utils/template';
const $contentWrap = $('.content_wrap'),
  $paginationBox = $('.pagination_box'),
  $headBtns = $contentWrap.find('.head_btns'),
  $tableBox = $contentWrap.find('.table_box'),
  $list = $tableBox.find('tbody');
let dataObj = {};
let pageNo = 1;
let userList = [];
let uPageSize = 10;
const closeIcon = 'iconfont icon-kaiguan-guan',
  openIcon = 'iconfont icon-kaiguan-kai1';
if (isRoot()) {
  getUserList(1);
} else {
  myOpen('/');
}
// 生成用户列表
function renderUserList(pageNo, total, top) {
  const html = _tpl(
    `
    <tr v-for="{account,username,update_at,email,state,online,hide} in userList" :data-acc="account">
      <td>{{formatDate({template: '{0}-{1}-{2} {3}:{4}',timestamp: update_at})}}</td>
      <td class="online_status" :cursor="online === 1 ? 'y' : ''" style="color:{{online === 1 ? 'green' : 'var(--color6)'}};">{{online === 1 ? (hide === 1 ? '隐身' : '在线') : '离线'}}</td>
      <td>{{username}}</td>
      <td>{{email || '--'}}</td>
      <td>{{account}}</td>
      <td style="color:{{state === 1 ? 'green' : 'var(--btn-danger-color)'}};">{{state === 1 ? '启用' : '停用'}}</td>
      <td :style="account === 'root' ? 'opacity: 0;pointer-events: none;' : ''">
        <button cursor="y" class="user_state btn btn_primary">{{state === 1 ? '停用' : '启用'}}</button>
        <button cursor="y" class="del_account btn btn_danger">删除</button>
      </td>
    </tr>
    `,
    {
      userList,
      formatDate,
    }
  );
  pgnt.render({
    pageNo,
    pageSize: uPageSize,
    total,
    small: getScreenSize().w <= _d.screen,
  });
  $list.html(html);
  if (top) {
    pageScrollTop(0);
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
    pageScrollTop(0);
  },
});
// 获取用户列表
function getUserList(top) {
  reqRootUserList({ pageNo, pageSize: uPageSize })
    .then((result) => {
      if (result.code === 1) {
        const {
          registerState,
          uploadSaveDay,
          faviconCache,
          siteInfoCache,
          data,
          total,
        } = (dataObj = result.data);
        pageNo = result.data.pageNo;
        userList = data;
        $headBtns
          .find('.register_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              registerState ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
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
        $headBtns
          .find('.favicon_save_day')
          .text(
            `${
              faviconCache <= 0
                ? '网址图标缓存时间: 无限制'
                : `网址图标缓存时间: ${faviconCache}天`
            }`
          );
        $headBtns
          .find('.site_info_save_day')
          .text(
            `${
              siteInfoCache <= 0
                ? '网址描述缓存时间: 无限制'
                : `网址描述缓存时间: ${siteInfoCache}天`
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
      text: `确认${state === 1 ? '停用' : '启用'}：${username}(${account})？`,
    },
    (type) => {
      if (type === 'confirm') {
        reqRootAccountState({
          account,
          state: state === 1 ? 0 : 1,
        })
          .then((result) => {
            if (result.code === 1) {
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
      if (type === 'confirm') {
        reqRootDeleteAccount({ account })
          .then((result) => {
            if (result.code === 1) {
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
  })
  .on('mouseenter', '.online_status', function () {
    const { os, online } = getUserInfo($(this).parent().attr('data-acc'));
    if (online === 0) return;
    const str = `登录设备：\n${os.join('\n')}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.online_status', function () {
    toolTip.hide();
  })
  .on('click', '.online_status', function (e) {
    const { os, online } = getUserInfo($(this).parent().attr('data-acc'));
    if (online === 0) return;
    const str = os.join('\n');
    rMenu.rightInfo(e, str, '登录设备');
  });
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
// 清理歌曲文件
function cleanMusicFile(e, loading = { start() {}, end() {} }) {
  _pop(
    {
      e,
      text: `确认清理：歌曲文件？`,
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqRootCleanMusicFile()
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
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
// 清理壁纸文件
function cleanBgFile(e, loading = { start() {}, end() {} }) {
  _pop(
    {
      e,
      text: `确认清理：壁纸文件？`,
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqRootCleanBgFile()
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
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
// 清理logo文件
function cleanLogoFile(e, loading = { start() {}, end() {} }) {
  _pop(
    {
      e,
      text: `确认清理：logo文件？`,
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqRootCleanLogoFile()
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
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
// 清理图床文件
function cleanPicFile(e, loading = { start() {}, end() {} }) {
  _pop(
    {
      e,
      text: `确认清理：图床文件？`,
    },
    (type) => {
      if (type === 'confirm') {
        loading.start();
        reqRootCleanPicFile()
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              _msg.success(result.codeText);
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
// 清理缩略图
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
    {
      id: 'file',
      text: '文件管理',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close, loading }) => {
      const obj = data.find((item) => item.id === id);
      if (obj) {
        _pop(
          {
            e,
            text: `确认清空：${obj.text} 缩略图？`,
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqRootCleanThumbFile({ type: id })
                .then((result) => {
                  loading.end();
                  if (result.code === 1) {
                    close();
                    _msg.success(result.codeText);
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
    '选择要清空缩略图的类型'
  );
}
// 切换注册状态
function changeRegisterState() {
  reqRootRegisterState()
    .then((res) => {
      if (res.code === 1) {
        $headBtns
          .find('.register_state span')
          .attr(
            'class',
            `iconfont iconfont ${
              res.data ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'
            }`
          );
        _msg.success(res.data ? '开放注册成功' : '已关闭注册');
      }
    })
    .catch(() => {});
}
// 切换回收站状态
function changeTrashState(e) {
  const data = [
    {
      id: 'toTrash',
      text: '查看回收站',
      beforeIcon: 'iconfont icon-link1',
    },
    {
      id: 'state',
      text: '回收站状态',
      beforeIcon: 'iconfont icon-huishouzhan',
      afterIcon: dataObj.trashState ? openIcon : closeIcon,
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ id, resetMenu, close, loading }) => {
      if (id === 'toTrash') {
        _myOpen(`/file/#/.trash`, '文件管理');
        close();
      } else if (id === 'state') {
        loading.start();
        reqRootTrashState()
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              dataObj.trashState = res.data;
              data[1].afterIcon = dataObj.trashState ? openIcon : closeIcon;
              resetMenu(data);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
    '站点文件回收站（删除的壁纸音乐..）'
  );
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
          placeholder: '0: 无限制',
          inputType: 'number',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0 || val > _d.fieldLenght.expTime) {
              return `限制0-${_d.fieldLenght.expTime}`;
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const day = parseInt(inp.text);
      loading.start();
      reqRootCleanChatFile({ day })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
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
        })
        .catch(() => {
          loading.end();
        });
    },
    '设置聊天室文件保存时间（天）'
  );
}
// 修改favicon缓存时间
function changeFaviconSaveTime(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          value: dataObj.faviconCache,
          placeholder: '0: 无限制',
          inputType: 'number',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0 || val > _d.fieldLenght.expTime) {
              return `限制0-${_d.fieldLenght.expTime}`;
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const day = parseInt(inp.text);
      loading.start();
      reqRootCleanFavicon({ day })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close();
            dataObj.faviconCache = day;
            $headBtns
              .find('.favicon_save_day')
              .text(
                `${
                  dataObj.faviconCache <= 0
                    ? '网址图标缓存时间: 无限制'
                    : `网址图标缓存时间: ${dataObj.faviconCache}天`
                }`
              );
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '设置网址图标缓存时间（天）'
  );
}
// 修改siteInfo缓存时间
function changeSiteInfoSaveTime(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          value: dataObj.siteInfoCache,
          placeholder: '0: 无限制',
          inputType: 'number',
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0 || val > _d.fieldLenght.expTime) {
              return `限制0-${_d.fieldLenght.expTime}`;
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const day = parseInt(inp.text);
      loading.start();
      reqRootCleanSiteInfo({ day })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close();
            dataObj.siteInfoCache = day;
            $headBtns
              .find('.site_info_save_day')
              .text(
                `${
                  dataObj.siteInfoCache <= 0
                    ? '网址描述缓存时间: 无限制'
                    : `网址描述缓存时间: ${dataObj.siteInfoCache}天`
                }`
              );
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '设置网址描述缓存时间（天）'
  );
}
// 更新token Key
function updateTokenKey(e) {
  _pop({ e, text: `确认更新：tokenKey？` }, (type) => {
    if (type === 'confirm') {
      reqRootUpdateTokenKey().then((res) => {
        if (res.code === 1) {
          _msg.success(res.codeText);
        }
      });
    }
  });
}
// 清理数据库空间
function cleanDatabase(e) {
  _pop({ e, text: `确认释放：数据库空间？` }, (type) => {
    if (type === 'confirm') {
      reqRootCleanDatabase().then((res) => {
        if (res.code === 1) {
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
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        state: {
          beforeText: '邮箱验证状态：',
          type: 'select',
          value: state ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        secure: {
          beforeText: '使用tls加密：开启时，建议端口设置为465',
          type: 'select',
          value: secure ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        host: {
          value: host,
          beforeText: 'SMTP服务地址：',
          placeholder: 'smtp.qq.com',
          verify(val, items) {
            if (items.state.value === 'y') {
              if (val === '') {
                return '请输入SMTP服务器地址';
              } else if (val.length > _d.fieldLenght.email) {
                return 'host过长';
              }
            }
          },
        },
        port: {
          value: port,
          beforeText: '端口：',
          placeholder: '通常为587或465',
          verify(val, items) {
            if (items.state.value === 'y') {
              val = parseInt(val);
              if (isNaN(val) || val < 0 || val > 65535) {
                return '端口格式错误';
              }
            }
          },
        },
        user: {
          value: user,
          beforeText: '发件人邮箱：',
          verify(val, items) {
            if (items.state.value === 'y') {
              if (!isEmail(val)) {
                return '发件人邮箱格式错误';
              } else if (val.length > _d.fieldLenght.email) {
                return '邮箱过长';
              }
            }
          },
        },
        pass: {
          value: pass,
          beforeText: '密码：',
          inputType: 'password',
          placeholder: '邮箱密码或者专用密码',
        },
      },
    },
    function ({ inp, close, loading }) {
      const obj = {
        state: inp.state === 'y' ? 1 : 0,
        secure: inp.secure === 'y' ? 1 : 0,
        host: inp.host,
        port: inp.port || 465,
        user: inp.user,
        pass: inp.pass,
      };
      loading.start();
      reqRootEmail(obj)
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close();
            dataObj.email = obj;
            dataObj.email.state = obj.state === 1 ? true : false;
            dataObj.email.secure = obj.secure === 1 ? true : false;
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '配置邮箱验证'
  );
}
// 自定义代码
_d.isRootPage = true;
let customCode = { js: '', css: '' };
reqUserCustomCode()
  .then((res) => {
    if (res.code === 1) {
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
          trimValue: false,
          verify(val) {
            if (getTextSize(val) > _d.fieldLenght.customCodeSize) {
              return '代码过长';
            }
          },
        },
        css: {
          beforeText: 'css代码：',
          value: customCode.css,
          type: 'textarea',
          trimValue: false,
          verify(val) {
            if (getTextSize(val) > _d.fieldLenght.customCodeSize) {
              return '代码过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const { js, css } = inp;
      if (js === customCode.js && css === customCode.css) return;
      loading.start();
      reqRootCustomCode({ js, css })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            customCode = { js, css };
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '自定义css/js'
  );
}
// 测试邮箱验证
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
            if (!isEmail(val)) {
              return '邮箱格式错误';
            } else if (val.length > _d.fieldLenght.email) {
              return '邮箱过长';
            }
          },
        },
      },
    },
    ({ inp, loading }) => {
      _setData('testEmail', inp.email);
      loading.start();
      reqRootTestEmail({ email: inp.email })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '发送测试邮件'
  );
}
// 测试两步验证
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
            if (val === '') {
              return '请输入验证码';
            } else if (val.length !== 6 || !isInteger(+val) || val < 0) {
              return '请输入6位正整数';
            }
          },
        },
      },
    },
    ({ inp, loading }) => {
      _setData('testCode', inp.token);
      loading.start();
      reqRootTestTfa({ token: inp.token })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '测试两步验证'
  );
}
// 测试验证
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
// 随机壁纸
function handleRandomBg(e) {
  const data = [
    { id: 'info', text: '接口信息', beforeIcon: 'iconfont icon-about' },
    {
      id: 'state',
      text: '接口状态',
      beforeIcon: 'iconfont icon-tupian',
      afterIcon: dataObj.randomBgApi ? openIcon : closeIcon,
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ id, resetMenu, e, loading }) => {
      if (id === 'info') {
        const pre = window.location.origin;
        rMenu.rightInfo(
          e,
          `大屏：${pre}/api/bg/r/big\n小屏：${pre}/api/bg/r/small`,
          '接口信息'
        );
      } else if (id === 'state') {
        loading.start();
        reqRootRandomBgState()
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              dataObj.randomBgApi = res.data;
              data[1].afterIcon = dataObj.randomBgApi ? openIcon : closeIcon;
              resetMenu(data);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
    '随机壁纸接口'
  );
}
// 清理文件
function handleClearFile(e) {
  const data = [
    {
      id: 'thumb',
      text: '清空缩略图',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: 'bg',
      text: '清理壁纸文件',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: 'pic',
      text: '清理图床文件',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: 'logo',
      text: '清理logo文件',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: 'song',
      text: '清理歌曲文件',
      beforeIcon: 'iconfont icon-yinle1',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ id, e, loading }) => {
      if (id === 'thumb') {
        cleanThumbFile(e);
      } else if (id === 'bg') {
        cleanBgFile(e, loading);
      } else if (id === 'pic') {
        cleanPicFile(e, loading);
      } else if (id === 'logo') {
        cleanLogoFile(e, loading);
      } else if (id === 'song') {
        cleanMusicFile(e, loading);
      }
    },
    '清理文件'
  );
}
$headBtns
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.register_state', changeRegisterState)
  .on('click', '.trash_state', changeTrashState)
  .on('click', '.clear_file', handleClearFile)
  .on('click', '.upload_save_day', changeChatFileSaveTime)
  .on('click', '.favicon_save_day', changeFaviconSaveTime)
  .on('click', '.site_info_save_day', changeSiteInfoSaveTime)
  .on('click', '.set_token_key', updateTokenKey)
  .on('click', '.email_btn', setEmail)
  .on('click', '.custom_btn', customCssJs)
  .on('click', '.test_btn', handleTest)
  .on('click', '.random_bg_btn', handleRandomBg)
  .on('click', '.clean_database', cleanDatabase);
if (!isIframe()) wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
