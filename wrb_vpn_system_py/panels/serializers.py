from rest_framework import serializers
from .models import AgentPanel

class AgentPanelSerializer(serializers.ModelSerializer):
    ip_address = serializers.CharField(required=False)  # 由ip和port组合生成
    plain_password = serializers.CharField(source='password', read_only=True)  # 用于显示明文密码

    class Meta:
        model = AgentPanel
        fields = [
            'id', 'ip_address', 'ip', 'port', 'username', 'password', 'plain_password',
            'panel_type', 'is_active', 'is_online', 'nodes_count', 'last_restart', 'cpu_usage',
            'memory_usage', 'disk_usage', 'created_at', 'updated_at',
            'cookie', 'country'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_restart', 'nodes_count', 'is_online']
        extra_kwargs = {
            'password': {'write_only': True},
            'cookie': {'write_only': True}
        }

    def validate(self, data):
        # 如果是创建操作，确保所有必要字段都存在
        if not self.instance:  # 创建操作
            required_fields = ['port', 'username', 'password', 'panel_type']
            for field in required_fields:
                if field not in data:
                    raise serializers.ValidationError(f"{field} 是必填字段")
        
        # 验证面板类型
        if 'panel_type' in data and data['panel_type'] not in ['x-ui', '3x-ui']:
            raise serializers.ValidationError("面板类型必须是 x-ui 或 3x-ui")

        return data

    def create(self, validated_data):
        # 直接使用ip作为ip_address，不拼接端口
        ip = self.context['request'].data.get('ip', '')
        validated_data['ip_address'] = ip
        
        # 提取纯IP地址
        pure_ip = ip.split(':')[0] if ':' in ip else ip
        pure_ip = pure_ip.split('/')[0] if '/' in pure_ip else pure_ip
        validated_data['ip'] = pure_ip
        
        return super().create(validated_data) 