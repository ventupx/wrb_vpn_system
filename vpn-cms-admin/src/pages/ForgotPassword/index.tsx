import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Steps } from 'antd';
import { MailOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import './index.css';

const { Title } = Typography;
const { Step } = Steps;

interface EmailForm {
  email: string;
}

interface VerifyForm {
  code: string;
}

interface ResetForm {
  password: string;
  confirmPassword: string;
}

interface EmailResponse {
  email: string;
}

interface VerifyResponse {
  email: string;
  code: string;
}

const ForgotPassword: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const navigate = useNavigate();
  const [code, setCode] = useState<string>('');

  const startCountdown = () => {
    setCountdown(300); // 5分钟 = 300秒
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onSendCode = async (values: EmailForm) => {
    try {
      setLoading(true);
      const response = await request.post<EmailResponse>('/forgot-password/', {
        data: { email: values.email }
      });
      
      if (response.code === 200) {
        setEmail(values.email);
        message.success(response.message || '验证码已发送到您的邮箱');
        startCountdown();
        setCurrentStep(1);
      } else {
        message.error(response.message || '发送验证码失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '发送验证码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async (values: VerifyForm) => {
    try {
      setLoading(true);
      const response = await request.post<VerifyResponse>('/verify-code/', {
        data: {
          email,
          code: values.code
        }
      });
      
      if (response.code === 200) {
        message.success(response.message || '验证码验证成功');
        setCode(values.code);
        setCurrentStep(2);
      } else {
        message.error(response.message || '验证码验证失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '验证码验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (values: ResetForm) => {
    try {
      setLoading(true);
      const response = await request.post<null>('/reset-password/', {
        data: {
          email,
          code,
          new_password: values.password
        }
      });
      
      if (response.code === 200) {
        message.success(response.message || '密码重置成功');
        navigate('/login');
      } else {
        message.error(response.message || '密码重置失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '密码重置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form name="emailForm" onFinish={onSendCode}>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="请输入邮箱地址"
                size="large"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="forgot-password-button"
                loading={loading}
                block
              >
                发送验证码
              </Button>
            </Form.Item>
          </Form>
        );
      case 1:
        return (
          <Form name="verifyForm" onFinish={onVerifyCode}>
            <Form.Item
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { len: 6, message: '请输入6位验证码' }
              ]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="请输入验证码"
                size="large"
                maxLength={6}
              />
            </Form.Item>
            <div className="countdown-text">
              {countdown > 0 ? `验证码有效期：${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : '验证码已过期'}
            </div>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="forgot-password-button"
                loading={loading}
                block
              >
                验证
              </Button>
            </Form.Item>
          </Form>
        );
      case 2:
        return (
          <Form
            name="resetForm"
            onFinish={onResetPassword}
          >
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度不能小于6位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入新密码"
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请确认新密码"
                size="large"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="forgot-password-button"
                loading={loading}
                block
              >
                重置密码
              </Button>
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card-wrapper">
        <Card className="forgot-password-card">
          <div className="forgot-password-header">
            <Title level={2}>重置密码</Title>
          </div>
          <Steps
            current={currentStep}
            className="forgot-password-steps"
            items={[
              { title: '验证邮箱' },
              { title: '验证码验证' },
              { title: '重置密码' },
            ]}
          />
          <div className="forgot-password-content">
            {renderStepContent()}
          </div>
          <div className="forgot-password-footer">
            <Button type="link" onClick={() => navigate('/login')}>
              返回登录
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword; 