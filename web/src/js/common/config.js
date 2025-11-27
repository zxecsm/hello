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
const apiPath = '/api';
const getFileURL = apiPath + '/f';
const faviconURL = apiPath + '/icon';
const fontURL = apiPath + '/font';
const picURL = apiPath + '/p';
const userConfigDir = '/.h_config';
// 搜索引擎
const bingLogo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAMAAACahl6sAAAArlBMVEUMhIT////V6upnsrINhYUQhob9/v4djY0WiYkTiIgrlJQmkZHM5uY1mZn6/f273d2bzc2Av7/H4+OSyMhCoKAai4shj4/2+/u/399ttbVMpaU7nJyl0tJ8vb1hr69bra0wl5fS6OiNxcVWqqrw9/fE4eFzuLhSqKi02dmu1taWy8t3u7twt7fq9PTf7++Iw8NqtLRHoqI+nZ2p1NROpqbj8fHa7e2gz8/U6upFoaFbfBSFAAAEXUlEQVR42u3ciVraQBSG4f+M2SAhC/sOgqzSYtFWvf8ba0vVqGQgSfukM3DeK+B75pBlQgBjjDHGGGOMMcYYY4wxxhhjjDHGGGPs31g0DZwFr7WcVxzoTxBZ/iwclU3oTdCe5bejhatzjKA3Vus+erahqdeQOKZTKUFDgg5Y16GGUyYoWTtyoRVBMt+gFXlIHVq5gBU5m5AutCIPeYBW5CELaOUCQqbQijxkBK1cQMgQWrmAkCtoRR5yB63IQzrQijxkA61cQMgcWrmAkFto5ZJCDFuHTW55yACvOsGo0oDi0oQ4S6LlvGsr/SQlTQhG9NtNbeiquy0sD4nwprGkP6zlZqzokMlDPMSuKGYNdio+rksXYgf0nhU9KPeEK10IOvSJNblT6zmKPOTaQKwZ0KHvUb2hzMKkDMGGErXW3bIaC5M2xG2TzOOop8CpP20IBnTE47BrI4dCQoSJ98ozOmoVDZsmcig6BBGdchN20p8uiwv58SlkXKXT/OVt3UUaBYaU8FGN0mlF07GBHIoKqVQpLX971yuhUPKQryXkWJK4JYyebRNShYbkWpKY9WU9hkyBIQ5SL4kC25WZQnotSqbABrI85LuDAyElU2BL/0hIAwfq/pmEGKGGIV9sHPrmn0mIsTqTEHSFfiFNJHHnQrOQmyaSNe/EeYQAztDTKcSFnDkKziMEML/1dQkp4zijstYipFXGKYY7EWcR8ovzQ/2QMVKY+sqH+ClC6oGv/mj5FZxQCX0dvuzWiZByzdPj8Hs8pFHzdDkhUg9S5tzT5xJFHmJOqzpdNNIOiYxuoNdlPNWRpHev241VYojb1+8Oce0kHKqEdrsoVq2ET5zNE2m302htTXxUGl5TZtU6iiKSOyIDHxiLNmXmTWxIFRJyfYuPdgFlZq16KIQ8xOvgg/KKsguGBookEjqGeK85EZTZbGujGPKQ6hTv2IMcGX5YQdHEQUcXMacj8kzVtLCpkofM6nhTmnqUXXVgoyjykHYvPuLWA9JjqhJCgvhTVPqUw/2iwKmShyzL8X0s5dC+dVAcecjqtaMZCcrOqo1RIHnIvYu9RkdQDquHQqdKHtJv4jdn5FEOQcdGkeQhjzZ+MR8CymNbRqHkIWEDgLHrUx59BV4ZfwmpOQDGa8qjvVHgt5kvIdcm4EaUhzX571MVh1R7sOci31TVFfmdvCCidre3alEewZUKU/USYlU3ky+Uh1Dp32yE/7XvUS59pf5wRNx8zTdVM3Wmam9NuVhbhaZqz7yaUXaPPUWOVbE8V+yzoRpvWnxWuvIoAzFQbapi5ZBS6++gsNKoSqm0R2pOVcZvihjYUJ45vaYTwgq04E7omOpC9al6Y0yfSEbcajBVseZENlVj6MXotulQu6vMe5Pp2RP6RMwVfWH6BOPZo/dCNW5l87C3ccZMx6mK1au0Jzpq3XRk19g/qFqre3mY3u5JqLJB8pdK2pzIGWOMMcYYY4wxxhhjjDHGGGNn7CdHbEpPmxq5TwAAAABJRU5ErkJggg==';
const defaultSearchEngineData = {
  id: 'bing',
  title: 'Bing',
  logo: bingLogo,
  link: 'https://bing.com/search?q={{}}',
  color: '#1B8473',
};
const defaultTranslatorData = {
  id: 'bing',
  title: 'Bing',
  logo: bingLogo,
  link: 'https://bing.com/translator?text={{}}',
};
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
  cdHistoryLength: 100, // 文件操作历史记录个数
};
const _d = {
  appName: 'hello',
  notifyAccount: 'hello',
  chatRoomAccount: 'chang',
  aboutid: 'about',
  tipsid: 'tips',
  adminAccount: 'root',
  userConfigDir,
  trashDir: `/.trash`,
  noteHistoryDir: `${userConfigDir}/note_history`,
  fontDir: `${userConfigDir}/appFiles/font`,
  pubDir: `${userConfigDir}/pub`,
  fileConfigDir: `${userConfigDir}/file_config`,
  appFilesDir: `${userConfigDir}/appFiles`,
  userLogoDir: `${userConfigDir}/logo`,
  searchConfigDir: `${userConfigDir}/search_config`,
  fileHistoryDirName: '.history',
  fieldLength,
  apiPath,
  fontURL,
  picURL,
  originURL,
  getFileURL,
  faviconURL,
  defaultFontFamily: 'Roboto, Arial, sans-serif', // 默认字体
  levelObj,
  speed: 300,
  defaultTranslatorData,
  translatorData: [defaultTranslatorData], // 翻译接口
  temid: nanoid(true), // 临时id
  screen: 800, // 区分大屏小屏
  defaultSearchEngineData,
  searchEngineData: [defaultSearchEngineData], // 搜索引擎
  searchWord, // 搜索提示服务
  checkColor: 'rgb(26 147 207 / 40%)', // 选中颜色
  title: 'Hello', // 标题
  emptyList: 'List is empty', // 空列表显示
  isHome: false, // 是否在主页
  maxSongList: 2000,
};
export default _d;
