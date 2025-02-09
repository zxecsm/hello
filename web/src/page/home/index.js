import $ from 'jquery';
import '../../css/common/reset.css';
import '../../js/common/common.js';
import './pwa.js';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import imgBgSvg from '../../images/img/bg.svg';
import {
  queryURLParams,
  myOpen,
  _setData,
  _getData,
  throttle,
  debounce,
  _getTarget,
  imgjz,
  _mySlide,
  downloadFile,
  toLogin,
  longPress,
  isMobile,
  getTextImg,
  hdOnce,
  isBigScreen,
  getIn,
  getFilePath,
  _getDataTem,
  _setDataTem,
  myShuffle,
  isLogin,
  isRoot,
  wave,
  getScreenSize,
} from '../../js/utils/utils.js';
import _d from '../../js/common/config';
import _msg from '../../js/plugins/message';
import realtime from '../../js/plugins/realtime';
import loadingPage from '../../js/plugins/loading/index.js';
import { reqChatNews, reqChatReadMsg } from '../../api/chat.js';
import { reqTodoList } from '../../api/todo.js';
import { reqUserAllowLogin, reqUserInfo } from '../../api/user.js';
import { reqBgRandom, reqChangeBg } from '../../api/bg.js';
// 时钟
import './clock.js';
import {
  hideUserInfo,
  renderUserinfo,
  settingMenu,
  setTopsFlag,
  showBmk,
  showFileManage,
  showHistory,
  showLogPage,
  showNote,
  showPicture,
  showRightMenu,
  showRootPage,
  showTrash,
  updateRightBoxUsername,
  updateTipsFlag,
} from './rightSetting/index.js';
import {
  closeTodoBox,
  getTodoList,
  setTodoUndone,
  todoMsg,
} from './todo/index.js';
import { closeBgBox, delBg, renderBgList, showBgBox } from './bg/index.js';
import { getBookMarkList, showAside, toggleAside } from './aside/index.js';
import {
  getHomeBmList,
  searchBoxIsHide,
  showSearchBox,
} from './searchBox/index.js';
import {
  canToBottom,
  chatMessageNotification,
  chatMsgData,
  chatRoomWrapIsHide,
  closeChatRoom,
  getSearchDateLimit,
  renderChatMsg,
  setCurChatAccount,
  shakeChat,
  showChatRoom,
} from './chat/index.js';
import './timer.js';
import { closeAllIframe, hideAllIframe } from './iframe.js';
import {
  closeMusicPlayer,
  setMediaVolume,
  getSongList,
  hideMusicPlayBox,
  musicPlayerIsHide,
  remoteVol,
  setCurPlayingList,
  setPlayVolume,
  showMusicPlayerBox,
  updateSongInfo,
  getVolumeIcon,
} from './player/index.js';
import {
  changePlayState,
  getPlaytimer,
  hdSongInfo,
  initMusicLrc,
  musicPlay,
  pauseSong,
  playNextSong,
  playPrevSong,
  playerRemoteBtnState,
  setPlayingSongInfo,
  setRemotePlayState,
  setSongCurrentTime,
  setSongPlayMode,
  songIspaused,
  switchPlayMode,
  updatePlayingSongTotalTime,
  updateSongProgress,
} from './player/lrc.js';
import {
  closeEditLrcBox,
  closeMvBox,
  musicMvIsHide,
  mvIspaused,
  pauseVideo,
  playVideo,
} from './player/widget.js';
import {
  playingListHighlight,
  renderPlayingList,
  setPlayingList,
} from './player/playlist.js';
import {
  reqPlayerGetLastPlay,
  reqPlayerGetPlayList,
} from '../../api/player.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import {
  closeCountBox,
  countMsg,
  getCountList,
  setExpireCount,
} from './count_down/index.js';
import { reqCountList } from '../../api/count.js';
import { deepClone } from '../../js/utils/template.js';
import _path from '../../js/utils/path.js';
import percentBar from '../../js/plugins/percentBar/index.js';
import imgPreview from '../../js/plugins/imgPreview/index.js';
import _pop from '../../js/plugins/popConfirm/index.js';
const $pageBg = $('.page_bg'),
  $document = $(document),
  $userLogoBtn = $('.user_logo_btn'),
  $rightMenuMask = $('.right_menu_mask'),
  $rightBox = $rightMenuMask.find('.right_box'),
  $chatRoomWrap = $('.chat_room_wrap'),
  $chatHeadBtns = $chatRoomWrap.find('.c_head_btns'),
  $chatListBox = $chatRoomWrap.find('.chat_list_box'),
  $showChatRoomBtn = $('.show_chat_room_btn'),
  $randomChangeBgBtn = $('.random_change_bg_btn'),
  $searchBoxBtn = $('.search_box_btn');
