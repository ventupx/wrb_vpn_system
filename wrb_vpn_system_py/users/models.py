from django.contrib.auth.models import AbstractUser
from django.db import models
from panels.models import AgentPanel
from datetime import datetime
import random
import string

class User(AbstractUser):
    """自定义用户模型"""
    name = models.CharField(max_length=150, blank=True, verbose_name='姓名')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='头像')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='手机号')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='余额')
    is_agent = models.BooleanField(default=False, verbose_name='是否是代理')
    ip_address = models.CharField(max_length=50, blank=True, null=True, verbose_name='最后登录IP')
    last_login_ip = models.CharField(max_length=50, blank=True, null=True, verbose_name='最后登录IP')
    domain = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='注册域名'
    )
    template = models.CharField(
        max_length=10, 
        choices=[
            ('web_1', '模板一'),
            ('web_2', '模板二'),
            ('web_3', '模板三'),
            ('web_4', '模板四'),
        ],
        blank=True,
        null=True,
        verbose_name='网站模板'
    )
    
    
    # 新增普通类型价格字段
    normal_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='普通月付价格')
    normal_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='普通季付价格')
    normal_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='普通半年付价格')
    normal_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='普通年付价格')
    
    # 新增直播类型价格字段
    live_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='直播月付价格')
    live_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='直播季付价格')
    live_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='直播半年付价格')
    live_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='直播年付价格')
    
    # 二级代理自定义普通类型价格字段
    custom_normal_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义普通月付价格')
    custom_normal_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义普通季付价格')
    custom_normal_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义普通半年付价格')
    custom_normal_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义普通年付价格')
    
    # 二级代理自定义直播类型价格字段
    custom_live_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义直播月付价格')
    custom_live_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义直播季付价格')
    custom_live_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义直播半年付价格')
    custom_live_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义直播年付价格')
    
    # 新增中转类型价格字段
    transit_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='中转月付价格')
    transit_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='中转季付价格')
    transit_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='中转半年付价格')
    transit_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='中转年付价格')
    
    # 二级代理自定义中转类型价格字段
    custom_transit_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义中转月付价格')
    custom_transit_quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义中转季付价格')
    custom_transit_half_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义中转半年付价格')
    custom_transit_yearly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='自定义中转年付价格')
    
    # 默认中转账号
    default_transit_account = models.ForeignKey('transits.TransitAccount', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='默认中转账号')
    
    user_type = models.CharField(max_length=20, choices=[
        ('admin', '管理员'),
        ('editor', '编辑'),
        ('agent_l1', '一级代理'),
        ('agent_l2', '二级代理'),
        ('customer', '客户'),
    ], default='editor')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children', verbose_name='上级代理')
    created_at = models.DateTimeField(auto_now_add=True)
    
    # 客户特有字段
    agent = models.ForeignKey(
        AgentPanel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='所属代理'
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='是否已验证'
    )
    
    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'
        ordering = ['-created_at']

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # 将 first_name 和 last_name 合并为 name
        if not self.name:
            self.name = f"{self.first_name} {self.last_name}".strip()
        super().save(*args, **kwargs)


class Package(models.Model):
    """客户套餐"""
    name = models.CharField(max_length=100, verbose_name='套餐名称')
    type = models.CharField(max_length=20, choices=[
        ('monthly', '月付'),
        ('quarterly', '季付'),
        ('yearly', '年付'),
        ('traffic', '流量'),
    ], verbose_name='套餐类型')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='价格')
    traffic_total = models.BigIntegerField(verbose_name='总流量(字节)')
    validity_days = models.IntegerField(verbose_name='有效期(天)')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '套餐'
        verbose_name_plural = '套餐'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class CustomerPackage(models.Model):
    """客户购买的套餐"""
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='packages', verbose_name='客户')
    package = models.ForeignKey(Package, on_delete=models.SET_NULL, null=True, related_name='customers', verbose_name='套餐')
    purchase_date = models.DateTimeField(auto_now_add=True, verbose_name='购买日期')
    expire_date = models.DateTimeField(verbose_name='到期日期')
    traffic_used = models.BigIntegerField(default=0, verbose_name='已使用流量(字节)')
    traffic_total = models.BigIntegerField(verbose_name='总流量(字节)')
    is_active = models.BooleanField(default=True, verbose_name='是否有效')
    
    class Meta:
        verbose_name = '客户套餐'
        verbose_name_plural = '客户套餐'
        ordering = ['-purchase_date']
    
    def __str__(self):
        return f"{self.customer.username} - {self.package.name if self.package else '已删除套餐'}"


