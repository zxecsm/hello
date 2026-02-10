import $ from 'jquery';
import QRCode from 'qrcode';
import {
  myOpen,
  _setTimeout,
  throttle,
  _getTarget,
  imgjz,
  mixedSort,
  _mySlide,
  isImgFile,
  toLogin,
  toCenter,
  showQcode,
  upStr,
  getbookmark,
  downloadText,
  getTextImg,
  getFiles,
  myDrag,
  isMobile,
  longPress,
  copyText,
  myToRest,
  getCenterPointDistance,
  isRoot,
  parseObjectJson,
  encodeHtml,
  getScreenSize,
  formatBytes,
  _animate,
  getDarkIcon,
  savePopLocationInfo,
  getFilePath,
  parseArrayJson,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import {
  reqUerChangename,
  reqUserDeleteAccount,
  reqUserBindEmail,
  reqUserBindEmailCode,
  reqUserChangPd,
  reqUserDailyChangeBg,
  reqUserDeleteLogo,
  reqUserFontList,
  reqUserGetVerify,
  reqUserHideState,
  reqUserLogout,
  reqUserTips,
  reqUserUpLogo,
  reqUserVerify,
  reqUserRemoteLoginState,
} from '../../../api/user.js';
import { reqBmkExport, reqBmkImport } from '../../../api/bmk.js';
import { setTodoUndone, showTodoBox } from '../todo/index.js';
import { showBgBox } from '../bg/index.js';
import {
  changeLogoAlertStatus,
  closeAllwindow,
  hideAllwindow,
  resizeBgFilter,
  setUserInfo,
  updateUserInfo,
} from '../index.js';
import { showMusicPlayerBox } from '../player/index.js';
import { popWindow, setZidx } from '../popWindow.js';
import { reqRootSysStatus, reqRootTips } from '../../../api/root.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { setExpireCount, showCountBox } from '../count_down/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import { reqChatForwardMsgLink } from '../../../api/chat.js';
import { CircularProgressBar } from '../../../js/plugins/percentBar/index.js';
import md5 from '../../../js/utils/md5.js';
import { _tpl } from '../../../js/utils/template.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
import localData from '../../../js/common/localData.js';
// local数据
let tipsFlag = 0;
const $rightMenuMask = $('.right_menu_mask'),
  $rightBox = $rightMenuMask.find('.right_box'),
  $userInfoWrap = $('.user_info_wrap'),
  $sysInfoWrap = $('.sys_info_wrap'),
  sysInfoSize = localData.get('sysInfoSize'),
  userInfoSize = localData.get('userInfoSize');
// 隐藏菜单
$rightMenuMask.on('click', function (e) {
  if (_getTarget(this, e, '.right_menu_mask', 1)) {
    hideRightMenu();
  }
});
function setTop(el, isTop) {
  if (isTop) {
    el.find('.top').attr('class', 'top iconfont icon-zhiding1 window_head');
  } else {
    el.find('.top').attr('class', 'top iconfont icon-zhiding window_head');
  }
}
let sysInfoIsTop = localData.get('sysInfoIsTop'),
  userInfoIsTop = localData.get('userInfoIsTop');
function switchSysInfoTopState() {
  sysInfoIsTop = !sysInfoIsTop;
  setTop($sysInfoWrap, sysInfoIsTop);
  localData.set('sysInfoIsTop', sysInfoIsTop);
  setZidx($sysInfoWrap[0], 'sysinfo', hideSysInfo, sysInfoIsTop);
}
function switchUserInfoState() {
  userInfoIsTop = !userInfoIsTop;
  setTop($userInfoWrap, userInfoIsTop);
  localData.set('userInfoIsTop', userInfoIsTop);
  setZidx($userInfoWrap[0], 'userinfo', hideUserInfo, userInfoIsTop);
}
setTop($sysInfoWrap, sysInfoIsTop);
setTop($userInfoWrap, userInfoIsTop);
export function setTopsFlag(val) {
  if (val === undefined) {
    return tipsFlag;
  }
  tipsFlag = val;
  changeLogoAlertStatus();
}
// 更新tips标识
export function updateTipsFlag() {
  reqUserTips()
    .then((res) => {
      if (res.code === 1) {
        setTopsFlag(res.data);
        switchTipsBtn();
      }
    })
    .catch(() => {});
}
updateTipsFlag();
// 切换tips提示显示状态
function switchTipsBtn() {
  const $tips = $rightBox.find('.tips .icon-new1');
  if (tipsFlag === 0 || tipsFlag === localData.get('tipsFlag')) {
    $tips.css('display', 'none');
  } else {
    $tips.css('display', 'block');
  }
}
// 更新用户名
export function updateRightBoxUsername(username) {
  $rightBox.find('.user_name').text(username).attr('title', username);
}
// 显示
export function showRightMenu() {
  $rightMenuMask.css('display', 'block');
  const num = setTodoUndone();
  const expireCount = setExpireCount();
  $rightBox
    .scrollTop(0)
    .find('.show_todo span')
    .html(
      _tpl(
        `
      <template>
      待办事项
      <em v-if="num>0" style="display: inline-block;background-color: #ffffffd4;width: 2rem;line-height: 2rem;text-align: center;border-radius: var(--border-radius0-5);color: #f56c6c;margin-left: 1rem;
    ">{{num}}</em>
      </template>
      `,
        { num },
      ),
    );
  $rightBox.find('.show_count span').html(
    _tpl(
      `
    <template>
    倒计时
    <em v-if="expireCount>0" style="display: inline-block;background-color: #ffffffd4;width: 2rem;line-height: 2rem;text-align: center;border-radius: var(--border-radius0-5);color: #f56c6c;margin-left: 1rem;
  ">{{expireCount}}</em>
    </template>
    `,
      { expireCount },
    ),
  );
  switchTipsBtn();
  setZidx($rightMenuMask[0], 'rightmenu', hideRightMenu);
  _setTimeout(() => {
    $rightBox.addClass('open');
  }, 100);
}
// 隐藏
export function hideRightMenu() {
  $rightBox.removeClass('open');
  $rightMenuMask.stop().fadeOut(_d.speed);
  popWindow.remove('rightmenu');
}
// 滑动
_mySlide({
  el: '.right_menu_mask',
  right() {
    hideRightMenu();
  },
});
// 修改用户名
function changeUsername(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          beforeText: '用户名：',
          value: setUserInfo().username,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.username);
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      const username = inp.name;
      loading.start();
      reqUerChangename({
        username,
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText);
            updateUserInfo();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '修改用户名',
  );
}
// 每日更换壁纸
function dailyChangeBg() {
  reqUserDailyChangeBg()
    .then((result) => {
      if (result.code === 1) {
        updateUserInfo();
        _msg.success(result.codeText);
        return;
      }
    })
    .catch(() => {});
}
// 隐身
function hdHideState() {
  reqUserHideState()
    .then((result) => {
      if (result.code === 1) {
        updateUserInfo();
        _msg.success(result.codeText);
        return;
      }
    })
    .catch(() => {});
}
// 免密登录状态
function hdRemoteLoginState() {
  reqUserRemoteLoginState()
    .then((result) => {
      if (result.code === 1) {
        updateUserInfo();
        _msg.success(result.codeText);
        return;
      }
    })
    .catch(() => {});
}
// 隐藏用户个人信息
export function hideUserInfo() {
  popWindow.remove('userinfo');
  _animate(
    $userInfoWrap[0],
    {
      to: {
        transform: `translateY(100%) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
    },
  );
}
export function hideSysInfo() {
  const sysBox = $sysInfoWrap[0];
  const screen = getScreenSize();
  const { x, y } = getCenterPointDistance(sysBox, {
    x: screen.w,
    y: screen.h / 2,
  });
  _animate(
    sysBox,
    {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
      sysStatus.end();
      popWindow.remove('sysinfo');
    },
  );
}
// 上传头像
export async function upLogo(type, cb, id, loading = { start() {}, end() {} }) {
  try {
    const files = await getFiles({
      accept: 'image/*',
    });
    if (files.length === 0) return;
    const file = files[0];
    if (!isImgFile(file.name)) {
      _msg.error(`不支持的图片格式`);
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;

    const upPro = new UpProgress(() => {
      controller.abort();
    });
    const pro = upPro.add(file.name);
    if (file.size <= 0 || file.size >= _d.fieldLength.maxLogoSize * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片限制0-${_d.fieldLength.maxLogoSize}MB`);
      return;
    }
    const HASH = await md5.sampleHash(file);
    loading.start();
    reqUserUpLogo(
      { HASH, name: file.name, type, id },
      file,
      function (percent) {
        pro.update(percent);
      },
      signal,
    )
      .then((result) => {
        loading.end();
        if (result.code === 1) {
          pro.close();
          cb && cb(result);
          return;
        }
        return Promise.reject();
      })
      .catch(() => {
        loading.end();
        pro.fail();
      });
  } catch {
    _msg.error('上传失败');
    return;
  }
}
// 用户头像处理
function hdUserLogo(e) {
  const data = [
    {
      id: '1',
      text: '上传头像',
      beforeIcon: 'iconfont icon-upload',
    },
  ];
  if (setUserInfo().logo) {
    data.push({
      id: '2',
      text: '查看',
      beforeIcon: 'iconfont icon-kejian',
    });
    data.push({
      id: '3',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close, loading }) => {
      if (id === '1') {
        upLogo(
          'userlogo',
          () => {
            close();
            updateUserInfo();
          },
          '',
          loading,
        );
      } else if (id === '2') {
        close();
        imgPreview(
          [
            {
              u1: getFilePath(`/logo/${setUserInfo().account}/${setUserInfo().logo}`),
            },
          ],
          0,
          { x: e.clientX, y: e.clientY },
        );
      } else if (id === '3') {
        rMenu.pop(
          {
            e,
            text: '确认删除：头像？',
            confirm: { type: 'danger', text: '删除' },
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqUserDeleteLogo()
                .then((res) => {
                  loading.end();
                  if (res.code === 1) {
                    close();
                    updateUserInfo();
                  }
                })
                .catch(() => {
                  loading.end();
                });
            }
          },
        );
      }
    },
    '头像选项',
  );
}
// 绑定邮箱
function bindEmail(e) {
  const { email } = setUserInfo();
  if (email) {
    rMenu.inpMenu(
      e,
      {
        items: {
          pd: {
            beforeText: '用户密码：',
            autocomplete: 'current-password',
            inputType: 'password',
          },
        },
      },
      function ({ e, inp, close, loading }) {
        const pd = inp.pd;
        rMenu.pop(
          {
            e,
            text: '确认解绑：邮箱？',
            confirm: { type: 'danger', text: '解绑' },
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqUserBindEmail({ password: md5.getStringHash(pd) })
                .then((result) => {
                  loading.end();
                  if (result.code === 1) {
                    close();
                    updateUserInfo();
                    _msg.success(result.codeText);
                  }
                })
                .catch(() => {
                  loading.end();
                });
            }
          },
        );
      },
      '请输入用户密码认证',
    );
  } else {
    rMenu.inpMenu(
      e,
      {
        items: {
          email: {
            beforeText: '验证邮箱：',
            inputType: 'email',
            autocomplete: 'email',
            verify(val) {
              return rMenu.validString(val, 1, _d.fieldLength.email) || rMenu.validEmail(val);
            },
          },
        },
      },
      ({ inp, close, loading }) => {
        const email = inp.email;
        loading.start();
        reqUserBindEmailCode({ email })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              close();
              _msg.success(res.codeText);
              rMenu.inpMenu(
                false,
                {
                  items: {
                    pd: {
                      beforeText: '用户密码：',
                      autocomplete: 'current-password',
                      inputType: 'password',
                    },
                    code: {
                      beforeText: '邮箱验证码：',
                      inputType: 'number',
                      verify(val) {
                        return (
                          rMenu.validInteger(val) ||
                          rMenu.validNumber(val, 0) ||
                          rMenu.validString(val, 6, 6)
                        );
                      },
                    },
                  },
                },
                function ({ inp, close, loading }) {
                  const pd = inp.pd;
                  const code = inp.code;
                  loading.start();
                  reqUserBindEmail({
                    password: md5.getStringHash(pd),
                    code,
                    email,
                  })
                    .then((result) => {
                      loading.end();
                      if (result.code === 1) {
                        close();
                        updateUserInfo();
                        _msg.success(result.codeText);
                      }
                    })
                    .catch(() => {
                      loading.end();
                    });
                },
                '绑定邮箱',
              );
            }
          })
          .catch(() => {
            loading.end();
          });
      },
      '输入邮箱，获取验证码',
    );
  }
}
// 编辑消息转发接口
function handleForwardMsg(e) {
  const { forward_msg_state: state, forward_msg_link } = setUserInfo();
  const { link, type, header, body, contentType } = forward_msg_link;
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        state: {
          beforeText: '接口状态：',
          type: 'select',
          value: state === 1 ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        type: {
          beforeText: '请求类型：',
          type: 'select',
          value: type,
          selectItem: [
            { value: 'get', text: 'GET' },
            { value: 'post', text: 'POST' },
          ],
        },
        contentType: {
          beforeText: '请求体类型：',
          type: 'select',
          value: contentType,
          selectItem: [
            { value: 'application/json', text: 'json' },
            {
              value: 'application/x-www-form-urlencoded',
              text: 'x-www-form-urlencoded',
            },
            { value: 'text/plain', text: 'text' },
          ],
        },
        link: {
          beforeText: '接口地址：',
          value: link,
          type: 'textarea',
          placeholder: 'https://api.xxx.com/xxx?title={{title}}&text={{text}}',
          verify(val, items) {
            if (items.state.value === 'y') {
              return rMenu.validString(val, 1, _d.fieldLength.url) || rMenu.validUrl(val);
            } else {
              return rMenu.validString(val, 0, _d.fieldLength.url);
            }
          },
        },
        header: {
          beforeText: 'Header：',
          type: 'textarea',
          value: JSON.stringify(header, null, 2),
          placeholder: `{"content-type": "application/json"}`,
          verify(val, items) {
            if (items.state.value === 'y' && !parseObjectJson(val)) {
              return '必须为JSON对象格式';
            }
          },
        },
        body: {
          beforeText: 'Body：',
          type: 'textarea',
          value: body,
          placeholder: `{"title": "{{title}}", "text": "{{text}}"} 或 {{title}}：{{text}}`,
          verify(val, items) {
            if (items.state.value === 'y') {
              return rMenu.validString(val, 1, _d.fieldLength.url) ||
                ((items.type.value === 'get' ||
                  (items.type.value === 'post' &&
                    items.contentType.value === 'application/json')) &&
                  !parseObjectJson(val) &&
                  !parseArrayJson(val))
                ? '必须为JSON对象格式'
                : '';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      let { state, link, type, header, body, contentType } = inp;
      header = parseObjectJson(header) || {};
      loading.start();
      reqChatForwardMsgLink({
        state: state === 'y' ? 1 : 0,
        link,
        type,
        header,
        contentType,
        body,
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            updateUserInfo();
            _msg.success(result.codeText);
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑转发接口',
  );
}
// 用户信息
$userInfoWrap
  .on('click', '.edit_user_name', changeUsername)
  .on('click', '.forward_msg', handleForwardMsg)
  .on('click', '.bind_email', bindEmail)
  .on('click', '.dailybg', dailyChangeBg)
  .on('click', '.hide', hdHideState)
  .on('click', '.remote_login', hdRemoteLoginState)
  .on('click', '.u_close_btn', hideUserInfo)
  .on('click', '.user_logo div', hdUserLogo)
  .on('click', '.top', switchUserInfoState);
$sysInfoWrap.on('click', '.c_close_btn', hideSysInfo).on('click', '.top', switchSysInfoTopState);
// 更新用户信息
export function renderUserinfo() {
  const { username, logo, account } = setUserInfo();
  const html = _tpl(
    `
    <ul><li>用户</li><li>{{username}}</li><li cursor="y" class="edit_user_name">修改</li></ul>
    <ul><li>账号</li><li>{{account}}</li></ul>
    <ul><li>邮箱</li><li>{{email || '未绑定邮箱'}}</li><li cursor="y" class="bind_email">{{email ? '解绑' : '绑定'}}</li></ul>
    <ul><li>状态</li><li>开启隐身</li><li style="color: var(--icon-color);" class="hide iconfont {{hide && hide === 1 ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'}}" cursor="y"></li></ul>
    <ul><li>登录</li><li>免密登录</li><li style="color: var(--icon-color);" class="remote_login iconfont {{remote_login && remote_login === 1 ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'}}" cursor="y"></li></ul>
    <ul><li>转发</li><li>消息转发至外部应用</li><li cursor="y" class="forward_msg">编辑</li></ul>
    <ul><li>壁纸</li><li>每日自动更换壁纸</li><li style="color: var(--icon-color);" class="dailybg iconfont {{daily_change_bg === 1 ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'}}" cursor="y"></li></ul>
    `,
    {
      ...setUserInfo(),
    },
  );
  $userInfoWrap.find('.user_list').html(html);
  if (logo) {
    imgjz(getFilePath(`/logo/${account}/${logo}`))
      .then((cache) => {
        $userInfoWrap.find('.user_logo div').css('background-image', `url(${cache})`);
      })
      .catch(() => {
        $userInfoWrap
          .find('.user_logo div')
          .css('background-image', `url(${getTextImg(username)})`);
      });
  } else {
    $userInfoWrap.find('.user_logo div').css('background-image', `url(${getTextImg(username)})`);
  }
}
// 设置君子锁
function setGentlemanLock(e) {
  rMenu.inpMenu(
    e,
    {
      items: {
        text: {
          inputType: 'password',
          value: localData.get('gentlemanLockPd'),
          trimValue: false,
          placeholder: '为空则取消',
          beforeText: '设置密码：',
        },
      },
    },
    function ({ inp, close, isDiff }) {
      if (!isDiff()) return;
      close();
      const text = inp.text;
      localData.set('gentlemanLockPd', text);
      localData.session.remove('gentlemanLockPd');
      if (text) {
        location.reload();
      } else {
        _msg.success();
      }
    },
    '防君子不防小人',
  );
}
// 设置字体
function setPageFont(e, loading = { start() {}, end() {} }) {
  loading.start();
  reqUserFontList()
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        res.data.sort((a, b) => mixedSort(a, b));
        res.data.unshift('manageFonts', 'default');
        const data = [];
        res.data.forEach((item, idx) => {
          let name = item.slice(0, -4);
          const info = {
            id: idx + '',
            text: item === 'default' ? '默认字体' : name,
            beforeText: (idx + '').padStart(2, '0') + '. ',
            param: { font: item },
            active: localData.get('fontType') === item ? true : false,
          };
          if (item === 'manageFonts') {
            info.text = '管理字体';
            info.beforeIcon = 'iconfont icon-shezhi';
            delete info.beforeText;
          }
          data.push(info);
        });
        if (!isRoot()) {
          data.shift();
        }
        rMenu.selectMenu(
          e,
          data,
          async ({ id, resetMenu, param, loading, close }) => {
            if (id === '0') {
              openInIframe(`/file/#${_d.fontDir}`, '文件管理', 'file');
              close(true);
              return;
            }
            if (id) {
              const font = param.font;
              data.forEach((item) => {
                if (font === item.param.font) {
                  item.active = true;
                } else {
                  item.active = false;
                }
              });
              resetMenu(data);
              loading.start();
              try {
                await handleFontType(font);
                localData.set('fontType', font);
                loading.end();
              } catch {
                loading.end();
              }
            }
          },
          '选择字体',
        );
      }
    })
    .catch(() => {
      loading.end();
    });
}
// 设置
export function settingMenu(e, isMain) {
  const dark = localData.get('dark');
  const headBtnToRight = localData.get('headBtnToRight');
  const icon = getDarkIcon(dark);
  let data = [
    {
      id: '1',
      text: '壁纸库',
      beforeIcon: 'iconfont icon-tupian',
    },
    {
      id: '2',
      text: '君子锁',
      beforeIcon: 'iconfont icon-suo',
    },
    {
      id: '3',
      text: '个性化',
      beforeIcon: 'iconfont icon-zhuti',
    },
    {
      id: '4',
      text: '黑暗模式',
      beforeIcon: `iconfont ${icon}`,
      param: { value: dark },
    },
    {
      id: '5',
      text: '叉叉靠右',
      beforeIcon: `iconfont icon-close-bold`,
      afterIcon: 'iconfont ' + (headBtnToRight ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
      param: { value: headBtnToRight },
    },
  ];
  if (cacheFile.supported) {
    data.push({
      id: '6',
      text: '缓存管理',
      beforeIcon: `iconfont icon-yidongyingpan`,
    });
  } else {
    data.push({
      id: '10',
      text: '清理本地配置缓存',
      beforeIcon: `iconfont icon-qingkong-1`,
    });
  }
  if (isMain) {
    data = [
      ...data,
      {
        id: '7',
        text: '新建笔记',
        beforeIcon: 'iconfont icon-jilu',
      },
      {
        id: '8',
        text: '隐藏所有窗口',
        beforeIcon: 'iconfont icon-minus-bold',
      },
      {
        id: '9',
        text: '关闭所有窗口',
        beforeIcon: 'iconfont icon-shibai',
      },
    ];
  }
  rMenu.selectMenu(
    e,
    data,
    async ({ e, resetMenu, close, id, param, loading }) => {
      const curItem = data.find((item) => item.id === id);
      if (id === '1') {
        close();
        showBgBox();
      } else if (id === '2') {
        setGentlemanLock(e);
      } else if (id === '3') {
        const clickLove = localData.get('clickLove');
        const windowMoveOpacity = localData.get('windowMoveOpacity');
        const pmsound = localData.get('pmsound');
        const tip = localData.get('toolTip');
        const data = [
          {
            id: '1',
            text: '背景模糊',
            beforeIcon: 'iconfont icon-mohu',
          },
          {
            id: '2',
            text: '背景黑白',
            beforeIcon: 'iconfont icon-heibai',
          },
          {
            id: '3',
            text: '更换字体',
            beforeIcon: 'iconfont icon-font-size',
          },
          {
            id: '4',
            text: '点击爱心',
            beforeIcon: 'iconfont icon-dianji',
            afterIcon: 'iconfont ' + (clickLove ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: clickLove },
          },
          {
            id: '7',
            text: '窗口移动透明',
            beforeIcon: 'iconfont icon-opacity',
            afterIcon:
              'iconfont ' + (windowMoveOpacity ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: windowMoveOpacity },
          },
          {
            id: '6',
            text: '通知提示音',
            beforeIcon: 'iconfont icon-tongzhi',
            afterIcon: 'iconfont ' + (pmsound ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: pmsound },
          },
        ];
        if (!isMobile()) {
          data.push({
            id: '7',
            text: '鼠标移入显示提示信息',
            beforeIcon: 'iconfont icon-tishi',
            afterIcon: 'iconfont ' + (tip ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: tip },
          });
        }
        rMenu.selectMenu(
          e,
          data,
          ({ e, id, resetMenu, param, loading }) => {
            const curItem = data.find((item) => item.id === id);
            if (id === '1') {
              // 模糊背景
              resizeBgFilter(e);
            } else if (id === '2') {
              // 黑白
              rMenu.percentBar(
                e,
                localData.get('pageGrayscale'),
                throttle(function (per) {
                  localData.set('pageGrayscale', per);
                }, 500),
              );
            } else if (id === '3') {
              // 字体列表
              setPageFont(e, loading);
            } else if (id === '4') {
              // 点击效果设置
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
                localData.set('clickLove', false);
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
                localData.set('clickLove', true);
              }
              resetMenu(data);
            } else if (id === '7') {
              // 窗口移动透明
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
                localData.set('windowMoveOpacity', false);
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
                localData.set('windowMoveOpacity', true);
              }
              resetMenu(data);
            } else if (id === '6') {
              // 提示音
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
                localData.set('pmsound', false);
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
                localData.set('pmsound', true);
              }
              resetMenu(data);
            } else if (id === '7') {
              // 提示工具
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
                localData.set('toolTip', false);
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
                localData.set('toolTip', true);
              }
              resetMenu(data);
            }
          },
          '个性化设置',
        );
      } else if (id === '4') {
        let dark = '';
        // 黑暗模式
        const flag = param.value;
        if (flag === 'y') {
          dark = 'n';
          curItem.beforeIcon = 'iconfont icon-taiyangtianqi';
          curItem.param.value = dark;
          _msg.success('关闭成功');
        } else if (flag === 'n') {
          dark = 's';
          curItem.beforeIcon = 'iconfont icon-xianshiqi';
          curItem.param.value = dark;
          _msg.success('跟随系统');
        } else if (flag === 's') {
          dark = 'y';
          curItem.beforeIcon = 'iconfont icon-icon_yejian-yueliang';
          curItem.param.value = dark;
          _msg.success('开启成功');
        }
        localData.set('dark', dark);
        resetMenu(data);
      } else if (id === '5') {
        if (param.value) {
          curItem.afterIcon = 'iconfont icon-kaiguan-guan';
          curItem.param.value = false;
          _msg.success('关闭成功');
          localData.set('headBtnToRight', false);
        } else {
          curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
          curItem.param.value = true;
          _msg.success('开启成功');
          localData.set('headBtnToRight', true);
        }
        resetMenu(data);
      } else if (id === '8') {
        close();
        // 隐藏所有窗口
        hideAllwindow(1);
      } else if (id === '9') {
        close();
        // 关闭所有窗口
        closeAllwindow(1);
      } else if (id === '7') {
        close();
        openInIframe('/edit#new', '新笔记', 'edit');
      } else if (id === '6') {
        const cacheState = cacheFile.setCacheState();
        const data = [
          {
            id: '1',
            text: '缓存状态',
            beforeIcon: `iconfont icon-xinxi`,
            afterIcon: 'iconfont ' + (cacheState ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: cacheState },
          },
          {
            id: '2',
            text: '清理缓存',
            beforeIcon: `iconfont icon-qingkong-1`,
          },
          {
            id: '3',
            text: '导入缓存数据',
            beforeIcon: 'iconfont icon-upload',
          },
          {
            id: '4',
            text: '导出缓存数据',
            beforeIcon: 'iconfont icon-download',
          },
        ];
        rMenu.selectMenu(
          e,
          data,
          async ({ e, id, loading, resetMenu, param }) => {
            const curItem = data.find((item) => item.id === id);
            if (id === '1') {
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
                cacheFile.setCacheState(false);
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
                cacheFile.setCacheState(true);
              }
              resetMenu(data);
            } else if (id === '2') {
              const { quota } = await cacheFile.getEstimateSize();
              const titleText = `选择要清除的缓存：可用缓存空间大约(${formatBytes(quota)})`;
              const data = [
                {
                  id: 'music',
                  text: '歌曲',
                  beforeIcon: 'iconfont icon-yinle1',
                  param: { text: '歌曲', type: 'music' },
                },
                {
                  id: 'image',
                  text: '图片',
                  beforeIcon: 'iconfont icon-tupian',
                  param: { text: '图片', type: 'image' },
                },
                {
                  id: _d.appName,
                  text: '其他',
                  beforeIcon: 'iconfont icon-bangzhu',
                  param: { text: '其他', type: _d.appName },
                },
                {
                  id: 'local',
                  text: '本地配置',
                  beforeIcon: 'iconfont icon-xinxi',
                  param: { text: '本地配置', type: 'local' },
                },
                {
                  id: 'all',
                  text: '所有',
                  beforeIcon: 'iconfont icon-qingkong-1',
                  param: { text: '所有', type: '' },
                },
              ];
              rMenu.selectMenu(
                e,
                data,
                async ({ id, e, loading, param }) => {
                  if (id) {
                    loading.start();
                    let size = 0;
                    if (id === 'local') {
                      size = localData.getSize();
                    } else {
                      size = await cacheFile.size(param.type);
                    }
                    loading.end();
                    rMenu.pop(
                      {
                        e,
                        text: `确认清空：${param.text}缓存？大约：${formatBytes(size)}`,
                      },
                      async (type) => {
                        if (type === 'confirm') {
                          const cacheState = cacheFile.setCacheState();
                          try {
                            loading.start();
                            if (id === 'local') {
                              localData.remove();
                            } else {
                              await cacheFile.clear(param.type);
                              if (id === 'all') {
                                localData.remove();
                              }
                            }
                            // 保留必要的本地配置
                            if (['all', 'local'].includes(id)) {
                              cacheFile.setCacheState(cacheState);
                              localData.set('account', setUserInfo().account);
                              localData.set('username', setUserInfo().username);
                            }
                            loading.end();
                            _msg.success();
                          } catch {
                            loading.end();
                            _msg.error();
                          }
                        }
                      },
                    );
                  }
                },
                titleText,
              );
            } else if (id === '3') {
              rMenu.pop(
                {
                  e,
                  text: `如何处理已存在缓存？`,
                  cancel: {
                    text: '覆盖',
                  },
                  confirm: {
                    text: '跳过',
                  },
                },
                async (type) => {
                  if (type === 'confirm' || type === 'cancel') {
                    try {
                      const skip = type === 'confirm';
                      loading.start();
                      await cacheFile.importStorage(skip);
                      loading.end();
                      _msg.success();
                    } catch {
                      loading.end();
                      _msg.error();
                    }
                  }
                },
              );
            } else if (id === '4') {
              const size = await cacheFile.size();
              rMenu.pop(
                {
                  e,
                  text: `确认导出：缓存？大约：${formatBytes(size)}`,
                },
                async (type) => {
                  if (type === 'confirm') {
                    try {
                      loading.start();
                      await cacheFile.exportStorage();
                      loading.end();
                      _msg.success();
                    } catch {
                      loading.end();
                      _msg.error();
                    }
                  }
                },
              );
            }
          },
          '缓存管理(关闭缓存后，会停止新增歌曲和图片的缓存文件。已缓存的文件不受影响)',
        );
      } else if (id === '10') {
        rMenu.pop(
          {
            e,
            text: `确认清空: 本地配置缓存？大约：${formatBytes(localData.getSize())}`,
          },
          (type) => {
            if (type === 'confirm') {
              try {
                loading.start();
                localData.remove();
                localData.set('account', setUserInfo().account);
                localData.set('username', setUserInfo().username);
                loading.end();
                _msg.success();
              } catch {
                loading.end();
                _msg.error();
              }
            }
          },
        );
      }
    },
    '设置',
  );
}
// Admin
function hdAdmin(e) {
  const data = [
    { id: '1', text: '用户管理', beforeIcon: 'iconfont icon-chengyuan' },
    { id: '2', text: '日志', beforeIcon: 'iconfont icon-rizhi' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ close, id }) => {
      if (id === '1') {
        close(1);
        showRootPage();
      } else if (id === '2') {
        close(1);
        showLogPage();
      }
    },
    '管理员菜单',
  );
}
export function showRootPage() {
  if (!isRoot()) return;
  hideRightMenu();
  openInIframe(`/root`, '用户管理', 'account');
}
export function showLogPage() {
  if (!isRoot()) return;
  hideRightMenu();
  openInIframe(`/log`, '日志', 'log');
}
// 生成二维码
function createQrCode(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '生成',
      items: {
        text: {
          type: 'textarea',
          verify(val) {
            return rMenu.validString(val, 1);
          },
        },
      },
    },
    function ({ e, inp, close }) {
      const text = inp.text;
      showQcode(e, text)
        .then(close)
        .catch(() => {});
    },
    '生成二维码',
  );
}
// 工具
function hdTools(e) {
  let data = [
    { id: '1', text: '笔记本', beforeIcon: 'iconfont icon-mingcheng-jiluben' },
    { id: '2', text: '文件管理', beforeIcon: 'iconfont icon-gl-folder' },
    { id: '10', text: '终端管理', beforeIcon: 'iconfont icon-terminal1' },
    {
      id: '9',
      text: '公开文件目录',
      beforeIcon: 'iconfont icon-gl-folder',
    },
    { id: '5', text: '便条', beforeIcon: 'iconfont icon-jilu' },
    {
      id: '7',
      text: '搜索历史',
      beforeIcon: 'iconfont icon-history',
    },
    {
      id: '8',
      text: '书签夹',
      beforeIcon: 'iconfont icon-shuqian',
    },
    { id: '6', text: '导入/导出书签', beforeIcon: 'iconfont icon-shuqian' },
    { id: '3', text: '图床', beforeIcon: 'iconfont icon-tupian' },
    { id: '4', text: '生成二维码', beforeIcon: 'iconfont icon-erweima' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id }) => {
      if (id === '1') {
        close();
        showNote();
      } else if (id === '2') {
        close();
        showFileManage();
      } else if (id === '3') {
        close();
        showPicture();
      } else if (id === '4') {
        createQrCode(e);
      } else if (id === '5') {
        close();
        showNotepad();
      } else if (id === '6') {
        const data = [
          {
            id: '1',
            text: '导入书签',
            beforeIcon: 'iconfont icon-upload',
          },
          {
            id: '2',
            text: '导出书签',
            beforeIcon: 'iconfont icon-download',
          },
        ];
        rMenu.selectMenu(
          e,
          data,
          ({ close, id, loading }) => {
            if (id === '1') {
              importBm(close, loading);
            } else if (id === '2') {
              exportBm(close, loading);
            }
          },
          '导入/导出书签',
        );
      } else if (id === '7') {
        close();
        showHistory();
      } else if (id === '8') {
        close();
        showBmk();
      } else if (id === '9') {
        close();
        hideRightMenu();
        openInIframe(`/file/#${_d.pubDir}`, '文件管理', 'file');
      } else if (id === '10') {
        close();
        showSSHList();
      }
    },
    '工具',
  );
}
// 修改密码
function changeUserPd(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        pass: {
          beforeText: '原密码：',
          autocomplete: 'current-password',
          inputType: 'password',
        },
        npass: {
          beforeText: '新密码：',
          autocomplete: 'new-password',
          inputType: 'password',
        },
        rpass: {
          beforeText: '确认密码：',
          autocomplete: 'new-password',
          inputType: 'password',
        },
      },
    },
    function ({ close, inp, loading }) {
      const oldpassword = inp.pass,
        newpassword = inp.npass,
        newpassword1 = inp.rpass;
      if (newpassword !== newpassword1) {
        _msg.error('密码不一致');
        return;
      }
      loading.start();
      reqUserChangPd({
        oldpassword: md5.getStringHash(oldpassword),
        newpassword: md5.getStringHash(newpassword),
      })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText, () => {
              toLogin();
            });
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '修改密码',
  );
}
// 注销账号
function closeAccount(e) {
  if (isRoot()) {
    _msg.error('无法注销管理员账号');
    return;
  }
  rMenu.inpMenu(
    e,
    {
      items: {
        pd: {
          beforeText: '用户密码：',
          inputType: 'password',
          autocomplete: 'current-password',
        },
      },
    },
    function ({ e, inp, close, loading }) {
      const pd = inp.pd;
      rMenu.pop(
        {
          e,
          text: '确认注销：账号？',
          confirm: { type: 'danger', text: '注销' },
        },
        (type) => {
          if (type === 'confirm') {
            loading.start();
            reqUserDeleteAccount({ password: md5.getStringHash(pd) })
              .then((result) => {
                loading.end();
                if (result.code === 1) {
                  close();
                  localData.remove();
                  _msg.success(result.codeText, (type) => {
                    if (type === 'close') {
                      myOpen('/login/');
                    }
                  });
                  return;
                }
              })
              .catch(() => {
                loading.end();
              });
          }
        },
      );
    },
    '请输入用户密码认证',
  );
}
// 账号设置
function hdAccountManage(e) {
  const { account, verify } = setUserInfo();
  const data = [
    {
      id: '1',
      text: '个人信息',
      beforeIcon: 'iconfont icon-zhanghao',
    },
    {
      id: '3',
      text: '修改密码',
      beforeIcon: 'iconfont icon-suo',
    },
    {
      id: '4',
      text: `${verify ? '关闭' : '配置'}两步验证`,
      beforeIcon: 'iconfont icon-shoujiyanzheng',
    },
  ];
  if (isRoot()) {
    data.push({
      id: '6',
      text: 'Admin',
      beforeIcon: 'iconfont icon-user_root',
    });
  } else {
    data.push({
      id: '5',
      text: '注销账号',
      beforeIcon: 'iconfont icon-zhuxiao',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        showUserInfo();
        close(true);
      } else if (id === '3') {
        changeUserPd(e);
      } else if (id === '5') {
        closeAccount(e);
      } else if (id === '6') {
        hdAdmin(e);
      } else if (id === '4') {
        if (verify) {
          rMenu.inpMenu(
            e,
            {
              items: {
                pd: {
                  beforeText: '用户密码：',
                  inputType: 'password',
                  autocomplete: 'current-password',
                },
              },
            },
            function ({ e, inp, close, loading }) {
              const pd = inp.pd;
              rMenu.pop({ e, text: '确认关闭：两步验证吗？' }, (type) => {
                if (type === 'confirm') {
                  loading.start();
                  reqUserVerify({ password: md5.getStringHash(pd) })
                    .then((res) => {
                      loading.end();
                      if (res.code === 1) {
                        close(1);
                        updateUserInfo();
                        _msg.success(res.codeText);
                      }
                    })
                    .catch(() => {
                      loading.end();
                    });
                }
              });
            },
            '请输入用户密码认证',
          );
        } else {
          loading.start();
          reqUserGetVerify()
            .then((res) => {
              loading.end();
              if (res.code === 1) {
                hdVerifyLogin(e, res.data, account);
              }
            })
            .catch(() => {
              loading.end();
            });
        }
      }
    },
    '账号管理',
  );
}
/* 
  otpauth://totp/{AccountName}?secret={Secret}&issuer={Issuer}&algorithm={Algorithm}&digits={Digits}&period={Period}
  otpauth://totp/：表示这是一个基于时间的一次性密码(TOTP)的URI。
  {AccountName}：账户名称，通常包含用户名或邮箱，可以是“Account:User”这样的格式。
  secret={Secret}：TOTP的密钥，通常是Base32编码的字符串。
  issuer={Issuer}：发出者名称，一般是公司或服务的名称。
  algorithm={Algorithm}（可选）：加密算法，默认是SHA1，其他可能的值包括SHA256和SHA512。
  digits={Digits}（可选）：生成的验证码位数，默认是6位。
  period={Period}（可选）：验证码的有效期，默认是30秒。
*/
async function hdVerifyLogin(e, verify, account) {
  const text = `otpauth://totp/${account}?issuer=Hello&secret=${verify}`;
  const url = await QRCode.toDataURL(text, { width: 500, height: 500 });
  const html = _tpl(
    `
    <p style="line-height:1.5;">使用 “Authenticator、1Password” 等手机应用，扫描以下二维码，获取 6 位验证码</p>
    <img style="width:25rem;height:25rem" :data-src="url"/>
    <div cursor="y" title="点击复制密钥" class="item"><i class="title">密钥：</i><span class='text'>{{verify}}</span></div>
    <div style="text-align:left;"><button cursor="y" class="btn btn_primary">开启两步验证</button></div>
    `,
    {
      verify,
      url,
    },
  );
  rMenu.rightMenu(
    e,
    html,
    function ({ e, box }) {
      const item = _getTarget(box, e, '.item');
      const btn = _getTarget(box, e, '.btn');
      if (item) {
        copyText(verify);
      } else if (btn) {
        rMenu.inpMenu(
          e,
          {
            items: {
              pd: {
                beforeText: '用户密码：',
                inputType: 'password',
                autocomplete: 'current-password',
              },
              text: {
                beforeText: '验证码：',
                inputType: 'number',
                verify(val) {
                  return (
                    rMenu.validInteger(val) ||
                    rMenu.validNumber(val, 0) ||
                    rMenu.validString(val, 6, 6)
                  );
                },
              },
            },
          },
          function ({ inp, close, loading }) {
            const token = inp.text;
            const pd = inp.pd;
            loading.start();
            reqUserVerify({ token, password: md5.getStringHash(pd) })
              .then((res) => {
                loading.end();
                if (res.code === 1) {
                  close(1);
                  updateUserInfo();
                  _msg.success(res.codeText);
                }
              })
              .catch(() => {
                loading.end();
              });
          },
          '开启两步验证',
        );
      }
    },
    '配置两步验证',
  );
}
// 显示个人信息
let userInfoOnce = false;
export function showUserInfo() {
  hideRightMenu();
  const userInfoBox = $userInfoWrap[0];
  const isHide = $userInfoWrap.is(':hidden');

  $userInfoWrap.stop().fadeIn(_d.speed, () => {
    if (isHide) updateUserInfo();
  });
  setZidx(userInfoBox, 'userinfo', hideUserInfo, userInfoIsTop);
  if (!userInfoOnce) {
    userInfoOnce = true;
    const { x, y } = userInfoSize;
    const obj = x && y ? { left: x, top: y } : null;
    toCenter(userInfoBox, obj);
  } else {
    myToRest(userInfoBox, false, false);
  }
}
let sysInfoOnce = false;
export function showSysInfo() {
  const sysBox = $sysInfoWrap[0];
  hideRightMenu();
  const isHide = $sysInfoWrap.is(':hidden');
  $sysInfoWrap.css('display', 'block');
  setZidx(sysBox, 'sysinfo', hideSysInfo, sysInfoIsTop);
  if (isHide) sysStatus.start();
  if (!sysInfoOnce) {
    sysInfoOnce = true;
    const { x, y } = sysInfoSize;
    const obj = x && y ? { left: x, top: y } : null;
    toCenter(sysBox, obj);
  } else {
    myToRest(sysBox, false, false);
  }
  if (isHide) {
    const screen = getScreenSize();
    const { x, y } = getCenterPointDistance(sysBox, {
      x: screen.w,
      y: screen.h / 2,
    });
    _animate(sysBox, {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
      direction: 'reverse',
    });
  }
}
// 导入书签
function importBm(cb, loading = { start() {}, end() {} }) {
  upStr('.html')
    .then((res) => {
      if (!res) return;
      const list = hdImportBm(getbookmark(res));
      loading.start();
      reqBmkImport({ list })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            cb && cb();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    })
    .catch(() => {
      _msg.error('导入文件格式错误');
    });
}
// 导出书签
function exportBm(cb, loading = { start() {}, end() {} }) {
  loading.start();
  reqBmkExport()
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        downloadText(hdExportBm(res.data), 'bookmark.html');
        cb && cb();
      }
    })
    .catch(() => {
      loading.end();
      _msg.error('导出书签失败');
    });
}
// 退出
function userLogout(e) {
  rMenu.pop(
    {
      e,
      text: '退出：当前，还是退出：其他登录设备？',
      confirm: {
        text: '退出当前',
      },
      cancel: {
        text: '退出其他',
      },
    },
    (type) => {
      if (type === 'close') return;
      let other = 1;
      type === 'confirm' ? (other = 0) : null;
      reqUserLogout({ other })
        .then((result) => {
          if (result.code === 1) {
            _msg.success(result.codeText, (type) => {
              if (type === 'close') {
                if (other === 0) {
                  toLogin();
                }
              }
            });
            return;
          }
        })
        .catch(() => {});
    },
  );
}
// 设置tips
function setTipsFlag(e) {
  const data = [
    { id: 'close', text: '关闭提示' },
    { id: 'update', text: '更新提示' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ close, id, loading }) => {
      if (id === 'close' || id === 'update') {
        loading.start();
        reqRootTips({ flag: id })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              close();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
    'Tips提示状态',
  );
}
longPress($rightBox[0], '.tips', function (e) {
  if (!isRoot()) return;
  const ev = e.changedTouches[0];
  setTipsFlag(ev);
});
export function showTrash() {
  hideRightMenu();
  openInIframe('/trash', '回收站', 'trash');
}
export function showNote() {
  hideRightMenu();
  openInIframe(`/notes?acc=${encodeURIComponent(localData.get('account'))}`, '笔记本', 'notebook');
}
export function showHistory() {
  hideRightMenu();
  openInIframe('/history', '搜索历史', 'history');
}
export function showSSHList() {
  hideRightMenu();
  openInIframe('/sshlist', '终端管理', 'sshlist');
}
export function showBmk() {
  hideRightMenu();
  openInIframe(`/bmk?acc=${encodeURIComponent(localData.get('account'))}`, '书签夹', 'bookmark');
}
export function showFileManage() {
  hideRightMenu();
  openInIframe(`/file`, '文件管理', 'file');
}
export function showNotepad() {
  hideRightMenu();
  openInIframe(`/notepad`, '便条', 'note');
}
export function showPicture() {
  hideRightMenu();
  openInIframe(`/pic`, '图床', 'picture');
}
function getPercentColor(percent) {
  if (percent <= 60) {
    return 'var(--message-success-color)';
  } else if (percent <= 80) {
    return 'var(--message-warning-color)';
  } else {
    return 'var(--message-error-color)';
  }
}
const sysStatus = (() => {
  if (!isRoot()) {
    $rightBox.find('.show_sysinfo').remove();
    return { start() {}, end() {} };
  }
  const options = {
    color: 'var(--message-success-color)',
    bgColor: '#88888880',
    strokeWidth: 8,
  };
  const sys = [{ type: 'cpu' }, { type: 'mem' }, { type: 'swap' }, { type: 'disk' }].map(
    ({ type }) => {
      return {
        type,
        text: $sysInfoWrap.find(`.list .${type} .text`)[0],
        bar: new CircularProgressBar($sysInfoWrap.find(`.list .${type} .progress`)[0], options),
      };
    },
  );
  const rxText = $sysInfoWrap.find('.net .rx .text')[0];
  const txText = $sysInfoWrap.find('.net .tx .text')[0];
  let timer = null;
  function start() {
    end();
    if ($sysInfoWrap.is(':hidden')) return;
    reqRootSysStatus()
      .then((res) => {
        if (res.code === 1) {
          sys.forEach(({ type, text, bar }) => {
            const { percent, used, total, cores, arch } = res.data[type];
            bar.setProgress(percent, type).setColor(getPercentColor(percent));
            if (type === 'cpu') {
              text.textContent = `${cores}核 ${arch}`;
            } else {
              text.textContent = `${formatBytes(used)} / ${formatBytes(total)}`;
            }
          });
          rxText.textContent = formatBytes(res.data.net.rx);
          txText.textContent = formatBytes(res.data.net.tx);
          timer = setTimeout(start, 1000);
        }
      })
      .catch(() => {
        timer = setTimeout(start, 5000);
      });
  }
  function end() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    start,
    end,
  };
})();
// 事件绑定
$rightBox
  .on('click', '.tools', hdTools)
  .on('click', '.show_sysinfo', showSysInfo)
  .on('click', '.account_manage', hdAccountManage)
  .on('click', '.user_name', showUserInfo)
  .on('click', '.r_about', function () {
    hideRightMenu();
    openInIframe('/note?v=about', '关于', 'note');
  })
  .on('click', '.tips', function () {
    hideRightMenu();
    localData.set('tipsFlag', tipsFlag);
    changeLogoAlertStatus();
    openInIframe('/note?v=tips', 'Tips', 'note');
  })
  .on('contextmenu', '.tips', function (e) {
    if (!isRoot()) return;
    e.preventDefault();
    if (isMobile()) return;
    setTipsFlag(e);
  })
  .on('click', '.show_trash', showTrash)
  .on('click', '.r_setting', settingMenu)
  .on('click', '.show_share_list', function () {
    hideRightMenu();
    openInIframe(`/sharelist`, '分享管理', 'share');
  })
  .on('click', '.show_music_player', () => {
    showMusicPlayerBox();
  })
  .on('click', '.show_todo', showTodoBox)
  .on('click', '.show_count', showCountBox)
  .on('click', '.log_out', userLogout);
