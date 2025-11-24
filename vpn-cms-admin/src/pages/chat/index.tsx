import React, { useState, useEffect, useRef } from 'react';
import { Card, List, Input, Button, Avatar, Badge, message, Modal, Popconfirm } from 'antd';
import { 
  PictureOutlined, 
  CopyOutlined, 
  CloseOutlined, 
  DeleteOutlined,
  PushpinOutlined,
  PushpinFilled
} from '@ant-design/icons';
import { formatDistance } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import styles from './index.module.less';
import type { ChatUser, Message } from './types';
import {
  getAgentChatUsers,
  getUserChatHistory,
  sendTextMessage,
  sendImageMessage,
  markMessagesAsRead,
  clearChatMessages,
} from './services';

const PINNED_USERS_KEY = 'pinned_chat_users';

const ChatPage: React.FC = () => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<{
    type: 'text' | 'image';
    content: string;
    file?: File;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    visible: boolean;
    url: string;
    scale: number;
    position: { x: number; y: number };
  }>({ visible: false, url: '', scale: 1, position: { x: 0, y: 0 } });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messageListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<HTMLImageElement>(null);

  // 从localStorage获取置顶用户
  const getPinnedUsers = (): number[] => {
    try {
      const pinnedUsers = localStorage.getItem(PINNED_USERS_KEY);
      return pinnedUsers ? JSON.parse(pinnedUsers) : [];
    } catch (error) {
      console.error('获取置顶用户失败:', error);
      return [];
    }
  };

  // 保存置顶用户到localStorage
  const savePinnedUsers = (pinnedUserIds: number[]) => {
    try {
      localStorage.setItem(PINNED_USERS_KEY, JSON.stringify(pinnedUserIds));
    } catch (error) {
      console.error('保存置顶用户失败:', error);
    }
  };

  // 处理置顶/取消置顶
  const handleTogglePin = (user: ChatUser, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发选择用户
    
    const pinnedUserIds = getPinnedUsers();
    let newPinnedUserIds: number[];
    
    if (user.isPinned) {
      // 取消置顶
      newPinnedUserIds = pinnedUserIds.filter(id => id !== user.id);
    } else {
      // 添加置顶
      newPinnedUserIds = [...pinnedUserIds, user.id];
    }
    
    savePinnedUsers(newPinnedUserIds);
    
    // 更新用户列表中的置顶状态
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        return { ...u, isPinned: !u.isPinned };
      }
      return u;
    });
    
    // 重新排序并更新状态
    setUsers(sortUsersByPinned(updatedUsers));
    
    // 如果当前选中的用户被更新了置顶状态，也需要更新selectedUser
    if (selectedUser && selectedUser.id === user.id) {
      setSelectedUser({ ...selectedUser, isPinned: !selectedUser.isPinned });
    }
  };

  // 根据置顶状态对用户列表进行排序
  const sortUsersByPinned = (userList: ChatUser[]): ChatUser[] => {
    return [...userList].sort((a, b) => {
      // 首先按照置顶状态排序
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // 如果置顶状态相同，则按照更新时间排序
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  };

  // 获取聊天用户列表
  const fetchChatUsers = async () => {
    try {
      const response = await getAgentChatUsers();
      const userList = response.data || response;
      
      // 获取置顶用户ID列表
      const pinnedUserIds = getPinnedUsers();
      
      // 为用户添加置顶标记
      const usersWithPinStatus = userList.map((user: ChatUser) => ({
        ...user,
        isPinned: pinnedUserIds.includes(user.id)
      }));
      
      // 按置顶状态排序
      setUsers(sortUsersByPinned(usersWithPinStatus));
    } catch {
      message.error('获取用户列表失败');
    }
  };

  // 获取聊天历史
  const fetchChatHistory = async (userId: number) => {
    try {
      setLoading(true);
      const response = await getUserChatHistory(userId);
      const chatHistory = response.data || response;
      setMessages(chatHistory.messages);
      // 标记消息为已读
      if (selectedUser?.session_id) {
        await markMessagesAsRead(selectedUser.session_id);
      }
    } catch {
      message.error('获取聊天记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!selectedUser?.session_id) return;

    try {
      if (previewContent) {
        // 发送预览内容
        if (previewContent.type === 'text') {
          console.log('发送文本消息:', previewContent.content);
          await sendTextMessage(selectedUser.session_id, previewContent.content);
        } else if (previewContent.type === 'image' && previewContent.file) {
          console.log('准备发送图片消息:', {
            file: previewContent.file,
            sessionId: selectedUser.session_id
          });
          await sendImageMessage(selectedUser.session_id, previewContent.file);
        }
        setPreviewContent(null);
      } else if (messageInput.trim()) {
        // 发送文本消息
        console.log('发送输入框文本消息:', messageInput);
        await sendTextMessage(selectedUser.session_id, messageInput);
        setMessageInput('');
      } else {
        return;
      }

      // 重新获取消息列表以显示新消息
      await fetchChatHistory(selectedUser.id);
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败');
    }
  };

  // 选择用户
  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    fetchChatHistory(user.id);
    // 清除预览内容
    setPreviewContent(null);
    setMessageInput('');
  };

  // 处理图片选择
  const handleImageSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewContent({
        type: 'image',
        content: e.target?.result as string,
        file: file,
      });
    };
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  // 处理图片粘贴
  const handleImagePaste = (file: File) => {
    handleImageSelect(file);
  };

  // 处理输入框粘贴事件
  const handleInputPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 检查是否有图片
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // 阻止默认的文本粘贴行为
        const file = item.getAsFile();
        if (file) {
          handleImagePaste(file);
        }
        return;
      }
    }
    // 如果没有图片，让输入框正常处理文本粘贴
  };



  // 监听图片预览的滚轮事件和键盘事件
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!imagePreview.visible) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleImageScale(delta);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imagePreview.visible) return;
      
      switch (e.key) {
        case 'Escape':
          handleCloseImagePreview();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleImageScale(0.2);
          break;
        case '-':
          e.preventDefault();
          handleImageScale(-0.2);
          break;
        case '0':
          e.preventDefault();
          resetImageScale();
          break;
      }
    };

    if (imagePreview.visible) {
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [imagePreview.visible]);

  // 移除预览内容
  const handleRemovePreview = () => {
    setPreviewContent(null);
  };

  // 打开图片预览
  const handleImagePreview = (imageUrl: string) => {
    setImagePreview({
      visible: true,
      url: imageUrl,
      scale: 1,
      position: { x: 0, y: 0 },
    });
  };

  // 关闭图片预览
  const handleCloseImagePreview = () => {
    setImagePreview({
      visible: false,
      url: '',
      scale: 1,
      position: { x: 0, y: 0 },
    });
    setIsDragging(false);
  };

  // 处理图片缩放
  const handleImageScale = (delta: number) => {
    setImagePreview(prev => {
      const newScale = Math.max(0.1, Math.min(5, prev.scale + delta));
      // 如果缩放到1以下，重置位置
      if (newScale <= 1) {
        return {
          ...prev,
          scale: newScale,
          position: { x: 0, y: 0 },
        };
      }
      return {
        ...prev,
        scale: newScale,
      };
    });
  };

  // 重置图片缩放
  const resetImageScale = () => {
    setImagePreview(prev => ({
      ...prev,
      scale: 1,
      position: { x: 0, y: 0 },
    }));
  };

  // 处理鼠标按下
  const handleMouseDown = (e: React.MouseEvent) => {
    if (imagePreview.scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePreview.position.x, y: e.clientY - imagePreview.position.y });
    }
  };

  // 处理鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imagePreview.scale > 1) {
      setImagePreview(prev => ({
        ...prev,
        position: {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        },
      }));
    }
  };

  // 处理鼠标抬起
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 删除对话
  const handleDeleteConversation = async () => {
    if (!selectedUser?.session_id) return;

    try {
      // 使用原有的清空API来删除对话内容
      await clearChatMessages(selectedUser.session_id);
      
      // 关闭当前选中的对话窗口
      setSelectedUser(null);
      setMessages([]);
      setPreviewContent(null);
      setMessageInput('');
      
      // 重新请求用户列表
      await fetchChatUsers();
      
      message.success('对话已删除');
    } catch (error) {
      console.error('删除对话失败:', error);
      message.error('删除对话失败');
    }
  };

  // 滚动到最新消息
  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  // 初始化获取用户列表
  useEffect(() => {
    fetchChatUsers();
    // 定期刷新用户列表
    const interval = setInterval(fetchChatUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // 消息列表更新时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatMessageTime = (time: string) => {
    return formatDistance(new Date(time), new Date(), {
      addSuffix: true,
      locale: zhCN,
    });
  };

  // 渲染消息内容
  const renderMessageContent = (msg: Message) => {
    if (msg.content_type === 'image') {
      const imageUrl = msg.image_url || msg.content;
      if (imageUrl) {
        return (
          <img 
            src={imageUrl} 
            alt="聊天图片" 
            className={styles.chatImage}
            onClick={() => handleImagePreview(imageUrl)}
          />
        );
      }
      return <span className={styles.imageError}>图片加载失败</span>;
    }
    return msg.content;
  };

  return (
    <div className={styles.chatContainer}>
      {/* 左侧用户列表 */}
      <Card className={styles.userList} title="聊天列表">
        <List
          dataSource={users}
          loading={loading}
          renderItem={(user) => (
            <List.Item
              className={`${styles.userItem} ${
                selectedUser?.id === user.id ? styles.selected : ''
              } ${user.isPinned ? styles.pinned : ''}`}
              onClick={() => handleSelectUser(user)}
            >
              <List.Item.Meta
                avatar={
                  <Badge count={user.unread_count} offset={[-8, 8]}>
                    <Avatar size={48} src={user.avatar} style={{ flexShrink: 0 }}>
                      {user.name?.charAt(0)}
                    </Avatar>
                  </Badge>
                }
                title={
                  <div className={styles.userNameContainer}>
                    <div className={styles.userName}>{user.name}</div>
                    <div 
                      className={styles.pinIcon} 
                      onClick={(e) => handleTogglePin(user, e)}
                      title={user.isPinned ? "取消置顶" : "置顶"}
                    >
                      {user.isPinned ? <PushpinFilled /> : <PushpinOutlined />}
                    </div>
                  </div>
                }
                description={
                  <div className={styles.lastMessage}>
                    {user.last_message?.content_type === 'image' 
                      ? '[图片]' 
                      : user.last_message?.content || '暂无消息'}
                  </div>
                }
              />
              <div className={styles.messageMeta}>
                <div className={styles.lastTime}>
                  {formatMessageTime(user.updated_at)}
                </div>
                {user.unread_count > 0 && (
                  <div className={styles.unreadIndicator} />
                )}
              </div>
            </List.Item>
          )}
        />
      </Card>

      {/* 右侧聊天区域 */}
      <Card className={styles.chatArea}>
        {selectedUser ? (
          <>
            <div className={styles.chatHeader}>
              <Avatar size={40} src={selectedUser.avatar}>
                {selectedUser.name?.charAt(0)}
              </Avatar>
              <div className={styles.headerInfo}>
                <span className={styles.headerUserName}>{selectedUser.name}</span>
                <span className={styles.onlineStatus}>在线</span>
              </div>
              <div className={styles.headerActions}>
                <Popconfirm
                  title="确定要删除这个对话吗？删除后将无法恢复。"
                  onConfirm={handleDeleteConversation}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    title="删除对话"
                  >
                    删除对话
                  </Button>
                </Popconfirm>
              </div>
            </div>
            <div className={styles.messageList} ref={messageListRef}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageItem} ${
                    msg.message_type === 'agent' ? styles.self : styles.other
                  }`}
                >
                  {msg.message_type !== 'agent' && (
                    <Avatar size={32} src={selectedUser.avatar} className={styles.messageAvatar}>
                      {selectedUser.name?.charAt(0)}
                    </Avatar>
                  )}
                  <div className={styles.messageBubble}>
                    <div className={styles.messageContent}>
                      {renderMessageContent(msg)}
                    </div>
                    <div className={styles.messageTime}>
                      {formatMessageTime(msg.created_at)}
                    </div>
                  </div>
                  {msg.message_type === 'agent' && (
                    <Avatar size={32} src="/agent-avatar.png" className={styles.messageAvatar}>
                      我
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.inputArea}>
              {/* 预览区域 */}
              {previewContent && (
                <div className={styles.previewArea}>
                  {previewContent.type === 'image' ? (
                    <img 
                      src={previewContent.content} 
                      alt="预览图片" 
                      className={styles.previewImage}
                    />
                  ) : (
                    <div className={styles.previewText}>
                      {previewContent.content}
                    </div>
                  )}
                  <button 
                    className={styles.removePreview}
                    onClick={handleRemovePreview}
                    title="移除预览"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              )}

              {/* 输入区域 */}
              <div className={styles.inputRow}>
                <Input.TextArea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onPaste={handleInputPaste}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="请输入消息...（Enter发送，Shift+Enter换行，支持Ctrl+V粘贴图片和文本）"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className={styles.messageInput}
                  disabled={!!previewContent}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageSelect(file);
                    }
                  }}
                />
                <Button 
                  type="default"
                  icon={<PictureOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  title="选择图片"
                  className={styles.imageButton}
                />
                <Button 
                  type="primary" 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() && !previewContent}
                  className={styles.sendButton}
                >
                  发送
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noChat}>
            <div className={styles.noChatIcon}>💬</div>
            <div className={styles.noChatText}>请选择一个聊天开始对话</div>
          </div>
        )}
      </Card>

      {/* 图片预览弹窗 */}
      <Modal
        open={imagePreview.visible}
        onCancel={handleCloseImagePreview}
        footer={null}
        width="100vw"
        style={{ 
          maxWidth: 'none',
          margin: 0,
          padding: 0,
          top: 0,
          height: '100vh'
        }}
        bodyStyle={{ 
          padding: 0, 
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 55px)',
          background: 'rgba(0, 0, 0, 0.9)'
        }}
        centered={false}
        closeIcon={
          <div style={{ 
            color: 'white', 
            fontSize: '24px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            ×
          </div>
        }
        title={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '12px 16px',
            margin: 0
          }}>
            <span style={{ fontSize: '16px', fontWeight: 'normal' }}>图片预览</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button 
                size="small" 
                onClick={() => handleImageScale(-0.2)}
                style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white' }}
              >
                缩小
              </Button>
              <span style={{ 
                minWidth: '60px', 
                textAlign: 'center',
                color: 'white',
                fontSize: '14px'
              }}>
                {Math.round(imagePreview.scale * 100)}%
              </span>
              <Button 
                size="small" 
                onClick={() => handleImageScale(0.2)}
                style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white' }}
              >
                放大
              </Button>
              <Button 
                size="small" 
                onClick={resetImageScale}
                style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white' }}
              >
                重置
              </Button>
            </div>
          </div>
        }
      >
        <div 
          style={{ 
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            ref={imagePreviewRef}
            src={imagePreview.url} 
            alt="图片预览" 
            style={{ 
              transform: `scale(${imagePreview.scale}) translate(${imagePreview.position.x}px, ${imagePreview.position.y}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              maxWidth: imagePreview.scale <= 1 ? '100%' : 'none',
              maxHeight: imagePreview.scale <= 1 ? '100%' : 'none',
              objectFit: 'contain',
              display: 'block',
              cursor: imagePreview.scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              userSelect: 'none'
            }}
            onDoubleClick={resetImageScale}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        </div>
        <div style={{ 
          position: 'absolute', 
          bottom: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          backdropFilter: 'blur(4px)'
        }}>
          滚轮缩放 · 双击重置 · 拖拽移动 · ESC关闭
        </div>
      </Modal>
    </div>
  );
};

export default ChatPage;
