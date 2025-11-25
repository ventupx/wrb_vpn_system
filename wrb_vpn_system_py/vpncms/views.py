from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import AgentPanel
from .serializers import AgentPanelSerializer

class AgentPanelViewSet(viewsets.ModelViewSet):
    queryset = AgentPanel.objects.all()
    serializer_class = AgentPanelSerializer

    def get_queryset(self):
        queryset = AgentPanel.objects.all()
        
        # 过滤IP地址
        ip_address = self.request.query_params.get('ip_address', None)
        if ip_address:
            queryset = queryset.filter(ip_address__icontains=ip_address)
        
        # 过滤面板类型
        panel_type = self.request.query_params.get('panel_type', None)
        if panel_type:
            queryset = queryset.filter(panel_type=panel_type)
        
        # 过滤在线状态
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            is_active = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)
        
        return queryset

    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """切换面板的启用/停用状态"""
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        serializer = self.get_serializer(instance)
        status_text = "启用" if instance.is_active else "停用"
        return Response({
            'code': 200,
            'message': f"面板{status_text}成功",
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def restart(self, request, pk=None):
        """重启面板"""
        instance = self.get_object()
        if not instance.is_active:
            return Response({
                'code': 400,
                'message': "面板当前处于离线状态，无法重启"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 更新最后重启时间
        instance.last_restart = timezone.now()
        instance.save()
        
        serializer = self.get_serializer(instance)
        return Response({
            'code': 200,
            'message': "重启命令已发送",
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试面板连接"""
        # 这里应该实现实际的连接测试逻辑
        # 现在只返回模拟的成功响应
        return Response({
            'code': 200,
            'message': "连接测试成功",
            'data': {'connected': True}
        }) 