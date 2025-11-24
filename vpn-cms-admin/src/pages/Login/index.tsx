import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import './index.css';

const { Title } = Typography;

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

interface LoginData {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const onFinish = async (values: LoginForm) => {
    try {
      setLoading(true);
      const response = await request.post<LoginData>('/login/', {
        data: {
          username: values.username, // 可以是用户名或邮箱
          password: values.password
        }
      });

      if (response.code === 200 && response.data) {
        const { access, refresh, user } = response.data;
        // 存储用户信息和token
        localStorage.setItem('userInfo', JSON.stringify(user));
        localStorage.setItem('token', access);
        localStorage.setItem('refreshToken', refresh);
        
        message.success(response.message || '登录成功');
        // 跳转到后台首页
        navigate('/dashboard');
      } else {
        message.error(response.message || '登录失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      
      <div className="login-card-wrapper">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2}>VPN管理系统</Title>
            <div className="login-desc">欢迎回来！请登录您的账号</div>
          </div>
          
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名或邮箱' }
              ]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名或邮箱" 
                autoComplete="username"
              />
            </Form.Item>
            
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能小于6位' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
                autoComplete="current-password"
              />
            </Form.Item>
            
            <Form.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <a className="login-form-forgot" href="/forgot-password">
                  忘记密码？
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                className="login-form-button"
                loading={loading}
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Login; 