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
  _myOpen,
  getTextSize,
  isurl,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import pagination from '../../js/plugins/pagination';
import _d from '../../js/common/config';
import {
  reqRootAccountState,
  reqRootChangeCacheTime,
  reqRootCleanBgFile,
  reqRootCleanDatabase,
  reqRootCleanLogoFile,
  reqRootCleanMusicFile,
  reqRootCleanPicFile,
  reqRootCleanThumbFile,
  reqRootCreateAccount,
  reqRootCustomCode,
  reqRootDeleteAccount,
  reqRootEmail,
  reqRootFaviconSpareApi,
  reqRootPubApiState,
  reqRootRegisterState,
  reqRootTestEmail,
  reqRootTestTfa,
  reqRootTrashState,
  reqRootUpdateTokenKey,
  reqRootUserList,
} from '../../api/root';
import rMenu from '../../js/plugins/rightMenu';
import { reqUserCustomCode } from '../../api/user';
import toolTip from '../../js/plugins/tooltip';
import { _tpl } from '../../js/utils/template';
import md5 from '../../js/utils/md5.js';
import realtime from '../../js/plugins/realtime/index.js';
import { otherWindowMsg } from '../home/home.js';
import localData from '../../js/common/localData.js';

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
if (!isIframe()) {
  realtime.init().add((res) => {
    res.forEach((item) => {
      otherWindowMsg(item);
    });
  });
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
        const { registerState, data, total } = (dataObj = result.data);
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
  return userList.find((item) => item.account === acc) || {};
}
// 修改用户状态
function changeUserState(e, obj) {
  const { state, account, username } = obj;
  rMenu.pop(
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
  rMenu.pop(
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
  rMenu.pop(
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
  rMenu.pop(
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
  rMenu.pop(
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
  rMenu.pop(
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
        rMenu.pop(
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
        _myOpen(`/file#/${_d.trashDirName}`, '文件管理');
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
// 更新token Key
function updateTokenKey(e) {
  rMenu.pop({ e, text: `确认更新：tokenKey？` }, (type) => {
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
  rMenu.pop({ e, text: `确认释放：数据库空间？` }, (type) => {
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
              } else if (val.length > _d.fieldLength.email) {
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
              } else if (val.length > _d.fieldLength.email) {
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
    function ({ inp, close, loading, isDiff }) {
      if (!isDiff()) return;
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
let customCode = { body: '', head: '' };
reqUserCustomCode()
  .then((res) => {
    if (res.code === 1) {
      customCode = res.data;
      addCustomCode(customCode);
    }
  })
  .catch(() => {});
function customHtmlCode(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        head: {
          beforeText: 'head代码：',
          value: customCode.head,
          type: 'textarea',
          trimValue: false,
          verify(val) {
            if (getTextSize(val) > _d.fieldLength.customCodeSize) {
              return '代码过长';
            }
          },
        },
        body: {
          beforeText: 'body代码：',
          value: customCode.body,
          type: 'textarea',
          trimValue: false,
          verify(val) {
            if (getTextSize(val) > _d.fieldLength.customCodeSize) {
              return '代码过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      const { body, head } = inp;
      loading.start();
      reqRootCustomCode({ body, head })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            customCode = { body, head };
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '自定义代码'
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
          value: localData.get('testEmail') || '',
          verify(val) {
            if (!isEmail(val)) {
              return '邮箱格式错误';
            } else if (val.length > _d.fieldLength.email) {
              return '邮箱过长';
            }
          },
        },
      },
    },
    ({ inp, loading }) => {
      localData.set('testEmail', inp.email);
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
          value: localData.get('testCode') || '',
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
      localData.set('testCode', inp.token);
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

// 文件缓存时间
function handleFileCacheExp(e) {
  const { uploadSaveDay, faviconCache, siteInfoCache } = dataObj.cacheExp;
  function verify(val) {
    val = parseFloat(val);
    if (!isInteger(val) || val < 0 || val > _d.fieldLength.expTime) {
      return `限制0-${_d.fieldLength.expTime}`;
    }
  }
  const placeholder = '0: 无限制';
  const inputType = 'number';
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        uploadSaveDay: {
          beforeText: '聊天室文件保存时间：',
          value: uploadSaveDay,
          placeholder,
          inputType,
          verify,
        },
        faviconCache: {
          beforeText: '网站图标保存时间：',
          value: faviconCache,
          placeholder,
          inputType,
          verify,
        },
        siteInfoCache: {
          beforeText: '网站信息保存时间：',
          value: siteInfoCache,
          placeholder,
          inputType,
          verify,
        },
      },
    },
    ({ close, inp, loading, isDiff }) => {
      if (!isDiff()) return;
      loading.start();
      reqRootChangeCacheTime(inp)
        .then((res) => {
          if (res.code === 1) {
            loading.end();
            close();
            dataObj.cacheExp = res.data;
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '设置文件缓存时间（天）'
  );
}

// 公开接口状态
function handlePubApi(e) {
  const data = [
    {
      id: 'faviconSpareApi',
      text: '图标备用api接口',
      beforeIcon: 'iconfont icon-shezhi',
    },
    { id: 'info', text: '接口信息', beforeIcon: 'iconfont icon-about' },
    {
      id: 'state',
      text: '接口状态',
      beforeIcon: 'iconfont icon-bangzhu',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ id, e }) => {
      if (id === 'info') {
        const pre = _d.originURL;
        rMenu.rightInfo(
          e,
          `壁纸：\n  大屏：${pre}/api/bg/r/big\n  小屏：${pre}/api/bg/r/small\n\n获取网站图标：${pre}/api/getfavicon?u=${pre}\n\n获取网站信息：${pre}/api/bmk/parse-site-info?u=${pre}`,
          '接口信息'
        );
      } else if (id === 'state') {
        const { randomBgApi, siteInfoApi, faviconApi } = dataObj.pubApi;
        const type = 'select';
        rMenu.inpMenu(
          e,
          {
            subText: '提交',
            items: {
              randomBgApi: {
                beforeText: '壁纸接口：',
                type,
                value: randomBgApi ? 'y' : 'n',
                selectItem: [
                  { value: 'y', text: '开启' },
                  { value: 'n', text: '关闭' },
                ],
              },
              faviconApi: {
                beforeText: '获取网站图标接口：',
                type,
                value: faviconApi ? 'y' : 'n',
                selectItem: [
                  { value: 'y', text: '开启' },
                  { value: 'n', text: '关闭' },
                ],
              },
              siteInfoApi: {
                beforeText: '获取网站信息接口：',
                type,
                value: siteInfoApi ? 'y' : 'n',
                selectItem: [
                  { value: 'y', text: '开启' },
                  { value: 'n', text: '关闭' },
                ],
              },
            },
          },
          function ({ inp, close, loading, isDiff }) {
            if (!isDiff()) return;
            const { randomBgApi, siteInfoApi, faviconApi } = inp;

            const obj = {
              randomBgApi: randomBgApi === 'y' ? 1 : 0,
              siteInfoApi: siteInfoApi === 'y' ? 1 : 0,
              faviconApi: faviconApi === 'y' ? 1 : 0,
            };
            loading.start();
            reqRootPubApiState(obj)
              .then((res) => {
                if (res.code === 1) {
                  loading.end();
                  close();
                  dataObj.pubApi = res.data;
                  _msg.success(res.codeText);
                }
              })
              .catch(() => {
                loading.end();
              });
          },
          '更改接口状态'
        );
      } else if (id === 'faviconSpareApi') {
        rMenu.inpMenu(
          e,
          {
            subText: '提交',
            items: {
              link: {
                type: 'textarea',
                beforeText: 'host 变量会替换为目标站点host地址',
                value: dataObj.faviconSpareApi,
                placeholder: 'https://www.xxx.com?url={{host}}',
                verify(val) {
                  if (val !== '') {
                    if (!isurl(val)) {
                      return '请输入正确的接口地址';
                    } else if (val.length > _d.fieldLength.url) {
                      return `接口地址过长`;
                    }
                  }
                },
              },
            },
          },
          function ({ inp, close, loading, isDiff }) {
            if (!isDiff()) return;
            const { link } = inp;
            loading.start();
            reqRootFaviconSpareApi({ link })
              .then((res) => {
                if (res.code === 1) {
                  loading.end();
                  close();
                  dataObj.faviconSpareApi = link;
                  _msg.success(res.codeText);
                }
              })
              .catch(() => {
                loading.end();
              });
          },
          '设置图标备用api接口'
        );
      }
    },
    '公开接口配置'
  );
}
$headBtns
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.register_state', changeRegisterState)
  .on('click', '.trash_state', changeTrashState)
  .on('click', '.clear_file', handleClearFile)
  .on('click', '.file_cache_exp', handleFileCacheExp)
  .on('click', '.pub_api', handlePubApi)
  .on('click', '.set_token_key', updateTokenKey)
  .on('click', '.email_btn', setEmail)
  .on('click', '.custom_btn', customHtmlCode)
  .on('click', '.test_btn', handleTest)
  .on('click', '.clean_database', cleanDatabase);

// 创建帐号
$('.create_account').on('click', (e) => {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        username: {
          beforeText: '用户名：',
          value: '',
          verify(val) {
            if (val.length < 1 || val.length > 20) {
              return '请输入1-20位用户名';
            }
          },
        },
        password: {
          beforeText: '密码：',
          inputType: 'password',
          value: '',
        },
        repassword: {
          beforeText: '确认密码：',
          inputType: 'password',
          value: '',
        },
      },
    },
    ({ inp, close, loading }) => {
      const { username, password, repassword } = inp;
      if (password !== repassword) {
        _msg.error('密码不一致');
        return;
      }
      loading.start();
      reqRootCreateAccount({ username, password: md5.getStringHash(password) })
        .then((res) => {
          if (res.code === 1) {
            loading.end();
            close();
            _msg.success(res.codeText);
            getUserList();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '创建帐号'
  );
});
