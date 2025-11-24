import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import request from '@/utils/request';
import axios from 'axios';

interface ContactData {
  qq: string;
  wechat: string;
  phone: string;
  qq_qrcode_url: string;
  wechat_qrcode_url: string;
}

const AgentContact: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [qqQrcodeUrl, setQqQrcodeUrl] = useState<string>('');
  const [wechatQrcodeUrl, setWechatQrcodeUrl] = useState<string>('');

  useEffect(() => {
    fetchContactData();
  }, []);

  const fetchContactData = async () => {
    setLoading(true);
    try {
      const response = await request.get('/agent-contact/');
      if (response.code === 200) {
        const { qq, wechat, phone, qq_qrcode_url, wechat_qrcode_url } = response.data;
        form.setFieldsValue({ qq, wechat, phone });
        setQqQrcodeUrl(qq_qrcode_url || '');
        setWechatQrcodeUrl(wechat_qrcode_url || '');
      } else {
        message.error(response.message || '获取预留信息失败');
      }
    } catch (error) {
      console.error('获取预留信息失败:', error);
      message.error('获取预留信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: { qq: string; wechat: string; phone: string }) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('qq', values.qq);
      formData.append('wechat', values.wechat);
      formData.append('phone', values.phone);
      
      const response = await request.post('/agent-contact/', formData);
      
      if (response.code === 200) {
        message.success('更新预留信息成功');
        fetchContactData();
      } else {
        message.error(response.message || '更新预留信息失败');
      }
    } catch (error) {
      console.error('更新预留信息失败:', error);
      message.error('更新预留信息失败');
    } finally {
      setLoading(false);
    }
  };

  const qqQrcodeProps: UploadProps = {
    name: 'qq_qrcode',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('二维码图片不能超过2MB!');
        return false;
      }
      
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('qq_qrcode', file as File);
        
        const response = await axios.post('/api/agent-contact/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data.code === 200) {
          setQqQrcodeUrl(response.data.data.qq_qrcode_url);
          onSuccess?.('ok');
        } else {
          onError?.(new Error(response.data.message || '上传失败'));
        }
      } catch (error) {
        onError?.(error as Error);
      }
    },
    fileList: qqQrcodeUrl ? [{ uid: '-1', name: 'qq_qrcode', status: 'done', url: qqQrcodeUrl }] : [],
    onRemove: () => {
      setQqQrcodeUrl('');
    },
  };

  const wechatQrcodeProps: UploadProps = {
    name: 'wechat_qrcode',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('二维码图片不能超过2MB!');
        return false;
      }
      
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('wechat_qrcode', file as File);
        
        const response = await axios.post('/api/agent-contact/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data.code === 200) {
          setWechatQrcodeUrl(response.data.data.wechat_qrcode_url);
          onSuccess?.('ok');
        } else {
          onError?.(new Error(response.data.message || '上传失败'));
        }
      } catch (error) {
        onError?.(error as Error);
      }
    },
    fileList: wechatQrcodeUrl ? [{ uid: '-1', name: 'wechat_qrcode', status: 'done', url: wechatQrcodeUrl }] : [],
    onRemove: () => {
      setWechatQrcodeUrl('');
    },
  };

  return (
    <Spin spinning={loading}>
      <Card title="网站预留信息">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="qq"
            label="QQ号"
            rules={[{ required: true, message: '请输入QQ号' }]}
          >
            <Input placeholder="请输入QQ号" />
          </Form.Item>

          <Form.Item
            name="wechat"
            label="微信号"
            rules={[{ required: true, message: '请输入微信号' }]}
          >
            <Input placeholder="请输入微信号" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            label="QQ二维码"
            extra="建议尺寸: 200x200px，文件大小不超过2MB"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {qqQrcodeUrl && (
                <div style={{ marginBottom: 16 }}>
                  <p>当前QQ二维码:</p>
                  <img 
                    src={qqQrcodeUrl} 
                    alt="当前QQ二维码" 
                    style={{ maxWidth: '200px', maxHeight: '200px' }} 
                  />
                </div>
              )}
              <Upload {...qqQrcodeProps}>
                <Button icon={<UploadOutlined />}>选择QQ二维码</Button>
              </Upload>
            </Space>
          </Form.Item>

          <Form.Item
            label="微信二维码"
            extra="建议尺寸: 200x200px，文件大小不超过2MB"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {wechatQrcodeUrl && (
                <div style={{ marginBottom: 16 }}>
                  <p>当前微信二维码:</p>
                  <img 
                    src={wechatQrcodeUrl} 
                    alt="当前微信二维码" 
                    style={{ maxWidth: '200px', maxHeight: '200px' }} 
                  />
                </div>
              )}
              <Upload {...wechatQrcodeProps}>
                <Button icon={<UploadOutlined />}>选择微信二维码</Button>
              </Upload>
            </Space>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
};

export default AgentContact; 