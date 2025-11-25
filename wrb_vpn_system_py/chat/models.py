from django.db import models
from users.models import User

class ChatSession(models.Model):
    """聊天会话模型"""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='client_sessions', verbose_name='客户')
    agent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_sessions', verbose_name='代理', null=True, blank=True)
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '聊天会话'
        verbose_name_plural = '聊天会话'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.client.username} - {self.agent.username if self.agent else '未分配'}"


class ChatMessage(models.Model):
    """聊天消息模型"""
    MESSAGE_TYPE_CHOICES = [
        ('client', '客户消息'),
        ('agent', '代理消息'),
        ('system', '系统消息'),
    ]
    
    CONTENT_TYPE_CHOICES = [
        ('text', '文本消息'),
        ('image', '图片消息'),
    ]
    
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages', verbose_name='聊天会话')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages', verbose_name='发送者')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, verbose_name='消息类型')
    content_type = models.CharField(max_length=10, choices=CONTENT_TYPE_CHOICES, default='text', verbose_name='内容类型')
    content = models.TextField(verbose_name='消息内容', blank=True, null=True)
    image = models.ImageField(upload_to='chat_images/', verbose_name='聊天图片', blank=True, null=True)
    is_read = models.BooleanField(default=False, verbose_name='是否已读')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='发送时间')
    
    class Meta:
        verbose_name = '聊天消息'
        verbose_name_plural = '聊天消息'
        ordering = ['created_at']
    
    def __str__(self):
        content_preview = self.content[:20] if self.content else '[图片]' if self.image else '[空消息]'
        return f"{self.sender.username} - {content_preview} - {self.created_at.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def clean(self):
        """验证消息内容"""
        from django.core.exceptions import ValidationError
        if self.content_type == 'text' and not self.content:
            raise ValidationError('文本消息必须包含内容')
        if self.content_type == 'image' and not self.image:
            raise ValidationError('图片消息必须包含图片')
