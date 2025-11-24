import { atom } from 'jotai';

// 创建余额原子状态，从localStorage读取初始值
export const balanceAtom = atom(
  Number(localStorage.getItem('balance')) || 0
);

// 当余额变化时，同步更新localStorage
export const updateBalanceAtom = atom(
  (get) => get(balanceAtom),
  (get, set, newBalance) => {
    set(balanceAtom, newBalance);
    localStorage.setItem('balance', newBalance);
  }
);

// 创建登录状态原子，从localStorage读取初始值
export const isLoginAtom = atom(
  localStorage.getItem('isLogin') === 'true' || false
);

// 当登录状态变化时，同步更新localStorage
export const updateLoginAtom = atom(
  (get) => get(isLoginAtom),
  (get, set, isLogin) => {
    set(isLoginAtom, isLogin);
    localStorage.setItem('isLogin', isLogin);
  }
);