import $ from 'jquery';
import imgGqImg from '../../../images/img/gqimg.png';
import imgVoice from '../../../images/img/voice.mp3';
import imgHelloLogo from '../../../images/img/hello-msg-logo.png';
import {
  throttle,
  debounce,
  playSound,
  getSelectText,
  _getTarget,
  imgjz,
  _mySlide,
  formatDate,
  copyText,
  computeSize,
  isImgFile,
  fileLogoType,
  downloadFile,
  imgPreview,
  sendNotification,
  ContentScroll,
  myDrag,
  toCenter,
  toHide,
  myResize,
  myToMax,
  myToRest,
  toSetSize,
  loadingImg,
  wrapInput,
  hdTextMsg,
  isMobile,
  getTextImg,
  getFiles,
  getPathFilename,
  getFilePath,
  _getDataTem,
  _setDataTem,
  hdPath,
  LazyLoad,
  mailTo,
  isRoot,
  _setData,
  _getData,
  isFullScreen,
  isVideoFile,
  concurrencyTasks,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import { UpProgress } from '../../../js/plugins/UpProgress';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import record from '../../../js/utils/recorder.js';
import {
  reqChatBreakpoint,
  reqChatDeleteMsg,
  reqChatExpired,
  reqChatforward,
  reqChatGetDes,
  reqChatMerge,
  reqChatNews,
  reqChatReadMsg,
  reqChatRepeat,
  reqChatSendMsg,
  reqChatSetDes,
  reqChatShakeMsg,
  reqChatUp,
  reqChatUpVoice,
  reqChatUserList,
} from '../../../api/chat.js';
import { showUserInfo } from '../rightSetting/index.js';
import { setUserInfo } from '../index.js';
import { backWindow, setZidx } from '../backWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import fileSlice from '../../../js/utils/fileSlice.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { _tpl } from '../../../js/utils/template.js';
const $document = $(document),
  $chatRoomWrap = $('.chat_room_wrap'),
  $userListBox = $chatRoomWrap.find('.user_list_box'),
  $chatHeadBtns = $chatRoomWrap.find('.c_head_btns'),
  $onlineStatus = $chatHeadBtns.find('.online_status'),
  $chatListBox = $chatRoomWrap.find('.chat_list_box'),
  $chatFootBox = $chatRoomWrap.find('.chat_foot_box'),
  $showChatRoomBtn = $('.show_chat_room_btn'),
  $chatAudio = $('.chat_ausio');
let curChatAccount = 'chang',
  userList = [],
  chatList = [],
  helperInfo = '用于接收提示信息和外部信息(回复任意信息查看收信接口API)',
  chatIsTop = _getData('chatIsTop');
function switchChatTop() {
  chatIsTop = !chatIsTop;
  setTop();
  _setData('chatIsTop', chatIsTop);
  setZidx($chatRoomWrap[0], 'chat', closeChatRoom, chatIsTop);
}
const closeShake = debounce((target) => {
  target.classList.remove('shake');
}, 500);
export function shakeChat() {
  const target = document.body;
  target.classList.add('shake');
  closeShake(target);
}
setTop();
function setTop() {
  if (chatIsTop) {
    $chatHeadBtns.find('.top').attr('class', 'top iconfont icon-zhiding1');
  } else {
    $chatHeadBtns.find('.top').attr('class', 'top iconfont icon-zhiding');
  }
}
// 修改当前聊天账号
export function setCurChatAccount(val) {
  if (val === undefined) {
    return curChatAccount;
  }
  curChatAccount = val;
}
// 聊天室是隐藏
export function chatRoomWrapIsHide() {
  return $chatRoomWrap.is(':hidden');
}
// 临时保存草稿
const temChatMsg = _getDataTem('temChatMsg') || {};
// 搜索消息框
const chatSearchInput = wrapInput(
  $chatHeadBtns.find('.search_msg_inp input')[0],
  {
    change(val) {
      val = val.trim();
      if (val == '') {
        $chatHeadBtns.find('.search_msg_inp i').css('display', 'none');
      } else {
        $chatHeadBtns.find('.search_msg_inp i').css('display', 'block');
      }
    },
    focus(target) {
      $(target).parent().addClass('focus');
    },
    blur(target) {
      $(target).parent().removeClass('focus');
    },
  }
);
// 搜索消息
const hdChatSearchInput = debounce(function () {
  const val = chatSearchInput.getValue().trim();
  if (val.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  const acc = curChatAccount;
  loadingImg($chatListBox.find('.chat_list')[0]);
  reqChatReadMsg({ type: 0, acc, word: val })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        if (chatRoomWrapIsHide()) return;
        const html = renderMsgList(result.data);
        $chatListBox.find('.chat_list').html(html);
        $chatListBox[0].scrollTop = $chatListBox[0].scrollHeight;
        chatimgLoad();
      }
    })
    .catch(() => {});
}, 1000);
let userPageNo = 1,
  userPageSize = 10,
  isForward = false, // 转发状态
  forwardData = null;
