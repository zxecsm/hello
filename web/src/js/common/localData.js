import { getTextSize } from '../utils/utils';

const defaultData = {
  gentlemanLockPd: '', // 君子锁密码
  clockData: {
    coord: {
      // 坐标
      left: 20,
      top: 20,
    },
    size: 0.14, // 大小
  }, // 时钟数据
  miniPlayerCoord: {},
  miniLrcCoord: {
    left: 50,
    top: 100,
  },
  mvIsTop: false, // MV置顶
  editLrcIsTop: false, // 编辑歌词置顶
  chatIsTop: false, // 聊天室置顶
  playerIsTop: false, // 播放器置顶
  countDownIsTop: false, // 倒计时置顶
  todoIsTop: false, // 待办置顶
  searchOpenPop: false, // 搜索结果弹窗打开
  noteWiden: false, // 笔记显示区域加宽
  username: '', // 用户名
  account: '', // 账号
  cacheState: true, // 开启缓存
  showpd: false, // 显示密码
  dark: 's', // 黑暗模式 s：随系统 y：开启 n：关闭
  headBtnToRight: true, // 窗口头部按钮排序
  clickLove: false, // 点击♥
  showStars: true, // 显示星星
  pmsound: true, // 提示音
  pageGrayscale: 0, // 页面灰度
  mediaVolume: 0.7, // 媒体音量
  fontType: 'default', // 字体类型
  notePageSize: 20, // 笔记每页显示
  editNoteFontSize: 0.22, // 编辑笔记输入框字体大小
  bmPageSize: 20, // 书签每页显示
  filesPageSize: 20, // 文件列表每页显示
  fileSort: { type: 'time', isDes: true }, // 文件排序
  fileFontSize: 0.22, // 文件编辑文本大小
  fileShowGrid: false, // 文件列表块状显示
  hiddenFile: false, // 隐藏隐藏文件
  searchFileSubDir: false, // 搜索子目录
  skipUpSameNameFiles: false, // 略过同名文件
  newNote: '', // 未保存的新笔记
  historyPageSize: 20, // 历史记录每页显示
  searchengine: 0, // 搜索引擎
  searchWordIdx: 1, // 搜索提示词服务
  filterbg: 0, // 壁纸模糊度
  songListSort: 'default', // 歌曲排序
  bgPageSize: 20, // 壁纸、图床每页显示
  trashPageSize: 20, // 回收站每页显示
  songPlaySpeed: ['x1', 1], // 歌曲播放速度
  showSongTranslation: false, // 显示歌词翻译
  lrcState: { size: 0.25, position: 'left' }, // 歌词状态
  songListPageSize: 50, // 歌曲每页显示
  asidePageSize: 6, // 侧边书签每页显示
  noteFontSize: 0.22, // 笔记文本大小
  tipsFlag: 0, // tips标识
  toolTip: true, // 提示工具
  editorOption: {
    animatedScroll: true, // 滚动动画
    showInvisibles: false, // 显示不可见字符（例如空格、制表符、换行符）
    fadeFoldWidgets: true, // 控制折叠部件（如代码折叠标记）是否淡入淡出
    newLineMode: 'auto', // 控制换行符的模式 "unix", "windows" 或 "auto"
    showGutter: true, // 显示行号
    useWrapMode: false, // 自动换行
    cursorStyle: 'ace', // 光标 "ace", "slim", "smooth", 或 "wide"
  },
};
function encode(obj) {
  return encodeURIComponent(JSON.stringify(obj));
}
function decode(str) {
  return JSON.parse(decodeURIComponent(str));
}
const localData = {
  localCache: new Map(),
  debounceTimers: new Map(),
  listeners: new Set(),
  trigger(event) {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch {}
    });
  },
  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  },
  offChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.delete(callback);
    }
  },
  get(key) {
    if (this.localCache.has(key)) return this.localCache.get(key).data;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = decode(raw);
        this.localCache.set(key, parsed);
        return parsed.data;
      }
    } catch {}

    return Object.prototype.hasOwnProperty.call(defaultData, key)
      ? defaultData[key]
      : null;
  },
  set(key, data, delay = 0) {
    this.localCache.set(key, { data });

    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }

    const timer = setTimeout(() => {
      try {
        const payload = encode({ data });
        localStorage.setItem(key, payload);
        this.trigger({ key, newValue: payload });
      } catch {}
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  },
  remove(key) {
    try {
      if (key) {
        localStorage.removeItem(key);
        this.localCache.delete(key);
        this.trigger({ key, newValue: null });
      } else {
        localStorage.clear();
        this.localCache.clear();
        this.trigger({ key: null, newValue: null });
      }
    } catch {}
  },
  getSize() {
    let size = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i); // 获取当前键名
        const value = localStorage.getItem(key); // 获取对应的值
        if (value != null) {
          size += getTextSize(value);
        }
      }
    } catch {}
    return size;
  },
  session: {
    localCache: new Map(),
    debounceTimers: new Map(),
    get(key) {
      if (this.localCache.has(key)) return this.localCache.get(key).data;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw !== null) {
          const parsed = decode(raw);
          this.localCache.set(key, parsed);
          return parsed.data;
        }
      } catch {}
      return null;
    },
    set(key, data, delay = 200) {
      this.localCache.set(key, { data });

      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
        this.debounceTimers.delete(key);
      }

      const timer = setTimeout(() => {
        try {
          const payload = encode({ data });
          sessionStorage.setItem(key, payload);
        } catch {}
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, timer);
    },
    remove(key) {
      try {
        if (key) {
          sessionStorage.removeItem(key);
          this.localCache.delete(key);
        } else {
          sessionStorage.clear();
          this.localCache.clear();
        }
      } catch {}
    },
  },
  defaultData,
};

window.addEventListener('storage', ({ key, newValue }) => {
  try {
    if (!key) {
      localData.localCache.clear();
    } else if (newValue !== null) {
      localData.localCache.set(key, decode(newValue));
    } else {
      localData.localCache.delete(key);
    }

    localData.trigger({ key, newValue });
  } catch {}
});

export default localData;
