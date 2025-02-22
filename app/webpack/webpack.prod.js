/*jshint esversion: 6 */
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const meta = require('./meta.json');

const {GenerateSW} = require('workbox-webpack-plugin');
module.exports = merge(common, {
  cache: false,
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      meta: meta,
      template: './src/html/static.html',
      filename: './static.html',
      chunks: ['sw', 'mx', 'theme', 'static', 'jquery']
    }),
    new HtmlWebpackPlugin({
      meta: meta,
      template: './src/html/index.html',
      filename: './index.html',
      chunks: ['sw', 'mx', 'theme', 'jquery', 'shiny']
    }),
    new CopyWebpackPlugin([
      {
        from: './webpack/sw_listen_skip_waiting_install.js',
        to: 'sw_listen_skip_waiting_install.js'
      }
    ]),
    new GenerateSW({
      swDest: './service-worker.js',
      mode: 'production',
      skipWaiting: false,
      clientsClaim: true,
      exclude: [/\.DS_Store/, /.*\.swp$/, /^fontstack/, /^sprites/],
      importScripts: ['sw_listen_skip_waiting_install.js'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.mapbox\.com\//,
          handler: 'CacheFirst'
        },
        {
          urlPattern: /^https:\/\/tiles\.mapbox\.com\//,
          handler: 'CacheFirst'
        },
        {
          urlPattern: /^(https|http):\/\/(api|apidev)\.mapx\..*\/get\/views\/list\//,
          handler: 'NetworkFirst'
        },
        {
          urlPattern: /^(https|http):\/\/(api|apidev)\.mapx\..*\/get\/source\/table\//,
          handler: 'NetworkFirst'
        },
        {
          urlPattern: /^https:\/\/.*wms\?bbox=/,
          handler: 'CacheFirst'
        },
        {
          urlPattern: /^https:\/\/.*api\.here\.com\/maptile/,
          handler: 'CacheFirst'
        }
      ]
    })
  ]
});
