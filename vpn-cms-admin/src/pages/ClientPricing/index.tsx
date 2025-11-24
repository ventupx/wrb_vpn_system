import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Form, Input, InputNumber } from 'antd';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';

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
}

const ClientPricing: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [form] = Form.useForm();

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const response = await request.get('/agent/pricing/');
      if (response.code === 200) {
        setPricingData(response.data);
        form.setFieldsValue(response.data.custom_prices);
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
    fetchPricing();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 验证自定义价格是否大于等于默认价格
      if (pricingData) {
        const validatePrice = (type: 'normal' | 'live' | 'transit', period: keyof Price) => {
          const customPrice = Number(values[type][period]);
          const defaultPrice = Number(pricingData.default_prices[type][period]);
          return customPrice >= defaultPrice;
        };

        const isValid = Object.keys(values).every(type => 
          Object.keys(values[type]).every(period => 
            validatePrice(type as 'normal' | 'live' | 'transit', period as keyof Price)
          )
        );

        if (!isValid) {
          message.error('自定义价格不能低于默认定价');
          return;
        }
      }

      const response = await request.post('/agent/pricing/update/', {data: values});

      if (response.code === 200) {
        message.success('保存成功');
        fetchPricing();
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
            initialValue={record.defaultPrice.monthly}
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
            initialValue={record.defaultPrice.quarterly}
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
            initialValue={record.defaultPrice.half_yearly}
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
            initialValue={record.defaultPrice.yearly}
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
      ...pricingData.custom_prices.normal
    },
    {
      key: 'live',
      type: 'live',
      defaultPrice: pricingData.default_prices.live,
      ...pricingData.custom_prices.live
    },
    {
      key: 'transit',
      type: 'transit',
      defaultPrice: pricingData.default_prices.transit,
      ...pricingData.custom_prices.transit
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
            <span>客户端定价</span>
          </Space>
        }
        extra={
          <Button 
            type="primary"
            onClick={handleSave}
          >
            保存
          </Button>
        }
      >
        <Form form={form}>
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

export default ClientPricing; 