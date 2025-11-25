from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
import logging
from django.contrib.auth.password_validation import validate_password
from .models import User, Package, CustomerPackage, LoginRecord, TrafficRecord, WebsiteTemplate, PaymentOrder, ContactInfo
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'avatar', 'balance', 'inviter',
            'is_superuser', 'is_staff', 'is_active', 'user_type',
            'node_protocol', 'node_multiplier', 'node_period',
            
            # 普通节点价格
            'normal_monthly_price', 'normal_quarterly_price', 
            'normal_half_yearly_price', 'normal_yearly_price',
            
            # 直播节点价格
            'live_monthly_price', 'live_quarterly_price', 
            'live_half_yearly_price', 'live_yearly_price',
            
            # 中转价格
            'transit_monthly_price', 'transit_quarterly_price',
            'transit_half_yearly_price', 'transit_yearly_price',
            
            # 自定义普通节点价格
            'custom_normal_monthly_price', 'custom_normal_quarterly_price',
            'custom_normal_half_yearly_price', 'custom_normal_yearly_price',
            
            # 自定义直播节点价格
            'custom_live_monthly_price', 'custom_live_quarterly_price',
            'custom_live_half_yearly_price', 'custom_live_yearly_price',
            
            # 自定义中转价格
            'custom_transit_monthly_price', 'custom_transit_quarterly_price',
            'custom_transit_half_yearly_price', 'custom_transit_yearly_price',
            
            # 默认中转账号
            'default_transit_account',
            
            'is_email_verified', 'package',
            'created_at', 'updated_at', 'cdk_count'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
        }

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            username = attrs.get('username')
            password = attrs.get('password')

            if not username or not password:
                raise serializers.ValidationError('用户名和密码不能为空')

            # 尝试使用用户名或邮箱登录
            user = None
            if '@' in username:
                try:
                    user = User.objects.get(email=username)
                except User.DoesNotExist:
                    raise serializers.ValidationError('邮箱不存在')
            else:
                try:
                    user = User.objects.get(username=username)
                except User.DoesNotExist:
                    raise serializers.ValidationError('用户名不存在')

            if not user.check_password(password):
                raise serializers.ValidationError('密码错误')

            # 设置用户对象
            self.user = user
            attrs['username'] = user.username

            # 调用父类的验证方法
            data = super().validate(attrs)
            
            # 构造响应数据
            data['user'] = {
                'id': self.user.id,
                'username': self.user.username,
                'user_type': self.user.user_type,
                'parent_username': self.user.parent.username if self.user.user_type == 'agent_l2' and self.user.parent else None,
                'parent_id': self.user.parent.id if self.user.user_type == 'agent_l2' and self.user.parent else None,
            }
            
            return data
        except Exception as e:
            raise serializers.ValidationError(str(e))

class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        try:
            User.objects.get(email=value)
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError('该邮箱未注册')

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'name', 'phone', 'avatar')
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'name': {'required': True}
        }

    def validate_email(self, value):
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value

    def validate_username(self, value):
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("该用户名已被使用")
        return value

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("原密码不正确")
        return value

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("新密码长度不能小于6位")
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user

class AvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('avatar',)

    def validate_avatar(self, value):
        if value.size > 2 * 1024 * 1024:  # 2MB
            raise serializers.ValidationError("图片大小不能超过2MB")
        return value

class AgentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True, required=False)
    
    # 添加价格字段的类型定义
    normal_monthly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    normal_quarterly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    normal_half_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    normal_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    
    live_monthly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    live_quarterly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    live_half_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    live_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    
    transit_monthly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    transit_quarterly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    transit_half_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    transit_yearly_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'confirm_password', 'phone', 'name', 'domain', 
                  'template', 'balance', 
                  'normal_monthly_price', 'normal_quarterly_price', 'normal_half_yearly_price', 'normal_yearly_price',
                  'live_monthly_price', 'live_quarterly_price', 'live_half_yearly_price', 'live_yearly_price',
                  'transit_monthly_price', 'transit_quarterly_price', 'transit_half_yearly_price', 'transit_yearly_price',
                  'default_transit_account',
                  'is_active', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def validate(self, attrs):
        # 验证password和confirm_password
        if 'password' in attrs and 'confirm_password' in attrs:
            if attrs['password'] != attrs['confirm_password']:
                raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
            validate_password(attrs['password'])
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        
        validated_data['is_agent'] = True
        validated_data['user_type'] = 'agent_l2'  # 默认创建二级代理
        
        # 获取当前请求用户(creator)作为父级代理
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            creator = request.user
            if creator.user_type == 'agent_l1' or creator.user_type == 'admin':
                validated_data['parent'] = creator
        
        user = User.objects.create(**validated_data)
        
        if password:
            user.set_password(password)
            user.save()
        
        return user
    
    def update(self, instance, validated_data):
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance

class AgentBalanceSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    type = serializers.ChoiceField(choices=['increase', 'decrease'])

class AgentSimpleSerializer(serializers.ModelSerializer):
    """代理简要信息序列化器"""
    class Meta:
        model = User
        fields = ['id', 'username', 'name']

class CustomerSerializer(serializers.ModelSerializer):
    """客户序列化器"""
    agent_username = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'last_login_ip', 
            'is_active', 'date_joined', 'last_login', 'balance',
            'agent_username'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def get_agent_username(self, obj):
        """获取代理用户名"""
        if obj.parent:
            return obj.parent.username
        return None

class PackageSerializer(serializers.ModelSerializer):
    """套餐序列化器"""
    class Meta:
        model = Package
        fields = '__all__'

