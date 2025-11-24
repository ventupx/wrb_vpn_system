import request  from '@/utils/request';
import type { ChatUser, ChatHistory, ChatSession } from './types';

// 获取代理的所有聊天用户
export async function getAgentChatUsers() {
  return request.get<ChatUser[]>('/chat/sessions/agent_chat_users/');
}

// 获取用户聊天历史
export async function getUserChatHistory(clientId: number) {
  return request.get<ChatHistory>('/chat/sessions/user_chat_history/', {
    params: {
      client_id: clientId,
    },
  });
}

// 创建或获取会话
export async function createOrGetSession() {
  return request.post<ChatSession>('/chat/sessions/');
}

// 发送文本消息
export async function sendTextMessage(sessionId: number, content: string) {
  return request.post(`/chat/sessions/${sessionId}/messages/`, {
    data: {
      content_type: 'text',
      content: content,
    },
  });
}

// 发送图片消息
export async function sendImageMessage(sessionId: number, imageFile: File) {
  console.log('发送图片消息:', {
    sessionId,
    imageFile: {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type,
    }
  });

  const formData = new FormData();
  formData.append('content_type', 'image');
  formData.append('image', imageFile);

  // 调试FormData内容
  for (const [key, value] of formData.entries()) {
    console.log(key, value);
  }

  return request.post(`/chat/sessions/${sessionId}/messages/`, {
    data: formData,
  });
}

// 标记消息为已读
export async function markMessagesAsRead(sessionId: number) {
  return request.post(`/chat/sessions/${sessionId}/mark_read/`);
}

// 清空聊天记录
export async function clearChatMessages(sessionId: number) {
  return request.post(`/chat/sessions/${sessionId}/clear_messages/`);
} 