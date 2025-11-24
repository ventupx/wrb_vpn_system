import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Input, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, CopyOutlined, PoweroffOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import type { AxiosError } from 'axios';

interface CDKItem {
  id: number;
  code: string;
  discount: number;
  max_uses: number;
  used_count: number;
  created_by: number;
  created_by_name: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface ErrorResponse {
  message: string;
}

const CDKList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dataSource, setDataSource] = useState<CDKItem[]>([]);
  const navigate = useNavigate();

  const fetchCDKList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchText) {
        params.append('search', searchText);
      }
      const response = await request.get<{ results: CDKItem[] }>('/cdk/', {
        params
      });
      setDataSource(response.data.results);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCDKList();
  }, [searchText]);

  const getStatusTag = (record: CDKItem) => {
    const now = dayjs();
    const validFrom = dayjs(record.valid_from);
    const validUntil = dayjs(record.valid_until);
    
    if (!record.is_active) {
      return <Tag color="default">已禁用</Tag>;
    }
    if (record.used_count >= record.max_uses) {
      return <Tag color="error">已用完</Tag>;
    }
    if (now < validFrom) {
      return <Tag color="warning">未生效</Tag>;
    }
    if (now > validUntil) {
      return <Tag color="default">已过期</Tag>;
    }
    return <Tag color="success">生效中</Tag>;
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      message.success('复制成功');
    });
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个优惠码吗？删除后不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await request.delete(`/cdk/${id}/`);
          message.info(response.message);
          fetchCDKList();
        } catch (error) {
          const axiosError = error as AxiosError<ErrorResponse>;
          message.error(axiosError.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleToggleStatus = async (record: CDKItem) => {
    try {
      const response = await request.post(`/cdk/${record.id}/toggle_status/`);
      message.success(response.data.message);
      fetchCDKList();
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      message.error(axiosError.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '优惠码',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Space>
          {text}
          <Button 
            type="text" 
            icon={<CopyOutlined />} 
            onClick={() => handleCopy(text)}
          />
        </Space>
      )
    },
    {
      title: '折扣',
      dataIndex: 'discount',
      key: 'discount',
      render: (discount: number) => `${discount}%`
    },
    {
      title: '使用次数',
      key: 'usage',
      render: (record: CDKItem) => `${record.used_count}/${record.max_uses}`
    },
    {
      title: '状态',
      key: 'status',
      render: (record: CDKItem) => getStatusTag(record)
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
      key: 'created_by_name'
    },
    {
      title: '生效时间',
      dataIndex: 'valid_from',
      key: 'valid_from',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '过期时间',
      dataIndex: 'valid_until',
      key: 'valid_until',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (record: CDKItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<PoweroffOutlined />}
            onClick={() => handleToggleStatus(record)}
            danger={record.is_active}
          >
            {record.is_active ? '停用' : '启用'}
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
      )
    }
  ];

  return (
    <div>
      <div className="flex items-center justify-between bg-white p-4 mb-4 rounded-lg shadow-sm">
        <Input.Search
          placeholder="搜索优惠码"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/cdk/create')}
        >
          创建优惠码
        </Button>
      </div>
      <Table
        className="bg-white rounded-lg shadow-sm"
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </div>
  );
};

export default CDKList; 