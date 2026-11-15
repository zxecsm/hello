const { resolve } = require('path');
const { merge } = require('webpack-merge');
const { getPlugins } = require('./utils');

module.exports = merge(require('./webpack.base'), {
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.m?js$/,
        include: resolve(__dirname, '..', 'src'),
        use: 'thread-loader',
      },
      {
        test: /\.less$/i,
        include: resolve(__dirname, '..', 'src'),
        use: ['style-loader', 'css-loader', 'less-loader'],
      },
    ],
  },
  plugins: getPlugins(1),
  devServer: {
    static: {
      directory: resolve(__dirname, '..', 'src'),
    },
    compress: true,
    // 监听所有网卡（:: 双栈），局域网 / 手机可通过 IPv4 或 IPv6 访问开发页面
    host: '::',
    port: 55556,
    open: true,
    hot: false,
    allowedHosts: 'all',
    proxy: [
      {
        pathFilter: ['/api'],
        // 与服务端 PORT 环境变量保持一致，默认 55555
        target: `http://127.0.0.1:${process.env.PORT || 55555}`,
      },
    ],
  },
  optimization: {
    // 只加载必要的模块
    splitChunks: {
      chunks: 'all',
    },
  },
  mode: 'development',
  // devtool: 'source-map',
  devtool: 'cheap-module-source-map',
  watchOptions: {
    ignored: /node_modules/, // 忽略 node_modules
    poll: 1000, // 每秒检查一次改动
  },
});
