import { useState } from 'react';
import { Form, Input, Button, Card, message, Steps } from 'antd';
import { MailOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';

const { Step } = Steps;

const ForgotPassword = () => {
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSendCode = async () => {
    try {
      setLoading(true);
      const response = await request.post('/customer/send-reset-code/', {
        email: email
      });
      
      if (response.code === 200) {
        message.success('验证码已发送到您的邮箱');
        setCurrent(1);
      } else {
        message.error(response.message || '发送验证码失败');
      }
    } catch {
      message.error('发送验证码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setLoading(true);
      const response = await request.post('/forgot-password/', {
        email: email,
        code: verificationCode
      });
      
      if (response.code === 200) {
        message.success('验证码验证成功');
        setCurrent(2);
      } else {
        message.error(response.message || '验证码验证失败');
      }
    } catch {
      message.error('验证码验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    try {
      setLoading(true);
      const response = await request.post('/reset-password/', {
        email: email,
        code: verificationCode,
        new_password: values.newPassword
      });
      
      if (response.code === 200) {
        message.success('密码重置成功');
        navigate('/login');
      } else {
        message.error(response.message || '密码重置失败');
      }
    } catch {
      message.error('密码重置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '输入邮箱',
      content: (
        <Form layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-gray-400" />}
              placeholder="请输入注册邮箱"
              className="py-2 rounded-lg"
              onChange={(e) => setEmail(e.target.value)}
            />
          </Form.Item>
          <Button
            type="primary"
            onClick={handleSendCode}
            loading={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
          >
            发送验证码
          </Button>
        </Form>
      ),
    },
    {
      title: '验证码验证',
      content: (
        <Form layout="vertical" size="large">
          <Form.Item
            name="code"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <Input
              prefix={<SafetyOutlined className="text-gray-400" />}
              placeholder="请输入验证码"
              className="py-2 rounded-lg"
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </Form.Item>
          <Button
            type="primary"
            onClick={handleVerifyCode}
            loading={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
          >
            验证
          </Button>
        </Form>
      ),
    },
    {
      title: '设置新密码',
      content: (
        <Form
          form={form}
          layout="vertical"
          size="large"
          onFinish={handleResetPassword}
        >
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="请输入新密码"
              className="py-2 rounded-lg"
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            rules={[
              { required: true, message: '请确认新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="请确认新密码"
              className="py-2 rounded-lg"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
          >
            确认修改
          </Button>
        </Form>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <Card className="w-full max-w-2xl shadow-xl rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">找回密码</h1>
          <p className="text-blue-100 mt-2">请按照以下步骤重置您的密码</p>
        </div>

        <div className="p-8">
          <Steps current={current} className="mb-8">
            {steps.map(item => (
              <Step key={item.title} title={item.title} />
            ))}
          </Steps>
          <div className="steps-content">{steps[current].content}</div>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword; 