let curFilterBg = _getData('filterbg'),
  gentlemanLockPd = _getData('gentlemanLockPd');
let userInfo = {};
// 设置用户数据
export function setUserInfo(val) {
  if (val === undefined) {
    return userInfo;
  }
  userInfo = val;
}
// 判断登录
if (!isLogin()) {
  toLogin();
} else {
  // 君子锁
  ~(function getGentlemanLock() {
    if (gentlemanLockPd) {
      const pd = _getDataTem('gentlemanLockPd') || prompt('请输入君子锁密码：');
      if (pd !== gentlemanLockPd) {
        getGentlemanLock();
      } else {
        _setDataTem('gentlemanLockPd', pd);
      }
    }
  })();
}
// 背景模糊
function bgFilter(value) {
  curFilterBg = value;
  if (value <= 0) {
    $pageBg.removeClass('mh');
  } else {
    $pageBg.addClass('mh');
  }
  $pageBg.css({
    filter: `blur(${value}px)`,
  });
  _setData('filterbg', value);
}
bgFilter(curFilterBg);
// 调节模糊度
export function resizeBgFilter(e) {
  percentBar(
    e,
    curFilterBg / 100,
    throttle(function (per) {
      bgFilter(parseInt(per * 100));
    }, 500)
  );
}
// 风车
const windmill = {
  start() {
    $randomChangeBgBtn.addClass('open').find('img').addClass('open');
  },
  stop() {
    $randomChangeBgBtn.removeClass('open').find('img').removeClass('open');
  },
};
// 设置壁纸
export function setBg(obj, cb) {
  windmill.start();
  const url = getFilePath(`/bg/${obj.url}`);
  cb && cb();
  imgjz(url)
    .then(() => {
      windmill.stop();
      reqChangeBg({ type: obj.type, id: obj.id })
        .then((result) => {
          if (result.code === 1) {
            _msg.success(result.codeText);
            updateUserInfo();
            return;
          }
        })
        .catch(() => {});
    })
    .catch(() => {
      _msg.error('壁纸加载失败');
      windmill.stop();
    });
}
// 随机切换背景
function changeBg() {
  const type = isBigScreen() ? 'bg' : 'bgxs';
  windmill.start();
  reqBgRandom({ type })
    .then((result) => {
      if (result.code === 1) {
        setBg(result.data);
        return;
      }
      windmill.stop();
    })
    .catch(() => {
      windmill.stop();
    });
}
function timeMsg() {
  const hour = new Date().getHours();
  let msg = '';
  let icon = '';
  if (hour < 6) {
    msg = '晚上好丫';
    icon = 'iconfont icon-icon_yejian-yueliang';
  } else if (hour < 11) {
    msg = '早上好丫';
    icon = 'iconfont icon-a-056_richu';
  } else if (hour < 13) {
    msg = '中午好丫';
    icon = 'iconfont icon-taiyangtianqi';
  } else if (hour < 17) {
    msg = '下午好丫';
    icon = 'iconfont icon-xiawucha';
  } else if (hour < 19) {
    msg = '傍晚好丫';
    icon = 'iconfont icon-yewan-bangwan';
  } else {
    msg = '晚上好丫';
    icon = 'iconfont icon-icon_yejian-yueliang';
  }
  return { msg, icon };
}
export function changeLogoAlertStatus() {
  const expireCount = setExpireCount();
  const tipsFlag = setTopsFlag();
  const undoneCount = setTodoUndone();
  const $alertFlag = $userLogoBtn.find('.alert_flag');
  if (
    expireCount > 0 ||
    undoneCount > 0 ||
    (tipsFlag !== 0 && tipsFlag !== _getData('tipsFlag'))
  ) {
    $alertFlag.fadeIn();
  } else {
    $alertFlag.fadeOut();
  }
}
// 关闭页面加载
_d.isHome = true;
function closeLoading() {
  loadingPage.end();
  $searchBoxBtn.stop().slideDown(_d.speed, () => {
    const { msg, icon } = timeMsg();
    _msg.msg({ message: `${msg} ${userInfo.username}`, icon });
    // 查看消息
    reqChatNews()
      .then((result) => {
        if (result.code === 1) {
          const { group, friend } = result.data;
          if (group + friend > 0) {
            $showChatRoomBtn.attr(
              'class',
              'show_chat_room_btn run iconfont icon-xiaoxi'
            );
            _msg.msg(
              {
                message: '您有新的消息，请注意查收',
                type: 'warning',
                icon: 'iconfont icon-zaixianzixun',
                duration: 8000,
              },
              (type) => {
                if (type === 'click') {
                  showChatRoom();
                }
              },
              1
            );
          } else {
            $showChatRoomBtn.attr(
              'class',
              'show_chat_room_btn iconfont icon-liaotian'
            );
          }
        }
      })
      .catch(() => {});
    // 查看是否有未完成事项
    reqTodoList().then((res) => {
      if (res.code === 1) {
        setTodoUndone(res.data.undoneCount);
        todoMsg();
      }
    });
    reqCountList().then((res) => {
      if (res.code === 1) {
        setExpireCount(res.data.expireCount);
        countMsg();
      }
    });
  });
  $pageBg.removeClass('sce');
}
// 初始化
const onceInit = hdOnce(function () {
  // 设置默认聊天页为文件传输
  setCurChatAccount(userInfo.account);
  if (!isRoot()) {
    $rightBox.find('.admin').remove();
  }
  const urlParmes = queryURLParams(myOpen());
  // 立即打开指定聊天页
  if (urlParmes.c) {
    if (urlParmes.c === userInfo.account) {
      myOpen('/');
      return;
    }
    showChatRoom(urlParmes.c);
  }
  // 打开播放器
  if (urlParmes.p) {
    showMusicPlayerBox();
  }
  // 没有壁纸随机设置壁纸
  const isBig = isBigScreen();
  const { bg, bgxs } = userInfo;
  if ((isBig && !bg) || (!isBig && !bgxs)) {
    changeBg();
  }
});
// 更新用户信息
export function updateUserInfo(cb) {
  reqUserInfo()
    .then((result) => {
      if (result.code === 1) {
        setUserInfo(result.data);
        onceInit();
        const { logo, username, account, bg, bgxs, bgObj } = userInfo;
        _setData('username', username);
        // 标题
        _d.title = `Hello ${username}`;
        if (songIspaused()) {
          document.title = _d.title;
        }
        // 更新右边设置用户名
        updateRightBoxUsername(username);
        // 更新头像
        if (logo) {
          imgjz(_path.normalize(`/api/pub/logo/${account}/${logo}`))
            .then((cache) => {
              $userLogoBtn.css('background-image', `url(${cache})`);
            })
            .catch(() => {
              $userLogoBtn.css(
                'background-image',
                `url(${getTextImg(username)})`
              );
            });
        } else {
          $userLogoBtn.css('background-image', `url(${getTextImg(username)})`);
        }

        // 没有壁纸使用默认
        const isBig = isBigScreen();
        if ((isBig && !bg) || (!isBig && !bgxs)) {
          $pageBg.css('background-image', `url(${imgBgSvg})`);
          cb && cb();
        } else {
          // 更新壁纸
          let bgUrl = '';
          if (isBig) {
            bgUrl = getFilePath(`/bg/${getIn(bgObj, [bg, 'url']) || ''}`);
          } else {
            bgUrl = getFilePath(`/bg/${getIn(bgObj, [bgxs, 'url']) || ''}`);
          }
          imgjz(bgUrl)
            .then((cache) => {
              $pageBg.css('background-image', `url(${cache})`);
              cb && cb();
            })
            .catch(() => {
              $pageBg.css('background-image', `url(${imgBgSvg})`);
              cb && cb();
            });
        }
        // 更新个人信息
        renderUserinfo();
      }
    })
    .catch(() => {});
}
updateUserInfo(closeLoading);
// 右侧菜单
$userLogoBtn.on('click', showRightMenu);
// 右键设置
$document.on('contextmenu', function (e) {
  if (_getTarget(this, e, '#main', 1)) {
    e.preventDefault();
    if (isMobile()) return;
    settingMenu(e, 1);
  }
});
// 长按设置
longPress(document, '#main', function (e) {
  const ev = e.changedTouches[0];
  if (_getTarget(this, ev, '#main', 1)) {
    settingMenu(ev, 1);
  }
});
// 主页手势
_mySlide({
  el: '#main',
  up(e) {
    if (!_getTarget(this, e, '#main', 1)) return;
    // 打开播放器
    showMusicPlayerBox();
  },
  down(e) {
    if (!_getTarget(this, e, '#main', 1)) return;
    // 打开壁纸库
    showBgBox();
  },
  right(e) {
    if (!_getTarget(this, e, '#main', 1)) return;
    // 左侧书签
    showAside();
  },
  left(e) {
    if (!_getTarget(this, e, '#main', 1)) return;
    // 右侧设置
    showRightMenu();
  },
});
// 关闭所有窗口
export function closeAllwindow(all) {
  closeAllIframe();
  if (all) {
    closeMusicPlayer();
    closeChatRoom();
    closeTodoBox();
    closeCountBox();
    hideUserInfo();
    closeBgBox();
  }
}
// 隐藏所有窗口
export function hideAllwindow(all) {
  hideAllIframe();
  if (all) {
    hideMusicPlayBox();
    closeChatRoom();
    closeTodoBox();
    closeCountBox();
    closeEditLrcBox();
    closeMvBox();
    hideUserInfo();
    closeBgBox();
  }
}
$randomChangeBgBtn
  .on(
    'click',
    throttle(function () {
      changeBg();
    }, 2000)
  )
  .on('contextmenu', function (e) {
    e.preventDefault();
    if (!userInfo.account) return;
    const { bg, bgxs, bgObj } = userInfo;
    const obj = isBigScreen() ? getIn(bgObj, [bg]) : getIn(bgObj, [bgxs]);
    if (!obj || isMobile()) return;
    hdHomeBgBtn(e, obj);
  });
