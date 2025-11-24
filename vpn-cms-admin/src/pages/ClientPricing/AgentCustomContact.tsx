import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Form, InputNumber, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';
import { debounce } from 'lodash';

const { Option } = Select;

interface Price {
  monthly: string;
  quarterly: string;
  half_yearly: string;
  yearly: string;
}

interface PricingData {
  default_prices: {
    normal: Price;
    live: Price;
    transit: Price;
  };
  custom_prices: {
    normal: Price;
    live: Price;
    transit: Price;
  };
  user_prices?: {
    normal: Price;
    live: Price;
    transit: Price;
  };
}

interface Customer {
  id: number;
  username: string;
  email: string;
  phone: string | null;
  ip_address: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  balance: string;
  agent_username: string;
}

const AgentCustomContact: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [form] = Form.useForm();

  // 获取客户列表（带搜索功能）
  const fetchCustomers = async (username?: string) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (username) {
        params.append('username', username);
      }
      const response = await request.get(`/customers/?${params.toString()}`);
      if (response.code === 200) {
        setCustomers(response.data.results);
      } else {
        message.error(response.message || '获取客户列表失败');
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 防抖处理的搜索函数
  const debouncedSearch = debounce((searchText: string) => {
    fetchCustomers(searchText);
  }, 500);

  // 处理搜索
  const handleSearch = (value: string) => {
    if (value) {
      debouncedSearch(value);
    } else {
      fetchCustomers();
    }
  };

  // 获取定价数据
  const fetchPricing = async (userId?: number) => {
    setLoading(true);
    try {
      const url = userId ? `/agent/pricing/?user_id=${userId}` : '/agent/pricing/';
      const response = await request.get(url);
      if (response.code === 200) {
        setPricingData(response.data);
        // 如果是查询特定用户，使用user_prices，否则使用custom_prices
        const prices = userId ? (response.data.user_prices || response.data.default_prices) : response.data.custom_prices;
        form.setFieldsValue(prices);
      } else {
        message.error(response.message || '获取定价失败');
      }
    } catch (error) {
      console.error('获取定价失败:', error);
      message.error('获取定价失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
    fetchPricing();
  }, []);

  const handleCustomerChange = (value: number) => {
    setSelectedCustomerId(value);
    fetchPricing(value);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (!selectedCustomerId) {
        message.error('请选择客户');
        return;
      }

      // 验证所有价格不能为空
      const priceTypes = ['normal', 'live', 'transit'];
      const periods = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
      
      for (const type of priceTypes) {
        for (const period of periods) {
          if (values[type][period] === null || values[type][period] === undefined) {
            message.error(`${type} 类型的 ${period} 价格不能为空`);
            return;
          }
        }
      }
      
      // 验证自定义价格是否大于等于默认价格
      if (pricingData) {
        const validatePrice = (type: 'normal' | 'live' | 'transit', period: keyof Price) => {
          const customPrice = Number(values[type][period]);
          const defaultPrice = Number(pricingData.default_prices[type][period]);
          return customPrice >= defaultPrice;
        };

        const isValid = Object.keys(values).every(type => 
          type === 'customer' || Object.keys(values[type]).every(period => 
            validatePrice(type as 'normal' | 'live' | 'transit', period as keyof Price)
          )
        );

        if (!isValid) {
          message.error('自定义价格不能低于默认定价');
          return;
        }
      }

      // 调用更新接口
      const response = await request.post('/agent/pricing/update-user/', {
        data: {
          userid: selectedCustomerId,
          user_prices: {
            normal: values.normal,
            live: values.live,
            transit: values.transit
          }
        }
      });
      
      if (response.code === 200) {
        message.success(response.message);
        // 重新获取价格数据
        fetchPricing(selectedCustomerId);
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const columns = [
    {
      title: '套餐类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => {
        const typeMap: Record<string, string> = {
          normal: '普通定价',
          live: '直播定价',
          transit: '视频定价'
        };
        return typeMap[text];
      }
    },
    {
      title: '月付',
      dataIndex: 'monthly',
      key: 'monthly',
      render: (text: string, record: { type: string; defaultPrice: Price }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#999', fontSize: '12px' }}>
            默认价格：¥{record.defaultPrice.monthly}
          </div>
          <Form.Item
            name={[record.type, 'monthly']}
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={Number(record.defaultPrice.monthly)}
              precision={2}
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/¥\s?|(,*)/g, ''))}
              style={{ width: '120px' }}
            />
          </Form.Item>
        </div>
      )
    },
    {
      title: '季付',
      dataIndex: 'quarterly',
      key: 'quarterly',
      render: (text: string, record: { type: string; defaultPrice: Price }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#999', fontSize: '12px' }}>
            默认价格：¥{record.defaultPrice.quarterly}
          </div>
          <Form.Item
            name={[record.type, 'quarterly']}
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={Number(record.defaultPrice.quarterly)}
              precision={2}
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/¥\s?|(,*)/g, ''))}
              style={{ width: '120px' }}
            />
          </Form.Item>
        </div>
      )
    },
    {
      title: '半年付',
      dataIndex: 'half_yearly',
      key: 'half_yearly',
      render: (text: string, record: { type: string; defaultPrice: Price }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#999', fontSize: '12px' }}>
            默认价格：¥{record.defaultPrice.half_yearly}
          </div>
          <Form.Item
            name={[record.type, 'half_yearly']}
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={Number(record.defaultPrice.half_yearly)}
              precision={2}
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/¥\s?|(,*)/g, ''))}
              style={{ width: '120px' }}
            />
          </Form.Item>
        </div>
      )
    },
    {
      title: '年付',
      dataIndex: 'yearly',
      key: 'yearly',
      render: (text: string, record: { type: string; defaultPrice: Price }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#999', fontSize: '12px' }}>
            默认价格：¥{record.defaultPrice.yearly}
          </div>
          <Form.Item
            name={[record.type, 'yearly']}
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber
              min={Number(record.defaultPrice.yearly)}
              precision={2}
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/¥\s?|(,*)/g, ''))}
              style={{ width: '120px' }}
            />
          </Form.Item>
        </div>
      )
    }
  ];

  const dataSource = pricingData ? [
    {
      key: 'normal',
      type: 'normal',
      defaultPrice: pricingData.default_prices.normal,
      ...pricingData.default_prices.normal
    },
    {
      key: 'live',
      type: 'live',
      defaultPrice: pricingData.default_prices.live,
      ...pricingData.default_prices.live
    },
    {
      key: 'transit',
      type: 'transit',
      defaultPrice: pricingData.default_prices.transit,
      ...pricingData.default_prices.transit
    }
  ] : [];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button 
              type="text" 
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
            <span>指定客户定价</span>
          </Space>
        }
        extra={
          <Button 
            type="primary"
            onClick={handleSave}
            disabled={!selectedCustomerId}
          >
            保存
          </Button>
        }
      >
        <Form form={form}>
          <Form.Item
            name="customer"
            label="选择客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select
              showSearch
              placeholder="请输入用户名搜索"
              style={{ width: '100%' }}
              defaultActiveFirstOption={false}
              filterOption={false}
              onSearch={handleSearch}
              onChange={handleCustomerChange}
              loading={searchLoading}
              notFoundContent={searchLoading ? '搜索中...' : '未找到匹配的用户'}
            >
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.username} ({customer.email})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Table
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            pagination={false}
          />
        </Form>
      </Card>
    </div>
  );
};

export default AgentCustomContact;
