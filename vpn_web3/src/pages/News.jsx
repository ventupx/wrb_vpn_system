import { Card, List, message } from 'antd';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';

const News = () => {
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await request.get('/news/', {
        params: {
          page: 1,
          pageSize: 10000
        }
      });
      if (response.code === 200) {
        setNewsData(response.data.list);
      } else {
        message.error(response.message || '获取新闻列表失败');
      }
    } catch (error) {
      console.error('获取新闻列表失败:', error);
      message.error('获取新闻列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleNewsClick = (newsId) => {
    navigate(`/news/${newsId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">新闻中心</h1>

      <List
        loading={loading}
        grid={{
          gutter: 16,
          xs: 1,
          sm: 2,
          md: 3,
          lg: 4,
          xl: 4,
          xxl: 4,
        }}
        dataSource={newsData}
        renderItem={(item) => (
          <List.Item>
            <Card 
              hoverable
              className="w-full h-fit cursor-pointer transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              onClick={() => handleNewsClick(item.id)}
              cover={
                <div className="h-48 bg-blue-50 overflow-hidden">
                  {item.cover_image_url ? (
                    <img
                      src={item.cover_image_url.replace(/[\s`]/g, '')}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-blue-300 text-lg">
                      暂无图片
                    </div>
                  )}
                </div>
              }
            >
              <div className="h-fit flex flex-col">
                <div className="flex items-center justify-between mb-2 text-sm text-gray-500">
                  <div className="flex items-center flex-1 min-w-0 mr-2">
                    <UserOutlined className="mr-1 flex-shrink-0" />
                    <span className="truncate">{item.author_name}</span>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <ClockCircleOutlined className="mr-1" />
                    <span>{item.created_at}</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2 line-clamp-2 flex-shrink-0">
                  {item.title}
                </h3>
                <div className="text-gray-600 truncate">
                  {item.content_preview?.replace(/[#*`]/g, '') || ''}
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default News;