longPress($randomChangeBgBtn[0], function (e) {
  if (!userInfo) return;
  const { bg, bgxs, bgObj } = userInfo;
  let obj = isBigScreen() ? getIn(bgObj, [bg]) : getIn(bgObj, [bgxs]);
  if (!obj) return;
  let ev = e.changedTouches[0];
  hdHomeBgBtn(ev, obj);
});
// 壁纸菜单
function hdHomeBgBtn(e, obj) {
  let data = [
    {
      id: '2',
      text: '查看',
      beforeIcon: 'iconfont icon-kejian',
    },
    {
      id: '3',
      text: '下载壁纸',
      beforeIcon: 'iconfont icon-download',
    },
  ];
  if (isRoot()) {
    data.push({
      id: '1',
      text: '删除壁纸',
      beforeIcon: 'iconfont icon-shanchu',
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === '1') {
        delBg(
          e,
          [obj.id],
          () => {
            close();
            changeBg();
          },
          false,
          loading
        );
      } else if (id === '2') {
        close();
        imgPreview([
          {
            u1: getFilePath(`/bg/${obj.url}`),
            u2: getFilePath(`/bg/${obj.url}`, 1),
          },
        ]);
      } else if (id === '3') {
        close();
        downloadFile(
          [
            {
              fileUrl: getFilePath(`/bg/${obj.url}`),
              filename: _path.basename(obj.url)[0] || 'unknown',
            },
          ],
          'image'
        );
      }
    },
    '壁纸选项'
  );
}
// 快捷键
function keyboard(e) {
  const key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  const isFocus = $('input').is(':focus') || $('textarea').is(':focus');
  if (!isFocus) {
    if (ctrl && key === 'ArrowLeft') playPrevSong();
    if (ctrl && key === 'ArrowRight') playNextSong();
    //音量+
    if (ctrl && key === 'ArrowUp') {
      e.preventDefault();
      let vol = setMediaVolume();
      vol += 0.1;
      if (vol >= 1) {
        vol = 1;
      }
      setMediaVolume(vol);
      setPlayVolume();
      if (setRemotePlayState()) {
        remoteVol();
      }
      _msg.msg({
        message: parseInt(vol * 100) + '%',
        icon: `iconfont ${getVolumeIcon(vol)}`,
      });
    }
    //音量-
    else if (ctrl && key === 'ArrowDown') {
      e.preventDefault();
      let vol = setMediaVolume();
      vol -= 0.1;
      if (vol <= 0) {
        vol = 0;
      }
      setMediaVolume(vol);
      setPlayVolume();
      if (setRemotePlayState()) {
        remoteVol();
      }
      _msg.msg({
        message: parseInt(vol * 100) + '%',
        icon: `iconfont ${getVolumeIcon(vol)}`,
      });
    }
    //暂停/播放
    else if (key === ' ') {
      if (musicMvIsHide()) {
        changePlayState();
      } else {
        if (mvIspaused()) {
          playVideo();
        } else {
          pauseVideo();
        }
      }
    }
    // 迷你切换
    else if (key === 'm') {
      if (musicPlayerIsHide()) {
        showMusicPlayerBox();
      } else {
        hideMusicPlayBox();
      }
    }
    // 查看log
    else if (key === 'l') {
      showLogPage();
    }
    // 用户管理
    else if (key === 'u') {
      showRootPage();
    }
    // 聊天室
    else if (key === 'c' && !ctrl) {
      if (chatRoomWrapIsHide()) {
        showChatRoom();
      } else {
        closeChatRoom();
      }
    }
    // 关闭所有窗口
    else if (key === 'x' && !ctrl) {
      closeAllwindow(1);
    }
    // 隐藏所有窗口
    else if (key === 'q') {
      hideAllwindow(1);
    }
    // 书签
    else if (key === 's' && !ctrl) {
      if (searchBoxIsHide()) {
        showSearchBox();
      }
    }
    // 跳到历史记录
    else if (key === 'h') {
      showHistory();
    }
    // 书签管理
    else if (key === 'b') {
      showBmk();
    }
    // 文件管理
    else if (key === 'f') {
      showFileManage();
    }
    // 回收站
    else if (key === 't') {
      showTrash();
    }
    // 跳到笔记
    else if (key === 'n') {
      showNote();
    }
    // 新建笔记
    else if (key === 'e') {
      openInIframe('/edit/#new', '新笔记');
    }
    // 打开图床
    else if (key === 'p') {
      showPicture();
    }
    // 侧边栏
    else if (key === 'a' && !ctrl) {
      toggleAside();
    }
    // 播放模式
    else if (key === 'r') {
      switchPlayMode();
    }
    // 停止歌曲并关闭所有音乐窗口
    else if (key === 'o') {
      closeMusicPlayer();
    }
  }
}
document.addEventListener('keydown', keyboard);
let curScreenWidth = getScreenSize().w;
window.addEventListener(
  'resize',
  debounce(() => {
    const screenWidth = getScreenSize().w;
    if (curScreenWidth !== screenWidth) {
      curScreenWidth = screenWidth;
      updateUserInfo();
    }
  }, 500)
);
// 处理聊天数据
function hdChatType(resData) {
  const { flag, from, to, msgData } = resData;
  const chatAccount = setCurChatAccount(); //当前聊天框
  // 新消息处理
  if (flag === 'addmsg') {
    if (from.account === userInfo.account && from.account === to) {
      // 忽略自己给自己的消息通知
    } else if (from.account !== userInfo.account) {
      chatMessageNotification(
        from.des || from.username,
        msgData.content,
        from.account,
        to,
        from.logo
      );
    }
    // 聊天框是隐藏
    if (chatRoomWrapIsHide()) {
      if (from.account !== userInfo.account) {
        // 忽略自己发送的
        $showChatRoomBtn.attr(
          'class',
          'show_chat_room_btn run iconfont icon-xiaoxi'
        );
      }
      // 聊天框显示
    } else {
      if (
        (chatAccount === from.account && to !== 'chang') ||
        (chatAccount === 'chang' && to === 'chang') ||
        (from.account === userInfo.account && chatAccount === to)
      ) {
        // 消息是当前聊天框
        const acc =
          to === 'chang'
            ? 'chang'
            : from.account === userInfo.account && chatAccount === to
            ? to
            : from.account;
        const flag = chatMsgData.last()?.id || '';
        const word = $chatHeadBtns.find('.search_msg_inp input').val().trim();
        if (word.length > 100) {
          _msg.error('搜索内容过长');
          return;
        }
        const { start = '', end = '' } = getSearchDateLimit();
        reqChatReadMsg({
          type: 2,
          account: acc,
          flag,
          word,
          start,
          end,
        })
          .then((result) => {
            if (result.code === 1) {
              if (chatRoomWrapIsHide()) return;
              const data = result.data;
              // 是最后一页
              if (canToBottom()) {
                const cH = $chatListBox[0].clientHeight;
                if (
                  $chatListBox[0].scrollHeight -
                    $chatListBox[0].scrollTop -
                    cH <
                  cH
                ) {
                  renderChatMsg.push(
                    data,
                    $chatListBox.find('.chat_item').last()
                  );
                  $chatListBox.stop().animate(
                    {
                      scrollTop: $chatListBox[0].scrollHeight,
                    },
                    1000
                  );
                } else {
                  chatMsgData.push(data);
                }
              } else {
                if ($chatListBox.find('.chat_item').length === 0) {
                  renderChatMsg.reset(data);
                } else {
                  chatMsgData.push(data);
                }
              }
            }
          })
          .catch(() => {});
      } else {
        //新消息不是是当前聊天框
        if (from.account !== userInfo.account) {
          if (chatAccount === 'chang') {
            $chatHeadBtns.find('.c_msg_alert').stop().fadeIn(_d.speed);
          } else {
            if (to === 'chang') {
              $chatHeadBtns.find('.c_home_msg_alert').stop().fadeIn(_d.speed);
            } else {
              $chatHeadBtns.find('.c_msg_alert').stop().fadeIn(_d.speed);
            }
          }
        }
      }
    }
    // 撤回消息
  } else if (flag === 'del') {
    if (from.account === userInfo.account && from.account === to) {
    } else if (from.account !== userInfo.account) {
      chatMessageNotification(
        from.des || from.username,
        '撤回消息',
        from.account,
        to,
        from.logo
      );
    }
    if (!chatRoomWrapIsHide()) {
      if (
        (chatAccount === from.account && to !== 'chang') ||
        (chatAccount === 'chang' && to === 'chang') ||
        (from.account === userInfo.account && chatAccount === to)
      ) {
        chatMsgData.delete(msgData.msgId);
        const $chatItem = $chatListBox.find(`[data-id=${msgData.msgId}]`);
        if ($chatItem.length > 0) {
          $chatItem.stop().slideUp(_d.speed, () => {
            $chatItem.remove();
          });
        }
      }
    }
    //清空聊天框
  } else if (flag === 'clear') {
    if (from.account === userInfo.account && from.account === to) {
    } else if (from.account !== userInfo.account) {
      chatMessageNotification(
        from.des || from.username,
        '清空聊天记录',
        from.account,
        to,
        from.logo
      );
    }
    if (!chatRoomWrapIsHide()) {
      if (
        (chatAccount === from.account && to !== 'chang') ||
        (chatAccount === 'chang' && to === 'chang') ||
        (from.account === userInfo.account && chatAccount === to)
      ) {
        chatMsgData.reset();
        $chatListBox.find('.chat_list').html('');
      }
    }
  } else if (flag === 'shake') {
    if (from.account === userInfo.account && from.account === to) {
    } else if (from.account !== userInfo.account && to !== 'chang') {
      chatMessageNotification(
        from.des || from.username,
        '抖了你一下',
        from.account,
        to,
        from.logo
      );
      shakeChat();
    }
  }
}
// 处理远程播放
function hdRemotePlayType(resData) {
  const { state, obj } = resData;
  setRemotePlayState(false);
  playerRemoteBtnState();
  if (state === 1) {
    showMusicPlayerBox();
    if (setSongPlayMode() === 'random') {
      setCurPlayingList(myShuffle(deepClone(setPlayingList())));
    }
    musicPlay(obj);
  } else if (state === 0) {
    initMusicLrc();
    pauseSong();
  }
}
// 数据同步更新
function hdUpdatedataType(resData) {
  const { flag } = resData;
  //数据同步更新
  if (flag === 'music') {
    getSongList();
  } else if (flag === 'bookmark') {
    getBookMarkList();
    getHomeBmList();
  } else if (flag === 'userinfo') {
    updateUserInfo();
  } else if (flag === 'playinglist') {
    reqPlayerGetPlayList()
      .then(async (result) => {
        if (result.code === 1) {
          setPlayingList(result.data);
          setCurPlayingList(
            setSongPlayMode() === 'random'
              ? myShuffle(deepClone(setPlayingList()))
              : deepClone(setPlayingList())
          );
          await renderPlayingList();
          playingListHighlight();
        }
      }, true)
      .catch(() => {});
  } else if (flag === 'musicinfo') {
    if (!musicPlayerIsHide()) {
      if (songIspaused()) {
        reqPlayerGetLastPlay()
          .then((result) => {
            if (result.code === 1) {
              const _musicinfo = result.data;
              const { currentTime = 0, duration = 0, lastplay } = _musicinfo;
              if (!lastplay || (setRemotePlayState() && getPlaytimer())) return;
              setPlayingSongInfo(hdSongInfo(lastplay));
              updateSongInfo();
              setSongCurrentTime(parseFloat(currentTime) || 0);
              updateSongProgress();
              updatePlayingSongTotalTime(parseFloat(duration) || 0);
            }
          })
          .catch(() => {});
      }
    }
  } else if (flag === 'todolist') {
    getTodoList();
  } else if (flag === 'countlist') {
    getCountList();
  } else if (flag === 'bg') {
    renderBgList();
  } else if (flag === 'tips') {
    updateTipsFlag();
  }
}
// 上线通知
function handleOnlineMsg(data) {
  const { text, account } = data;
  _msg.online(text, (type) => {
    if (type === 'click') {
      showChatRoom(account);
    }
  });
}

