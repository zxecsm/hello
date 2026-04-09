import axios from 'axios';
import appConfig from '../data/config.js';

const request = axios.create({
  timeout: 3000,
});

request.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  config.headers['x-source-service'] = appConfig.appFlag;

  return config;
});

export default request;
