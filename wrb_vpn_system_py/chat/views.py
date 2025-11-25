from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, F, Max, Case, When, Value, BooleanField, Count, Subquery, OuterRef
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from django.conf import settings
import os

from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer, ChatMessageSerializer
from users.models import User


class IsClientOrAgent(permissions.BasePermission):
    """自定义权限：只有客户或代理可以访问"""
    def has_object_permission(self, request, view, obj):
        # 检查用户是否是会话的客户或代理
        return (request.user.id == obj.client.id) or (request.user.id == obj.agent_id)


class ChatSessionViewSet(viewsets.ModelViewSet):
    """聊天会话视图集"""
    serializer_class = ChatSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # 根据用户角色返回不同的查询集
        if user.is_agent:
            # 代理可以看到分配给自己的会话
            return ChatSession.objects.filter(agent=user).order_by('-updated_at')
        else:
            # 客户只能看到自己的会话
            return ChatSession.objects.filter(client=user).order_by('-updated_at')
    
    def create(self, request, *args, **kwargs):
        """重写创建方法，实现用户只能有一个聊天会话的逻辑"""
        user = request.user
        
        # 检查用户是否是客户
        if user.is_agent:
            return Response(
                {"error": "代理不能创建聊天会话"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 查找用户是否已有聊天会话
        existing_session = ChatSession.objects.filter(client=user).first()
        
        if existing_session:
            # 如果存在旧会话，激活它
            if not existing_session.is_active:
                existing_session.is_active = True
                existing_session.updated_at = timezone.now()
                existing_session.save()
            
            # 返回现有会话
            serializer = self.get_serializer(existing_session)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # 获取客户的代理
        agent = user.parent if hasattr(user, 'parent') else None
        
        # 创建新会话
        session = ChatSession.objects.create(
            client=user,
            agent=agent,
            is_active=True
        )
        
        # 创建系统消息，记录会话创建
        ChatMessage.objects.create(
            session=session,
            sender=user,
            message_type='system',
            content='会话已创建',
            is_read=True
        )
        
        serializer = self.get_serializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_as_read(self, request, pk=None):
        """将会话中的消息标记为已读"""
        session = self.get_object()
        user = request.user
        
        if user.is_agent:
            # 代理将客户消息标记为已读
            unread_messages = ChatMessage.objects.filter(
                session=session,
                message_type='client',
                is_read=False
            )
        else:
            # 客户将代理消息标记为已读
            unread_messages = ChatMessage.objects.filter(
                session=session,
                message_type='agent',
                is_read=False
            )
        
        unread_messages.update(is_read=True)
        return Response({"status": "messages marked as read"}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def agent_chat_users(self, request):
        """获取当前代理下所有的聊天用户，按最近消息时间排序"""
        user = request.user
        
        # 检查用户是否是代理
        if not user.is_agent:
            return Response({"error": "只有代理可以访问此API"}, status=status.HTTP_403_FORBIDDEN)
        
        # 获取代理的所有会话
        sessions = ChatSession.objects.filter(agent=user).order_by('-updated_at')
        
        # 准备返回数据
        result = []
        for session in sessions:
            # 获取未读消息数量
            unread_count = ChatMessage.objects.filter(
                session=session,
                message_type='client',  # 客户发送的消息
                is_read=False  # 未读
            ).count()
            
            # 获取最后一条消息
            last_message = ChatMessage.objects.filter(
                session=session
            ).order_by('-created_at').first()
            
            # 构建最后一条消息的显示内容
            last_message_content = ''
            if last_message:
                if last_message.content_type == 'text':
                    last_message_content = last_message.content
                elif last_message.content_type == 'image':
                    last_message_content = '[图片]'
            
            # 构建用户信息
            client_info = {
                'id': session.client.id,
                'username': session.client.username,
                'name': session.client.name or session.client.username,
                'avatar': request.build_absolute_uri(session.client.avatar.url) if session.client.avatar else None,
                'session_id': session.id,
                'last_message': {
                    'content': last_message_content,
                    'content_type': last_message.content_type if last_message else 'text',
                    'created_at': last_message.created_at if last_message else session.created_at,
                    'message_type': last_message.message_type if last_message else ''
                },
                'unread_count': unread_count,
                'updated_at': session.updated_at
            }
            
            result.append(client_info)
        
        # 按最近消息时间排序
        result.sort(key=lambda x: x['updated_at'], reverse=True)
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def user_chat_history(self, request):
        """获取指定用户的聊天历史记录"""
        user = request.user
        client_id = request.query_params.get('client_id')
        
        # 检查用户是否是代理
        if not user.is_agent:
            return Response({"error": "只有代理可以访问此API"}, status=status.HTTP_403_FORBIDDEN)
        
        # 验证是否提供了客户ID
        if not client_id:
            return Response({"error": "请提供客户ID"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 获取客户信息
            client = User.objects.get(id=client_id)
            
            # 验证该客户是否属于当前代理
            if not client.parent or client.parent.id != user.id:
                return Response({"error": "您没有权限查看此用户的聊天记录"}, status=status.HTTP_403_FORBIDDEN)
            
            # 获取与该客户的聊天会话
            session = ChatSession.objects.filter(client=client, agent=user).first()
            
            if not session:
                return Response({"error": "未找到与该用户的聊天记录"}, status=status.HTTP_404_NOT_FOUND)
            
            # 获取聊天记录
            messages = ChatMessage.objects.filter(session=session).order_by('created_at')
            
            # 构建返回数据
            chat_history = {
                'session_info': {
                    'id': session.id,
                    'created_at': session.created_at,
                    'is_active': session.is_active,
                    'client': {
                        'id': client.id,
                        'username': client.username,
                        'name': client.name or client.username,
                        'avatar': request.build_absolute_uri(client.avatar.url) if client.avatar else None
                    }
                },
                'messages': []
            }
            
            # 添加消息记录
            for message in messages:
                message_data = {
                    'id': message.id,
                    'content': message.content,
                    'content_type': message.content_type,
                    'message_type': message.message_type,
                    'is_read': message.is_read,
                    'created_at': message.created_at,
                    'sender': {
                        'id': message.sender.id,
                        'username': message.sender.username,
                        'name': message.sender.name or message.sender.username,
                        'avatar': request.build_absolute_uri(message.sender.avatar.url) if message.sender.avatar else None
                    }
                }
                
                # 如果是图片消息，添加图片URL
                if message.content_type == 'image' and message.image:
                    message_data['image_url'] = request.build_absolute_uri(message.image.url)
                
                chat_history['messages'].append(message_data)
            
            return Response(chat_history)
            
        except User.DoesNotExist:
            return Response({"error": "未找到指定用户"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"获取聊天记录失败: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def unread_total(self, request):
        """获取当前用户的总未读消息数量"""
        user = request.user
        
        if user.is_agent:
            # 代理：统计所有客户发送的未读消息
            total_unread = ChatMessage.objects.filter(
                session__agent=user,
                message_type='client',
                is_read=False
            ).count()
        else:
            # 客户：统计代理发送的未读消息
            total_unread = ChatMessage.objects.filter(
                session__client=user,
                message_type='agent',
                is_read=False
            ).count()
        
        return Response({
            'total_unread_count': total_unread,
            'user_type': 'agent' if user.is_agent else 'client'
        })

    @action(detail=True, methods=['post'], url_path='clear_messages')
    def clear_messages(self, request, pk=None):
        """删除整个会话记录"""
        session = self.get_object()
        user = request.user
        
        # 检查权限：只有会话的客户或代理可以删除会话记录
        if user.id != session.client.id and user.id != session.agent_id:
            return Response({"error": "您没有权限删除此会话记录"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # 保存会话信息用于响应
            session_id = session.id
            client_name = session.client.name or session.client.username
            
            # 删除整个会话记录（由于模型中设置了CASCADE，相关的聊天消息也会被自动删除）
            session.delete()
            
            return Response({
                "status": "success", 
                "message": "会话记录已删除", 
                "deleted_session_id": session_id,
                "client_name": client_name
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": f"删除会话记录失败: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatMessageViewSet(viewsets.ModelViewSet):
    """聊天消息视图集"""
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # 获取会话ID
        session_id = self.kwargs.get('session_pk')
        if not session_id:
            return ChatMessage.objects.none()
        
        # 获取会话
        session = get_object_or_404(ChatSession, id=session_id)
        user = self.request.user
        
        # 验证用户是否有权限访问该会话
        if user.id != session.client.id and user.id != session.agent_id:
            return ChatMessage.objects.none()
        
        # 返回会话中的所有消息
        return ChatMessage.objects.filter(session=session).order_by('created_at')
    
    def get_serializer_context(self):
        """
        确保序列化器上下文中包含请求对象，用于构建完整的URL
        """
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        # 获取会话ID
        session_id = self.kwargs.get('session_pk')
        session = get_object_or_404(ChatSession, id=session_id)
        user = self.request.user
        
        # 验证用户是否有权限访问该会话
        if user.id != session.client.id and user.id != session.agent_id:
            raise permissions.PermissionDenied("您没有权限在此会话中发送消息")
        
        # 设置消息类型
        if user.is_agent:
            message_type = 'agent'
        else:
            message_type = 'client'
        
        # 获取内容类型，默认为文本
        content_type = self.request.data.get('content_type', 'text')
        
        # 验证消息内容
        if content_type == 'text':
            content = self.request.data.get('content', '').strip()
            if not content:
                raise serializers.ValidationError("文本消息不能为空")
        elif content_type == 'image':
            image = self.request.data.get('image')
            if not image:
                raise serializers.ValidationError("图片消息必须包含图片文件")
        
        # 更新会话的更新时间
        session.updated_at = timezone.now()
        session.save()
        
        # 保存消息
        serializer.save(session=session, sender=user, message_type=message_type)
