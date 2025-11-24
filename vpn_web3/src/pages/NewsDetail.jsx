import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Button, message } from 'antd';
import { LeftOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import request from '../utils/request';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NewsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewsDetail();
  }, [id]);

  const fetchNewsDetail = async () => {
    try {
      const response = await request.get(`/news/${id}/`);
      if (response.code === 200) {
        setNews(response.data);
      } else {
        message.error(response.message || '获取新闻详情失败');
      }
    } catch (error) {
      console.error('获取新闻详情失败:', error);
      message.error('获取新闻详情失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!news) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600 mb-4">新闻不存在或已被删除</p>
        <Button type="primary" onClick={() => navigate('/news')}>
          返回新闻列表
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button 
        type="link" 
        className="mb-4 pl-0"
        onClick={() => navigate('/news')}
        icon={<LeftOutlined />}
      >
        返回新闻列表
      </Button>

      <Card className="shadow-lg">
        {news.cover_image_url && (
          <img
            src={news.cover_image_url.replace(/[\s`]/g, '')}
            alt={news.title}
            className="w-full h-64 object-cover rounded-t-lg mb-6"
          />
        )}

        <h1 className="text-3xl font-bold mb-4">{news.title}</h1>

        <div className="flex items-center justify-between mb-6 text-gray-500 text-sm">
          <div className="flex items-center">
            <UserOutlined className="mr-1" />
            <span>{news.author_name}</span>
          </div>
          <div className="flex items-center">
            <ClockCircleOutlined className="mr-1" />
            <span>{news.created_at}</span>
          </div>
        </div>

        <div className="prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {news.content || ''}
          </ReactMarkdown>
        </div>
      </Card>
    </div>
  );
};

export default NewsDetail; 