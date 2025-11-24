import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import request from '@/utils/request';
import axios from 'axios';

interface WebsiteTemplateData {
  website_name: string;
  logo_url: string;
  background_url: string;
}

const WebsiteTemplate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [logoFile, setLogoFile] = useState<UploadFile | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<UploadFile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');

  useEffect(() => {
    fetchTemplateData();
  }, []);

  const fetchTemplateData = async () => {
    setLoading(true);
    try {
      const response = await request.get('/website-template/get_template/');
      if (response.code === 200) {
        const { website_name, logo_url, background_url } = response.data;
        form.setFieldsValue({ website_name });
        setLogoUrl(logo_url || '');
        setBackgroundUrl(background_url || '');
      } else {
        message.error(response.message || '获取网站模板设置失败');
      }
    } catch (error) {
      console.error('获取网站模板设置失败:', error);
      message.error('获取网站模板设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: { website_name: string }) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('website_name', values.website_name);
      
      const response = await request.post('/website-template/update_template/', formData);
      
      if (response.code === 200) {
        message.success('更新网站模板设置成功');
        fetchTemplateData();
      } else {
        message.error(response.message || '更新网站模板设置失败');
      }
    } catch (error) {
      console.error('更新网站模板设置失败:', error);
      message.error('更新网站模板设置失败');
    } finally {
      setLoading(false);
    }
  };

  const logoProps: UploadProps = {
    name: 'logo',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('Logo图片不能超过2MB!');
        return false;
      }
      
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('logo', file as File);
        
        const response = await axios.post('/api/website-template/update_template/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data.code === 200) {
          setLogoUrl(response.data.data.logo_url);
          onSuccess?.('ok');
        } else {
          onError?.(new Error(response.data.message || '上传失败'));
        }
      } catch (error) {
        onError?.(error as Error);
      }
    },
    fileList: logoUrl ? [{ uid: '-1', name: 'logo', status: 'done', url: logoUrl }] : [],
    onRemove: () => {
      setLogoUrl('');
    },
  };

  const backgroundProps: UploadProps = {
    name: 'background',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      
      const isLt4M = file.size / 1024 / 1024 < 4;
      if (!isLt4M) {
        message.error('背景图片不能超过4MB!');
        return false;
      }
      
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('background', file as File);
        
        const response = await axios.post('/api/website-template/update_template/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data.code === 200) {
          setBackgroundUrl(response.data.data.background_url);
          onSuccess?.('ok');
        } else {
          onError?.(new Error(response.data.message || '上传失败'));
        }
      } catch (error) {
        onError?.(error as Error);
      }
    },
    fileList: backgroundUrl ? [{ uid: '-1', name: 'background', status: 'done', url: backgroundUrl }] : [],
    onRemove: () => {
      setBackgroundUrl('');
    },
  };

  return (
    <Spin spinning={loading}>
      <Card title="网站模板设置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="website_name"
            label="网站名称"
            rules={[{ required: true, message: '请输入网站名称' }]}
          >
            <Input placeholder="请输入网站名称" />
          </Form.Item>

          <Form.Item
            label="网站Logo"
            extra="建议尺寸: 200x60px，文件大小不超过2MB"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {logoUrl && (
                <div style={{ marginBottom: 16 }}>
                  <p>当前Logo:</p>
                  <img 
                    src={logoUrl} 
                    alt="当前Logo" 
                    style={{ maxWidth: '200px', maxHeight: '60px' }} 
                  />
                </div>
              )}
              <Upload {...logoProps}>
                <Button icon={<UploadOutlined />}>选择Logo</Button>
              </Upload>
            </Space>
          </Form.Item>

          <Form.Item
            label="主页背景图"
            extra="建议尺寸: 1920x1080px，文件大小不超过4MB"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {backgroundUrl && (
                <div style={{ marginBottom: 16 }}>
                  <p>当前背景图:</p>
                  <img 
                    src={backgroundUrl} 
                    alt="当前背景图" 
                    style={{ maxWidth: '300px' }} 
                  />
                </div>
              )}
              <Upload {...backgroundProps}>
                <Button icon={<UploadOutlined />}>选择背景图</Button>
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

export default WebsiteTemplate; 