// 获取用户信息
function getUserItem(account) {
  return userList.find((item) => item.account == account);
}
const cUserListLoad = new LazyLoad();
// 获取用户列表
function getUserList(top) {
  if ($userListBox.children().length === 0) {
    userListLoading();
  }
  reqChatUserList({ pageNo: userPageNo, pageSize: userPageSize })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const { data, pageNo, totalPage, total } = result.data;
        userPageNo = pageNo;
        userList = data;
        renderUserList(pageNo, total, totalPage, top);
      }
    })
    .catch(() => {});
}
// 展示用户列表
function renderUserList(pageNo, total, totalPage, top) {
  if (chatRoomWrapIsHide() || $userListBox.is(':hidden')) return;
  const html = _tpl(
    `
    <ul v-for="{username, account, online, des = '', islook} in userList" :data-account="account" class="user_item">
      <i :x="islook" class="msg_alert"></i>
      <li cursor="y" class="user_logo" style="{{online === 'y' ? '' : 'filter: grayscale(1);'}}"></li>
      <li cursor="y" class="user_name">{{getUsername(account,username,des)}}</li>
      <li v-if="account !== 'hello'" :cursor="online === 'y' ? 'y' : ''" :style=getStyle(account,online) class="online iconfont icon-tuichudenglu1"></li>
    </ul>
    <div v-if="totalPage > 1" v-html="getPaging()"></div>
      `,
    {
      userList,
      totalPage,
      getUsername(account, username, des) {
        if (setUserInfo().account == account) {
          username = '文件传输助手';
        }
        return des || username;
      },
      getStyle(account, online) {
        let color = 'var(--color6)';
        if (setUserInfo().account == account) {
          if (setUserInfo().hide === 'y') {
            color = '#e9d00c';
          } else {
            if (online === 'y') {
              color = 'green';
            }
          }
        } else {
          if (online === 'y') {
            color = 'green';
          }
        }
        return { color };
      },
      isMe(account) {
        return setUserInfo().account == account;
      },
      getPaging() {
        return pgnt.getHTML({ pageNo, total, pageSize: userPageSize });
      },
    }
  );
  $userListBox.html(html);
  if (top) {
    $userListBox.scrollTop(0);
  }
  $chatHeadBtns.find('.c_msg_alert').stop().fadeOut(_d.speed);
  lazyLoadChatLogo();
}
// 分页
const pgnt = pagination($userListBox[0], {
  pageSize: userPageSize,
  select: [10, 20, 40, 60, 100],
  showTotal: false,
  small: true,
  toTop: false,
  change(val) {
    userPageNo = val;
    getUserList(true);
  },
  changeSize(val) {
    userPageSize = val;
    userPageNo = 1;
    getUserList(true);
  },
});
// 懒加载图片
function lazyLoadChatLogo() {
  cUserListLoad.bind($userListBox[0].querySelectorAll('.user_logo'), (item) => {
    const $item = $(item);
    let {
      username,
      account,
      logo,
      des = '',
    } = getUserItem($item.parent().data('account'));
    logo = logo
      ? hdPath(`/api/pub/logo/${account}/${logo}`)
      : getTextImg(des || username);
    if (account === 'hello') {
      logo = imgHelloLogo;
    }
    imgjz(
      logo,
      () => {
        $item
          .css({
            'background-image': `url(${logo})`,
          })
          .addClass('load');
      },
      () => {
        $item
          .css({
            'background-image': `url(${getTextImg(des || username)})`,
          })
          .addClass('load');
      }
    );
  });
}
// 关闭聊天室
export function closeChatRoom() {
  toHide($chatRoomWrap[0], { to: 'bottom', scale: 'small' }, () => {
    backWindow.remove('chat');
    chatTitleScroll.close();
    $chatListBox.find('.chat_list').html('');
    chatSearchInput.setValue('');
    cImgLoad.unBind();
    cUserListLoad.unBind();
    cUserLogoLoad.unBind();
    updateOnlineStatus.clear();
  });
}
// 清空消息
function clearMsg(e) {
  const acc = curChatAccount;
  if (acc === 'chang' && !isRoot()) {
    _msg.error('没有权限操作');
    return;
  }
  _pop(
    {
      e,
      text: `确认清空：聊天记录？`,
      confirm: { type: 'danger', text: '清空' },
    },
    (type) => {
      if (type == 'confirm') {
        reqChatDeleteMsg({ acc })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              _msg.success(result.codeText);
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 处理转发信息
function hdforwardMsg(e, acc) {
  let text = '确认转发信息到：聊天室？';
  if (acc !== 'chang') {
    const user = getUserItem(acc);
    text = `确认转发信息给：${user.des || user.username}？`;
  }
  _pop({ e, text, cancel: { text: '取消转发' } }, (type) => {
    if (type === 'confirm') {
      reqChatforward({ to: acc, id: forwardData.id })
        .then((res) => {
          if (res.code == 0) {
            isForward = false;
            _msg.success(res.codeText);
          }
        })
        .catch(() => {});
    } else if (type === 'cancel') {
      isForward = false;
    }
  });
}
$chatHeadBtns
  .on('click', '.c_close_btn', closeChatRoom)
  .on('click', '.clear_msg_btn', clearMsg)
  .on('click', '.top', switchChatTop)
  .on(
    'click',
    '.chat_home_btn',
    throttle(function (e) {
      if (isForward) {
        hdforwardMsg(e, 'chang');
        return;
      }
      openFriend('chang');
    }, 2000)
  )
  .on('input', '.search_msg_inp input', function () {
    hdChatSearchInput();
  })
  .on('click', '.search_msg_inp i', function () {
    chatSearchInput.setValue('');
    chatSearchInput.target.focus();
    hdChatSearchInput();
  })
  .on(
    'click',
    '.c_user_btn',
    debounce(
      function () {
        userPageNo = 1;
        $userListBox.stop().slideDown(_d.speed, () => {
          getUserList(true);
        });
      },
      500,
      true
    )
  );
// 获取消息数据
function getChatItem(id) {
  return chatList.find((item) => item.id == id);
}
// 生成消息列表
export function renderMsgList(carr, isAdd) {
  if (carr.length === 0) return '';
  if (isAdd) {
    carr = carr.filter((item) => !chatList.some((y) => y.id === item.id));
    chatList = [...chatList, ...carr];
  } else {
    chatList = carr;
  }
  const html = _tpl(
    `
    <template v-for="{id,data,time,_from,_to,name,size,showTime,type,des = ''} in carr">
      <div v-if="showTime === 'y'" class="chat_time">{{getDate(time)[0]}}</div>
      <ul class="chat_item" :data-id="id">
        <li v-if="isRight(_from)" cursor="y" class="chat_menu_btn iconfont icon-icon"></li>
        <li v-else cursor="y" class="c_left_logo">
          <div class="c_logo" style="float: left;"></div>
        </li>
        <li class="c_content_box">
          <span class="c_user_name" style="text-align: {{!isRight(_from) ? 'left' : 'right'}};">
            {{getUsername(name,des,_to)}} <span>{{getDate(time)[1]}}</span>
          </span>
          <div v-if="type == 'image'" cursor="y" title="data" class="c_img_msg_box" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
            <div class="c_img"><span>{{size}}</span></div>
          </div>
          <div v-else-if="type == 'voice'" cursor="y" 
            class="c_voice_msg_box {{isRight(_from) ? 'bcolor' : ''}}" 
            style="float: {{!isRight(_from) ? 'left' : 'right'}};width: {{(parseFloat(size) / 30) * 100}}%;text-align:{{isRight(_from) ? 'right' : 'left'}}">
            <template v-if="isRight(_from)">
              <span class="c_right_triangle bcolor"></span>
              <span style="font-size:12px;">{{size}}</span>
              <i class="iconfont icon-yuyin-cuxiantiao"></i>
            </template>
            <template v-else>
              <span class="c_left_triangle"></span>
              <i class="iconfont icon-yuyin1"></i>
              <span style="font-size:12px;">{{size}}</span>
            </template>
          </div>
          <div v-else-if="type == 'file'" :title="data" class="c_file_msg_box" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
            <div cursor="y" class="c_file_info">
              <span class="file_name">{{data}}</span>
              <span class="file_size">{{size}}</span>
            </div>
            <div class="file_type iconfont {{fileLogoType(data)}}"></div>
            <span class="{{isRight(_from) ? 'c_right_triangle' : 'c_left_triangle'}}"></span>
          </div>
          <p v-else-if="type == 'text'" class="c_text_msg_box {{isRight(_from) ? 'bcolor' : ''}}" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
            <div v-html="hdTextMsg(data)"></div>
            <span class="{{isRight(_from)?'c_right_triangle bcolor':'c_left_triangle'}}"></span>
          </p>
        </li>
        <li v-if="isRight(_from)" cursor="y" class="c_right_logo">
          <div class="c_logo" style="float: right;"></div>
        </li>
        <li v-else cursor="y" class="chat_menu_btn iconfont icon-icon"></li>
      </ul>
    </template>
    `,
    {
      carr,
      getDate(time) {
        return formatDate({
          template: '{0}-{1}-{2} {3}:{4}',
          timestamp: time,
        }).split(' ');
      },
      hdTextMsg,
      isRight(_from) {
        return _from === setUserInfo().account ? true : false;
      },
      getUsername(name, des, _to) {
        if (_to === 'chang') {
          return des || name || '未知';
        }
        return '';
      },
      fileLogoType,
    }
  );
  return html;
}
// 聊天图片
const cImgLoad = new LazyLoad();
const cUserLogoLoad = new LazyLoad();
export function chatimgLoad() {
  cImgLoad.bind($chatListBox[0].querySelectorAll('.c_img'), (item) => {
    const $v = $(item);
    const url = getFilePath(
      `/upload/${$v.parent().parent().parent().data('id')}`,
      1
    );
    imgjz(
      url,
      () => {
        $v.css({
          'background-image': `url(${url})`,
        }).addClass('load');
      },
      () => {
        $v.css({
          'background-image': `url(${imgGqImg})`,
        }).addClass('load');
      }
    );
  });
  cUserLogoLoad.bind($chatListBox[0].querySelectorAll('.c_logo'), (item) => {
    const $item = $(item);
    let {
      des = '',
      name,
      logo,
      _from,
    } = getChatItem($item.parent().parent().data('id'));
    logo = logo
      ? hdPath(`/api/pub/logo/${_from}/${logo}`)
      : getTextImg(des || name);
    if (_from === 'hello') {
      logo = imgHelloLogo;
    }
    imgjz(
      logo,
      () => {
        $item
          .css({
            'background-image': `url(${logo})`,
          })
          .addClass('load');
      },
      () => {
        $item
          .css({
            'background-image': `url(${getTextImg(des || name)})`,
          })
          .addClass('load');
      }
    );
  });
}

// 聊天通知
export function chatMessageNotification(name, data, from, to, logo) {
  _msg.msg(
    {
      message: `${name}: ${data}`,
      type: 'warning',
      icon: 'iconfont icon-zaixianzixun',
      duration: 8000,
    },
    (type) => {
      if (type == 'click') {
        curChatAccount = to == 'chang' ? to : from;
        chatSearchInput.setValue('');
        showChatRoom();
      }
    },
    1
  );
  logo = logo ? hdPath(`/api/pub/logo/${from}/${logo}`) : getTextImg(name);
  if (from === 'hello') {
    logo = imgHelloLogo;
  }
  // 页面变为不可见时触发
  if (document.visibilityState == 'hidden') {
    sendNotification(
      {
        title: name + '：',
        body: data,
        icon: logo,
      },
      () => {
        curChatAccount = to == 'chang' ? to : from;
        chatSearchInput.setValue('');
        showChatRoom();
      }
    );
  }
}
//打开聊天窗
export function showChatRoom() {
  const chatAcc = curChatAccount;
  $showChatRoomBtn.attr('class', 'show_chat_room_btn iconfont icon-liaotian');
  setZidx($chatRoomWrap[0], 'chat', closeChatRoom, chatIsTop);
  //隐藏主页消息提示
  $chatRoomWrap.stop().fadeIn(_d.speed, () => {
    openFriend(chatAcc, false, () => {
      reqChatNews()
        .then((result) => {
          if (parseInt(result.code) === 0) {
            const { group, friend } = result.data;
            if (friend > 0) {
              $chatHeadBtns.find('.c_msg_alert').stop().fadeIn(_d.speed);
            } else {
              $chatHeadBtns.find('.c_msg_alert').stop().fadeOut(_d.speed);
            }
            if (group > 0) {
              $chatHeadBtns.find('.c_home_msg_alert').stop().fadeIn(_d.speed);
            } else {
              $chatHeadBtns.find('.c_home_msg_alert').stop().fadeOut(_d.speed);
            }
          }
        })
        .catch(() => {});
    });
  });
  if (!$chatRoomWrap._once) {
    $chatRoomWrap._once = true;
    toSetSize($chatRoomWrap[0], 600, 800);
    toCenter($chatRoomWrap[0]);
  }
}
$showChatRoomBtn.on('click', debounce(showChatRoom, 500, true));
// 隐藏回到底部按钮
const hideBackBotBtn = debounce(function () {
  $chatRoomWrap.find('.scroll_to_bot_btn').fadeOut(_d.speed);
}, 5000);
// 用户菜单
function userMenu(e, msgObj, isUserList) {
  const { _from, name, des, logo, email } = msgObj;
  if (_from === 'hello') {
    rMenu.rightInfo(e, helperInfo, '助手功能');
    return;
  }
  const chatAcc = curChatAccount;
  let data = [
    {
      id: '1',
      text: name,
      beforeIcon: 'iconfont icon-zhanghao',
    },
  ];
  if (logo) {
    data.push({
      id: '5',
      text: '头像',
      beforeIcon: 'iconfont icon-yanjing_xianshi_o',
    });
  }
  if (chatAcc == 'chang' || isUserList) {
    data.push({
      id: '2',
      text: '发送消息',
      beforeIcon: 'iconfont icon-huaban',
    });
  }
  data = [
    ...data,
    {
      id: '3',
      text: '笔记本',
      beforeIcon: 'iconfont icon-mingcheng-jiluben',
    },
    {
      id: '4',
      text: '书签夹',
      beforeIcon: 'iconfont icon-shuqian',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id }) => {
      if (id == '2') {
        close();
        openFriend(_from);
      } else if (id == '3') {
        let url = `/notes/?acc=${_from}`;
        openInIframe(url, (des || name) + '的笔记本');
        close();
      } else if (id == '1') {
        const data = [
          {
            id: '1',
            text: des,
            beforeText: '备注：',
          },
          {
            id: '2',
            text: _from,
            beforeText: '账号：',
          },
        ];
        if (email) {
          data.push({
            id: '3',
            text: email,
            beforeText: '邮箱：',
          });
        }
        rMenu.selectMenu(
          e,
          data,
          ({ e, id }) => {
            if (id == '1') {
              rMenu.inpMenu(
                e,
                {
                  subText: '提交',
                  items: {
                    text: {
                      placeholder: '备注',
                      value: des,
                      verify(val) {
                        if (val.trim().length > 20) {
                          return '请输入0-20位';
                        }
                      },
                    },
                  },
                },
                debounce(
                  function ({ close, inp }) {
                    const des = inp.text;
                    reqChatSetDes({ acc: _from, des })
                      .then((res) => {
                        if (res.code == 0) {
                          _msg.success(res.codeText);
                          close(true);
                          if (curChatAccount == 'chang') {
                            openFriend(curChatAccount, true);
                          } else if (curChatAccount == _from) {
                            setChatTitle(curChatAccount);
                          }
                          if (isUserList) {
                            userPageNo = 1;
                            getUserList(true);
                          }
                        }
                      })
                      .catch(() => {});
                  },
                  1000,
                  true
                ),
                '设置备注'
              );
            } else if (id == '2') {
              copyText(_from);
            } else if (id == '3') {
              mailTo(email);
            }
          },
          '用户信息'
        );
      } else if (id == '4') {
        close();
        openInIframe(`/bmk/#${_from}`, (des || name) + '的书签夹');
      } else if (id == '5') {
        imgPreview([{ u1: hdPath(`/api/pub/logo/${_from}/${logo}`) }]);
        close();
      }
    },
    des || name
  );
}
// 打开文件
function openChatFile() {
  const $this = $(this).parent().parent();
  const obj = getChatItem($this.data('id'));
  const msgId = obj.id,
    name = obj.data;
  //查看文件是否过期
  reqChatExpired({ hash: obj.hash })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const { isText } = result.data;
        if (isText) {
          downloadFile(getFilePath(`/upload/${msgId}`), name);
        } else {
          if (isVideoFile(name)) {
            openInIframe(
              `/videoplay/#${encodeURIComponent(
                getFilePath(`/upload/${msgId}`)
              )}`,
              name
            );
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(name)) {
            openInIframe(getFilePath(`/upload/${msgId}`), name);
          } else {
            downloadFile(getFilePath(`/upload/${msgId}`), name);
          }
        }
        return;
      }
      _msg.error('文件已过期');
    })
    .catch(() => {});
}
// 打开图片
function openChatImg() {
  const id = $(this).parent().parent().parent().attr('data-id');
  const obj = getChatItem(id);
  // 检查图片是否过期
  reqChatExpired({ hash: obj.hash })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        imgPreview([
          {
            u1: getFilePath(`/upload/${id}`),
            u2: getFilePath(`/upload/${id}`, 1),
          },
        ]);
        return;
      }
      _msg.error('图片已过期');
    })
    .catch(() => {});
}
// 加载顶部消息
function scrollTopMsg() {
  //向上滚动获取前面聊天内容
  const $nomore = $chatListBox.find('.nomore');
  if (
    $chatListBox.find('.chat_list').outerHeight() <
      $chatListBox.outerHeight() ||
    $nomore.length > 0
  )
    return;
  if (this.scrollTop <= 30) {
    const $fristEl = $chatListBox.find('.chat_item').eq(0);
    if ($fristEl.length === 0) return;
    const flag = $fristEl.attr('data-id');
    const word = chatSearchInput.getValue().trim();
    if (word.length > 100) {
      _msg.error('搜索内容过长');
      return;
    }
    reqChatReadMsg({
      flag,
      acc: curChatAccount,
      type: 1,
      word,
    })
      .then((result) => {
        if (parseInt(result.code) === 0) {
          if (chatRoomWrapIsHide()) return;
          let html = renderMsgList(result.data, 1);
          if (html === '') {
            html += `<div class="nomore" style="text-align: center;font-size: 14px;color: var(--text-hover-color);">没有更多了<div>`;
          }
          $chatListBox.find('.chat_list').prepend(html);
          $chatListBox.scrollTop($fristEl.position().top - 50);
          chatimgLoad();
        }
      })
      .catch(() => {});
  }
}
$chatListBox
  .on('click', '.c_logo', function (e) {
    const $this = $(this).parent().parent();
    const obj = getChatItem($this.data('id'));
    const from = obj._from;
    if (from === setUserInfo().account) {
      showUserInfo();
      return;
    }
    userMenu(e, obj);
  })
  .on('click', '.c_file_msg_box', openChatFile)
  .on('click', '.c_text_msg_box', function (e) {
    if (getSelectText() !== '') return;
    chatMsgMenu(e, getChatItem($(this).parent().parent().data('id')));
  })
  .on('contextmenu', '.c_content_box', function (e) {
    if (getSelectText() !== '') return;
    //操作消息
    e.preventDefault();
    if (isMobile()) return;
    chatMsgMenu(e, getChatItem($(this).parent().data('id')));
  })
  .on('click', '.chat_menu_btn', function (e) {
    chatMsgMenu(e, getChatItem($(this).parent().data('id')));
  })
  .on('click', '.c_voice_msg_box', function () {
    playVoice(
      getFilePath(`/upload/${$(this).parent().parent().attr('data-id')}`),
      this
    );
  })
  .on('click', '.c_img', openChatImg)
  .on('scroll', function () {
    $chatRoomWrap.find('.scroll_to_bot_btn').fadeIn(_d.speed);
    hideBackBotBtn();
  })
  .on('scroll', debounce(scrollTopMsg, 200));
