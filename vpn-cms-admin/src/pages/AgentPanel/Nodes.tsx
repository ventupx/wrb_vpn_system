import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Typography, Badge, Breadcrumb, Modal, message, Input, Select, Row, Col } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftOutlined, 
  ClusterOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import request from '@/utils/request';

const { Text } = Typography;
const { Option } = Select;

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface ClientStats {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  expiryTime: number;
  total: number;
  reset: number;
}

interface NodeData {
  id: number;
  up: number;
  down: number;
  total: number;
  remark: string;
  enable: boolean;
  expiryTime: number;
  clientStats?: ClientStats[];
  listen: string;
  port: number;
  protocol: string;
  settings: string;  // JSON string
  streamSettings: string;  // JSON string
  tag: string;
  sniffing: string;  // JSON string
  allocate?: string;  // JSON string
}

interface PanelInfo {
  id: number;
  ip_address: string;
  username: string;
  panel_type: 'x-ui' | '3x-ui';
}

interface FilterParams {
  remark?: string;
  protocol?: string | null;
  enable?: boolean | null;
}

const NodeList: React.FC = () => {
  const { id, ip_address, panel_type } = useParams<{ id: string, ip_address: string, panel_type: string }>();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [panelInfo, setPanelInfo] = useState<PanelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<NodeData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filteredData, setFilteredData] = useState<NodeData[]>([]);
  const [filters, setFilters] = useState<FilterParams>({
    remark: '',
    protocol: null,
    enable: null,
  });

  useEffect(() => {
    fetchPanelInfo();
    fetchNodes();
  }, [id]);

  useEffect(() => {
    applyFilters();
  }, [filters, nodes]);

  const fetchPanelInfo = async () => {
    try {
      const response = await request.get<PanelInfo>(`/agent-panel/${id}/`);
      
      if (response.code === 200 && response.data) {
        setPanelInfo(response.data);
      } else {
        message.error(response.message || '获取面板信息失败');
      }
    } catch (error) {
      console.error('获取面板信息失败:', error);
      message.error(error instanceof Error ? error.message : '获取面板信息失败');
    }
  };

  const fetchNodes = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await request.get<NodeData[]>(`/agent-panel/${id}/nodes/`);
      
      if (response.code === 200 && response.data) {
        setNodes(response.data);
        setFilteredData(response.data);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取节点数据失败:', error);
      message.error(error instanceof Error ? error.message : '获取节点数据失败');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...nodes];
    
    if (filters.remark) {
      filtered = filtered.filter(item => 
        item.remark.toLowerCase().includes(filters.remark?.toLowerCase() || '')
      );
    }
    
    if (filters.protocol) {
      filtered = filtered.filter(item => item.protocol === filters.protocol);
    }
    
    if (filters.enable !== null) {
      filtered = filtered.filter(item => item.enable === filters.enable);
    }
    
    setFilteredData(filtered);
  };

  const handleFilterChange = (key: keyof FilterParams, value: FilterParams[keyof FilterParams]) => {
    setFilters({
      ...filters,
      [key]: value,
    });
  };

  const resetFilters = () => {
    setFilters({
      remark: '',
      protocol: null,
      enable: null,
    });
  };

  const getProtocolTag = (protocol: string) => {
    switch (protocol) {
      case 'vmess':
        return <Tag color="blue" style={{ fontWeight: 'bold', padding: '0 10px' }}>vmess</Tag>;
      case 'vless':
        return <Tag color="green" style={{ fontWeight: 'bold', padding: '0 10px' }}>vless</Tag>;
      case 'trojan':
        return <Tag color="purple" style={{ fontWeight: 'bold', padding: '0 10px' }}>trojan</Tag>;
      case 'shadowsocks':
        return <Tag color="orange" style={{ fontWeight: 'bold', padding: '0 10px' }}>shadowsocks</Tag>;
      case 'socks':
        return <Tag color="cyan" style={{ fontWeight: 'bold', padding: '0 10px' }}>socks</Tag>;
      case 'http':
        return <Tag color="red" style={{ fontWeight: 'bold', padding: '0 10px' }}>http</Tag>;
      default:
        return <Tag style={{ fontWeight: 'bold', padding: '0 10px' }}>{protocol}</Tag>;
    }
  };

  const showDeleteConfirm = (node: NodeData) => {
    setNodeToDelete(node);
    setDeleteModalVisible(true);
  };

  const handleDeleteCancel = () => {
    setDeleteModalVisible(false);
    setNodeToDelete(null);
  };

  const handleDeleteNode = async () => {
    if (!nodeToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await request.delete<ApiResponse<null>>(`/agent-panel/${id}/nodes/${nodeToDelete.id}/`);
      
      if (response.code === 200) {
        setNodes(nodes.filter(node => node.id !== nodeToDelete.id));
        message.success(`节点 "${nodeToDelete.remark}" 已删除`);
        setDeleteModalVisible(false);
        setNodeToDelete(null);
      } else {
        message.error(response.message || '删除节点失败');
      }
    } catch (error) {
      console.error('删除节点失败:', error);
      message.error(error instanceof Error ? error.message : '删除节点失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnsType<NodeData> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 50,
    },
    {
      title: '状态',
      dataIndex: 'enable',
      key: 'enable',
      width: 100,
      align: 'center',
      render: (enable: boolean) => (
        <Badge 
          status={enable ? 'success' : 'error'} 
          text={enable ? '启用' : '禁用'} 
          style={{ fontWeight: enable ? 'bold' : 'normal' }}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      width: 180,
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      align: 'center',
      width: 140,
      render: (protocol: string) => (
        <Tag color={
          protocol === 'vmess' ? 'blue' : 
          protocol === 'vless' ? 'green' : 
          protocol === 'trojan' ? 'purple' : 
          protocol === 'http' ? 'red' : 
          protocol === 'socks' ? 'cyan' : 
          protocol === 'shadowsocks' ? 'orange' : 'default'
        }>
          {protocol.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      align: 'center',
      width: 100,
      render: (port) => <Tag color="cyan" style={{ fontWeight: 'bold' }}>{port}</Tag>
    },
    {
      title: '流量统计',
      key: 'traffic',
      align: 'center',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tag color="blue">上传: {(record.up / 1024 / 1024).toFixed(2)} MB</Tag>
          <Tag color="green">下载: {(record.down / 1024 / 1024).toFixed(2)} MB</Tag>
        </Space>
      ),
    },
    {
      title: '到期时间',
      key: 'expiryTime',
      width: 180,
      render: (_, record) => (
        record.expiryTime ? 
          <span>{new Date(record.expiryTime).toLocaleString()}</span> : 
          <Tag color="green" style={{ fontWeight: 'bold' }}>永不过期</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => showDeleteConfirm(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const statsInfo = (
    <Space>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <InfoCircleOutlined style={{ marginRight: 5, color: '#1890ff' }} />
        总节点数: {nodes?.length || 0}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', marginLeft: 16 }}>
        <ClusterOutlined style={{ marginRight: 5, color: '#52c41a' }} />
        启用节点数: {nodes?.filter(node => node.enable)?.length || 0}
      </span>
    </Space>
  );

  return (
    <Card
      title={
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Breadcrumb
            items={[
              {
                title: <a onClick={() => navigate('/dashboard/agent-panel')}>代理面板管理</a>,
              },
              {
                title: '节点列表',
              },
            ]}
          />
          <Space direction="horizontal" size="middle" style={{ marginTop: 12 }}>
            <Button 
              type="primary" 
              ghost
              shape="round"
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/dashboard/agent-panel')}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              返回
            </Button>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginLeft: 8, 
              display: 'flex', 
              alignItems: 'center'
            }}>
              {panelInfo ? (
                <>
                  <GlobalOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  <span>{panelInfo.ip_address}</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>{panelInfo.username}</Tag>
                  <Tag color="purple" style={{ marginLeft: 4 }}>{panelInfo.panel_type}</Tag>
                </>
              ) : (
                '加载中...'
              )}
            </div>
          </Space>
        </Space>
      }
      extra={statsInfo}
      bordered={false}
      className="shadow-md"
      style={{ borderRadius: '8px' }}
      headStyle={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" gutter={16} align="middle">
          <Col>
            <Space>
              <Button 
                type="primary"
                onClick={() => {/* 添加节点功能待实现 */}}
              >
                添加节点
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchNodes()}
              >
                刷新
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="搜索备注"
                value={filters.remark}
                onChange={(e) => handleFilterChange('remark', e.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
              />
              <Select
                placeholder="协议"
                style={{ width: 120 }}
                value={filters.protocol}
                onChange={(value) => handleFilterChange('protocol', value)}
                allowClear
              >
                <Option value="vmess">VMESS</Option>
                <Option value="vless">VLESS</Option>
                <Option value="trojan">TROJAN</Option>
                <Option value="http">HTTP</Option>
                <Option value="socks">SOCKS</Option>
                <Option value="shadowsocks">SHADOWSOCKS</Option>
              </Select>
              <Select
                placeholder="状态"
                style={{ width: 100 }}
                value={filters.enable}
                onChange={(value) => handleFilterChange('enable', value === undefined ? null : value)}
                allowClear
              >
                <Option value={true}>启用</Option>
                <Option value={false}>禁用</Option>
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
        pagination={false}
        loading={loading}
        scroll={{ x: 1200 }}
        rowClassName={() => 'cursor-pointer hover:bg-gray-50'}
        bordered
      />
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', color: '#ff4d4f' }}>
            <DeleteOutlined style={{ marginRight: 8 }} />
            确认删除节点
          </div>
        }
        open={deleteModalVisible}
        onOk={handleDeleteNode}
        onCancel={handleDeleteCancel}
        confirmLoading={deleteLoading}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: '15px' }}>您确定要删除以下节点吗？</p>
          {nodeToDelete && (
            <div style={{ 
              background: '#f5f5f5', 
              padding: '12px 16px', 
              borderRadius: '4px',
              marginBottom: '16px',
              marginTop: '16px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                {nodeToDelete.remark} 
                {getProtocolTag(nodeToDelete.protocol)}
                <Tag color="cyan" style={{ marginLeft: 8 }}>{nodeToDelete.port}</Tag>
              </p>
            </div>
          )}
          <p style={{ color: '#ff4d4f' }}>
            <strong>警告：</strong>此操作不可逆，删除后节点数据将无法恢复。
          </p>
        </div>
      </Modal>
    </Card>
  );
};

export default NodeList; 