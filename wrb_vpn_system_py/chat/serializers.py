from rest_framework import serializers
from .models import ChatSession, ChatMessage
from users.models import User
from django.conf import settings
import os

class UserBasicSerializer(serializers.ModelSerializer):
    """用户基本信息序列化器"""
    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'avatar']


class ChatMessageSerializer(serializers.ModelSerializer):
    """聊天消息序列化器"""
    sender_info = UserBasicSerializer(source='sender', read_only=True)
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'session', 'sender', 'sender_info', 'message_type', 'content_type', 
                  'content', 'image', 'image_url', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender_info', 'created_at', 'session', 'sender', 'message_type', 'image_url']
    
    def get_image_url(self, obj):
        """获取图片的完整URL"""
        if obj.image:
            request = self.context.get('request')
            if request:
                # 使用request中的host来构建完整URL
                return request.build_absolute_uri(obj.image.url)
            else:
                # 如果没有request对象，只返回相对路径
                return obj.image.url
        return None
    
    def validate(self, data):
        """验证消息数据"""
        content_type = data.get('content_type', 'text')
        content = data.get('content')
        image = data.get('image')
        
        if content_type == 'text':
            if not content or content.strip() == '':
                raise serializers.ValidationError('文本消息不能为空')
        elif content_type == 'image':
            if not image:
                raise serializers.ValidationError('图片消息必须包含图片文件')
        
        return data


class ChatSessionSerializer(serializers.ModelSerializer):
    """聊天会话序列化器"""
    client_info = UserBasicSerializer(source='client', read_only=True)
    agent_info = UserBasicSerializer(source='agent', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatSession
        fields = ['id', 'client', 'client_info', 'agent', 'agent_info', 'is_active', 
                  'last_message', 'unread_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'client_info', 'agent_info', 'created_at', 'updated_at']
        extra_kwargs = {
            'client': {'write_only': True},
            'agent': {'write_only': True}
        }
    
    def get_last_message(self, obj):
        """获取最后一条消息"""
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            content_display = last_message.content if last_message.content_type == 'text' else '[图片]'
            return {
                'content': content_display,
                'content_type': last_message.content_type,
                'created_at': last_message.created_at,
                'message_type': last_message.message_type
            }
        return None
    
    def get_unread_count(self, obj):
        """获取未读消息数量"""
        request = self.context.get('request')
        if request and request.user:
            # 如果当前用户是客户，计算代理发送的未读消息数量
            if request.user.id == obj.client.id:
                return obj.messages.filter(message_type='agent', is_read=False).count()
            # 如果当前用户是代理，计算客户发送的未读消息数量
            elif request.user.id == obj.agent_id:
                return obj.messages.filter(message_type='client', is_read=False).count()
        return 0 