// 回到底部
$chatRoomWrap.on('click', '.scroll_to_bot_btn', function () {
  $chatListBox.animate(
    {
      scrollTop: $chatListBox[0].scrollHeight,
    },
    _d.speed
  );
});
// 消息菜单
function chatMsgMenu(e, cobj) {
  const chatAcc = curChatAccount;
  const { type, _from, id: tt, data: z, hash } = cobj;
  let data = [];
  if (type == 'text') {
    data = [
      {
        id: '1',
        text: '复制',
        beforeIcon: 'iconfont icon-fuzhi',
      },
      {
        id: '2',
        text: '编辑',
        beforeIcon: 'iconfont icon-bianji',
      },
      {
        id: '6',
        text: '保存到笔记',
        beforeIcon: 'iconfont icon-jilu',
      },
    ];
  } else {
    data = [
      {
        id: '3',
        text: '下载',
        beforeIcon: 'iconfont icon-xiazai1',
      },
    ];
  }
  data.push({
    id: '5',
    text: '转发',
    beforeIcon: 'iconfont icon-fenxiang_2',
  });
  if (_from === setUserInfo().account) {
    data.push({
      id: '4',
      text: '撤回',
      beforeIcon: 'iconfont icon-chexiao',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ close, id, e }) => {
      if (id == '4') {
        _pop(
          {
            e,
            text: `确认撤回：消息？`,
          },
          (type) => {
            if (type == 'confirm') {
              reqChatDeleteMsg({ id: tt, acc: chatAcc })
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
      } else if (id == '1') {
        copyText(z);
        close();
      } else if (id == '2') {
        chatMsgInp.setValue(z);
        chatMsgInp.target.focus();
        close();
      } else if (id == '3') {
        let flag = null;
        if (type == 'image') {
          flag = '图片';
        } else if (type == 'voice') {
          flag = '语音';
        } else if (type == 'file') {
          flag = '文件';
        }
        if (!flag) return;
        reqChatExpired({ hash })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close();
              downloadFile(getFilePath(`/upload/${tt}`), z);
              return;
            }
            _msg.error(`${flag}已过期`);
          })
          .catch(() => {});
      } else if (id == '5') {
        isForward = true;
        forwardData = cobj;
        close();
        userPageNo = 1;
        $userListBox.stop().slideDown(_d.speed, () => {
          getUserList(true);
        });
      } else if (id == '6') {
        close();
        _setData('newNote', z);
        openInIframe('/edit/#new', '新笔记');
      }
    },
    cobj.data
  );
}
// 播放语音
function playVoice(a, _this) {
  const pflag = $chatAudio.playflag,
    _flag = getPathFilename(a)[1];
  $chatAudio[0].pause();
  $chatListBox.find('.c_voice_msg_box i').css('animation', 'none');
  if (pflag === _flag) {
    $chatAudio.playflag = '';
    return;
  }
  $chatAudio.playflag = _flag;
  $chatAudio[0].src = a;
  $chatAudio[0].play();
  $(_this)
    .children('i')
    .css('animation', 'fontcolor .5s infinite linear alternate');
}
$chatAudio
  .on('ended', function () {
    $chatAudio.playflag = '';
    $chatListBox.find('.c_voice_msg_box i').css('animation', 'none');
  })
  .on('error', function () {
    _msg.error('语音已过期');
    $chatAudio.playflag = '';
    $chatListBox.find('.c_voice_msg_box i').css('animation', 'none');
  });
