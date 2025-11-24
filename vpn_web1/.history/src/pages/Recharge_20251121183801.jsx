import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Radio,
  Input,
  Form,
  message,
  Switch,
  Space,
  InputNumber,
  Modal,
  QRCode
} from 'antd';
import { useSetAtom, useAtomValue } from 'jotai';
import { balanceAtom, isLoginAtom, updateBalance } from '../jotai';
import {
  AlipayOutlined,
  WechatOutlined,
  ReloadOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import { useNavigate } from 'react-router-dom';
import { generate2022Blake3Aes256GcmKey } from '../utils/password';
const Recharge = () => {
  const [pollingInterval, setPollingInterval] = useState(null);
  const setBalance = useSetAtom(balanceAtom);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedProtocol, setSelectedProtocol] = useState('Shadowsocks');
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(''); // 初始值为空，确保用户必须手动选择
  const [quantity, setQuantity] = useState(1);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, success, failed
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [prices, setPrices] = useState({});
  const [periods, setPeriods] = useState([]);

  // 获取价格数据
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await request.get('/prices/');
        if (response.code === 200) {
          const newPrices = response.data;
          setPrices(newPrices);
          const nodeType = form.getFieldValue('nodeType') || 'normal';
          const periods = getPeriods(nodeType);
          setPeriods(periods);
          // 设置默认周期为月付
          const defaultPeriod = 'monthly';
          form.setFieldsValue({ period: defaultPeriod });
          handlePeriodChange(defaultPeriod);
        } else {
          message.error(response.message || '获取价格失败');
        }
      } catch {
        message.error('获取价格失败，请重试');
      }
    };

    fetchPrices();
  }, [form]);

  // 监听nodeType和prices变化重新计算价格
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      const nodeType = form.getFieldValue('nodeType');
      setPeriods(getPeriods(nodeType));
      handlePeriodChange(form.getFieldValue('period'));
    }
  }, [prices, form.getFieldValue('nodeType')]);

  // 获取国家列表
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await request.get('/agent-panel/countries/');
        if (response.code === 200) {
          setCountries(response.data.map(country => ({
            label: country,
            value: country.toLowerCase()
          })));
        } else {
          message.error(response.message || '获取国家列表失败');
        }
      } catch {
        message.error('获取国家列表失败，请重试');
      } finally {
        setCountriesLoading(false);
      }
    };

    fetchCountries();
  }, []);

  // 生成随机字符串
  // const generateRandomString = () => {
  //   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  //   let result = '';
  //   for (let i = 0; i < 12; i++) {
  //     result += chars.charAt(Math.floor(Math.random() * chars.length));
  //   }
  //   return result;
  // };
  // 处理随机账号密码生成
  const handleGenerateCredentials = () => {
    // const username = generateRandomString();
    // const password = generateRandomString();
    // form.setFieldsValue({
    //   username,
    //   password
    // });
    const username = generate2022Blake3Aes256GcmKey();
    const password = generate2022Blake3Aes256GcmKey();
    form.setFieldsValue({
      username,
      password
    });
  };

  useEffect(() => {
    handleProtocolChange('Shadowsocks');
  }, []);

  // 处理协议切换
  const handleProtocolChange = (protocol) => {
    setSelectedProtocol(protocol);
    if (protocol === 'Shadowsocks') {
      const username = generate2022Blake3Aes256GcmKey();
      const password = generate2022Blake3Aes256GcmKey();
      form.setFieldsValue({
        username,
        password
      });
    } else {
      form.setFieldsValue({
        username: '',
        password: ''
      });
    }
  };

  const onFinish = async () => {
    try {
      // 获取表单数据
      const formData = form.getFieldsValue();

      // 检查付费周期是否已选择
      if (!formData.period) {
        message.error('请选择付费周期');
        // 滚动到付费周期选择区域
        const periodSection = document.querySelector('.bg-white.p-8.h-fit.rounded-xl');
        if (periodSection) {
          periodSection.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      await handlePayment();
    } catch (err) {
      message.error('支付请求失败，请重试');
    }
  };

  const protocols = [
    // { label: 'Http', color: '#1890ff' },
    // { label: 'Socks', color: '#52c41a' },
    { label: 'Shadowsocks', color: '#722ed1' },
    // { label: 'Vmess', color: '#fa8c16' },
    // { label: 'Vless', color: '#f5222d' }
  ];

  const nodeTypes = [
    { label: '店铺线路', value: 'normal' },
    { label: '直播线路', value: 'live' },
    { label: '视频线路', value: 'transit' }
  ];

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

  const [finalPrice, setFinalPrice] = useState(null);
  const [originalPrice, setOriginalPrice] = useState(null);


  // 处理优惠码验证和价格计算
  // 验证优惠码
  const validateCoupon = async (couponCode) => {
    try {
      const response = await request.post('/coupon/validate/', {
        coupon_code: couponCode
      });

      if (response.valid) {
        const currentPeriod = form.getFieldValue('period');
        const periodData = periods.find(p => p.value === currentPeriod);
        const discount = response.discount / 100;
        setFinalPrice(Number(periodData.price) * (1 - discount) * quantity);
        setOriginalPrice(Number(periodData.price) * quantity);
        message.success('优惠码验证成功');
      } else {
        setFinalPrice(null);
        setOriginalPrice(Number(periodData.price) * quantity);
        message.error(response.message || '优惠码无效');
      }
    } catch {
      message.error('优惠码验证失败，请重试');
    }
  };

  const handleCouponChange = (e) => {
    const couponCode = e.target.value;
    if (!couponCode) {
      setFinalPrice(null);
      const currentPeriod = form.getFieldValue('period');
      const periodData = periods.find(p => p.value === currentPeriod);
      setOriginalPrice(Number(periodData.price) * quantity);
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

    setSelectedPeriod(value);
    const nodeType = form.getFieldValue('nodeType');
    const periods = getPeriods(nodeType);
    const periodData = periods.find(p => p.value === value);
    const couponCode = form.getFieldValue('coupon');
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
          setFinalPrice(Number(periodData.price) * (1 - discount) * quantity);
          setOriginalPrice(Number(periodData.price) * quantity);
        } else {
          setFinalPrice(null);
          setOriginalPrice(Number(periodData.price) * quantity);
        }
      } catch {
        setFinalPrice(null);
        setOriginalPrice(Number(periodData.price) * quantity);
      }
    } else {
      setFinalPrice(null);
      setOriginalPrice(Number(periodData.price) * quantity);
    }
  };

  // 处理数量变更
  const handleQuantityChange = async (value) => {
    setQuantity(value);
    const currentPeriod = form.getFieldValue('period');
    const nodeType = form.getFieldValue('nodeType');
    const priceData = prices[nodeType === 'normal' ? 'normal' : nodeType === 'live' ? 'live' : 'transit'];
    const couponCode = form.getFieldValue('coupon');

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
      const formData = form.getFieldsValue();
      // 校验表单数据是否有空 (排除 coupon 字段)
      const hasEmpty = Object.entries(formData).some(([key, value]) => {
        if (key === 'coupon') {
          return false; // 忽略 coupon 字段
        }
        return value === undefined || value === null || value === '';
      });

      // 特别检查付费周期是否已选择
      if (!formData.period) {
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
      const paymentEndpoint = formData.paymentMethod === 'balance' ? '/balance-payment/' : '/payment/submit/';
      const response = await request.post(paymentEndpoint, formData);

      // 兼容不同的API响应格式
      if (response.code == 1 || response.code == 200) {
        if (formData.paymentMethod === 'balance') {
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
      message.info('支付后台处理节点中，请查看订单状态，或联系客服处理。');
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
            updateBalance(setBalance, yueResponse.data.balance);
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
        updateBalance(setBalance, yueResponse.data.balance);
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

  return (
    <div className="w-full px-4">
      <Card className="shadow-xl rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            选择最适合您的付费方式
          </h1>
          <p className="text-gray-600 mb-8 text-center text-lg">
            我们提供多种付费周期选择，时间越长优惠越多。
          </p>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              protocol: 'Http',
              region: countries[0]?.value,
              nodeType: 'normal',
              // 移除period默认值，强制用户手动选择
              paymentMethod: 'balance',
              udpForward: false, // 新增初始值
            }}
            className="space-y-8"
          >
            {/* 节点选择区域 */}
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <GlobalOutlined className="mr-2 text-blue-500" />
                节点选择
              </h2>

              <div className="space-y-6">
                {/* 节点国家 */}
                <Form.Item
                  name="region"
                  label={<span className="text-lg font-medium">节点国家</span>}
                  rules={[{ required: true, message: '请选择节点国家' }]} // 可选，增加校验
                >
                  <Radio.Group size="large">
                    <Space wrap className="w-full">
                      {countries.map(region => (
                        <Radio.Button
                          key={region.value}
                          value={region.value}
                          className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow"
                        >
                          <div className="text-center">
                            <div className="text-lg">{region.label}</div>
                          </div>
                        </Radio.Button>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>

                {/* 节点类型 */}
                <Form.Item
                  name="nodeType"
                  label={<span className="text-lg font-medium">节点类型</span>}
                >
                  <Radio.Group size="large" onChange={(e) => {
                    // 在这里添加自定义逻辑
                    const nodeType = e.target.value;
                    setPeriods(getPeriods(nodeType));
                    handlePeriodChange(form.getFieldValue('period'))
                  }}>
                    <Space wrap className="w-full">
                      {nodeTypes.map(type => (
                        <Radio.Button
                          key={type.value}
                          value={type.value}
                          className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow"
                        >
                          <div className="text-center">
                            <div className="text-lg">{type.label}</div>
                          </div>
                        </Radio.Button>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>
              </div>
            </div>

            {/* 协议设置区域 */}
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <PlayCircleOutlined className="mr-2 text-blue-500" />
                协议设置
              </h2>

              <div className="space-y-6">
                {/* 协议选择 */}
                <Form.Item
                  name="protocol"
                  label={<span className="text-lg font-medium">协议选择</span>}
                >
                  <Radio.Group onChange={(e) => handleProtocolChange(e.target.value)} size="large">
                    <Space wrap className="w-full flex-wrap">
                      {protocols.map(protocol => (
                        <Radio.Button
                          key={protocol.label}
                          value={protocol.label}
                          className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow text-lg"
                          style={{
                            borderColor: selectedProtocol === protocol.label ? protocol.color : undefined,
                            color: selectedProtocol === protocol.label ? protocol.color : undefined
                          }}
                        >
                          {protocol.label}
                        </Radio.Button>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>

                {/* 账号设置 */}
                {(selectedProtocol === 'Http' || selectedProtocol === 'Socks' || selectedProtocol === 'Shadowsocks') && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">账号设置</span>
                      <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={handleGenerateCredentials}
                        className="bg-blue-500 h-10 text-base"
                      >
                        随机生成
                      </Button>
                    </div>

                    {(selectedProtocol === 'Http' || selectedProtocol === 'Socks') && (
                      <Form.Item
                        name="username"
                        rules={[
                          { required: true, message: '请输入用户名' },
                          { min: 4, message: '用户名至少4位' }
                        ]}
                      >
                        <Input
                          placeholder="请输入用户名"
                          className="h-12 text-lg"
                        />
                      </Form.Item>
                    )}

                    <Form.Item
                      name="password"
                      rules={[
                        { required: true, message: '请输入密码' },
                        { min: 4, message: '密码至少4位' }
                      ]}
                    >
                      <Input
                        disabled={selectedProtocol === 'Shadowsocks'}
                        placeholder="请输入密码"
                        className="h-12 text-lg"
                      />
                    </Form.Item>
                  </div>
                )}

                {/* UDP转发选项 */}
                <Form.Item
                  name="udpForward"
                  valuePropName="checked"
                >
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-lg font-medium">是否需要节点中转</span>
                    <Switch
                      defaultChecked={false}
                      onChange={(checked) => {
                        form.setFieldValue('udpForward', checked);
                      }}
                    />
                  </div>
                </Form.Item>
              </div>
            </div>

            {/* 付费周期 */}
            <div className="bg-white p-8 h-fit rounded-xl shadow-sm border-2 border-amber-300">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                选择付费周期 <span className="text-red-500">*</span>
              </h2>
              <div className="text-amber-500 mb-4 flex items-center">
                <span className="mr-2">⚠️</span>
                <span>请务必选择一个付费周期，否则无法提交订单</span>
              </div>
              <Form.Item
                name="period"
                rules={[{ required: true, message: '请选择付费周期' }]}
              >
                <div className="w-full">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {periods.map(period => (
                      <div
                        key={period.value}
                        onClick={() => {
                          form.setFieldValue('period', period.value);
                          handlePeriodChange(period.value);
                        }}
                        className={`relative cursor-pointer rounded-xl transition-all
                          ${selectedPeriod === period.value ?
                            'ring-2 ring-blue-500 bg-blue-50' :
                            'bg-white hover:bg-gray-50 hover:shadow-md border border-gray-100 border-dashed border-orange-400'
                          }`}
                      >
                        <input
                          type="radio"
                          name="period"
                          value={period.value}
                          checked={selectedPeriod === period.value}
                          onChange={() => { }}
                          className="hidden"
                        />
                        <div className="p-6">
                          {/* 标题和主价格 */}
                          <div className="text-center">
                            <div className="text-xl font-medium text-gray-800 mb-2">
                              {period.label}
                            </div>
                            <div className="text-[32px] font-bold text-blue-600 leading-none mb-2">
                              ¥{period.price}
                            </div>
                          </div>

                          {/* 分割线 */}
                          <div className="my-4 border-t border-gray-100"></div>

                          {/* 优惠信息 */}
                          <div className="text-center space-y-3">
                            <div className="text-gray-600 text-sm">
                              {period.description}
                            </div>
                            <div className="text-blue-600 text-sm">
                              月均 ¥{period.perMonth}
                            </div>
                          </div>

                          {/* 最优惠标记 */}
                          {period.value === 'yearly' && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-medium rounded-md">
                              最优惠
                            </div>
                          )}

                          {/* 选中标记 */}
                          {selectedPeriod === period.value && (
                            <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Form.Item>

              {/* 购买数量 */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">选择购买数量</h3>
                <Form.Item
                  name="quantity"
                  initialValue={1}
                  rules={[
                    { required: true, message: '请输入购买数量' },
                    { type: 'number', min: 1, message: '数量必须大于0' }
                  ]}
                >
                  <InputNumber
                    min={1}
                    precision={0}
                    className="h-12 text-lg w-40"
                    placeholder="输入数量"
                    onChange={handleQuantityChange}
                  />
                </Form.Item>
              </div>
            </div>

            {/* 优惠码 */}
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                优惠码
              </h2>
              <Form.Item name="coupon">
                <Input
                  placeholder="请输入优惠码（如有）"
                  className="h-12 text-lg"
                  onChange={handleCouponChange}
                  onBlur={handleCouponBlur}
                  onKeyDown={handleCouponKeyDown}
                />
              </Form.Item>
            </div>

            {/* 价格显示 */}
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-800">
                总计金额：
                {finalPrice ? (
                  <>
                    <span className="text-blue-600 text-3xl">¥{finalPrice.toFixed(2)}</span>
                    <span className="text-gray-400 line-through ml-4">¥{originalPrice.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="text-blue-600 text-3xl">¥{originalPrice?.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* 支付方式 */}
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Form.Item
                name="paymentMethod"
                label={<span className="text-lg font-medium">支付方式</span>}
              >
                <Radio.Group size="large">
                  <Space wrap className="w-full">
                    {/* <Radio.Button
                      value="alipay"
                      className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow"
                    >
                      <div className="text-center flex items-center">
                        <AlipayOutlined className="text-2xl text-blue-500" />
                        <div className="mt-1 ml-2">支付宝</div>
                      </div>
                    </Radio.Button>
                    <Radio.Button
                      value="wxpay"
                      className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow"
                    >
                      <div className="text-center flex items-center">
                        <WechatOutlined className="text-2xl text-green-500" />
                        <div className="mt-1 ml-2">微信支付</div>
                      </div>
                    </Radio.Button> */}
                    <Radio.Button
                      value="balance"
                      className="h-16 w-40 flex items-center justify-center hover:shadow-md transition-shadow"
                    >
                      <div className="text-center flex items-center">
                        <span className="text-2xl text-orange-500">¥</span>
                        <div className="mt-1 ml-2">余额支付</div>
                      </div>
                    </Radio.Button>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </div>

            {/* 提交按钮 */}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={!isLogin}
              className="w-full h-16 text-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg"
            >
              {isLogin ? '提交订单' : '请先登录'}
            </Button>
          </Form>
        </div>
      </Card>

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