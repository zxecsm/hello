const { resolve } = require('path');
const { getEntry } = require('./utils');

module.exports = {
  cache: {
    type: 'filesystem',
  },
  entry: getEntry(),
  output: {
    filename: 'js/[name].[chunkhash:8].js',
    path: resolve(__dirname, '../../server/static'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2|mp3)$/i,
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
