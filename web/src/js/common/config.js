import { getPreUrl, nanoid } from '../utils/utils';
const levelObj = {
  upProgressbox: 100, // 上传进度（静）
  rightBox: 101, // 右键菜单（静）
  imgPreview: 102, // 图片预览（动）
  msg: 103, // 通知框（静）
  percentBar: 104, // 调节器（动）
  popConfirm: 104, // 确认框（动）
  hechang: 105, // 何畅（静）
  loading: 107, // 加载动画（静）
  clickLove: 107, // 点击（动）
};
const url = getPreUrl() + '/api';
const serverURL = url;
const mediaURL = url + '/getfile';
// 搜索引擎
const searchEngineData = [
  {
    name: 'Bing',
    icon: '/api/pub/searchlogo/bing-xs.png',
    logo: '/api/pub/searchlogo/bing.png', // 图片h / w = 40%
    searchlink: 'https://bing.com/search?q={{}}',
    color: '#1B8473',
  },
];
// 搜索提示服务
const searchWord = [
  {
    type: 'close',
  },
  {
    type: 'Bing',
    link: 'https://api.bing.com/qsonhs.aspx?type=cb&q={{}}&cb=window.bing.sug',
  },
  {
    type: 'Google',
    link: 'https://suggestqueries.google.com/complete/search?client=youtube&q={{}}&jsonp=window.google.ac.h',
  },
  {
    type: 'Baidu',
    link: 'https://suggestion.baidu.com/su?wd={{}}&cb=window.baidu.sug',
  },
];
const fieldLenght = {
  title: 200, // 标题名称
  expTime: 999, // 过期时间天
  sharePass: 20, // 分享提取码
  url: 2000, // 网址路径
  des: 500, // 备注
  filename: 255, // 文件名
  searchHistory: 200, // 搜索历史文本
  chatDes: 20, // 用户备注
  countTitle: 300, // 倒计时标题
  top: 9999, // 置顶
  username: 20, // 用户名
  email: 255, // 邮箱
  todoContent: 500, // 代办内容
  noteCategoryTitle: 30, // 笔记分类标题
  operationTimeout: 10000, // 操作超时时间
  rainCodeSleep: 60 * 5, // 代码雨触发等待时间
  maxFileSize: 1024 * 1024 * 5000, // 最大切片
  textFileSize: 10 * 1024 * 1024, // 文本文件编辑大小
  noteSize: 300 * 1024, // 笔记大小
  lrcSize: 20 * 1024, // 歌词大小
  chatPageSize: 50, // 消息分页
  customCodeSize: 100 * 1024, // 自定义代码大小
};
const _d = {
  fieldLenght,
  serverURL,
  mediaURL,
  levelObj,
  speed: 500,
  translator: 'https://bing.com/translator?text={{}}', // 翻译接口
  temid: nanoid(), // 临时id
  screen: 800, // 区分大屏小屏
  searchEngineData, // 搜索引擎
  searchWord, // 搜索提示服务
  checkColor: 'rgb(26 147 207 / 40%)', // 选中颜色
  title: 'Hello', // 标题
  emptyList: 'List is empty', // 空列表显示
  isHome: false, // 是否在主页
  maxSongList: 2000,
  // local数据默认值
  localStorageDefaultData: {
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
    showpd: false, // 显示密码
    dark: 's', // 黑暗模式 s：随系统 y：开启 n：关闭
    headBtnToRight: true, // 窗口头部按钮排序
    clickLove: false, // 点击♥
    pmsound: true, // 提示音
    pageGrayscale: 0, // 页面灰度
    mediaVolume: 0.7, // 媒体音量
    fontType: 'default', // 字体类型
    notePageSize: 20, // 笔记每页显示
    editNoteFontSize: 0.22, // 编辑笔记输入框字体大小
    bmPageSize: 20, // 书签每页显示
    filesPageSize: 20, // 文件列表每页显示
    curFileDirPath: '/', // 文件路径
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
  },
};
export default _d;
