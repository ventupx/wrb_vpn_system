import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Form, InputNumber, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import { formatDate } from '@/utils/format';

interface AgentData {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  domain: string;
  template: string;
  balance: string | number;
  is_active: boolean;
  date_joined: string;
  last_login: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
}

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [isBalanceModalVisible, setIsBalanceModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await request.get<{results: AgentData[]; count: number}>('/agents/', {
        params: {
          page: tableParams.pagination.current,
          page_size: tableParams.pagination.pageSize,
        },
      });
      setData(response.data.results);
      setTableParams({
        ...tableParams,
        pagination: {
          ...tableParams.pagination,
          total: response.data.count,
        },
      });
    } catch {
      message.error('获取代理列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(tableParams)]);

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个代理吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.delete(`/agents/${id}/`);
          message.success('删除成功');
          fetchData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleUpdateBalance = async (values: { amount: number; type: 'increase' | 'decrease' }) => {
    if (!selectedAgent) return;
    
    // 检查扣除金额是否超过当前余额
    if (values.type === 'decrease') {
      const currentBalance = typeof selectedAgent.balance === 'string' ? 
        parseFloat(selectedAgent.balance) : 
        selectedAgent.balance;
      
      if (values.amount > currentBalance) {
        message.error('扣除金额不能大于当前余额');
        return;
      }
    }
    
    try {
      await request.post(`/agents/${selectedAgent.id}/update_balance/`, {
        data: values
      });
      message.success('修改余额成功');
      setIsBalanceModalVisible(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error('修改余额失败');
    }
  };

  const showBalanceModal = (record: AgentData) => {
    setSelectedAgent(record);
    setIsBalanceModalVisible(true);
  };

  const columns: ColumnsType<AgentData> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '模板',
      dataIndex: 'template',
      key: 'template',
      render: (template: string) => {
        const templateMap = {
          web_1: '模板一',
          web_2: '模板二',
          web_3: '模板三',
          web_4: '模板四',
        };
        return templateMap[template as keyof typeof templateMap] || template;
      },
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: string | number) => {
        const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
        return `¥${numBalance.toFixed(2)}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <span style={{ color: isActive ? '#52c41a' : '#ff4d4f' }}>
          {isActive ? '启用' : '停用'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'date_joined',
      key: 'date_joined',
      render: (date: string) => formatDate(date),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date: string) => (date ? formatDate(date) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => navigate(`/dashboard/agent/edit/${record.id}`)}>
            编辑
          </Button>
          <Button type="link" onClick={() => showBalanceModal(record)}>
            修改余额
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setTableParams({
      pagination,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }} className='w-full flex justify-end'>
        <Button type="primary" onClick={() => navigate('/dashboard/agent/create')}>
          添加代理
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={tableParams.pagination}
        loading={loading}
        onChange={handleTableChange}
      />
      <Modal
        title="修改余额"
        open={isBalanceModalVisible}
        onCancel={() => {
          setIsBalanceModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={handleUpdateBalance}
          layout="vertical"
        >
          <Form.Item
            name="type"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
            initialValue="increase"
          >
            <Radio.Group>
              <Radio value="increase">增加余额</Radio>
              <Radio value="decrease">扣除余额</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[
              { required: true, message: '请输入金额' },
              { type: 'number', min: 0.01, message: '金额必须大于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              precision={2}
              min={0.01}
              placeholder="请输入金额"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentList; 