import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Input, Button, Select, DatePicker, Form, Badge, Typography, Row, Col, message, Modal } from 'antd';
import { SearchOutlined, ReloadOutlined, UserOutlined, ApartmentOutlined, OrderedListOutlined, UpOutlined, DownOutlined, CloudServerOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import request from '@/utils/request';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

// 订单数据接口
interface OrderData {
  id: number;
  trade_no: string;
  out_trade_no: string;
  payment_type: string;
  product_name: string;
  amount: string;
  status: string;
  param: string;
  country: string;
  node_count: number;
  node_protocol: string;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
  username: string;
  email: string;
  agent_username: string;
}

// 代理商数据接口
interface AgentData {
  id: number;
  username: string;
  email: string;
  phone: string;
  name: string;
  domain: string;
  template: string;
  balance: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

// 筛选参数接口
interface FilterParams {
  trade_no?: string;
  customer_username?: string;
  agent_username?: string;
  status?: string | null;
  date_range?: [Dayjs, Dayjs] | null;
  payment_type?: string | null;
  country?: string | null;
}

// 表格参数接口
interface TableParams {
  pagination: TablePaginationConfig;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface AgentResponse {
  code: number;
  message: string;
  results: AgentData[];
}

const OrderList: React.FC = () => {
  const [form] = Form.useForm();
  const [panelForm] = Form.useForm();
  const [data, setData] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({});
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });
  const [isAgentL2, setIsAgentL2] = useState(false);
  const [expandSearch, setExpandSearch] = useState(true);
  const navigate = useNavigate();

  // 面板调节相关状态
  const [isPanelModalVisible, setIsPanelModalVisible] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [nodeOptions, setNodeOptions] = useState<{id: number; ip_address: string; port: number; panel_type: string; nodes_count: number; is_online: boolean}[]>([]);

  // 获取代理商列表
  const fetchAgents = async () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.user_type === 'agent_l2') {
      setIsAgentL2(true);
      return;
    }
    try {
      const response = await request.get<AgentResponse>('/agents/', {
        params: {
          page: 1,
          page_size: 1000,
        },
      });
      setAgents(response.data.results);
    } catch (error) {
      console.error('获取代理商列表失败:', error);
      message.error('获取代理商列表失败');
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // 获取订单数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: tableParams.pagination.current,
        page_size: tableParams.pagination.pageSize,
      };

      // 添加筛选条件
      if (filters.trade_no) {
        params.trade_no = filters.trade_no;
      }
      if (filters.customer_username) {
        params.customer_username = filters.customer_username;
      }
      if (filters.agent_username) {
        params.agent_username = filters.agent_username;
      }
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.payment_type) {
        params.payment_type = filters.payment_type;
      }
      if (filters.country) {
        params.country = filters.country;
      }
      if (filters.date_range && filters.date_range.length === 2) {
        params.start_date = filters.date_range[0].format('YYYY-MM-DD');
        params.end_date = filters.date_range[1].format('YYYY-MM-DD');
      }

      const { data } = await request.get<ApiResponse<OrderData>>('/payment-orders/', {
        params,
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
      console.error('获取订单列表失败:', error);
      message.error('获取订单列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(tableParams), JSON.stringify(filters)]);

  // 处理筛选表单提交
  const handleSearch = (values: FilterParams) => {
    setFilters(values);
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
      },
    });
  };

  // 重置筛选
  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
      },
    });
  };

  // 处理表格分页变化
  const handleTableChange = (pagination: TablePaginationConfig) => {
    setTableParams({
      pagination,
    });
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge status="success" text="成功" />;
      case 'pending':
        return <Badge status="processing" text="处理中" />;
      case 'failed':
        return <Badge status="error" text="失败" />;
      default:
        return <Badge status="default" text={status} />;
    }
  };

  // 获取支付方式标签
  const getPaymentTypeTag = (type: string) => {
    switch (type) {
      case 'alipay':
        return <Tag color="blue">支付宝</Tag>;
      case 'wechat':
        return <Tag color="green">微信支付</Tag>;
      case 'crypto':
        return <Tag color="orange">加密货币</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  // 获取订单的节点信息
  const fetchOrderNodeInfo = async (orderId: number) => {
    setLoading(true);
    try {
      const response = await request.get(`/payment-orders/${orderId}/node_info/`);
      return response.data;
    } catch (error) {
      console.error('获取节点信息失败:', error);
      message.error('获取节点信息失败');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 处理面板调节
  const handlePanelConfig = async (record: OrderData) => {
    try {
      setPanelLoading(true);
      // 保存当前订单ID供后续使用
      const orderId = record.id;
      setCurrentOrderId(orderId);
      
      // 获取订单的节点信息
      const nodes = await fetchOrderNodeInfo(orderId);
      if (!nodes || nodes.length === 0) {
        message.error('未找到可调节的节点');
        setPanelLoading(false);
        return;
      }
      
      // 使用第一个节点作为当前节点
      setCurrentNodeId(nodes[0].id);
      
      // 调用获取国家列表的接口
      const response = await request.get('/agent-panel/countries/');
      if (response.code === 200 && response.data) {
        setCountryOptions(response.data);
        
        // 保存当前国家值，用于后续获取节点列表
        let currentCountry = '';
        
        // 尝试回显当前节点的国家信息
        const node = nodes[0];
        if (node.country && response.data.includes(node.country)) {
          currentCountry = node.country;
          panelForm.setFieldsValue({ country: currentCountry });
        } else if (record.country && response.data.includes(record.country)) {
          // 如果节点没有国家信息，尝试使用订单的国家信息
          currentCountry = record.country;
          panelForm.setFieldsValue({ country: currentCountry });
        } else if (node.remark) {
          // 如果没有country字段，尝试从remark中提取
          const foundCountry = response.data.find((c: string) => node.remark.includes(c));
          if (foundCountry) {
            currentCountry = foundCountry;
            panelForm.setFieldsValue({ country: currentCountry });
          }
        }
        
        // 如果找到当前国家，加载对应的节点列表
        if (currentCountry) {
          await handleCountryChange(currentCountry);
        }
      } else {
        message.error(response.message || '获取国家列表失败');
        setCountryOptions([]);
      }
      
      setIsPanelModalVisible(true);
    } catch (error) {
      console.error('初始化面板调节失败:', error);
      message.error('初始化面板调节失败');
    } finally {
      setPanelLoading(false);
    }
  };

  // 处理国家变更
  const handleCountryChange = async (country: string) => {
    // 立即清空节点列表
    setNodeOptions([]);
    // 重置节点选择
    panelForm.setFieldsValue({ node: undefined });
    
    setPanelLoading(true);
    try {
      // 调用获取特定国家节点的API
      const response = await request.get('/agent-panel/get_panels_by_country/', {
        params: { country }
      });
      
      if (response.code === 200 && response.data) {
        // 只显示在线的节点
        const onlinePanels = response.data.filter((panel: {is_online: boolean}) => panel.is_online);
        setNodeOptions(onlinePanels);
      } else {
        message.error(response.message || '获取节点列表失败');
        setNodeOptions([]);
      }
    } catch (error) {
      console.error('获取节点列表失败:', error);
      message.error('获取节点列表失败');
      setNodeOptions([]);
    } finally {
      setPanelLoading(false);
    }
  };

  // 提交面板调节
  const handlePanelSubmit = async () => {
    try {
      if (!currentNodeId || !currentOrderId) {
        message.error('节点ID或订单ID不存在');
        return;
      }

      const values = await panelForm.validateFields();
      setPanelLoading(true);
      
      // 调用面板调节API
      const response = await request.post('/change-order-panel/', {
        data: {
          order_id: currentOrderId,
          panel_id: values.node
        }
      });
      
      if (response.code === 200) {
        console.log('面板调节提交的数据:', { order_id: currentOrderId, panel_id: values.node });
        message.success(response.message || '面板调节设置成功');
        setIsPanelModalVisible(false);
        
        // 重新获取订单列表
        fetchData();
      } else {
        message.error(response.message || '面板调节设置失败');
      }
    } catch (error) {
      console.error('面板调节设置失败:', error);
      if (error instanceof Error) {
        message.error(error.message || '面板调节设置失败');
      } else {
        message.error('面板调节设置失败');
      }
    } finally {
      setPanelLoading(false);
    }
  };
  function formatISODate(isoString: string) {
    // 创建 Date 对象
    const date = new Date(isoString);

    // 获取年、月、日、时、分、秒
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始，需要加 1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // 返回格式化后的字符串
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

  // 表格列定义
  const columns: ColumnsType<OrderData> = [
    {
      title: '订单号',
      dataIndex: 'trade_no',
      key: 'trade_no',
      width: 150,
      render: (text) => <Text copyable>{text}</Text>,
    },
    {
      title: '商户订单号',
      dataIndex: 'out_trade_no',
      key: 'out_trade_no',
      width: 150,
    },
    {
      title: '客户',
      key: 'username',
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          {record.username}
        </Space>
      ),
    },
    {
      title: '代理商',
      key: 'agent_username',
      width: 120,
      render: (_, record) => (
        <Space>
          <ApartmentOutlined />
          {record.agent_username}
        </Space>
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 120,
    },
    {
      title: '支付金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount) => `¥${amount}`,
    },
    {
      title: '支付方式',
      key: 'payment_type',
      width: 100,
      render: (_, record) => getPaymentTypeTag(record.payment_type),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => getStatusTag(record.status),
    },
    {
      title: '节点信息',
      key: 'node_info',
      width: 200,
      render: (_, record) => (
        <Space size={[0, 8]} wrap>
          <Tag color="blue">{record.country}</Tag>
          <Tag color="gold">{record.node_protocol}</Tag>
          <Tag color="cyan">{record.node_count}个节点</Tag>
        </Space>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => <span>{formatISODate(text)}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (text) => <span>{formatISODate(text)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_: unknown, record: OrderData) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<CloudServerOutlined />}
            onClick={() => navigate(`/dashboard/node?order_id=${record.id}&trade_no=${record.trade_no}`)}
          >
            查看节点
          </Button>
          <Button 
            type="link" 
            icon={<CloudServerOutlined />}
            onClick={() => handlePanelConfig(record)}
          >
            更换面板
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title="订单列表" className="shadow-md" bordered={false}>
        {/* 搜索区域 */}
        <Card 
          className="mb-4"
          size="small"
          bordered
          bodyStyle={{ padding: expandSearch ? '24px' : '12px' }}
        >
          <div className="flex justify-between items-center mb-3">
            <Typography.Title level={5} style={{ margin: 0 }}>
              <SearchOutlined /> 搜索条件
            </Typography.Title>
            <Button 
              type="link" 
              onClick={() => setExpandSearch(!expandSearch)}
              icon={expandSearch ? <UpOutlined /> : <DownOutlined />}
            >
              {expandSearch ? '收起' : '展开'}
            </Button>
          </div>
          
          {expandSearch && (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSearch}
            >
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="trade_no" label="订单号">
                    <Input placeholder="搜索订单号" prefix={<OrderedListOutlined />} />
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="customer_username" label="客户">
                    <Input placeholder="搜索客户用户名" prefix={<UserOutlined />} />
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="agent_username" label="代理商">
                    <Select placeholder="选择代理商" allowClear disabled={isAgentL2}>
                      {agents.map(agent => (
                        <Option key={agent.id} value={agent.username}>
                          {agent.username}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="status" label="状态">
                    <Select placeholder="选择状态" allowClear>
                      <Option value="success">成功</Option>
                      <Option value="pending">处理中</Option>
                      <Option value="failed">失败</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="payment_type" label="支付方式">
                    <Select placeholder="支付方式" allowClear>
                      <Option value="alipay">支付宝</Option>
                      <Option value="wxpay">微信支付</Option>
                      <Option value="balance">余额支付</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="country" label="国家/地区">
                    <Input placeholder="输入国家/地区" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item name="date_range" label="下单时间">
                    <RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Form.Item label=" " colon={false}>
                    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                      <Button icon={<ReloadOutlined />} onClick={handleReset}>
                        重置
                      </Button>
                      <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                        搜索
                      </Button>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          )}
          
          {!expandSearch && (
            <Form
              form={form}
              layout="inline"
              onFinish={handleSearch}
              className="flex flex-wrap gap-2"
            >
              <Form.Item name="trade_no" style={{ marginBottom: 8, minWidth: '150px' }}>
                <Input placeholder="订单号" prefix={<OrderedListOutlined />} />
              </Form.Item>
              
              <Form.Item name="customer_username" style={{ marginBottom: 8, minWidth: '150px' }}>
                <Input placeholder="客户用户名" prefix={<UserOutlined />} />
              </Form.Item>
              
              <Form.Item style={{ marginBottom: 8, marginLeft: 'auto' }}>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    重置
                  </Button>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    搜索
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Card>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            ...tableParams.pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条订单`,
          }}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 1500 }}
          bordered
        />
      </Card>
      
      <Modal
        title="面板调节"
        open={isPanelModalVisible}
        onOk={handlePanelSubmit}
        onCancel={() => setIsPanelModalVisible(false)}
        confirmLoading={panelLoading}
      >
        <Form
          form={panelForm}
          layout="vertical"
        >
          <Form.Item
            name="country"
            label="国家/地区"
            rules={[{ required: true, message: '请选择国家/地区' }]}
          >
            <Select
              placeholder="请选择国家/地区"
              loading={panelLoading}
              onChange={handleCountryChange}
            >
              {countryOptions.map(country => (
                <Option key={country} value={country}>{country}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="node"
            label="节点"
            rules={[{ required: true, message: '请选择节点' }]}
          >
            <Select
              placeholder="请选择节点"
              loading={panelLoading}
              disabled={nodeOptions.length === 0}
            >
              {nodeOptions.map(node => (
                <Option key={node.id} value={node.id}>
                  {`${node.ip_address} (${node.panel_type})`}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OrderList; 