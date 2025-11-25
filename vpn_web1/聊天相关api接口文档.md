获取代理的所有聊天用户API
API端点
URL: /chat/sessions/agent_chat_users/
方法: GET
权限: 需要认证，仅代理可访问
功能说明
此API会返回当前登录代理下的所有聊天用户列表，按照最近消息时间排序，并显示每个用户的未读消息数量。
返回数据格式
```JSON
[
  {
    "id": 10,                                               // 客户ID
    "username": "customer1",                                // 客户用户名
    "name": "张三",                                         // 客户姓名
    "avatar": "http://example.com/avatars/user1.jpg",       // 客户头像URL
    "session_id": 5,                                        // 聊天会话ID
    "last_message": {
      "content": "我想咨询一下VPN的价格",                   // 最后一条消息内容
      "created_at": "2023-06-15T08:30:45Z",                // 最后一条消息时间
      "message_type": "client"                             // 最后一条消息类型
    },
    "unread_count": 3,                                     // 未读消息数量
    "updated_at": "2023-06-15T08:30:45Z"                  // 会话更新时间
  },
  {
    "id": 12,
    "username": "customer2",
    "name": "李四",
    "avatar": "http://example.com/avatars/user2.jpg",
    "session_id": 8,
    "last_message": {
      "content": "谢谢您的帮助",
      "created_at": "2023-06-14T15:20:10Z",
      "message_type": "client"
    },
    "unread_count": 0,
    "updated_at": "2023-06-14T15:20:10Z"
  }
]
```

URL: /chat/sessions/
方法: POST
权限: 需要认证，仅客户可操作
返回状态:
200 OK: 返回已存在的会话
201 Created: 创建并返回新会话
403 Forbidden: 当代理尝试创建会话时

```JSON
{
  "id": 1,
  "client_info": {
    "id": 10,
    "username": "customer1",
    "name": "张三",
    "avatar": "http://example.com/avatars/user1.jpg"
  },
  "agent_info": {
    "id": 5,
    "username": "agent1",
    "name": "李四",
    "avatar": "http://example.com/avatars/agent1.jpg"
  },
  "is_active": true,
  "last_message": {
    "content": "会话已创建",
    "created_at": "2023-05-20T14:25:30Z",
    "message_type": "system"
  },
  "unread_count": 0,
  "created_at": "2023-05-20T14:25:30Z",
  "updated_at": "2023-05-20T14:25:30Z"
}

```


获取用户聊天历史API
基本信息
URL: /chat/sessions/user_chat_history/
方法: GET
权限: 需要认证，仅代理可访问
查询参数: client_id (必需) - 要查看的客户ID
```json
{
    "session_info": {
        "id": 1,
        "created_at": "2023-05-20T14:25:30Z",
        "is_active": true,
        "client": {
            "id": 123,
            "username": "customer1",
            "name": "张三",
            "avatar": "http://example.com/avatars/user1.jpg"
        }
    },
    "messages": [
        {
            "id": 1,
            "content": "会话已创建",
            "message_type": "system",
            "is_read": true,
            "created_at": "2023-05-20T14:25:30Z",
            "sender": {
                "id": 123,
                "username": "customer1",
                "name": "张三",
                "avatar": "http://example.com/avatars/user1.jpg"
            }
        },
        {
            "id": 2,
            "content": "您好，我想咨询一下VPN服务",
            "message_type": "client",
            "is_read": true,
            "created_at": "2023-05-20T14:26:00Z",
            "sender": {
                "id": 123,
                "username": "customer1",
                "name": "张三",
                "avatar": "http://example.com/avatars/user1.jpg"
            }
        },
        {
            "id": 3,
            "content": "您好，很高兴为您服务",
            "message_type": "agent",
            "is_read": true,
            "created_at": "2023-05-20T14:27:00Z",
            "sender": {
                "id": 456,
                "username": "agent1",
                "name": "李四",
                "avatar": "http://example.com/avatars/agent1.jpg"
            }
        }
    ]
}
```