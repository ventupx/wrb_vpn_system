import React, { useState, useEffect } from 'react';
import { Card, Space, Button, Breadcrumb, Row, Col, Progress, Statistic, Tag, Divider, Typography, Tooltip, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftOutlined, 
  GlobalOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  CloudServerOutlined,
  CodeOutlined,
  HddOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const { Text } = Typography;

interface PanelInfo {
  id: number;
  ip_address: string;
  username: string;
  panel_type: 'x-ui' | '3x-ui';
}

interface SystemStatus {
  cpu: number;
  cpuCores: number;
  logicalPro: number;
  cpuSpeedMhz: number;
  mem: {
    current: number;
    total: number;
  };
  swap: {
    current: number;
    total: number;
  };
  disk: {
    current: number;
    total: number;
  };
  xray: {
    state: string;
    errorMsg: string;
    version: string;
  };
  uptime: number;
  loads: number[];
  tcpCount: number;
  udpCount: number;
  netIO: {
    up: number;
    down: number;
  };
  netTraffic: {
    sent: number;
    recv: number;
  };
  publicIP: {
    ipv4: string;
    ipv6: string;
  };
  appStats: {
    threads: number;
    mem: number;
    uptime: number;
  };
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const SystemStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [panelInfo, setPanelInfo] = useState<PanelInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPanelInfo();
    fetchSystemStatus();
  }, [id]);

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

  const fetchSystemStatus = async () => {
    setLoading(true);
    try {
      const response = await request.get<SystemStatus>(`/agent-panel/${id}/status/`);
      
      if (response.code === 200 && response.data) {
        setSystemStatus(response.data);
      } else {
        message.error(response.message || '获取系统状态失败');
      }
    } catch (error) {
      console.error('获取系统状态失败:', error);
      message.error(error instanceof Error ? error.message : '获取系统状态失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshSystemStatus = () => {
    fetchSystemStatus();
  };

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
                title: '系统状态',
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
      extra={
        <Button 
          type="default" 
          icon={<SyncOutlined />} 
          onClick={refreshSystemStatus}
          loading={loading}
        >
          刷新数据
        </Button>
      }
      bordered={false}
      className="shadow-md"
      style={{ borderRadius: '8px' }}
      headStyle={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}
      loading={loading}
    >
      {systemStatus && (
        <>
          {/* 资源使用率卡片 */}
          <Card 
            className="shadow-sm" 
            bordered={false} 
            style={{ borderRadius: '8px', marginBottom: '20px' }}
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} md={6}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="dashboard"
                    percent={Number((systemStatus.cpu).toFixed(2))}
                    size={120}
                    strokeColor={systemStatus.cpu > 80 ? '#ff4d4f' : '#52c41a'}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>CPU ({systemStatus.cpuCores}核心/{systemStatus.logicalPro}线程)</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="dashboard"
                    percent={Math.round(systemStatus.mem.current / systemStatus.mem.total * 100)}
                    size={120}
                    strokeColor={systemStatus.mem.current / systemStatus.mem.total > 0.8 ? '#ff4d4f' : '#1890ff'}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>内存: {formatBytes(systemStatus.mem.current)} / {formatBytes(systemStatus.mem.total)}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="dashboard"
                    percent={systemStatus.swap.total ? Math.round(systemStatus.swap.current / systemStatus.swap.total * 100) : 0}
                    size={120}
                    strokeColor="#faad14"
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>swap: {formatBytes(systemStatus.swap.current)} / {formatBytes(systemStatus.swap.total)}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="dashboard"
                    percent={Math.round(systemStatus.disk.current / systemStatus.disk.total * 100)}
                    size={120}
                    strokeColor={systemStatus.disk.current / systemStatus.disk.total > 0.8 ? '#ff4d4f' : '#13c2c2'}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>硬盘: {formatBytes(systemStatus.disk.current)} / {formatBytes(systemStatus.disk.total)}</Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* 面板信息卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card 
                title={<><CodeOutlined /> 面板版本信息</>} 
                className="shadow-sm" 
                bordered={false} 
                style={{ borderRadius: '8px', height: '100%' }}
              >
                <Row gutter={[16, 16]}>
                  
                  <Col span={12}>
                    <Statistic 
                      title="Xray" 
                      value={systemStatus.xray.version} 
                      prefix={<ApiOutlined />} 
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: '16px 0' }} />
                <div>
                  <Text strong>系统负载: </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: '16px', color: '#1890ff' }}>
                    {systemStatus.loads.join(' | ')}
                  </Text>
                  <Tooltip title="系统1分钟、5分钟、15分钟的平均负载">
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#8c8c8c' }} />
                  </Tooltip>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card 
                title={<><DashboardOutlined /> 运行信息</>} 
                className="shadow-sm" 
                bordered={false} 
                style={{ borderRadius: '8px', height: '100%' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic 
                      title="Xray 状态" 
                      value={systemStatus.xray.state === 'running' ? "运行中" : "已停止"} 
                      prefix={systemStatus.xray.state === 'running' ? <CheckCircleOutlined /> : <ClockCircleOutlined />} 
                      valueStyle={{ color: systemStatus.xray.state === 'running' ? '#52c41a' : '#ff4d4f', fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic 
                      title="运行时间" 
                      value={`${Math.floor(systemStatus.uptime / 86400)} 天`} 
                      prefix={<FieldTimeOutlined />} 
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Divider style={{ margin: '16px 0' }} />
                    <Text strong>
                      tcp / udp 连接数: {systemStatus.tcpCount} / {systemStatus.udpCount}
                    </Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* 流量统计卡片 */}
          <Card 
            title={<><HddOutlined /> 网络流量</>} 
            className="shadow-sm" 
            bordered={false} 
            style={{ borderRadius: '8px', marginTop: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic 
                  title="上行速率" 
                  value={`${formatBytes(systemStatus.netIO.up)}/S`} 
                  prefix="↑" 
                  valueStyle={{ color: '#1890ff', fontSize: '18px' }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic 
                  title="下行速率" 
                  value={`${formatBytes(systemStatus.netIO.down)}/S`} 
                  prefix="↓" 
                  valueStyle={{ color: '#52c41a', fontSize: '18px' }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic 
                  title="总接收流量" 
                  value={formatBytes(systemStatus.netTraffic.recv)}
                  valueStyle={{ fontSize: '16px' }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic 
                  title="总发送流量" 
                  value={formatBytes(systemStatus.netTraffic.sent)}
                  valueStyle={{ fontSize: '16px' }}
                />
              </Col>
            </Row>
          </Card>
        </>
      )}
    </Card>
  );
};

export default SystemStatusPage; 