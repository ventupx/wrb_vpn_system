import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Select, InputNumber, Tabs, Modal } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import request from '@/utils/request';
import type { AxiosError } from 'axios';

const { TabPane } = Tabs;

// 添加API响应接口定义
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface AgentFormData {
  username: string;
  password?: string;
  confirm_password?: string;
  email: string;
  name: string;
  phone: string;
  domain: string;
  template: string;
  normal_monthly_price: number | string;
  normal_quarterly_price: number | string;
  normal_half_yearly_price: number | string;
  normal_yearly_price: number | string;
  live_monthly_price: number | string;
  live_quarterly_price: number | string;
  live_half_yearly_price: number | string;
  live_yearly_price: number | string;
  monthly_price: number | string;
  quarterly_price: number | string;
  yearly_price: number | string;
  traffic_price: number | string;
  transit_monthly_price: number | string;
  transit_quarterly_price: number | string;
  transit_half_yearly_price: number | string;
  transit_yearly_price: number | string;
  default_transit_account: number | string;
}

interface ApiErrorResponse {
  code: number;
  message: string;
  data?: Record<string, string[]>;
}

interface TransitAccount {
  id: number;
  username: string;
}

const AgentEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const isEdit = id !== undefined;
  const [currentTab, setCurrentTab] = useState('1'); // 当前标签页
  const [transitAccounts, setTransitAccounts] = useState<TransitAccount[]>([]);

  useEffect(() => {
    if (isEdit) {
      fetchAgentData();
    }
    fetchTransitAccounts();
  }, [id]);

  const fetchAgentData = async () => {
    try {
      // 恢复API请求代码
      const response = await request.get<ApiResponse<AgentFormData>>(`/agents/${id}/`);
      if (response.code === 200) {
        // 设置表单值
        form.setFieldsValue(response.data);
      } else {
        message.error(response.message || '获取代理信息失败');
      }
    } catch {
      message.error('获取代理信息失败');
      navigate('/dashboard/agent');
    }
  };

  const fetchTransitAccounts = async () => {
    try {
      const response = await request.get('/accounts/', {
        params: {
          page: 1,
          page_size: 10000
        }
      });
      if (response.code === 200) {
        setTransitAccounts(response.data.results);
      }
    } catch {
      message.error('获取中转账号列表失败');
    }
  };

  const handleSubmit = async (values: AgentFormData) => {
    // 确保template字段始终为"web_1"
    values.template = 'web_1';
    
    setLoading(true);
    try {
      // 恢复API请求代码
      if (isEdit) {
        await request.put(`/agents/${id}/`, { data: values });
        message.success('更新成功');
      } else {
        await request.post('/agents/', { data: values });
        message.success('创建成功');
      }
      navigate('/dashboard/agent');
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      message.error(axiosError.response?.data?.message || '操作失败');
    }
    setLoading(false);
  };

  const handlePasswordChange = async (values: { password: string; confirm_password: string }) => {
    try {
      await request.post(`/agents/${id}/change_password/`, { data: values });
      message.success('密码修改成功');
      setIsPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      message.error(axiosError.response?.data?.message || '修改密码失败');
    }
  };

  const validateMessages = {
    required: '${label}不能为空',
    types: {
      email: '请输入有效的邮箱地址',
      number: '请输入有效的数字',
    },
  };

  // 处理标签页切换
  const handleTabChange = (activeKey: string) => {
    setCurrentTab(activeKey);
  };

  // 处理下一步按钮点击
  const handleNextStep = () => {
    // 验证基本信息表单
    form.validateFields(['username', 'password', 'confirm_password', 'email', 'name', 'phone', 'domain'])
      .then(() => {
        // 验证通过，切换到价格设置页
        setCurrentTab('2');
      })
      .catch((errorInfo) => {
        console.log('表单验证失败:', errorInfo);
      });
  };

  return (
    <Card title={isEdit ? '编辑代理' : '添加代理'} className="shadow-md" bordered={false} style={{ borderRadius: '8px' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        validateMessages={validateMessages}
        initialValues={{
          template: 'web_1',
          normal_monthly_price: 0,
          normal_quarterly_price: 0,
          normal_half_yearly_price: 0,
          normal_yearly_price: 0,
          live_monthly_price: 0,
          live_quarterly_price: 0,
          live_half_yearly_price: 0,
          live_yearly_price: 0,
          monthly_price: 0,
          quarterly_price: 0,
          yearly_price: 0,
          traffic_price: 0,
          transit_monthly_price: 0,
          transit_quarterly_price: 0,
          transit_half_yearly_price: 0,
          transit_yearly_price: 0,
        }}
      >
        <Tabs 
          activeKey={currentTab} 
          onChange={handleTabChange} 
          type="card"
        >
          <TabPane tab="基本信息" key="1">
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true }]}
            >
              <Input disabled={isEdit} />
            </Form.Item>

            {!isEdit && (
              <>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[
                    { required: true },
                    { min: 6, message: '密码长度不能小于6位' },
                  ]}
                >
                  <Input.Password />
                </Form.Item>

                <Form.Item
                  name="confirm_password"
                  label="确认密码"
                  dependencies={['password']}
                  rules={[
                    { required: true },
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
                  <Input.Password />
                </Form.Item>
              </>
            )}

            {isEdit && (
              <Form.Item>
                <Button type="link" onClick={() => setIsPasswordModalVisible(true)}>
                  修改密码
                </Button>
              </Form.Item>
            )}

            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, type: 'email' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="phone"
              label="手机号"
              rules={[
                { required: true },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
              ]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="domain"
              label="域名"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            {/* 隐藏的template字段，默认值为web_1 */}
            <Form.Item
              name="template"
              hidden={true}
            >
              <Input />
            </Form.Item>

            {/* 始终在基本信息页底部显示"下一步"按钮 */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <Button 
                type="primary"
                size="large" 
                onClick={handleNextStep}
                style={{ padding: '0 32px' }}
              >
                下一步：设置价格
              </Button>
            </div>
          </TabPane>

          <TabPane tab="价格设置" key="2">
            <div className="price-setting-container" style={{ backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>
                价格设置说明
                <span style={{ fontSize: '14px', color: '#888', marginLeft: '8px', fontWeight: 'normal' }}>
                  为不同类型和周期设置价格
                </span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flexWrap: 'wrap' }}>
                {/* 普通类型价格卡片 */}
                <Card 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ 
                        backgroundColor: '#1890ff',
                        width: '8px',
                        height: '16px',
                        display: 'inline-block',
                        marginRight: '8px',
                        borderRadius: '2px'
                      }}></span>
                      店铺类型
                    </div>
                  }
                  style={{ flex: 1, minWidth: '300px' }}
                  className="shadow-sm"
                  headStyle={{ backgroundColor: '#e6f7ff', borderBottom: '1px solid #91d5ff' }}
                  bordered={false}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <Form.Item
                      name="normal_monthly_price"
                      label="月付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="normal_quarterly_price"
                      label="季付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="normal_half_yearly_price"
                      label="半年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="normal_yearly_price"
                      label="年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>
                  </div>
                </Card>

                {/* 直播类型价格卡片 */}
                <Card 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ 
                        backgroundColor: '#52c41a',
                        width: '8px',
                        height: '16px',
                        display: 'inline-block',
                        marginRight: '8px', 
                        borderRadius: '2px'
                      }}></span>
                      直播类型
                    </div>
                  }
                  style={{ flex: 1, minWidth: '300px' }}
                  className="shadow-sm"
                  headStyle={{ backgroundColor: '#f6ffed', borderBottom: '1px solid #b7eb8f' }}
                  bordered={false}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <Form.Item
                      name="live_monthly_price"
                      label="月付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="live_quarterly_price"
                      label="季付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="live_half_yearly_price"
                      label="半年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="live_yearly_price"
                      label="年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>
                  </div>
                </Card>

                {/* 中转类型价格卡片 */}
                <Card 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ 
                        backgroundColor: '#722ed1',
                        width: '8px',
                        height: '16px',
                        display: 'inline-block',
                        marginRight: '8px', 
                        borderRadius: '2px'
                      }}></span>
                      视频类型
                    </div>
                  }
                  style={{ flex: 1, minWidth: '300px' }}
                  className="shadow-sm"
                  headStyle={{ backgroundColor: '#f9f0ff', borderBottom: '1px solid #d3adf7' }}
                  bordered={false}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <Form.Item
                      name="transit_monthly_price"
                      label="月付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="transit_quarterly_price"
                      label="季付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="transit_half_yearly_price"
                      label="半年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="transit_yearly_price"
                      label="年付价格"
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix="¥"
                        min={0}
                        size="large"
                      />
                    </Form.Item>
                  </div>
                </Card>
              </div>

              {/* 默认中转账号选择框 */}
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                <Form.Item
                  name="default_transit_account"
                  label="默认中转账号"
                  rules={[{ required: true, message: '请选择默认中转账号' }]}
                >
                  <Select
                    placeholder="请选择中转账号"
                    style={{ width: '100%' }}
                    size="large"
                  >
                    {transitAccounts.map(account => (
                      <Select.Option key={account.id} value={account.id}>
                        {account.username}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
            </div>
          </TabPane>
        </Tabs>

        {/* 只在价格设置页面显示保存和取消按钮 */}
        {currentTab === '2' && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                size="large"
                style={{ padding: '0 32px' }}
              >
                保存
              </Button>
              <Button 
                style={{ marginLeft: 16 }} 
                onClick={() => navigate('/dashboard/agent')}
                size="large"
              >
                取消
              </Button>
            </Form.Item>
          </div>
        )}
      </Form>

      <Modal
        title="修改密码"
        visible={isPasswordModalVisible}
        onCancel={() => {
          setIsPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true },
              { min: 6, message: '密码长度不能小于6位' },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['password']}
            rules={[
              { required: true },
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
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              确认修改
            </Button>
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setIsPasswordModalVisible(false);
                passwordForm.resetFields();
              }}
            >
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AgentEdit; 