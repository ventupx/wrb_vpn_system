from rest_framework import serializers
from .models import CDK

class CDKSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = CDK
        fields = [
            'id', 'code', 'discount', 'max_uses', 'used_count',
            'created_by', 'created_by_name', 'valid_from', 'valid_until',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'used_count', 'created_by_name', 'created_by']

    def validate_discount(self, value):
        if not 1 <= value <= 100:
            raise serializers.ValidationError("折扣必须在1-100之间")
        return value

    def validate(self, data):
        if data['valid_from'] >= data['valid_until']:
            raise serializers.ValidationError("生效时间必须早于过期时间")
        return data 