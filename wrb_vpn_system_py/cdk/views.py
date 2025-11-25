from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.utils import timezone
from .models import CDK
from .serializers import CDKSerializer
from .utils import api_response
import random
import string

# Create your views here.

class CDKViewSet(viewsets.ModelViewSet):
    queryset = CDK.objects.all()
    serializer_class = CDKSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        # 支持按状态、创建时间范围筛选
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # 支持搜索
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(code__icontains=search)
        
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return api_response(
                code=200,
                message="获取CDK列表成功",
                data=self.get_paginated_response(serializer.data).data
            )
        serializer = self.get_serializer(queryset, many=True)
        return api_response(
            code=200,
            message="获取CDK列表成功",
            data={"results": serializer.data}
        )

    def create(self, request, *args, **kwargs):
        data = request.data.get('data', request.data)
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return api_response(
                code=200,
                message="创建CDK成功",
                data=serializer.data
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data=serializer.errors
            )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(
            code=200,
            message="获取CDK详情成功",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return api_response(
                code=200,
                message="更新CDK成功",
                data=serializer.data
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data=serializer.errors
            )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.used_count > 0:
            return api_response(
                code=400,
                message="该CDK已被使用，无法删除",
                data={}
            )
        self.perform_destroy(instance)
        return api_response(
            code=200,
            message="删除CDK成功",
            data={}
        )

    def perform_create(self, serializer):
        # 自动设置创建人
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def generate_code(self, request):
        """生成随机CDK码"""
        length = 12  # CDK长度
        while True:
            # 生成随机码
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
            # 检查是否已存在
            if not CDK.objects.filter(code=code).exists():
                return api_response(
                    code=200,
                    message="生成随机CDK码成功",
                    data={"code": code}
                )

    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """切换CDK的启用/停用状态"""
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        serializer = self.get_serializer(instance)
        status_text = "启用" if instance.is_active else "停用"
        return api_response(
            code=200,
            message=f"CDK{status_text}成功",
            data=serializer.data
        )
