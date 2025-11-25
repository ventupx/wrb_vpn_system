from django.db import models
from django.utils import timezone

class AgentPanel(models.Model):
    PANEL_TYPE_CHOICES = [
        ('x-ui', 'x-ui'),
        ('3x-ui', '3x-ui'),
    ]

    ip_address = models.CharField(max_length=100, verbose_name='IP地址')
    port = models.CharField(max_length=10, verbose_name='端口')
    username = models.CharField(max_length=100, verbose_name='用户名')
    password = models.CharField(max_length=100, verbose_name='密码')  # 明文存储密码
    panel_type = models.CharField(max_length=10, choices=PANEL_TYPE_CHOICES, verbose_name='面板类型')
    is_active = models.BooleanField(default=True, verbose_name='是否在线')
    last_restart = models.DateTimeField(default=timezone.now, verbose_name='最后重启时间')
    cpu_usage = models.FloatField(default=0, verbose_name='CPU使用率')
    memory_usage = models.FloatField(default=0, verbose_name='内存使用率')
    disk_usage = models.FloatField(default=0, verbose_name='硬盘使用率')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '代理面板'
        verbose_name_plural = '代理面板'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.ip_address}:{self.port})" 