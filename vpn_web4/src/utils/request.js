import axios from 'axios';
import { message } from 'antd';

// 创建axios实例
const instance = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // 只有当数据不是FormData时才设置Content-Type为application/json
      if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    if (response.status === 401 || response.status === 403) {
      message.error('登录过期，请重新登录');
      localStorage.clear();
      window.location.href = '/';
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // 清除本地存储的token
      localStorage.clear();
      // 使用window.location重定向到登录页
      window.location.href = '/login';
      message.error('登录已过期，请重新登录');
      return Promise.reject(new Error('Unauthorized'));
    }
    // message.error(error.response?.data?.message || '请求失败');
    return Promise.reject(error);
  }
);

// 封装请求方法
const createRequest = (method) => {
  return async (url, data = {}, config = {}) => {
    let axiosConfig = {
      method,
      url,
      ...config
    };

    if (method === 'get') {
      axiosConfig.params = data;
    } else {
      axiosConfig.data = data;
    }

    const response = await instance(axiosConfig);
    return response.data;
  };
};

const request = {
  get: createRequest('get'),
  post: createRequest('post'),
  put: createRequest('put'),
  delete: createRequest('delete'),
  patch: createRequest('patch'),
};

export default request;