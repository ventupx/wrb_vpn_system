import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Tabs, Table, Space, Spin, message, Modal, Form, Input } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import { formatDate } from '@/utils/format';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface CustomerDetail {
  id: number;
  username: string;
  email: string;
  ip_address: string;
  agent: {
    id: number;
    username: string;
    name: string;
  };
  last_login: string;
  date_joined: string;
  is_active: boolean;
  package_info?: {
    name: string;
    type: string;
    expire_at: string;
    traffic_used: number;
    traffic_total: number;
  };
}

interface LoginRecord {
  id: number;
  ip_address: string;
  login_time: string;
  device_info: string;
}

interface TrafficRecord {
  id: number;
  date: string;
  traffic_used: number;
}

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loginRecords, setLoginRecords] = useState<LoginRecord[]>([]);
  const [trafficRecords, setTrafficRecords] = useState<TrafficRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isResetPasswordModalVisible, setIsResetPasswordModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchCustomerDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await request.get<CustomerDetail>(`/customers/${id}/`);
      setCustomer(response.data);
    } catch (error) {
      console.error('获取客户详情失败:', error);
      message.error('获取客户详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginRecords = async () => {
    if (!id) return;
    try {
      const response = await request.get<LoginRecord[]>(`/customers/${id}/login_records/`);
      setLoginRecords(response.data);
    } catch (error) {
      console.error('获取登录记录失败:', error);
      message.error('获取登录记录失败');
    }
  };

  const fetchTrafficRecords = async () => {
    if (!id) return;
    try {
      const response = await request.get<TrafficRecord[]>(`/customers/${id}/traffic_records/`);
      setTrafficRecords(response.data);
    } catch (error) {
      console.error('获取流量记录失败:', error);
      message.error('获取流量记录失败');
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
  }, [id]);

  const handleResetPassword = () => {
    setIsResetPasswordModalVisible(true);
    form.resetFields();
  };

  const handleResetPasswordSubmit = async (values: { password: string; confirm_password: string }) => {
    if (!id) return;
    
    try {
      await request.post(`/customers/${id}/reset_password/`, {
        data: values
      });
      message.success('密码重置成功');
      setIsResetPasswordModalVisible(false);
    } catch (error) {
      console.error('密码重置失败:', error);
      message.error('密码重置失败');
    }
  };

  const loginRecordColumns: ColumnsType<LoginRecord> = [
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      render: (text) => formatDate(text),
    },
    {
      title: '设备信息',
      dataIndex: 'device_info',
      key: 'device_info',
    },
  ];

  const trafficRecordColumns: ColumnsType<TrafficRecord> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (text) => formatDate(text),
    },
    {
      title: '使用流量',
      dataIndex: 'traffic_used',
      key: 'traffic_used',
      render: (traffic) => `${(traffic / 1024 / 1024 / 1024).toFixed(2)} GB`,
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: '基本信息',
      children: (
        <Card>
          {customer && (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="用户名">{customer.username}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{customer.email}</Descriptions.Item>
              <Descriptions.Item label="IP地址">{customer.ip_address}</Descriptions.Item>
              <Descriptions.Item label="归属代理">
                {customer.agent?.name || '-'} ({customer.agent?.username || '-'})
              </Descriptions.Item>
              <Descriptions.Item label="账户状态">
                <span style={{ color: customer.is_active ? '#52c41a' : '#ff4d4f' }}>
                  {customer.is_active ? '启用' : '停用'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDate(customer.date_joined)}</Descriptions.Item>
              <Descriptions.Item label="最后登录">
                {customer.last_login ? formatDate(customer.last_login) : '-'}
              </Descriptions.Item>
              {customer.package_info && (
                <>
                  <Descriptions.Item label="套餐名称">{customer.package_info.name}</Descriptions.Item>
                  <Descriptions.Item label="套餐类型">{customer.package_info.type}</Descriptions.Item>
                  <Descriptions.Item label="到期时间">{formatDate(customer.package_info.expire_at)}</Descriptions.Item>
                  <Descriptions.Item label="流量使用情况">
                    {(customer.package_info.traffic_used / 1024 / 1024 / 1024).toFixed(2)} GB / 
                    {(customer.package_info.traffic_total / 1024 / 1024 / 1024).toFixed(2)} GB
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          )}
        </Card>
      ),
    },
    {
      key: '2',
      label: '登录记录',
      children: (
        <Card>
          <Button 
            type="primary" 
            style={{ marginBottom: 16 }} 
            onClick={fetchLoginRecords}
          >
            加载登录记录
          </Button>
          <Table
            columns={loginRecordColumns}
            dataSource={loginRecords}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: '3',
      label: '流量使用记录',
      children: (
        <Card>
          <Button 
            type="primary" 
            style={{ marginBottom: 16 }} 
            onClick={fetchTrafficRecords}
          >
            加载流量记录
          </Button>
          <Table
            columns={trafficRecordColumns}
            dataSource={trafficRecords}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
  ];

  if (loading) {
    return <Spin size="large" className="flex justify-center items-center min-h-[300px]" />;
  }

  return (
    <div className="customer-detail">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-medium">客户详情</h2>
        <Space>
          <Button onClick={() => navigate('/dashboard/customer')}>返回</Button>
          <Button type="primary" onClick={handleResetPassword}>重置密码</Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="1" items={tabItems} />

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
    </div>
  );
};

export default CustomerDetail; 