class CustomerPackageSerializer(serializers.ModelSerializer):
    """客户套餐序列化器"""
    package = PackageSerializer(read_only=True)
    package_id = serializers.IntegerField(write_only=True)
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = CustomerPackage
        fields = ['id', 'customer', 'customer_id', 'package', 'package_id', 
                 'purchase_date', 'expire_date', 'traffic_used', 'traffic_total', 'is_active']
        read_only_fields = ['id', 'purchase_date']
    
    def create(self, validated_data):
        package_id = validated_data.pop('package_id')
        customer_id = validated_data.pop('customer_id')
        
        try:
            package = Package.objects.get(id=package_id)
            customer = User.objects.get(id=customer_id, user_type='customer')
            
            return CustomerPackage.objects.create(
                package=package,
                customer=customer,
                traffic_total=package.traffic_total,
                **validated_data
            )
        except Package.DoesNotExist:
            raise serializers.ValidationError({"package_id": "套餐不存在"})
        except User.DoesNotExist:
            raise serializers.ValidationError({"customer_id": "客户不存在"})

class LoginRecordSerializer(serializers.ModelSerializer):
    """登录记录序列化器"""
    class Meta:
        model = LoginRecord
        fields = ['id', 'ip_address', 'login_time', 'device_info']
        read_only_fields = ['id', 'login_time']

class TrafficRecordSerializer(serializers.ModelSerializer):
    """流量记录序列化器"""
    class Meta:
        model = TrafficRecord
        fields = ['id', 'date', 'traffic_used']
        read_only_fields = ['id']

class CustomerDetailSerializer(serializers.ModelSerializer):
    """客户详情序列化器"""
    agent = AgentSimpleSerializer(read_only=True)
    package_info = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'ip_address', 'agent', 
                 'is_active', 'date_joined', 'last_login', 'package_info']
    
    def get_package_info(self, obj):
        # 获取客户当前有效的套餐
        active_package = obj.packages.filter(is_active=True).order_by('-expire_date').first()
        if active_package:
            return {
                'name': active_package.package.name if active_package.package else '未知套餐',
                'type': active_package.package.type if active_package.package else '未知类型',
                'expire_at': active_package.expire_date,
                'traffic_used': active_package.traffic_used,
                'traffic_total': active_package.traffic_total
            }
        return None

class ResetPasswordSerializer(serializers.Serializer):
    """重置密码序列化器"""
    password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
        validate_password(attrs['password'])
        return attrs

class WebsiteTemplateSerializer(serializers.ModelSerializer):
    """网站模板设置序列化器"""
    logo_url = serializers.SerializerMethodField()
    background_url = serializers.SerializerMethodField()
    
    class Meta:
        model = WebsiteTemplate
        fields = ['id', 'website_name', 'logo', 'background', 'logo_url', 'background_url', 'updated_at']
        read_only_fields = ['id', 'updated_at', 'logo_url', 'background_url']
        extra_kwargs = {
            'logo': {'write_only': True, 'required': False},
            'background': {'write_only': True, 'required': False},
        }
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
        return None
    
    def get_background_url(self, obj):
        if obj.background:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.background.url)
        return None

class UserRegisterSerializer(serializers.ModelSerializer):
    """用户注册序列化器"""
    password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)
    domain = serializers.CharField(required=False)  # 设置为非必填
    parent = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(user_type='agent_l2'), required=False)  # 添加parent字段

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'domain', 'parent']
        extra_kwargs = {
            'username': {'required': True},
            'email': {'required': True},
            'domain': {'required': False},  # 明确设置domain为非必填
            'password': {'write_only': True, 'required': True},
            'confirm_password': {'write_only': True, 'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
        return attrs

    def create(self, validated_data):
        # 移除confirm_password字段
        validated_data.pop('confirm_password', None)
        # 设置用户类型为customer
        validated_data['user_type'] = 'customer'
        # 创建用户
        user = User.objects.create_user(**validated_data)
        return user 

class PaymentOrderSerializer(serializers.ModelSerializer):
    """订单序列化器"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    agent_username = serializers.SerializerMethodField()
    period = serializers.SerializerMethodField()
    node_type = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentOrder
        fields = [
            'id', 'trade_no', 'out_trade_no', 'payment_type', 'product_name',
            'amount', 'status', 'param', 'country', 'node_count', 'node_protocol',
            'is_processed', 'created_at', 'updated_at', 'username', 'email',
            'agent_username', 'period', 'node_type'
        ]
        read_only_fields = fields
    
    def get_agent_username(self, obj):
        """获取代理用户名"""
        if obj.user.parent:
            return obj.user.parent.username
        return None
        
    def get_period(self, obj):
        """获取支付周期"""
        try:
            param = json.loads(obj.param) if obj.param else {}
            period = param.get('period', '')
            return period
        except:
            return ''
            
    def get_node_type(self, obj):
        """获取节点类型"""
        try:
            param = json.loads(obj.param) if obj.param else {}
            return param.get('nodeType', '')
        except:
            return ''

class ContactInfoSerializer(serializers.ModelSerializer):
    """联系方式序列化器"""
    qq_qrcode_url = serializers.SerializerMethodField()
    wechat_qrcode_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ContactInfo
        fields = ['qq', 'qq_qrcode', 'qq_qrcode_url', 'wechat', 'wechat_qrcode', 'wechat_qrcode_url', 'phone', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_qq_qrcode_url(self, obj):
        if obj.qq_qrcode:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qq_qrcode.url)
        return None
    
    def get_wechat_qrcode_url(self, obj):
        if obj.wechat_qrcode:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.wechat_qrcode.url)
        return None 