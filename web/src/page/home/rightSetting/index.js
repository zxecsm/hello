import $ from 'jquery';
import QRCode from 'qrcode';
import {
  myOpen,
  _setData,
  _getData,
  _delData,
  _setTimeout,
  throttle,
  debounce,
  _getTarget,
  imgjz,
  mixedSort,
  _mySlide,
  _progressBar,
  isImgFile,
  imgPreview,
  toLogin,
  darkMode,
  toCenter,
  toHide,
  showQcode,
  upStr,
  getbookmark,
  downloadText,
  getTextImg,
  getFiles,
  isInteger,
  _delDataTem,
  myDrag,
  isMobile,
  isDarkMode,
  longPress,
  copyText,
  isRoot,
  isEmail,
  isurl,
  parseObjectJson,
  changeHeadBtnSort,
  encodeHtml,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import {
  reqUerChangename,
  reqUserAccountState,
  reqUserAllowLogin,
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
import {
  chatRoomWrapIsHide,
  openFriend,
  setCurChatAccount,
} from '../chat/index.js';
import { popWindow, setZidx } from '../popWindow.js';
import { reqRootTips } from '../../../api/root.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { setExpireCount, showCountBox } from '../count_down/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import changeDark from '../../../js/utils/changeDark.js';
import { reqChatForwardMsgLink } from '../../../api/chat.js';
import md5 from '../../../js/utils/md5.js';
import { _tpl } from '../../../js/utils/template.js';
import _path from '../../../js/utils/path.js';
// local数据
let dark = _getData('dark'),
  pageGrayscale = _getData('pageGrayscale'),
  headBtnToRight = _getData('headBtnToRight'),
  tipsFlag = 0;
const $rightMenuMask = $('.right_menu_mask'),
  $rightBox = $rightMenuMask.find('.right_box'),
  $userInfoWrap = $('.user_info_wrap');
// 隐藏菜单
$rightMenuMask.on('click', function (e) {
  if (_getTarget(this, e, '.right_menu_mask', 1)) {
    hideRightMenu();
  }
});
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
  if (tipsFlag === 0 || tipsFlag === _getData('tipsFlag')) {
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
      <em v-if="num>0" style="display: inline-block;background-color: #ffffffd4;width: 20px;line-height: 20px;text-align: center;border-radius: 4px;color: #f56c6c;margin-left: 10px;
    ">{{num}}</em>
      </template>
      `,
        { num }
      )
    );
  $rightBox.find('.show_count span').html(
    _tpl(
      `
    <template>
    倒计时
    <em v-if="expireCount>0" style="display: inline-block;background-color: #ffffffd4;width: 20px;line-height: 20px;text-align: center;border-radius: 4px;color: #f56c6c;margin-left: 10px;
  ">{{expireCount}}</em>
    </template>
    `,
      { expireCount }
    )
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
          placeholder: '用户名',
          value: setUserInfo().username,
          verify(val) {
            if (val.length < 1 || val.length > _d.fieldLenght.username) {
              return `限制1-${_d.fieldLenght.username}位`;
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const username = inp.name;
        if (username === setUserInfo().username) return;
        reqUerChangename({
          username,
        })
          .then((result) => {
            if (result.code === 1) {
              close();
              _msg.success(result.codeText);
              if (!chatRoomWrapIsHide() && setCurChatAccount() === 'chang') {
                openFriend(setCurChatAccount(), true);
              }
              updateUserInfo();
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '修改用户名'
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
// 隐藏用户个人信息
export function hideUserInfo() {
  popWindow.remove('userinfo');
  toHide($userInfoWrap[0], { to: 'bottom', scale: 'small' });
}
// 上传头像
export async function upLogo(type, cb, id) {
  try {
    const files = await getFiles({
      accept: '.jpg,.jpeg,.png,.ico,.svg,.webp,.gif',
    });
    if (files.length === 0) return;
    const file = files[0];
    if (!isImgFile(file.name)) {
      _msg.error(`图片格式错误`);
      return;
    }
    const pro = new UpProgress(file.name);
    if (file.size <= 0 || file.size >= 5 * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片限制0-5M`);
      return;
    }
    const { HASH } = await md5.fileSlice(file, (percent) => {
      pro.loading(percent);
    });
    reqUserUpLogo(
      { HASH, name: file.name, type, id },
      file,
      function (percent) {
        pro.update(percent);
      }
    )
      .then((result) => {
        if (result.code === 1) {
          pro.close();
          cb && cb(result);
          return;
        }
        return Promise.reject();
      })
      .catch(() => {
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
    ({ e, id, close }) => {
      if (id === '1') {
        upLogo('userlogo', () => {
          close();
          if (!chatRoomWrapIsHide()) {
            openFriend(setCurChatAccount(), true);
          }
          updateUserInfo();
        });
      } else if (id === '2') {
        close();
        imgPreview([
          {
            u1: _path.normalize(
              `/api/pub/logo/${setUserInfo().account}/${setUserInfo().logo}`
            ),
          },
        ]);
      } else if (id === '3') {
        _pop(
          {
            e,
            text: '确认删除：头像？',
            confirm: { type: 'danger', text: '删除' },
          },
          (type) => {
            if (type === 'confirm') {
              reqUserDeleteLogo().then((res) => {
                if (res.code === 1) {
                  close();
                  updateUserInfo();
                }
              });
            }
          }
        );
      }
    },
    '头像选项'
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
            inputType: 'password',
          },
        },
      },
      debounce(
        function ({ e, inp, close }) {
          const pd = inp.pd;
          _pop(
            {
              e,
              text: '确认解绑：邮箱？',
              confirm: { type: 'danger', text: '解绑' },
            },
            (type) => {
              if (type === 'confirm') {
                reqUserBindEmail({ password: md5.getStringHash(pd) })
                  .then((result) => {
                    if (result.code === 1) {
                      close();
                      updateUserInfo();
                      _msg.success(result.codeText);
                    }
                  })
                  .catch(() => {});
              }
            }
          );
        },
        1000,
        true
      ),
      '请输入用户密码认证'
    );
  } else {
    rMenu.inpMenu(
      e,
      {
        items: {
          email: {
            beforeText: '验证邮箱：',
            inputType: 'email',
            verify(val) {
              if (!isEmail(val)) {
                return '请输入正确的邮箱';
              } else if (val.length > _d.fieldLenght.email) {
                return '邮箱过长';
              }
            },
          },
        },
      },
      debounce(
        ({ inp, close }) => {
          const email = inp.email;
          reqUserBindEmailCode({ email })
            .then((res) => {
              if (res.code === 1) {
                close();
                _msg.success(res.codeText);
                rMenu.inpMenu(
                  false,
                  {
                    items: {
                      pd: {
                        beforeText: '用户密码：',
                        inputType: 'password',
                      },
                      code: {
                        beforeText: '邮箱验证码：',
                        inputType: 'number',
                        verify(val) {
                          if (val === '') {
                            return '请输入验证码';
                          } else if (
                            val.length !== 6 ||
                            !isInteger(+val) ||
                            val < 0
                          ) {
                            return '请输入6位正整数';
                          }
                        },
                      },
                    },
                  },
                  debounce(
                    function ({ inp, close }) {
                      const pd = inp.pd;
                      const code = inp.code;
                      reqUserBindEmail({
                        password: md5.getStringHash(pd),
                        code,
                        email,
                      })
                        .then((result) => {
                          if (result.code === 1) {
                            close();
                            updateUserInfo();
                            _msg.success(result.codeText);
                          }
                        })
                        .catch(() => {});
                    },
                    1000,
                    true
                  ),
                  '绑定邮箱'
                );
              }
            })
            .catch(() => {});
        },
        1000,
        true
      ),
      '输入邮箱，获取验证码'
    );
  }
}
// 编辑消息转发接口
function handleForwardMsg(e) {
  const { forward_msg_state: state, forward_msg_link } = setUserInfo();
  const { link, type, header, body } = forward_msg_link;
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
        link: {
          beforeText: '接口地址：',
          value: link,
          type: 'textarea',
          placeholder:
            'https://api.xxx.com/xxx?text={{msg}} {{msg}} 会被替换为消息文本',
          verify(val, items) {
            if (
              items.state.value === 'y' &&
              !isurl(val) &&
              val.length > _d.fieldLenght.url
            ) {
              return '请输入正确的接口地址';
            }
          },
        },
        header: {
          beforeText: 'Header：',
          type: 'textarea',
          value: JSON.stringify(header, null, 2),
          placeholder: `{"user-agent": "xxxx"}`,
          verify(val, items) {
            if (items.state.value === 'y' && !parseObjectJson(val)) {
              return 'Header格式错误';
            }
          },
        },
        body: {
          beforeText: 'Body：',
          type: 'textarea',
          value: JSON.stringify(body, null, 2),
          placeholder: `{"text": "{{msg}}"}\n{{msg}} 会被替换为消息文本`,
          verify(val, items) {
            if (items.state.value === 'y' && !parseObjectJson(val)) {
              return 'Body格式错误';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        let { state, link, type, header, body } = inp;
        header = parseObjectJson(header) || {};
        body = parseObjectJson(body) || {};
        reqChatForwardMsgLink({
          state: state === 'y' ? 1 : 0,
          link,
          type,
          header,
          body,
        })
          .then((result) => {
            if (result.code === 1) {
              close(true);
              updateUserInfo();
              _msg.success(result.codeText);
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '编辑转发接口'
  );
}
// 用户信息
$userInfoWrap
  .on('click', '.edit_user_name', changeUsername)
  .on('click', '.forward_msg', handleForwardMsg)
  .on('click', '.bind_email', bindEmail)
  .on('click', '.dailybg', dailyChangeBg)
  .on('click', '.hide', hdHideState)
  .on('click', '.u_close_btn', hideUserInfo)
  .on('click', '.user_logo div', hdUserLogo);
// 更新用户信息
export function renderUserinfo() {
  let { username, logo, account } = setUserInfo();
  const html = _tpl(
    `
    <ul><li>用户</li><li>{{username}}</li><li cursor="y" class="edit_user_name">修改</li></ul>
    <ul><li>账号</li><li>{{account}}</li></ul>
    <ul><li>邮箱</li><li>{{email || '未绑定邮箱'}}</li><li cursor="y" class="bind_email">{{email ? '解绑' : '绑定'}}</li></ul>
    <ul><li>状态</li><li>开启隐身</li><li style="color: var(--icon-color);" class="hide iconfont {{hide && hide === 1 ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'}}" cursor="y"></li></ul>
    <ul><li>转发</li><li>消息转发至外部应用</li><li cursor="y" class="forward_msg">编辑</li></ul>
    <ul><li>壁纸</li><li>每日自动更换壁纸</li><li style="color: var(--icon-color);" class="dailybg iconfont {{daily_change_bg && daily_change_bg === 1 ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'}}" cursor="y"></li></ul>
    `,
    {
      ...setUserInfo(),
    }
  );
  $userInfoWrap.find('.user_list').html(html);
  logo = logo
    ? _path.normalize(`/api/pub/logo/${account}/${logo}`)
    : getTextImg(username);
  imgjz(
    logo,
    () => {
      $userInfoWrap
        .find('.user_logo div')
        .css('background-image', `url(${logo})`);
    },
    () => {
      $userInfoWrap
        .find('.user_logo div')
        .css('background-image', `url(${getTextImg(username)})`);
    }
  );
}
// 设置君子锁
function setGentlemanLock(e) {
  rMenu.inpMenu(
    e,
    {
      items: {
        text: {
          inputType: 'password',
          value: _getData('gentlemanLockPd'),
          trimValue: false,
          placeholder: '为空则取消',
          beforeText: '设置密码：',
        },
      },
    },
    debounce(
      function ({ inp, close }) {
        close();
        const text = inp.text;
        _setData('gentlemanLockPd', text);
        _delDataTem('gentlemanLockPd');
        if (text) {
          location.reload();
        } else {
          _msg.success();
        }
      },
      1000,
      true
    ),
    '防君子不防小人'
  );
}
// 设置字体
function setPageFont(e) {
  reqUserFontList()
    .then((res) => {
      if (res.code === 1) {
        res.data.sort((a, b) => mixedSort(a, b));
        res.data.unshift('default');
        const data = [];
        res.data.forEach((item, idx) => {
          let name = item.slice(0, -4);
          data.push({
            id: idx + 1 + '',
            text: item === 'default' ? '默认字体' : name,
            beforeText: (idx + 1 + '').padStart(2, '0') + '. ',
            param: { font: item },
            active: _getData('fontType') === item ? true : false,
          });
        });
        rMenu.selectMenu(
          e,
          data,
          ({ id, resetMenu, param }) => {
            if (id) {
              const font = param.font;
              _setData('fontType', font);
              data.forEach((item) => {
                if (font === item.param.font) {
                  item.active = true;
                } else {
                  item.active = false;
                }
              });
              resetMenu(data);
              handleFontType();
              const oIframe = [...document.querySelectorAll('iframe')];
              oIframe.forEach((item) => {
                item.contentWindow.handleFontType &&
                  item.contentWindow.handleFontType();
              });
            }
          },
          '选择字体'
        );
      }
    })
    .catch(() => {});
}
// 处理黑暗模式
function hdIframeDarkMode(dark) {
  [...document.querySelectorAll('iframe')].forEach((item) => {
    try {
      const html = item.contentWindow.document.documentElement;
      if (dark === 'y') {
        html.classList.add('dark');
      } else if (dark === 'n') {
        html.classList.remove('dark');
      } else if (dark === 's') {
        if (isDarkMode()) {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      }
      item.contentWindow.changeTheme && item.contentWindow.changeTheme(dark);
    } catch {}
  });
}
function hdIframeCloseBtnSortMode(flag) {
  [...document.querySelectorAll('iframe')].forEach((item) => {
    try {
      const html = item.contentWindow.document.documentElement;
      if (flag) {
        html.classList.add('head_btn_to_right');
      } else {
        html.classList.remove('head_btn_to_right');
      }
    } catch {}
  });
}
// 设置
export function settingMenu(e, isMain) {
  let icon = 'icon-xianshiqi';
  if (dark === 'y') {
    icon = 'icon-icon_yejian-yueliang';
  } else if (dark === 'n') {
    icon = 'icon-taiyangtianqi';
  }
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
      afterIcon:
        'iconfont ' +
        (headBtnToRight ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
      param: { value: headBtnToRight },
    },
  ];
  if (isMain) {
    data = [
      ...data,
      {
        id: '6',
        text: '新建笔记',
        beforeIcon: 'iconfont icon-jilu',
      },
      {
        id: '7',
        text: '隐藏所有窗口',
        beforeIcon: 'iconfont icon-minus-bold',
      },
      {
        id: '8',
        text: '关闭所有窗口',
        beforeIcon: 'iconfont icon-shibai',
      },
    ];
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, resetMenu, close, id, param }) => {
      if (id === '1') {
        close();
        showBgBox();
      } else if (id === '2') {
        setGentlemanLock(e);
      } else if (id === '3') {
        const clickLove = _getData('clickLove');
        const pmsound = _getData('pmsound');
        const tip = _getData('toolTip');
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
            afterIcon:
              'iconfont ' +
              (clickLove ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: clickLove },
          },
          {
            id: '5',
            text: '提示音',
            beforeIcon: 'iconfont icon-tongzhi',
            afterIcon:
              'iconfont ' +
              (pmsound ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: pmsound },
          },
        ];
        if (!isMobile()) {
          data.push({
            id: '6',
            text: '提示工具',
            beforeIcon: 'iconfont icon-tishi',
            afterIcon:
              'iconfont ' + (tip ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
            param: { value: tip },
          });
        }
        rMenu.selectMenu(
          e,
          data,
          ({ e, id, resetMenu, param }) => {
            if (id === '1') {
              // 模糊背景
              resizeBgFilter(e);
            } else if (id === '2') {
              // 黑白
              _progressBar(
                e,
                pageGrayscale,
                throttle(function (per) {
                  document.documentElement.style.filter = `grayscale(${per})`;
                  pageGrayscale = per;
                  _setData('pageGrayscale', per);
                }, 500)
              );
            } else if (id === '3') {
              // 字体列表
              setPageFont(e);
            } else if (id === '4') {
              // 点击效果设置
              if (param.value) {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-guan';
                data[id - 1].param.value = false;
                _msg.success('关闭成功');
                _setData('clickLove', false);
              } else {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-kai1';
                data[id - 1].param.value = true;
                _msg.success('开启成功');
                _setData('clickLove', true);
              }
              resetMenu(data);
            } else if (id === '5') {
              // 提示音
              if (param.value) {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-guan';
                data[id - 1].param.value = false;
                _msg.success('关闭成功');
                _setData('pmsound', false);
              } else {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-kai1';
                data[id - 1].param.value = true;
                _msg.success('开启成功');
                _setData('pmsound', true);
              }
              resetMenu(data);
            } else if (id === '6') {
              // 提示工具
              if (param.value) {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-guan';
                data[id - 1].param.value = false;
                _msg.success('关闭成功');
                _setData('toolTip', false);
              } else {
                data[id - 1].afterIcon = 'iconfont icon-kaiguan-kai1';
                data[id - 1].param.value = true;
                _msg.success('开启成功');
                _setData('toolTip', true);
              }
              resetMenu(data);
            }
          },
          '个性化设置'
        );
      } else if (id === '4') {
        // 黑暗模式
        const flag = param.value;
        if (flag === 'y') {
          dark = 'n';
          data[id - 1].beforeIcon = 'iconfont icon-taiyangtianqi';
          data[id - 1].param.value = dark;
          _setData('dark', dark);
          _msg.success('关闭成功');
        } else if (flag === 'n') {
          dark = 's';
          data[id - 1].beforeIcon = 'iconfont icon-xianshiqi';
          data[id - 1].param.value = dark;
          _setData('dark', dark);
          _msg.success('跟随系统');
        } else if (flag === 's') {
          dark = 'y';
          data[id - 1].beforeIcon = 'iconfont icon-icon_yejian-yueliang';
          data[id - 1].param.value = dark;
          _setData('dark', dark);
          _msg.success('开启成功');
        }
        darkMode(dark);
        resetMenu(data);
        hdIframeDarkMode(dark);
      } else if (id === '5') {
        if (param.value) {
          data[id - 1].afterIcon = 'iconfont icon-kaiguan-guan';
          data[id - 1].param.value = false;
          changeHeadBtnSort();
          hdIframeCloseBtnSortMode();
          _msg.success('关闭成功');
          headBtnToRight = false;
          _setData('headBtnToRight', false);
        } else {
          data[id - 1].afterIcon = 'iconfont icon-kaiguan-kai1';
          data[id - 1].param.value = true;
          changeHeadBtnSort(1);
          hdIframeCloseBtnSortMode(1);
          _msg.success('开启成功');
          headBtnToRight = true;
          _setData('headBtnToRight', true);
        }
        resetMenu(data);
      } else if (id === '7') {
        close();
        // 隐藏所有窗口
        hideAllwindow(1);
      } else if (id === '8') {
        close();
        // 关闭所有窗口
        closeAllwindow(1);
      } else if (id === '6') {
        close();
        openInIframe('/edit/#new', '新笔记');
      }
    },
    '设置'
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
    '管理员菜单'
  );
}
export function showRootPage() {
  if (!isRoot()) return;
  hideRightMenu();
  openInIframe(`/root`, '用户管理');
}
export function showLogPage() {
  if (!isRoot()) return;
  hideRightMenu();
  openInIframe(`/log`, '日志');
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
            if (val === '') {
              return '请输入需要生成字符';
            }
          },
        },
      },
    },
    debounce(
      function ({ e, inp, close }) {
        const text = inp.text;
        showQcode(e, text)
          .then(close)
          .catch(() => {});
      },
      1000,
      true
    ),
    '生成二维码'
  );
}
// 工具
function hdTools(e) {
  let data = [
    { id: '1', text: '笔记本', beforeIcon: 'iconfont icon-mingcheng-jiluben' },
    { id: '2', text: '文件管理', beforeIcon: 'iconfont icon-24gl-folder' },
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
          ({ e, close, id }) => {
            if (id === '1') {
              importBm(close);
            } else if (id === '2') {
              exportBm(e, close);
            }
          },
          '导入/导出书签'
        );
      } else if (id === '7') {
        close();
        showHistory();
      } else if (id === '8') {
        close();
        showBmk();
      }
    },
    '工具'
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
          placeholder: '原密码',
          inputType: 'password',
        },
        npass: {
          beforeText: '新密码：',
          placeholder: '新密码',
          inputType: 'password',
        },
        rpass: {
          placeholder: '确认密码',
          beforeText: '确认密码：',
          inputType: 'password',
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const oldpassword = inp.pass,
          newpassword = inp.npass,
          newpassword1 = inp.rpass;
        if (newpassword !== newpassword1) {
          _msg.error('密码不一致');
          return;
        }
        reqUserChangPd({
          oldpassword: md5.getStringHash(oldpassword),
          newpassword: md5.getStringHash(newpassword),
        })
          .then((result) => {
            if (result.code === 1) {
              close();
              _msg.success(result.codeText, () => {
                toLogin();
              });
              return;
            }
          })

          .catch(() => {});
      },
      500,
      true
    ),
    '修改密码'
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
        },
      },
    },
    debounce(
      function ({ e, inp, close }) {
        const pd = inp.pd;
        _pop(
          {
            e,
            text: '确认注销：账号？',
            confirm: { type: 'danger', text: '注销' },
          },
          (type) => {
            if (type === 'confirm') {
              reqUserAccountState({ password: md5.getStringHash(pd) })
                .then((result) => {
                  if (result.code === 1) {
                    close();
                    _delData();
                    _msg.success(result.codeText, (type) => {
                      if (type === 'close') {
                        myOpen('/login/');
                      }
                    });
                    return;
                  }
                })
                .catch(() => {});
            }
          }
        );
      },
      1000,
      true
    ),
    '请输入用户密码认证'
  );
}
// 批准登录
function allowLogin(e) {
  rMenu.inpMenu(
    e,
    {
      items: {
        text: {
          beforeText: '登录码：',
          inputType: 'number',
          verify(val) {
            if (val === '') {
              return '请输入登录码';
            } else if (val.length !== 6 || !isInteger(+val) || val < 0) {
              return '请输入6位正整数';
            }
          },
        },
      },
    },
    debounce(
      function ({ inp, close }) {
        if ($rightBox.isloding) {
          _msg.info('正在认证中');
          return;
        }
        const code = inp.text;
        $rightBox.isloding = true;
        let num = 0;
        let timer = setInterval(() => {
          _msg.botMsg(`认证中…${++num}`, 1);
        }, 1000);
        function closeLogin() {
          clearInterval(timer);
          timer = null;
          $rightBox.isloding = false;
          _msg.botMsg(`认证失败`, 1);
        }
        reqUserAllowLogin({ code })
          .then((res) => {
            closeLogin();
            if (res.code === 1) {
              close();
              _msg.success(res.codeText);
              _msg.botMsg(`认证成功`, 1);
            }
          })
          .catch(() => {
            closeLogin();
          });
      },
      1000,
      true
    ),
    '批准免密登录'
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
      id: '2',
      text: '批准免密登录',
      beforeIcon: 'iconfont icon-chengyuan',
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
    ({ e, close, id }) => {
      if (id === '1') {
        showUserInfo();
        close(true);
      } else if (id === '3') {
        changeUserPd(e);
      } else if (id === '5') {
        closeAccount(e);
      } else if (id === '2') {
        allowLogin(e);
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
                },
              },
            },
            debounce(
              function ({ e, inp, close }) {
                const pd = inp.pd;
                _pop({ e, text: '确认关闭：两步验证吗？' }, (type) => {
                  if (type === 'confirm') {
                    reqUserVerify({ password: md5.getStringHash(pd) })
                      .then((res) => {
                        if (res.code === 1) {
                          close(1);
                          updateUserInfo();
                          _msg.success(res.codeText);
                        }
                      })
                      .catch(() => {});
                  }
                });
              },
              1000,
              true
            ),
            '请输入用户密码认证'
          );
        } else {
          reqUserGetVerify()
            .then((res) => {
              if (res.code === 1) {
                hdVerifyLogin(e, res.data, account);
              }
            })
            .catch(() => {});
        }
      }
    },
    '账号管理'
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
    <img style="width:250px;height:250px" :data-src="url"/>
    <div cursor="y" title="点击复制密钥" class="item"><i class="title">密钥：</i><span class='text'>{{verify}}</span></div>
    <div style="text-align:left;"><button cursor="y" class="btn btn_primary">开启两步验证</button></div>
    `,
    {
      verify,
      url,
    }
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
              },
              text: {
                beforeText: '验证码：',
                inputType: 'number',
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
          debounce(
            function ({ inp, close }) {
              const token = inp.text;
              const pd = inp.pd;
              reqUserVerify({ token, password: md5.getStringHash(pd) })
                .then((res) => {
                  if (res.code === 1) {
                    close(1);
                    updateUserInfo();
                    _msg.success(res.codeText);
                  }
                })
                .catch(() => {});
            },
            1000,
            true
          ),
          '开启两步验证'
        );
      }
    },
    '配置两步验证'
  );
}
// 显示个人信息
export function showUserInfo() {
  hideRightMenu();
  renderUserinfo();
  $userInfoWrap.stop().fadeIn(_d.speed);
  toCenter($userInfoWrap[0]);
  setZidx($userInfoWrap[0], 'userinfo', hideUserInfo);
}
// 导入书签
function importBm(cb) {
  upStr()
    .then((res) => {
      if (!res) return;
      const list = hdImportBm(getbookmark(res));
      reqBmkImport({ list })
        .then((res) => {
          if (res.code === 1) {
            cb && cb();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {});
    })
    .catch(() => {
      _msg.error('导入文件格式错误');
    });
}
// 导出书签
function exportBm(e, cb) {
  _pop(
    {
      e,
      text: '确认导出？',
    },
    (type) => {
      if (type === 'confirm') {
        reqBmkExport()
          .then((res) => {
            downloadText(hdExportBm(res.data), 'bookmark.html');
            cb && cb();
          })
          .catch(() => {
            _msg.error('导出书签失败');
          });
      }
    }
  );
}
// 退出
function userLogout(e) {
  _pop(
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
    }
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
    ({ close, id }) => {
      if (id === 'close' || id === 'update') {
        reqRootTips({ flag: id })
          .then((res) => {
            if (res.code === 1) {
              close();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      }
    },
    'Tips提示状态'
  );
}
longPress($rightBox[0], '.tips', function (e) {
  if (!isRoot()) return;
  const ev = e.changedTouches[0];
  setTipsFlag(ev);
});
export function showTrash() {
  hideRightMenu();
  openInIframe('/trash', '回收站');
}
export function showNote() {
  hideRightMenu();
  openInIframe(`/notes/`, '笔记本');
}
export function showHistory() {
  hideRightMenu();
  openInIframe('/history/', '搜索历史');
}
export function showBmk() {
  hideRightMenu();
  openInIframe('/bmk/', '书签夹');
}
export function showFileManage() {
  hideRightMenu();
  openInIframe(`/file/`, '文件管理');
}
export function showNotepad() {
  hideRightMenu();
  openInIframe(`/notepad/`, '便条');
}
export function showPicture() {
  hideRightMenu();
  openInIframe(`/pic/`, '图床');
}
// 事件绑定
$rightBox
  .on('click', '.tools', hdTools)
  .on('click', '.account_manage', hdAccountManage)
  .on('click', '.user_name', showUserInfo)
  .on('click', '.r_about', function () {
    hideRightMenu();
    openInIframe('/note/?v=about', '关于');
  })
  .on('click', '.tips', function () {
    hideRightMenu();
    _setData('tipsFlag', tipsFlag);
    changeLogoAlertStatus();
    openInIframe('/note/?v=tips', 'Tips');
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
    openInIframe(`/sharelist/`, '分享列表');
  })
  .on('click', '.show_music_player', () => {
    showMusicPlayerBox();
  })
  .on('click', '.show_todo', showTodoBox)
  .on('click', '.show_count', showCountBox)
  .on('click', '.log_out', userLogout);
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
      str += `<DT><A HREF="${encodeHtml(y.link)}" data-des="${encodeHtml(
        y.des
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
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    target.style.transition = 'top 0.5s ease-in-out, left 0.5s ease-in-out';
    const h = window.innerHeight;
    if (y <= 0 || y >= h) {
      const { x, y } = target._op;
      target.style.top = y + 'px';
      target.style.left = x + 'px';
    } else {
      target._op = { x, y };
    }
  },
});
// 层级
function hdIndex(e) {
  if (_getTarget(this, e, '.user_info_wrap')) {
    setZidx($userInfoWrap[0], 'userinfo', hideUserInfo);
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
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
