import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Image, Input } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import type { TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';

interface NewsItem {
  id: number;
  title: string;
  content_preview: string;
  cover_image_url: string;
  author_name: string;
  created_at: string;
}

interface NewsListData {
  list: NewsItem[];
  total: number;
  current: number;
  pageSize: number;
  total_pages: number;
}

const News: React.FC = () => {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchNewsList = async (page = current, size = pageSize, search = searchText) => {
    setLoading(true);
    try {
      const data = await request.get<NewsListData>('/news/', {
        params: {
          page,
          pageSize: size,
          search: search || undefined,
          ordering: '-created_at'
        }
      });
      
      if (data.code === 200 && data.data) {
        setNewsList(data.data.list);
        setTotal(data.data.total);
        setCurrent(data.data.current);
        setPageSize(data.data.pageSize);
      } else {
        message.error(data.message || '获取新闻列表失败');
      }
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || '获取新闻列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewsList();
  }, []);

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条新闻吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const data = await request.delete<null>(`/news/${id}/`);
          if (data.code === 200) {
            message.success(data.message || '删除成功');
            fetchNewsList();
          } else {
            message.error(data.message || '删除失败');
          }
        } catch (err: unknown) {
          const error = err as Error;
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchNewsList(1, pageSize, value);
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    fetchNewsList(pagination.current || 1, pagination.pageSize || 10, searchText);
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '20%',
    },
    {
      title: '内容预览',
      dataIndex: 'content_preview',
      key: 'content_preview',
      width: '30%',
    },
    {
      title: '封面图片',
      dataIndex: 'cover_image_url',
      key: 'cover_image_url',
      width: '15%',
      render: (url: string) => (
        url ? <Image width={100} src={url} /> : '-'
      ),
    },
    {
      title: '发布人',
      dataIndex: 'author_name',
      key: 'author_name',
      width: '10%',
    },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      render: (_: unknown, record: NewsItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/news/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between bg-white !p-4 !mb-4 rounded-lg shadow-sm">
        <Input.Search
          placeholder="搜索新闻标题或内容"
          onSearch={handleSearch}
          style={{ width: 320 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/news/create')}
        >
          发布新闻
        </Button>
      </div>
      <Table
        className="bg-white rounded-lg shadow-sm"
        columns={columns}
        dataSource={newsList}
        rowKey="id"
        loading={loading}
        pagination={{
          current,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default News; 