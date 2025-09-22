import nanoid from '../utils/nanoid';
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
const originURL = window.location.origin;
const serverURL = originURL + '/api';
const mediaURL = serverURL + '/getfile';
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
const fieldLength = {
  title: 200, // 标题名称
  expTime: 999, // 过期时间天
  sharePass: 20, // 分享提取码
  url: 2000, // 网址路径
  des: 500, // 备注
  filename: 255, // 文件名
  searchHistory: 200, // 搜索历史文本
  chatDes: 20, // 用户备注
  chatContent: 3000, // 消息文本
  countTitle: 300, // 倒计时标题
  top: 9999, // 置顶
  username: 20, // 用户名
  email: 255, // 邮箱
  todoContent: 500, // 代办内容
  noteCategoryTitle: 30, // 笔记分类标题
  operationTimeout: 10000, // 操作超时时间
  rainCodeSleep: 60 * 5, // 代码雨触发等待时间
  maxFileSize: 1024 * 1024 * 10000, // 最大切片
  textFileSize: 10 * 1024 * 1024, // 文本文件编辑大小
  noteSize: 300 * 1024, // 笔记大小
  lrcSize: 20 * 1024, // 歌词大小
  chatPageSize: 50, // 消息分页
  customCodeSize: 100 * 1024, // 自定义代码大小
};
const _d = {
  trashDirName: '.trash', // 垃圾回收站目录名
  noteHistoryDirName: '.noteHistory', // 笔记历史记录目录名
  fieldLength,
  serverURL,
  originURL,
  mediaURL,
  defaultFontFamily: 'Roboto, Arial, sans-serif', // 默认字体
  levelObj,
  speed: 300,
  translator: 'https://bing.com/translator?text={{}}', // 翻译接口
  temid: nanoid(true), // 临时id
  screen: 800, // 区分大屏小屏
  searchEngineData, // 搜索引擎
  searchWord, // 搜索提示服务
  checkColor: 'rgb(26 147 207 / 40%)', // 选中颜色
  title: 'Hello', // 标题
  emptyList: 'List is empty', // 空列表显示
  isHome: false, // 是否在主页
  maxSongList: 2000,
};
export default _d;
