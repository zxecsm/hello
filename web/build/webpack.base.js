const { resolve } = require('path');
const { getEntry } = require('./utils');

module.exports = {
  cache: {
    type: 'filesystem',
    // 配置文件变化时让缓存失效
    buildDependencies: {
      config: [
        __filename,
        resolve(__dirname, 'utils.js'),
        resolve(__dirname, 'webpack.dev.js'),
        resolve(__dirname, 'webpack.pro.js'),
      ],
    },
  },
  entry: getEntry(),
  output: {
    // 使用 contenthash：内容不变则文件名不变，可长期强缓存
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].js',
    path: resolve(__dirname, '../../server/static'),
    // 统一绝对路径，避免子目录页面（/note/index.html）里的相对路径问题
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|webp|svg|eot|ttf|woff|woff2|mp3)$/i,
        include: resolve(__dirname, '..', 'src'),
        type: 'asset',
        generator: {
          filename: 'images/img/[name].[hash:8][ext]',
        },
      },
      {
        test: /\.html$/i,
        include: resolve(__dirname, '..', 'src'),
        loader: 'html-loader',
        options: {
          esModule: false,
        },
      },
      {
        test: /\.worker\.js$/,
        include: resolve(__dirname, '..', 'src'),
        use: {
          loader: 'worker-loader',
          options: { inline: 'no-fallback' },
        },
      },
    ],
  },
};
