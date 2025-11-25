from django.db import models
from django.utils import timezone

# Create your models here.

class AgentPanel(models.Model):
    PANEL_TYPE_CHOICES = [
        ('x-ui', 'x-ui'),
        ('3x-ui', '3x-ui'),
    ]

    ip_address = models.CharField(max_length=255, verbose_name='IP地址')
    ip = models.CharField(max_length=50, verbose_name='纯IP地址', null=True, blank=True)
    port = models.IntegerField(verbose_name='端口')
    username = models.CharField(max_length=255, verbose_name='用户名')
    password = models.CharField(max_length=255, verbose_name='密码')
    panel_type = models.CharField(max_length=10, choices=PANEL_TYPE_CHOICES, verbose_name='面板类型')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    is_online = models.BooleanField(default=False, verbose_name='是否在线')
    country = models.CharField(max_length=100, default='未知', verbose_name='国家')
    used_ports = models.TextField(default='', blank=True, verbose_name='已使用的端口')
    cookie = models.TextField(null=True, blank=True, verbose_name='登录Cookie')
    last_restart = models.DateTimeField(null=True, blank=True, verbose_name='最后重启时间')
    cpu_usage = models.FloatField(null=True, blank=True, verbose_name='CPU使用率')
    memory_usage = models.FloatField(null=True, blank=True, verbose_name='内存使用率')
    disk_usage = models.FloatField(null=True, blank=True, verbose_name='磁盘使用率')
    nodes_count = models.IntegerField(default=0, verbose_name='节点数量')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '代理面板'
        verbose_name_plural = '代理面板'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ip_address}:{self.port}"