function encodeUrlAttr(url) {
  return String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
// 生成导出配置
function hdExportBm(arr) {
  let str = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
  <!-- This is an automatically generated file.
       It will be read and overwritten.
       DO NOT EDIT! -->
  <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
  <TITLE>Bookmarks</TITLE>
  <H1>Bookmarks</H1>
  <DL><p>
      <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">收藏夹栏</H3>
      <DL><p>\n`;
  arr.forEach((item) => {
    str += `<DT><H3>${encodeHtml(item.title)}</H3>\n<DL><p>\n`;
    item.children.forEach((y) => {
      str += `<DT><A HREF="${encodeUrlAttr(y.link)}" DESCRIPTION="${encodeHtml(
        y.des,
      )}">${encodeHtml(y.title)}</A>\n`;
    });
    str += `</DL><p>\n`;
  });
  str += `</DL><p>\n</DL><p>`;
  return str;
}
// 生成导入配置
function hdImportBm(arr) {
  let res = [];
  function fn(arr, title = 'xxx') {
    let dirs = arr.filter((item) => item.folder),
      its = arr.filter((item) => !item.folder);
    if (its.length > 0) {
      res.push({
        title,
        list: its,
      });
    }
    dirs.forEach((item) => {
      fn(item.children, item.title);
    });
  }
  fn(arr, 'home');
  return res;
}
myDrag({
  trigger: $userInfoWrap[0],
  down() {
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    const { h, w } = getScreenSize();
    if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
      const { x, y } = target.dataset;
      _animate(
        target,
        {
          to: { top: y + 'px', left: x + 'px' },
        },
        () => {
          target.style.top = y + 'px';
          target.style.left = x + 'px';
        },
      );
    } else {
      savePopLocationInfo(target, { x, y });
      userInfoSize.x = x;
      userInfoSize.y = y;
      localData.set('userInfoSize', userInfoSize);
    }
  },
});
myDrag({
  trigger: $sysInfoWrap[0],
  down() {
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    const { h, w } = getScreenSize();
    if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
      const { x, y } = target.dataset;
      _animate(
        target,
        {
          to: { top: y + 'px', left: x + 'px' },
        },
        () => {
          target.style.top = y + 'px';
          target.style.left = x + 'px';
        },
      );
    } else {
      savePopLocationInfo(target, { x, y });
      sysInfoSize.x = x;
      sysInfoSize.y = y;
      localData.set('sysInfoSize', sysInfoSize);
    }
  },
});
// 层级
function hdIndex(e) {
  if (_getTarget(this, e, '.user_info_wrap')) {
    setZidx($userInfoWrap[0], 'userinfo', hideUserInfo, userInfoIsTop);
  } else if (_getTarget(this, e, '.sys_info_wrap')) {
    setZidx($sysInfoWrap[0], 'sysinfo', hideSysInfo, sysInfoIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  hdIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  hdIndex(e.changedTouches[0]);
});
