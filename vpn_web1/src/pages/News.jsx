import { Card, List, Tag, message, Button, Modal } from 'antd';
import { motion } from 'framer-motion';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const News = () => {
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);

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

  const showNewsModal = (news) => {
    setSelectedNews(news);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedNews(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-3xl font-bold text-gray-800 mb-12 text-center">新闻中心</h1>

        <List
          loading={loading}
          itemLayout="vertical"
          dataSource={newsData}
          renderItem={(item) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="mb-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <UserOutlined className="text-blue-500" />
                    <span>{item.author_name}</span>
                  </div>
                  <span className="text-gray-500">
                    <ClockCircleOutlined className="mr-1" />
                    {item.created_at}
                  </span>
                </div>
                <h2 className="text-xl font-semibold mb-2">{item.title}</h2>
                <div className="prose max-w-none">
                  <div className="line-clamp-2 overflow-hidden">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.content_preview || ''}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <Button 
                    type="link" 
                    onClick={() => showNewsModal(item)}
                  >
                    展开阅读
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        />

        <Modal
          title={selectedNews?.title}
          open={modalVisible}
          onCancel={handleModalClose}
          footer={null}
          width={800}
        >
          {selectedNews && (
            <div className="news-modal-content">
              {selectedNews.cover_image_url && (
                <img
                  src={selectedNews.cover_image_url.replace(/[\s`]/g, '')}
                  alt={selectedNews.title}
                  className="w-full rounded-lg mb-4 object-cover"
                />
              )}
              <div className="prose max-w-none p-4 bg-gray-50 rounded-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedNews.content_preview || ''}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </Modal>
      </motion.div>
    </div>
  );
};

export default News;