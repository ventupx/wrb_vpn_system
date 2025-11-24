import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import News from './pages/News';
import Recharge from './pages/Recharge';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import NodeList from './pages/NodeList';
import OrderHistory from './pages/OrderHistory';

// 设置dayjs为中文
dayjs.locale('zh-cn');

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="news" element={<News />} />
            <Route path="recharge" element={<Recharge />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="nodes" element={<NodeList />} />
            <Route path="orders" element={<OrderHistory />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
