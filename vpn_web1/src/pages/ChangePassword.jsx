import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';

const ChangePassword = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await request.put('/change_password/', {
        old_password: values.oldPassword,
        "confirm_password": values.confirmPassword,
        new_password: values.newPassword
      });
      
      if (response.code === 200) {
        message.success('密码修改成功');
        form.resetFields();
        navigate('/dashboard');
      } else {
        message.error(response.message || '密码修改失败');
      }
    } catch (error) {
      message.error('密码修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">修改密码</h1>
          <p className="text-gray-600">请填写以下信息修改密码</p>
        </div>

        <Form
          form={form}
          name="changePassword"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="oldPassword"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="原密码"
              className="py-2"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="新密码"
              className="py-2"
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
              prefix={<LockOutlined />}
              placeholder="确认新密码"
              className="py-2"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePassword; 