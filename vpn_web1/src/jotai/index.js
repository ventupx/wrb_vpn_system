import { atom } from 'jotai';

// 创建余额原子状态，从localStorage读取初始值
export const balanceAtom = atom(
  Number(localStorage.getItem('balance')) || 0
);

// 创建登录状态原子，从localStorage读取初始值
export const isLoginAtom = atom(
  localStorage.getItem('isLogin') === 'true'
);

// 通用的更新余额函数，同时更新localStorage和jotai状态
export const updateBalance = (setBalance, newBalance) => {
  localStorage.setItem('balance', newBalance);
  setBalance(newBalance);
};

// 全局退出登录函数
let globalLogoutFunction = null;

export const setGlobalLogoutFunction = (logoutFn) => {
  globalLogoutFunction = logoutFn;
};

export const executeGlobalLogout = () => {
  if (globalLogoutFunction) {
    globalLogoutFunction();
  }
};