import { atom } from 'jotai';

// 创建余额原子状态，从localStorage读取初始值，并在值变化时更新localStorage
export const balanceAtom = atom(
  Number(localStorage.getItem('balance')) || 0,
  (get, set, newValue) => {
    localStorage.setItem('balance', newValue);
    set(balanceAtom, newValue);
  }
);


// 创建登录状态原子，从localStorage读取初始值，并在值变化时更新localStorage
export const isLoginAtom = atom(
  localStorage.getItem('isLogin') === 'true' || false,
  (get, set, newValue) => {
    localStorage.setItem('isLogin', newValue);
    set(isLoginAtom, newValue);
  }
);