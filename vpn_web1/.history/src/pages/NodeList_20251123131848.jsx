import { Card, Table, Tag, Button, Tooltip, Space, message, Modal, QRCode, Select, DatePicker, Radio } from 'antd';
import {
  ClockCircleOutlined,
  GlobalOutlined,
  CopyOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import { useSetAtom } from 'jotai';
import { balanceAtom, updateBalance } from '../jotai';
import { Input } from 'antd';
import CryptoJS from 'crypto-js';
import clipboardCopy from 'clipboard-copy';

const NodeList = () => {
  const setBalance = useSetAtom(balanceAtom);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRemarkModalVisible, setIsRemarkModalVisible] = useState(false);
  const [currentNode, setCurrentNode] = useState(null);
  const [remarkValue, setRemarkValue] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [isRenewModalVisible, setIsRenewModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('balance');
  const [pollingInterval, setPollingInterval] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [tradeNoFilter, setTradeNoFilter] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const generateShareLink = (node, sequenceNumber = null) => {
    const { protocol, node_password, uuid, expiry_time, host_config } = node;
    let hosts = getHost(node).host;
    let ports = getHost(node).port;
    const host_config_json = JSON.parse(host_config);
  
    
    // 格式化到期时间为年月日
    const expiryDate = expiry_time ? expiry_time.split('T')[0] : '';
    let nodeDisplayName = expiryDate ? `${node.country}${expiryDate.split('-')[1]}-${expiryDate.split('-')[2]}` : node.country;
    
    // 如果有序号，添加到显示名称末尾
    if (sequenceNumber !== null) {
      nodeDisplayName += `-${sequenceNumber}`;
    }
    
    switch(protocol.toLowerCase()) {
      case 'shadowsocks': {
        const type = host_config_json.panel_type;
        if (type === 'x-ui') {
          return `ss://2022-blake3-aes-256-gcm:${node_password}@${hosts}:${ports}#${nodeDisplayName}`;
        } else {
          const ssConfig = `2022-blake3-aes-256-gcm:${node_password}:${node_password}`;
          return `ss://${CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(ssConfig))}@${hosts}:${ports}?type=tcp#${nodeDisplayName}`;
        }
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
              updateBalance(setBalance, yueResponse.data.balance);
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

  useEffect(() => {
    fetchNodes();
  }, [pagination.current, pagination.pageSize]);

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

  const searchNodes = async () => {
    setLoading(true);
    try {
      setPagination(
        {
          current: 1,
          pageSize: 20,
          total: 0, 
        }
      )
      const response = await request.get(`/customers/nodes/?page=1&page_size=${pagination.pageSize}&country=${selectedCountry?selectedCountry:''}&start_date=${dateRange?dateRange[0].format('YYYY-MM-DD'):''}&end_date=${dateRange?dateRange[1].format('YYYY-MM-DD'):''}&order_no=${tradeNoFilter?tradeNoFilter:''}`);
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
        setFilteredNodes(formattedNodes);
        setPagination({
          ...pagination,
          total: response.count || 0,
        });
      } else {
        setNodes([]);
        setPagination({
          current: 1,
          pageSize: 20,
          total: 0,
        });
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
      const response = await request.get(`/customers/nodes/?page=${pagination.current}&page_size=${pagination.pageSize}&country=${selectedCountry?selectedCountry:''}&start_date=${dateRange?dateRange[0].format('YYYY-MM-DD'):''}&end_date=${dateRange?dateRange[1].format('YYYY-MM-DD'):''}&order_no=${tradeNoFilter?tradeNoFilter:''}`);
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
        setFilteredNodes(formattedNodes);
        setPagination({
          ...pagination,
          total: response.count || 0,
        });
      } else {
        setNodes([]);
        setPagination({
          current: 1,
          pageSize: 20,
          total: 0,
        });
      }
    } catch (error) {
      console.error('获取节点列表出错:', error);
      message.error('获取节点列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTableChange = (pageInfo) => {
    setPagination({
      ...pagination,
      current: pageInfo.current,
      pageSize: pageInfo.pageSize,
    });
  };
  const handleExportSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的节点');
      return;
    }

    const filteredNodes = selectedCountry
      ? nodes.filter(node => node.country === selectedCountry)
      : nodes;

    const selectedNodes = filteredNodes.filter(node => selectedRowKeys.includes(node.key));
    
    // 按订单号分组，为相同订单号的节点添加序号
    const groupedByTradeNo = {};
    selectedNodes.forEach(node => {
      const tradeNo = node.trade_no || 'no_trade_no';
      if (!groupedByTradeNo[tradeNo]) {
        groupedByTradeNo[tradeNo] = [];
      }
      groupedByTradeNo[tradeNo].push(node);
    });
    
    // 为每个分组的节点生成带序号的分享链接
    const shareLinks = [];
    Object.values(groupedByTradeNo).forEach(nodesGroup => {
      nodesGroup.forEach((node, index) => {
        const link = generateShareLink(node, nodesGroup.length > 1 ? index + 1 : null);
        if (link) {
          shareLinks.push(link);
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

 
  const getHost = (data) => {
    if (data.udp_host_domain) {
      return {host:data.udp_host_domain.split(":")[0],port:data.udp_host_domain.split(":")[1]};
    }
    if (data.udp_host) {
      return {host:data.udp_host.split(":")[0],port:data.udp_host.split(":")[1]};
    }
    return {host:data.host,port:data.port};
  }
  
  // 服务器列表数据
  const serverColumns = [
    {
      title: '备注',
      key: 'remark_custom',
      dataIndex: 'remark_custom',
      width: 100,
      render: (remark_custom) => {
        return <span>{remark_custom}</span>;
      },
    },
    {
      title: '订单号',
      key: 'trade_no',
      dataIndex: 'trade_no',
      render: (trade_no) => {
        return <span>{trade_no}</span>;
      },
    },
    {
      title: '节点',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <GlobalOutlined className="text-blue-500" />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '国家',
      key: 'country',
      dataIndex: 'country',
      width: 100,
      render: (country) => {
        return <Tag color={'red'}>{country}</Tag>;
      },
    },
    {
      title: '节点类型',
      key: 'nodeType',
      dataIndex: 'nodeType',
      width: 100,
      render: (nodeType) => {
        return <Tag color={'red'}>{nodeType==='live'?"直播":nodeType==='normal'?'普通':nodeType==='transit'?'视频':'未知'}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      width: 80,
      render: (status) => {
        return <Tag color={status=='active'?'green':'red'}>{status=='active'?'已激活':'未激活'}</Tag>;
      },
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
    },
    {
      title: '主机地址',
      dataIndex: 'host',
      width: 120,
      key: 'host',
      render: (host,data) => {
        return(
          <div>
              <span>{getHost(data).host}</span>
          </div>
        )
      }
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
      render: (port,data) => {
        return(
          <div>
              <span>{getHost(data).port}</span>
          </div>
        )
      }
    },
    {
      title: '用户名',
      dataIndex: 'node_username',
      width: 120,
      key: 'node_username',
    },
    {
      title: '密码',
      dataIndex: 'node_password',
      width: 120,
      key: 'node_password',
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
    },
    {
      title: '中转',
      dataIndex: 'udp',
      key: 'udp',
      width: 60,
      render: (udp) => {
        return <Tag color={'green'}>{udp ? '是' : '否'}</Tag>;
      },
    },
    {
      title: '到期时间',
      dataIndex: 'expiry_time',
      width: 130,
      key: 'expiry_time',
      render: (date) => {
        const isExpired = new Date(date) < new Date();
        return (
          <Tooltip title={date}>
            <Space>
              <ClockCircleOutlined className={isExpired ? 'text-red-500' : 'text-green-500'} />
              <span>{date.split("T")[0]}</span>
              {isExpired && <Tag color="error">已过期</Tag>}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 300,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => showNodeInfo(record)}>获取链接</Button>
          <Button type="link" onClick={() => showRemarkModal(record)}>添加备注</Button>
          <Button type="link" onClick={() => handleRenew(record)}>续费</Button>
        </Space>
      ),
    },
  ];



  return (
    <div className="p-4 md:p-6">
      <Card 
        title="节点列表" 
        className="overflow-hidden"
        extra={
          <div className="flex flex-wrap gap-2">
            <Select
              placeholder="选择国家/地区"
              allowClear
              style={{ minWidth: 120 }}
              onChange={(value) => setSelectedCountry(value)}
              options={countries.map(country => ({ value: country, label: country }))}
            />
            <DatePicker.RangePicker 
              onChange={(dates) => setDateRange(dates)} 
            />
            <Input
              placeholder="搜索订单号"
              style={{ width: 150 }}
              value={tradeNoFilter}
              onChange={(e) => setTradeNoFilter(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
            <Button 
              type="primary" 
              onClick={searchNodes}
            >
              搜索
            </Button>
            <Button 
              type="primary" 
              onClick={handleExportSelected}
            >
              导出选中节点
            </Button>
            
          </div>
          </div>

        }
      >
        <div className="overflow-x-auto">
          <Table 
            rowSelection={{
              selectedRowKeys,
              onChange: (selectedRowKeys) => setSelectedRowKeys(selectedRowKeys),
            }}
            dataSource={filteredNodes}
            loading={loading}
            onChange={handleTableChange}
            pagination={pagination}
            scroll={{ x: 'max-content' }}
            columns={serverColumns}
          />
        </div>
        
       
          
     
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
                  <p><strong>中转地址：</strong> {getHost(currentNode).host}</p>
                  <p><strong>中转端口：</strong> {getHost(currentNode).port}</p>
                </>
              ) : (
                <>
                  <p><strong>默认地址：</strong> {currentNode.host}</p>
                  <p><strong>默认端口：</strong> {currentNode.port}</p>
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
                    <p className="font-medium text-gray-700">加密方式：auto/none</p>
                    <p className="font-medium text-gray-700">UUID：{currentNode.uuid}</p>
                    <p className="text-sm text-gray-600 break-all"></p>
                  </div>
                )}
                {['shadowsocks'].includes(currentNode.protocol.toLowerCase()) && (
                  <div className="mb-4 bg-white p-3 rounded-lg">
                    <p className="font-medium text-gray-700">加密方式：2022-blake3-aes-256-gcm</p>
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