const { resolve } = require('path');
// 压缩css
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
// 压缩js
const TerserPlugin = require('terser-webpack-plugin');
// css link方式引入
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { merge } = require('webpack-merge');
const { getPlugins } = require('./utils');
const corejsVersion = require('core-js/package.json').version.split('.').slice(0, 2).join('.');
// 目标浏览器：polyfill 注入和语法降级都以此为准，避免打包用不到的老浏览器垫片
const TARGETS = {
  chrome: '87',
  edge: '88',
  firefox: '78',
  safari: '14',
};
// css兼容前缀
const postcssConfig = {
  loader: 'postcss-loader',
  options: {
    postcssOptions: {
      plugins: [
        [
          'postcss-preset-env',
          {
            browsers: 'last 2 versions',
          },
        ],
      ],
    },
  },
};
module.exports = merge(require('./webpack.base'), {
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader', postcssConfig],
      },
      {
        test: /\.less$/i,
        include: resolve(__dirname, '..', 'src'),
        use: [MiniCssExtractPlugin.loader, 'css-loader', postcssConfig, 'less-loader'],
      },
      {
        test: /\.m?js$/,
        include: resolve(__dirname, '..', 'src'),
        use: [
          'thread-loader',
          {
            loader: 'babel-loader',
            options: {
              // 预定义环境
              presets: [
                [
                  // 指定环境插件
                  '@babel/preset-env',
                  // 配置信息
                  {
                    // 兼容的目标浏览器（不再兼容 IE 等老设备）
                    targets: TARGETS,
                  },
                ],
              ],
              plugins: [
                [
                  'babel-plugin-polyfill-corejs3',
                  // targets 由上方 preset-env 提供（插件内部通过 api.targets() 读取），
                  // 这里只需指定注入方式，避免按 browserslist 默认值注入多余的 core-js 垫片
                  { method: 'usage-global', version: corejsVersion },
                ],
              ],
            },
          },
        ],
      },
    ],
  },
  plugins: getPlugins(),
  // 关闭资源过大提示
  performance: { hints: false },
  optimization: {
    // 把 webpack 运行时代码抽成单独文件，业务代码更新时运行时代码仍可复用缓存
    runtimeChunk: 'single',
    // 模块分包
    splitChunks: {
      chunks: 'all',
    },
    minimize: true,
    minimizer: [
      // 压缩css
      new CssMinimizerPlugin(),
      // 压缩js
      new TerserPlugin({ test: /\.js$/ }),
    ],
  },
  mode: 'production',
});
