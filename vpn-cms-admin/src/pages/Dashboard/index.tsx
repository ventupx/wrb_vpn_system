import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Typography, theme, Dropdown } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  TeamOutlined,
  UserOutlined,
  GiftOutlined,
  FileTextOutlined,
  LayoutOutlined,
  LogoutOutlined,
  DollarOutlined,
  OrderedListOutlined,
  BorderlessTableOutlined,
  MessageOutlined
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const { useToken } = theme;

interface UserInfo {
  username: string;
  user_type: 'agent_l1' | 'agent_l2';
}

const Dashboard: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useToken();

  useEffect(() => {
    // 从localStorage获取用户信息
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
  }, []);

  // 根据用户类型获取菜单项
  const getMenuItems = () => {
    const baseItems = [
      // {
      //   key: 'overview',
      //   icon: <DashboardOutlined />,
      //   label: '系统概览',
      // },
      {
        key: 'customer',
        icon: <UserOutlined />,
        label: '客户管理',
      },
      {
        key: 'orders',
        icon: <OrderedListOutlined />,
        label: '订单详情',
      },
      
      {
        key: 'cdk',
        icon: <GiftOutlined />,
        label: 'CDK优惠码',
      },
      
    ];

    // 只有一级代理才能看到的菜单项
    const agentL1Items = [
      {
        key: 'agent-panel',
        icon: <LayoutOutlined />,
        label: '代理面板管理',
      },
      {
        key: 'transit-panel',
        icon: <BorderlessTableOutlined />,
        label: '中转账号管理',
      },
      {
        key: 'agent',
        icon: <TeamOutlined />,
        label: '二级代理管理',
      },
      {
        key: 'news',
        icon: <FileTextOutlined />,
        label: '新闻发布',
      }
    ];

    // 只有二级代理才能看到的菜单项
    const agentL2Items = [
      {
        key: 'client-pricing',
        icon: <DollarOutlined />,
        label: '客户端定价',
      },
      {
        key: 'agent-custom-contact',
        icon: <DollarOutlined />,
        label: '指定客户定价',
      },
      // {
      //   key: 'website-setting',
      //   icon: <DesktopOutlined />,
      //   label: '网站模板设置',
      // },
      {
        key: 'agent-contact',
        icon: <MessageOutlined />,
        label: '代理联系方式',
      },{
        key: 'domain',
        icon: <MessageOutlined />,
        label: '中转域名管理',
      },
      {
        key: 'chat',
        icon: <MessageOutlined />,
        label: '聊天',
      }
    ];

    if (userInfo?.user_type === 'agent_l1') {
      return [...baseItems, ...agentL1Items];
    } else if (userInfo?.user_type === 'agent_l2') {
      return [...baseItems, ...agentL2Items];
    }
    return baseItems;
  };

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(`/dashboard/${key}`);
  };

  const handleMenuClickPath = ({ key }: { key: string }) => {
    if (key === 'logout') {
      localStorage.clear();
      navigate(`/login`);
    } else {
      navigate(`/dashboard/${key}`);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{
          background: '#001529',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
        theme="dark"
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <Title level={4} style={{ 
            margin: 0,
            color: '#fff',
            fontSize: collapsed ? '16px' : '18px',
            transition: 'all 0.3s',
          }}>
            {collapsed ? 'VPN' : 'VPN管理系统'}
          </Title>
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['overview']}
          selectedKeys={[location.pathname.split('/').pop() || 'overview']}
          style={{ 
            border: 'none',
            padding: '16px 0',
            background: '#001529',
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
          theme="dark"
          items={getMenuItems()}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ 
        marginLeft: collapsed ? '80px' : '200px',
        transition: 'all 0.2s',
      }}>
        <Header style={{ 
          padding: '0 24px',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          position: 'fixed',
          top: 0,
          right: 0,
          width: `calc(100% - ${collapsed ? '80px' : '200px'})`,
          zIndex: 99,
          transition: 'all 0.2s',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        }}>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'profile',
                  label: '个人资料',
                  icon: <UserOutlined />,
                },
                {
                  type: 'divider',
                },
                {
                  key: 'logout',
                  label: '退出登录',
                  icon: <LogoutOutlined />,
                },
              ],
              onClick: handleMenuClickPath,
            }}
            placement="bottomRight"
          >
            <Button type="text" icon={<UserOutlined />}>
              {userInfo?.username}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ 
          margin: '88px 24px 24px',
          padding: 24,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          minHeight: 280,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard; 