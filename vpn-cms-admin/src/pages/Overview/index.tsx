import React, { useEffect, useState } from 'react';
import { Card, Typography, Row, Col, Statistic, Button } from 'antd';
import { 
  ShopOutlined, 
  UserAddOutlined, 
  RiseOutlined,
  BarChartOutlined,
  CloudServerOutlined
} from '@ant-design/icons';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

interface SalesData {
  today: number;
  week: number;
  month: number;
  newCustomers: number;
}

const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState<SalesData>({
    today: 2580,
    week: 15800,
    month: 68500,
    newCustomers: 25
  });

  // 模拟月度销售数据
  const monthlySales = [
    { agent: "代理A", sales: 12500 },
    { agent: "代理B", sales: 9800 },
    { agent: "代理C", sales: 15600 },
    { agent: "代理D", sales: 8900 },
    { agent: "代理E", sales: 11200 }
  ];

  useEffect(() => {
    const chartDom = document.getElementById('salesChart');
    if (!chartDom) return;

    const myChart = echarts.init(chartDom);
    const option: EChartsOption = {
      title: {
        text: '本月代理销售额统计',
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: '{b}: ¥{c}'
      },
      grid: {
        top: 60,
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: monthlySales.map(item => item.agent),
        axisLabel: {
          interval: 0,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value',
        name: '销售额 (元)',
        nameTextStyle: {
          padding: [0, 0, 0, 30]
        },
        axisLabel: {
          formatter: '¥{value}'
        }
      },
      series: [
        {
          name: '销售额',
          type: 'bar',
          data: monthlySales.map(item => item.sales),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#40a9ff' }
            ])
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#40a9ff' },
                { offset: 1, color: '#69c0ff' }
              ])
            }
          },
          barWidth: '60%'
        }
      ]
    };

    myChart.setOption(option);

    const handleResize = () => {
      myChart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      myChart.dispose();
    };
  }, []);

  return (
    <div style={{                 
      borderRadius: 8,
      minHeight: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>系统概览</Title>
        <Button 
          type="primary" 
          icon={<CloudServerOutlined />}
          onClick={() => navigate('/node')}
        >
          节点详情
        </Button>
      </div>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{
              body: { padding: '24px 24px 20px' }
            }}
            style={{ height: '100%' }}
          >
            <Statistic
              title={<span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>今日销售额</span>}
              value={salesData.today}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
              prefix={<ShopOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
              suffix="¥"
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#8c8c8c' }}>
              较昨日 <span style={{ color: '#52c41a' }}>↑12%</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{
              body: { padding: '24px 24px 20px' }
            }}
            style={{ height: '100%' }}
          >
            <Statistic
              title={<span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>本周销售额</span>}
              value={salesData.week}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
              prefix={<RiseOutlined style={{ color: '#52c41a', marginRight: 8 }} />}
              suffix="¥"
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#8c8c8c' }}>
              较上周 <span style={{ color: '#52c41a' }}>↑8%</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{
              body: { padding: '24px 24px 20px' }
            }}
            style={{ height: '100%' }}
          >
            <Statistic
              title={<span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>本月销售额</span>}
              value={salesData.month}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
              prefix={<BarChartOutlined style={{ color: '#722ed1', marginRight: 8 }} />}
              suffix="¥"
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#8c8c8c' }}>
              较上月 <span style={{ color: '#52c41a' }}>↑15%</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{
              body: { padding: '24px 24px 20px' }
            }}
            style={{ height: '100%' }}
          >
            <Statistic
              title={<span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>今日新增客户</span>}
              value={salesData.newCustomers}
              valueStyle={{ color: '#fa8c16', fontSize: 24 }}
              prefix={<UserAddOutlined style={{ color: '#fa8c16', marginRight: 8 }} />}
            />
            <div style={{ marginTop: 8, fontSize: 13, color: '#8c8c8c' }}>
              较昨日 <span style={{ color: '#52c41a' }}>↑20%</span>
            </div>
          </Card>
        </Col>
      </Row>

      <Card 
        styles={{
          body: { padding: '24px 24px 0' }
        }}
      >
        <div id="salesChart" style={{ height: 400 }} />
      </Card>
    </div>
  );
};

export default Overview; 