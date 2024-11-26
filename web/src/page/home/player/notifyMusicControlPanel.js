const opts = {
  play: () => {},
  pause: () => {},
  previoustrack: () => {},
  nexttrack: () => {},
  seekbackward: () => {},
  seekforward: () => {},
};
try {
  if ('mediaSession' in navigator) {
    if ('setActionHandler' in navigator.mediaSession) {
      // 设置媒体控制事件
      navigator.mediaSession.setActionHandler('play', () => {
        opts.play();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        opts.pause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        opts.previoustrack();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        opts.nexttrack();
      });

      // 设置快退事件
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        opts.seekbackward();
      });

      // 设置快进事件
      navigator.mediaSession.setActionHandler('seekforward', () => {
        opts.seekforward();
      });
    }
  }
} catch {}

const notifyMusicControlPanel = {
  bind(type, cb) {
    opts[type] = cb;
    return this;
  },
  updateMetadata({ title, artist, album, artwork }) {
    try {
      if ('mediaSession' in navigator) {
        if ('metadata' in navigator.mediaSession) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            album,
            artwork,
          });
        }
      }
    } catch {}
  },
  updatePositionState({ duration, playbackRate, position }) {
    try {
      if ('mediaSession' in navigator) {
        if ('setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setPositionState({
            duration, // 媒体总时长
            playbackRate, // 播放速率
            position, // 当前播放时间
          });
        }
      }
    } catch {}
  },
};

export default notifyMusicControlPanel;
