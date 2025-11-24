import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Avatar,
  Row,
  Col,
  Upload,
  message,
  Divider,
  Spin,
  Tooltip,
  Space
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  CameraOutlined,
  LockOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import type { RcFile } from 'antd/es/upload/interface';
import request from '@/utils/request';

const { Title } = Typography;

interface UserProfileData {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
}

interface ChangePasswordData {
  old_password: string;
  new_password: string;
}

interface UploadResponse {
  url: string;
}

const ProfilePage: React.FC = () => {
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    id: 0,
    username: '',
    name: '',
    email: '',
    phone: '',
    avatar: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await request.get<UserProfileData>('/users/profile/');
      console.log(response)
      if (response.code === 200 && response.data) {
        setUserProfile(response.data);
        setAvatarUrl(response.data.avatar || '');
        form.setFieldsValue(response.data);
      } else {
        message.error(response.message || '获取用户资料失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '获取用户资料失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { avatar, ...rest } = values;
      
      const response = await request.put<UserProfileData>('/users/update_profile/', {
        data: rest
      });
      
      if (response.code === 200 && response.data) {
        setUserProfile(response.data);
        message.success(response.message || '个人资料更新成功');
      } else {
        message.error(response.message || '更新失败，请重试');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      
      const response = await request.post<null>('/users/change_password/', {
        data: {
          old_password: values.oldPassword,
          new_password: values.newPassword
        }
      });
      
      if (response.code === 200) {
        message.success(response.message || '密码修改成功');
        passwordForm.resetFields();
      } else {
        message.error(response.message || '密码修改失败，请重试');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '密码修改失败，请重试');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarChange: UploadProps['onChange'] = async ({ file }) => {
    if (file.status === 'done') {
      const response = await request.post<UploadResponse>('/users/avatar/', {
        data: new FormData().append('avatar', file.originFileObj as File)
      });
      
      if (response.code === 200 && response.data) {
        setAvatarUrl(response.data.url);
        message.success(response.message || '头像上传成功');
      } else {
        message.error(response.message || '头像上传失败');
      }
    }
  };

  // 上传前检查文件类型和大小
  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('请上传图片文件!');
      return false;
    }
    
    const isLessThan2M = file.size / 1024 / 1024 < 2;
    if (!isLessThan2M) {
      message.error('图片必须小于2MB!');
      return false;
    }
    
    return true;
  };

  // 自定义上传请求
  const customRequest = async ({ file, onSuccess, onError }: any) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await request.post<UploadResponse>('/users/avatar/', {
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.code === 200 && response.data) {
        setAvatarUrl(response.data.url);
        onSuccess?.(response);
      } else {
        onError?.(new Error(response.message || '上传失败'));
      }
    } catch (err: unknown) {
      const error = err as Error;
      onError?.(error);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Card
            styles={{
              body: { padding: '24px 32px' }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0 }}>个人资料</Title>
              <Button 
                type="primary" 
                onClick={handleSubmit}
                icon={<SaveOutlined />}
              >
                保存修改
              </Button>
            </div>
            
            <Divider style={{ margin: '12px 0 24px' }} />
            
            <Form
              form={form}
              layout="vertical"
              initialValues={userProfile}
            >
              <Row gutter={24}>
                <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                  <Form.Item name="avatar" label="头像">
                    <Upload
                      name="avatar"
                      listType="text"
                      fileList={fileList}
                      onChange={handleAvatarChange}
                      beforeUpload={beforeUpload}
                      customRequest={customRequest}
                      maxCount={1}
                      showUploadList={false}
                    >
                      <Tooltip title="点击更换头像">
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <Avatar 
                            size={120} 
                            icon={<UserOutlined />} 
                            src={avatarUrl || userProfile.avatar}
                            style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.5)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer'
                          }}>
                            <CameraOutlined style={{ fontSize: '16px' }} />
                          </div>
                        </div>
                      </Tooltip>
                    </Upload>
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={18}>
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="username"
                        label="用户名"
                        rules={[{ required: true, message: '请输入用户名' }]}
                      >
                        <Input 
                          prefix={<UserOutlined />} 
                          placeholder="用户名" 
                        />
                      </Form.Item>
                    </Col>
                    
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="name"
                        label="姓名"
                        rules={[{ required: true, message: '请输入姓名' }]}
                      >
                        <Input 
                          prefix={<UserOutlined />} 
                          placeholder="姓名" 
                        />
                      </Form.Item>
                    </Col>
                    
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="email"
                        label="邮箱"
                        rules={[
                          { required: true, message: '请输入邮箱' },
                          { type: 'email', message: '请输入有效的邮箱' }
                        ]}
                      >
                        <Input 
                          prefix={<MailOutlined />} 
                          placeholder="邮箱" 
                        />
                      </Form.Item>
                    </Col>
                    
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="phone"
                        label="电话"
                        rules={[
                          { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                        ]}
                      >
                        <Input 
                          prefix={<PhoneOutlined />} 
                          placeholder="电话（选填）" 
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card
            styles={{
              body: { padding: '24px 32px' }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0 }}>修改密码</Title>
              <Button 
                type="primary" 
                onClick={handlePasswordSubmit}
                icon={<SaveOutlined />}
                loading={changingPassword}
              >
                确认修改
              </Button>
            </div>
            
            <Divider style={{ margin: '12px 0 24px' }} />
            
            <Form
              form={passwordForm}
              layout="vertical"
            >
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="oldPassword"
                    label="原密码"
                    rules={[
                      { required: true, message: '请输入原密码' },
                      { min: 6, message: '密码长度不能小于6位' }
                    ]}
                  >
                    <Input.Password 
                      prefix={<LockOutlined />} 
                      placeholder="请输入原密码" 
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, message: '请输入新密码' },
                      { min: 6, message: '密码长度不能小于6位' }
                    ]}
                  >
                    <Input.Password 
                      prefix={<LockOutlined />} 
                      placeholder="请输入新密码" 
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    rules={[
                      { required: true, message: '请确认新密码' },
                      { min: 6, message: '密码长度不能小于6位' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
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
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Space>
      </div>
    </Spin>
  );
};

export default ProfilePage; 