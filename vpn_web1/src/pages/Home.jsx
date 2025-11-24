import { Button, Card, Row, Col, Rate } from 'antd';
import { motion } from 'framer-motion';
import { RocketOutlined, LockOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate= useNavigate();
  const features = [
    {
      icon: <RocketOutlined className="text-4xl text-blue-600" />,
      title: '高速连接',
      description: '全球服务器节点，提供稳定高速的网络连接',
    },
    {
      icon: <LockOutlined className="text-4xl text-blue-600" />,
      title: '安全加密',
      description: '采用先进的加密技术，保护您的网络隐私',
    },
    {
      icon: <GlobalOutlined className="text-4xl text-blue-600" />,
      title: '全球覆盖',
      description: '支持多个国家和地区的服务器节点',
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
        className="relative h-[400px] md:h-[600px] flex items-center justify-center text-white w-full"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop)',
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
          className="relative z-10 text-center px-4 max-w-7xl mx-auto"
        >
          <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6">
            安全、快速、稳定的网络代理服务
          </h1>
          <p className="text-base md:text-xl mb-6 md:mb-8 max-w-2xl mx-auto">
            保护您的网络隐私，畅享全球网络，让您的网络体验更加自由和安全
          </p>
    
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="w-full px-4 py-10 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-8 md:mb-12">
            为什么选择我们？
          </h2>
          <Row gutter={[16, 16]} className="px-2">
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <Card className="h-full text-center hover:shadow-lg transition-shadow">
                    <div className="mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="w-full px-4 py-10 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-8 md:mb-12">
            用户评价
          </h2>
          <Row gutter={[16, 16]} className="px-2">
            {testimonials.map((testimonial, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <UserOutlined className="text-2xl text-blue-600" />
                      </div>
                      <Rate disabled defaultValue={testimonial.rating} className="mb-4" />
                      <p className="text-gray-600 text-center mb-4 text-lg">
                        "{testimonial.content}"
                      </p>
                      <h4 className="font-semibold text-lg mb-1">{testimonial.name}</h4>
                      <p className="text-gray-500">{testimonial.role}</p>
                    </div>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="bg-blue-50 w-full py-10 md:py-16"
      >
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4 text-center">
            立即加入我们
          </h2>
          <p className="text-gray-600 mb-4 md:mb-6 text-center">
            联系客服，获取更多信息
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
    </div>
  );
};

export default Home; 