// 发送文本消息
function sendTextMsg() {
  const chatAcc = curChatAccount,
    data = chatMsgInp.getValue().trim();
  if (data.length > 2500) {
    _msg.error('发送内容过长');
    return;
  }
  $chatFootBox
    .find('.c_sent_msg_btn')
    .attr('x', 1)
    .children('i')
    .attr('class', 'iconfont icon-jiahao');
  chatMsgInp.setValue('');
  if (data === '') return;
  const obj = {
    data,
    type: 'text',
  };
  sendChatMsg(obj, chatAcc);
}
// 发送消息
function sendChatMsg(obj, chatAcc) {
  reqChatSendMsg({
    _to: chatAcc,
    data: obj.data,
    size: obj.size,
    hash: obj.hash,
    type: obj.type,
  })
    .then(() => {})
    .catch(() => {});
}
function switchShakeBtn() {
  const $shakeBtn = $chatFootBox.find('.c_sent_shake_btn');
  if (
    curChatAccount === 'chang' ||
    curChatAccount === 'hello' ||
    chatMsgInp.getValue() ||
    curChatAccount === setUserInfo().account
  ) {
    $shakeBtn.css('display', 'none');
  } else {
    $shakeBtn.css('display', 'block');
  }
}
// 搜索消息框
const chatMsgInp = wrapInput(
  $chatFootBox.find('.c_text_msg .c_text_content')[0],
  {
    change(val) {
      if (val.length > 2500) {
        val = val.slice(0, 2500);
      }
      $chatFootBox.find('.c_text_msg .fill_height').text(val);
      temChatMsg[curChatAccount] = val;
      _setDataTem('temChatMsg', temChatMsg);
      switchShakeBtn();
      if (val.trim() === '') {
        $chatFootBox.find('.clean').removeClass('show');
        $chatFootBox
          .find('.c_sent_msg_btn')
          .attr('x', 1)
          .children('i')
          .attr('class', 'iconfont icon-jiahao');
      } else {
        $chatFootBox.find('.clean').addClass('show');
        $chatFootBox
          .find('.c_sent_msg_btn')
          .attr('x', 2)
          .children('i')
          .attr('class', 'iconfont icon-huaban');
      }
    },
    focus(target) {
      $(target).addClass('focus');
    },
    blur(target) {
      $(target).removeClass('focus');
    },
  }
);
$chatFootBox
  .on('click', '.c_sent_msg_btn', async function () {
    if ($(this).attr('x') == 1) {
      const chatAcc = curChatAccount;
      const files = await getFiles({ multiple: true });
      if (files.length == 0) return;
      sendfile(files, chatAcc);
    } else {
      sendTextMsg();
    }
  })
  .on('click', '.clean', function () {
    chatMsgInp.setValue('');
    chatMsgInp.target.focus();
  })
  .on(
    'click',
    '.c_sent_shake_btn',
    throttle(() => {
      reqChatShakeMsg({ acc: curChatAccount })
        .then((res) => {
          if (res.code == 0) {
            _msg.success();
          }
        })
        .catch(() => {});
    }, 1000)
  )
  .on('click', '.c_change_btn', function () {
    const $this = $(this);
    if ($this.attr('x') == 1) {
      $chatFootBox.find('.c_get_voice_btn').css('display', 'block');
      $chatFootBox.find('.c_text_msg').css('display', 'none');
      $this.attr('x', 2).children('i').attr('class', 'iconfont icon-w_jianpan');
      $chatFootBox
        .find('.c_sent_msg_btn')
        .attr('x', 1)
        .children('i')
        .attr('class', 'iconfont icon-jiahao');
    } else {
      $chatFootBox.find('.c_get_voice_btn').css('display', 'none');
      $chatFootBox.find('.c_text_msg').css('display', 'block');
      $this.attr('x', 1).children('i').attr('class', 'iconfont icon-yuyin');
    }
  })
  .on('keyup', '.c_text_content', function (e) {
    let key = e.key,
      ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && key === 'Enter') {
      sendTextMsg();
      e.preventDefault();
    }
  })
  .find('.c_text_content')[0]
  // 粘贴发送文件
  .addEventListener('paste', function (e) {
    let files = [];
    let data = e.clipboardData || window.clipboardData;
    [...data.items].forEach((item) => {
      let blob = item.getAsFile();
      if (blob) {
        files.push(blob);
      }
    });
    const chatAcc = curChatAccount;
    if (files.length == 0) return;
    e.preventDefault();
    sendfile(files, chatAcc);
  });
