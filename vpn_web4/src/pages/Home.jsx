import { Button, Card, Row, Col, Rate, Collapse } from 'antd';
import { motion } from 'framer-motion';
import { RocketOutlined, LockOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate= useNavigate();
  const features = [
    {
      icon: <LockOutlined style={{ fontSize: 32 }} />,
      title: '增强安全性',
      description: '军事级加密技术保护您的数据和在线隐私',
      points: [
        'AES-256加密',
        '无日志政策',
        '断网保护',
        'DNS泄漏防护',
      ],
    },
    {
      icon: <RocketOutlined style={{ fontSize: 32 }} />,
      title: '闪电般速度',
      description: '优化的服务器，适用于流媒体、游戏和无延迟浏览',
      points: [
        '无限带宽',
        '无速度限制',
        '优化路由',
        '低延迟连接',
      ],
    },
    {
      icon: <GlobalOutlined style={{ fontSize: 32 }} />,
      title: '全球覆盖',
      description: '通过我们的全球服务器网络访问任何地区的内容',
      points: [
        '50多个国家的服务器',
        '绕过地理限制',
        '每个国家多个位置',
        '自动服务器选择',
      ],
    },
    {
      icon: <span className="anticon" style={{ fontSize: 32 }}><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><rect x="3" y="6" width="18" height="12" rx="2"/><rect x="7" y="10" width="2" height="4" rx="1"/><rect x="15" y="10" width="2" height="4" rx="1"/></svg></span>,
      title: '多种协议',
      description: '选择各种协议以满足您的特定需求',
      points: [
        'HTTP',
        'SOCKS',
        'Shadowsocks',
        'Vmess',
        'Vless',
      ],
    },
    {
      icon: <UserOutlined style={{ fontSize: 32 }} />,
      title: '多设备支持',
      description: '使用单一订阅连接所有设备',
      points: [
        'Windows、Mac、Linux',
        'iOS和Android',
        '智能电视',
        '路由器和游戏主机',
      ],
    },
    {
      icon: <span className="anticon" style={{ fontSize: 32 }}><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></span>,
      title: '优质支持',
      description: '24/7客户支持，帮助您解决任何问题',
      points: [
        '24/7维护支持',
        '电子邮件协助',
        '设置指南',
        '知识库',
      ],
    },
  ];

  const testimonials = [
    {
      name: '张先生',
      role: '企业用户',
      content: '速度非常快，客户服务也很贴心，使用体验很好！',
      rating: 5,
    },
    {
      name: '李女士',
      role: '个人用户',
      content: '节点覆盖范围广，无论去哪里都能连接，很方便！',
      rating: 5,
    },
    {
      name: '王先生',
      role: '技术总监',
      content: '安全性很高，对数据保护做得很好，值得推荐！',
      rating: 5,
    },
  ];

  return (
    <div className="w-full">
      {/* Hero Section with Background Image */}
      <div 
        className="relative h-[600px] flex items-center justify-center text-white w-full"
        style={{
          backgroundImage: 'url(/bg41.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        
        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center flex flex-col px-4 max-w-7xl mx-auto justify-center items-center"
        >
        <div className='text-gray-200 rounded-full bg-gray-100/20 w-fit px-4 mb-6'>全球超过50,000名用户的信赖之选</div>
          <h1 className="text-5xl font-bold mb-6">
            安全、快速、稳定的网络代理服务
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            通过我们遍布全球的高速VPN节点，安全私密地访问互联网。
          </p>
          <div className='flex gap-8'>
            <Button type='primary' size='large' className='bg-blue-600 hover:bg-blue-700' onClick={()=>navigate("/login")}>立即开始</Button>
            <Button type='dashed' size='large' className='bg-transparent text-white' onClick={()=>navigate("/recharge")}>查看套餐</Button>
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="w-full px-4 py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            为什么选择我们？
          </h2>
          <Row gutter={[24, 24]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <Card className="h-full text-left hover:shadow-lg transition-shadow">
                    <div className="mb-4 text-3xl">{feature.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-gray-600 mb-3">{feature.description}</p>
                    <ul className="text-gray-800 text-base pl-4 list-disc">
                      {feature.points.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* 全球节点网络 Section */}
      <div className="w-full px-4 py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
            全球节点网络
          </h2>
          <p className="text-center text-gray-500 mb-10">
            从我们遍布全球的高速节点网络中选择
          </p>
          <div className="flex flex-col gap-6 items-center">
            <div className="grid grid-cols-5 gap-6 w-full max-w-4xl">
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/id.png" alt="印尼" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">印尼</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/tw.png" alt="台湾" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">台湾</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/br.png" alt="巴西" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">巴西</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/de.png" alt="德国" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">德国</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/it.png" alt="意大利" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">意大利</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-6 w-full max-w-4xl">
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/sa.png" alt="沙特阿拉伯" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">沙特阿拉伯</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/fr.png" alt="法国" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">法国</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/jp.png" alt="日本" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">日本</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center">
                <img src="https://flagcdn.com/w80/us.png" alt="美国" className="mb-2 w-10 h-7 object-cover rounded" />
                <span className="text-base font-medium">美国</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-center cursor-pointer hover:bg-gray-100 transition">
                <span className="text-2xl mb-2 font-bold">...</span>
                <span className="text-base font-medium">更多</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    

      {/* CTA Section */}
      

      {/* 常见问题 Section */}
      <div className="w-full px-4 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">常见问题</h2>
          <p className="text-center text-gray-500 mb-10">查找关于我们VPN服务的常见问题答案</p>
          <Collapse accordion bordered={false} className="bg-white">
            <Collapse.Panel header="什么是VPN，为什么我需要它？" key="1">
              <div>VPN（虚拟专用网络）在您的设备和互联网之间创建安全、加密的连接。它有助于保护您的隐私，在公共Wi-Fi上保护您的数据，绕过地理限制，并防止ISP跟踪。</div>
            </Collapse.Panel>
            <Collapse.Panel header="我可以同时连接多少台设备？" key="2">
              <div>您可以在多个设备上同时使用我们的VPN服务，具体数量请参考您的套餐说明。</div>
            </Collapse.Panel>
            <Collapse.Panel header="您支持哪些协议？" key="3">
              <div>我们支持多种协议，包括HTTP、SOCKS、Shadowsocks、Vmess、Vless等，满足不同用户的需求。</div>
            </Collapse.Panel>
            <Collapse.Panel header="您是否保留用户活动日志？" key="4">
              <div>我们严格执行无日志政策，不会记录您的上网活动，保障您的隐私安全。</div>
            </Collapse.Panel>
            <Collapse.Panel header="我可以使用您的VPN观看流媒体服务吗？" key="5">
              <div>我们的部分节点支持流媒体解锁，您可以畅享全球主流流媒体平台。</div>
            </Collapse.Panel>
            <Collapse.Panel header="您接受哪些支付方式？" key="6">
              <div>我们支持多种支付方式，包括支付宝、微信、银行卡等。</div>
            </Collapse.Panel>
            <Collapse.Panel header="您提供退款保证吗？" key="7">
              <div>我们为新用户提供7天无理由退款保障，请放心体验我们的服务。</div>
            </Collapse.Panel>
          </Collapse>
        </div>
      </div>



      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="bg-blue-50 w-full py-16"
      >
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          准备好保护您的网络状态了吗
          </h2>
          <p className="text-gray-600 mb-6 text-center">
          加入数千名满意用户的行列，体验没有限制的互联网
          </p><p className="text-gray-600 mb-6 text-center">
            联系客服，获取更多优惠
          </p>
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={()=>navigate("/register")}
            >
              注册账号
            </Button>
          </div>
        </div>
      </motion.div>

      {/* 页脚 Section */}
      <div className="w-full bg-gray-50 pt-16 pb-8 mt-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 px-4">
          {/* VPN服务 */}
          <div>
            <div className="flex items-center mb-4">
              <GlobalOutlined className="text-2xl mr-2" />
              <span className="text-xl font-bold">VPN服务</span>
            </div>
            <div className="text-gray-600 mb-4">
              安全、快速、可靠的VPN服务，全球覆盖，支持多种协议。
            </div>
            <div className="flex gap-4 text-xl text-gray-500">
              <i className="fab fa-facebook-f"></i>
              <i className="fab fa-twitter"></i>
              <i className="fab fa-instagram"></i>
              <i className="fab fa-youtube"></i>
            </div>
          </div>
          {/* 快速链接 */}
          <div>
            <div className="text-xl font-bold mb-4">快速链接</div>
            <ul className="text-gray-600 space-y-2 cursor-pointer">
              <li onClick={()=>navigate("/")}>首页</li>
              <li onClick={()=>navigate("/news")}>新闻</li>
              <li onClick={()=>navigate("/recharge")}>购买</li>
              <li onClick={()=>navigate("/nodes")}>节点列表</li>
              <li onClick={()=>navigate("/orders")}>购买记录</li>
            </ul>
          </div>
          {/* 支持 */}
          <div>
            <div className="text-xl font-bold mb-4">支持</div>
            <ul className="text-gray-600 space-y-2">
              <li>
                <a href="https://github.com/2dust/v2rayn/releases" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">V2ary下载地址</a>
              </li>
            </ul>
          </div>
          {/* 联系我们 */}
          <div>
            <div className="text-xl font-bold mb-4">联系我们</div>
            <ul className="text-gray-600 space-y-2">
              <li><i className="fas fa-map-marker-alt mr-2"></i>123 VPN街, 安全城, 10001, 数字国家</li>
              <li><i className="fas fa-envelope mr-2"></i>support@vpnservice.com</li>
              <li><i className="fas fa-phone mr-2"></i>+1 (800) 123-4567</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 flex flex-col items-center">
          <div className="text-gray-400 text-sm mt-6">© 2024 VPN服务. 保留所有权利. &nbsp;&nbsp; 隐私政策 &nbsp; 服务条款 &nbsp; 退款政策</div>
        </div>
      </div>
    </div>
  );
};

export default Home; 