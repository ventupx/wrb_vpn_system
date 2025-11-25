from rest_framework import serializers
from .models import TransitAccount, TransitDomain
import json
import re
import ipaddress

class TransitAccountSerializer(serializers.ModelSerializer):
    """中转账号序列化器"""
    traffic_used = serializers.SerializerMethodField()
    traffic_total = serializers.SerializerMethodField()
    rules_used = serializers.SerializerMethodField()
    rules_max = serializers.SerializerMethodField()
    
    class Meta:
        model = TransitAccount
        fields = [
            'id', 'username', 'password', 'token', 'balance', 
            'traffic', 'traffic_used', 'traffic_total',
            'rules', 'rules_used', 'rules_max',
            'default_inbound', 'default_outbound', 
            'status', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'token': {'write_only': True}
        }
    
    def get_traffic_used(self, obj):
        try:
            traffic_data = json.loads(obj.traffic)
            return traffic_data.get('used', 0)
        except:
            return 0
    
    def get_traffic_total(self, obj):
        try:
            traffic_data = json.loads(obj.traffic)
            return traffic_data.get('total', 0)
        except:
            return 0
    
    def get_rules_used(self, obj):
        try:
            rules_data = json.loads(obj.rules)
            return rules_data.get('used', 0)
        except:
            return 0
    
    def get_rules_max(self, obj):
        try:
            rules_data = json.loads(obj.rules)
            return rules_data.get('max', 10)
        except:
            return 10

class TransitAccountCreateSerializer(serializers.ModelSerializer):
    """中转账号创建序列化器"""
    class Meta:
        model = TransitAccount
        fields = ['username', 'password']

class TransitAccountUpdateSerializer(serializers.ModelSerializer):
    """中转账号更新序列化器"""
    default_inbound = serializers.CharField(required=False)
    default_outbound = serializers.CharField(required=False)
    
    class Meta:
        model = TransitAccount
        fields = ['default_inbound', 'default_outbound']


class TransitDomainSerializer(serializers.ModelSerializer):
    """中转域名序列化器"""
    agent_username = serializers.CharField(source='agent.username', read_only=True)
    
    class Meta:
        model = TransitDomain
        fields = [
            'id', 'name', 'ip', 'domain', 'agent', 'agent_username',
            'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'agent': {'write_only': True}
        }


class TransitDomainCreateSerializer(serializers.ModelSerializer):
    """中转域名创建序列化器"""
    
    class Meta:
        model = TransitDomain
        fields = ['name', 'ip', 'domain']
    
    def validate_name(self, value):
        """验证名称格式"""
        if not value.strip():
            raise serializers.ValidationError("名称不能为空")
        return value.strip()
    
    def validate_ip(self, value):
        """验证IP地址或域名格式"""
        if not value.strip():
            raise serializers.ValidationError("IP地址或域名不能为空")
        
        value = value.strip()
        
        # 尝试验证是否为有效的IP地址
        try:
            ipaddress.ip_address(value)
            return value
        except ValueError:
            pass
        
        # 验证是否为有效的域名格式
        domain_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        if re.match(domain_pattern, value) and len(value) <= 253:
            return value
        
        raise serializers.ValidationError("请输入有效的IP地址或域名")
    
    def validate_domain(self, value):
        """验证域名格式"""
        if not value.strip():
            raise serializers.ValidationError("域名不能为空")
        return value.strip()


class TransitDomainUpdateSerializer(serializers.ModelSerializer):
    """中转域名更新序列化器"""
    
    class Meta:
        model = TransitDomain
        fields = ['name', 'ip', 'domain']
    
    def validate_name(self, value):
        """验证名称格式"""
        if not value.strip():
            raise serializers.ValidationError("名称不能为空")
        return value.strip()
    
    def validate_ip(self, value):
        """验证IP地址或域名格式"""
        if not value.strip():
            raise serializers.ValidationError("IP地址或域名不能为空")
        
        value = value.strip()
        
        # 尝试验证是否为有效的IP地址
        try:
            ipaddress.ip_address(value)
            return value
        except ValueError:
            pass
        
        # 验证是否为有效的域名格式
        domain_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        if re.match(domain_pattern, value) and len(value) <= 253:
            return value
        
        raise serializers.ValidationError("请输入有效的IP地址或域名")
    
    def validate_domain(self, value):
        """验证域名格式"""
        if not value.strip():
            raise serializers.ValidationError("域名不能为空")
        return value.strip()