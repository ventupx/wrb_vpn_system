import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Form, Input, InputNumber, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import { formatDate } from '@/utils/format';

interface CustomerData {
  id: number;
  username: string;
  email: string;
  phone: string | null;
  ip_address: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  balance: string;
  agent_username: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


interface TableParams {
  pagination: TablePaginationConfig;
}

interface ResetPasswordForm {
  password: string;
  confirm_password: string;
}

interface UpdateBalanceForm {
  amount: number;
  action: 'add' | 'subtract';
}

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [isResetPasswordModalVisible, setIsResetPasswordModalVisible] = useState(false);
  const [isUpdateBalanceModalVisible, setIsUpdateBalanceModalVisible] = useState(false);
  const [form] = Form.useForm<ResetPasswordForm>();
  const [balanceForm] = Form.useForm<UpdateBalanceForm>();
  const [searchForm] = Form.useForm();
  const [searchUsername, setSearchUsername] = useState<string>('');
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    console.log(tableParams);
    try {
      const { data } = await request.get<PaginatedResponse<CustomerData>>('/customers/', {
        params: {
          page: tableParams.pagination.current,
          page_size: tableParams.pagination.pageSize,
          username: searchUsername || undefined,
        },
      });
      
      setData(data.results);
      setTableParams({
        ...tableParams,
        pagination: {
          ...tableParams.pagination,
          total: data.count,
        },
      });
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    }
    setLoading(false);
  };

  // useEffect(() => {
  //   fetchData();
  // }, [JSON.stringify(tableParams)]);

  const handleResetPassword = (record: CustomerData) => {
    setSelectedCustomer(record);
    setIsResetPasswordModalVisible(true);
    form.resetFields();
  };

  const handleResetPasswordSubmit = async (values: ResetPasswordForm) => {
    if (!selectedCustomer) return;
    
    try {
      await request.post(`/customers/${selectedCustomer.id}/reset_password/`, {
        data: {
          password: values.password,
          confirm_password: values.confirm_password
        }
      });
      message.success('密码重置成功');
      setIsResetPasswordModalVisible(false);
      form.resetFields();
    } catch {
      message.error('密码重置失败');
    }
  };

  const handleUpdateBalance = (record: CustomerData) => {
    setSelectedCustomer(record);
    setIsUpdateBalanceModalVisible(true);
    balanceForm.setFieldsValue({ 
      amount: 0,
      action: 'add'
    });
  };

  const handleStop = async(record: CustomerData) => {
    try {
      await request.post(`/users/${record.id}/disable_user/`);
      message.success('停用成功');
      fetchData();
    } catch {
      message.error('停用失败');
    }
  };

  const handleStart = async(record: CustomerData) => {
    try {
      await request.post(`/users/${record.id}/start_user/`);
      message.success('启用成功');
      fetchData();
    } catch {
      message.error('启用失败');
    }
  };

  const handleDelete = async(record: CustomerData) => {
    try {
      await request.post(`/users/${record.id}/delete_user/`);
      message.success('删除成功');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleUpdateBalanceSubmit = async (values: UpdateBalanceForm) => {
    if (!selectedCustomer) return;
    
    try {
      await request.post(`/customers/${selectedCustomer.id}/update_balance/`, {
        data: {
          amount: Number(values.amount),
          action: values.action
        }
      });
      message.success('余额修改成功');
      setIsUpdateBalanceModalVisible(false);
      balanceForm.resetFields();
      fetchData(); // 刷新列表
    } catch {
      message.error('余额修改失败');
    }
  };

  const handleSearch = async (values: { username?: string }) => {
    const { data } = await request.get<PaginatedResponse<CustomerData>>('/customers/', {
        params: {
          page: 1,
          page_size: 10,
          username: values.username,
        },
      });
      
      setData(data.results);
      setTableParams({
        ...tableParams,
        pagination: {
          ...tableParams.pagination,
          total: data.count,
        },
      });
  };
  useEffect(() => {
    fetchData();
  }, []);
  const handleReset = async() => {
    const { data } = await request.get<PaginatedResponse<CustomerData>>('/customers/', {
      params: {
        page: tableParams.pagination.current,
        page_size: tableParams.pagination.pageSize,
      },
    });
    
    setData(data.results);
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        total: data.count,
      },
    });
  };

  const columns: ColumnsType<CustomerData> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: string) => `¥${balance}`,
    },
    {
      title: 'IP地址',
      dataIndex: 'last_login_ip',
      key: 'last_login_ip',
      render: (ip: string | null) => ip || '-',
    },
    {
      title: '归属代理',
      dataIndex: 'agent_username',
      key: 'agent_username',
      render: (username: string | null) => username || '-',
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
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date: string | null) => (date ? formatDate(date) : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'date_joined',
      key: 'date_joined',
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          {/* <Button type="link" onClick={() => navigate(`/dashboard/customer/detail/${record.id}`)}>
            详情
          </Button> */}
          <Button type="link" onClick={() => handleResetPassword(record)}>
            重置密码
          </Button>
          <Button type="link" onClick={() => handleUpdateBalance(record)}>
            修改余额
          </Button>
          {record.is_active ? 
          <Button type="link" danger onClick={() => handleStop(record)}>
            停用
          </Button>
          :
          <Button type="link" onClick={() => handleStart(record)}>
            启用
          </Button>
          }
          <Button type="link" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleTableChange = async(pagination: TablePaginationConfig) => {
    setTableParams({
      pagination: {
        ...pagination,
        current: pagination.current,
      }
    });

    // 在页码变化后直接请求数据
    setLoading(true);
    try {
      const { data } = await request.get<PaginatedResponse<CustomerData>>('/customers/', {
        params: {
          page: pagination.current,
          page_size: pagination.pageSize,
          username: searchUsername || undefined,
        },
      });
      
      setData(data.results);
      setTableParams({
        pagination: {
          ...pagination,
          current: pagination.current,
          total: data.count,
        }
      });
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    }
    setLoading(false);
  };

  // 修改筛选按钮部分
  const renderFilterButtons = () => {
    return (
      <div style={{ marginBottom: 16 }}>
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
        >
          <Form.Item name="username">
            <Input placeholder="请输入用户名" allowClear />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                搜索
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    );
  };

  return (
    <div>
      {renderFilterButtons()}
      
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={tableParams.pagination}
        loading={loading}
        onChange={handleTableChange}
      />
      
      <Modal
        title="重置密码"
        open={isResetPasswordModalVisible}
        onCancel={() => setIsResetPasswordModalVisible(false)}
        onOk={() => form.submit()}
        okText="确认"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleResetPasswordSubmit}
        >
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能小于6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请确认密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改余额"
        open={isUpdateBalanceModalVisible}
        onCancel={() => setIsUpdateBalanceModalVisible(false)}
        onOk={() => balanceForm.submit()}
        okText="确认"
        cancelText="取消"
      >
        <Form
          form={balanceForm}
          layout="vertical"
          onFinish={handleUpdateBalanceSubmit}
        >
          <Form.Item
            name="action"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Select
              style={{ width: '100%' }}
              size="large"
            >
              <Select.Option value="add">增加余额</Select.Option>
              <Select.Option value="subtract">减少余额</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[
              { required: true, message: '请输入金额' },
              { type: 'number', message: '请输入有效的数字' },
              { type: 'number', min: 0.01, message: '金额必须大于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              precision={2}
              prefix="¥"
              min={0.01}
              step={0.01}
              size="large"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerList; 