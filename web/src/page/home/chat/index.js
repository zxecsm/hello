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
  formatBytes,
  isImgFile,
  fileLogoType,
  downloadFile,
  sendNotification,
  ContentScroll,
  myDrag,
  toCenter,
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
  getFilePath,
  LazyLoad,
  mailTo,
  isRoot,
  _setData,
  _getData,
  isFullScreen,
  isVideoFile,
  concurrencyTasks,
  isValidDate,
  getScreenSize,
  getCenterPointDistance,
  _animate,
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
import { popWindow, setZidx } from '../popWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { _tpl } from '../../../js/utils/template.js';
import { verifyDate } from '../count_down/index.js';
import md5 from '../../../js/utils/md5.js';
import _path from '../../../js/utils/path.js';
import cacheFile from '../../../js/utils/cacheFile.js';
import imgPreview from '../../../js/plugins/imgPreview/index.js';
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
// 搜索消息框
const chatSearchInput = wrapInput(
  $chatHeadBtns.find('.search_msg_inp input')[0],
  {
    update(val) {
      if (val === '') {
        $chatHeadBtns.find('.search_msg_inp .clean_btn').css('display', 'none');
      } else {
        $chatHeadBtns
          .find('.search_msg_inp .clean_btn')
          .css('display', 'block');
      }
    },
    focus(e) {
      $(e.target).parent().addClass('focus');
      $chatHeadBtns.find('.search_btn').css('display', 'none');
    },
    blur(e) {
      const $inpBox = $(e.target).parent();
      $inpBox.removeClass('focus');
      if (chatSearchInput.getValue().trim() === '') {
        $inpBox.fadeOut(300, () => {
          $chatHeadBtns.find('.search_btn').slideDown(_d.speed);
        });
        chatSearchInput.setValue('');
      }
    },
    keyup(e) {
      if (e.key === 'Enter') {
        openFriend(curChatAccount);
      }
    },
  }
);
let userPageNo = 1,
  userPageSize = 10,
  isForward = false, // 转发状态
  forwardData = null;
