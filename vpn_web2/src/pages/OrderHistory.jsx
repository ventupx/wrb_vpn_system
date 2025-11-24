import { Card, Tag, Space, message, Modal, Radio, QRCode, Pagination, Row, Col, Spin, Input } from 'antd';
import { HistoryOutlined, AlipayOutlined, WechatOutlined, WalletOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import { Button } from 'antd';
import { useSetAtom } from 'jotai';
import { balanceAtom } from '../jotai';

const OrderHistory = () => {
  const [loading, setLoading] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('alipay');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [totalCount, setTotalCount] = useState(0);
  const setBalance = useSetAtom(balanceAtom);

  const renewHandel = (record) => {
    setCurrentOrder(record);
    setPaymentModalVisible(true);
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
  const handlePayment = async () => {
    try {
      // 生成随机账号密码
      // const generateRandomString = () => {
      //   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      //   let result = '';
      //   for (let i = 0; i < 12; i++) {
      //     result += chars.charAt(Math.floor(Math.random() * chars.length));
      //   }
      //   return result;
      // };

      // const randomUsername = generateRandomString();
      // const randomPassword = generateRandomString();
      if (selectedPaymentMethod != 'balance') {
        message.error('请选择余额支付');
        return;
      }
      // 发起支付请求，获取二维码链接
      const paymentEndpoint = selectedPaymentMethod === 'balance' ? '/order/renewal/' : '';
      const response = await request.post(paymentEndpoint, {
        'order_id': currentOrder.id
      });

      if (response.code === 200 || response.code ===1) {
        if (selectedPaymentMethod === 'balance') {
          message.success('支付成功');
          setPaymentModalVisible(false);
          fetchOrders(currentPage);
          const yueResponse = await request.get(`/user-balance/`);
          if (yueResponse.code === 200) {
            setBalance(yueResponse.data.balance);
          }
        } else {
          // 设置二维码URL并开始轮询支付状态
          // 其他支付方式处理
        const qrUrl = response.qrcode || response.payurl || response.pay_url ;
          setQrCodeUrl(qrUrl);
          startPolling(response.order_no);
        }
      } else {
        message.error(response.message || '支付请求失败');
      }
      setCurrentPage(1);
      fetchOrders(1);
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
          // 重新调用登录接口更新用户信息
          try {
            const loginResponse = await request.post('/customer/login/', {
              username: JSON.parse(localStorage.getItem('user')).username,
              password: JSON.parse(localStorage.getItem('user')).password
            });
            if (loginResponse.code === 200) {
              localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
            }
          } catch (error) {
            console.error('更新用户信息失败:', error);
          }
          message.success('支付成功');
          setPaymentModalVisible(false);
          fetchOrders(currentPage);
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
    setPaymentModalVisible(false);
    setQrCodeUrl('');
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [currentPage, pageSize]);

  useEffect(() => {
    if (searchQuery !== undefined) {
      // 搜索时重置到第一页
      setCurrentPage(1);
      fetchOrders(1, searchQuery);
    }
  }, [searchQuery]);

  const fetchOrders = async (page = 1, query = '') => {
    setLoading(true);
    try {
      const params = {
        page: page,
        page_size: pageSize
      };
      
      if (query) {
        params.search = query;
      }
      
      const response = await request.get('/payment-orders/', params);
      if (response.code === 200) {
        const formattedOrders = response.data.results.map(order => ({
          key: order.id,
          orderId: order.out_trade_no,
          package: order.country,
          node_count: order.node_count,
          period: order.period,
          amount: order.amount,
          paymentMethod: order.payment_type,
          payTime: order.created_at,
          status: order.status,
          ...order
        }));
        setFilteredOrders(formattedOrders);
        setTotalCount(response.data.count);
      } else {
        message.error('获取订单列表失败');
      }
    } catch (error) {
      console.error('获取订单列表出错:', error);
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodText = (period) => {
    switch(period) {
      case 'monthly':
        return '月付';
      case 'quarterly':
        return '季度付';
      case 'half_yearly':
        return '半年付';
      case 'yearly':
        return '年付';
      default:
        return period;
    }
  };

  const getPaymentMethodText = (method) => {
    switch(method) {
      case 'balance':
        return '余额支付';
      case 'alipay':
        return '支付宝';
      case 'wxpay':
        return '微信支付';
      default:
        return '未知';
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      success: { color: 'success', text: '支付成功' },
      pending: { color: 'warning', text: '待支付' },
      failed: { color: 'error', text: '支付失败' }
    };
    return <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>;
  };

  return (
    <div className="p-6 space-y-6">
      <Card 
        title={
          <div className="flex items-center">
            <HistoryOutlined className="text-blue-500 mr-2" />
            <span className="text-xl font-bold">订单记录</span>
          </div>
        }
        className="shadow-md"
        extra={
          <Space>
            <Input 
              placeholder="搜索订单号或套餐"
              prefix={<SearchOutlined />}
              style={{ width: 220 }}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          <div className="mb-4">
            <span className="text-gray-500">
              共 {totalCount} 条记录
            </span>
          </div>
          
          <Row gutter={[16, 16]}>
            {filteredOrders.map(order => (
              <Col xs={24} sm={12} md={8} key={order.key}>
                <Card 
                  className="h-full" 
                  bodyStyle={{ padding: '16px' }}
                  bordered
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-medium text-gray-700">
                      订单号: {order.orderId}
                    </div>
                    <div>
                      {getStatusTag(order.status)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">套餐:</span>
                      <span>{order.package}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">节点数量:</span>
                      <span>{order.node_count}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">周期:</span>
                      <Tag color="blue">{getPeriodText(order.period)}</Tag>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">支付方式:</span>
                      <span>{getPaymentMethodText(order.paymentMethod)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">支付时间:</span>
                      <span>{formatISODate(order.payTime)}</span>
                    </div>
                    <div className="font-medium text-red-500">
                      ¥{order.amount}
                    </div>
                  </div>
                  
                  <div className="flex justify-center border-t pt-3">
                    <Button type="primary" onClick={() => renewHandel(order)}>
                      续费
                    </Button>
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
              onChange={setCurrentPage}
              showSizeChanger
              onShowSizeChange={(current, size) => {
                setCurrentPage(1);
                setPageSize(size);
              }}
              pageSizeOptions={['12', '24', '36', '48']}
            />
          </div>
        </Spin>
      </Card>

      <Modal
        title={qrCodeUrl?"":"选择支付方式"}
        open={paymentModalVisible}
        onCancel={handleModalClose}
        footer={null}
      >
        <div className="space-y-6">
        {qrCodeUrl ? (
          <div className="mb-4 text-center">
            <div className="text-lg font-medium text-blue-500 mb-2">等待支付中...</div>
            <div className="text-gray-500">请扫描下方二维码完成支付</div>
        </div>
        ):(
          <Radio.Group
          value={selectedPaymentMethod}
          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
          className="w-full space-y-4"
        >
          {/* <div className="flex items-center justify-between p-4 border rounded hover:border-blue-500 cursor-pointer" onClick={() => setSelectedPaymentMethod('alipay')}>
            <Radio value="alipay" checked={selectedPaymentMethod === 'alipay'}>
              <Space>
                <AlipayOutlined className="text-blue-500 text-xl" />
                <span>支付宝</span>
              </Space>
            </Radio>
          </div>
          <div className="flex items-center justify-between p-4 border rounded hover:border-blue-500 cursor-pointer" onClick={() => setSelectedPaymentMethod('wxpay')}>
            <Radio value="wxpay" checked={selectedPaymentMethod === 'wxpay'}>
              <Space>
                <WechatOutlined className="text-green-500 text-xl" />
                <span>微信支付</span>
              </Space>
            </Radio>
          </div> */}
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

export default OrderHistory;