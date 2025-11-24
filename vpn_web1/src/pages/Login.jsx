import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import request from '../utils/request';
import { useSetAtom } from 'jotai';
import { balanceAtom, isLoginAtom, updateBalance } from '../jotai';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setBalance = useSetAtom(balanceAtom);
  const setIsLogin = useSetAtom(isLoginAtom);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await request.post('/customer/login/', {
        username: values.username,
        password: values.password
      });
      
      if (response.code === 200) {
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // 更新余额到jotai状态和localStorage
        const userBalance = response.data.user.balance || 0;
        updateBalance(setBalance, userBalance);
        // 更新登录状态并保存到localStorage
        localStorage.setItem('isLogin', 'true');
        setIsLogin(true);
        
        message.success('登录成功');
        navigate('/nodes');
      } else {
        message.error(response.message || '登录失败');
      }
    } catch {
      message.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <Card className="w-full max-w-md shadow-xl rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 md:p-6 text-center">
          <h1 className="text-xl md:text-2xl font-bold text-white">欢迎回来</h1>
          <p className="text-blue-100 mt-2">请登录您的账号</p>
        </div>

        <div className="p-4 md:p-8">
          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            className="space-y-4 md:space-y-6"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名/邮箱' }]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="用户名/邮箱"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="密码"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700">
                忘记密码？
              </Link>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                登录
              </Button>
            </Form.Item>

            <div className="text-center">
              <span className="text-gray-600">还没有账号？</span>
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                立即注册
              </Link>
            </div>
          </Form>
        </div>
      </Card>
    </div>
  );
};

export default Login;