// 获取用户信息
function getUserItem(account) {
  return userList.find((item) => item.account === account) || {};
}
const cUserListLoad = new LazyLoad();
// 获取用户列表
function getUserList(top) {
  if ($userListBox.children().length === 0) {
    loadingImg($userListBox[0]);
  }
  reqChatUserList({ pageNo: userPageNo, pageSize: userPageSize })
    .then((result) => {
      if (result.code === 1) {
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
    <ul v-for="{username, account, online, des = '', read} in userList" :data-account="account" class="user_item">
      <i :x="read === 1 ? 'y' : 'n'" class="msg_alert"></i>
      <li cursor="y" class="user_logo" style="{{online === 1 ? '' : 'filter: grayscale(1);'}}"></li>
      <li cursor="y" class="user_name">{{getUsername(account,username,des)}}</li>
      <li v-if="account !== 'hello'" :cursor="online === 1 ? 'y' : ''" :style=getStyle(account,online) class="online iconfont icon-tuichudenglu1"></li>
    </ul>
    <div v-if="totalPage > 1" v-html="getPaging()"></div>
      `,
    {
      userList,
      totalPage,
      getUsername(account, username, des) {
        if (setUserInfo().account === account) {
          username = '文件传输助手';
        }
        return des || username;
      },
      getStyle(account, online) {
        let color = 'var(--color6)';
        if (setUserInfo().account === account) {
          if (setUserInfo().hide === 1) {
            color = '#e9d00c';
          } else {
            if (online === 1) {
              color = 'green';
            }
          }
        } else {
          if (online === 1) {
            color = 'green';
          }
        }
        return { color };
      },
      isMe(account) {
        return setUserInfo().account === account;
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
  const userLogos = [...$userListBox[0].querySelectorAll('.user_logo')].filter(
    (item) => {
      const $item = $(item);
      let {
        username,
        account,
        logo,
        des = '',
      } = getUserItem($item.parent().data('account'));
      if (logo) {
        logo = _path.normalize(`/api/pub/logo/${account}/${logo}`);
      }
      if (account === 'hello') {
        logo = imgHelloLogo;
      }
      const cache = logo
        ? cacheFile.hasUrl(logo, 'image')
        : getTextImg(des || username);
      if (cache) {
        $item
          .css({
            'background-image': `url(${cache})`,
          })
          .addClass('load');
      }
      return !cache;
    }
  );
  cUserListLoad.bind(userLogos, (item) => {
    const $item = $(item);
    let {
      username,
      account,
      logo,
      des = '',
    } = getUserItem($item.parent().data('account'));
    if (logo) {
      logo = _path.normalize(`/api/pub/logo/${account}/${logo}`);
    }
    if (account === 'hello') {
      logo = imgHelloLogo;
    }
    imgjz(logo)
      .then((cache) => {
        $item
          .css({
            'background-image': `url(${cache})`,
          })
          .addClass('load');
      })
      .catch(() => {
        $item
          .css({
            'background-image': `url(${getTextImg(des || username)})`,
          })
          .addClass('load');
      });
  });
}
// 关闭聊天室
export function closeChatRoom() {
  const chatRoom = $chatRoomWrap[0];
  const { x, y } = getCenterPointDistance(chatRoom, $showChatRoomBtn[0]);
  _animate(
    chatRoom,
    { to: { transform: `translate(${x}px,${y}px) scale(0)`, opacity: 0 } },
    (target) => {
      target.style.display = 'none';
      popWindow.remove('chat');
      chatTitleScroll.close();
      $chatListBox.find('.chat_list').html('');
      cImgLoad.unBind();
      cUserListLoad.unBind();
      cUserLogoLoad.unBind();
      updateOnlineStatus.clear();
    }
  );
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
      if (type === 'confirm') {
        reqChatDeleteMsg({ to: acc })
          .then((result) => {
            if (result.code === 1) {
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
          if (res.code === 1) {
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
  .on('click', '.search_btn', () => {
    chatSearchInput.target.parentNode.style.display = 'flex';
    chatSearchInput.focus();
  })
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
  .on('click', '.search_msg_inp .clean_btn', function () {
    chatSearchInput.setValue('').focus();
    openFriend(curChatAccount);
  })
  .on('click', '.search_msg_inp .inp_search_btn', function () {
    openFriend(curChatAccount);
  })
  .on(
    'click',
    '.c_user_btn',
    debounce(
      function () {
        userPageNo = 1;
        $userListBox.stop().slideDown(300, () => {
          getUserList(true);
        });
      },
      500,
      true
    )
  );
// 获取消息数据
function getChatItem(id) {
  return chatMsgData.get(id);
}
function sliceChatList(isPush, $item) {
  const $chatItems = $chatListBox.find('.chat_item');
  const excessItems = $chatItems.length - _d.fieldLenght.chatPageSize * 2;
  if (excessItems > 0) {
    if (isPush) {
      $chatItems.slice(0, excessItems).remove();
    } else {
      $chatItems.slice(_d.fieldLenght.chatPageSize * 2).remove();
    }
  }
  if (isPush) {
    $chatListBox.scrollTop(
      $item[0].offsetTop - $chatListBox.height() + $item.height()
    );
  } else {
    $chatListBox.scrollTop($item[0].offsetTop - 20);
  }
}
export const renderChatMsg = {
  push(data, lastItem) {
    chatMsgData.push(data);
    const html = renderMsgList(data);
    if (!html) return;
    $chatListBox.find('.chat_list').append(html);
    sliceChatList(1, lastItem);
    chatimgLoad();
  },
  unshift(data, firstItem) {
    chatMsgData.unshift(data);
    const html = renderMsgList(data);
    if (!html) {
      $chatListBox
        .find('.chat_item')
        .first()
        .data('nomore', 1)
        .find('.head')
        .prepend(
          '<div class="nomore" style="text-align: center;font-size: 14px;color: var(--text-hover-color);">没有更多了<div>'
        );
      return;
    }
    $chatListBox.find('.chat_list').prepend(html);
    sliceChatList(0, firstItem);
    chatimgLoad();
  },
  reset(data = []) {
    chatMsgData.reset(data);
    $chatListBox.find('.chat_list').html(renderMsgList(data), 1);
    $chatListBox.scrollTop($chatListBox[0].scrollHeight);
    chatimgLoad();
  },
  toBottom() {
    $chatListBox
      .find('.chat_list')
      .html(
        renderMsgList(chatMsgData.get().slice(-_d.fieldLenght.chatPageSize), 1)
      );
    $chatListBox.scrollTop($chatListBox[0].scrollHeight);
    chatimgLoad();
  },
};
export function canToBottom() {
  const lastItem = $chatListBox.find('.chat_item').last();
  if (lastItem.length === 0) return false;
  const chatId = lastItem.data('id');
  return chatMsgData.last()?.id === chatId;
}
export const chatMsgData = {
  list: [],
  get(id) {
    if (id !== undefined) {
      return this.list.find((item) => item.id === id);
    }
    return this.list;
  },
  first() {
    return this.list[0];
  },
  last() {
    return this.list[this.list.length - 1];
  },
  push(data) {
    data = this.diff(data);
    if (data.length === 0) return;
    this.list = [...this.list, ...data];
    this.computeDate();
  },
  delete(id) {
    if (id === undefined) return;
    this.list = this.list.filter((item) => item.id !== id);
    this.computeDate();
  },
  unshift(data) {
    data = this.diff(data);
    if (data.length === 0) return;
    this.list = [...data, ...this.list];
    this.computeDate();
  },
  reset(data = []) {
    this.list = data;
    this.computeDate();
  },
  diff(data) {
    return data.filter((item) => !this.list.some((y) => y.id === item.id));
  },
  computeDate() {
    if (this.list.length === 0) return;
    let flag = '';
    this.list = this.list.map((item) => {
      const d = formatDate({
        template: '{0}-{1}-{2}',
        timestamp: item.create_at,
      });
      if (d === flag) {
        item.showTime = 'n';
      } else {
        item.showTime = 'y';
      }
      flag = d;
      return item;
    });
  },
};
// 生成消息列表
function renderMsgList(list, skip) {
  if (list.length === 0) return '';
  const listDoms = skip
    ? []
    : [...$chatListBox[0].querySelectorAll('.chat_item')];
  const cList = chatMsgData.get();
  list = list.reduce((pre, item) => {
    // 处理可能时间戳相同的信息，因为游标使用create_at导致信息重复的问题
    if (!listDoms.some((c) => c.dataset.id === item.id)) {
      // 处理日期是否显示
      item = cList.find((c) => c.id === item.id);
      pre.push(item);
    }
    return pre;
  }, []);
  if (list.length === 0) return '';
  const html = _tpl(
    `
    <template v-for="{id,content,create_at,_from,_to,username,size,showTime,type,des = ''} in list">
      <ul class="chat_item" :data-id="id">
        <div class="head">
          <div v-if="showTime === 'y'" class="chat_time">{{getDate(create_at)[0]}}</div>
        </div>
        <div class="msg_info_wrap">
          <li v-if="isRight(_from)" cursor="y" class="chat_menu_btn iconfont icon-icon"></li>
          <li v-else cursor="y" class="c_left_logo">
            <div class="c_logo" style="float: left;"></div>
          </li>
          <li class="c_content_box">
            <span :title="getDate(create_at)[0]" class="c_user_name" style="text-align: {{!isRight(_from) ? 'left' : 'right'}};">
              {{getUsername(username,des,_to)}} <span>{{getDate(create_at)[1]}}</span>
            </span>
            <div v-if="type === 'image'" cursor="y" class="c_img_msg_box" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
              <div class="c_img"><span>{{formatBytes(size)}}</span></div>
            </div>
            <div v-else-if="type === 'voice'" cursor="y" 
              class="c_voice_msg_box {{isRight(_from) ? 'bcolor' : ''}}" 
              style="float: {{!isRight(_from) ? 'left' : 'right'}};width: {{(size / 30) * 100}}%;text-align:{{isRight(_from) ? 'right' : 'left'}}">
              <template v-if="isRight(_from)">
                <span class="c_right_triangle bcolor"></span>
                <span style="font-size:12px;">{{size.toFixed(2)}}s</span>
                <i class="iconfont icon-yuyin-cuxiantiao"></i>
              </template>
              <template v-else>
                <span class="c_left_triangle"></span>
                <i class="iconfont icon-yuyin1"></i>
                <span style="font-size:12px;">{{size.toFixed(2)}}s</span>
              </template>
            </div>
            <div v-else-if="type === 'file'" :title="content" class="c_file_msg_box" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
              <div cursor="y" class="c_file_info">
                <span class="file_name">{{content}}</span>
                <span class="file_size">{{formatBytes(size)}}</span>
              </div>
              <div class="file_type iconfont {{fileLogoType(content)}}"></div>
              <span class="{{isRight(_from) ? 'c_right_triangle' : 'c_left_triangle'}}"></span>
            </div>
            <p v-else-if="type === 'text'" class="c_text_msg_box {{isRight(_from) ? 'bcolor' : ''}}" style="float: {{!isRight(_from) ? 'left' : 'right'}};">
              <div v-html="hdTextMsg(content)"></div>
              <span class="{{isRight(_from)?'c_right_triangle bcolor':'c_left_triangle'}}"></span>
            </p>
          </li>
          <li v-if="isRight(_from)" cursor="y" class="c_right_logo">
            <div class="c_logo" style="float: right;"></div>
          </li>
          <li v-else cursor="y" class="chat_menu_btn iconfont icon-icon"></li>
        </div>
      </ul>
    </template>
    `,
    {
      list,
      getDate(create_at) {
        return formatDate({
          template: '{0}-{1}-{2} {3}:{4}',
          timestamp: create_at,
        }).split(' ');
      },
      hdTextMsg,
      isRight(_from) {
        return _from === setUserInfo().account ? true : false;
      },
      getUsername(username, des, _to) {
        if (_to === 'chang') {
          return des || username || '未知';
        }
        return '';
      },
      fileLogoType,
      formatBytes,
    }
  );
  return html;
}
// 聊天图片
const cImgLoad = new LazyLoad();
const cUserLogoLoad = new LazyLoad();
function chatimgLoad() {
  cImgLoad.bind($chatListBox[0].querySelectorAll('.c_img'), (item) => {
    const $v = $(item);
    const id = $v.parent().parent().parent().parent().data('id');
    const msgObj = getChatItem(id);
    const url = getFilePath(`/upload/${id}/${msgObj.hash}`, 1);
    imgjz(url)
      .then((cache) => {
        $v.css({
          'background-image': `url(${cache})`,
        }).addClass('load');
      })
      .catch(() => {
        $v.css({
          'background-image': `url(${imgGqImg})`,
        }).addClass('load');
      });
  });
  cUserLogoLoad.bind($chatListBox[0].querySelectorAll('.c_logo'), (item) => {
    const $item = $(item);
    let {
      des = '',
      username,
      logo,
      _from,
    } = getChatItem($item.parent().parent().parent().data('id'));
    if (logo) {
      logo = _path.normalize(`/api/pub/logo/${_from}/${logo}`);
    }
    if (_from === 'hello') {
      logo = imgHelloLogo;
    }
    if (logo) {
      imgjz(logo)
        .then((cache) => {
          $item
            .css({
              'background-image': `url(${cache})`,
            })
            .addClass('load');
        })
        .catch(() => {
          $item
            .css({
              'background-image': `url(${getTextImg(des || username)})`,
            })
            .addClass('load');
        });
    } else {
      $item
        .css({
          'background-image': `url(${getTextImg(des || username)})`,
        })
        .addClass('load');
    }
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
      if (type === 'click') {
        showChatRoom(to === 'chang' ? to : from);
      }
    },
    1
  );
  if (logo) {
    logo = _path.normalize(`/api/pub/logo/${from}/${logo}`);
  }
  if (from === 'hello') {
    logo = imgHelloLogo;
  }
  if (logo) {
    imgjz(logo)
      .then((cache) => {
        if (document.visibilityState === 'hidden') {
          sendNotification(
            {
              title: name + '：',
              body: data,
              icon: cache,
            },
            () => {
              showChatRoom(to === 'chang' ? to : from);
            }
          );
        }
      })
      .catch(() => {
        if (document.visibilityState === 'hidden') {
          sendNotification(
            {
              title: name + '：',
              body: data,
              icon: getTextImg(name),
            },
            () => {
              showChatRoom(to === 'chang' ? to : from);
            }
          );
        }
      });
  } else {
    if (document.visibilityState === 'hidden') {
      sendNotification(
        {
          title: name + '：',
          body: data,
          icon: getTextImg(name),
        },
        () => {
          showChatRoom(to === 'chang' ? to : from);
        }
      );
    }
  }
}
//打开聊天窗
export function showChatRoom(chatAcc = curChatAccount) {
  const chatRoom = $chatRoomWrap[0];
  $showChatRoomBtn.attr('class', 'show_chat_room_btn iconfont icon-liaotian');
  setZidx(chatRoom, 'chat', closeChatRoom, chatIsTop);
  const isHide = chatRoomWrapIsHide();
  chatRoom.style.display = 'block';
  //隐藏主页消息提示
  const { x, y } = getCenterPointDistance(chatRoom, $showChatRoomBtn[0]);
  if (isHide) {
    _animate(chatRoom, {
      to: { transform: `translate(${x}px,${y}px) scale(0)`, opacity: 0 },
      direction: 'reverse',
    });
  }
  openFriend(chatAcc, false, () => {
    reqChatNews()
      .then((result) => {
        if (result.code === 1) {
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
  if (!$chatRoomWrap._once) {
    $chatRoomWrap._once = true;
    toSetSize(chatRoom, 600, 800);
    toCenter(chatRoom);
  } else {
    myToRest(chatRoom);
  }
}
$showChatRoomBtn.on(
  'click',
  debounce(
    () => {
      showChatRoom();
    },
    500,
    true
  )
);
// 用户菜单
function userMenu(e, msgObj, isUserList) {
  const { _from, username, des, logo, email } = msgObj;
  if (_from === 'hello') {
    rMenu.rightInfo(e, helperInfo, '助手功能');
    return;
  }
  const chatAcc = curChatAccount;
  let data = [
    {
      id: '1',
      text: username,
      beforeIcon: 'iconfont icon-zhanghao',
    },
  ];
  if (logo) {
    data.push({
      id: '5',
      text: '头像',
      beforeIcon: 'iconfont icon-kejian',
    });
  }
  if (chatAcc === 'chang' || isUserList) {
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
      if (id === '2') {
        close();
        openFriend(_from);
      } else if (id === '3') {
        let url = `/notes/?acc=${_from}`;
        openInIframe(url, (des || username) + '的笔记本');
        close();
      } else if (id === '1') {
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
            if (id === '1') {
              rMenu.inpMenu(
                e,
                {
                  subText: '提交',
                  items: {
                    text: {
                      placeholder: '备注（为空则不设置）',
                      value: des,
                      verify(val) {
                        if (val.length > _d.fieldLenght.chatDes) {
                          return `限制1-${_d.fieldLenght.chatDes}位`;
                        }
                      },
                    },
                  },
                },
                function ({ close, inp, loading, isDiff }) {
                  if (!isDiff()) return;
                  const des = inp.text;
                  loading.start();
                  reqChatSetDes({ account: _from, des })
                    .then((res) => {
                      loading.end();
                      if (res.code === 1) {
                        _msg.success(res.codeText);
                        close(true);
                        if (curChatAccount === 'chang') {
                          openFriend(curChatAccount, true);
                        } else if (curChatAccount === _from) {
                          setChatTitle(curChatAccount);
                        }
                        if (isUserList) {
                          userPageNo = 1;
                          getUserList(true);
                        }
                      }
                    })
                    .catch(() => {
                      loading.end();
                    });
                },
                '设置备注'
              );
            } else if (id === '2') {
              copyText(_from);
            } else if (id === '3') {
              mailTo(email);
            }
          },
          '用户信息'
        );
      } else if (id === '4') {
        close();
        openInIframe(`/bmk?acc=${_from}`, (des || username) + '的书签夹');
      } else if (id === '5') {
        imgPreview([{ u1: _path.normalize(`/api/pub/logo/${_from}/${logo}`) }]);
        close();
      }
    },
    des || username
  );
}
// 打开文件
function openChatFile(target) {
  const $this = $(target).parent().parent().parent();
  const obj = getChatItem($this.data('id'));
  const msgId = obj.id,
    content = obj.content;
  //查看文件是否过期
  reqChatExpired({ hash: obj.hash })
    .then((result) => {
      if (result.code === 1) {
        const { isText } = result.data;
        if (isText) {
          downloadFile([
            { fileUrl: getFilePath(`/upload/${msgId}`), filename: content },
          ]);
        } else {
          if (isVideoFile(content)) {
            openInIframe(
              `/videoplay/#${encodeURIComponent(
                getFilePath(`/upload/${msgId}`)
              )}`,
              content
            );
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(content)) {
            openInIframe(getFilePath(`/upload/${msgId}`), content);
          } else {
            downloadFile(
              [{ fileUrl: getFilePath(`/upload/${msgId}`), filename: content }],
              'image'
            );
          }
        }
        return;
      }
      _msg.error('文件已过期');
    })
    .catch(() => {});
}
// 打开图片
function openChatImg(target) {
  const id = $(target).parent().parent().parent().parent().attr('data-id');
  const obj = getChatItem(id);
  // 检查图片是否过期
  reqChatExpired({ hash: obj.hash })
    .then((result) => {
      if (result.code === 1) {
        imgPreview([
          {
            u1: getFilePath(`/upload/${id}`),
            u2: getFilePath(`/upload/${id}/${obj.hash}`, 1),
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
  // 向上滚动获取前面聊天内容
  if (this.scrollTop < 20) {
    const firstItem = $chatListBox.find('.chat_item').first();
    if (firstItem.length === 0) return;
    if (
      $chatListBox.find('.chat_list').outerHeight() <
        $chatListBox.outerHeight() ||
      firstItem.data('nomore') === 1
    )
      return;
    const chatId = firstItem.data('id');
    const idx = chatMsgData.get().findIndex((item) => item.id === chatId);
    if (idx < 0) return;
    if (idx === 0) {
      const word = chatSearchInput.getValue().trim();
      if (word.length > 100) {
        _msg.error('搜索内容过长');
        return;
      }
      const { start = '', end = '' } = searchDateLimit;
      reqChatReadMsg({
        flag: chatId,
        account: curChatAccount,
        type: 1,
        word,
        start,
        end,
      })
        .then((result) => {
          if (result.code === 1) {
            if (chatRoomWrapIsHide()) return;
            renderChatMsg.unshift(result.data, firstItem);
          }
        })
        .catch(() => {});
    } else if (idx > 0) {
      if (chatRoomWrapIsHide()) return;
      renderChatMsg.unshift(
        chatMsgData
          .get()
          .slice(Math.max(idx - _d.fieldLenght.chatPageSize, 0), idx),
        firstItem
      );
    }
  }
}
function scrollBottomMsg() {
  // 向下滚动获取后面聊天内容
  if (this.scrollHeight - this.scrollTop - this.clientHeight < 20) {
    const lastItem = $chatListBox.find('.chat_item').last();
    if (lastItem.length === 0) return;
    const chatId = lastItem.data('id');
    const list = chatMsgData.get();
    const idx = list.findIndex((item) => item.id === chatId);
    if (idx > 0 && idx < list.length - 1) {
      if (chatRoomWrapIsHide()) return;
      renderChatMsg.push(
        list.slice(idx + 1, idx + 1 + _d.fieldLenght.chatPageSize),
        lastItem
      );
    }
  }
}
$chatListBox
  .on('click', '.c_logo', function (e) {
    const $this = $(this).parent().parent().parent();
    const obj = getChatItem($this.data('id'));
    const from = obj._from;
    if (from === setUserInfo().account) {
      showUserInfo();
      return;
    }
    userMenu(e, obj);
  })
  .on('click', '.c_file_msg_box', function () {
    if (getSelectText() !== '') return;
    openChatFile(this);
  })
  .on('click', '.c_text_msg_box', function (e) {
    if (getSelectText() !== '') return;
    chatMsgMenu(e, getChatItem($(this).parent().parent().parent().data('id')));
  })
  .on('contextmenu', '.c_content_box', function (e) {
    if (getSelectText() !== '') return;
    //操作消息
    e.preventDefault();
    if (isMobile()) return;
    chatMsgMenu(e, getChatItem($(this).parent().parent().data('id')));
  })
  .on('click', '.chat_menu_btn', function (e) {
    chatMsgMenu(e, getChatItem($(this).parent().parent().data('id')));
  })
  .on('click', '.c_voice_msg_box', function () {
    if (getSelectText() !== '') return;
    playVoice(
      getFilePath(
        `/upload/${$(this).parent().parent().parent().attr('data-id')}`
      ),
      this
    );
  })
  .on('click', '.c_img', function () {
    if (getSelectText() !== '') return;
    openChatImg(this);
  })
  .on('scroll', switchScrollToBottom)
  .on('scroll', debounce(scrollTopMsg, 200))
  .on('scroll', debounce(scrollBottomMsg, 200));
function switchScrollToBottom() {
  if (
    $chatListBox.find('.chat_list').outerHeight() -
      $chatListBox.scrollTop() -
      $chatListBox.outerHeight() >
    200
  ) {
    $chatFootBox.find('.scroll_to_bot_btn').css('display', 'block');
  } else {
    $chatFootBox.find('.scroll_to_bot_btn').css('display', 'none');
  }
}
let searchDateLimit = {};
function hdDateSearchChat(e) {
  const { start = '', end = '' } = searchDateLimit;
  const today = formatDate({ template: '{0}-{1}-{2}' });
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        start: {
          beforeText: '开始日期：',
          placeholder: 'YYYY-MM-DD',
          value: start || today,
          inputType: 'date',
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
        end: {
          beforeText: '结束日期：',
          placeholder: 'YYYY-MM-DD',
          value: end || today,
          inputType: 'date',
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
      },
    },
    function ({ close, inp, isDiff }) {
      if (!isDiff() || !verifyDate(inp)) return;
      searchDateLimit = inp;
      changeDateSearchState();
      openFriend(curChatAccount);
      close();
    },
    '选择消息日期范围'
  );
}
export function getSearchDateLimit() {
  return searchDateLimit;
}
function changeDateSearchState() {
  const { start, end } = searchDateLimit;
  const $dateSearch = $chatRoomWrap.find('.date_search');
  if (start && end) {
    $dateSearch
      .find('.date_text')
      .text(`${searchDateLimit.start} >> ${searchDateLimit.end}`);
    $dateSearch.addClass('active');
  } else {
    $dateSearch.find('.date_text').text(``);
    $dateSearch.removeClass('active');
  }
}
$chatRoomWrap
  .on('click', '.date_search .date_icon', hdDateSearchChat)
  .on('click', '.date_search .date_text', hdDateSearchChat)
  .on('click', '.date_search .date_close', () => {
    searchDateLimit = {};
    changeDateSearchState();
    openFriend(curChatAccount);
  });
// 消息菜单
function chatMsgMenu(e, cobj) {
  const chatAcc = curChatAccount;
  const { type, _from, id: tt, content: z, hash } = cobj;
  let data = [];
  if (type === 'text') {
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
        beforeIcon: 'iconfont icon-download',
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
      beforeIcon: 'iconfont icon-Undo',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    async ({ close, id, e, loading }) => {
      if (id === '4') {
        _pop(
          {
            e,
            text: `确认撤回：消息？`,
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqChatDeleteMsg({ id: tt, to: chatAcc })
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
      } else if (id === '1') {
        copyText(z);
        close();
      } else if (id === '2') {
        chatMsgInp.setValue(z).focus();
        close();
      } else if (id === '3') {
        let flag = null;
        if (type === 'image') {
          flag = '图片';
        } else if (type === 'voice') {
          flag = '语音';
        } else if (type === 'file') {
          flag = '文件';
        }
        if (!flag) return;
        loading.start();
        reqChatExpired({ hash })
          .then((result) => {
            loading.end();
            if (result.code === 1) {
              close();
              downloadFile(
                [{ fileUrl: getFilePath(`/upload/${tt}`), filename: z }],
                'image'
              );
              return;
            }
            _msg.error(`${flag}已过期`);
          })
          .catch(() => {
            loading.end();
          });
      } else if (id === '5') {
        isForward = true;
        forwardData = cobj;
        close();
        userPageNo = 1;
        $userListBox.stop().slideDown(300, () => {
          getUserList(true);
        });
      } else if (id === '6') {
        close();
        await cacheFile.setData('newNote', z);
        openInIframe('/edit/#new', '新笔记');
      }
    },
    cobj.content
  );
}
// 播放语音
function playVoice(a, _this) {
  const pflag = $chatAudio.playflag,
    _flag = _path.basename(a)[1];
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
    content = chatMsgInp.getValue().trim();
  if (content.length > _d.fieldLenght.chatContent) {
    _msg.error('发送内容过长');
    return;
  }
  $chatFootBox
    .find('.c_sent_msg_btn')
    .attr('x', 1)
    .children('i')
    .attr('class', 'iconfont icon-tianjia');
  chatMsgInp.setValue('').focus();
  if (content === '') return;
  reqChatSendMsg({
    to: chatAcc,
    content,
  }).catch(() => {});
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
const saveTemChatMsg = debounce(async (val) => {
  const temChatMsg = (await cacheFile.getData('temChatMsg')) || {};
  temChatMsg[curChatAccount] = val;
  await cacheFile.setData('temChatMsg', temChatMsg);
}, 1000);
// 消息编辑框
const chatMsgInp = wrapInput(
  $chatFootBox.find('.c_text_msg .c_text_content')[0],
  {
    update(val) {
      if (val.length > _d.fieldLenght.chatContent) {
        val = val.slice(0, _d.fieldLenght.chatContent);
      }
      $chatFootBox.find('.c_text_msg .fill_height').text(val);
      saveTemChatMsg(val);
      switchShakeBtn();
      if (val.trim() === '') {
        $chatFootBox
          .find('.c_sent_msg_btn')
          .attr('x', 1)
          .children('i')
          .attr('class', 'iconfont icon-tianjia');
      } else {
        $chatFootBox
          .find('.c_sent_msg_btn')
          .attr('x', 2)
          .children('i')
          .attr('class', 'iconfont icon-huaban');
      }
      if (val === '') {
        $chatFootBox.find('.clean').removeClass('show');
      } else {
        $chatFootBox.find('.clean').addClass('show');
      }
    },
    focus(e) {
      $(e.target).addClass('focus');
    },
    blur(e) {
      $(e.target).removeClass('focus');
    },
  }
);
$chatFootBox
  .on('click', '.c_sent_msg_btn', async function () {
    if ($(this).attr('x') === '1') {
      const chatAcc = curChatAccount;
      const files = await getFiles({ multiple: true });
      if (files.length === 0) return;
      sendfile(files, chatAcc);
    } else {
      sendTextMsg();
    }
  })
  .on('click', '.clean', function () {
    chatMsgInp.setValue('').focus();
  })
  .on(
    'click',
    '.c_sent_shake_btn',
    throttle(() => {
      reqChatShakeMsg({ to: curChatAccount })
        .then((res) => {
          if (res.code === 1) {
            _msg.success();
          }
        })
        .catch(() => {});
    }, 1000)
  )
  .on('click', '.c_change_btn', function () {
    const $this = $(this);
    if ($this.attr('x') === '1') {
      $chatFootBox.find('.c_get_voice_btn').css('display', 'block');
      $chatFootBox.find('.c_text_msg').css('display', 'none');
      $this.attr('x', 2).children('i').attr('class', 'iconfont icon-w_jianpan');
      $chatFootBox
        .find('.c_sent_msg_btn')
        .attr('x', 1)
        .children('i')
        .attr('class', 'iconfont icon-tianjia');
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
  .on('click', '.scroll_to_bot_btn', function () {
    if (canToBottom()) {
      $chatListBox.scrollTop($chatListBox[0].scrollHeight);
    } else {
      renderChatMsg.toBottom();
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
    if (files.length === 0) return;
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
    if (files.length === 0) return;
    sendfile(files, chatAcc);
  });
})();
// 发送文件
async function sendfile(files, chatAcc) {
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size } = file;
    const pro = upPro.add(name);
    if (size === 0) {
      pro.fail('发送失败');
      _msg.error(`不能发送空文件`);
      return;
    }
    if (size > _d.fieldLenght.maxFileSize) {
      pro.fail('发送失败');
      _msg.error(`发送文件限制0-4.8G`);
      return;
    }
    const type = isImgFile(name) ? 'image' : 'file';
    try {
      const { chunks, count, HASH } = await md5.fileSlice(
        file,
        (percent) => {
          pro.loading(percent);
        },
        signal
      );

      const isrepeat = await reqChatRepeat({
        HASH,
        type,
        name,
        to: chatAcc,
        size,
      }); //是否已经存在文件
      if (isrepeat.code === 1) {
        //文件已经存在操作
        pro.close('发送成功');
        return;
      }

      const breakpointarr = (await reqChatBreakpoint({ HASH })).data; //断点续传

      function compale(index) {
        pro.update(index / count);
      }

      let index = breakpointarr.length;
      compale(index);
      await concurrencyTasks(chunks, 3, async (chunk) => {
        if (signal.aborted) return;
        const { filename, file } = chunk;
        if (breakpointarr.includes(filename)) return;
        await reqChatUp(
          {
            name: filename,
            HASH,
          },
          file,
          false,
          signal
        );
        index++;
        compale(index);
      });
      if (signal.aborted) return;
      try {
        const mergeRes = await reqChatMerge({
          HASH,
          count,
          name,
          to: chatAcc,
          type,
        }); //合并切片
        if (mergeRes.code === 1) {
          pro.close('发送成功');
        } else {
          pro.fail('发送失败');
        }
      } catch (error) {
        if (error.statusText === 'timeout') {
          pro.close('处理文件中');
        } else {
          pro.fail('发送失败');
        }
      }
    } catch {
      pro.fail('发送失败');
    }
  });
}
// 语音发送
function upVoice(blob, duration) {
  if (!blob) {
    _msg.error('发送失败');
    return;
  }
  if (duration < 2 || duration > 30) {
    _msg.error('语音限制2-30s');
    return;
  }
  const chatAcc = curChatAccount;
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  const pro = upPro.add(`语音`);
  md5
    .fileSlice(
      blob,
      function (percent) {
        pro.update(percent);
      },
      signal
    )
    .then((buf) => {
      const { HASH } = buf;
      reqChatUpVoice(
        {
          HASH,
          name: `${HASH}.wav`,
          to: chatAcc,
        },
        blob,
        (percent) => {
          pro.update(percent);
        },
        signal
      )
        .then((res) => {
          if (res.code === 1) {
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
  $userListBox.stop().slideUp(300, () => {
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
  onlineTimer = setTimeout(() => {
    const acc = curChatAccount;
    reqChatGetDes({ account: acc })
      .then((res) => {
        if (res.code === 1) {
          const { username, des, online } = res.data;
          curChatUserInfo = res.data;
          if (online) {
            $onlineStatus.addClass('active');
          } else {
            $onlineStatus.removeClass('active');
          }
          chatTitleScroll.init(des || username);
        } else {
          throw '';
        }
      })
      .catch(() => {
        $onlineStatus.removeClass('active');
      })
      .finally(updateOnlineStatus);
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
  if (acc === setUserInfo().account) {
    chatTitleScroll.init('文件传输助手');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else if (acc === 'chang') {
    chatTitleScroll.init('聊天室');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else if (acc === 'hello') {
    chatTitleScroll.init('Hello助手');
    $onlineStatus.css('display', 'none');
    updateOnlineStatus.clear();
  } else {
    $onlineStatus.css('display', 'block');
    updateOnlineStatus();
    reqChatGetDes({ account: acc })
      .then((res) => {
        if (res.code === 1) {
          const { username, des, online } = res.data;
          curChatUserInfo = res.data;
          if (online) {
            $onlineStatus.addClass('active');
          } else {
            $onlineStatus.removeClass('active');
          }
          chatTitleScroll.init(des || username);
        } else {
          throw '';
        }
      })
      .catch(() => {
        $onlineStatus.removeClass('active');
      });
  }
}
// 打开消息
export async function openFriend(acc, noHideUserList, cb) {
  if (curChatAccount !== acc) {
    chatSearchInput.setValue('').focus();
    searchDateLimit = {};
    changeDateSearchState();
    curChatAccount = acc;
  }
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
  const temChatMsg = (await cacheFile.getData('temChatMsg')) || {};
  chatMsgInp.setValue(temChatMsg[acc] || '');
  if (!noHideUserList) {
    $userListBox.css('display', 'none');
    $userListBox.html('');
  }
  const val = chatSearchInput.getValue().trim();
  if (val.length > 100) {
    _msg.error('搜索内容过长');
    return;
  }
  loadingImg($chatListBox.find('.chat_list')[0]);
  switchScrollToBottom();
  const { start = '', end = '' } = searchDateLimit;
  reqChatReadMsg({ account: acc, type: 0, word: val, start, end })
    .then((result) => {
      if (result.code === 1) {
        if (chatRoomWrapIsHide()) return;
        renderChatMsg.reset(result.data);
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
      if (setUserInfo().account === from) {
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
      if (account === 'hello' || online === 0) return;
      let status = '在线';
      if (account === setUserInfo().account && setUserInfo().hide === 1) {
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
    if (account === setUserInfo().account && setUserInfo().hide === 1) {
      status = '隐身';
    }
    if (online === 0) {
      status = '离线';
    }
    if (account === setUserInfo().account) {
      des = '文件传输助手';
    }
    const str = `用户名：${username}\n备注：${
      des || '--'
    }\n账号：${account}\n邮箱：${email || '--'}\n状态：${status}${
      online === 1 ? `\n登录设备：\n${os.join('\n')}` : ''
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
    const { h, w } = getScreenSize();
    if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
      myToMax(target);
    } else {
      target.dataset.x = x;
      target.dataset.y = y;
      myToRest(target, pointerX);
    }
  },
});
myResize({
  target: $chatRoomWrap[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    target.dataset.w = target.offsetWidth;
    target.dataset.h = target.offsetHeight;
    target.dataset.x = x;
    target.dataset.y = y;
  },
});
// 手势
_mySlide({
  el: '.chat_list_box',
  right() {
    closeChatRoom();
  },
});