// 拖拽发送文件
~(function () {
  const chatRoom = $chatRoomWrap[0];
  chatRoom.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  chatRoom.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  chatRoom.addEventListener('drop', function (e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files],
      chatAcc = curChatAccount;
    if (files.length == 0) return;
    sendfile(files, chatAcc);
  });
})();
// 发送文件
async function sendfile(files, chatAcc) {
  await concurrencyTasks(files, 5, async (file) => {
    const { name, size } = file;
    const pro = new UpProgress(name);
    if (size == 0) {
      pro.fail('发送失败');
      _msg.error(`不能发送空文件`);
      return;
    }
    try {
      const { chunks, count, HASH } = await fileSlice(file, (percent) => {
        pro.loading(percent);
      });
      const breakpointarr = (await reqChatBreakpoint({ HASH })).data, //断点续传
        isrepeat = await reqChatRepeat({
          HASH,
        }), //是否已经存在文件
        obj = {
          size: computeSize(size),
          data: name,
          type: isImgFile(name) ? 'image' : 'file',
        }; //生成消息对象

      function compale(index) {
        pro.update(index / count);
      }

      if (parseInt(isrepeat.code) === 0) {
        //文件已经存在操作
        pro.close('发送成功');
        const { id } = isrepeat.data;
        obj.hash = id;
        sendChatMsg(obj, chatAcc);
        return;
      }

      let index = breakpointarr.length;
      compale(index);
      await concurrencyTasks(chunks, 5, async (chunk) => {
        const { filename, file } = chunk;
        if (breakpointarr.includes(filename)) return;
        await reqChatUp(
          {
            name: filename,
            HASH,
          },
          file
        );
        index++;
        compale(index);
      });
      try {
        const mergeRes = await reqChatMerge({
          HASH,
          count,
          name,
          _to: chatAcc,
          size: obj.size,
          type: obj.type,
        }); //合并切片
        if (parseInt(mergeRes.code) === 0) {
          pro.close('发送成功');
        } else {
          pro.close('发送失败');
        }
      } catch (error) {
        if (error.statusText == 'timeout') {
          pro.close('处理文件中');
        } else {
          pro.close('发送失败');
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      pro.close('发送失败');
    }
  });
}
// 语音发送
function upVoice(blob, duration) {
  if (!blob) {
    _msg.error('发送失败');
    return;
  }
  if (duration < 2) {
    _msg.error('语音最短2s');
    return;
  }
  if (duration > 30) {
    _msg.error('语音最长30s');
    return;
  }
  const chatAcc = curChatAccount;
  const pro = new UpProgress(`语音`);
  fileSlice(blob, function (percent) {
    pro.update(percent);
  }).then((buf) => {
    const { HASH } = buf;
    reqChatUpVoice(
      {
        HASH,
        name: `${HASH}.wav`,
        _to: chatAcc,
        size: duration + 's',
      },
      blob,
      (percent) => {
        pro.update(percent);
      }
    )
      .then((res) => {
        if (res.code == 0) {
          pro.close('发送成功');
          playSound(imgVoice);
        }
      })
      .catch(() => {
        pro.fail('发送失败');
      });
  });
}
~(function () {
  let x = null,
    y = null;
  $chatFootBox
    .find('.c_get_voice_btn')
    .on('touchstart', function (e) {
      e.preventDefault();
      if (!isMobile()) return;
      $chatFootBox.find('.c_get_voice_btn').addClass('gren');
      x = e.changedTouches[0].clientX;
      y = e.changedTouches[0].clientY;
      record.start();
    })
    .on('touchend', function (e) {
      e.preventDefault();
      if (!isMobile()) return;
      $chatFootBox.find('.c_get_voice_btn').removeClass('gren');
      const xx = e.changedTouches[0].clientX,
        yy = e.changedTouches[0].clientY;
      if (Math.abs(x - xx) > 60 || Math.abs(y - yy) > 60) {
        record.stop();
        return;
      }
      const { blob, duration } = record.stop();
      upVoice(blob, duration);
    })
    .on('mousedown', function () {
      if (isMobile()) return;
      $chatFootBox.find('.c_get_voice_btn').addClass('gren');
      record.start();
    });
  $document.on('mouseup', function (e) {
    if (isMobile()) return;
    $chatFootBox.find('.c_get_voice_btn').removeClass('gren');
    if (_getTarget(this, e, '.chat_foot_box .c_get_voice_btn')) {
      const { blob, duration } = record.stop();
      upVoice(blob, duration);
    } else {
      record.stop();
    }
  });
})();
// 收起用户列表
function hideUserList() {
  $userListBox.stop().slideUp(_d.speed, () => {
    $userListBox.html('');
  });
}
$chatRoomWrap.on('click', function (e) {
  if (
    !_getTarget(this, e, '.user_list_box') &&
    !_getTarget(this, e, '.c_user_btn')
  ) {
    hideUserList();
  }
});
// 标题过长滚动
const chatTitleScroll = new ContentScroll(
  $chatHeadBtns.find('.chat_title .text_box')[0]
);
let onlineTimer = null;
let temChatTitle = '';
let curChatUserInfo = {};
$onlineStatus
  .on('mouseenter', function () {
    const { username, des, os, online } = curChatUserInfo;
    let status = online ? '在线' : '离线';
    const str = `用户名：${username}\n备注：${des || '--'}\n状态：${status}${
      online ? `\n登录设备：\n${os.join('\n')}` : ''
    }`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', function () {
    toolTip.hide();
  })
  .on('click', function (e) {
    const { username, des, os, online } = curChatUserInfo;
    let status = online ? '在线' : '离线';
    const str = `用户名：${username}\n备注：${des || '--'}\n状态：${status}${
      online ? `\n登录设备：\n${os.join('\n')}` : ''
    }`;
    rMenu.rightInfo(e, str, '登录信息');
  });
function updateOnlineStatus() {
  updateOnlineStatus.clear();
  onlineTimer = setInterval(() => {
    const acc = curChatAccount;
    reqChatGetDes({ acc })
      .then((res) => {
        if (res.code == 0) {
          const { username, des, online } = res.data;
          curChatUserInfo = res.data;
          if (online) {
            $onlineStatus.addClass('active');
          } else {
            $onlineStatus.removeClass('active');
          }
          let title = des || username;
          if (title !== temChatTitle) {
            temChatTitle = title;
            chatTitleScroll.init(temChatTitle);
          }
        }
      })
      .catch(() => {
        updateOnlineStatus.clear();
        $onlineStatus.css('display', 'none');
      });
  }, 5000);
}
updateOnlineStatus.clear = function () {
  if (onlineTimer) {
    clearInterval(onlineTimer);
    onlineTimer = null;
  }
};
// 设置消息标题
function setChatTitle(acc) {
  chatTitleScroll.init('');
  if (acc == setUserInfo().account) {
    chatTitleScroll.init('文件传输助手');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else if (acc == 'chang') {
    chatTitleScroll.init('聊天室');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else if (acc == 'hello') {
    chatTitleScroll.init('Hello助手');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else {
    $onlineStatus.css('display', 'block');
    updateOnlineStatus();
    reqChatGetDes({ acc })
      .then((res) => {
        if (res.code == 0) {
          const { username, des, online } = res.data;
          curChatUserInfo = res.data;
          if (online) {
            $onlineStatus.addClass('active');
          } else {
            $onlineStatus.removeClass('active');
          }
          temChatTitle = des || username;
          chatTitleScroll.init(temChatTitle);
        }
      })
      .catch(() => {
        updateOnlineStatus.clear();
        $onlineStatus.css('display', 'none');
      });
  }
}
// 用户列表加载
function userListLoading() {
  let str = '';
  new Array(50).fill(null).forEach(() => {
    str += `<ul style="pointer-events: none;" class="user_item">
              <li class="user_logo"></li>
              <li class="user_name"></li>
              <li></li>
              </ul>`;
  });
  $userListBox.html(str);
}
// 打开消息
export function openFriend(acc, noHideUserList, cb) {
  curChatAccount = acc;
  setChatTitle(acc);
  switchShakeBtn();
  if (acc === 'chang') {
    if (isRoot()) {
      $chatHeadBtns.find('.clear_msg_btn').stop().fadeIn(_d.speed);
    } else {
      $chatHeadBtns.find('.clear_msg_btn').stop().fadeOut(_d.speed);
    }
  } else {
    $chatHeadBtns.find('.clear_msg_btn').stop().fadeIn(_d.speed);
  }
  chatSearchInput.setValue('');
  chatMsgInp.setValue(temChatMsg[acc] || '');
  if (!noHideUserList) {
    $userListBox.css('display', 'none');
    $userListBox.html('');
  }
  loadingImg($chatListBox.find('.chat_list')[0]);
  reqChatReadMsg({ acc, type: 0 })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        if (chatRoomWrapIsHide()) return;
        const html = renderMsgList(result.data);
        $chatListBox.find('.chat_list').html(html);
        $chatListBox[0].scrollTop = $chatListBox[0].scrollHeight;
        chatimgLoad();
        if (acc === 'chang') {
          $chatHeadBtns.find('.c_home_msg_alert').stop().fadeOut(_d.speed);
        }
        cb && cb();
      }
    })
    .catch(() => {});
}
// 显示好友消息
$userListBox
  .on('click', '.user_item', function (e) {
    const $this = $(this);
    const obj = getUserItem($this.data('account'));
    const name = obj.username,
      from = obj.account;
    if (!name || !from) return;
    if (_getTarget(this, e, '.user_logo')) {
      if (setUserInfo().account == from) {
        showUserInfo();
        hideUserList();
        return;
      }
      if (from === 'hello') {
        rMenu.rightInfo(e, helperInfo, '助手功能');
        return;
      }
      userMenu(e, { ...obj, name, _from: from }, 1);
    } else if (_getTarget(this, e, '.user_name')) {
      if (isForward) {
        hdforwardMsg(e, from);
        return;
      }
      openFriend(from);
    } else if (_getTarget(this, e, '.online')) {
      const { os, online, account } = obj;
      if (account === 'hello' || online === 'n') return;
      let status = '在线';
      if (account === setUserInfo().account && setUserInfo().hide === 'y') {
        status = '隐身';
      }
      const str = `状态：${status}\n登录设备：\n${os.join('\n')}`;
      rMenu.rightInfo(e, str, '登录信息');
    }
  })
  .on('mouseenter', '.user_item', function () {
    const $this = $(this);
    const obj = getUserItem($this.data('account'));
    let { account, des, email, username, os, online } = obj;
    if (account === 'hello') {
      toolTip.setTip(helperInfo).show();
      return;
    }
    let status = '在线';
    if (account === setUserInfo().account && setUserInfo().hide === 'y') {
      status = '隐身';
    }
    if (online === 'n') {
      status = '离线';
    }
    if (account === setUserInfo().account) {
      des = '文件传输助手';
    }
    const str = `用户名：${username}\n备注：${
      des || '--'
    }\n账号：${account}\n邮箱：${email || '--'}\n状态：${status}${
      online === 'y' ? `\n登录设备：\n${os.join('\n')}` : ''
    }`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.user_item', function () {
    toolTip.hide();
  });
// 层级
function chatIndex(e) {
  if (_getTarget(this, e, '.chat_room_wrap')) {
    setZidx($chatRoomWrap[0], 'chat', closeChatRoom, chatIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  chatIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  chatIndex(e.changedTouches[0]);
});
myDrag({
  trigger: $chatHeadBtns.find('.chat_title')[0],
  target: $chatRoomWrap[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  dblclick({ target }) {
    if (isFullScreen(target)) {
      myToRest(target);
    } else {
      myToMax(target);
    }
  },
  up({ target, x, y, pointerX }) {
    hideIframeMask();
    let h = window.innerHeight;
    if (y <= 0 || y >= h) {
      myToMax(target);
    } else {
      target._op = { x, y };
      myToRest(target, pointerX);
    }
  },
});
myResize({
  target: $chatRoomWrap[0],
  down(target) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up(target) {
    hideIframeMask();
    target._os = {
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
  },
});
// 手势
_mySlide({
  el: '.chat_list_box',
  right() {
    if (getSelectText() !== '') return;
    closeChatRoom();
  },
});
