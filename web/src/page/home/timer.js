import { reqPlayerLastPlay } from '../../api/player';
import _msg from '../../js/plugins/message';
import { _setTimeout, formatDate } from '../../js/utils/utils';
import { getSongList, musicPlayerIsHide, setCurOpenSongListId, setMusicList } from './player';
import { setPlayingSongInfo, setSongCurrentTime, songIspaused } from './player/lrc';
let lastPlayCount = 0; // 同步播放进度计数
(function timerFn() {
  try {
    // 同步播放进度
    lastPlayCount++;
    if (lastPlayCount >= 10) {
      lastPlayCount = 0;
      if (!songIspaused()) {
        updateLastPlay(0);
      }
    }
    // 如果歌曲正在播放，则标题跑马灯
    if (!songIspaused()) {
      const title = document.title,
        first = title.charAt(0),
        other = title.substring(1);
      document.title = other + first;
    }
    const [, , , hour, minute, second] = formatDate({
      template: '{0}-{1}-{2}-{3}-{4}-{5}-{6}',
      timestamp: +Date.now(),
    }).split('-');
    if (
      (minute === 59 && second >= 30) ||
      (minute === 29 && second >= 30) ||
      (minute === 0 && second === 0) ||
      (minute === 30 && second === 0)
    ) {
      _msg.botMsg(`整点报时：${hour}:${minute}:${second}`, 1);
    }
  } catch {}
  _setTimeout(timerFn, 1000);
})();
export function resetLastPlayCount() {
  lastPlayCount = 0;
}
// 更新最后播放
export function updateLastPlay(history, y) {
  reqPlayerLastPlay({
    history,
    lastplay: setPlayingSongInfo(),
    currentTime: setSongCurrentTime(),
    duration: setPlayingSongInfo().duration,
  })
    .then((result) => {
      if (result.code === 1) {
        if (y) {
          if (!musicPlayerIsHide()) {
            if (setMusicList().findIndex((item) => item.id === setCurOpenSongListId()) === 0) {
              getSongList();
            }
          }
        }
        return;
      }
    })
    .catch(() => {});
}