class LoginRecord(models.Model):
    """登录记录"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_records', verbose_name='用户')
    ip_address = models.CharField(max_length=50, verbose_name='IP地址')
    login_time = models.DateTimeField(auto_now_add=True, verbose_name='登录时间')
    device_info = models.CharField(max_length=255, blank=True, null=True, verbose_name='设备信息')
    
    class Meta:
        verbose_name = '登录记录'
        verbose_name_plural = '登录记录'
        ordering = ['-login_time']
    
    def __str__(self):
        return f"{self.user.username} - {self.login_time}"


class TrafficRecord(models.Model):
    """流量使用记录"""
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='traffic_records', verbose_name='客户')
    date = models.DateField(verbose_name='日期')
    traffic_used = models.BigIntegerField(default=0, verbose_name='使用流量(字节)')
    
    class Meta:
        verbose_name = '流量记录'
        verbose_name_plural = '流量记录'
        ordering = ['-date']
        unique_together = ['customer', 'date']
    
    def __str__(self):
        return f"{self.customer.username} - {self.date}"


# 添加WebsiteTemplate模型
class WebsiteTemplate(models.Model):
    """网站模板设置"""
    agent = models.OneToOneField(User, on_delete=models.CASCADE, related_name='website_template', verbose_name='所属代理')
    website_name = models.CharField(max_length=100, default='VPN服务', verbose_name='网站名称')
    logo = models.ImageField(upload_to='website_templates/logos/', null=True, blank=True, verbose_name='网站Logo')
    background = models.ImageField(upload_to='website_templates/backgrounds/', null=True, blank=True, verbose_name='主页背景图')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '网站模板设置'
        verbose_name_plural = '网站模板设置'
        
    def __str__(self):
        return f"{self.agent.username}的网站设置"


class PaymentOrder(models.Model):
    """支付订单模型"""
    PAYMENT_STATUS_CHOICES = [
        ('pending', '待支付'),
        ('success', '支付成功'),
        ('failed', '支付失败'),
        ('cancelled', '已取消'),
    ]
    
    PAYMENT_TYPE_CHOICES = [
        ('alipay', '支付宝'),
        ('wxpay', '微信支付'),
        ('other', '其他'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_orders', verbose_name='用户')
    trade_no = models.CharField(max_length=100, blank=True, null=True, verbose_name='易支付订单号')
    out_trade_no = models.CharField(max_length=100, unique=True, verbose_name='商户订单号')
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='other', verbose_name='支付方式')
    product_name = models.CharField(max_length=255, verbose_name='商品名称')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='商品金额')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', verbose_name='支付状态')
    param = models.TextField(blank=True, null=True, verbose_name='业务扩展参数')
    country = models.CharField(max_length=100, blank=True, null=True, verbose_name='节点国家')
    node_count = models.IntegerField(default=1, verbose_name='节点数量')
    node_protocol = models.CharField(max_length=20, blank=True, null=True, verbose_name='节点协议')
    is_processed = models.BooleanField(default=False, verbose_name='是否已处理')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '支付订单'
        verbose_name_plural = '支付订单'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.out_trade_no}: {self.product_name} ({self.amount})"


class NodeInfo(models.Model):
    """节点信息模型"""
    PROTOCOL_CHOICES = [
        ('vmess', 'VMess'),
        ('vless', 'VLESS'),
        ('shadowsocks', 'Shadowsocks'),
        ('socks', 'Socks'),
        ('http', 'HTTP'),
    ]
    
    NODE_STATUS_CHOICES = [
        ('active', '活跃'),
        ('inactive', '不活跃'),
        ('expired', '已过期'),
        ('deleted', '已删除'),
        ('pending', '待处理'),
    ]
    
    order = models.ForeignKey(PaymentOrder, on_delete=models.CASCADE, related_name='nodes', verbose_name='关联订单')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='nodes', verbose_name='用户')
    remark = models.CharField(max_length=255, null=True,verbose_name='节点备注')
    remark_custom = models.CharField(max_length=255, null=True,verbose_name='节点自定义备注')
    protocol = models.CharField(max_length=20, choices=PROTOCOL_CHOICES, verbose_name='协议类型')
    host_config = models.CharField(max_length=255,default='{}', verbose_name='节点信息')
    host = models.CharField(max_length=255, verbose_name='节点主机')
    port = models.IntegerField(verbose_name='节点端口')
    uuid = models.CharField(max_length=40, blank=True, null=True, verbose_name='UUID')
    node_user = models.TextField(blank=True, null=True, verbose_name='nodename')
    node_password = models.TextField(blank=True, null=True, verbose_name='nodepassword')
    panel_id = models.IntegerField(blank=True, null=True, verbose_name='面板ID')
    panel_node_id = models.IntegerField(blank=True, null=True, verbose_name='面板节点ID')
    status = models.CharField(max_length=20, choices=NODE_STATUS_CHOICES, default='active', verbose_name='节点状态')
    expiry_time = models.DateTimeField(null=True, blank=True, verbose_name='过期时间')
    config_text = models.TextField(blank=True, null=True, verbose_name='配置文本')
    qrcode_data = models.TextField(blank=True, null=True, verbose_name='二维码数据')
    udp = models.BooleanField(default=False, verbose_name='是否支持UDP')
    udp_config = models.TextField(blank=True, null=True, verbose_name='UDP配置信息')
    udp_host = models.CharField(max_length=255, blank=True, null=True, verbose_name='UDP中转主机')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '节点信息'
        verbose_name_plural = '节点信息'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['order']),
            models.Index(fields=['protocol']),
        ]
    
    def __str__(self):
        return f"{self.remark} ({self.protocol})"
    
    def save(self, *args, **kwargs):
        """重写保存方法，但跳过自动生成配置步骤"""
        # 直接调用父类的save方法
        super().save(*args, **kwargs)


class Invoice(models.Model):
    """发票模型"""
    INVOICE_STATUS_CHOICES = [
        ('pending', '待开具'),
        ('issued', '已开具'),
        ('cancelled', '已取消'),
    ]
    
    order = models.ForeignKey(PaymentOrder, on_delete=models.CASCADE, related_name='invoices', verbose_name='关联订单')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices', verbose_name='用户')
    invoice_no = models.CharField(max_length=100, unique=True, verbose_name='发票编号')
    title = models.CharField(max_length=255, verbose_name='发票抬头')
    tax_no = models.CharField(max_length=50, blank=True, null=True, verbose_name='税号')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='开票金额')
    content = models.CharField(max_length=255, default='技术服务费', verbose_name='发票内容')
    status = models.CharField(max_length=20, choices=INVOICE_STATUS_CHOICES, default='pending', verbose_name='发票状态')
    email = models.EmailField(max_length=100, blank=True, null=True, verbose_name='接收邮箱')
    remark = models.TextField(blank=True, null=True, verbose_name='备注')
    issued_at = models.DateTimeField(blank=True, null=True, verbose_name='开具时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '发票'
        verbose_name_plural = '发票'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['order']),
            models.Index(fields=['invoice_no']),
        ]
    
    def __str__(self):
        return f"发票 {self.invoice_no}: {self.title} ({self.amount})"
    
    def generate_invoice_no(self):
        """生成发票编号"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_suffix = ''.join(random.choices(string.digits, k=4))
        return f"FP{timestamp}{random_suffix}"
    
    def save(self, *args, **kwargs):
        """重写保存方法，自动生成发票编号"""
        if not self.invoice_no:
            self.invoice_no = self.generate_invoice_no()
        super().save(*args, **kwargs)


class ContactInfo(models.Model):
    """用户联系方式模型"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='contact_info')
    qq = models.CharField(max_length=20, null=True, blank=True, verbose_name='QQ号码')
    qq_qrcode = models.ImageField(upload_to='qrcodes/qq/', null=True, blank=True, verbose_name='QQ二维码')
    wechat = models.CharField(max_length=50, null=True, blank=True, verbose_name='微信号')
    wechat_qrcode = models.ImageField(upload_to='qrcodes/wechat/', null=True, blank=True, verbose_name='微信二维码')
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name='手机号码')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '联系方式'
        verbose_name_plural = verbose_name
        db_table = 'contact_info'

    def __str__(self):
        return f"{self.user.username}的联系方式"
