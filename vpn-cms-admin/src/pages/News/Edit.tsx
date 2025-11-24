import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Upload, message, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { IVditor } from 'vditor';
import 'vditor/dist/index.css';
import request from '@/utils/request';

interface NewsForm {
  title: string;
  content: string;
  cover_image?: File;
}

interface NewsData {
  id: number;
  title: string;
  content: string;
  cover_image_url: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

const NewsEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const vditorRef = useRef<IVditor>();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    const initVditor = async () => {
      const { default: Vditor } = await import('vditor');
      vditorRef.current = new Vditor('vditor', {
        mode: 'wysiwyg',
        height: 400,
        toolbar: [
          'emoji',
          'headings',
          'bold',
          'italic',
          'strike',
          'link',
          '|',
          'list',
          'ordered-list',
          'check',
          'outdent',
          'indent',
          '|',
          'quote',
          'line',
          'code',
          'inline-code',
          'insert-before',
          'insert-after',
          '|',
          'upload',
          'table',
          '|',
          'undo',
          'redo',
          '|',
          'fullscreen',
          'preview',
        ],
        upload: {
          url: '/api/news/upload-image/',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          fieldName: 'image',
          success: (_, msg: string) => {
            const response = JSON.parse(msg);
            if (response.code === 200 && vditorRef.current) {
              vditorRef.current.insertValue(`![](${response.data.url})`);
            } else {
              message.error(response.message || '图片上传失败');
            }
          },
        },
        after: () => {
          if (id) {
            fetchNewsDetail();
          }
        },
      });
    };

    initVditor();

    return () => {
      vditorRef.current?.destroy();
    };
  }, []);

  const fetchNewsDetail = async () => {
    try {
      const response = await request.get<NewsData>(`/news/${id}/`);
      
      if (response.code === 200 && response.data) {
        const { title, content: newsContent, cover_image_url } = response.data;
        form.setFieldsValue({ 
          title,
          cover_image: cover_image_url ? [
            {
              uid: '-1',
              name: 'cover_image',
              status: 'done',
              url: cover_image_url,
            }
          ] : []
        });

        if (newsContent && vditorRef.current) {
          vditorRef.current.setValue(newsContent);
        }
      } else {
        message.error(response.message || '获取新闻详情失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '获取新闻详情失败');
    }
  };

  const handleSubmit = async (values: NewsForm) => {
    if (!vditorRef.current) {
      message.error('编辑器未初始化');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('content', vditorRef.current.getValue());
      
      const fileList = form.getFieldValue('cover_image');
      if (fileList?.[0]?.originFileObj) {
        formData.append('cover_image', fileList[0].originFileObj);
      }

      if (id) {
        const response = await request.put<NewsData>(`/news/${id}/`, {
          data: formData
        });
        
        if (response.code === 200) {
          message.success(response.message || '更新成功');
          navigate('/dashboard/news');
        } else {
          message.error(response.message || '更新失败');
        }
      } else {
        const response = await request.post<NewsData>('/news/', {
          data: formData
        });
        
        if (response.code === 200) {
          message.success(response.message || '发布成功');
          navigate('/dashboard/news');
        } else {
          message.error(response.message || '发布失败');
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || (id ? '更新失败' : '发布失败'));
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e: { fileList: any[] }) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  return (
    <Card title={id ? '编辑新闻' : '发布新闻'}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ title: '', content: '' }}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入新闻标题" />
        </Form.Item>

        <Form.Item
          name="cover_image"
          label="封面图片"
          valuePropName="fileList"
          getValueFromEvent={normFile}
        >
          <Upload
            name="cover_image"
            listType="picture"
            beforeUpload={() => false}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>上传图片</Button>
          </Upload>
        </Form.Item>

        <Form.Item
          label="内容"
          required
        >
          <div id="vditor" className="vditor text-left !w-full h-[500px]" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: '8px' }}>
            {id ? '更新' : '发布'}
          </Button>
          <Button onClick={() => navigate('/dashboard/news')}>
            返回
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default NewsEdit; 