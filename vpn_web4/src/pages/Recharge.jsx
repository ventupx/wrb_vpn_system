import { useState, useEffect } from 'react';
import {
  Button,
  Radio,
  Input,
  message,
  Switch,
  InputNumber,
  Modal,
  QRCode,
  Progress
} from 'antd';
import { useSetAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { balanceAtom, isLoginAtom } from '../jotai';
import { generate2022Blake3Aes256GcmKey } from '../utils/password';
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
  WalletOutlined,
  SettingOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import request from '../utils/request';

const Recharge = () => {
  const [pollingInterval, setPollingInterval] = useState(null);
  const setBalance = useSetAtom(balanceAtom);
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
    protocol: 'Shadowsocks',
    nodeType: 'normal', // 默认选中店铺线路
    region: null, // 不选中节点国家
    username: generate2022Blake3Aes256GcmKey(),
    password: generate2022Blake3Aes256GcmKey(),
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
    const username = generate2022Blake3Aes256GcmKey();
    const password = generate2022Blake3Aes256GcmKey();
    setOrderData(prev => ({
      ...prev,
      username,
      password
    }));
  };

  // 处理协议切换
  const handleProtocolChange = (protocol) => {
    if (protocol === 'Shadowsocks') {
      const username = generate2022Blake3Aes256GcmKey();
      const password = generate2022Blake3Aes256GcmKey();
      setOrderData(prev => ({
        ...prev,
        protocol,
        username,
        password
      }));
    } else {
      setOrderData(prev => ({
        ...prev,
        protocol,
        username: '',
        password: ''
      }));
    }
  };

  // 校验输入内容只允许字符和数字
  const validateInput = (value) => {
    // 正则表达式：只允许英文字母、数字、下划线、连字符
    const regex = /^[a-zA-Z0-9_-]*$/;
    return regex.test(value);
  };

  // 处理用户名输入变更
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    if (value === '' || validateInput(value)) {
      handleFormChange('username', value);
    } else {
      message.warning('用户名只能包含英文字母、数字、下划线和连字符');
    }
  };

  // 处理密码输入变更
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (value === '' || validateInput(value)) {
      handleFormChange('password', value);
    } else {
      message.warning('密码只能包含英文字母、数字、下划线和连字符');
    }
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
        perMonth: prices[priceType]?.monthly,
        totalSave: prices[priceType]?.monthly
      },
      {
        value: 'quarterly',
        label: '季付',
        price: prices[priceType]?.quarterly,
        save: '15%',
        description: '季度优惠，持续省钱',
        perMonth: (prices[priceType]?.quarterly / 3).toFixed(1),
        totalSave: prices[priceType]?.quarterly
      },
      {
        value: 'half_yearly',
        label: '半年付',
        price: prices[priceType]?.half_yearly,
        save: '20%',
        description: '超值优惠，省心省钱',
        perMonth: (prices[priceType]?.half_yearly / 6).toFixed(1),
        totalSave: prices[priceType]?.half_yearly
      },
      {
        value: 'yearly',
        label: '年付',
        price: prices[priceType]?.yearly,
        save: '25%',
        description: '最大优惠，一次省心',
        perMonth: (prices[priceType]?.yearly / 12).toFixed(1),
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
    setOrderData(prev => ({ ...prev, coupon: couponCode }));

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

    setOrderData(prev => ({ ...prev, period: value }));
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
    setOrderData(prev => ({ ...prev, quantity: value }));

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
        if (isLogin) {
          const yueResponse = await request.get(`/user-balance/`);
          if (yueResponse.code === 200) {
            localStorage.setItem('balance', yueResponse.data.balance);
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
  }, [paymentModalVisible, pollingInterval, setBalance]);
  // 处理支付结果
  const handlePaymentResult = async (status) => {
    if (isLogin) {
      const yueResponse = await request.get(`/user-balance/`);
      if (yueResponse.code === 200) {
        localStorage.setItem('balance', yueResponse.data.balance);
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
  const isLogin = useAtomValue(isLoginAtom);

  // 处理表单值变更
  const handleFormChange = (field, value) => {
    setOrderData(prev => ({ ...prev, [field]: value }));

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
    switch (currentStep) {
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
    switch (currentStep) {
      case 1:
        return (
          <div className="min-h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8">
            {/* 标题区域 */}
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-800 mb-4">选择最适合您的付费方式</div>
              <div className="text-lg text-gray-600">我们提供多种付费周期选择，时间越长优惠越多。</div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex justify-center items-center mb-12">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    <GlobalOutlined />
                  </div>
                  <span className="ml-2 text-blue-600 font-medium">节点选择</span>
                </div>
                <div className="w-16 h-1 bg-blue-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <PlayCircleOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">协议设置</span>
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <ClockCircleOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">付费周期</span>
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <WalletOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">支付方式</span>
                </div>
              </div>
            </div>

            {/* 节点国家选择 */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <GlobalOutlined className="text-blue-600" />
                </div>
                节点国家 <span className="text-red-500 ml-1">*</span>
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {countries.map((country) => (
                  <div
                    key={country.value}
                    className={`relative border-2 rounded-xl p-4 text-center cursor-pointer transition-all duration-300 hover:shadow-lg ${orderData.region === country.value
                        ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-blue-300'
                      }`}
                    onClick={() => handleFormChange('region', country.value)}
                  >
                    <div className="text-2xl mb-2">🌍</div>
                    <div className="font-medium text-gray-800">{country.label}</div>
                    {orderData.region === country.value && (
                      <CheckCircleOutlined className="absolute top-2 right-2 text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 节点类型选择 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <SettingOutlined className="text-green-600" />
                </div>
                节点类型 <span className="text-red-500 ml-1">*</span>
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: '店铺线路',
                    value: 'normal',
                    icon: '🏪',
                    desc: '适合日常购物和浏览',
                    features: ['稳定连接', '高速下载', '全天候支持']
                  },
                  {
                    label: '直播线路',
                    value: 'live',
                    icon: '📺',
                    desc: '专为直播观看优化',
                    features: ['低延迟', '高清画质', '缓冲优化']
                  },
                  {
                    label: '视频线路',
                    value: 'transit',
                    icon: '🎬',
                    desc: '专业视频传输通道',
                    features: ['4K支持', '流畅播放', '智能加速']
                  }
                ].map((type) => (
                  <div
                    key={type.value}
                    className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${orderData.nodeType === type.value
                        ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-blue-300'
                      }`}
                    onClick={() => handleFormChange('nodeType', type.value)}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-3">{type.icon}</div>
                      <div className="font-bold text-lg text-gray-800 mb-2">{type.label}</div>
                      <div className="text-sm text-gray-600 mb-3">{type.desc}</div>
                      <div className="space-y-1">
                        {type.features.map((feature, idx) => (
                          <div key={idx} className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1 inline-block mr-1">
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    {orderData.nodeType === type.value && (
                      <CheckCircleOutlined className="absolute top-3 right-3 text-blue-500 text-xl" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="min-h-[600px] bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-8">
            {/* 标题和步骤指示器 */}
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-800 mb-4">协议配置</div>
              <div className="text-lg text-gray-600">选择适合您需求的连接协议</div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex justify-center items-center mb-12">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">节点选择</span>
                </div>
                <div className="w-16 h-1 bg-green-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                    <PlayCircleOutlined />
                  </div>
                  <span className="ml-2 text-purple-600 font-medium">协议设置</span>
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <ClockCircleOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">付费周期</span>
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <WalletOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">支付方式</span>
                </div>
              </div>
            </div>

            {/* 协议选择 */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <SettingOutlined className="text-purple-600" />
                </div>
                选择协议 <span className="text-red-500 ml-1">*</span>
              </h3>
              <div className="grid grid-cols-5 gap-4">
                {[
                  // { label: 'Http', color: '#1890ff', icon: '🌐', desc: 'Web浏览优化' },
                  // { label: 'Socks', color: '#52c41a', icon: '🔧', desc: '通用代理协议' },
                  { label: 'Shadowsocks', color: '#722ed1', icon: '🔒', desc: '安全加密传输' },
                  // { label: 'Vmess', color: '#fa8c16', icon: '⚡', desc: '高速连接' },
                  // { label: 'Vless', color: '#f5222d', icon: '🚀', desc: '轻量级协议' }
                ].map((protocol) => (
                  <div
                    key={protocol.label}
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg ${orderData.protocol === protocol.label
                        ? 'border-purple-500 bg-purple-50 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-purple-300'
                      }`}
                    onClick={() => handleProtocolChange(protocol.label)}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">{protocol.icon}</div>
                      <div className="font-bold text-lg" style={{ color: protocol.color }}>{protocol.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{protocol.desc}</div>
                    </div>
                    {orderData.protocol === protocol.label && (
                      <CheckCircleOutlined className="absolute top-2 right-2 text-purple-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 账号设置 */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                    <WalletOutlined className="text-orange-600" />
                  </div>
                  账号设置
                </h3>
                {(orderData.protocol === 'Shadowsocks' || orderData.protocol === 'Socks' || orderData.protocol === 'Http') && (
                  <Button
                    type="primary"
                    ghost
                    onClick={handleGenerateCredentials}
                    icon={<ReloadOutlined />}
                    className="border-orange-400 text-orange-600 hover:bg-orange-50"
                  >
                    随机生成
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                {(orderData.protocol === 'Socks' || orderData.protocol === 'Http') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">用户名 <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="请输入用户名(仅支持英文字母、数字、下划线、连字符)"
                      value={orderData.username}
                      onChange={handleUsernameChange}
                      className="h-12 text-lg"
                      prefix={<WalletOutlined className="text-gray-400" />}
                    />
                  </div>
                )}
                {(orderData.protocol === 'Shadowsocks' || orderData.protocol === 'Socks' || orderData.protocol === 'Http') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">密码 <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="请输入密码(仅支持英文字母、数字、下划线、连字符)"
                      disabled={orderData.protocol === 'Shadowsocks'}
                      value={orderData.password}
                      onChange={handlePasswordChange}
                      className="h-12 text-lg"
                      prefix={<CheckOutlined className="text-gray-400" />}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 附加选项 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <SettingOutlined className="text-blue-600" />
                </div>
                附加选项
              </h3>
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <div>
                  <div className="font-medium text-gray-800">UDP中转</div>
                  <div className="text-sm text-gray-500">启用UDP协议转发功能</div>
                </div>
                <Switch
                  size="large"
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  checked={orderData.udpForward}
                  onChange={(checked) => handleFormChange('udpForward', checked)}
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="min-h-[600px] bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8">
            {/* 标题和步骤指示器 */}
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-800 mb-4">选择付费周期</div>
              <div className="text-lg text-gray-600">时间越长，优惠越多</div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex justify-center items-center mb-12">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">节点选择</span>
                </div>
                <div className="w-16 h-1 bg-green-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">协议设置</span>
                </div>
                <div className="w-16 h-1 bg-green-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold">
                    <ClockCircleOutlined />
                  </div>
                  <span className="ml-2 text-emerald-600 font-medium">付费周期</span>
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
                    <WalletOutlined />
                  </div>
                  <span className="ml-2 text-gray-500">支付方式</span>
                </div>
              </div>
            </div>

            {/* 周期选择卡片 */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {periods.map((period) => (
                <div
                  key={period.value}
                  className={`relative border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl ${orderData.period === period.value
                      ? 'border-emerald-500 bg-emerald-50 shadow-xl transform scale-105'
                      : 'border-gray-200 hover:border-emerald-300 bg-white'
                    }`}
                  onClick={() => handlePeriodChange(period.value)}
                >
                  {/* {period.save && (
                    <div className="absolute -top-3 left-6 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      省{period.save}
                    </div>
                  )} */}
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {period.value === 'monthly' && '📅'}
                      {period.value === 'quarterly' && '🗓️'}
                      {period.value === 'half_yearly' && '📊'}
                      {period.value === 'yearly' && '🎯'}
                    </div>
                    <div className="font-bold text-2xl text-gray-800 mb-2">{period.label}</div>
                    <div className="text-emerald-600 font-bold text-3xl mb-2">¥{period.price}</div>
                    <div className="text-gray-600 text-sm mb-3">{period.description}</div>
                    <div className="bg-gray-100 rounded-lg p-2">
                      <div className="text-gray-700 text-sm">月均价格</div>
                      <div className="font-bold text-lg text-emerald-600">¥{period.perMonth}</div>
                    </div>
                  </div>
                  {orderData.period === period.value && (
                    <CheckCircleOutlined className="absolute top-4 right-4 text-emerald-500 text-2xl" />
                  )}
                </div>
              ))}
            </div>

            {/* 购买数量 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                  <ShoppingCartOutlined className="text-emerald-600" />
                </div>
                购买数量
              </h3>
              <div className="flex items-center space-x-4">
                <InputNumber
                  min={1}
                  max={100}
                  precision={0}
                  value={orderData.quantity}
                  onChange={(value) => handleQuantityChange(value)}
                  className="w-32 h-12 text-lg"
                />
                <div className="text-gray-600">个账号</div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="min-h-[600px] bg-gradient-to-br from-yellow-50 to-orange-100 rounded-2xl p-8">
            {/* 标题和步骤指示器 */}
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-800 mb-4">完成支付</div>
              <div className="text-lg text-gray-600">选择您的支付方式</div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex justify-center items-center mb-12">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">节点选择</span>
                </div>
                <div className="w-16 h-1 bg-green-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">协议设置</span>
                </div>
                <div className="w-16 h-1 bg-green-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckOutlined />
                  </div>
                  <span className="ml-2 text-green-600 font-medium">付费周期</span>
                </div>
                <div className="w-16 h-1 bg-orange-400"></div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                    <WalletOutlined />
                  </div>
                  <span className="ml-2 text-orange-600 font-medium">支付方式</span>
                </div>
              </div>
            </div>

            {/* 支付方式选择 */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                  <WalletOutlined className="text-orange-600" />
                </div>
                支付方式 <span className="text-red-500 ml-1">*</span>
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div
                  className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${orderData.paymentMethod === 'balance'
                      ? 'border-orange-500 bg-orange-50 shadow-lg transform scale-105'
                      : 'border-gray-200 hover:border-orange-300'
                    }`}
                  onClick={() => handleFormChange('paymentMethod', 'balance')}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">💳</div>
                    <div className="font-bold text-lg text-gray-800">余额支付</div>
                    <div className="text-sm text-gray-600 mt-2">使用账户余额支付</div>
                  </div>
                  {orderData.paymentMethod === 'balance' && (
                    <CheckCircleOutlined className="absolute top-3 right-3 text-orange-500 text-xl" />
                  )}
                </div>

                {/* 预留支付宝和微信支付位置，暂时注释 */}
                {/* <div className="border-2 border-gray-200 rounded-xl p-6 opacity-50 cursor-not-allowed">
                  <div className="text-center">
                    <div className="text-4xl mb-3">💰</div>
                    <div className="font-bold text-lg text-gray-800">支付宝</div>
                    <div className="text-sm text-gray-600 mt-2">即将开放</div>
                  </div>
                </div>
                <div className="border-2 border-gray-200 rounded-xl p-6 opacity-50 cursor-not-allowed">
                  <div className="text-center">
                    <div className="text-4xl mb-3">💚</div>
                    <div className="font-bold text-lg text-gray-800">微信支付</div>
                    <div className="text-sm text-gray-600 mt-2">即将开放</div>
                  </div>
                </div> */}
              </div>
            </div>

            {/* 优惠码 */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center mr-3">
                  <ShoppingCartOutlined className="text-pink-600" />
                </div>
                优惠码
              </h3>
              <Input
                placeholder="如有优惠码请输入"
                value={orderData.coupon}
                onChange={handleCouponChange}
                onBlur={handleCouponBlur}
                onKeyDown={handleCouponKeyDown}
                className="h-12 text-lg"
                prefix={<WalletOutlined className="text-gray-400" />}
              />
            </div>

            {/* 订单总计 */}
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg opacity-90">订单总计</div>
                  <div className="text-3xl font-bold">
                    {finalPrice ? (
                      <>
                        ¥{finalPrice.toFixed(2)}
                        <span className="text-lg opacity-70 line-through ml-3">¥{originalPrice?.toFixed(2)}</span>
                      </>
                    ) : (
                      `¥${originalPrice?.toFixed(2) || '0.00'}`
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-90">购买数量: {orderData.quantity} 个</div>
                  <div className="text-sm opacity-90">服务周期: {periods.find(p => p.value === orderData.period)?.label || '未选择'}</div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 主要内容区 */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* 固定底部导航栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              {/* 左侧总价显示 */}
              <div className="text-xl font-bold text-gray-800">
                总计：
                {finalPrice ? (
                  <>
                    <span className="text-blue-600 text-2xl">¥{finalPrice.toFixed(2)}</span>
                    <span className="text-gray-400 text-lg line-through ml-2">¥{originalPrice?.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="text-blue-600 text-2xl">¥{originalPrice?.toFixed(2) || '0.00'}</span>
                )}
              </div>

              {/* 右侧按钮区 */}
              <div className="flex space-x-4">
                {currentStep > 1 && (
                  <Button
                    size="large"
                    onClick={handlePrev}
                    icon={<LeftOutlined />}
                    className="h-12 px-6"
                  >
                    上一步
                  </Button>
                )}

                {currentStep < 4 ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleNext}
                    className="h-12 px-8 bg-gradient-to-r from-blue-500 to-purple-600 border-none"
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
                    className="h-12 px-8 bg-gradient-to-r from-orange-500 to-pink-600 border-none"
                  >
                    {isLogin ? '提交订单' : '请先登录'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部留白，避免内容被固定导航栏遮挡 */}
        <div className="h-24"></div>
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