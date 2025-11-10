// 自动防止网页休眠模块
const ScreenWakeLock = (() => {
  let wakeLock = null;
  let enabled = false;

  // 申请屏幕常亮
  async function requestLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');

      // 监听自动释放
      wakeLock.addEventListener(
        'release',
        () => {
          wakeLock = null;

          // 页面可见时自动重试
          if (enabled && document.visibilityState === 'visible') {
            requestLock();
          }
        },
        { once: true }
      );
    } catch {
      wakeLock = null;
    }
  }

  // 主动释放锁
  async function releaseLock() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  }

  // 页面可见性切换
  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;

    if (document.visibilityState === 'visible') {
      requestLock();
    } else {
      releaseLock();
    }
  });

  return {
    enable() {
      enabled = true;
      requestLock();
    },
    disable() {
      enabled = false;
      releaseLock();
    },
  };
})();

export default ScreenWakeLock;
