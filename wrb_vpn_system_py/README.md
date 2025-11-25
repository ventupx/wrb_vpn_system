# VPN CMS 管理系统

这是一个基于Django的VPN代理管理系统。

## 功能特点

1. 支持一级代理和二级代理两种用户类型
2. 用户信息包含注册时间、邮箱、电话、登录用户名、名字等
3. 二级代理账户由一级代理创建和管理
4. JWT Token认证，有效期7天
5. 一级代理可以管理其下属的二级代理
6. 支持邮箱找回密码功能
7. 支持用户名或邮箱登录

## 安装要求

- Python 3.8+
- MySQL 5.7+
- 其他依赖见requirements.txt

## 安装步骤

1. 克隆项目到本地
2. 创建虚拟环境（可选）
3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
4. 配置数据库连接（在settings.py中）
5. 配置邮箱设置（在settings.py中）
6. 运行数据库迁移：
   ```bash
   python manage.py migrate
   ```
7. 创建超级用户：
   ```bash
   python manage.py createsuperuser
   ```

## API接口

### 认证相关

- POST /api/token/
  - 用途：用户登录
  - 参数：
    - login: 用户名或邮箱
    - password: 密码
  - 返回：access token, refresh token, 用户信息

### 用户管理

- POST /api/users/create_sub_agent/
  - 用途：创建二级代理（仅一级代理可用）
  - 参数：username, password, email, phone等
  - 需要认证：是

- POST /api/users/reset_password/
  - 用途：重置密码
  - 参数：email
  - 需要认证：否

## 聊天系统图片发送功能

### 功能概述
聊天系统现在支持发送文本消息和图片消息两种类型。

### API接口

#### 发送文本消息
```
POST /api/chat/sessions/{session_id}/messages/
Content-Type: application/json

{
    "content_type": "text",
    "content": "这是一条文本消息"
}
```

#### 发送图片消息
```
POST /api/chat/sessions/{session_id}/messages/
Content-Type: multipart/form-data

{
    "content_type": "image",
    "image": [图片文件]
}
```

### 消息数据结构

#### 文本消息响应
```json
{
    "id": 1,
    "session": 1,
    "sender": 2,
    "sender_info": {
        "id": 2,
        "username": "user123",
        "name": "用户名",
        "avatar": "http://example.com/media/avatars/avatar.jpg"
    },
    "message_type": "client",
    "content_type": "text",
    "content": "这是一条文本消息",
    "image": null,
    "image_url": null,
    "is_read": false,
    "created_at": "2024-01-01T10:00:00Z"
}
```

#### 图片消息响应
```json
{
    "id": 2,
    "session": 1,
    "sender": 2,
    "sender_info": {
        "id": 2,
        "username": "user123",
        "name": "用户名",
        "avatar": "http://example.com/media/avatars/avatar.jpg"
    },
    "message_type": "client",
    "content_type": "image",
    "content": null,
    "image": "chat_images/image_123.jpg",
    "image_url": "http://example.com/media/chat_images/image_123.jpg",
    "is_read": false,
    "created_at": "2024-01-01T10:01:00Z"
}
```

### 支持的图片格式
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### 文件大小限制
- 单个图片文件最大10MB
- 建议图片尺寸不超过2048x2048像素

### 注意事项
1. 发送图片消息时，`content_type`必须设置为`"image"`
2. 发送文本消息时，`content_type`必须设置为`"text"`
3. 图片文件将存储在`media/chat_images/`目录下
4. 图片URL通过`image_url`字段返回完整的访问地址

### 错误处理
- 如果发送文本消息但内容为空，将返回400错误
- 如果发送图片消息但未包含图片文件，将返回400错误
- 如果图片格式不支持，将返回400错误

## 注意事项

1. 在生产环境中请修改SECRET_KEY
2. 配置正确的邮箱设置以启用密码重置功能
3. 确保数据库配置正确 