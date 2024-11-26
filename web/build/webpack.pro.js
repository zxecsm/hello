const { resolve } = require('path');
// 压缩css
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
// 压缩js
const TerserPlugin = require('terser-webpack-plugin');
// css link方式引入
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { merge } = require('webpack-merge');
const { getPlugins } = require('./utils');
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
        include: resolve(__dirname, '..', 'src'),
        use: [MiniCssExtractPlugin.loader, 'css-loader', postcssConfig],
      },
      {
        test: /\.less$/i,
        include: resolve(__dirname, '..', 'src'),
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          postcssConfig,
          'less-loader',
        ],
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
                    // 兼容的目标浏览器
                    targets: {
                      chrome: '55',
                      ie: '11',
                    },
                    // 指定corejs版本
                    corejs: '3',
                    // usage 按需加载corejs
                    useBuiltIns: 'usage',
                  },
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
