import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';

const Register = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await request.post('/users/register/', {
        username: values.username,
        email: values.email,
        password: values.password,
        confirm_password: values.confirmPassword
      });
      
      if (response.code === 200) {
        message.success('注册成功');
        navigate('/login');
      } else {
        message.error(response.message || '注册失败');
      }
    } catch {
      message.error('注册失败，用户名重复');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <Card className="w-full max-w-md shadow-xl rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">创建新账户</h1>
          <p className="text-blue-100 mt-2">加入我们，开始使用VPN服务</p>
        </div>

        <div className="p-8">
          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            className="space-y-6"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 4, message: '用户名长度不能少于4位' }
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="用户名"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-gray-400" />}
                placeholder="邮箱"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能少于6位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="密码"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[
                { required: true, message: '请确认密码' },
                { min: 6, message: '密码长度不能少于6位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="确认密码"
                className="py-2 rounded-lg"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                注册
              </Button>
            </Form.Item>

            <div className="text-center">
              <span className="text-gray-600">已有账号？</span>
              <Button
                type="link"
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                立即登录
              </Button>
            </div>
          </Form>
        </div>
      </Card>
    </div>
  );
};

export default Register; 