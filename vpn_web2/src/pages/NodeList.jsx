import { Card, Tag, Button, Tooltip, Space, message, Modal, QRCode, Select, DatePicker, Radio, Input, Checkbox, Row, Col, Spin, Pagination, Tabs } from 'antd';
import {
  ClockCircleOutlined,
  GlobalOutlined,
  CopyOutlined,
  WalletOutlined,
  SearchOutlined,
  EditOutlined,
  LinkOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import { useSetAtom } from 'jotai';
import { balanceAtom } from '../jotai';
import CryptoJS from 'crypto-js';
import clipboardCopy from 'clipboard-copy';

const { TabPane } = Tabs;

const NodeList = () => {
  const setBalance = useSetAtom(balanceAtom);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRemarkModalVisible, setIsRemarkModalVisible] = useState(false);
  const [currentNode, setCurrentNode] = useState(null);
  const [remarkValue, setRemarkValue] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [isRenewModalVisible, setIsRenewModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('balance');
  const [pollingInterval, setPollingInterval] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const getHost = (data) => {
    if (data.udp_host_domain) {
      return {host:data.udp_host_domain.split(":")[0],port:data.udp_host_domain.split(":")[1]};
    }
    if (data.udp_host) {
      return {host:data.udp_host.split(":")[0],port:data.udp_host.split(":")[1]};
    }
    return {host:data.host,port:data.port};
  }
  const generateShareLink = (node, sequenceNumber = null) => {
    const { protocol, node_password, uuid } = node;
    let hosts = getHost(node).host;
    let ports = getHost(node).port;
    // 格式化到期时间为简单的日期格式
    const formatExpiryDate = (isoString) => {
      const date = new Date(isoString);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    };
    
    let displayName = `${node.country || 'Unknown'}${formatExpiryDate(node.expiry_time)}`;
    // 如果有序号，添加到displayName末尾
    if (sequenceNumber !== null && sequenceNumber > 0) {
      displayName += `-${sequenceNumber}`;
    }
    
    switch(protocol.toLowerCase()) {
      case 'shadowsocks': {
        const ssConfig = `aes-256-gcm:${node_password}@${hosts}:${ports}`;
        return `ss://${CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(ssConfig))}#${displayName}`;
      }
      case 'vmess': {
        const vmessConfig = {
          "v": "2",
          "ps": displayName,
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
        return `vless://${uuid}@${hosts}:${ports}?encryption=none&security=none&type=tcp#${displayName}`;
      default:
        return '';
    }
  };

  const showNodeInfo = (node) => {
    setCurrentNode(node);
    setIsModalVisible(true);
  };

  const showRemarkModal = (node) => {
    setCurrentNode(node);
    setRemarkValue(node.remark_custom || '');
    setIsRemarkModalVisible(true);
  };

  const handleRenew = (node) => {
    setCurrentNode(node);
    setIsRenewModalVisible(true);
  };

  const handlePayment = async () => {
    try {
      if (selectedPaymentMethod === 'balance') {
        const response = await request.post("/node/renewal/", {
          "node_id": currentNode.key,
        });
        if (response.code === 200 || response.code === 1) {
          if (selectedPaymentMethod === 'balance') {
            message.success(response.message || '续费成功');
            setIsRenewModalVisible(false);
            fetchNodes();
            const yueResponse = await request.get(`/user-balance/`);
            if (yueResponse.code === 200) {
              setBalance(yueResponse.data.balance);
            }
          } else {
            const qrUrl = response.qrcode || response.payurl || response.pay_url;
            setQrCodeUrl(qrUrl);
            startPolling(response.order_no);
          }
        } else {
          message.error(response.message || '支付请求失败');
        }
      } else {
        return;
      }
    } catch (error) {
      console.error('支付请求出错:', error);
      message.error('支付请求失败，请重试');
    }
  };
  function formatISODate(isoString) {
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
  const startPolling = (orderId) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    const interval = setInterval(async () => {
      try {
        const response = await request.get(`/payment/status/?order_no=${orderId}`);
        if (response.code === 200 && response.data.status === 'success') {
          clearInterval(interval);
          message.success('支付成功');
          setIsRenewModalVisible(false);
          fetchNodes();
        } else if (response.data.status === 'failed') {
          clearInterval(interval);
          message.error('支付失败');
        }
      } catch (error) {
        console.error('查询支付状态失败:', error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleModalClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    setIsRenewModalVisible(false);
    setQrCodeUrl('');
  };

  const handleUpdateRemark = async () => {
    try {
      const response = await request.post(`/customers/${currentNode.key}/update_node_remark/`, {
        remark_custom: remarkValue
      });
      
      if (response.code === 200) {
        message.success('备注更新成功');
        setIsRemarkModalVisible(false);
        fetchNodes(); // 刷新节点列表
      } else {
        message.error(response.message || '备注更新失败');
      }
    } catch (error) {
      console.error('更新备注出错:', error);
      message.error('备注更新失败');
    }
  };
  const searchNodes = async () => {
    setLoading(true);
    try {
      setCurrentPage(1);
      setPageSize(20);
      const response = await request.get(`/customers/nodes/?page=1&page_size=${pageSize}&country=${selectedCountry?selectedCountry:''}&start_date=${dateRange?dateRange[0].format('YYYY-MM-DD'):''}&end_date=${dateRange?dateRange[1].format('YYYY-MM-DD'):''}&order_no=${searchQuery?searchQuery:''}`);
      if (response.results) {
        const formattedNodes = response.results.data.map(node => ({
          key: node.id,
          name: node.remark,
          remark_custom: node.remark_custom,
          country: node.country,
          status: node.status,
          expireDate: node.expiry_time,
          protocol: node.protocol,
          host: node.host,
          port: node.port,
          nodeType: node.node_type,
          node_username: node.node_user,
          node_password: node.node_password,
          udp_host: node.udp_host,
          uuid: node.uuid,
          udp: node.udp,
          expiry_time:node.expiry_time,
          created_at: node.created_at,
          ...node
        }));
        setNodes(formattedNodes);
        setTotalCount(response.count);
        
        setFilteredNodes(formattedNodes);
      } else {
        setNodes([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('获取节点列表出错:', error);
      message.error('获取节点列表失败');
    } finally {
      setLoading(false);
    }
  }

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const response = await request.get(`/customers/nodes/?page=${currentPage}&page_size=${pageSize}&country=${selectedCountry?selectedCountry:''}&start_date=${dateRange?dateRange[0].format('YYYY-MM-DD'):''}&end_date=${dateRange?dateRange[1].format('YYYY-MM-DD'):''}&order_no=${searchQuery?searchQuery:''}`);
      // 处理新的分页响应格式
      // 注意：响应格式已更改，现在是 {count, next, previous, results: {code, message, data}}
      if (response.results) {
        setTotalCount(response.count);
        const formattedNodes = response.results.data.map(node => ({
          key: node.id,
          name: node.remark,
          remark_custom: node.remark_custom,
          country: node.country,
          status: node.status,
          expireDate: node.expiry_time,
          protocol: node.protocol,
          host: node.host,
          port: node.port,
          nodeType: node.node_type,
          node_username: node.node_user,
          node_password: node.node_password,
          udp_host: node.udp_host,
          uuid: node.uuid,
          udp: node.udp,
          expiry_time: node.expiry_time,
          created_at: node.created_at,
          trade_no: node.trade_no,
          ...node
        }));
        setNodes(formattedNodes);
        setFilteredNodes(formattedNodes);
      } else {
        setNodes([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('获取节点列表出错:', error);
      message.error('获取节点列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSelected = () => {
    if (selectedKeys.length === 0) {
      message.warning('请先选择要导出的节点');
      return;
    }

    const selectedNodes = nodes.filter(node => selectedKeys.includes(node.key));
    
    // 按订单号分组，统计每个订单号的数量
    const tradeNoGroups = {};
    selectedNodes.forEach(node => {
      const tradeNo = node.trade_no || 'no_trade_no';
      if (!tradeNoGroups[tradeNo]) {
        tradeNoGroups[tradeNo] = [];
      }
      tradeNoGroups[tradeNo].push(node);
    });
    
    // 生成分享链接，为同一订单号的节点添加序号
    const shareLinks = [];
    Object.values(tradeNoGroups).forEach(nodesGroup => {
      nodesGroup.forEach((node, index) => {
        // 如果同一订单号有多个节点，从第二个开始添加序号
        const sequenceNumber = nodesGroup.length > 1 ? index + 1 : null;
        const shareLink = generateShareLink(node, sequenceNumber);
        if (shareLink) {
          shareLinks.push(shareLink);
        }
      });
    });
    
    if (shareLinks.length > 0) {
      const text = shareLinks.join('\n');
      clipboardCopy(text).then(() => {
        message.success('分享链接已复制到剪贴板');
      }).catch(() => {
        message.error('复制到剪贴板失败');
      });
    } else {
      message.warning('所选节点中没有可导出的分享链接');
    }
  };

  const handleSelectNode = (nodeKey) => {
    const isSelected = selectedKeys.includes(nodeKey);
    if (isSelected) {
      setSelectedKeys(selectedKeys.filter(key => key !== nodeKey));
    } else {
      setSelectedKeys([...selectedKeys, nodeKey]);
    }
  };

  const isNodeSelectable = (protocol) => {
    return ['shadowsocks', 'vmess', 'vless'].includes(protocol.toLowerCase());
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const getNodeTypeText = (nodeType) => {
    if (nodeType === 'live') return '直播';
    if (nodeType === 'normal') return '普通';
    if (nodeType === 'transit') return '视频';
    return '未知';
  };

  const getProtocolIcon = (protocol) => {
    switch(protocol.toLowerCase()) {
      case 'shadowsocks':
        return 'S';
      case 'vmess':
        return 'V';
      case 'vless':
        return 'L';
      default:
        return 'U';
    }
  };

  useEffect(() => {
    fetchNodes();
  }, [pageSize,currentPage]);

  // 获取国家列表
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await request.get('/agent-panel/countries/?online_only=false');
        if (response.code === 200) {
          setCountries(response.data);
        } else {
          message.error(response.message || '获取国家列表失败');
        }
      } catch {
        message.error('获取国家列表失败，请重试');
      } 
    };

    fetchCountries();
  }, []);


  return (
    <div className="p-6 space-y-6">
      <Card
        className="shadow-md"
        title={
          <div className="flex items-center">
            <GlobalOutlined className="text-blue-500 mr-2" />
            <span className="text-xl font-bold">节点列表</span>
          </div>
        }
        extra={
          <Space>
            <Input 
              placeholder="搜索订单号"
              prefix={<SearchOutlined />}
              style={{ width: 220 }}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
            <DatePicker.RangePicker
              onChange={(dates) => setDateRange(dates)}
              placeholder={['开始日期', '结束日期']}
              style={{ width: 280 }}
            />
            <Select
              placeholder="选择国家"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setSelectedCountry(value)}
              options={countries.map(country => ({ value: country, label: country }))}
            />
            <Button type="primary" onClick={searchNodes}>搜索</Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleExportSelected}
              disabled={selectedKeys.length === 0}
            >
              批量导出
            </Button>
          </Space>
        }
      >
        <div className="mb-4">
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            type="card"
            items={[
              { key: 'all', label: '全部节点' },
            ]}
          />
        </div>
        
        <Spin spinning={loading}>
          <div className="mb-4">
            <Checkbox 
              checked={selectedKeys.length === filteredNodes.filter(node => isNodeSelectable(node.protocol)).length && filteredNodes.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedKeys(filteredNodes.filter(node => isNodeSelectable(node.protocol)).map(node => node.key));
                } else {
                  setSelectedKeys([]);
                }
              }}
            >
              全选
            </Checkbox>
            <span className="ml-2 text-gray-500">
              显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalCount)} 条，共 {totalCount} 条
            </span>
          </div>
          
          <Row gutter={[16, 16]}>
            {filteredNodes.map(node => (
              <Col xs={24} sm={12} md={8} key={node.key}>
                <Card 
                  className="h-full" 
                  bodyStyle={{ padding: '16px' }}
                  bordered
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      {isNodeSelectable(node.protocol) && (
                        <Checkbox
                          checked={selectedKeys.includes(node.key)}
                          onChange={() => handleSelectNode(node.key)}
                          className="mr-2"
                        />
                      )}
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-white font-medium ${
                          node.protocol.toLowerCase() === 'shadowsocks' ? 'bg-blue-500' : 
                          node.protocol.toLowerCase() === 'vmess' ? 'bg-purple-500' : 
                          node.protocol.toLowerCase() === 'vless' ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                      >
                        {getProtocolIcon(node.protocol)}
                      </div>
                      <div>
                        <div className="font-medium">{node.name || '未命名节点'}</div>
                        {node.remark_custom && (
                          <div className="text-xs text-gray-500">{node.remark_custom}</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Tag color={node.status === 'active' ? 'green' : 'red'}>
                        {node.status === 'active' ? '已激活' : '未激活'}
                      </Tag>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">国家:</span>
                      <Tag color="red">{node.country}</Tag>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">类型:</span>
                      <Tag color="red">{getNodeTypeText(node.nodeType)}</Tag>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">协议:</span>
                      <span>{node.protocol}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">中转:</span>
                      <Tag color="green">{node.udp ? '是' : '否'}</Tag>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-center mb-1">
                      <span className="text-gray-500 mr-1">主机:</span>
                      <span className="text-xs">{getHost(node).host}</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <span className="text-gray-500 mr-1">端口:</span>
                      <span>{node.udp_host ? node.udp_host.split(":")[1] : node.port}</span>
                    </div>
                    {node.trade_no && (
                      <div className="flex items-center mb-1">
                        <span className="text-gray-500 mr-1">订单号:</span>
                        <span className="text-xs">{node.trade_no}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center mb-3">
                    <ClockCircleOutlined className={new Date(node.expiry_time) < new Date() ? 'text-red-500 mr-1' : 'text-green-500 mr-1'} />
                    <span className="text-gray-600 mr-1">到期时间:</span>
                    <span>{formatISODate(node.expiry_time)}</span>
                    {new Date(node.expiry_time) < new Date() && <Tag color="error" className="ml-1">已过期</Tag>}
                  </div>
                  
                  <div className="flex justify-around border-t pt-3">
                    <Button type="link" onClick={() => showNodeInfo(node)} icon={<LinkOutlined />}>获取链接</Button>
                    <Button type="link" onClick={() => showRemarkModal(node)} icon={<EditOutlined />}>添加备注</Button>
                    <Button type="link" onClick={() => handleRenew(node)} icon={<DollarOutlined />}>续费</Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          
          <div className="mt-4 flex justify-end">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalCount}
              onChange={handlePageChange}
              showSizeChanger
              onShowSizeChange={(current, size) => {
                setCurrentPage(1);
                setPageSize(size);
              }}
              pageSizeOptions={['10', '20', '50', '100']}
            />
          </div>
        </Spin>
      </Card>

      <Modal
        title="节点连接信息"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        {currentNode && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">基础信息</h3>
              {currentNode.udp_host ? (
                <>
                  <p><strong>中转IP地址：</strong> {getHost(currentNode).host}</p>
                  <p><strong>中转端口：</strong> {getHost(currentNode).port}</p>
                </>
              ) : (
                <>
                  <p><strong>默认IP地址：</strong> {getHost(currentNode).host}</p>
                  <p><strong>默认端口：</strong> {getHost(currentNode).port}</p>
                </>
              )}
            </div>

            {['http', 'socks'].includes(currentNode.protocol.toLowerCase()) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">认证信息</h3>
                <p><strong>用户名：</strong> {currentNode.node_username}</p>
                <p><strong>密码：</strong> {currentNode.node_password}</p>
              </div>
            )}

            {['shadowsocks', 'vmess', 'vless'].includes(currentNode.protocol.toLowerCase()) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">分享信息
                  <span className="text-sm text-gray-600 break-all">
                    {currentNode.udp_host ? '默认使用中转地址':''}
                  </span>
                </h3>
                {['vmess', 'vless'].includes(currentNode.protocol.toLowerCase()) && (
                  <div className="mb-4 bg-white p-3 rounded-lg">
                    <p className="font-medium text-gray-700">加密方式：none</p>
                    <p className="font-medium text-gray-700">UUID：{currentNode.uuid}</p>
                    <p className="text-sm text-gray-600 break-all"></p>
                  </div>
                )}
                {['shadowsocks'].includes(currentNode.protocol.toLowerCase()) && (
                  <div className="mb-4 bg-white p-3 rounded-lg">
                    <p className="font-medium text-gray-700">加密方式：aes-256-gcm</p>
                    <p className="font-medium text-gray-700">密码：{currentNode.node_password}</p>
                  </div>
                )}
                <div className="flex flex-col md:flex-row justify-center items-center gap-6">
                  <div className="w-[200px] h-[200px] flex items-center justify-center bg-white p-2 rounded-lg">
                    <QRCode value={generateShareLink(currentNode)} size={200} style={{ height: 'auto' }} />
                  </div>
                  <div className="break-all max-w-sm">
                    <p className="mb-2 font-medium">分享链接：</p>
                    <p className="text-sm text-gray-600 break-words">{generateShareLink(currentNode)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="修改备注"
        open={isRemarkModalVisible}
        onOk={handleUpdateRemark}
        onCancel={() => setIsRemarkModalVisible(false)}
      >
        <Input
          placeholder="请输入备注"
          value={remarkValue}
          onChange={(e) => setRemarkValue(e.target.value)}
        />
      </Modal>

      <Modal
        title={qrCodeUrl ? "" : "选择支付方式"}
        open={isRenewModalVisible}
        onCancel={handleModalClose}
        footer={null}
      >
        <div className="space-y-6">
        <text className='text-gray-600'>
         请注意：节点续费不会更新IP配置，只会刷新节点的到期时间到续费时间。若需要刷新IP配置，请联系客服。或者购买新的节点。
        </text>
          {qrCodeUrl ? (
            <div className="mb-4 text-center">
              <div className="text-lg font-medium text-blue-500 mb-2">等待支付中...</div>
              <div className="text-gray-500">请扫描下方二维码完成支付</div>
            </div>
          ) : (
            
            <Radio.Group
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full space-y-4"
            >
              <div className="flex items-center justify-between p-4 border rounded hover:border-blue-500 cursor-pointer" onClick={() => setSelectedPaymentMethod('balance')}>
                <Radio value="balance" checked={selectedPaymentMethod === 'balance'}>
                  <Space>
                    <WalletOutlined className="text-orange-500 text-xl" />
                    <span>余额支付</span>
                  </Space>
                </Radio>
              </div>
            </Radio.Group>
          )}

          {qrCodeUrl ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center items-center bg-white p-4 rounded-lg shadow-sm">
                <QRCode value={qrCodeUrl} size={200} />
              </div>
              <p className="text-gray-500">请使用{selectedPaymentMethod === 'alipay' ? '支付宝' : '微信'}扫码支付</p>
            </div>
          ) : (
            <Button
              type="primary"
              block
              size="large"
              onClick={handlePayment}
              className="mt-6"
            >
              确认支付
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default NodeList;