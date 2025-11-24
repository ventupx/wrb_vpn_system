import { HashRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
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
  );
}

export default App;
