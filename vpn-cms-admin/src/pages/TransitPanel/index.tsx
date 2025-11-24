import React, { useState, useEffect } from 'react';
import { Table, Button, Card, message, Space, Modal, Input, Row, Col, Form, Tag, Typography, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import { 
  SearchOutlined, 
  FilterOutlined, 
  PlusOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckOutlined,
  SyncOutlined
} from '@ant-design/icons';
import request from '@/utils/request';

const { Option } = Select;

interface TransitPanelData {
  id: number;
  username: string;
  password?: string;
  balance: string | number;
  traffic: string;
  traffic_used: number;
  traffic_total: number;
  rules: string;
  rules_used: number;
  rules_max: number;
  status: 'active' | 'inactive';
  default_inbound: string;
  default_outbound: string;
  created_at: string;
  updated_at: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
}

interface FilterParams {
  username?: string;
  is_active?: boolean | null;
}

interface AddTransitFormData {
  username: string;
  password: string;
}

const TransitPanel: React.FC = () => {
  const [data, setData] = useState<TransitPanelData[]>([]);
  const [filteredData, setFilteredData] = useState<TransitPanelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({
    username: '',
    is_active: null,
  });
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);
  const [isEditDefaultsModalVisible, setIsEditDefaultsModalVisible] = useState(false);
  const [editDefaultsForm] = Form.useForm();
  const [editDefaultsLoading, setEditDefaultsLoading] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<number | null>(null);
  const [entryOptions, setEntryOptions] = useState<{ label: string; value: string; data: any }[]>([]);
  const [exitOptions, setExitOptions] = useState<{ label: string; value: string; data: any }[]>([]);

  const formatTrafficToGiB = (bytes: number): string => {
    const GiB = 1024 * 1024 * 1024; // 1 GiB = 1073741824 bytes
    const formatted = (bytes / GiB).toFixed(2);
    return `${formatted} GiB`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await request.get<{
        code: number;
        message: string;
        data: {
          results: TransitPanelData[];
          count: number;
        }
      }>('/accounts/', {
        params: {
          page: tableParams.pagination.current,
          page_size: tableParams.pagination.pageSize,
          username: filters.username || undefined,
          is_active: filters.is_active === null ? undefined : filters.is_active,
        },
      });
      
      if (response.code === 200 && response.data) {
        // 处理返回的数据
        const processedData = response.data.results.map(item => ({
          ...item,
          // 转换状态为布尔值
          is_active: item.status === 'active',
          // 设置默认路由
          default_entry: item.default_inbound,
          default_exit: item.default_outbound,
          // 转换余额为数字
          balance: typeof item.balance === 'string' ? parseFloat(item.balance) : item.balance,
          // 解析traffic数据
          traffic_used: item.traffic_used,
          traffic_total: item.traffic_total,
          // 解析rules数据
          rules_used: item.rules_used,
          rules_total: item.rules_max
        }));
        setData(processedData);
        setFilteredData(processedData);
        setTableParams({
          ...tableParams,
          pagination: {
            ...tableParams.pagination,
            total: response.data.count,
          },
        });
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error: any) {
      console.error('获取中转面板数据失败:', error);
      message.error(error?.message || '获取中转面板数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, data]);

  const applyFilters = () => {
    let filtered = [...data];
    
    if (filters.username) {
      filtered = filtered.filter(item => 
        item.username.toLowerCase().includes(filters.username?.toLowerCase() || '')
      );
    }
    
    if (filters.is_active !== null) {
      filtered = filtered.filter(item => item.is_active === filters.is_active);
    }
    
    setFilteredData(filtered);
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
        total: filtered.length,
      },
    });
  };

  const handleFilterChange = (key: keyof FilterParams, value: FilterParams[keyof FilterParams]) => {
    setFilters({
      ...filters,
      [key]: value,
    });
  };

  const resetFilters = () => {
    setFilters({
      username: '',
      is_active: null,
    });
  };

  const showAddModal = () => {
    setIsAddModalVisible(true);
  };

  const handleAddCancel = () => {
    addForm.resetFields();
    setIsAddModalVisible(false);
  };

  const handleAddSubmit = async () => {
    try {
      const formValues = await addForm.validateFields();
      setAddLoading(true);
      const response = await request.post<{code: number; message: string; data: TransitPanelData}>('/accounts/', {data: formValues});
      
      if (response.code === 200) {
        message.success(response.message || '添加中转账号成功');
        setIsAddModalVisible(false);
        addForm.resetFields();
        fetchData();
      } else {
        message.error(response.message || '添加中转账号失败');
      }
    } catch (error: any) {
      console.error('添加中转账号失败:', error);
      message.error(error?.message || '添加中转账号失败，请检查输入信息');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await request.delete<{code: number; message: string}>(`/accounts/${id}/`);
      
      if (response.code === 200) {
        message.success(response.message || '删除账号成功');
        // 重新获取数据列表
        fetchData();
      } else {
        message.error(response.message || '删除账号失败');
      }
    } catch (error: any) {
      console.error('删除中转账号失败:', error);
      message.error(error?.message || '删除中转账号失败');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      // 只处理停用，不处理启用，因为启用可能需要另外的接口
      if (currentStatus) {
        const response = await request.post<{code: number; message: string}>(`/accounts/${id}/deactivate/`);
      
      if (response.code === 200) {
          message.success(response.message || '停用账号成功');
        fetchData();
        } else {
          message.error(response.message || '停用账号失败');
        }
      } else {
        message.info('启用账号功能暂不可用');
      }
    } catch (error: any) {
      console.error('更改状态失败:', error);
      message.error(error?.message || '更改状态失败');
    }
  };

  // 刷新中转账号数据
  const handleRefreshAll = async () => {
    try {
      const refreshLoading = true;
      setLoading(refreshLoading);
      const response = await request.post<{code: number; message: string}>('/accounts/refresh_all/');
      
      if (response.code === 200) {
        message.success(response.message || '刷新中转账号数据成功');
        // 重新请求列表获取最新数据
        fetchData();
      } else {
        message.error(response.message || '刷新中转账号数据失败');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('刷新中转账号数据失败:', error);
      message.error(error?.message || '刷新中转账号数据失败');
      setLoading(false);
    }
  };

  const columns: ColumnsType<TransitPanelData> = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => {
        return <Tag color="blue">{username}</Tag>;
      }
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (password: string) => {
        return <Tag color="cyan">{password}</Tag>;
      }
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => {
        return <Tag color="green">¥{balance.toFixed(2)}</Tag>;
      }
    },
    {
      title: '流量使用',
      key: 'traffic',
      render: (_, record) => {
        return (
          <Tag color="orange">
            {`${formatTrafficToGiB(record.traffic_used)}/${formatTrafficToGiB(record.traffic_total)}`}
          </Tag>
        );
      }
    },
    {
      title: '规则数量',
      key: 'rules',
      render: (_, record) => {
        return (
          <Tag color="purple">
            {`${record.rules_used}/${record.rules_total}`}
          </Tag>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (is_active: boolean) => {
        return <Tag color={is_active ? 'green' : 'red'}>{is_active ? '启用' : '停用'}</Tag>;
      }
    },
    {
      title: '默认入口',
      dataIndex: 'default_entry',
      key: 'default_entry',
      render: (entry: string) => <Tag color="blue">{JSON.parse(entry).name || '未设置'}</Tag>
    },
    {
      title: '默认出口',
      dataIndex: 'default_exit',
      key: 'default_exit',
      render: (exit: string) => <Tag color="green">{JSON.parse(exit).name || '未设置'}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除中转账号 ${record.username} 吗？删除后将无法恢复。`,
                okText: '确认删除',
                cancelText: '取消',
                onOk: () => handleDelete(record.id)
              });
            }}
          >
            删除
          </Button>
          {record.is_active ? (
            <Button
              type="default"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认停用',
                  content: `确定要停用中转账号 ${record.username} 吗？停用后账号将无法使用，但可以联系管理员重新启用。`,
                  okText: '确认停用',
                  cancelText: '取消',
                  onOk: () => handleToggleStatus(record.id, true)
                });
              }}
            >
              停用
            </Button>
          ) : (
          <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled
              onClick={() => message.info('请联系管理员启用此账号')}
          >
              已停用
          </Button>
          )}
          <Button
            type="default"
            onClick={() => {
              // 设置当前编辑的ID
              setCurrentEditId(record.id);
              // 获取出入口数据
              fetchEndpoints(record.id);
              // 设置默认值
              editDefaultsForm.setFieldsValue({
                default_entry: record.default_entry,
                default_exit: record.default_exit
              });
              // 显示弹窗
              setIsEditDefaultsModalVisible(true);
            }}
          >
            修改默认路由
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

  // 获取入口和出口选项
  const fetchEndpoints = async (accountId: number) => {
    try {
      const response = await request.get<{
        code: number;
        message: string;
        data: {
          inbounds: any[];
          outbounds: any[];
        }
      }>('/accounts/endpoints/', {
        params: { account_id: accountId }
      });
      
      if (response.code === 200 && response.data) {
        // 设置入口选项
        const inboundOptions = response.data.inbounds.map(inbound => ({
          label: inbound.name,
          value: inbound.id.toString(), // 确保ID是字符串类型
          data: inbound // 保存完整数据
        }));
        setEntryOptions(inboundOptions);
        
        // 设置出口选项
        const outboundOptions = response.data.outbounds.map(outbound => ({
          label: outbound.name,
          value: outbound.id.toString(), // 确保ID是字符串类型
          data: outbound // 保存完整数据
        }));
        setExitOptions(outboundOptions);
      } else {
        message.error(response.message || '获取出入口数据失败');
      }
    } catch (error) {
      console.error('获取出入口数据失败:', error);
      message.error('获取出入口数据失败，请稍后重试');
    }
  };

  return (
    <Card title="中转配置管理">
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" gutter={16} align="middle">
          <Col>
            <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={showAddModal}
            >
              添加中转账号
            </Button>
              <Button
                icon={<SyncOutlined spin={loading} />}
                onClick={handleRefreshAll}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新数据'}
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="搜索账号"
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 180 }}
              />
              <Select
                placeholder="状态"
                style={{ width: 100 }}
                value={filters.is_active}
                onChange={(value) => handleFilterChange('is_active', value === undefined ? null : value)}
                allowClear
              >
                <Option value={true}>启用</Option>
                <Option value={false}>停用</Option>
              </Select>
              <Button icon={<FilterOutlined />} onClick={resetFilters}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        pagination={tableParams.pagination}
        loading={loading}
        onChange={handleTableChange}
      />
      
      {/* 添加中转账号模态框 */}
      <Modal
        title="添加中转账号"
        open={isAddModalVisible}
        onOk={handleAddSubmit}
        onCancel={handleAddCancel}
        confirmLoading={addLoading}
        okText="添加"
        cancelText="取消"
        footer={[
          <div key="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Link 
              onClick={async () => {
                try {
                  const values = await addForm.validateFields();
                  const response = await request.post<{
                    code: number;
                    message: string;
                    data: { connected: boolean }
                  }>('/accounts/test_connection/', {data: values});
                  
                  if (response.code === 200) {
                    message.success(response.message || '测试连接成功');
                  } else {
                    message.error(response.message || '测试连接失败');
                  }
                } catch (error) {
                  if ('errorFields' in error) {
                    message.error('请填写完整的连接信息');
                  } else {
                    message.error(error instanceof Error ? error.message : '测试连接失败');
                  }
                }
              }}
              style={{ color: '#1890ff' }}
            >
              测试连接
            </Typography.Link>
            <div>
              <Button key="cancel" onClick={handleAddCancel} className='!mr-2'>
                取消
              </Button>
              <Button key="submit" type="primary" loading={addLoading} onClick={handleAddSubmit}>
                添加
              </Button>
            </div>
          </div>
        ]}
      >
        <Form
          form={addForm}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input placeholder="请输入中转账号" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入中转密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改默认入口和出口模态框 */}
      <Modal
        title="修改默认路由"
        open={isEditDefaultsModalVisible}
        onOk={async () => {
          try {
            message.loading('正在提交设置...', 0.5);
            
            const values = await editDefaultsForm.validateFields();
            
            // 查找完整的入口和出口数据
            const selectedInbound = entryOptions.find(option => option.value === values.default_entry);
            const selectedOutbound = exitOptions.find(option => option.value === values.default_exit);
            
            if (!selectedInbound || !selectedOutbound) {
              message.error('请选择有效的入口和出口');
              return;
            }
            
            setEditDefaultsLoading(true);
            
            // 构建提交的数据
            const submitData = {
              default_inbound: selectedInbound?.data ? JSON.stringify(selectedInbound.data) : null,
              default_outbound: selectedOutbound?.data ? JSON.stringify(selectedOutbound.data) : null
            };
            
            
            const response = await request.post<{code: number; message: string}>(`/accounts/${currentEditId}/update_endpoints/`, {
              data: submitData
            });
            
            
            if (response.code === 200) {
              message.success('默认路由设置成功，数据更新可能需要几秒钟生效');
              setIsEditDefaultsModalVisible(false);
              fetchData();
            } else {
              message.error(response.message || '默认路由设置失败');
            }
          } catch (error: any) {
            console.error('修改默认路由失败:', error);
            if (error.response) {
              message.error(`请求错误：${error.response.status} ${error.response.statusText}`);
            } else if (error.request) {
              message.error('未收到服务器响应，请检查网络连接');
            } else {
              message.error(error?.message || '修改默认路由时发生错误');
            }
          } finally {
            setEditDefaultsLoading(false);
          }
        }}
        okText="保存设置"
        cancelText="取消"
        onCancel={() => {
          editDefaultsForm.resetFields();
          setIsEditDefaultsModalVisible(false);
          setCurrentEditId(null);
        }}
        confirmLoading={editDefaultsLoading}
      >
        <p style={{ marginBottom: 16 }}>为中转账号设置默认的入口和出口节点。设置后可能需要几秒钟生效。</p>
        <Form
          form={editDefaultsForm}
          layout="vertical"
        >
          <Form.Item
            name="default_entry"
            label="默认入口"
            rules={[{ required: true, message: '请选择默认入口' }]}
            help="选择默认入口节点，用于作为流量进入的端点"
          >
            <Select
              placeholder="请选择默认入口"
              options={entryOptions}
              loading={entryOptions.length === 0}
              notFoundContent={entryOptions.length === 0 ? '加载中...' : '暂无数据'}
            />
          </Form.Item>
          
          <Form.Item
            name="default_exit"
            label="默认出口"
            rules={[{ required: true, message: '请选择默认出口' }]}
            help="选择默认出口节点，用于作为流量流出的端点"
          >
            <Select
              placeholder="请选择默认出口"
              options={exitOptions}
              loading={exitOptions.length === 0}
              notFoundContent={exitOptions.length === 0 ? '加载中...' : '暂无数据'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default TransitPanel;