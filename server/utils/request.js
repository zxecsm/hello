import axios from 'axios';
import appConfig from '../data/config.js';

const request = axios.create({
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  config.headers['x-source-service'] = appConfig.appFlag;

  return config;
});

request.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // 检查是否需要重试
    if (!config || !config.retry) {
      return Promise.reject(error);
    }

    // 不重试取消请求
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // 判断是否应该重试（只重试可恢复的错误）
    const isTimeout = error.code === 'ECONNABORTED';
    const isNetworkError = !error.response;
    const isServerError = error.response?.status >= 500;

    const shouldRetry = isTimeout || isNetworkError || isServerError;

    if (!shouldRetry) {
      // 4xx 客户端错误不重试
      return Promise.reject(error);
    }

    // 重试计数
    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= config.retry) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;

    // 计算延迟（指数退避）
    const baseDelay = config.retryDelay || 1000;
    const useExponential = config.exponentialBackoff !== false; // 默认启用
    let delayTime = baseDelay;

    if (useExponential) {
      delayTime = baseDelay * Math.pow(2, config.__retryCount - 1); // 1, 2, 4, 8, 16, ...
      delayTime = Math.min(delayTime, 15000); // 最大延迟 15 秒
    }

    // 延迟后重试
    await new Promise((resolve) => setTimeout(resolve, delayTime));

    // 创建新配置，重置超时计时器
    const newConfig = {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      headers: { ...config.headers },
      timeout: config.timeout, // 重新开始计时
      // 携带重试配置
      retry: config.retry,
      retryDelay: config.retryDelay,
      exponentialBackoff: config.exponentialBackoff,
      __retryCount: config.__retryCount, // 保留计数
    };

    return request(newConfig);
  },
);

export default request;
