from rest_framework import serializers
from .models import AgentPanel

class AgentPanelSerializer(serializers.ModelSerializer):
    ip_address = serializers.CharField(required=False)  # 由ip和port组合生成

    class Meta:
        model = AgentPanel
        fields = [
            'id', 'ip_address', 'port', 'username', 'password',
            'panel_type', 'is_active', 'last_restart', 'cpu_usage',
            'memory_usage', 'disk_usage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_restart']

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
        # 组合IP地址和端口
        ip = self.context['request'].data.get('ip', '')
        port = validated_data.get('port', '')
        validated_data['ip_address'] = f"{ip}:{port}"
        return super().create(validated_data) 