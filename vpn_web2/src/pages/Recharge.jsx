import { useState, useEffect } from 'react';
import { 
  Button, 
  Radio, 
  Input, 
  message,
  Switch,
  InputNumber,
  Modal,
  QRCode
} from 'antd';
import { useSetAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { balanceAtom, isLoginAtom } from '../jotai';
import {
  AlipayOutlined,
  WechatOutlined,
  ReloadOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  WalletOutlined
} from '@ant-design/icons';
import request from '../utils/request';

const Recharge = () => {
  const [pollingInterval, setPollingInterval] = useState(null);
  const setBalance = useSetAtom(balanceAtom);
  const isLogin = useAtomValue(isLoginAtom);
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, success, failed
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [prices, setPrices] = useState({});
  const [periods, setPeriods] = useState([]);
  const [finalPrice, setFinalPrice] = useState(null);
  const [originalPrice, setOriginalPrice] = useState(null);
  
  // 全局状态对象，保存所有步骤的选择
  const [orderData, setOrderData] = useState({
    protocol: 'Http',
    nodeType: 'normal', // 默认选中店铺线路
    region: null, // 不选中节点国家
    username: '',
    password: '',
    udpForward: false,
    period: 'monthly',
    quantity: 1,
    paymentMethod: 'balance',
    coupon: ''
  });
  
  // 新增当前步骤状态
  const [currentStep, setCurrentStep] = useState(1);
  
  // 定义步骤数据
  const steps = [
    {
      title: '节点选择',
      icon: <GlobalOutlined />,
      description: '选择合适的节点位置和类型'
    },
    {
      title: '协议设置',
      icon: <PlayCircleOutlined />,
      description: '配置连接协议和账号信息'
    },
    {
      title: '付费周期',
      icon: <ClockCircleOutlined />,
      description: '选择服务时长和购买数量'
    },
    {
      title: '支付方式',
      icon: <WalletOutlined />,
      description: '选择支付方式完成订单'
    }
  ];

  // 获取价格数据
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await request.get('/prices/');
        if (response.code === 200) {
          const newPrices = response.data;
          setPrices(newPrices);
          // 使用默认的店铺线路节点类型
          const nodeType = 'normal';
          const periods = getPeriods(nodeType);
          setPeriods(periods);
          // 设置默认周期为月付
          const defaultPeriod = 'monthly';
          handlePeriodChange(defaultPeriod);
        } else {
          message.error(response.message || '获取价格失败');
        }
      } catch {
        message.error('获取价格失败，请重试');
      }
    };
    
    fetchPrices();
  }, []);

  // 监听nodeType和prices变化重新计算价格
  useEffect(() => {
    if (Object.keys(prices).length > 0 && orderData.nodeType) {
      const nodeType = orderData.nodeType;
      setPeriods(getPeriods(nodeType));
      if (orderData.period) {
        handlePeriodChange(orderData.period);
      }
    }
  }, [prices, orderData.nodeType]);

  // 获取国家列表
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await request.get('/agent-panel/countries/');
        if (response.code === 200) {
          const countryList = response.data.map(country => ({
            label: country,
            value: country.toLowerCase()
          }));
          setCountries(countryList);
          // 不再自动设置默认国家
        } else {
          message.error(response.message || '获取国家列表失败');
        }
      } catch {
        message.error('获取国家列表失败，请重试');
      }
    };

    fetchCountries();
  }, []);

  // 生成随机字符串
  const generateRandomString = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 处理随机账号密码生成
  const handleGenerateCredentials = () => {
    const username = generateRandomString();
    const password = generateRandomString();
    setOrderData(prev => ({
      ...prev,
      username,
      password
    }));
  };

  // 处理协议切换
  const handleProtocolChange = (protocol) => {
    setOrderData(prev => ({
      ...prev,
      protocol,
      username: '',
      password: ''
    }));
  };

  const onFinish = async () => {
    try {
      console.log("提交的订单数据:", orderData);
      
      // 检查付费周期是否已选择
      if (!orderData.period) {
        message.error('请选择付费周期');
        return;
      }
      
      await handlePayment();
    } catch (error) {
      console.error("支付请求失败:", error);
      message.error('支付请求失败，请重试');
    }
  };

  const getPeriods = (nodeType) => {
    const priceType = nodeType === 'normal' ? 'normal' : nodeType === 'live' ? 'live' : 'transit';
    return [
      { 
        value: 'monthly',
        label: '月付',
        price: prices[priceType]?.monthly,
        description: '灵活支付，随时更换',
        perMonth: prices[priceType]?.monthly ,
        totalSave: prices[priceType]?.monthly 
      },
      {
        value: 'quarterly',
        label: '季付',
        price: prices[priceType]?.quarterly ,
        save: '15%',
        description: '季度优惠，持续省钱',
        perMonth: (prices[priceType]?.quarterly / 3).toFixed(1) ,
        totalSave: prices[priceType]?.quarterly 
      },
      {
        value: 'half_yearly',
        label: '半年付',
        price: prices[priceType]?.half_yearly,
        save: '20%',
        description: '超值优惠，省心省钱',
        perMonth: (prices[priceType]?.half_yearly / 6).toFixed(1) ,
        totalSave: prices[priceType]?.half_yearly 
      },
      {
        value: 'yearly',
        label: '年付',
        price: prices[priceType]?.yearly ,
        save: '25%',
        description: '最大优惠，一次省心',
        perMonth: (prices[priceType]?.yearly / 12).toFixed(1) ,
        totalSave: prices[priceType]?.yearly 
      }
    ];
  };

  // 处理优惠码验证和价格计算
  // 验证优惠码
  const validateCoupon = async (couponCode) => {
    try {
      const response = await request.post('/coupon/validate/', {
        coupon_code: couponCode
      });
      
      const currentPeriod = orderData.period;
      const periodData = periods.find(p => p.value === currentPeriod);
      
      if (!periodData) {
        message.error('请先选择付费周期');
        return;
      }
      
      if (response.valid) {
        const discount = response.discount / 100;
        setFinalPrice(Number(periodData.price) * (1 - discount) * orderData.quantity);
        setOriginalPrice(Number(periodData.price) * orderData.quantity);
        message.success('优惠码验证成功');
      } else {
        setFinalPrice(null);
        setOriginalPrice(Number(periodData.price) * orderData.quantity);
        message.error(response.message || '优惠码无效');
      }
    } catch {
      message.error('优惠码验证失败，请重试');
    }
  };

  const handleCouponChange = (e) => {
    const couponCode = e.target.value;
    setOrderData(prev => ({...prev, coupon: couponCode}));
    
    if (!couponCode) {
      setFinalPrice(null);
      const currentPeriod = orderData.period;
      const periodData = periods.find(p => p.value === currentPeriod);
      if (periodData) {
        setOriginalPrice(Number(periodData.price) * orderData.quantity);
      }
    }
  };

  const handleCouponBlur = (e) => {
    const couponCode = e.target.value;
    if (couponCode) {
      validateCoupon(couponCode);
    }
  };

  const handleCouponKeyDown = (e) => {
    if (e.key === 'Enter') {
      const couponCode = e.target.value;
      if (couponCode) {
        validateCoupon(couponCode);
      }
    }
  };

  // 处理付费周期变更
  const handlePeriodChange = async (value) => {
    if (!value) {
      return;
    }
    
    setOrderData(prev => ({...prev, period: value}));
    const nodeType = orderData.nodeType;
    const periods = getPeriods(nodeType);
    const periodData = periods.find(p => p.value === value);
    const couponCode = orderData.coupon;
    if (!periodData) {
      message.error('价格数据未加载完成，请稍后再试');
      return;
    }
    
    if (couponCode) {
      try {
        const response = await request.post('/coupon/validate/', {
          coupon_code: couponCode
        });
        console.log(response);
        if (response.valid) {
          const discount = response.discount / 100;
          setFinalPrice(Number(periodData.price) * (1 - discount) * orderData.quantity);
          setOriginalPrice(Number(periodData.price) * orderData.quantity);
        } else {
          setFinalPrice(null);
          setOriginalPrice(Number(periodData.price) * orderData.quantity);
        }
      } catch {
        setFinalPrice(null);
        setOriginalPrice(Number(periodData.price) * orderData.quantity);
      }
    } else {
      setFinalPrice(null);
      setOriginalPrice(Number(periodData.price) * orderData.quantity);
    }
  };

  // 处理数量变更
  const handleQuantityChange = async (value) => {
    setOrderData(prev => ({...prev, quantity: value}));
    
    const currentPeriod = orderData.period;
    const nodeType = orderData.nodeType;
    const priceData = prices[nodeType === 'normal' ? 'normal' : nodeType === 'live' ? 'live' : 'transit'];
    const couponCode = orderData.coupon;
    
    if (!priceData) {
      message.error('价格数据未加载完成，请稍后再试');
      return;
    }
    
    if (couponCode) {
      try {
        const response = await request.post('/coupon/validate/', {
          coupon_code: couponCode
        });
        
        if (response.valid) {
          const discount = response.discount / 100;
          setFinalPrice(Number(priceData[currentPeriod]) * (1 - discount) * value);
          setOriginalPrice(Number(priceData[currentPeriod]) * value);
        } else {
          setFinalPrice(null);
          setOriginalPrice(Number(priceData[currentPeriod]) * value);
        }
      } catch {
        setFinalPrice(null);
        setOriginalPrice(Number(priceData[currentPeriod]) * value);
      }
    } else {
      setFinalPrice(null);
      setOriginalPrice(Number(priceData[currentPeriod]) * value);
    }
  };

  // 处理支付
  const handlePayment = async () => {
    setLoading(true);
    try {
      // 校验orderData数据是否有空 (排除 coupon 字段)
      const hasEmpty = Object.entries(orderData).some(([key, value]) => {
        if (key === 'coupon') {
          return false; // 忽略 coupon 字段
        }
        
        // 根据协议类型检查必填字段
        if (key === 'username' && 
            (orderData.protocol === 'Shadowsocks' || 
             orderData.protocol === 'Vmess' || 
             orderData.protocol === 'Vless')) {
          return false;  // 这些协议不需要用户名
        }
        if (key === 'password' && 
          (orderData.protocol === 'Vmess' || 
           orderData.protocol === 'Vless')) {
        return false;  // 这些协议不需要密码
      }
        
        return value === undefined || value === null || value === '';
      });

      console.log("提交检查:", orderData);

      // 特别检查付费周期是否已选择
      if (!orderData.period) {
        message.error('请选择付费周期');
        setLoading(false);
        return;
      }
      
      if (hasEmpty) {
        message.error('数据不完善，请仔细核对订单');
        setLoading(false);
        return;
      }

      // 根据支付方式选择不同的接口
      const paymentEndpoint = orderData.paymentMethod === 'balance' ? '/balance-payment/' : '/payment/submit/';
      const response = await request.post(paymentEndpoint, orderData);
      
      // 兼容不同的API响应格式
      if (response.code == 1 || response.code == 200) {
        if (orderData.paymentMethod === 'balance') {
          // 余额支付直接处理结果
          handlePaymentResult('success');
          message.success('支付成功');
          
          return;
        }

        // 其他支付方式处理
        const qrUrl = response.qrcode || response.payurl || response.pay_url || 
                     (response.data && (response.data.qrcode || response.data.payurl || response.data.pay_url));
        
        if (qrUrl) {
          setQrCodeUrl(qrUrl);
          setPaymentModalVisible(true);
          setPaymentStatus('pending');
          
          const orderNo = response.order_no;
          
          if (orderNo) {
            startPaymentStatusPolling(orderNo);
          } else {
            message.error('订单号获取失败');
          }
        } else {
          message.error('获取支付二维码失败');
        }
      } else {
        message.error(response.msg || response.message || '支付请求失败');
      }
    } catch (error) {
      console.error('支付请求错误:', error);
      message.error('支付请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  // 轮询支付状态
  const startPaymentStatusPolling = (orderNo) => {
    // 先清除可能存在的旧定时器
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // 创建新的轮询定时器
    const newPollingInterval = setInterval(async () => {
      try {
        const response = await request.get(`/payment/status/?order_no=${orderNo}`);
        
        // 检查响应结构，适配不同的API响应格式
        if (response.code === 200 || response.code === 1) {
          // 检查状态字段，可能在status或data.status中
          const status = response.status || (response.data && response.data.status);
          
          if (status === 'success' || status === 'paid') {
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
            handlePaymentResult('success');
          } else if (status === 'failed' || status === 'fail') {
            handlePaymentResult('failed');
          }
        }
      } catch (error) {
        console.error('支付状态请求错误:', error);
      }
    }, 3000); // 每3秒查询一次
    setPollingInterval(newPollingInterval);
  };
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (isLogin){
          const yueResponse = await request.get(`/user-balance/`);
          if (yueResponse.code === 200) {
            setBalance(yueResponse.data.balance);
          }
        } 
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();

    if (!paymentModalVisible && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [paymentModalVisible, pollingInterval, setBalance, isLogin]);
  // 处理支付结果
  const handlePaymentResult = async(status) => {
    if (isLogin){
      const yueResponse = await request.get(`/user-balance/`);
      if (yueResponse.code === 200) {
        setBalance(yueResponse.data.balance);
      }
    } 
    
    setPaymentStatus(status);
    if (status === 'success') {
      let timer = 3;
      const interval = setInterval(() => {
        setCountdown(timer);
        if (timer === 0) {
          clearInterval(interval);
          setPaymentModalVisible(false);
        }
        timer--;
      }, 1000);
    }
  };

  // 取消跳转
  const handleCancelRedirect = () => {
    setPaymentModalVisible(false);
  };

  // 处理表单值变更
  const handleFormChange = (field, value) => {
    setOrderData(prev => ({...prev, [field]: value}));
    
    // 特殊情况处理
    if (field === 'nodeType') {
      const periods = getPeriods(value);
      setPeriods(periods);
      handlePeriodChange(orderData.period);
    }
  };

  // 处理下一步
  const handleNext = () => {
    let canProceed = true;
    
    // 根据当前步骤验证必填字段
    switch(currentStep) {
      case 1:
        if (!orderData.region || !orderData.nodeType) {
          message.error('请完成节点选择');
          canProceed = false;
        }
        break;
      case 2:
        if (!orderData.protocol || 
            ((orderData.protocol === 'Http' || orderData.protocol === 'Socks') && 
             (!orderData.username || !orderData.password)) ||
            (orderData.protocol === 'Shadowsocks' && !orderData.password)) {
          message.error('请完成协议设置');
          canProceed = false;
        }
        break;
      case 3:
        if (!orderData.period || !orderData.quantity) {
          message.error('请选择付费周期和购买数量');
          canProceed = false;
        }
        break;
    }
    
    if (canProceed && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 处理上一步
  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">节点选择</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">节点国家</h3>
              <div className="grid grid-cols-3 gap-4">
                {countries.map((country) => (
                  <div 
                    key={country.value}
                    className={`border rounded-lg p-3 text-center cursor-pointer transition-all ${
                      orderData.region === country.value 
                        ? 'border-blue-500 bg-blue-50 text-blue-600' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleFormChange('region', country.value)}
                  >
                    {country.label}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">节点类型</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '店铺线路', value: 'normal', icon: <GlobalOutlined /> },
                  { label: '直播线路', value: 'live', icon: <PlayCircleOutlined /> },
                  { label: '视频线路', value: 'transit', icon: <PlayCircleOutlined /> }
                ].map((type) => (
                  <div
                    key={type.value}
                    className={`flex flex-col items-center justify-center border p-4 rounded-lg cursor-pointer transition-all ${
                      orderData.nodeType === type.value 
                        ? 'border-blue-500 bg-blue-50 text-blue-600' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleFormChange('nodeType', type.value)}
                  >
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <div>{type.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">协议设置</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">选择协议</h3>
              <Radio.Group 
                className="w-full" 
                buttonStyle="solid" 
                value={orderData.protocol}
                onChange={(e) => handleProtocolChange(e.target.value)}
              >
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: 'Http', color: '#1890ff' },
                    { label: 'Socks', color: '#52c41a' },
                    { label: 'Shadowsocks', color: '#722ed1' },
                    { label: 'Vmess', color: '#fa8c16' },
                    { label: 'Vless', color: '#f5222d' }
                  ].map((protocol) => (
                    <Radio.Button
                      key={protocol.label}
                      value={protocol.label}
                      className="w-full text-center py-3 h-auto"
                      style={{ borderColor: protocol.color }}
                    >
                      {protocol.label}
                    </Radio.Button>
                  ))}
                </div>
              </Radio.Group>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-700">账号设置</h3>
                {
                 ( orderData.protocol === 'Shadowsocks' || orderData.protocol === 'Socks' || orderData.protocol === 'Http' )&&(
                      <Button 
                         type="link" 
                         onClick={handleGenerateCredentials}
                         icon={<ReloadOutlined />}
                       >
                         随机生成
                       </Button>
                  ) 
                }
                
              </div>
              
              <div className="space-y-4">
                {( orderData.protocol === 'Socks' || orderData.protocol === 'Http' ) && (
                  <div className="form-item">
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <Input 
                      placeholder="请输入用户名" 
                      value={orderData.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                    />
                  </div>
                )}
                {( orderData.protocol === 'Shadowsocks' || orderData.protocol === 'Socks' || orderData.protocol === 'Http' )&&(
                  <div className="form-item">
                    <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                    <Input 
                      placeholder="请输入密码"
                      value={orderData.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                    />
                  </div>
                )}
                
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">附加选项</h3>
              <div className="flex items-center">
                <Switch 
                  checkedChildren="开启" 
                  unCheckedChildren="关闭"
                  checked={orderData.udpForward}
                  onChange={(checked) => handleFormChange('udpForward', checked)}
                /> 
                <span className="ml-2">UDP中转</span>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">付费周期</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">选择周期</h3>
              <Radio.Group 
                className="w-full" 
                value={orderData.period}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <div className="grid grid-cols-4 gap-4">
                  {periods.map((period) => (
                    <Radio key={period.value} value={period.value} className="w-full h-full">
                      <div className="border border-gray-200 p-4 rounded-lg hover:border-blue-500 cursor-pointer">
                        <div className="font-bold text-lg">{period.label}</div>
                        <div className="text-blue-600 font-bold text-xl mt-2">¥{period.price}</div>
                        <div className="text-gray-500 text-sm mt-1">
                          {/* {period.save && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs mr-2">省{period.save}</span>} */}
                          {period.description}
                        </div>
                        <div className="text-gray-500 text-sm mt-2">月均: ¥{period.perMonth}</div>
                      </div>
                    </Radio>
                  ))}
                </div>
              </Radio.Group>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">购买数量</h3>
              <InputNumber 
                min={1} 
                max={100} 
                precision={0}
                value={orderData.quantity}
                onChange={(value) => handleQuantityChange(value)}
                className="w-32"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">支付方式</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">选择支付方式</h3>
              <Radio.Group 
                className="w-full"
                value={orderData.paymentMethod}
                onChange={(e) => handleFormChange('paymentMethod', e.target.value)}
              >
                <div className="grid grid-cols-3 gap-4">
                  <Radio value="balance" className="w-full h-full">
                    <div className="flex flex-col items-center justify-center border border-gray-200 p-4 rounded-lg hover:border-blue-500 cursor-pointer">
                      <WalletOutlined className="text-2xl mb-2" />
                      <div>余额支付</div>
                    </div>
                  </Radio>
                  {/* <Radio value="alipay" className="w-full h-full">
                    <div className="flex flex-col items-center justify-center border border-gray-200 p-4 rounded-lg hover:border-blue-500 cursor-pointer">
                      <AlipayOutlined className="text-2xl mb-2 text-blue-500" />
                      <div>支付宝</div>
                    </div>
                  </Radio>
                  <Radio value="wechat" className="w-full h-full">
                    <div className="flex flex-col items-center justify-center border border-gray-200 p-4 rounded-lg hover:border-blue-500 cursor-pointer">
                      <WechatOutlined className="text-2xl mb-2 text-green-500" />
                      <div>微信支付</div>
                    </div>
                  </Radio> */}
                </div>
              </Radio.Group>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">优惠码</h3>
              <Input 
                placeholder="如有优惠码请输入" 
                value={orderData.coupon}
                onChange={handleCouponChange}
                onBlur={handleCouponBlur}
                onKeyDown={handleCouponKeyDown}
              />
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-gray-800">
                总计金额：
                {finalPrice ? (
                  <>
                    <span className="text-blue-600 text-2xl">¥{finalPrice.toFixed(2)}</span>
                    <span className="text-gray-400 line-through ml-4">¥{originalPrice.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="text-blue-600 text-2xl">¥{originalPrice?.toFixed(2) || '计算中...'}</span>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full  bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">服务订购</h1>
        
        <div className="flex gap-6">
          {/* 左侧步骤导航 */}
          <div className="w-72 bg-white rounded-xl shadow-sm p-6 h-fit sticky top-6">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center cursor-pointer p-4 rounded-lg transition-all
                    ${currentStep === index + 1 ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}
                    ${currentStep > index + 1 ? 'text-green-600' : 'text-gray-600'}`}
                  onClick={() => setCurrentStep(index + 1)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3
                    ${currentStep === index + 1 ? 'bg-blue-100' : 
                      currentStep > index + 1 ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {currentStep > index + 1 ? <CheckOutlined /> : <span>{index + 1}</span>}
                  </div>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="text-sm text-gray-500">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 总计金额显示（固定在左侧底部） */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-gray-600">总计金额</div>
              <div className="text-xl font-bold text-gray-800">
                {finalPrice ? (
                  <>
                    <span className="text-blue-600">¥{finalPrice.toFixed(2)}</span>
                    <span className="text-gray-400 text-sm line-through ml-2">¥{originalPrice?.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="text-blue-600">¥{originalPrice?.toFixed(2) || '0.00'}</span>
                )}
              </div>
            </div>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1">
            <div className="space-y-6">
              {renderStepContent()}

              {/* 底部按钮区 */}
              <div className="flex justify-between mt-6 bg-white p-4 rounded-xl shadow-sm">
                {currentStep > 1 ? (
                  <Button
                    size="large"
                    onClick={handlePrev}
                    icon={<LeftOutlined />}
                  >
                    上一步
                  </Button>
                ) : (
                  <div></div> // 占位元素保持布局
                )}
                
                {currentStep < 4 ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleNext}
                  >
                    下一步 <RightOutlined />
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    onClick={onFinish}
                    loading={loading}
                    disabled={!isLogin}
                  >
                    {isLogin ? '提交订单' : '请先登录'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 支付Modal */}
      <Modal
        title="支付"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        centered
        width={400}
      >
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
          {paymentStatus === 'pending' && (
            <>
              <div className="mb-4 text-center">
                <div className="text-lg font-medium text-blue-500 mb-2">等待支付中...</div>
                <div className="text-gray-500">请扫描下方二维码完成支付</div>
              </div>
              <div className="flex justify-center items-center bg-white p-4 rounded-lg shadow-sm">
                <QRCode value={qrCodeUrl} size={200} />
              </div>
              <p className="mt-6 text-gray-600 text-lg">请使用支付宝/微信扫码支付</p>
            </>
          )}
          {paymentStatus === 'success' && (
            <>
              <CheckCircleOutlined className="text-6xl text-green-500" />
              <p className="mt-4 text-green-500 text-xl font-medium">支付成功</p>
              <p className="text-gray-500 mb-4">将在 {countdown} 秒后跳转到控制台</p>
              <Button type="default" onClick={handleCancelRedirect}>取消跳转</Button>
            </>
          )}
          {paymentStatus === 'failed' && (
            <>
              <CloseCircleOutlined className="text-6xl text-red-500" />
              <p className="mt-4 text-red-500 text-xl font-medium">支付失败</p>
              <p className="text-gray-500">请重新尝试支付</p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Recharge;