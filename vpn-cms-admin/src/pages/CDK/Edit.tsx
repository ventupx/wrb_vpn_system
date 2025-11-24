import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, InputNumber, DatePicker, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import request from '@/utils/request';
import type { AxiosError } from 'axios';

interface CDKForm {
  code: string;
  discount: number;
  max_uses: number;
  valid_from: dayjs.Dayjs;
  valid_until: dayjs.Dayjs;
}

interface CDKResponse extends Omit<CDKForm, 'valid_from' | 'valid_until'> {
  valid_from: string;
  valid_until: string;
  id: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
}

const CDKEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const handleSubmit = async (values: CDKForm) => {
    setLoading(true);
    try {
      const postData = {
        ...values,
        valid_from: values.valid_from.toISOString(),
        valid_until: values.valid_until.toISOString()
      };

      if (id) {
        await request.put(`/cdk/${id}/`, { data: postData });
      } else {
        await request.post('/cdk/', { data: postData });
      }
      
      message.success(id ? '更新成功' : '创建成功');
      navigate('/dashboard/cdk');
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      if (axiosError.response?.data?.errors) {
        // 处理表单验证错误
        const errors = axiosError.response.data.errors;
        for (const key in errors) {
          message.error(`${key}: ${errors[key].join(', ')}`);
        }
      } else {
        message.error(axiosError.response?.data?.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateRandomCode = async () => {
    try {
      const response = await request.post<{ code: string }>('/cdk/generate_code/');
      form.setFieldValue('code', response.data.code);
    } catch {
      message.error('生成随机码失败');
    }
  };

  useEffect(() => {
    if (id) {
      const fetchCDK = async () => {
        try {
          const response = await request.get<CDKResponse>(`/cdk/${id}/`);
          form.setFieldsValue({
            ...response.data,
            valid_from: dayjs(response.data.valid_from),
            valid_until: dayjs(response.data.valid_until)
          });
        } catch {
          message.error('获取数据失败');
          navigate('/dashboard/cdk');
        }
      };
      fetchCDK();
    }
  }, [id, form, navigate]);

  return (
    <Card title={id ? '编辑优惠码' : '创建优惠码'}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          discount: 10,
          max_uses: 100,
          valid_from: dayjs(),
          valid_until: dayjs().add(30, 'day')
        }}
      >
        <Form.Item
          label="优惠码"
          name="code"
          rules={[{ required: true, message: '请输入优惠码' }]}
          extra="优惠码由字母和数字组成，建议使用大写字母"
        >
          <Input
            placeholder="请输入优惠码"
            style={{ width: '100%' }}
            suffix={
              <Button type="link" onClick={generateRandomCode}>
                随机生成
              </Button>
            }
          />
        </Form.Item>

        <Form.Item
          label="折扣比例"
          name="discount"
          rules={[{ required: true, message: '请输入折扣比例' }]}
          extra="输入1-100之间的数字，表示折扣百分比"
        >
          <InputNumber<number>
            min={1}
            max={100}
            formatter={value => `${value}%`}
            parser={value => parseInt(value?.replace('%', '') || '0')}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="最大使用次数"
          name="max_uses"
          rules={[{ required: true, message: '请输入最大使用次数' }]}
        >
          <InputNumber
            min={1}
            max={10000}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="生效时间"
          name="valid_from"
          rules={[{ required: true, message: '请选择生效时间' }]}
        >
          <DatePicker
            showTime
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="过期时间"
          name="valid_until"
          rules={[{ required: true, message: '请选择过期时间' }]}
        >
          <DatePicker
            showTime
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: '8px' }}>
            {id ? '更新' : '创建'}
          </Button>
          <Button onClick={() => navigate('/dashboard/cdk')}>
            返回列表
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default CDKEdit; 