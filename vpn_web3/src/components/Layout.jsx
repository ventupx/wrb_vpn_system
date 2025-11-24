import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Space, Button, Tooltip, Popover, message, Badge } from 'antd';
import { HomeOutlined, GlobalOutlined, CreditCardOutlined, HistoryOutlined, UserOutlined, LogoutOutlined, KeyOutlined, QqOutlined, WechatOutlined, PhoneOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import request from '../utils/request';
import { Tag } from 'antd';
import { useAtomValue, useSetAtom } from 'jotai';
import { balanceAtom,isLoginAtom } from '../jotai';
import CustomerService from './CustomerService';
const { Header, Content, Footer } = Layout;

const LayoutComponent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [contactInfo, setContactInfo] = useState(null);
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const setIsLogin = useSetAtom(isLoginAtom);
  const setBalance = useSetAtom(balanceAtom);
  const isLogin = useAtomValue(isLoginAtom);
  
  const fetchUnreadCount = async () => {
    try {
      const response = await request.get('/chat/sessions/unread_total/');
      if (response) {
        setUnreadCount(response?.total_unread_count);
      }
    } catch {
      message.error('获取未读消息失败');
    }
  };
  let interval = null;

  useEffect(() => {
    fetchContactInfo();
    
    // 如果用户已登录，开始获取未读消息
    if (isLogin) {
      fetchUnreadCount(); // 立即获取一次
      interval = setInterval(fetchUnreadCount, 5000); // 每5秒获取一次
    }
    return () => clearInterval(interval); // 清理定时器
  }, [isLogin]);
  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      const response = await request.get('/agent-contact/');
      if (response.code === 200) {
        setContactInfo(response.data);
      }
    } catch {
      message.error('获取联系方式失败');
    }
  };

  const renderQRCode = (url, text) => {
    if (url) {
      return (
        <div className='w-fit h-fit'>
        <div className="text-left">
          {text}
        </div>
        <img src={url} alt="二维码" className="!w-52"/>
      </div>
      );
    }
    return <div className="p-4 text-center">{text}</div>;
  };

  // 需要隐藏header的路径
  const hideHeaderPaths = ['/login', '/register', '/forgot-password'];
  const shouldHideHeader = hideHeaderPaths.includes(location.pathname);

  const handleLogout = () => {
    localStorage.clear();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    // 更新jotai登录状态
    setIsLogin(false);
    // 清空余额状态
    setBalance(0);
    window.location.href = '/login';
  };
  
  const userMenuItems = [
    {
      key: 'changePassword',
      label: '修改密码',
      icon: <KeyOutlined />,
      onClick: () => navigate('/change-password')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout
    }
  ];

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页</Link>,
    },
    {
      key: '/news',
      icon: <GlobalOutlined />,
      label: <Link to="/news">新闻动态</Link>,
    },
    {
      key: '/recharge',
      icon: <CreditCardOutlined />,
      label: <Link to="/recharge">节点购买</Link>,
    },
    {
      key: '/nodes',
      disabled: !isLogin,
      icon: <GlobalOutlined />,
      label: <Link to="/nodes">已购节点</Link>,
    },
    {
      key: '/orders',
      disabled: !isLogin,
      icon: <HistoryOutlined />,
      label: <Link to="/orders">订单记录</Link>,
    },
  ];
  // 使用jotai获取余额状态
  const balance = useAtomValue(balanceAtom);

  return (
    <Layout className="min-h-screen">
      {!shouldHideHeader && (
        <Header className="bg-white shadow-sm fixed w-full z-50">
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
            <div className="text-2xl font-bold text-blue-600">Major VPN</div>
            <Menu
              mode="horizontal"
              
              selectedKeys={[location.pathname]}
              items={menuItems}
              className="border-0 flex-1 justify-center"
            />
            <div className="flex items-center space-x-4">
              {user ? (
                <Dropdown menu={{ items: userMenuItems }}>
                  <Space className="cursor-pointer">
                  <Tag color='green' className="text-gray-700">余额：{balance}</Tag>
                    <UserOutlined className="text-gray-500" />
                    <span className="text-gray-700">{user.username}</span>
                  </Space>
                </Dropdown>
              ) : (
                <>
                  <Link to="/login">
                    <Button type="text">登录</Button>
                  </Link>
                  <Link to="/register">
                    <Button type="primary">注册</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </Header>
      )}
      <div className={!shouldHideHeader ? "h-16" : ""}></div>
      <Content className="w-full">
        <Outlet />
      </Content>
      {!shouldHideHeader && (
        <Footer className="text-center bg-gray-50 w-full">
          <p className="text-gray-600">© 2024 SimpleVPN. All rights reserved.</p>
        </Footer>
      )}
      {contactInfo && (
        <div className="fixed right-4 bottom-20 flex flex-col gap-2 z-50">
           {user && (
            <Badge count={unreadCount} offset={[-5, 5]}>
              <Button
                type="primary"
                shape=""
                icon={<CustomerServiceOutlined  style={{ fontSize: '20px' }}/>}
                size="large"
                className="bg-purple-500 !w-[60px] !h-[60px] hover:bg-purple-600"
                onClick={() => setShowCustomerService(true)}
              />
            </Badge>
          )}
          {contactInfo.qq && (
            <Popover
              placement="left"
              content={renderQRCode(contactInfo.qq_qrcode_url, contactInfo.qq)}
              title="QQ联系方式"
            >
              <Button
                type="primary"
                icon={<QqOutlined  style={{ fontSize: '20px' }}/>}
                size="large"
                className="bg-blue-500 !w-[60px] !h-[60px] hover:bg-blue-600"
              />
            </Popover>
          )}
          {contactInfo.wechat && (
            <Popover
              placement="left"
              content={renderQRCode(contactInfo.wechat_qrcode_url, contactInfo.wechat)}
              title="微信联系方式"
            >
              <Button
                type="primary"
                icon={<WechatOutlined  style={{ fontSize: '20px' }}/>}
                size="large"
                className="bg-green-500 !w-[60px] !h-[60px] hover:bg-green-600"
              />
            </Popover>
          )}
          {contactInfo.phone && (
            <Tooltip placement="left" title={contactInfo.phone}>
              <Button
                type="primary"
                icon={<PhoneOutlined  style={{ fontSize: '20px' }}/>}
                size="large"
                className="bg-orange-500 !w-[60px] !h-[60px] hover:bg-orange-600"
              />
            </Tooltip>
          )}
        </div>
      )}
      <CustomerService
        visible={showCustomerService}
        onClose={() => setShowCustomerService(false)}
      />
    </Layout>
  );
};

export default LayoutComponent;