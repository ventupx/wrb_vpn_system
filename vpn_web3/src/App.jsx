import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import Recharge from './pages/Recharge';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import NodeList from './pages/NodeList';
import OrderHistory from './pages/OrderHistory';
import HomeNew from './pages/HomeNew';
import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { balanceAtom, isLoginAtom } from './jotai';
import request from './utils/request';

// 初始化组件，用于在应用启动时检查用户登录状态并获取余额
const InitApp = () => {
  const setBalance = useSetAtom(balanceAtom);
  const setIsLogin = useSetAtom(isLoginAtom);

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('access_token');
    const isLoginLocal = localStorage.getItem('isLogin') === 'true';
    
    if (token && isLoginLocal) {
      setIsLogin(true);
      
      // 获取余额
      const fetchBalance = async () => {
        try {
          const response = await request.get('/user-balance/');
          if (response.code === 200) {
            setBalance(response.data.balance);
          }
        } catch (error) {
          console.error('获取余额失败:', error);
        }
      };
      
      fetchBalance();
    } else {
      setIsLogin(false);
      setBalance(0);
    }
  }, [setBalance, setIsLogin]);

  return null; // 这个组件不渲染任何内容
};

function App() {
  return (
    <Router>
      <InitApp />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeNew />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="news" element={<News />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="recharge" element={<Recharge />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="nodes" element={<NodeList />} />
          <Route path="orders" element={<OrderHistory />} />
          {/* <Route path="home" element={<HomeNew />} /> */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
