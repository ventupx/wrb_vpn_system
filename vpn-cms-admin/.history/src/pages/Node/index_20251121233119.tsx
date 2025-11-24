import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Modal, Select, message, Typography, Tag, Form, Checkbox, Row, Col } from 'antd';
import { ArrowLeftOutlined, CopyOutlined, QrcodeOutlined, GlobalOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import request from '@/utils/request';
import dayjs from 'dayjs';
import CryptoJS from 'crypto-js';
import QRCode from 'qrcode';
import type { EndpointNode } from '@/types/node';
import clipboardCopy from 'clipboard-copy';
const { Text } = Typography;
const { Option } = Select;

interface NodeInfo {
  id: number;
  order_id: number;
  user_id: number;
  remark: string;
  remark_custom: string;
  protocol: string;
  host_config: string;
  host: string;
  port: number;
  uuid: string | null;
  node_user: string | null;
  node_password: string;
  panel_id: number;
  panel_node_id: number | null;
  status: string;
  expiry_time: string;
  config_text: string;
  udp: boolean;
  udp_config: string | null;
  country?: string;
  udp_host?: string;
  udp_host_domain?: string;
}

interface SaveTransitResponse {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

const NodeList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const tradeNo = searchParams.get('trade_no');
  const [isTransitModalVisible, setIsTransitModalVisible] = useState(false);
  const [isPanelModalVisible, setIsPanelModalVisible] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodeList, setNodeList] = useState<NodeInfo[]>([]);
  const [inboundOptions, setInboundOptions] = useState<EndpointNode[]>([]);
  const [outboundOptions, setOutboundOptions] = useState<EndpointNode[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [form] = Form.useForm();
  const [panelForm] = Form.useForm();
  const [loadingNodeId, setLoadingNodeId] = useState<number | null>(null);
  const [panelLoadingNodeId, setPanelLoadingNodeId] = useState<number | null>(null);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [nodeOptions, setNodeOptions] = useState<{id: number; ip_address: string; port: number; panel_type: string; nodes_count: number; is_online: boolean}[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [isShareDetailModalVisible, setIsShareDetailModalVisible] = useState(false);
  const [currentShareNode, setCurrentShareNode] = useState<NodeInfo | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (orderId) {
      fetchNodeInfo();
    }
  }, [orderId]);

  // 监听节点列表变化，重置选择状态
  useEffect(() => {
    setSelectedNodeIds([]);
    setSelectAll(false);
    setIndeterminate(false);
  }, [nodeList]);

  const fetchNodeInfo = async () => {
    setLoading(true);
    try {
      const response = await request.get(`/payment-orders/${orderId}/node_info/`);
      setNodeList(response.data);
    } catch (error) {
      console.error('获取节点信息失败:', error);
      message.error('获取节点信息失败');
    }
    setLoading(false);
  };

  const fetchEndpoints = async (orderId: number) => {
    try {
      setTransitLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await request.get<any>('/accounts/order_endpoints/', {
        params: { order_id: orderId }
      });
      
      if (response.code === 200 && response.data) {
        setInboundOptions(response.data.inbounds);
        setOutboundOptions(response.data.outbounds);
      } else {
        message.error(response.message || '获取出入口数据失败');
      }
    } catch (error) {
      console.error('获取出入口数据失败:', error);
      message.error('获取出入口数据失败');
    } finally {
      setTransitLoading(false);
    }
  };

  const handleTransitConfig = async (node: NodeInfo) => {
    try {
      setLoadingNodeId(node.id);
      setCurrentNodeId(node.id);
      await fetchEndpoints(node.order_id);
      setIsTransitModalVisible(true);
    } finally {
      setLoadingNodeId(null);
    }
  };

  const handleTransitSubmit = async () => {
    try {
      if (!currentNodeId) {
        message.error('节点ID不存在');
        return;
      }

      const values = await form.validateFields();
      setTransitLoading(true);
      
      // 解析选中的入口和出口节点数据
      const inbound = JSON.parse(values.entryNode);
      const outbound = JSON.parse(values.exitNode);
      
      const response = await request.post<SaveTransitResponse>('/accounts/save_transit/', {
        data: {
          order_id: orderId,
          node_id: currentNodeId,
          inbound,
          outbound
        }
      });
      
      if (response.code === 200) {
        message.success('中转配置保存成功');
        setIsTransitModalVisible(false);
        // 重新获取节点列表
        fetchNodeInfo();
      } else {
        message.error(response.message || '保存中转配置失败');
      }
    } catch (error) {
      console.error('保存中转配置失败:', error);
      if (error instanceof Error) {
        message.error(error.message || '保存中转配置失败');
      } else {
        message.error('保存中转配置失败');
      }
    } finally {
      setTransitLoading(false);
    }
  };

  const handlePanelConfig = async (node: NodeInfo) => {
    try {
      console.log('当前节点数据:', node);
      setPanelLoadingNodeId(node.id);
      setCurrentNodeId(node.id);
      
      // 调用获取国家列表的接口
      const response = await request.get('/agent-panel/countries/');
      if (response.code === 200 && response.data) {
        setCountryOptions(response.data);
        
        // 保存当前国家值，用于后续获取节点列表
        let currentCountry = '';
        
        // 回显当前节点的国家字段
        if (node.country && response.data.includes(node.country)) {
          currentCountry = node.country;
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
        
        setIsPanelModalVisible(true);
      } else {
        message.error(response.message || '获取国家列表失败');
        setCountryOptions([]);
        setIsPanelModalVisible(true);
      }
    } catch (error) {
      console.error('获取国家列表失败:', error);
      message.error('获取国家列表失败');
      setCountryOptions([]);
      setIsPanelModalVisible(true);
    } finally {
      setPanelLoadingNodeId(null);
    }
  };

  const handelNodeActive = async (node: NodeInfo) => {
    const response = await request.post('/agent-panel/check_node_status/', {
      data: {
        node_id: node.id
      }
    });
    if (response.code === 200) {
      message.success(response.message || '节点激活成功');
      fetchNodeInfo();
    } else {
      message.error(response.message || '节点激活失败');
    }
  };

  // 解析中转地址和端口
  const parseTransitInfo = (node: NodeInfo) => {
    // 优先使用udp_host_domain，如果没有再使用udp_host
    let transitHost = '';
    
    if (node.udp_host_domain && node.udp_host_domain.trim()) {
      transitHost = node.udp_host_domain.trim();
    } else if (node.udp_host && node.udp_host.trim()) {
      transitHost = node.udp_host.trim();
    }
    
    if (transitHost) {
      // 检查是否包含端口号（格式：ip:port 或 domain:port）
      if (transitHost.includes(':')) {
        const parts = transitHost.split(':');
        const host = parts[0];
        const port = parseInt(parts[1], 10);
        
        if (!isNaN(port)) {
          return { host, port };
        }
      }
      
      // 如果中转地址没有端口，使用原端口
      return { host: transitHost, port: node.port };
    }
    
    // 没有中转配置，返回原始地址
    return { host: node.host, port: node.port };
  };
  // 解析中转地址和端口
  const parseTransitInfoHost = (node: NodeInfo) => {
    // 优先使用udp_host_domain，如果没有再使用udp_host
    let transitHost = '';
    
    if (node.udp_host && node.udp_host.trim()) {
      transitHost = node.udp_host.trim();
    }
    
    if (transitHost) {
      // 检查是否包含端口号（格式：ip:port 或 domain:port）
      if (transitHost.includes(':')) {
        const parts = transitHost.split(':');
        const host = parts[0];
        const port = parseInt(parts[1], 10);
        
        if (!isNaN(port)) {
          return { host, port };
        }
      }
      
      // 如果中转地址没有端口，使用原端口
      return { host: transitHost, port: node.port };
    }
    
    // 没有中转配置，返回原始地址
    return { host: node.host, port: node.port };
  };
  const getHost = (data: NodeInfo) => {
    if (data.udp_host_domain) {
      return {host:data.udp_host_domain.split(":")[0],port:data.udp_host_domain.split(":")[1]};
    }
    if (data.udp_host) {
      return {host:data.udp_host.split(":")[0],port:data.udp_host.split(":")[1]};
    }
    return {host:data.host,port:data.port};
  }

  // 生成分享链接
  const generateShareUrl = (node: NodeInfo, sequenceNumber: number | null = null) => {
    const { protocol, node_password, uuid, expiry_time } = node;
    let hosts = getHost(node).host;
    let ports = getHost(node).port;
  
    
    // 格式化到期时间为年月日
    const expiryDate = expiry_time ? expiry_time.split('T')[0] : '';
    let nodeDisplayName = expiryDate ? `${node.country}${expiryDate.split('-')[1]}-${expiryDate.split('-')[2]}` : node.country;
    
    // 如果有序号，添加到显示名称末尾
    if (sequenceNumber !== null && sequenceNumber >1) {
      nodeDisplayName += `-${sequenceNumber}`;
    }
    
    switch(protocol.toLowerCase()) {
      case 'shadowsocks': {
        const ssConfig = `2022-blake3-aes-256-gcm:${node_password}:${node_password}`;
        return `ss://${CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(ssConfig))}@${hosts}:${ports}?type=tcp#${nodeDisplayName}`;
      }
      case 'vmess': {
        const vmessConfig = {
          "v": "2",
          "ps": nodeDisplayName,
          "add": hosts,
          "port": String(ports),
          "id": uuid,
          "aid": "0",
          "net": "tcp",
          "type": "none",
          "host": "",
          "path": "",
          "tls": ""
        };
        const vmessStr = JSON.stringify(vmessConfig);
        return `vmess://${CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(vmessStr))}`;
      }
      case 'vless':
        return `vless://${uuid}@${hosts}:${ports}?encryption=none&security=none&type=tcp#${nodeDisplayName}`;
      default:
        return '';
    }
  };

  // 检查协议是否支持生成分享链接
  const isLinkShareableProtocol = (protocol: string) => {
    const shareableProtocols = ['shadowsocks', 'vmess', 'vless'];
    return shareableProtocols.includes(protocol.toLowerCase());
  };

  // 生成二维码
  const generateQRCode = async (text: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return dataUrl;
    } catch (error) {
      console.error('生成二维码失败:', error);
      // 如果QRCode库不可用，返回空字符串
      return '';
    }
  };

  // 获取可分享的节点列表
  const getShareableNodes = () => {
    return nodeList.filter(node => isLinkShareableProtocol(node.protocol));
  };

  // 处理单个节点选择
  const handleNodeSelect = (nodeId: number, checked: boolean) => {
    const newSelectedIds = checked 
      ? [...selectedNodeIds, nodeId]
      : selectedNodeIds.filter(id => id !== nodeId);
    
    setSelectedNodeIds(newSelectedIds);
    updateSelectAllState(newSelectedIds);
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    const shareableNodes = getShareableNodes();
    const newSelectedIds = checked ? shareableNodes.map(node => node.id) : [];
    
    setSelectedNodeIds(newSelectedIds);
    setSelectAll(checked);
    setIndeterminate(false);
  };

  // 更新全选状态
  const updateSelectAllState = (selectedIds: number[]) => {
    const shareableNodes = getShareableNodes();
    const shareableNodeIds = shareableNodes.map(node => node.id);
    
    if (selectedIds.length === 0) {
      setSelectAll(false);
      setIndeterminate(false);
    } else if (selectedIds.length === shareableNodeIds.length) {
      setSelectAll(true);
      setIndeterminate(false);
    } else {
      setSelectAll(false);
      setIndeterminate(true);
    }
  };

  // 批量导出URL
  const handleBatchExport = () => {
    const selectedNodes = nodeList.filter(node => selectedNodeIds.includes(node.id));
    const urls = selectedNodes.map((node,index) => generateShareUrl(node, index+1)).filter(url => url);
    
    if (urls.length === 0) {
      message.warning('没有可导出的节点链接');
      return;
    }
    
    const urlText = urls.join('\n');
    clipboardCopy(urlText).then(() => {
      message.success('分享链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制到剪贴板失败');
    });
  };

  // 单个节点分享 - 显示详情模态框
  const handleSingleShare = async (node: NodeInfo) => {
    setCurrentShareNode(node);
    
    // 如果协议支持链接分享，生成二维码
    if (isLinkShareableProtocol(node.protocol)) {
      const url = generateShareUrl(node);
      if (url) {
        const qrCode = await generateQRCode(url);
        setQrCodeDataUrl(qrCode);
      }
    } else {
      // 对于 http 和 socks 协议，不生成二维码
      setQrCodeDataUrl('');
    }
    
    setIsShareDetailModalVisible(true);
  };

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

  const handlePanelSubmit = async () => {
    try {
      if (!currentNodeId) {
        message.error('节点ID不存在');
        return;
      }

      const values = await panelForm.validateFields();
      setPanelLoading(true);
      
      // 调用面板调节保存接口
      const response = await request.post('/change-node-panel/', {
        data: {
          node_id: currentNodeId,
          panel_id: values.node
        }
      });
      
      if (response.code === 200) {
        console.log('面板调节提交的数据:', values);
        message.success(response.message || '面板调节设置成功');
        setIsPanelModalVisible(false);
        // 重新获取节点列表
        fetchNodeInfo();
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

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      active: { color: 'success', text: '运行中' },
      pending: { color: 'processing', text: '待激活' },
      disabled: { color: 'error', text: '已停用' },
      expired: { color: 'warning', text: '已过期' }
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const getProtocolTag = (protocol: string) => {
    const protocolMap: Record<string, { color: string }> = {
      'Shadowsocks': { color: 'blue' },
      'VMess': { color: 'green' },
      'Trojan': { color: 'purple' }
    };
    const protocolInfo = protocolMap[protocol] || { color: 'default' };
    return <Tag color={protocolInfo.color}>{protocol}</Tag>;
  };

  const columns = [
    {
      title: (
        <Checkbox
          indeterminate={indeterminate}
          onChange={(e) => handleSelectAll(e.target.checked)}
          checked={selectAll}
        >
          全选
        </Checkbox>
      ),
      dataIndex: 'select',
      key: 'select',
      width: 80,
      render: (_: unknown, record: NodeInfo) => (
        <Checkbox
          checked={selectedNodeIds.includes(record.id)}
          disabled={!isLinkShareableProtocol(record.protocol)}
          onChange={(e) => handleNodeSelect(record.id, e.target.checked)}
        />
      )
    },
    {
      title: '节点信息',
      key: 'info',
      render: (_: unknown, record: NodeInfo) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.remark || '未命名节点'}</Text>
          {record.remark_custom && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.remark_custom}</Text>
          )}
        </Space>
      )
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => getProtocolTag(protocol)
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      render: (host: string, record: NodeInfo) => (
        <Space>
          <Text copyable={{ text: `${host}:${record.port}` }}>
            {host}:{record.port}
          </Text>
        </Space>
      )
    },
    {
      title: '中转地址',
      dataIndex: 'udp_host',
      key: 'udp_host',
      render: (udp_host: string) => (
        <Space>
          <Text copyable={{ text: `${udp_host}` }}>
            {udp_host}
          </Text>
        </Space>
      )
    },
    {
      title: '中转域名地址',
      dataIndex: 'udp_host_domain',
      key: 'udp_host_domain',
      render: (udp_host_domain: string) => (
        <Space>
          <Text copyable={{ text: `${udp_host_domain}` }}>
            {udp_host_domain}
          </Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '过期时间',
      dataIndex: 'expiry_time',
      key: 'expiry_time',
      render: (time: string) => (
        <Text type={dayjs(time).isBefore(dayjs()) ? 'danger' : undefined}>
          {dayjs(time).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: NodeInfo) => (
        <Space size="middle">
          <Button 
            type="link" 
            onClick={() => handleTransitConfig(record)}
            loading={loadingNodeId === record.id}
          >
            {loadingNodeId === record.id ? '' : '中转调节'}
          </Button>
          <Button 
            type="link" 
            onClick={() => handlePanelConfig(record)}
            loading={panelLoadingNodeId === record.id}
          >
            {panelLoadingNodeId === record.id ? '' : '面板调节'}
          </Button>
          <Button 
            type="link" 
            onClick={() => handelNodeActive(record)}
            loading={panelLoadingNodeId === record.id}
          >
            激活节点
          </Button>
          <Button 
            type="link" 
            icon={<QrcodeOutlined />}
            onClick={() => handleSingleShare(record)}
          >
            分享
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
            <Space>
              <span>节点详情</span>
              {tradeNo && (
                <Text type="secondary" copyable>
                  订单号: {tradeNo}
                </Text>
              )}
            </Space>
            {selectedNodeIds.length > 0 && (
              <Button 
                type="primary"
                icon={<CopyOutlined />}
                onClick={handleBatchExport}
              >
                批量导出 ({selectedNodeIds.length})
              </Button>
            )}
          </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={nodeList}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      </Card>

      <Modal
        title="配置中转出入口"
        open={isTransitModalVisible}
        onOk={handleTransitSubmit}
        onCancel={() => setIsTransitModalVisible(false)}
        confirmLoading={transitLoading}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="entryNode"
            label="入口节点"
            rules={[{ required: true, message: '请选择入口节点' }]}
          >
            <Select
              placeholder="请选择入口节点"
              loading={transitLoading}
              options={inboundOptions.map(node => ({
                label: node.name,
                value: JSON.stringify(node)
              }))}
            />
          </Form.Item>

          <Form.Item
            name="exitNode"
            label="出口节点"
            rules={[{ required: true, message: '请选择出口节点' }]}
          >
            <Select
              placeholder="请选择出口节点"
              loading={transitLoading}
              options={outboundOptions.map(node => ({
                label: node.name,
                value: JSON.stringify(node)
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

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

      <Modal
        title="节点连接信息"
        open={isShareDetailModalVisible}
        onCancel={() => setIsShareDetailModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            if (currentShareNode && isLinkShareableProtocol(currentShareNode.protocol)) {
              const url = generateShareUrl(currentShareNode);
              if (url) {
                navigator.clipboard.writeText(url).then(() => {
                  message.success('节点链接已复制到剪贴板');
                }).catch(() => {
                  message.error('复制失败');
                });
              }
            }
          }} disabled={!currentShareNode || !isLinkShareableProtocol(currentShareNode.protocol)}>
            复制链接
          </Button>,
          <Button key="close" onClick={() => setIsShareDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
        style={{ top: 20 }}
      >
        {currentShareNode && (
          <div style={{ padding: '20px 0' }}>
            {/* 二维码区域 - 仅对支持链接分享的协议显示 */}
            {isLinkShareableProtocol(currentShareNode.protocol) && (
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '30px',
                padding: '20px',
                backgroundColor: '#fafafa',
                borderRadius: '8px',
                border: '1px solid #f0f0f0'
              }}>
                <Typography.Title level={4} style={{ marginBottom: '16px', color: '#1890ff' }}>
                  扫码连接
                </Typography.Title>
                {qrCodeDataUrl ? (
                  <div style={{ display: 'inline-block' }}>
                    <img 
                      src={qrCodeDataUrl} 
                      alt="连接二维码" 
                      style={{ 
                        width: '180px',
                        height: '180px',
                        border: '3px solid #fff',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        background: '#fff'
                      }} 
                    />
                    <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                      使用客户端扫描上方二维码
                    </div>
                  </div>
                ) : (
                  <div style={{
                    width: '180px',
                    height: '180px',
                    border: '2px dashed #d9d9d9',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontSize: '14px',
                    backgroundColor: '#fff'
                  }}>
                    二维码生成中...
                  </div>
                )}
              </div>
            )}

            {/* 对于不支持链接分享的协议，显示提示信息 */}
            {!isLinkShareableProtocol(currentShareNode.protocol) && (
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '30px',
                padding: '20px',
                backgroundColor: '#f6ffed',
                borderRadius: '8px',
                border: '1px solid #d9f7be'
              }}>
                <Typography.Title level={4} style={{ marginBottom: '8px', color: '#52c41a' }}>
                  节点连接信息
                </Typography.Title>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  请使用下方信息手动配置客户端连接
                </div>
              </div>
            )}

            {/* 信息区域 - 分两列显示 */}
            <Row gutter={[24, 16]}>
              <Col span={12}>
                <Card 
                  title={
                    <span>
                      <GlobalOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                      连接信息
                    </span>
                  } 
                  size="small" 
                  style={{ height: '100%' }}
                  headStyle={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #e1f5fe' }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {(() => {
                      const { host, port } = parseTransitInfoHost(currentShareNode);
                      const isUsingTransit = currentShareNode.udp_host && currentShareNode.udp_host.trim();
                      
                      return (
                        <>
                          <div>
                            <Text strong style={{ color: '#1890ff' }}>
                              {isUsingTransit ? '中转地址' : '服务器地址'}
                            </Text>
                            <br />
                            <Text code style={{ fontSize: '13px' }}>{host}</Text>
                            <Text code style={{ fontSize: '13px' }}>{currentShareNode?.udp_host_domain.split(":")[0]}</Text>
                            {isUsingTransit && (
                              <Tag color="orange" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                中转
                              </Tag>
                            )}
                          </div>
                          <div>
                            <Text strong style={{ color: '#1890ff' }}>
                              {isUsingTransit ? '中转端口' : '端口'}
                            </Text>
                            <br />
                            <Text code style={{ fontSize: '13px' }}>{port}</Text>
                          </div>
                          <div>
                            <Text strong style={{ color: '#1890ff' }}>协议类型</Text>
                            <br />
                            <Tag color="blue" style={{ fontSize: '12px' }}>{currentShareNode.protocol}</Tag>
                          </div>
                        </>
                      );
                    })()}
                  </Space>
                </Card>
              </Col>
              
              <Col span={12}>
                <Card 
                  title={
                    <span>
                      <SafetyOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                      认证信息
                    </span>
                  } 
                  size="small" 
                  style={{ height: '100%' }}
                  headStyle={{ backgroundColor: '#f6ffed', borderBottom: '1px solid #d9f7be' }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text strong style={{ color: '#52c41a' }}>
                        {isLinkShareableProtocol(currentShareNode.protocol) ? '加密方式' : '用户名'}
                      </Text>
                      <br />
                      <Text code style={{ fontSize: '13px' }}>
                        {isLinkShareableProtocol(currentShareNode.protocol) 
                          ? (currentShareNode.protocol === 'shadowsocks' ? '2022-blake3-aes-256-gcm' : '无/Auto')
                          : (currentShareNode.node_user || '无')
                        }
                      </Text>
                    </div>
                    <div>
                      <Text strong style={{ color: '#52c41a' }}>
                        {isLinkShareableProtocol(currentShareNode.protocol) ? 'UUID/密钥' : '密码'}
                      </Text>
                      <br />
                      <Text code style={{ fontSize: '13px', wordBreak: 'break-all' }}>
                        {isLinkShareableProtocol(currentShareNode.protocol) 
                          ? (currentShareNode.uuid || currentShareNode.node_password || '无')
                          : currentShareNode.node_password
                        }
                      </Text>
                    </div>
                    {currentShareNode.country && (
                      <div>
                        <Text strong style={{ color: '#52c41a' }}>地区</Text>
                        <br />
                        <Tag color="green" style={{ fontSize: '12px' }}>{currentShareNode.country}</Tag>
                      </div>
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>

            {/* 如果使用了中转，显示原始服务器信息 */}
            {currentShareNode.udp_host && currentShareNode.udp_host.trim() && (
              <Card 
                title={
                  <span>
                    <GlobalOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                    原始服务器信息
                  </span>
                } 
                size="small" 
                style={{ marginTop: '16px' }}
                headStyle={{ backgroundColor: '#fff2e8', borderBottom: '1px solid #ffd8bf' }}
              >
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text strong style={{ color: '#fa8c16' }}>原始地址：</Text>
                    <Text code style={{ fontSize: '12px' }}>{currentShareNode.host}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ color: '#fa8c16' }}>原始端口：</Text>
                    <Text code style={{ fontSize: '12px' }}>{currentShareNode.port}</Text>
                  </Col>
                </Row>
                <div style={{ marginTop: '8px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                  💡 实际连接使用上方的中转地址和端口
                </div>
              </Card>
            )}

            {/* 分享链接区域 - 仅对支持的协议显示 */}
            {isLinkShareableProtocol(currentShareNode.protocol) && (
              <Card 
                title={
                  <span>
                    <CopyOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                    分享链接
                  </span>
                } 
                size="small" 
                style={{ marginTop: '16px' }}
                headStyle={{ backgroundColor: '#f6ffed', borderBottom: '1px solid #d9f7be' }}
              >
                <Typography.Paragraph 
                  copyable={{ 
                    text: generateShareUrl(currentShareNode),
                    tooltips: ['点击复制', '复制成功！']
                  }}
                  style={{ 
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    backgroundColor: '#f8f8f8',
                    padding: '12px',
                    borderRadius: '6px',
                    margin: 0,
                    border: '1px solid #e8e8e8',
                    fontFamily: 'Monaco, Consolas, monospace'
                  }}
                >
                  {generateShareUrl(currentShareNode)}
                </Typography.Paragraph>
                <div style={{ marginTop: '8px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                  💡 点击右侧复制图标可快速复制链接
                </div>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NodeList; 