let allowLoginPop = null,
  isLoding = false;
// 批准登录
function handleAllowLoginMsg(data) {
  const { ip, code, addr, os } = data;

  const msg = `设备：${os}\nIP：${ip}\n位置：${addr}\n验证码：${code.slice(
    0,
    3
  )} ${code.slice(3)}\n\n请求允许登录。`;

  if (allowLoginPop) {
    allowLoginPop.close();
  }

  allowLoginPop = _pop(
    {
      text: msg,
      confirm: {
        text: '批准登录',
      },
    },
    (type) => {
      allowLoginPop = null;
      if (type === 'confirm') {
        if (isLoding) {
          _msg.info('正在认证中');
          return;
        }
        isLoding = true;
        let num = 0;
        let timer = setInterval(() => {
          _msg.botMsg(`认证中…${++num}`, 1);
        }, 1000);
        function closeLogin() {
          clearInterval(timer);
          timer = null;
          isLoding = false;
          _msg.botMsg(`认证失败`, 1);
        }
        reqUserAllowLogin({ code })
          .then((res) => {
            closeLogin();
            if (res.code === 1) {
              _msg.success(res.codeText);
              _msg.botMsg(`认证成功`, 1);
            }
          })
          .catch(() => {
            closeLogin();
          });
      }
    }
  );
}

//同步数据
realtime.init('home').add((res) => {
  res.forEach((item) => {
    const { type, data } = item;
    //处理聊天指令
    if (type === 'chat') {
      hdChatType(data);
    } else if (type === 'updatedata') {
      hdUpdatedataType(data);
    } else if (type === 'play') {
      hdRemotePlayType(data);
    } else if (type === 'vol') {
      const { value } = data;
      setMediaVolume(value);
      setPlayVolume();
      _msg.msg({
        message: parseInt(value * 100) + '%',
        icon: `iconfont ${getVolumeIcon(value)}`,
      });
    } else if (type === 'progress') {
      const { value } = data;
      setSongCurrentTime(setPlayingSongInfo().duration * value);
    } else if (type === 'playmode') {
      const { state } = data;
      setSongPlayMode(state);
      switchPlayMode();
    } else if (type === 'online') {
      handleOnlineMsg(data);
    } else if (type === 'allowLogin') {
      handleAllowLoginMsg(data);
    }
  });
});
wave();
