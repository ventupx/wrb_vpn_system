from django.contrib import admin
from .models import ChatSession, ChatMessage

@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'client', 'agent', 'is_active', 'created_at', 'updated_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['client__username', 'agent__username']
    date_hierarchy = 'created_at'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'sender', 'message_type', 'content_type', 'content_preview', 'has_image', 'is_read', 'created_at']
    list_filter = ['message_type', 'content_type', 'is_read', 'created_at']
    search_fields = ['content', 'sender__username']
    date_hierarchy = 'created_at'
    readonly_fields = ['content_preview', 'has_image']
    
    def content_preview(self, obj):
        """显示内容预览"""
        if obj.content_type == 'text' and obj.content:
            return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
        elif obj.content_type == 'image':
            return '[图片消息]'
        return '[空消息]'
    content_preview.short_description = '内容预览'
    
    def has_image(self, obj):
        """显示是否有图片"""
        return bool(obj.image)
    has_image.boolean = True
    has_image.short_description = '包含图片'
