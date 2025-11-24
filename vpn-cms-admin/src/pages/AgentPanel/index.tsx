import React, { useState, useEffect } from 'react';
import { Table, Button, Card, message, Badge, Space, Modal, Input, Select, Row, Col, Form, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import { 
  ClusterOutlined, 
  DashboardOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  PlusOutlined,
  DeleteOutlined,
  RedoOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '@/utils/request';

const { Option } = Select;

interface AgentPanelData {
  id: number;
  ip_address: string;
  username: string;
  is_active: boolean;
  panel_type: 'x-ui' | '3x-ui';
  last_restart: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  country?: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
}

interface FilterParams {
  ip_address?: string;
  panel_type?: 'x-ui' | '3x-ui' | null;
  is_online?: boolean | null;
  country?: string | null;
}


const AgentPanel: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AgentPanelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({
    ip_address: '',
    panel_type: null,
    is_online: null,
    country: null,
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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<AgentPanelData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [countryList, setCountryList] = useState<string[]>([]);
  const fetchData = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countryResponse = await request.get<any>('/agent-panel/countries/');
      if (countryResponse.code === 200 && countryResponse.data) {
        setCountryList(countryResponse.data);
      } else {
        message.error(countryResponse.message || '获取国家列表失败');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await request.get<any>('/agent-panel/', {
        params: {
          page: current,
          page_size: pageSize,
          ip_address: filters.ip_address || undefined,
          panel_type: filters.panel_type || undefined,
          is_online: filters.is_online === null ? undefined : filters.is_online,
        },
      });
      
      if (response.code === 200 && response.data) {
        setData(response.data.results);
        setTotal(response.data.count);
        setCurrent(response.data.page);
        setPageSize(response.data.page_size);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error: any) {
      console.error('获取代理面板数据失败:', error);
      message.error(error?.message || '获取代理面板数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const handleFilterChange = (key: keyof FilterParams, value: FilterParams[keyof FilterParams]) => {
    setFilters({
      ...filters,
      [key]: value,
    });
  };

  const resetFilters = () => {
    setFilters({
      ip_address: '',
      panel_type: null,
      is_online: null,
      country: null,
    });
    setCurrent(1);
    handelFilters();
  };
  const handelFilters = async()=>{
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await request.get<any>('/agent-panel/', {
      params: {
        page: current,
        page_size: pageSize,
        ip_address: filters.ip_address || undefined,
        panel_type: filters.panel_type || undefined,
        is_online: filters.is_online === null ? undefined : filters.is_online,
        country: filters.country || undefined,
      },
    });
    
    if (response.code === 200 && response.data) {
      setData(response.data.results);
      setTotal(response.data.count);
      setCurrent(response.data.page);
      setPageSize(response.data.page_size);
    } else {
      message.error(response.message || '获取数据失败');
    }
    setLoading(false);
  }

  // 打开添加面板模态框
  const showAddModal = () => {
    setIsAddModalVisible(true);
  };

  // 关闭添加面板模态框
  const handleAddCancel = () => {
    addForm.resetFields();
    setIsAddModalVisible(false);
  };

  // 添加IP地址格式验证函数
  const validateIpFormat = (ip: string): boolean => {
    // 匹配 IP:端口 或 IP:端口/路径 格式
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}(\/[a-zA-Z0-9]*)?$/;
    if (!ipPattern.test(ip)) {
      message.error('IP格式错误，正确格式为: 192.168.1.1:8000 或 192.168.1.1:8000/abcdefg');
      return false;
    }
    
    return true;
  };

  // 处理添加面板表单提交
  const handleAddSubmit = async () => {
    try {
      const formValues = await addForm.validateFields();
      if (!validateIpFormat(formValues.ip)) {
        return;
      }
      setAddLoading(true);
      const response = await request.post<{code: number; message: string; data: AgentPanelData}>('/agent-panel/', {data: formValues});
      
      if (response.code === 200) {
        message.success(response.message || '添加面板成功');
        setIsAddModalVisible(false);
        addForm.resetFields();
        fetchData();
      } else {
        message.error(response.message || '添加面板失败');
      }
    } catch (error: any) {
      console.error('添加面板失败:', error);
      message.error(error?.message || '添加面板失败，请检查输入信息');
    } finally {
      setAddLoading(false);
    }
  };

  const refreshPanelNodes = () => {
    request.post('/agent-panel/update_all_nodes_count/').then((response) => {
      if (response.code === 200) {
        message.success('更新已在后台启动，请稍后刷新查看结果');
        setTimeout(() => {
          fetchData();
        }, 3000); // 延迟3s后刷新页面
      } else {
        message.error(response.message || '刷新失败');
      }
    }).catch((error) => {
      console.error('刷新失败:', error);
      message.error(error?.message || '刷新失败');
    })
  }

  // 打开删除面板确认模态框
  const showDeleteConfirm = (panel: AgentPanelData) => {
    setPanelToDelete(panel);
    setDeleteModalVisible(true);
  };
  
  // 关闭删除面板确认模态框
  const handleDeleteCancel = () => {
    setDeleteModalVisible(false);
    setPanelToDelete(null);
  };
  
  // 处理删除面板
  const handleDeletePanel = async () => {
    if (!panelToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await request.delete<{code: number; message: string}>(`/agent-panel/${panelToDelete.id}/`);
      
      if (response.code === 200) {
        message.success(response.message || '删除成功');
        const newData = data.filter(item => item.id !== panelToDelete.id);
        setData(newData);
        setDeleteModalVisible(false);
        setPanelToDelete(null);
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除面板失败:', error);
      message.error(error?.message || '删除面板失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnsType<AgentPanelData> = [
    {
      title: '在线状态',
      dataIndex: 'is_online',
      render: (is_online: boolean) => {
        return <Tag color={is_online ? 'green' : 'red'}>{is_online ? '在线' : '离线'} </Tag>;
      }
    },
    {
      title: 'IP端口地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (ip_address: string) => {
        return <Tag color={'green'}>{ip_address}</Tag>;
      }
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      render: (country: string) => {
        return <Tag color={'gold'}>{country || '未知'}</Tag>;
      }
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => {
        return <Tag color={'cyan'}>{username}</Tag>;
      }
    },
    {
      title: '密码',
      dataIndex: 'plain_password',
      key: 'plain_password',
      render: (plain_password: string) => {
        return <Tag color={'cyan'}>{plain_password}</Tag>;
      }
    },
    {
      title: '节点数量',
      dataIndex: 'nodes_count',
      key: 'nodes_count',
      render: (nodes_count: string) => {
        return <Tag color={'green'}>{nodes_count}</Tag>;
      }
    },
    {
      title: '面板类型',
      dataIndex: 'panel_type',
      key: 'panel_type',
      render: (panel_type: string) => {
        const color = panel_type === 'x-ui' ? 'blue' : 'purple';
        return <Tag color={color}>{panel_type}</Tag>;
      }
    },
    // {
    //   title: '系统状态',
    //   key: 'system_status',
    //   render: (_, record) => (
    //     <Space size="middle">
    //       {record.is_active ? (
    //         <>
    //           <Badge status="success" text={`CPU: ${record.cpu_usage}%`} />
    //           <Badge status="processing" text={`内存: ${record.memory_usage}%`} />
    //           <Badge status="warning" text={`硬盘: ${record.disk_usage}%`} />
    //         </>
    //       ) : (
    //         <Badge status="default" text="离线" />
    //       )}
    //     </Space>
    //   ),
    // },
    {
      title: '操作',
      key: 'action',
      width: 480,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button 
            icon={<ClusterOutlined />} 
            onClick={() => navigate(`/dashboard/agent-panel/nodes/${record.id}`)}
          >
            节点列表
          </Button>
          <Button 
            icon={<DashboardOutlined />} 
            onClick={() => navigate(`/dashboard/agent-panel/status/${record.id}`)}
          >
            系统状态
          </Button>
          {
            record.panel_type ==='3x-ui' && (
              <Button 
                icon={<SettingOutlined />} 
                onClick={() => navigate(`/dashboard/agent-panel/settings/${record.id}`)}
              >
                出站规则
              </Button>
            )
          }
          <Button 
            type="primary"
            danger
            size="middle"
            icon={<DeleteOutlined />} 
            onClick={() => showDeleteConfirm(record)}
          >
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
    <Card title="代理面板管理">
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" gutter={16} align="middle">
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={showAddModal}
            >
              添加面板
            </Button>
            <Button 
              type="primary" 
              style={{ marginLeft: 10 }}
              icon={<RedoOutlined />} 
              onClick={refreshPanelNodes}
            >
              刷新代理面板状态
            </Button>
          </Col>
          <Col>
            <Space>
            
              <Input
                placeholder="搜索IP地址"
                value={filters.ip_address}
                onChange={(e) => handleFilterChange('ip_address', e.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 180 }}
              />
              <Select
                placeholder="国家"
                style={{ width: 120 }}
                value={filters.country}
                onChange={(value) => handleFilterChange('country', value || null)}
                allowClear
              >
                {countryList?.map(
                  (country: string) => (
                    <Option value={country}>{country}</Option>
                  )
                )}
              </Select>
              <Select
                placeholder="面板类型"
                style={{ width: 120 }}
                value={filters.panel_type}
                onChange={(value) => handleFilterChange('panel_type', value || null)}
                allowClear
              >
                <Option value="x-ui">x-ui</Option>
                <Option value="3x-ui">3x-ui</Option>
              </Select>
              <Select
                placeholder="状态"
                style={{ width: 100 }}
                value={filters.is_online}
                onChange={(value) => handleFilterChange('is_online', value === undefined ? null : value)}
                allowClear
              >
                <Option value={true}>在线</Option>
                <Option value={false}>离线</Option>
              </Select>
              <Button icon={<FilterOutlined />} onClick={resetFilters}>
                重置
              </Button>
              <Button icon={<FilterOutlined />} onClick={handelFilters}>
                筛选
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={{
          current,
          pageSize,
          total,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: async (page) => {
            setCurrent(page);
            setLoading(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await request.get<any>('/agent-panel/', {
              params: {
                page: page,
                page_size: pageSize,
                ip_address: filters.ip_address || undefined,
                panel_type: filters.panel_type || undefined,
                is_online: filters.is_online === null ? undefined : filters.is_online,
                country: filters.country || undefined,
              },
            });
            
            if (response.code === 200 && response.data) {
              setData(response.data.results);
              setTotal(response.data.count);
              setPageSize(response.data.page_size);
            } else {
              message.error(response.message || '获取数据失败');
            }
            setLoading(false);
          },
        }}
        loading={loading}
        onChange={handleTableChange}
      />
      
      {/* 添加面板模态框 */}
      <Modal
        title="添加面板"
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
                  const values = await addForm.validateFields(['ip', 'port', 'username', 'password', 'panel_type']);
                  if (!validateIpFormat(values.ip)) {
                    return;
                  }
                  console.log('测试连接的数据:', values);
                  const response = await request.post<{
                    code: number;
                    message: string;
                    data: { connected: boolean }
                  }>('/agent-panel/test_connection/', {data: values});
                  
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
              测试链接
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
          <div className='text-xs text-red-500'>请勿添加 http:// 开头和 / 结尾</div>
          <Form.Item
            name="ip"
            label="面板地址"
            rules={[{ required: true, message: '请输入IP地址' }]}
          >
            <Input placeholder="例如: 192.168.1.1:8000 || 192.168.1.1:8000/abcdefg" />
          </Form.Item>
          
          <Form.Item
            name="country"
            label="国家"
            rules={[{ required: true, message: '请输入国家' }]}
          >
            <Input placeholder="请输入国家" />
          </Form.Item>
          
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <Input placeholder="例如: 8888" />
          </Form.Item>
          
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="面板登录用户名" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="面板登录密码" />
          </Form.Item>
          
          <Form.Item
            name="panel_type"
            label="面板类型"
            rules={[{ required: true, message: '请选择面板类型' }]}
          >
            <Select placeholder="请选择面板类型">
              <Option value="x-ui">x-ui</Option>
              <Option value="3x-ui">3x-ui</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 删除面板确认模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', color: '#ff4d4f' }}>
            <DeleteOutlined style={{ marginRight: 8 }} />
            确认删除面板
          </div>
        }
        open={deleteModalVisible}
        onOk={handleDeletePanel}
        onCancel={handleDeleteCancel}
        confirmLoading={deleteLoading}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: '15px' }}>您确定要删除以下面板吗？</p>
          {panelToDelete && (
            <div style={{ 
              background: '#f5f5f5', 
              padding: '12px 16px', 
              borderRadius: '4px',
              marginBottom: '16px',
              marginTop: '16px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                <span>{panelToDelete.username}</span>
                <Tag color="blue" style={{ marginLeft: 8 }}>{panelToDelete.ip_address}</Tag>
                <Tag color="purple" style={{ marginLeft: 4 }}>{panelToDelete.panel_type}</Tag>
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                状态: {panelToDelete.is_active ? '在线' : '离线'} | 
                最后重启时间: {panelToDelete.last_restart}
              </p>
            </div>
          )}
          <p style={{ color: '#ff4d4f' }}>
            <strong>警告：</strong>此操作不可逆，删除后面板数据及其所有节点将无法恢复。
          </p>
        </div>
      </Modal>
    </Card>
  );
};

export default AgentPanel; 