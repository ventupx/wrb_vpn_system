import React from 'react';
import { Navigate, RouteObject, createHashRouter } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Overview from '../pages/Overview';
import ForgotPassword from '../pages/ForgotPassword';
import News from '../pages/News';
import NewsEdit from '../pages/News/Edit';
import Profile from '../pages/Profile';
import CDKList from '@/pages/CDK';
import CDKEdit from '@/pages/CDK/Edit';
import AgentEdit from '@/pages/Agent/Edit';
import AgentList from '@/pages/Agent';
import CustomerList from '@/pages/Customer';
import CustomerDetail from '@/pages/Customer/detail';
import WebsiteTemplate from '@/pages/WebsiteTemplate';
import AgentPanel from '@/pages/AgentPanel';
import Nodes from '@/pages/AgentPanel/Nodes';
import Status from '@/pages/AgentPanel/Status';
import OrderList from '@/pages/Order';
import TransitPanel from '@/pages/TransitPanel';
import Node from '@/pages/Node';
import Settings from '@/pages/AgentPanel/Settings';
import ClientPricing from '@/pages/ClientPricing/index';
import AgentContact from '@/pages/AgentContact';
import AgentCustomContact from '@/pages/ClientPricing/AgentCustomContact';
import Chat from '@/pages/chat';
import DomainManagement from '@/pages/domain';

// 路由鉴权组件
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userInfo = localStorage.getItem('userInfo');
  
  if (!userInfo) {
    // 未登录，重定向到登录页
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 路由配置
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />
  },
  {
    path: '/dashboard',
    element: (
      <AuthRoute>
        <Dashboard />
      </AuthRoute>
    ),
    children: [
      {
        index: true,
        element: <CustomerList />
      },
      {
        path: 'client-pricing',
        element: <ClientPricing />
      }, 
      {
        path: 'overview',
        element: <Overview />
      },
      {
        path: 'news',
        element: <News />
      },
      {
        path: 'news/create',
        element: <NewsEdit />
      },
      {
        path: 'news/edit/:id',
        element: <NewsEdit />
      },
      {
        path: 'profile',
        element: <Profile />
      },
      {
        path: 'cdk',
        element: <CDKList />
      },
      {
        path: 'cdk/create',
        element: <CDKEdit />
      },
      // 二级代理管理
      {
        path: 'agent',
        element: <AgentList />
      },
      {
        path: 'agent/create',
        element: <AgentEdit />
      },
      {
        path: 'agent/edit/:id',
        element: <AgentEdit />
      },
      
      // 客户管理
      {
        path: 'customer',
        element: <CustomerList />
      },
      {
        path: 'customer/detail/:id',
        element: <CustomerDetail />
      },
      
      // 网站模板设置
      {
        path: 'website-setting',
        element: <WebsiteTemplate />
      },
      
      // 订单详情
      {
        path: 'orders',
        element: <OrderList />
      },
      
      // 代理面板管理
      {
        path: 'agent-panel',
        element: <AgentPanel />
      },
      {
        path: 'agent-panel/nodes/:id',
        element: <Nodes />
      },
      {
        path: 'agent-panel/status/:id',
        element: <Status />
      },
      {
        path: 'agent-panel/settings/:id',
        element: <Settings />
      },
      {
        path: 'transit-panel',
        element: <TransitPanel />
      },
      {
        path: 'node',
        element: <Node />
      },
      {
        path: 'agent-contact',
        element: <AgentContact />
      },
      {
        path: 'agent-custom-contact',
        element: <AgentCustomContact />
      },
      // 聊天
      {
        path: 'chat',
        element: <Chat />
      },
      // 域名映射管理
      {
        path: 'domain',
        element: <DomainManagement />
      },
    ]
  },
  {
    path: '*',
    element: <div className='h-[600px] flex items-center justify-center'>404 Not Found</div>
  }
];

// 创建 hash 路由
const router = createHashRouter(routes);

export default router; 