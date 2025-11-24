import { Card, Table, Tag, Space, message, Modal, Radio, QRCode } from 'antd';
import { HistoryOutlined, AlipayOutlined, WechatOutlined, WalletOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import { Button } from 'antd';
import { useSetAtom } from 'jotai';
import { balanceAtom, updateBalance } from '../jotai';

const OrderHistory = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('alipay');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);
  const pageSize = 10;
  const setBalance = useSetAtom(balanceAtom);

  const renewHandel = (record) => {
    setCurrentOrder(record);
    setPaymentModalVisible(true);
  };


  const handlePayment = async () => {
    try {
      // 生成随机账号密码
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
            updateBalance(setBalance, yueResponse.data.balance);
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

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const response = await request.get('/payment-orders/', {
       
          page: page,
          page_size: pageSize
        
      });
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
        setOrders(formattedOrders);
        setTotal(response.data.count);
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
  // 购买记录数据
  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'orderId',
      key: 'orderId',
    },
    {
      title: '套餐',
      dataIndex: 'package',
      key: 'package',
    },
    {
      title: '节点数量',
      dataIndex: 'node_count',
      key: 'orderId',
    },
    {
      title: '购买周期',
      dataIndex: 'period',
      key: 'period',
      render: (period) => (
        <Tag color="blue">{period==='monthly'?"月付":period==="quarterly"?"季度付":period==="half_yearly"?"半年付":"年付"}</Tag>
      ),
    },
    {
      title: '支付金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount}`,
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method) => {
        return <Tag >{method==='balance'?"余额支付":method==="alipay"?"支付宝":method==="wxpay"?"微信支付":"未知"}</Tag>;
      },
    },
    {
      title: '支付时间',
      dataIndex: 'payTime',
      key: 'payTime',
      render: (time) => {
        return <Tag >{time.split("T")[0]}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      render: (status) => {
        const statusMap = {
          success: { color: 'success', text: '支付成功' },
          pending: { color: 'warning', text: '待支付' },
          failed: { color: 'error', text: '支付失败' }
        };
        return <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => renewHandel(record)}>续费</Button>
        </Space>
      ),
    },
  ];



  return (
    <div className="p-6 space-y-6">
      <Card 
        title={
          <div className="flex items-center">
            <HistoryOutlined className="text-blue-500 mr-2" />
            <span className="text-xl font-bold">购买记录</span>
          </div>
        }
        className="shadow-md"
      >
        <Table 
          columns={orderColumns} 
          dataSource={orders}
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: false,
            onChange: (page) => {
              setCurrentPage(page);
              fetchOrders(page);
            }
          }}
        />
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