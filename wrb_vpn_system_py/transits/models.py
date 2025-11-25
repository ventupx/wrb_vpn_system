from django.db import models
from django.contrib.auth import get_user_model

# Create your models here.

User = get_user_model()

class TransitAccount(models.Model):
    """中转账号模型"""
    
    STATUS_CHOICES = [
        ('active', '启用'),
        ('inactive', '停用'),
        ('deleted', '已删除'),
    ]
    
    username = models.CharField(max_length=100, unique=True, verbose_name='账号')
    password = models.CharField(max_length=100, verbose_name='密码')
    token = models.CharField(max_length=100, default='', verbose_name='token')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='余额')
    
    # 使用JSON字符串保存流量信息
    traffic = models.TextField(default='{"used": 0, "total": 0}', verbose_name='流量')
    
    # 使用JSON字符串保存规则数
    rules = models.TextField(default='{"used": 0, "max": 10}', verbose_name='规则数')
    
    # 默认入口和出口
    default_inbound = models.TextField(default='{}', verbose_name='默认入口')
    default_outbound = models.TextField(default='{}', verbose_name='默认出口')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '中转账号'
        verbose_name_plural = '中转账号'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.username}"


class TransitDomain(models.Model):
    """中转域名模型"""
    
    name = models.CharField(max_length=100, verbose_name='名称')
    ip = models.CharField(max_length=255, verbose_name='IP地址或域名')
    domain = models.CharField(max_length=255, verbose_name='域名')
    agent = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='代理')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '中转域名'
        verbose_name_plural = '中转域名'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['agent']),
            models.Index(fields=['ip']),
            models.Index(fields=['domain']),
        ]
        # 确保同一代理下的名称唯一
        unique_together = ['agent', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.domain}"
