export interface UserInfo {
  id: number;
  username: string;
  name: string;
  avatar: string;
}

export interface Message {
  id: number;
  content: string | null;
  content_type: 'text' | 'image';
  message_type: 'system' | 'client' | 'agent';
  is_read: boolean;
  created_at: string;
  sender: UserInfo;
  image_url?: string;
}

export interface LastMessage {
  content: string;
  content_type?: 'text' | 'image';
  created_at: string;
  message_type: 'system' | 'client' | 'agent';
}

export interface ChatUser {
  id: number;
  username: string;
  name: string;
  avatar: string;
  session_id: number;
  last_message: LastMessage;
  unread_count: number;
  updated_at: string;
  isPinned?: boolean;
}

export interface ChatSession {
  id: number;
  client_info: UserInfo;
  agent_info: UserInfo;
  is_active: boolean;
  last_message: LastMessage;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatHistory {
  session_info: {
    id: number;
    created_at: string;
    is_active: boolean;
    client: UserInfo;
  };
  messages: Message[];
} 