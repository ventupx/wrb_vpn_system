from rest_framework import serializers
from .models import News
from django.contrib.auth import get_user_model

User = get_user_model()

class NewsSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    updated_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = News
        fields = ['id', 'title', 'content', 'cover_image', 'cover_image_url', 
                 'author', 'author_name', 'created_at', 'updated_at']
        read_only_fields = ['author', 'created_at', 'updated_at']
        extra_kwargs = {
            'cover_image': {'write_only': True, 'required': False},
        }

    def get_author_name(self, obj):
        return obj.author.name or obj.author.username

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
        return None

    def validate_cover_image(self, value):
        if value:
            # 验证文件大小（限制为5MB）
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("图片大小不能超过5MB")
            
            # 验证文件类型
            allowed_types = ['image/jpeg', 'image/png', 'image/gif']
            if value.content_type not in allowed_types:
                raise serializers.ValidationError("只支持JPEG、PNG和GIF格式的图片")
        
        return value

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)

class NewsListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    content_preview = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = ['id', 'title', 'content_preview', 'cover_image_url', 
                 'author_name', 'created_at']

    def get_author_name(self, obj):
        return obj.author.name or obj.author.username

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
        return None

    def get_content_preview(self, obj):
        # 返回内容的前100个字符作为预览
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content 