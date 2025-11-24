import { Button, Card, Row, Col, Rate, BackTop } from 'antd';
import { RocketOutlined, LockOutlined, GlobalOutlined, UserOutlined, VerticalAlignTopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';

const Home = () => {
  const navigate = useNavigate();
  
  const features = [
    {
      icon: <GlobalOutlined className="text-4xl text-blue-600" />,
      title: '全球节点覆盖',
      description: '超过 50 个国家和地区的高速节点，随时随地畅享网络。',
    },
    {
      icon: <LockOutlined className="text-4xl text-blue-600" />,
      title: '安全加密保护',
      description: '采用军工级 AES-256 加密技术，确保您的网络访问安全无忧。',
    },
    {
      icon: <RocketOutlined className="text-4xl text-blue-600" />,
      title: '极速连接体验',
      description: '独特的网络优化技术，带来超快的连接速度。',
    },
  ];

  const option = {
    title: {
      text: '',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['美国', '日本', '新加坡', '韩国', '香港', '台湾', '英国'],
      axisLabel: {
        color: '#000',
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#000',
        fontSize: 12
      }
    },
    series: [
      {
        name: '节点速度',
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0,
              color: '#1890ff'
            }, {
              offset: 1,
              color: 'rgba(24,144,255,0.1)'
            }]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: [35, 43, 28, 42, 25, 30, 50],
        itemStyle: {
          color: '#1890ff'
        },
        lineStyle: {
          width: 3,
          color: '#1890ff'
        },
        symbol: 'circle',
        symbolSize: 8
      }
    ]
  };

  return (
    <div className="w-full">
      {/* Hero Section with Background Image */}
      <div 
        className="relative h-[600px] flex items-center justify-start text-white w-full"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
        
        {/* Content */}
        <div
          className="relative z-10 text-center px-12 m-auto"
        >
          <h1 className="text-5xl font-bold mb-6 text-blue-800">
          安全稳定的 VPN 服务
          </h1>
          <h1 className="text-5xl font-bold mb-6 text-blue-800">
          尽享无界网络体验
          </h1>
          <p className="text-xl mb-8 max-w-2xl text-gray-400">
          全球顶级服务器节点，军工级加密技术，为您提供高速、安全、稳定的网络访问体验。
          </p>
          <Button
            type="primary"
            size="large"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/register")}
          >
            立即体验
          </Button>
        </div>
      </div>
 {/* Platform Support Section */}
 <div className="w-full px-4 py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            全平台支持
          </h2>
          <p className="text-gray-600 text-center mb-12">
            我们的VPN服务支持所有主流平台和设备，随时随地保护您的网络安全
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 justify-items-center">
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🪟</div>
              <div className="text-gray-700">Windows</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🍎</div>
              <div className="text-gray-700">macOS</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🐧</div>
              <div className="text-gray-700">Linux</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">📱</div>
              <div className="text-gray-700">Android</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">📱</div>
              <div className="text-gray-700">iOS</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">📺</div>
              <div className="text-gray-700">Android TV</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 justify-items-center mt-12">
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🌐</div>
              <div className="text-gray-700">Chrome</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🦊</div>
              <div className="text-gray-700">Firefox</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl mb-2">🌐</div>
              <div className="text-gray-700">Edge</div>
            </div>
          </div>
        </div>
      </div>

     

      {/* VPN Benefits Section */}
      <div className="w-full px-4 py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            使用 VPN 应用有什么好处？
          </h2>
          <p className="text-gray-600 text-center mb-12">
            我们的 VPN 服务为您提供全方位的网络访问保护
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <div className="text-4xl text-blue-600">🔒</div>
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">安全访问内容</h3>
              <p className="text-gray-600 text-center">
                无论身在何处，即使是在国外，也可以安全地获取自己喜欢的内容。在设备上使用 VPN，即可享有更大的在线自由度，同时保持在线流量安全无虞。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <div className="text-4xl text-blue-600">🌍</div>
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">更改您的 IP 地址</h3>
              <p className="text-gray-600 text-center">
                连接到所选位置的 VPN 服务器，让您看起来就像在那个地方上网浏览。隐藏您的虚拟位置，免受他人窥探，享受更多在线隐私。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <div className="text-4xl text-blue-600">🛡️</div>
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">保护您的设备</h3>
              <p className="text-gray-600 text-center">
                使用公共 Wi-Fi 时提升设备安全性。VPN 通过加密保护您的互联网连接，阻止外部窥探。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* VPN Comparison Section */}
      <div className="w-full px-4 py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            付费 VPN 优于免费 VPN 的几大优势
          </h2>
          <p className="text-gray-600 text-center mb-12">
            为什么选择付费 VPN 服务是更明智的选择
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-blue-50 p-8 rounded-lg">
              <h3 className="text-xl font-bold text-blue-600 mb-4">付费 VPN</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>稳定可靠的高速连接，无速度限制</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>全球多个服务器节点，访问更自由</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>严格的隐私保护政策，不记录用户数据</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>24/7 专业客服支持</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>定期更新维护，确保服务质量</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-50 p-8 rounded-lg">
              <h3 className="text-xl font-bold text-gray-600 mb-4">免费 VPN</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  <span>连接速度慢，经常断线</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  <span>服务器节点有限，访问受限</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  <span>可能会收集和出售用户数据</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  <span>无客服支持，问题难以解决</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  <span>服务不稳定，安全性存疑</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Speed Chart Section */}
      <div className="w-full px-4 py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            全球节点实时速度
          </h2>
          <p className="text-gray-600 text-center mb-8">
            数据每 5 分钟更新一次，确保您获得最佳节点选择
          </p>
          <div className="bg-white p-6 rounded-lg shadow-lg" style={{ height: '400px' }}>
            <ReactECharts option={option} style={{ height: '100%' }} />
          </div>
        </div>
      </div>

     

      {/* Contact Section */}
      <div className="bg-black text-white w-full py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Row gutter={[24, 24]} justify="center">
            <Col xs={24} sm={8} md={6}>
              <Card className="bg-gray-800 text-white border-0 h-[140px] flex items-center justify-center">
                <div>
                  <h3 className="text-xl font-bold mb-4">联系我们</h3>
                  <p className="mb-2">邮箱：</p>
                  <p>电话：</p>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Card className="bg-gray-800 text-white border-0 h-[140px] flex items-center justify-center">
                <div>
                  <h3 className="text-xl font-bold mb-4">工作时间</h3>
                  <p className="mb-2">周一至周五：24H技术支持</p>
                  <p>周末：10:00 - 24:00</p>
                </div>
              </Card>
            </Col>
            
          </Row>
        </div>
      </div>
    </div>
  );
};

export default Home;