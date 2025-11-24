import { Modal, List, Input, Button, Avatar, Badge, message, Upload, Image, Tooltip } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { SendOutlined, CustomerServiceOutlined, UserOutlined, PictureOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons';
import request from '../utils/request';
import { useAtomValue } from 'jotai';
import { isLoginAtom } from '../jotai';

const CustomerService = ({ visible, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);
  const inputRef = useRef(null);
  
  // 图片相关状态
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  
  // 使用jotai监听登录状态
  const isLogin = useAtomValue(isLoginAtom);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
// 检查404并重新初始化会话
const handleSessionNotFound = async () => {
  console.log('会话不存在，重新创建会话');
  setSessionInfo(null);
  setMessages([]);
  await initSession();
};

// 标记消息为已读
const markMessagesAsRead = async () => {
  if (!sessionInfo?.id) return;
  
  try {
    await request.post(`/chat/sessions/${sessionInfo.id}/mark_read/`);
  } catch (error) {
    if (error.response?.status === 404) {
      await handleSessionNotFound();
    } else {
      console.error('标记已读失败:', error);
    }
  }
};
  useEffect(() => {
    if (visible) {
      // 弹窗打开时滚动到底部
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      // 标记消息为已读
      if (sessionInfo?.id) {
        markMessagesAsRead();
      }
    }
  }, [visible, sessionInfo?.id]);

  // 监听登录状态变化，只有登录时才初始化会话
  useEffect(() => {
    if (isLogin) {
      initSession();
    } else {
      // 用户未登录时清理会话信息和消息
      setSessionInfo(null);
      setMessages([]);
      clearPreview();
      // 清理定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isLogin]); // 依赖登录状态，当登录状态变化时重新执行

  useEffect(() => {
    // 清理之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 只有当界面可见且sessionInfo存在且有id时才设置定时器
    if (visible && sessionInfo?.id) {
      intervalRef.current = setInterval(() => {
        refreshMessages();
      }, 3000);
    }

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, sessionInfo?.id]); // 依赖visible和sessionInfo的id，只有界面打开且会话建立后才开始定时刷新

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, []);

  // 监听粘贴事件
  useEffect(() => {
    const handlePaste = async (e) => {
      if (!visible || !isLogin) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 处理图片
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImagePaste(file);
          }
          return;
        }
        
        // 处理文本
        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            setInputValue(prev => prev + text);
          });
        }
      }
    };

    if (visible) {
      document.addEventListener('paste', handlePaste);
    }

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [visible, isLogin]);

  // 处理粘贴的图片
  const handleImagePaste = (file) => {
    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      message.error('不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP 格式');
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      message.error('图片文件大小不能超过10MB');
      return;
    }

    // 如果文件没有名称，生成一个
    if (!file.name) {
      const timestamp = new Date().getTime();
      const extension = file.type.split('/')[1];
      Object.defineProperty(file, 'name', {
        value: `image_${timestamp}.${extension}`,
        writable: false
      });
    }

    console.log('处理图片文件:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // 创建预览URL
    const url = URL.createObjectURL(file);
    setPreviewImage(file);
    setPreviewImageUrl(url);
    setInputValue(''); // 清空文本输入
  };

  // 清除预览
  const clearPreview = () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPreviewImage(null);
    setPreviewImageUrl('');
  };

  const initSession = async () => {
    try {
      const response = await request.post('/chat/sessions/');
    
        setSessionInfo(response);
        // 添加系统消息
        const systemMessage = {
            content: response.last_message.content,
            created_at: response.last_message.created_at,
            message_type: 'system',
            is_read: true
        };

        // 获取历史消息
        const historyResponse = await request.get(`/chat/sessions/${response.id}/messages/`);

            // 如果有历史消息，将系统消息和历史消息合并
        if (historyResponse && historyResponse.length > 0) {
        setMessages(historyResponse);
        } else {
        // 如果没有历史消息，只显示系统消息
        setMessages([systemMessage]);
        }
        
        
        } catch (error) {
        console.error('初始化会话失败:', error);
        message.error('初始化会话失败');
        }
  };

  const refreshMessages = async () => {
    
    try {
      // 获取最新消息
      const historyResponse = await request.get(`/chat/sessions/${sessionInfo.id}/messages/`);
      if (historyResponse && historyResponse.length > 0) {
        setMessages(historyResponse);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        await handleSessionNotFound();
      } else {
        console.error('刷新消息失败:', error);
        // 静默失败，不显示错误提示以免打扰用户
      }
    }
  };

  const handleSend = async () => {
    // 检查登录状态
    if (!isLogin) {
      message.warning('请先登录后再使用客服功能');
      return;
    }
    
    if (!sessionInfo) return;
    
    // 检查是否有内容可发送
    const hasText = inputValue.trim();
    const hasImage = previewImage;
    
    if (!hasText && !hasImage) return;

    try {
      let response;
      
      if (hasImage) {
        // 发送图片消息
        const formData = new FormData();
        formData.append('content_type', 'image');
        formData.append('image', previewImage);
        
        // 调试信息
        console.log('发送图片:', previewImage);
        console.log('文件信息:', {
          name: previewImage.name,
          type: previewImage.type,
          size: previewImage.size
        });
        console.log('FormData内容:');
        for (let [key, value] of formData.entries()) {
          console.log(key, ':', value);
          if (value instanceof File) {
            console.log('  文件详情:', {
              name: value.name,
              type: value.type,
              size: value.size
            });
          }
        }
        
        response = await request.post(`/chat/sessions/${sessionInfo.id}/messages/`, formData);
        
        // 清除预览
        clearPreview();
      } else {
        // 发送文本消息
        response = await request.post(`/chat/sessions/${sessionInfo.id}/messages/`, {
          content_type: 'text',
          content: inputValue,
        });
        
        setInputValue('');
      }
      
      // 刷新消息列表
      if (response) {
        refreshMessages();
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        await handleSessionNotFound();
        // 重新尝试发送消息
        message.warning('会话已重新创建，请重新发送消息');
      } else {
        console.error('发送消息失败:', error);
        message.error('发送消息失败');
      }
    }
  };
 // 添加清空会话的函数
 const handleClearMessages = async () => {
  if (!isLogin || !sessionInfo?.id) {
    message.warning('请先登录后再使用此功能');
    return;
  }

  try {
    await request.post(`/chat/sessions/${sessionInfo.id}/clear_messages/`);
    message.success('会话已清空');
    setMessages([]);
    setSessionInfo(null);
      
      // 重新初始化一个新的会话
      await initSession();
  } catch (error) {
    if (error.response?.status === 404) {
      // 会话已不存在，直接重新创建
      await handleSessionNotFound();
      message.success('会话已重新创建');
    } else {
      console.error('清空会话失败:', error);
      message.error('清空会话失败');
    }
  }
};
  return (
    <Modal
    title={
      <div className="flex items-center justify-between w-full pr-12">
        <span>在线客服</span>
        {isLogin && sessionInfo && (
          <Tooltip title="清空会话历史">
            <Button
              danger
              icon={<ClearOutlined />}
              onClick={handleClearMessages}
              size="small"
            >
              清空会话
            </Button>
          </Tooltip>
        )}
      </div>
    }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1100}
      bodyStyle={{ padding: 0, height: '800px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100% - 80px)', backgroundColor: '#f5f5f5' }}>
          {!isLogin ? (
            // 未登录时显示提示信息
            <div className="flex flex-col items-center justify-center h-full">
              <CustomerServiceOutlined className="text-6xl text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">欢迎使用在线客服</h3>
              <p className="text-gray-500 text-center">
                请先登录您的账号后再使用客服功能
              </p>
            </div>
          ) : (
            // 已登录时显示聊天消息
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index}>
                  {message.message_type === 'system' ? (
                    <div className="w-full flex justify-center">
                      <div className="bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-full shadow-sm">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full flex ${message.message_type === 'client' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end max-w-[70%] ${message.message_type === 'client' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar 
                          size={40}
                          style={{ flexShrink: 0 }}
                          icon={message.message_type === 'client' ? <UserOutlined /> : <CustomerServiceOutlined />}
                          className={message.message_type === 'client' ? 'bg-blue-500' : 'bg-green-500'}
                        />
                        <div
                          className={`mx-3 p-3 rounded-2xl shadow-sm ${
                            message.message_type === 'client'
                              ? 'bg-blue-500 text-white rounded-br-sm'
                              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                          }`}
                          style={{
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                            lineHeight: '1.4'
                          }}
                        >
                          {message.content_type === 'image' ? (
                            <Image
                              src={message.image_url}
                              alt="聊天图片"
                              style={{ maxWidth: '200px', maxHeight: '200px' }}
                              className="rounded-lg"
                            />
                          ) : (
                            message.content
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t bg-white shadow-sm">
          {/* 图片预览区域 */}
          {previewImageUrl && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">图片预览</span>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearPreview}
                  className="text-gray-500 hover:text-red-500"
                />
              </div>
              <div className="flex justify-center">
                <Image
                  src={previewImageUrl}
                  alt="预览图片"
                  style={{ maxWidth: '150px', maxHeight: '150px' }}
                  className="rounded-lg"
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSend}
              placeholder={
                previewImageUrl 
                  ? "已选择图片，点击发送" 
                  : isLogin 
                    ? "请输入消息或粘贴图片..." 
                    : "请先登录后使用客服功能"
              }
              disabled={!isLogin || !!previewImageUrl}
              className="flex-1"
              style={{
                borderRadius: '20px',
                padding: '8px 16px',
                border: '1px solid #d9d9d9',
                fontSize: '14px'
              }}
              size="large"
            />
            
            {/* 图片上传按钮 */}
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImagePaste(file);
                return false; // 阻止自动上传
              }}
              disabled={!isLogin || !!previewImageUrl}
            >
              <Button
                type="default"
                icon={<PictureOutlined />}
                disabled={!isLogin || !!previewImageUrl}
                className="rounded-full"
                size="large"
                style={{
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </Upload>
            
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!isLogin || (!inputValue.trim() && !previewImageUrl)}
              className="rounded-full"
              icon={<SendOutlined />}
              size="large"
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerService; 