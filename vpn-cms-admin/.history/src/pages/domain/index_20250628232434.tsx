import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Modal, 
  message, 
  Form, 
  Input, 
  Select, 
  Card,
  Popconfirm 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import request from '@/utils/request';

const { Option } = Select;

interface DomainMapping {
  id: number;
  domain: string;
  ip: string;
  name: string;
  created_at?: string;
  updated_at?: string;
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

interface DomainForm {
  domain: string;
  ip: string;
  name: string;
}

const DomainManagement: React.FC = () => {
  const [data, setData] = useState<DomainMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DomainMapping | null>(null);
  const [ipOptions, setIpOptions] = useState<Record<any, any>[]>([]);
  const [ipLoading, setIpLoading] = useState(false);
  const [form] = Form.useForm<DomainForm>();
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });

  // 获取域名映射列表
  const fetchDomainMappings = async () => {
    setLoading(true);
    try {
      const response = await request.get<PaginatedResponse<DomainMapping>>('/accounts/domain_list/', {
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
    } catch (error) {
      console.error('获取域名映射列表失败:', error);
      message.error('获取域名映射列表失败');
    }
    setLoading(false);
  };

  // 获取IP选项列表
  const fetchIpOptions = async () => {
    setIpLoading(true);
    try {
      const response = await request.get<Record<any, any>>('/accounts/endpoints_user/');
      setIpOptions(response.data.inbounds);
    } catch (error) {
      console.error('获取IP选项失败:', error);
      message.error('获取IP选项失败');
    }
    setIpLoading(false);
  };

  useEffect(() => {
    fetchDomainMappings();
    fetchIpOptions();
  }, []);

  useEffect(() => {
    fetchDomainMappings();
  }, [JSON.stringify(tableParams.pagination)]);

  // 添加域名映射
  const handleAdd = () => {
    setEditingRecord(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  // 编辑域名映射
  const handleEdit = (record: DomainMapping) => {
    setEditingRecord(record);
    setIsModalVisible(true);
    form.setFieldsValue({
      domain: record.domain,
      ip: record.ip,
      name: record.name,
    });
  };

  // 删除域名映射
  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/accounts/delete_domain/`, {
        data: {
          id: id
        }
      });
      message.success('删除成功');
      fetchDomainMappings();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
        const values = await form.validateFields();
        const { domain, ip } = values;
      const selectedIpOption = ipOptions.find(option => option.connect_host === ip);
      const name = selectedIpOption ? selectedIpOption.name : ip;
      
      const data = {
        domain: domain,
        ip: ip,
        name: name,
      }
      if (editingRecord) {
        // 更新
        await request.put(`/accounts/save_domain/`, {
          data: {...data, id: editingRecord.id}
        });
        message.success('更新成功');
      } else {
        // 新增
        await request.post('/accounts/save_domain/', {
          data: data
        });
        message.success('添加成功');
      }
      
      setIsModalVisible(false);
      form.resetFields();
      fetchDomainMappings();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 取消操作
  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingRecord(null);
  };

  // 表格分页处理
  const handleTableChange = (pagination: TablePaginationConfig) => {
    setTableParams({
      pagination: {
        ...tableParams.pagination,
        ...pagination,
      },
    });
  };

  // 表格列定义
  const columns: ColumnsType<DomainMapping> = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_, __, index) => {
        const { current = 1, pageSize = 10 } = tableParams.pagination;
        return (current - 1) * pageSize + index + 1;
      },
    },
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      width: 200,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 150,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个域名映射吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              添加域名映射
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...tableParams.pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑域名映射' : '添加域名映射'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '20px' }}
        >
          <Form.Item
            label="域名"
            name="domain"
            rules={[
              { required: true, message: '请输入域名' },
              {
                pattern: /^([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}$/,
                message: '请输入有效的域名格式',
              },
            ]}
          >
            <Input 
              placeholder="请输入域名，如: example.com" 
              maxLength={100}
            />
          </Form.Item>

          <Form.Item
            label="IP地址"
            name="ip"
            rules={[
              { required: true, message: '请选择IP地址' },
            ]}
          >
            <Select
              placeholder="请选择IP地址"
              loading={ipLoading}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {ipOptions.map((option) => (
                <Option key={option.connect_host} value={option.connect_host} label={option.name}>
                  {option.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DomainManagement;
