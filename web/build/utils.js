const { resolve } = require('path');
const webpack = require('webpack');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');
// css link方式引入
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const includePage = [];
const pageFiles =
  includePage.length > 0 ? includePage : fs.readdirSync('./src/page');
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
    };
    if (isDev) {
      delete opt.minify;
    }
    plugins.push(new HtmlWebpackPlugin(opt));
  });
  if (!isDev) {
    plugins = [
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
        ],
      }),
      new GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:html|css|js|png|jpg|jpeg|svg|woff2?)$/,
            handler: 'CacheFirst', // 使用缓存优先策略
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50, // 最大缓存条目
                maxAgeSeconds: 30 * 24 * 60 * 60, // 缓存30天
              },
            },
          },
        ],
      }),
      new CleanWebpackPlugin(),
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
