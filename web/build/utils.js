const { resolve } = require('path');
const webpack = require('webpack');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');
// css link方式引入
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// MATE信息
const GLOBAL_META = {
  // 现代字符集写法，放在最顶部
  charset: {
    charset: 'UTF-8',
  },
  // 基础 SEO
  google: {
    name: 'google',
    content: 'notranslate',
  },
  description: {
    name: 'description',
    content:
      '一个集书签管理、创作笔记、任务提醒、终端管理、文件存储下载、音乐播放、图片管理、图床、在线聊天和资源分享于一体的多功能个人门户网站',
  },
  // 移动端视口优化
  viewport: {
    name: 'viewport',
    content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
  },
  // 浏览器兼容
  'http-equiv:X-UA-Compatible': {
    'http-equiv': 'X-UA-Compatible',
    content: 'IE=edge,chrome=1',
  },
  // PWA / 移动端 Web App 体验
  'mobile-web-app-capable': {
    name: 'mobile-web-app-capable',
    content: 'yes',
  },
  'apple-mobile-web-app-capable': {
    name: 'apple-mobile-web-app-capable',
    content: 'yes',
  },
  'apple-mobile-web-app-status-bar-style': {
    name: 'apple-mobile-web-app-status-bar-style',
    content: 'black-translucent',
  },
  'apple-mobile-web-app-title': {
    name: 'apple-mobile-web-app-title',
    content: 'Hello',
  },
};
// 标题映射
const titleMap = {
  404: '404 - Page Not Found',
  addbmk: '添加书签',
  bmk: '书签管理',
  edit: '编辑笔记',
  file: '文件管理',
  history: '搜索历史管理',
  home: 'Hello',
  log: '日志管理',
  login: '登录',
  note: '笔记',
  notepad: '便条',
  notes: '笔记本',
  pic: '图床',
  root: '用户管理',
  sharebm: '书签分享',
  sharefile: '文件分享',
  sharelist: '分享管理',
  sharemusic: '音乐分享',
  ssh: '终端',
  sshlist: '终端管理',
  trash: '回收站',
  videoplay: '视频播放',
};
class AutoTitlePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('AutoTitlePlugin', (compilation) => {
      // 监听 HtmlWebpackPlugin 的 beforeEmit 钩子
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('AutoTitlePlugin', (data, cb) => {
        // 从当前页面的插件配置对象（plugin.options）中获取 title
        const title = data.plugin.options.title || '默认标题';
        const pageName = data.plugin.options.chunks[0];
        // 强行插入到 <head> 之后
        data.html = data.html.replace(
          /<head>/i,
          `<head><title>${title}</title>${pageName === 'home' ? '<link rel="manifest" href="/manifest.json">' : ''}`,
        );

        cb(null, data);
      });
    });
  }
}
const includePage = [];
const pageFiles = includePage.length > 0 ? includePage : fs.readdirSync('./src/page');
function getEntry() {
  const entry = {};
  pageFiles.forEach((item) => {
    entry[item] = `./src/page/${item}/index.js`;
  });
  return entry;
}
function getPlugins(isDev) {
  let plugins = [];
  pageFiles.forEach((item) => {
    const opt = {
      template: `./src/page/${item}/index.html`,
      filename: `${item === 'home' ? '' : `${item}/`}index.html`,
      chunks: [item],
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      },
      title: titleMap[item],
      meta: {
        ...GLOBAL_META,
        description: {
          name: 'description',
          content: `${item === 'home' ? '主页' : titleMap[item]} | ${
            GLOBAL_META.description.content
          }`,
        },
      },
      favicon: './src/images/img/icon.svg',
      inject: 'head',
    };
    if (isDev) {
      delete opt.minify;
    }
    plugins.push(new HtmlWebpackPlugin(opt));
  });
  plugins.push(new AutoTitlePlugin());
  if (!isDev) {
    plugins = [
      new CleanWebpackPlugin(),
      ...plugins,
      // 抽取css
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash:8].css',
        ignoreOrder: true, // 忽略css文件引入顺序
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: resolve(__dirname, '../src/css/notethem'),
            to: resolve(__dirname, '../../server/static/css/notethem'),
          },
          {
            from: resolve(__dirname, '..', 'src/favicon.ico'),
            to: resolve(__dirname, '../../server/static'),
          },
          {
            from: resolve(__dirname, '..', 'src/manifest.json'),
            to: resolve(__dirname, '../../server/static'),
          },
          {
            from: resolve(__dirname, '..', 'src/icons'),
            to: resolve(__dirname, '../../server/static/icons'),
          },
        ],
      }),
      new GenerateSW({
        swDest: 'sw.js',
        clientsClaim: true,
        skipWaiting: true,
      }),
    ];
  } else {
    plugins.push(new webpack.HotModuleReplacementPlugin());
  }
  return plugins;
}
module.exports = {
  getEntry,
  getPlugins,
};
