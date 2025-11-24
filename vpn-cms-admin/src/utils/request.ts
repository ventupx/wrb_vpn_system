import axios, { AxiosResponse } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { message } from 'antd';


// 定义API响应接口
export interface ApiResponse<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results(arg0: string, results: any): unknown;
  code: number;
  message: string;
  data: T;
}

// 创建axios实例
const instance: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
});


// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // 只有在不是FormData时才设置Content-Type为application/json
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
    // 处理响应体中code为401的情况
    if (response.data.code === 401 || response.data.code === 403) {
      // 清除本地存储的token
      localStorage.clear();
      // 使用window.location重定向到登录页
      window.location.href = '/login';
      message.error('登录已过期，请重新登录');
      return Promise.reject(new Error('Unauthorized'));
    }
    return response;
  },
  (error) => {
    // 处理HTTP状态码为401的情况
    if (error.response && error.response.status === 401) {
      // 清除本地存储的token
      localStorage.clear();
      // 使用window.location重定向到登录页
      window.location.href = '/login';
      message.error('登录已过期，请重新登录');
      return Promise.reject(new Error('Unauthorized'));
    }
    message.error(error.response?.data?.message || '请求失败');
    return Promise.reject(error);
  }
);

type RequestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

// 封装请求方法
const createRequest = (method: RequestMethod) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    // eslint-disable-next-line no-useless-catch
    try {
      let axiosConfig: AxiosRequestConfig = {
        method,
        url,
        ...config,
      };

      // 处理FormData
      if (config?.data instanceof FormData) {
        axiosConfig = {
          ...axiosConfig,
          data: config.data,
          // 不要手动设置Content-Type，让浏览器自动设置boundary
        };
      } else if (method === 'get') {
        axiosConfig.params = config?.params;
      } else {
        axiosConfig.data = config?.data;
      }

      const response: AxiosResponse<ApiResponse<T>> = await instance(axiosConfig);
      return response.data;
    } catch (error) {
      throw error;
    }
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