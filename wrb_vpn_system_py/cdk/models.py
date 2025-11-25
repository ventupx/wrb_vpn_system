from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class CDK(models.Model):
    code = models.CharField(max_length=32, unique=True, verbose_name='优惠码')
    discount = models.IntegerField(verbose_name='折扣百分比')
    max_uses = models.IntegerField(verbose_name='最大使用次数')
    used_count = models.IntegerField(default=0, verbose_name='已使用次数')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='创建人')
    valid_from = models.DateTimeField(verbose_name='生效时间')
    valid_until = models.DateTimeField(verbose_name='过期时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    is_active = models.BooleanField(default=True, verbose_name='是否有效')

    class Meta:
        verbose_name = 'CDK优惠码'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.code
