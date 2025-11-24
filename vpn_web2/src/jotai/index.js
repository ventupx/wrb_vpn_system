import { atom } from 'jotai';

// 创建余额的基础原子状态
const balanceBaseAtom = atom(
  Number(localStorage.getItem('balance')) || 0
);

// 创建余额的读写原子，实现同步更新localStorage和jotai状态
export const balanceAtom = atom(
  (get) => get(balanceBaseAtom),
  (get, set, newValue) => {
    // 更新jotai状态
    set(balanceBaseAtom, newValue);
    // 同步更新localStorage
    localStorage.setItem('balance', newValue.toString());
  }
);

// 创建登录状态的基础原子，从localStorage读取初始值
const isLoginBaseAtom = atom(
  localStorage.getItem('isLogin') === 'true'
);

// 创建登录状态的读写原子，实现同步更新localStorage和jotai状态
export const isLoginAtom = atom(
  (get) => get(isLoginBaseAtom),
  (get, set, newValue) => {
    // 更新jotai状态
    set(isLoginBaseAtom, newValue);
    // 同步更新localStorage
    localStorage.setItem('isLogin', newValue.toString());
  }
);