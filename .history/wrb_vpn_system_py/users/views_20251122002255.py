import json
from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, PasswordResetSerializer, UserProfileSerializer, ChangePasswordSerializer, AvatarSerializer, AgentSerializer, AgentBalanceSerializer, CustomerSerializer, PackageSerializer, CustomerPackageSerializer, LoginRecordSerializer, TrafficRecordSerializer, CustomerDetailSerializer, ResetPasswordSerializer, WebsiteTemplateSerializer, UserRegisterSerializer, PaymentOrderSerializer, ContactInfoSerializer
from django.core.mail import send_mail
from django.conf import settings
import random
import string
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .utils import api_response
from decimal import Decimal
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta, datetime
from .models import NodeInfo, User, Package, CustomerPackage, LoginRecord, TrafficRecord, WebsiteTemplate, PaymentOrder, ContactInfo
from .permissions import IsAgentL1, IsAgentL2, IsAgentOrAdmin, IsCustomer
from panels.models import AgentPanel
import re
import requests
import logging
import hashlib
from django.db import models
from cdk.models import CDK
import uuid
from urllib.parse import urlencode
from panels.views import AgentPanelViewSet  # 导入AgentPanelViewSet
from rest_framework.pagination import PageNumberPagination
import time
from threading import Thread
from panels.models import AgentPanel
import copy
from transits.models import TransitAccount, TransitDomain

User = get_user_model()

logger = logging.getLogger(__name__)

def get_udp_host_domain(node, agent=None):
    """
    获取UDP主机域名映射
    
    参数:
    - node: NodeInfo对象
    - agent: 代理用户对象，如果不提供则从node.user.parent获取
    
    返回:
    - 映射后的域名字符串，如果没有映射则返回原始udp_host，如果udp_host为空则返回空字符串
    """
    if not node.udp_host:
        return ''
    
    # 从udp_host中提取IP地址（格式通常是 ip:port）
    try:
        host_ip = node.udp_host.split(':')[0]
    except (AttributeError, IndexError):
        return node.udp_host
    
    # 获取代理
    if not agent:
        agent = node.user.parent if node.user and hasattr(node.user, 'parent') else None
    
    if not agent:
        return node.udp_host
    
    # 在TransitDomain表中查找匹配的IP
    try:
        transit_domain = TransitDomain.objects.filter(agent=agent, ip=host_ip).first()
        if transit_domain:
            # 如果找到匹配的域名，构建新的地址
            port = node.udp_host.split(':')[1] if ':' in node.udp_host else ''
            if port:
                return f"{transit_domain.domain}:{port}"
            else:
                return transit_domain.domain
        else:
            # 没有找到匹配的域名，返回原始udp_host
            return node.udp_host
    except Exception:
        # 出现异常时返回原始udp_host
        return node.udp_host

# 创建AgentPanelViewSet实例，以便调用其方法
agent_panel_viewset = AgentPanelViewSet()

class CustomPagination(PageNumberPagination):
    """自定义分页类"""
    page_size = 10  # 默认每页显示10条
    page_size_query_param = 'page_size'  # 每页显示条数的参数名
    max_page_size = 100  # 每页最大显示条数

class LoginView(APIView):
    permission_classes = []  # 登录接口不需要认证
    authentication_classes = []  # 登录接口不需要认证

    def post(self, request):
        login = request.data.get('username')
        password = request.data.get('password')

        if not login or not password:
            return Response({
                'detail': '用户名/邮箱和密码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 尝试使用用户名或邮箱登录
        user = None
        if '@' in login:
            try:
                user = User.objects.get(email=login)
            except User.DoesNotExist:
                return Response({
                    'detail': '邮箱不存在'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                user = User.objects.get(username=login)
            except User.DoesNotExist:
                return Response({
                    'detail': '用户名不存在'
                }, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(password):
            return Response({
                'detail': '密码错误'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 生成JWT Token
        refresh = RefreshToken.for_user(user)
        
        # 返回登录成功的响应
        return Response({
            'code': 200,
            'message': '登录成功',
            'data': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'user_type': user.user_type,
                    'balance': user.balance  # 增加余额字段
                }
            }
        })

@method_decorator(csrf_exempt, name='dispatch')
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            # 获取用户名或邮箱
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    'code': 400,
                    'message': '用户名/邮箱和密码不能为空',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 判断是否是邮箱格式
            if '@' in username:
                try:
                    user = User.objects.get(email=username)
                    # 将邮箱对应的用户名赋值给请求数据
                    request.data['username'] = user.username
                except User.DoesNotExist:
                    return Response({
                        'code': 400,
                        'message': '该邮箱未注册',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 调用父类的 post 方法进行实际的登录验证
            response = super().post(request, *args, **kwargs)
            
            if response.status_code == 200:
                # 获取用户信息
                user = User.objects.get(username=request.data['username'])
                data = {
                    'access': response.data['access'],
                    'refresh': response.data['refresh'],
                    'user': {
                        'user_type': user.user_type,
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'name': user.name,
                        'avatar': user.avatar.url if user.avatar else None
                    }
                }
                return Response({
                    'code': 200,
                    'message': '登录成功',
                    'data': data
                })
            return response

        except Exception as e:
            return Response({
                'code': 400,
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetSerializer

    def generate_verification_code(self):
        """生成6位数字验证码"""
        return ''.join(random.choices(string.digits, k=6))

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                # 生成验证码
                code = self.generate_verification_code()
                # 存储验证码到缓存（5分钟有效）
                cache_key = f'reset_password_{email}'
                cache.set(cache_key, code, timeout=300)  # 5分钟 = 300秒

                # 发送验证码邮件
                subject = '后台管理系统 - 重置密码验证码'
                message = f'您的验证码是：{code}\n该验证码5分钟内有效。'
                try:
                    send_mail(
                        subject,
                        message,
                        settings.EMAIL_HOST_USER,
                        [email],
                        fail_silently=False,
                    )
                    return Response({
                        'code': 200,
                        'message': '验证码已发送到您的邮箱'
                    }, status=status.HTTP_200_OK)
                except Exception as e:
                    print(f"邮件发送错误: {str(e)}")
                    return Response({
                        'message': f'发送验证码失败: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except User.DoesNotExist:
                return Response({
                    'message': '该邮箱未注册'
                }, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class VerifyCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')

        if not email or not code:
            return Response({
                'message': '邮箱和验证码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'reset_password_{email}'
        stored_code = cache.get(cache_key)

        if not stored_code:
            return Response({
                'message': '验证码已过期'
            }, status=status.HTTP_400_BAD_REQUEST)

        if code != stored_code:
            return Response({
                'message': '验证码错误'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'code': 200,
            'message': '验证码正确'
        })

@method_decorator(csrf_exempt, name='dispatch')
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        new_password = request.data.get('new_password')

        if not all([email, code, new_password]):
            return Response({
                'message': '邮箱、验证码和新密码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 验证验证码
        cache_key = f'reset_password_{email}'
        stored_code = cache.get(cache_key)

        if not stored_code:
            return Response({
                'message': '验证码已过期'
            }, status=status.HTTP_400_BAD_REQUEST)

        if code != stored_code:
            return Response({
                'message': '验证码错误'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()
            
            # 清除验证码缓存
            cache.delete(cache_key)
            
            return Response({
                'code': 200,
                'message': '密码重置成功'
            })
        except User.DoesNotExist:
            return Response({
                'message': '用户不存在'
            }, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny]  # 允许未认证用户访问

    def get_permissions(self):
        """根据不同的action设置不同的权限"""
        if self.action in ['register', 'login']:
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    def register(self, request):
        """用户注册接口"""
        try:
            # 获取当前请求的域名
            current_domain = request.META.get('HTTP_HOST', '')

            referer_domain = ''
            requesting_domain = request.META.get('HTTP_HOST', '')
            origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
            referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
            if referer and '://' in referer:
                referer_parts = referer.split('://', 1)[1]
                if '/' in referer_parts:
                    referer_domain = referer_parts.split('/', 1)[0]
                else:
                    referer_domain = referer_parts
            
            # 尝试从HTTP_ORIGIN中提取域名
            origin_domain = ''
            if origin and '://' in origin:
                origin_domain = origin.split('://', 1)[1]
            
            
            # 使用多种方法尝试获取源地址
            source_domain = referer_domain or origin_domain or requesting_domain
                

            matched_agent = None
            agents = User.objects.filter(user_type='agent_l2')
            
            print(f"当前请求的域名: {current_domain}")
            if not current_domain:
                return Response({
                    'code': 400,
                    'message': '无法获取当前域名',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 获取所有二级代理的域名
            agents = User.objects.filter(user_type='agent_l2')
            print(f"所有二级代理的域名: {[{'id': agent.id, 'domain': agent.domain} for agent in agents]}")
            matched_agent = None

            # 遍历代理，查找匹配的域名
            for agent in agents:
                if agent.domain and source_domain.endswith(agent.domain):
                    matched_agent = agent
                    print(f"找到匹配的代理: {agent.id}, 域名: {agent.domain}")
                    break

            if not matched_agent:
                return Response({
                    'code': 400,
                    'message': '未找到匹配的代理',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 打印请求数据
            print(f"请求数据: {request.data}")

            # 创建序列化器实例
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                print(f"序列化器验证错误: {serializer.errors}")
                return Response({
                    'code': 400,
                    'message': '数据验证失败',
                    'data': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # 添加代理和域名信息
            validated_data = serializer.validated_data
            validated_data['parent'] = matched_agent  # 设置父级代理
            validated_data['domain'] = current_domain  # 设置域名

            # 创建用户
            user = serializer.create(validated_data)

            return Response({
                'code': 200,
                'message': '注册成功',
                'data': {
                    'username': user.username,
                    'email': user.email,
                    'agent': matched_agent.id
                }
            })

        except Exception as e:
            print(f"注册失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'注册失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_object(self):
        return self.request.user

    @action(detail=False, methods=['get'])
    def profile(self, request):
        """获取当前用户信息"""
        serializer = self.get_serializer(request.user)
        return Response({
            'code': 200,
            'message': '获取用户信息成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['put'])
    def update_profile(self, request):
        """修改个人信息
        可以修改用户名和手机号
        """
        try:
            user = request.user
            if not user:
                return Response({
                    'code': 401,
                    'message': '未登录',
                    'data': None
                }, status=status.HTTP_401_UNAUTHORIZED)

            # 获取要修改的数据
            username = request.data.get('username')
            phone = request.data.get('phone')

            # 验证用户名是否重复
            if username and username != user.username:
                if User.objects.filter(username=username).exists():
                    return Response({
                        'code': 400,
                        'message': '用户名已存在',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                user.username = username

            # 更新手机号
            if phone:
                user.phone = phone

            user.save()

            return Response({
                'code': 200,
                'message': '修改成功',
                'data': {
                    'username': user.username,
                    'phone': user.phone
                }
            })

        except Exception as e:
            print(f"修改个人信息失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'修改失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['put'])
    def change_password(self, request):
        """修改密码"""
        try:
            user = request.user
            if not user:
                return Response({
                    'code': 401,
                    'message': '未登录',
                    'data': None
                }, status=status.HTTP_401_UNAUTHORIZED)

            # 获取新旧密码
            old_password = request.data.get('old_password')
            new_password = request.data.get('new_password')
            confirm_password = request.data.get('confirm_password')

            if not all([old_password, new_password, confirm_password]):
                return Response({
                    'code': 400,
                    'message': '请填写完整信息',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 验证旧密码
            if not user.check_password(old_password):
                return Response({
                    'code': 400,
                    'message': '原密码错误',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 验证新密码
            if new_password != confirm_password:
                return Response({
                    'code': 400,
                    'message': '两次输入的新密码不一致',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 设置新密码
            user.set_password(new_password)
            user.save()

            return Response({
                'code': 200,
                'message': '密码修改成功',
                'data': None
            })

        except Exception as e:
            print(f"修改密码失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'修改失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['post'])
    def disable_user(self, request, pk=None):
        """停用用户接口"""
        try:
            # 获取目标用户
            try:
                user = User.objects.get(id=pk)
            except User.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '用户不存在',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 检查权限
            if not request.user.is_staff and not request.user.is_superuser:
                return Response({
                    'code': 403,
                    'message': '没有权限执行此操作',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 不允许停用超级管理员
            if user.is_superuser:
                return Response({
                    'code': 400,
                    'message': '不能停用超级管理员账户',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 更新用户状态
            user.is_active = False
            user.save(update_fields=['is_active'])
            
            return Response({
                'code': 200,
                'message': '用户已停用',
                'data': None
            })
            
        except Exception as e:
            return Response({
                'code': 500,
                'message': f'停用用户失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def start_user(self, request, pk=None):
        """启用用户接口"""
        try:
            # 获取目标用户
            try:
                user = User.objects.get(id=pk)
            except User.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '用户不存在',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 检查权限
            if not request.user.is_staff and not request.user.is_superuser:
                return Response({
                    'code': 403,
                    'message': '没有权限执行此操作',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 不允许停用超级管理员
            if user.is_superuser:
                return Response({
                    'code': 400,
                    'message': '不能停用超级管理员账户',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 更新用户状态
            user.is_active = True
            user.save(update_fields=['is_active'])
            
            return Response({
                'code': 200,
                'message': '用户已停用',
                'data': None
            })
            
        except Exception as e:
            return Response({
                'code': 500,
                'message': f'停用用户失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        """删除用户接口"""
        try:
            # 获取目标用户
            try:
                user = User.objects.get(id=pk)
            except User.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '用户不存在',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 检查权限
            if not request.user.is_staff and not request.user.is_superuser:
                return Response({
                    'code': 403,
                    'message': '没有权限执行此操作',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 不允许删除超级管理员
            if user.is_superuser:
                return Response({
                    'code': 400,
                    'message': '不能删除超级管理员账户',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 删除用户
            user.delete()
            
            return Response({
                'code': 200,
                'message': '用户已删除',
                'data': None
            })
            
        except Exception as e:
            return Response({
                'code': 500,
                'message': f'删除用户失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=False, methods=['post'], serializer_class=AvatarSerializer)
    def upload_avatar(self, request):
        """上传头像"""
        serializer = AvatarSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            # 如果存在旧头像，删除它
            if request.user.avatar:
                request.user.avatar.delete(save=False)
            
            serializer.save()
            return Response({
                'code': 200,
                "message": "头像上传成功",
                "url": request.build_absolute_uri(request.user.avatar.url)
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=['post'])
    def create_sub_agent(self, request):
        if request.user.user_type != 'agent_l1':
            return Response({'message': '只有一级代理可以创建二级代理'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        data = request.data.copy()
        data['user_type'] = 'agent_l2'
        data['parent'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def generate_verification_code(self):
        """生成6位数字验证码"""
        return ''.join(random.choices(string.digits, k=6))

    @action(detail=False, methods=['post'])
    def forgot_password(self, request):
        """发送重置密码验证码"""
        email = request.data.get('email')
        if not email:
            return Response({'message': '请提供邮箱地址'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': '该邮箱未注册'}, status=status.HTTP_404_NOT_FOUND)

        # 生成验证码并存储在缓存中（5分钟有效）
        code = self.generate_verification_code()
        cache_key = f'reset_password_{email}'
        cache.set(cache_key, code, timeout=300)  # 5分钟 = 300秒

        # 发送验证码邮件
        subject = 'VPN管理系统 - 重置密码验证码'
        message = f'您的验证码是：{code}\n该验证码5分钟内有效。'
        try:
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER,
                [email],
                fail_silently=False,
            )
            return Response({'code': 200,'message': '验证码已发送到您的邮箱'})
        except Exception as e:
            print(f"邮件发送错误: {str(e)}")
            return Response({'message': f'发送验证码失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def verify_code(self, request):
        """验证重置密码验证码"""
        email = request.data.get('email')
        code = request.data.get('code')

        if not email or not code:
            return Response({'message': '请提供邮箱和验证码'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'reset_password_{email}'
        stored_code = cache.get(cache_key)

        if not stored_code:
            return Response({'message': '验证码已过期'}, status=status.HTTP_400_BAD_REQUEST)

        if code != stored_code:
            return Response({'message': '验证码错误'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'code': 200,'message': '验证码正确'})

    @action(detail=False, methods=['post'])
    def reset_password(self, request):
        """重置密码"""
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'message': '请提供邮箱和新密码'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 验证是否通过了验证码验证
        cache_key = f'reset_password_{email}'
        if not cache.get(cache_key):
            return Response({'message': '请先验证邮箱验证码'}, status=status.HTTP_400_BAD_REQUEST)

        # 更新密码
        user.set_password(password)
        user.save()

        # 清除验证码缓存
        cache.delete(cache_key)

        return Response({'code': 200,'message': '密码重置成功'})

class AgentViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_agent=True)
    serializer_class = AgentSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                username__icontains=search
            ) | queryset.filter(
                name__icontains=search
            ) | queryset.filter(
                email__icontains=search
            )
        return queryset

    def perform_create(self, serializer):
        """创建代理时，自动设置当前用户为其上级代理"""
        user = self.request.user
        # 只有一级代理和管理员能创建二级代理
        if user.user_type == 'agent_l1' or user.user_type == 'admin':
            serializer.save(parent=user)
        else:
            serializer.save()

    def retrieve(self, request, *args, **kwargs):
        """获取单个代理详情"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        # 确保返回的数据包含新的价格字段，如果字段为空，则设置默认值0
        data = serializer.data
        
        # 设置默认值为0，如果字段不存在或为null
        price_fields = [
            'normal_monthly_price', 'normal_quarterly_price', 'normal_half_yearly_price', 'normal_yearly_price',
            'live_monthly_price', 'live_quarterly_price', 'live_half_yearly_price', 'live_yearly_price',
            'transit_monthly_price', 'transit_quarterly_price', 'transit_half_yearly_price', 'transit_yearly_price'
        ]
        
        for field in price_fields:
            if field not in data or data[field] is None:
                data[field] = 0
        
        return api_response(
            code=200,
            message="获取代理详情成功",
            data=data
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return api_response(
                code=200,
                message="获取代理列表成功",
                data=self.get_paginated_response(serializer.data).data
            )
        serializer = self.get_serializer(queryset, many=True)
        return api_response(
            code=200,
            message="获取代理列表成功",
            data={"results": serializer.data}
        )

    def create(self, request, *args, **kwargs):
        # 处理请求数据格式，支持前端传递的data封装和直接传递数据两种方式
        data = request.data.get('data', request.data)
        
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return api_response(
                code=200,
                message="创建代理成功",
                data=serializer.data
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data=serializer.errors
            )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # 处理请求数据格式，支持前端传递的data封装和直接传递数据两种方式
        data = request.data.get('data', request.data)
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            # 获取更新后的数据，并设置默认值
            response_data = serializer.data
            price_fields = [
                'normal_monthly_price', 'normal_quarterly_price', 'normal_half_yearly_price', 'normal_yearly_price',
                'live_monthly_price', 'live_quarterly_price', 'live_half_yearly_price', 'live_yearly_price',
                'transit_monthly_price', 'transit_quarterly_price', 'transit_half_yearly_price', 'transit_yearly_price'
            ]
            
            for field in price_fields:
                if field not in response_data or response_data[field] is None:
                    response_data[field] = 0
            
            return api_response(
                code=200,
                message="更新代理信息成功",
                data=response_data
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data=serializer.errors
            )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
            return api_response(
                code=200,
                message="删除代理成功",
                data={}
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data={}
            )

    @action(detail=True, methods=['post'])
    def update_balance(self, request, pk=None):
        """修改代理余额"""
        instance = self.get_object()
        data = request.data.get('data', request.data)
        amount = data.get('amount')
        operation_type = data.get('type')

        if not amount or not operation_type:
            return api_response(
                code=400,
                message="金额和操作类型不能为空",
                data={}
            )

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return api_response(
                code=400,
                message="金额格式不正确",
                data={}
            )

        if amount <= 0:
            return api_response(
                code=400,
                message="金额必须大于0",
                data={}
            )

        # 检查扣除金额是否超过当前余额
        if operation_type == 'decrease' and amount > float(instance.balance):
            return api_response(
                code=400,
                message="扣除金额不能大于当前余额",
                data={}
            )

        if operation_type == 'increase':
            instance.balance = float(instance.balance) + amount
        elif operation_type == 'decrease':
            instance.balance = float(instance.balance) - amount
        else:
            return api_response(
                code=400,
                message="操作类型不正确",
                data={}
            )

        instance.save()
        serializer = self.get_serializer(instance)
        return api_response(
            code=200,
            message="修改余额成功",
            data=serializer.data
        )

    @action(detail=True, methods=['post'])
    def update_domain(self, request, pk=None):
        """更新代理域名"""
        instance = self.get_object()
        domain = request.data.get('domain')
        
        if not domain:
            return api_response(
                code=400,
                message="域名不能为空",
                data={}
            )
            
        instance.domain = domain
        instance.save()
        
        return api_response(
            code=200,
            message="更新域名成功",
            data=self.get_serializer(instance).data
        )

    @action(detail=True, methods=['post'])
    def update_template(self, request, pk=None):
        """更新网站模板"""
        instance = self.get_object()
        template = request.data.get('template')
        
        if not template or template not in ['web_1', 'web_2', 'web_3', 'web_4']:
            return api_response(
                code=400,
                message="无效的模板选择",
                data={}
            )
            
        instance.template = template
        instance.save()
        
        return api_response(
            code=200,
            message="更新网站模板成功",
            data=self.get_serializer(instance).data
        )

    @action(detail=True, methods=['post'])
    def update_pricing(self, request, pk=None):
        """更新价格设置"""
        instance = self.get_object()
        
        try:
            # 获取请求数据
            data = request.data.get('data', request.data)
            
            # 更新普通类型价格
            normal_fields = [
                'normal_monthly_price', 'normal_quarterly_price', 
                'normal_half_yearly_price', 'normal_yearly_price'
            ]
            
            # 更新直播类型价格
            live_fields = [
                'live_monthly_price', 'live_quarterly_price', 
                'live_half_yearly_price', 'live_yearly_price'
            ]
            
            # 更新中转类型价格
            transit_fields = [
                'transit_monthly_price', 'transit_quarterly_price', 
                'transit_half_yearly_price', 'transit_yearly_price'
            ]
            
            # 更新所有价格字段
            for field in normal_fields + live_fields + transit_fields:
                value = data.get(field)
                if value is not None:
                    setattr(instance, field, Decimal(str(value)))
            
            instance.save()
            return api_response(
                code=200,
                message="更新价格成功",
                data=self.get_serializer(instance).data
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data={}
            )

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """修改代理密码"""
        instance = self.get_object()
        data = request.data.get('data', request.data)
        
        if 'password' not in data or 'confirm_password' not in data:
            return api_response(
                code=400,
                message="密码和确认密码不能为空",
                data={}
            )
            
        if data['password'] != data['confirm_password']:
            return api_response(
                code=400,
                message="两次输入的密码不一致",
                data={}
            )
        
        try:
            # 验证密码复杂度
            from django.contrib.auth.password_validation import validate_password
            validate_password(data['password'])
            
            # 设置新密码
            instance.set_password(data['password'])
            instance.save()
            
            return api_response(
                code=200,
                message="密码修改成功",
                data={}
            )
        except Exception as e:
            return api_response(
                code=400,
                message=str(e),
                data={}
            )

# 新增视图类
class CustomerViewSet(viewsets.ModelViewSet):
    """客户视图集"""
    queryset = User.objects.filter(user_type='customer')
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]  # 修改为只需要认证即可访问
    pagination_class = CustomPagination
    
    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.filter(user_type='customer')
        
        # 基础权限过滤
        if user.user_type == 'admin':
            queryset = User.objects.filter(user_type='customer')
        elif user.user_type == 'agent_l1':
            queryset = User.objects.filter(user_type='customer')
        elif user.user_type == 'agent_l2':
            queryset = User.objects.filter(user_type='customer', parent=user)
        elif user.user_type == 'customer':
            queryset = User.objects.filter(id=user.id)
        else:
            queryset = User.objects.none()
        
        # 用户名模糊搜索
        username = self.request.query_params.get('username', None)
        if username:
            queryset = queryset.filter(username__icontains=username)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
        
            # 检查是否需要分页
            page = request.query_params.get('page')
            page_size = request.query_params.get('page_size')
            
            if page is None and page_size is None:
                # 不分页，返回所有数据
                serializer = self.get_serializer(queryset, many=True)
                return Response({
                    'code': 200,
                    'message': '获取客户列表成功',
                    'data': {
                        'results': serializer.data,
                        'count': len(serializer.data)
                    }
                })
            else:
                # 使用分页
                page = self.paginate_queryset(queryset)
                serializer = self.get_serializer(page, many=True)
                paginated_data = self.get_paginated_response(serializer.data).data
                return Response({
                    'code': 200,
                    'message': '获取客户列表成功',
                    'data': paginated_data
                })
        except Exception as e:
            logger.error(f"获取客户列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取客户列表失败: {str(e)}'
            }, status=500)
    
    @action(detail=True, methods=['post'])
    def update_balance(self, request, pk=None):
        """修改客户余额"""
        try:
            customer = self.get_object()
            amount = request.data.get('amount')
            action = request.data.get('action')  # 'add' 或 'subtract'
            
            if not amount or not action:
                return Response({
                    'code': 400,
                    'message': '缺少必要参数'
                }, status=400)
            
            try:
                amount = Decimal(amount)
                if amount <= 0:
                    raise ValueError('金额必须大于0')
            except (ValueError, TypeError):
                return Response({
                    'code': 400,
                    'message': '金额格式不正确'
                }, status=400)
            
            if action not in ['add', 'subtract']:
                return Response({
                    'code': 400,
                    'message': '操作类型不正确'
                }, status=400)
            
            # 检查权限
            if request.user.user_type == 'agent_l2' and customer.parent != request.user:
                return Response({
                    'code': 403,
                    'message': '无权修改该客户的余额'
                }, status=403)
            
            # 执行余额修改
            if action == 'add':
                customer.balance += amount
            else:  # subtract
                if customer.balance < amount:
                    return Response({
                        'code': 400,
                        'message': '客户余额不足'
                    }, status=400)
                customer.balance -= amount
            
            customer.save()
            
            return Response({
                'code': 200,
                'message': '修改余额成功',
                'data': {
                    'customer_id': customer.id,
                    'username': customer.username,
                    'new_balance': float(customer.balance)  # 转换为float类型
                }
            })
            
        except User.DoesNotExist:
            return Response({
                'code': 404,
                'message': '客户不存在'
            }, status=404)
        except Exception as e:
            logger.error(f"修改客户余额失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'修改客户余额失败: {str(e)}'
            }, status=500)

    def retrieve(self, request, *args, **kwargs):
        """获取客户详情"""
        instance = self.get_object()
        serializer = CustomerDetailSerializer(instance)
        return api_response(
            code=200,
            message="获取客户详情成功",
            data=serializer.data
        )

    def create(self, request, *args, **kwargs):
        """创建客户"""
        # 如果没有提供代理ID，则使用当前用户作为代理
        data = request.data.copy()
        if not data.get('agent_id') and request.user.is_agent:
            data['agent_id'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return api_response(
            code=201,
            message="创建客户成功",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        """更新客户信息"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return api_response(
            code=200,
            message="更新客户成功",
            data=serializer.data
        )

    def destroy(self, request, *args, **kwargs):
        """删除客户"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return api_response(
            code=200,
            message="删除客户成功",
            data={}
        )

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """重置客户密码"""
        instance = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data.get('data', request.data))
        serializer.is_valid(raise_exception=True)
        
        instance.set_password(serializer.validated_data['password'])
        instance.save()
        
        return api_response(
            code=200,
            message="密码重置成功",
            data={}
        )


    @action(detail=False, methods=['get'])
    def login_records(self, request, pk=None):
        """获取客户登录记录"""
        instance = self.get_object()
        records = LoginRecord.objects.filter(user=instance).order_by('-login_time')
        
        # 分页处理
        page = self.paginate_queryset(records)
        if page is not None:
            serializer = LoginRecordSerializer(page, many=True)
            return api_response(
                code=200,
                message="获取登录记录成功",
                data=serializer.data
            )
        
        serializer = LoginRecordSerializer(records, many=True)
        return api_response(
            code=200,
            message="获取登录记录成功",
            data=serializer.data
        )

    @action(detail=True, methods=['get'])
    def traffic_records(self, request, pk=None):
        """获取客户流量使用记录"""
        instance = self.get_object()
        records = TrafficRecord.objects.filter(customer=instance).order_by('-date')
        
        # 分页处理
        page = self.paginate_queryset(records)
        if page is not None:
            serializer = TrafficRecordSerializer(page, many=True)
            return api_response(
                code=200,
                message="获取流量记录成功",
                data=serializer.data
            )
        
        serializer = TrafficRecordSerializer(records, many=True)
        return api_response(
            code=200,
            message="获取流量记录成功",
            data=serializer.data
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def nodes(self, request):
        """获取用户的所有节点信息
        
        支持的查询参数：
        - order_no: 订单号筛选（支持trade_no或out_trade_no）
        - start_date: 开始时间筛选（格式：YYYY-MM-DD，基于订单下单时间）
        - end_date: 结束时间筛选（格式：YYYY-MM-DD，基于订单下单时间）
        - country: 国家筛选（筛选指定国家的节点）
        - page: 页码
        - page_size: 每页数量
        
        筛选条件可以单独使用，也可以组合使用。
        """
        try:
            # 获取当前用户
            user = request.user
            
            # 获取查询参数
            order_no = request.query_params.get('order_no')     # 订单号筛选
            start_date = request.query_params.get('start_date')  # 开始时间筛选
            end_date = request.query_params.get('end_date')      # 结束时间筛选
            country = request.query_params.get('country')       # 国家筛选
            
            # 构建查询条件
            query = {'user': user}
            
            # 添加订单号筛选
            if order_no:
                # 查找匹配的订单（支持trade_no或out_trade_no）
                matching_orders = PaymentOrder.objects.filter(
                    Q(trade_no=order_no) | Q(out_trade_no=order_no),
                    user=user
                ).values_list('id', flat=True)
                if matching_orders:
                    query['order_id__in'] = matching_orders
                else:
                    # 如果没有找到匹配的订单号，返回空结果
                    return Response({
                        'code': 200,
                        'message': '获取节点列表成功',
                        'data': {
                            'results': [],
                            'count': 0,
                            'next': None,
                            'previous': None
                        }
                    })
            
            # 添加时间筛选（基于订单下单时间）
            if start_date or end_date:
                # 首先获取符合时间条件的订单ID
                order_query = Q()
                if start_date:
                    try:
                        start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                        order_query &= Q(created_at__gte=start_datetime)
                    except ValueError:
                        return Response({
                            'code': 400,
                            'message': '开始时间格式错误，请使用YYYY-MM-DD格式',
                            'data': None
                        }, status=status.HTTP_400_BAD_REQUEST)
                
                if end_date:
                    try:
                        end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                        # 设置为当天的最后一秒
                        end_datetime = end_datetime.replace(hour=23, minute=59, second=59, microsecond=999999)
                        order_query &= Q(created_at__lte=end_datetime)
                    except ValueError:
                        return Response({
                            'code': 400,
                            'message': '结束时间格式错误，请使用YYYY-MM-DD格式',
                            'data': None
                        }, status=status.HTTP_400_BAD_REQUEST)
                
                # 获取符合时间条件的订单ID列表
                filtered_order_ids = PaymentOrder.objects.filter(order_query, user=user).values_list('id', flat=True)
                
                # 如果同时有订单号筛选，需要取交集
                if 'order_id__in' in query:
                    # 取两个筛选条件的交集
                    existing_order_ids = set(query['order_id__in'])
                    time_filtered_order_ids = set(filtered_order_ids)
                    query['order_id__in'] = list(existing_order_ids.intersection(time_filtered_order_ids))
                else:
                    query['order_id__in'] = filtered_order_ids
            
            # 添加国家筛选
            if country:
                # 先查询指定国家的面板ID列表
                from panels.models import AgentPanel
                country_panel_ids = AgentPanel.objects.filter(country=country).values_list('id', flat=True)
                if country_panel_ids:
                    query['panel_id__in'] = country_panel_ids
                else:
                    # 如果没有找到指定国家的面板，返回空结果
                    return Response({
                        'code': 200,
                        'message': '获取节点列表成功',
                        'data': {
                            'results': [],
                            'count': 0,
                            'next': None,
                            'previous': None
                        }
                    })
            
            # 获取用户的所有节点
            nodes = NodeInfo.objects.filter(**query)
            
            # 获取节点关联的所有面板ID
            panel_ids = [node.panel_id for node in nodes if node.panel_id]
            
            # 查询这些面板信息
            from panels.models import AgentPanel
            panels = AgentPanel.objects.filter(id__in=panel_ids)
            
            # 创建面板ID到国家的映射
            panel_country_map = {panel.id: panel.country for panel in panels}
            # 对节点按host+port分组，只保留每组中过期时间最晚的节点
            host_port_groups = {}
            for node in nodes:
                key = f"{node.host}:{node.port}"
                if key not in host_port_groups or node.expiry_time > host_port_groups[key].expiry_time:
                    host_port_groups[key] = node
            
            # 使用过滤后的节点列表
            filtered_nodes = list(host_port_groups.values())
            
            # 序列化节点数据
            nodes_data = []
            for node in filtered_nodes:
                # 从订单的param中获取节点类型
                node_type = ''
                if node.order and node.order.param:
                    try:
                        param = json.loads(node.order.param)
                        node_type = param.get('nodeType', '')
                    except:
                        pass
                
                # 获取面板国家
                country = panel_country_map.get(node.panel_id, '未知') if node.panel_id else '未知'
                order = PaymentOrder.objects.get(id=node.order.id)
                node_data = {
                    'id': node.id,
                    'remark': node.remark,
                    'remark_custom': node.remark_custom,
                    'protocol': node.protocol,
                    'host': node.host,
                    'port': node.port,
                    'uuid': node.uuid,
                    'host_config': node.host_config,
                    'node_user': node.node_user,
                    'node_password': node.node_password,
                    'status': node.status,
                    'expiry_time': node.expiry_time,
                    'created_at': node.created_at,
                    'updated_at': node.updated_at,
                    'order_id': node.order.id if node.order else None,
                    'trade_no': order.trade_no,
                    'out_trade_no': order.out_trade_no,
                    'node_type': node_type,  # 添加节点类型字段
                    'udp': node.udp,  # 添加udp字段
                    'panel_node_id': node.panel_node_id,  # 添加面板节点ID字段
                    'udp_host': node.udp_host,  # 添加udp_host字段
                    'udp_host_domain': get_udp_host_domain(node),  # 添加udp_host_domain字段
                    'country': country,  # 添加面板国家字段
                    'panel_id': node.panel_id  # 添加面板ID字段
                }
                nodes_data.append(node_data)
            
            # 应用分页
            paginator = CustomPagination()
            page = paginator.paginate_queryset(nodes_data, request)
            
            if page is not None:
                return paginator.get_paginated_response({
                    'code': 200,
                    'message': '获取节点列表成功',
                    'data': page
                })
            
            return Response({
                'code': 200,
                'message': '获取节点列表成功',
                'data': nodes_data
            })
            
        except Exception as e:
            print(f"获取节点列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取节点列表失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def update_node_remark(self, request, pk=None):
        """修改节点自定义备注"""
        try:
            # 获取当前用户
            user = request.user
            
            # 获取节点
            try:
                node = NodeInfo.objects.get(id=pk, user=user)
            except NodeInfo.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '节点不存在或无权访问',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 获取新的备注内容
            remark_custom = request.data.get('remark_custom')
            if remark_custom is None:
                return Response({
                    'code': 400,
                    'message': '缺少备注内容',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 更新备注
            node.remark_custom = remark_custom
            node.save(update_fields=['remark_custom'])
            
            return Response({
                'code': 200,
                'message': '修改节点备注成功',
                'data': {
                    'id': node.id,
                    'remark_custom': node.remark_custom
                }
            })
            
        except Exception as e:
            print(f"修改节点备注失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'修改节点备注失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PackageViewSet(viewsets.ModelViewSet):
    """套餐管理视图集"""
    queryset = Package.objects.all()
    serializer_class = PackageSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return api_response(
            code=200,
            message="获取套餐列表成功",
            data=serializer.data
        )
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(
            code=200,
            message="获取套餐详情成功",
            data=serializer.data
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return api_response(
            code=201,
            message="创建套餐成功",
            data=serializer.data
        )
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return api_response(
            code=200,
            message="更新套餐成功",
            data=serializer.data
        )
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return api_response(
            code=200,
            message="删除套餐成功",
            data={}
        )


class CustomerPackageViewSet(viewsets.ModelViewSet):
    """客户套餐管理视图集"""
    serializer_class = CustomerPackageSerializer
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]
    
    def get_queryset(self):
        user = self.request.user
        
        # 基础查询
        queryset = CustomerPackage.objects.all()
        
        # 权限过滤
        if user.user_type == 'agent_l2':
            queryset = queryset.filter(customer__agent=user)
        elif user.user_type == 'agent_l1':
            agent_ids = User.objects.filter(
                Q(parent=user) | 
                Q(id=user.id)
            ).values_list('id', flat=True)
            queryset = queryset.filter(customer__agent__id__in=agent_ids)
        elif user.user_type == 'customer':
            queryset = queryset.filter(customer=user)
        
        # 过滤条件
        customer_id = self.request.query_params.get('customer_id')
        if customer_id and customer_id.isdigit():
            queryset = queryset.filter(customer_id=int(customer_id))
            
        is_active = self.request.query_params.get('is_active')
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
            
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return api_response(
            code=200,
            message="获取客户套餐列表成功",
            data=serializer.data
        )
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(
            code=200,
            message="获取客户套餐详情成功",
            data=serializer.data
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return api_response(
            code=201,
            message="创建客户套餐成功",
            data=serializer.data
        )
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return api_response(
            code=200,
            message="更新客户套餐成功",
            data=serializer.data
        )
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return api_response(
            code=200,
            message="删除客户套餐成功",
            data={}
        )

class WebsiteTemplateViewSet(viewsets.GenericViewSet):
    """网站模板设置视图集"""
    serializer_class = WebsiteTemplateSerializer
    permission_classes = [IsAuthenticated, IsAgentL2]  # 只允许二级代理访问
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_object(self):
        """获取当前用户的网站模板设置，如果不存在则创建"""
        user = self.request.user
        template, created = WebsiteTemplate.objects.get_or_create(agent=user)
        return template
    
    @action(detail=False, methods=['get'])
    def get_template(self, request):
        """获取网站模板设置"""
        instance = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return api_response(
            code=200,
            message="获取网站模板设置成功",
            data=serializer.data
        )
    
    @action(detail=False, methods=['post'])
    def update_template(self, request):
        """创建或更新网站模板设置"""
        instance = self.get_object()
        
        # 处理网站名称
        website_name = request.data.get('website_name')
        if website_name:
            instance.website_name = website_name
        
        # 处理Logo上传
        if 'logo' in request.FILES:
            logo = request.FILES['logo']
            # 验证文件大小（最大2MB）
            if logo.size > 2 * 1024 * 1024:
                return api_response(
                    code=400,
                    message="Logo图片不能超过2MB",
                    data={}
                )
            # 如果存在旧Logo，删除它
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = logo
        
        # 处理背景图上传
        if 'background' in request.FILES:
            background = request.FILES['background']
            # 验证文件大小（最大4MB）
            if background.size > 4 * 1024 * 1024:
                return api_response(
                    code=400,
                    message="背景图片不能超过4MB",
                    data={}
                )
            # 如果存在旧背景图，删除它
            if instance.background:
                instance.background.delete(save=False)
            instance.background = background
        
        instance.save()
        serializer = self.get_serializer(instance, context={'request': request})
        return api_response(
            code=200,
            message="更新网站模板设置成功",
            data=serializer.data
        )

class CustomerLoginView(APIView):
    """客户登录视图"""
    permission_classes = [AllowAny]  # 允许未认证用户访问

    def post(self, request):
        """客户登录接口"""
        try:
            # 获取登录凭证（用户名或邮箱）和密码
            login = request.data.get('username')
            password = request.data.get('password')

            if not login or not password:
                return Response({
                    'code': 400,
                    'message': '用户名/邮箱和密码不能为空',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
                
            # 尝试使用用户名或邮箱查找用户
            user = None
            if '@' in login:
                try:
                    user = User.objects.get(email=login, user_type='customer')
                except User.DoesNotExist:
                    return Response({
                        'code': 400,
                        'message': '邮箱不存在或不是客户用户',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                try:
                    user = User.objects.get(username=login, user_type='customer')
                except User.DoesNotExist:
                    return Response({
                        'code': 400,
                        'message': '用户名不存在或不是客户用户',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 验证密码
            # 验证用户是否被停用
            if not user.is_active:
                return Response({
                    'code': 400,
                    'message': '该账户已被停用，请联系管理员',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(password):
                return Response({
                    'code': 400,
                    'message': '密码错误',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
                
            # 验证用户所属代理商的域名与请求源域名是否匹配
            # 获取请求域名
            requesting_domain = request.META.get('HTTP_HOST', '')
            origin = request.META.get('HTTP_ORIGIN', '')
            referer = request.META.get('HTTP_REFERER', '')
            
            # 尝试从HTTP_REFERER中提取域名
            referer_domain = ''
            if referer and '://' in referer:
                referer_parts = referer.split('://', 1)[1]
                if '/' in referer_parts:
                    referer_domain = referer_parts.split('/', 1)[0]
                else:
                    referer_domain = referer_parts
            
            # 尝试从HTTP_ORIGIN中提取域名
            origin_domain = ''
            if origin and '://' in origin:
                origin_domain = origin.split('://', 1)[1]
            
            # 使用多种方法尝试获取源地址
            source_domain = referer_domain or origin_domain or requesting_domain
            
            if not source_domain:
                return Response({
                    'code': 400,
                    'message': '无法获取请求域名',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取用户所属代理
            if not user.parent_id:
                logger.warning(f"用户 {user.username} 没有关联代理")
                # 如果没有关联代理，尝试查找匹配域名的代理
                agent = None
                agents = User.objects.filter(user_type='agent_l2')
                for potential_agent in agents:
                    if potential_agent.domain and source_domain.endswith(potential_agent.domain):
                        agent = potential_agent
                        break
                        
                if not agent:
                    return Response({
                        'code': 400,
                        'message': '您所使用的网站域名未关联到有效代理',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # 用户已关联代理，验证域名是否匹配
                agent = user.parent
                if not agent.domain or not source_domain.endswith(agent.domain):
                    logger.warning(f"域名不匹配: 用户域名 {agent.domain}, 请求域名 {source_domain}")
                    return Response({
                        'code': 400,
                        'message': '您无法在当前网站登录，请使用关联代理的官方网站',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 生成JWT Token
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)

            # 更新用户的登录信息
            user.last_login = timezone.now()
            # 优先从X-Real-IP头获取IP，其次从X-Forwarded-For获取，最后使用REMOTE_ADDR
            try:
                user.last_login_ip = request.META.get('HTTP_X_REAL_IP') or \
                               request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
                               request.META.get('REMOTE_ADDR', '')
            except Exception as e:
                logger.error(f"获取IP失败: {str(e)}")
                user.last_login_ip = '127.0.0.1'
            
            user.save(update_fields=['last_login', 'last_login_ip'])

            return Response({
                'code': 200,
                'message': '登录成功',
                'data': {
                    'access_token': access_token,
                    'refresh_token': str(refresh),
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'user_type': user.user_type,
                        'balance': user.balance,  # 增加余额字段
                        'last_login': user.last_login,  # 添加最后登录时间
                        'last_login_ip': user.last_login_ip  # 添加最后登录IP
                    }
                }
            })

        except Exception as e:
            logger.error(f"登录失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'登录失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def generate_sign(params):
    """
    生成MD5签名
    :param params: 参数字典
    :return: 签名
    """
    # 不再过滤参数，直接使用传入的所有参数
    filtered_params = params
    
    # 按照参数名ASCII码从小到大排序
    sorted_params = sorted(filtered_params.items(), key=lambda x: x[0])
    
    # 拼接成URL键值对格式
    param_str = '&'.join([f"{k}={v}" for k, v in sorted_params])
    
    # 拼接商户密钥
    sign_str = param_str + '00m306t35efm526dmDtTeM052t5e6KEN'
    
    # 生成MD5签名
    return hashlib.md5(sign_str.encode('utf-8')).hexdigest()

@api_view(['GET'])
@permission_classes([AllowAny])
def payment_callback(request):
    """
    支付异步回调接口
    """
    try:
        # 获取所有参数
        params = request.GET.dict()
        
        
        # 验证支付状态
        trade_status = params.get('trade_status')
        trade_no = params.get('trade_no')
        out_trade_no = params.get('out_trade_no')
        
        if not out_trade_no:
            return Response({"success": False, "message": "订单号为空"})
        
        # 查找订单
        try:
            order = PaymentOrder.objects.get(out_trade_no=out_trade_no)
        except PaymentOrder.DoesNotExist:
            return Response({"success": False, "message": "订单不存在"})
        
        # 检查是否已处理
        if order.is_processed:
            return Response({"success": True, "message": "订单已处理"})
        
        # 验证支付状态为成功
        if trade_status == 'TRADE_SUCCESS':
            # 更新订单信息
            order.trade_no = trade_no
            order.status = 'success'
            order.is_processed = True
            order.save()
            
            # 预留：订单支付成功后的业务处理逻辑
            # 1. 激活用户购买的服务
            # 2. 为用户创建节点
            # 3. 更新相关统计数据
            try:
                # 这里可以添加支付成功后的业务逻辑处理
                process_successful_payment(order)
            except Exception as e:
                logger.error(f"处理支付成功后的业务逻辑时出错: {str(e)}")
                # 不抛出异常，继续处理后续逻辑
        
        # 返回成功响应
        return Response({"success": True})
    
    except Exception as e:
        logger.error(f"处理支付回调出错: {str(e)}")
        return Response({"success": False, "message": str(e)})

def process_successful_payment(order):
    """
    处理支付成功后的业务逻辑
    此函数将在订单支付成功后被调用
    
    :param order: 支付成功的订单对象
    """
    try:
        # 用于收集需要重启的面板
        panels_to_restart = set()
        # 用于收集最终失败的节点（需要退款）
        failed_nodes_for_refund = []
        # 用于记录已扣除的代理余额（用于退款时回退）
        agent_balance_deducted = {}
        
        # 查找订单关联的节点信息记录
        nodes = NodeInfo.objects.filter(order=order)
        if not nodes.exists():
            logger.warning(f"订单 {order.out_trade_no} 没有关联的节点信息")
            return
            
        logger.info(f"为订单 {order.out_trade_no} 创建 {nodes.count()} 个节点")
        
        # 扣除代理余额
        try:
            # 获取订单用户
            user = order.user
            # 如果用户是客户，且有上级代理
            if user.user_type == 'customer' and user.parent:
                # 获取上级代理
                agent = user.parent
                # 扣除代理余额
                agent.balance -= order.amount
                agent.save(update_fields=['balance'])
                # 记录已扣除的代理余额，用于可能的退款
                agent_balance_deducted[agent.id] = {
                    'agent': agent,
                    'amount': order.amount
                }
                logger.info(f"从代理 {agent.username} 的余额中扣除 {order.amount} 元，当前余额: {agent.balance}")
        except Exception as e:
            logger.error(f"扣除代理余额时出错: {str(e)}")
            # 继续处理节点创建，不中断流程
        
        # 遍历所有节点信息
        for node in nodes:
            try:
                # 解析host_config
                if node.host_config:
                    if isinstance(node.host_config, dict):
                        # 如果是字典，直接使用
                        host_config = node.host_config
                    else:
                        # 如果是字符串，转换为字典
                        host_config = json.loads(node.host_config)
                    logger.info(f"处理节点 {node.id}, 面板: {host_config}")
                    
                    # 获取面板信息
                    panel_id = host_config.get('id')
                    if not panel_id:
                        logger.error(f"节点 {node.id} 的host_config中没有panel_id")
                        continue
                        
                    try:
                        panel = AgentPanel.objects.get(id=panel_id)
                    except AgentPanel.DoesNotExist:
                        logger.error(f"找不到ID为 {panel_id} 的面板")
                        continue
                    
                    # 解析config_text获取节点配置
                    if not node.config_text:
                        logger.error(f"节点 {node.id} 没有config_text数据")
                        continue
                        
                    # 解析config_text为JSON对象
                    form_data = json.loads(node.config_text)
                    
                    # 调整form_data格式，将嵌套对象转为字符串
                    nested_fields = ['settings', 'streamSettings', 'sniffing', 'allocate']
                    for field in nested_fields:
                        if field in form_data and isinstance(form_data[field], (dict, list)):
                            # 将对象转为JSON字符串
                            form_data[field] = json.dumps(form_data[field])
                    
                    
                    # 构建请求头
                    if panel.panel_type == 'x-ui':
                        url = f"http://{panel.ip_address}/xui/inbound/add"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                    else:  # 3x-ui
                        url = f"http://{panel.ip_address}/panel/api/inbounds/add"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                        panels_to_restart.add(panel)
                    
                    # 尝试获取cookie
                    if not panel.cookie:
                        logger.info(f"面板 {panel_id} 无cookie，尝试登录获取")
                        cookie = get_login_cookie(panel, host_config)
                        if not cookie:
                            logger.error(f"无法获取面板 {panel_id} 的cookie")
                            continue
                    
                    # 发送创建节点请求
                    try:
                        # 使用封装的请求函数，自动处理cookie过期问题
                        response = make_request_with_cookie(
                            panel, 
                            host_config, 
                            url, 
                            headers, 
                            method='post_params', 
                            data=form_data
                        )
                        # 检查响应
                        if response.status_code == 200:
                            try:
                                result = response.json()
                                success = result.get('success', False)
                                if success:
                                    # 获取新创建的节点ID
                                    if panel.panel_type == 'x-ui':
                                        list_url = f"http://{panel.ip_address}/xui/inbound/list"
                                        list_response = make_request_with_cookie(
                                            panel,
                                            host_config,
                                            list_url,
                                            headers,
                                            method='post'
                                        )
                                        
                                        if list_response.status_code == 200:
                                            list_result = list_response.json()
                                            if list_result.get('success'):
                                                # 获取请求中的端口号
                                                request_port = form_data.get('port')
                                                if request_port:
                                                    # 遍历节点列表查找匹配的端口
                                                    for inbound in list_result.get('obj', []):
                                                        if str(inbound.get('port')) == str(request_port):
                                                            panel_node_id = inbound.get('id')
                                                            break
                                    else:  # 3x-ui
                                        panel_node_id = result.get('obj', {}).get('id')
                                        #创建绑定出站规则和路由规则
                                        tag = result.get('obj', {}).get('tag')
                                        headers = {
                                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                            'host': f'{panel.ip_address.split("/")[0]}',
                                            'Accept': 'application/json, text/plain, */*',
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                            'Origin': f'http://{panel.ip_address.split("/")[0]}',
                                            'Referer': f'http://{panel.ip_address}/panel/'
                                        }
                                        
                                        # 获取xray配置
                                        url = f"http://{panel.ip_address}/panel/xray/"
                                        response = make_request_with_cookie(panel, {
                                            'ip': panel.ip_address,
                                            'username': panel.username,
                                            'password': panel.password,
                                            'panel_type': panel.panel_type
                                        }, url, headers, method='post')
                                        
                                        if response.status_code == 200:
                                            result = response.json()
                                            if result.get('success'):
                                                # 获取xray配置
                                                xraySetting = json.loads(result.get('obj', {}))
                                                # 创建绑定出站规则和路由规则
                                                # outbound_rules = 
                                                xraySetting['xraySetting']['routing']['rules'].append({
                                                    "type": "field",
                                                    "outboundTag": host_config.get('tag'),
                                                    "inboundTag": [
                                                        tag
                                                    ]
                                                })
                                                update_data = {
                                                    'xraySetting': json.dumps(xraySetting.get('xraySetting'))
                                                }
                                                # 发送更新请求
                                                update_response = make_request_with_cookie(
                                                    panel,
                                                    host_config,
                                                    f"http://{panel.ip_address}/panel/xray/update",
                                                    {
                                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                                        'Accept': 'application/json, text/plain, */*',
                                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                                    },
                                                    method='post',
                                                    data=update_data
                                                )
                                                if update_response.status_code == 200:
                                                    print(f"更新xray配置成功")
                                                else:
                                                    print(f"更新xray配置失败: {update_response.text}")
                                            
                                        # 重启面板/server/restartXrayService
                                        # url_restart = f"http://{panel.ip_address}/server/restartXrayService"
                                        # response = make_request_with_cookie(panel, {
                                        #     'ip': panel.ip_address,
                                        #     'username': panel.username,
                                        #     'password': panel.password,
                                        #     'panel_type': panel.panel_type
                                        # }, url_restart, headers, method='get')
                                        # if response.status_code == 200:
                                        #     print(f"重启面板成功")
                                        # else:
                                        #     print(f"重启面板失败: {response.text}")
                                    # 更新节点状态和面板节点ID
                                    node.status = 'active'
                                    node.panel_node_id = panel_node_id
                                    if node.udp:
                                        try:
                                            # 解析 JSON 字符串
                                            udp_config_json = json.loads(node.udp_config)
                                            
                                            # 获取配置信息
                                            udp_zhanghao = udp_config_json.get('config', {})
                                            udp_peizhi = udp_config_json.get('udpConfig', {})
                                            transit_account = TransitAccount.objects.get(id=udp_zhanghao.get('id'))
                                            auth_token = transit_account.token
                                            if not auth_token:
                                                login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                login_data = {
                                                    "username": udp_zhanghao.get('username'),
                                                    "password": udp_zhanghao.get('password')
                                                }
                                                headers_nyanpass = {
                                                    "Content-Type": "text/plain;charset=UTF-8",
                                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                    "Accept": "*/*",
                                                    "Origin": settings.API_BASE_URL,
                                                }
                                                login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                if login_response.status_code == 200:
                                                    login_result = login_response.json()
                                                    auth_token = login_result.get('data', {})
                                                    transit_account.token = auth_token
                                                    transit_account.save(update_fields=['token'])
                                            
                                            # 中转登录
                                            try:
                                                
                                                login_result = login_response.json()
                                                auth_token = login_result.get('data', {})
                                                
                                                if auth_token:
                                                    # 创建转发
                                                    forward_url = f"{settings.API_BASE_URL}/api/v1/user/forward"
                                                    forward_headers = {
                                                        "Authorization": f"{auth_token}",
                                                        "Content-Type": "application/json"
                                                    }
                                                    
                                                    # 执行中转注册，添加重试机制
                                                    retry_count = 0
                                                    max_retries = 4  # 最大重试次数，加上首次请求总共尝试2次
                                                    forward_success = False
                                                    
                                                    while retry_count <= max_retries and not forward_success:
                                                        forward_response = requests.put(forward_url, headers=forward_headers, json=udp_peizhi)
                                                        if forward_response.status_code == 200 and forward_response.json().get('code') != 403:
                                                            forward_success = True
                                                        elif forward_response.status_code == 403 or search_rules_response.json().get('code') == 403 or retry_count==3:
                                                            retry_count += 1
                                                            login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                            login_data = {
                                                                "username": udp_zhanghao.get('username'),
                                                                "password": udp_zhanghao.get('password')
                                                            }
                                                            headers_nyanpass = {
                                                                "Content-Type": "text/plain;charset=UTF-8",
                                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                                "Accept": "*/*",
                                                                "Origin": settings.API_BASE_URL,
                                                            }
                                                            login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                            if login_response.status_code == 200:
                                                                login_result = login_response.json()
                                                                auth_token = login_result.get('data', {})
                                                                transit_account.token = auth_token
                                                                transit_account.save(update_fields=['token'])
                                                                forward_headers = {
                                                                    "Authorization": f"{auth_token}",
                                                                    "Content-Type": "application/json"
                                                                }
                                                        else:
                                                            retry_count += 1
                                                            if retry_count <= max_retries:
                                                                # 随机等待0.5到1秒后重试
                                                                wait_time = random.uniform(5, 15)
                                                                logger.info(f"UDP转发创建失败，等待{wait_time:.2f}秒后进行第{retry_count+1}次尝试")
                                                                time.sleep(wait_time)
                                                            else:
                                                                logger.error(f"UDP转发创建失败，已重试{max_retries}次: {forward_response.text}")
                                                    
                                                    if forward_success:                                                       
                                                        # 获取转发规则
                                                        search_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
                                                        search_rules_data = {
                                                            "gid": 0,
                                                            "gid_in": 0,
                                                            "gid_out": 0,
                                                            "name": "",
                                                            "dest": json.loads(udp_peizhi.get('config')).get('dest')[0],
                                                            "listen_port": 0
                                                        }
                                                        search_rules_response = requests.post(
                                                            search_rules_url,
                                                            headers=forward_headers,
                                                            json=search_rules_data
                                                        )
                                                        
                                                        if search_rules_response.status_code == 200:

                                                            search_rules_data = search_rules_response.json()
                                                            if search_rules_data.get('code') == 0 and search_rules_data.get('data'):
                                                                # 获取监听端口
                                                                listen_port = search_rules_data['data'][0]['listen_port']
                                                                
                                                                # 获取设备组信息
                                                                device_group_url = f"{settings.API_BASE_URL}/api/v1/user/devicegroup"
                                                                device_group_response = requests.get(
                                                                    device_group_url,
                                                                    headers=forward_headers
                                                                )
                                                                
                                                                if device_group_response.status_code == 200:
                                                                    device_group_data = device_group_response.json()
                                                                    if device_group_data.get('code') == 0 and device_group_data.get('data'):
                                                                        # 查找匹配的设备组
                                                                        for group in device_group_data['data']:
                                                                            if group['id'] == search_rules_data['data'][0]['device_group_in']:
                                                                                # 拼装 UDP 主机地址
                                                                                udp_host = f"{group['id']}:{listen_port}"
                                                                                # 更新 NodeInfo 的 udp_host 字段
                                                                                node.udp_host = udp_host
                                                                                node.save(update_fields=['udp_host'])
                                                                                break
                                                    else:
                                                        logger.error(f"UDP转发创建失败，已重试{max_retries}次仍失败")
                                                else:
                                                    logger.error(f"中转登录失败: {login_response.text}")
                                            
                                            except Exception as e:
                                                logger.error(f"处理UDP中转配置时出错: {str(e)}")
                                        except Exception as e:
                                            logger.error(f"处理UDP配置时出错: {str(e)}")
                                    
                                    node.save(update_fields=['status', 'panel_node_id', 'udp_config'])
                                else:
                                    error_msg = result.get('msg', '未知错误')
                                    logger.error(f"创建节点失败: {error_msg}")
                                    node.status = 'inactive'
                                    node.save(update_fields=['status'])
                            except json.JSONDecodeError:
                                logger.error(f"解析面板响应失败: {response.text}")
                                node.status = 'inactive'
                                node.save(update_fields=['status'])
                        else:
                            logger.error(f"面板返回错误状态码: {response.status_code}, 响应: {response.text}")
                            node.status = 'inactive'
                            node.save(update_fields=['status'])
                        

                    except Exception as e:
                        error_msg = str(e)
                        logger.error(f"发送创建节点请求时出错: {error_msg}")
                        
                        # 检查是否是连接类型的错误（面板可能离线）
                        is_connection_error = (
                            'ConnectionError' in error_msg or
                            'Timeout' in error_msg or
                            'ReadTimeout' in error_msg or
                            'RequestException' in error_msg or
                            '连接失败' in error_msg or
                            '节点离线' in error_msg or
                            '离线' in error_msg
                        )
                        
                        if is_connection_error:
                            logger.warning(f"面板 {panel_id} 可能离线，尝试查找替代面板")
                            
                            # 1. 确保面板被标记为离线
                            panel.is_online = False
                            panel.save(update_fields=['is_online'])
                            
                            # 2. 查找该国家下其他在线的面板
                            alternative_panels = AgentPanel.objects.filter(
                                country=panel.country,
                                is_online=True,
                                panel_type=panel.panel_type,
                                is_active=True
                            ).exclude(id=panel.id).order_by('nodes_count')
                            
                            # 3. 如果找到替代面板，使用新面板重新创建节点
                            if alternative_panels.exists():
                                new_panel = alternative_panels.first()
                                logger.info(f"找到替代面板 {new_panel.id}，尝试重新创建节点")
                                
                                try:
                                    # 更新 host_config 中的面板信息
                                    host_config['id'] = new_panel.id
                                    host_config['ip'] = new_panel.ip_address
                                    host_config['username'] = new_panel.username
                                    host_config['password'] = new_panel.password
                                    
                                    # 更新节点的 host_config
                                    node.host_config = json.dumps(host_config)
                                    node.save(update_fields=['host_config'])
                                    
                                    # 更新使用新的面板对象
                                    panel = new_panel
                                    
                                    # 尝试获取新面板的 cookie
                                    if not new_panel.cookie:
                                        cookie = get_login_cookie(new_panel, host_config)
                                        if not cookie:
                                            logger.error(f"无法获取新面板 {new_panel.id} 的cookie")
                                            failed_nodes_for_refund.append({
                                                'node': node,
                                                'reason': f'无法获取替代面板 {new_panel.id} 的登录凭证',
                                                'panel_country': new_panel.country
                                            })
                                            node.status = 'inactive'
                                            node.save(update_fields=['status'])
                                            continue
                                    
                                    # 重新发送创建节点请求
                                    logger.info(f"使用替代面板 {new_panel.id} 重新创建节点 {node.id}")
                                    response = make_request_with_cookie(
                                        panel, 
                                        host_config, 
                                        url, 
                                        headers, 
                                        method='post_params', 
                                        data=form_data
                                    )
                                    
                                    # 处理响应（简化版本，不处理UDP等复杂逻辑）
                                    if response.status_code == 200:
                                        result = response.json()
                                        if result.get('success', False):
                                            # 获取新创建的节点ID
                                            if panel.panel_type == 'x-ui':
                                                panel_node_id = None  # x-ui 需要通过列表查找
                                            else:  # 3x-ui
                                                panel_node_id = result.get('obj', {}).get('id')
                                            
                                            # 更新节点状态
                                            node.status = 'active'
                                            if panel_node_id:
                                                node.panel_node_id = panel_node_id
                                            node.save(update_fields=['status', 'panel_node_id'])
                                            logger.info(f"使用替代面板成功创建节点 {node.id}")
                                            continue
                                        else:
                                            error_msg = result.get('msg', '未知错误')
                                            logger.error(f"替代面板创建节点失败: {error_msg}")
                                            failed_nodes_for_refund.append({
                                                'node': node,
                                                'reason': f'替代面板创建失败: {error_msg}',
                                                'panel_country': new_panel.country
                                            })
                                            node.status = 'inactive'
                                            node.save(update_fields=['status'])
                                            continue
                                    else:
                                        logger.error(f"替代面板返回错误状态码: {response.status_code}")
                                        failed_nodes_for_refund.append({
                                            'node': node,
                                            'reason': f'替代面板返回错误状态码: {response.status_code}',
                                            'panel_country': new_panel.country
                                        })
                                        node.status = 'inactive'
                                        node.save(update_fields=['status'])
                                        continue
                                        
                                except Exception as retry_error:
                                    logger.error(f"使用替代面板重新创建节点失败: {str(retry_error)}")
                                    failed_nodes_for_refund.append({
                                        'node': node,
                                        'reason': f'替代面板重新创建失败: {str(retry_error)}',
                                        'panel_country': new_panel.country
                                    })
                                    node.status = 'inactive'
                                    node.save(update_fields=['status'])
                                    continue
                            else:
                                # 没有找到替代面板，记录为需要退款
                                logger.error(f"节点 {node.id} 所属国家 {panel.country} 下无其他可用面板，需要退款")
                                failed_nodes_for_refund.append({
                                    'node': node,
                                    'reason': f'国家 {panel.country} 下无可用面板',
                                    'panel_country': panel.country
                                })
                                node.status = 'inactive'
                                node.save(update_fields=['status'])
                                continue
                        else:
                            # 非连接错误，直接标记为失败
                            logger.error(f"非连接错误，节点创建失败: {error_msg}")
                            node.status = 'inactive'
                            node.save(update_fields=['status'])
                            failed_nodes_for_refund.append({
                                'node': node,
                                'reason': error_msg,
                                'panel_country': panel.country if panel else '未知'
                            })
                            continue
                else:
                    logger.error(f"节点 {node.id} 没有有效的host_config")
                    node.status = 'inactive'
                    node.save(update_fields=['status'])
                    failed_nodes_for_refund.append({
                        'node': node,
                        'reason': '没有有效的host_config',
                        'panel_country': '未知'
                    })
                
            except Exception as e:
                logger.error(f"处理节点 {node.id} 时出错: {str(e)}")
                failed_nodes_for_refund.append({
                    'node': node,
                    'reason': f'处理节点时异常: {str(e)}',
                    'panel_country': '未知'
                })
                continue
                
                
        # 处理失败的节点（需要退款的情况）
        if failed_nodes_for_refund:
            logger.warning(f"订单 {order.out_trade_no} 有 {len(failed_nodes_for_refund)} 个节点创建失败，需要退款")
            
            # 回退代理余额
            if agent_balance_deducted:
                for agent_id, deduction_info in agent_balance_deducted.items():
                    try:
                        agent = deduction_info['agent']
                        refund_amount = deduction_info['amount']
                        agent.balance += refund_amount
                        agent.save(update_fields=['balance'])
                        logger.info(f"已退款 {refund_amount} 元到代理 {agent.username}，当前余额: {agent.balance}")
                    except Exception as refund_error:
                        logger.error(f"退款给代理 {agent_id} 时出错: {str(refund_error)}")
            
            # 更新订单状态
            order.is_processed = True
            order.save(update_fields=['is_processed'])
            logger.warning(f"订单 {order.out_trade_no} 处理完成（部分节点创建失败，已退款）")
        else:
            # 所有节点创建成功
            order.is_processed = True
            order.save(update_fields=['is_processed'])
            logger.info(f"订单 {order.out_trade_no} 处理完成")

        # 所有节点处理完成后，统一重启所有使用到的面板
        logger.info(f"所有节点创建完成，准备重启 {len(panels_to_restart)} 个面板")
        for panel in panels_to_restart:
            try:
                logger.info(f"重启面板 {panel.id} ({panel.ip_address})")
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                }
                
                panel_info = {
                    'ip': panel.ip_address,
                    'username': panel.username,
                    'password': panel.password,
                    'panel_type': panel.panel_type
                }
                
                url_restart = f"http://{panel.ip_address}/server/restartXrayService"
                response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                if response.json().get('success'):
                    logger.info(f"重启面板 {panel.id} 成功")
                else:
                    logger.error(f"重启面板 {panel.id} 重试0次失败: {response.text}")
                    response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                    if response.json().get('success'):
                        logger.info(f"重启面板 {panel.id} 成功")
                    else:
                        response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                        logger.error(f"重启面板 {panel.id} 重试1次失败: {response.text}")
                    
            except Exception as e:
                logger.error(f"重启面板 {panel.id} 时出错: {str(e)}")
    
        
    except Exception as e:
        logger.error(f"处理支付成功后的业务逻辑时出错: {str(e)}")
        # 不抛出异常，避免影响回调处理流程

@api_view(['POST'])
def payment_submit(request): 
    """
    支付接口
    """
    return Response({
        'code': 200,
        'message': '支付功能限制，请使用余额支付',
        'data': None
    }, status=status.HTTP_200_OK)
    
    try:
        # 获取请求参数并转换为普通字典，同时将列表值转换为字符串
        data = request.data
        node_user = request.data.get('username')
        node_password = request.data.get('password')
        country = request.data.get('region')
        node_count = request.data.get('quantity', 1)  # 默认创建1个节点
        if not country:
            return Response({
                'code': 400,
                'message': '国家参数不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            node_count = int(node_count)
            if node_count < 1:
                node_count = 1
        except (TypeError, ValueError):
            node_count = 1


        # 创建节点参数，先缓存到节点表中，支付成功后，在通过xui接口创建节点


        # 验证必要参数
        data['pid']= 1207
        required_fields = ['region','nodeType', 'protocol','period', 'quantity', 'paymentMethod']
        for field in required_fields:
            if field not in data:
                return Response({
                    'code': 0,
                    'msg': f'缺少必要参数: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)
        # 获取请求域名
        requesting_domain = request.META.get('HTTP_HOST', '')
        origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
        referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
        
        # 尝试从HTTP_REFERER中提取域名
        referer_domain = ''
        if referer and '://' in referer:
            referer_parts = referer.split('://', 1)[1]
            if '/' in referer_parts:
                referer_domain = referer_parts.split('/', 1)[0]
            else:
                referer_domain = referer_parts
        
        # 尝试从HTTP_ORIGIN中提取域名
        origin_domain = ''
        if origin and '://' in origin:
            origin_domain = origin.split('://', 1)[1]
        
        
        # 使用多种方法尝试获取源地址
        source_domain = referer_domain or origin_domain or requesting_domain
        data['clientip'] = source_domain
        # 添加设备类型
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        if 'micromessenger' in user_agent:
            device = 'wechat'
        elif 'android' in user_agent:
            device = 'android'
        elif 'iphone' in user_agent or 'ipad' in user_agent:
            device = 'ios'
        else:
            device = 'pc'
        data['device'] = device
        
        # 设置通知地址
        data['notify_url'] = 'http://23.27.28.122:8008/api/payment/callback/'
        
        # 从token获取用户信息
        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
            print(f"已从token中获取到用户ID: {user.id}, 用户名: {user.username}")
        else:
            print("请求中未包含有效的认证token，无法获取用户信息")
            
        # 计算价格和过期时间
        money = 0
        expiry_time = 0
        now = timezone.now()  # 获取当前时间
        
        # 通过请求域名查找匹配的二级代理
        matched_agent = None
        agents = User.objects.filter(user_type='agent_l2')
        
        for agent in agents:
            if agent.domain and source_domain.endswith(agent.domain):
                matched_agent = agent
                break
        
        if not matched_agent:
            return Response({
                'code': 404,
                'message': '未找到匹配的代理',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 获取节点类型和付费周期
        node_type = data.get('nodeType', '').lower()  # 'normal' 或 'live' 或 'transit'
        period = data.get('period', '').lower()  # 'monthly', 'quarterly', 'half_yearly', 'yearly'
        
        # 根据节点类型和付费周期获取对应的价格
        if node_type == 'normal':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'normal_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'normal_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'normal_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'normal_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'live':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'live_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'live_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'live_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'live_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'transit':
            # 获取中转节点价格
            if period == 'monthly':
                field_name = 'transit_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'transit_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'transit_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'transit_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'code': 400,
                'message': f'无效的节点类型: {node_type}',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取价格（优先使用自定义价格）
        money = get_price_or_parent(matched_agent, field_name, user if user else None)
        
        # 处理优惠券代码
        coupon_code = data.get('coupon')
        discount = 0
        if coupon_code:
            print('处理优惠券:', coupon_code)
            try:
                # 检查优惠券是否存在
                coupon = CDK.objects.get(code=coupon_code)
                
                # 检查优惠券的有效性条件
                now = timezone.now()
                if (coupon.is_active and 
                    coupon.valid_from <= now and 
                    coupon.valid_until >= now and 
                    coupon.used_count < coupon.max_uses):
                    
                    # 验证创建者和域名权限
                    creator = coupon.created_by
                    is_valid = False
                    
                    if creator.user_type == 'agent_l1':
                        # 一级代理创建的优惠券对所有站点有效
                        is_valid = True
                    elif creator.user_type == 'agent_l2':
                        # 二级代理创建的优惠券只对自己的域名有效
                        if creator.domain and source_domain.endswith(creator.domain):
                            is_valid = True
                    
                    if is_valid:
                        # 应用折扣
                        discount = coupon.discount
                        print(f'应用优惠券折扣: {discount}%')
                        # 更新已使用次数
                        coupon.used_count += 1
                        coupon.save()
                    else:
                        print('优惠券不适用于此网站')
                else:
                    print('优惠券无效(过期/未生效/已达使用上限)')
            except CDK.DoesNotExist:
                print('优惠券不存在')
            except Exception as e:
                print(f'验证优惠券时出错: {str(e)}')
        
        # 应用折扣
        if discount > 0:
            # 将 discount/100 转换为 Decimal 类型以避免类型不匹配
            discount_factor = Decimal(str(1 - discount / 100))
            money = money * discount_factor
            print(f'折扣后金额: {money}')
        
        # 计算过期时间（当前时间 + 天数）
        expiry_time = int((now + timedelta(days=days)).timestamp() * 1000)  # 转换为毫秒级时间戳
        
        # 设置订单金额
        data['money'] = float(money) * int(node_count)  # 价格乘以节点数量
                
        # 发送请求到第三方支付接口前，先生成订单编号
        # 订单编号由年月日+时间戳+6位随机数组成
        order_no = f"{timezone.now().strftime('%Y%m%d')}{int(timezone.now().timestamp())}{random.randint(100000, 999999)}"
        # 生成签名
        sign_data = {
            'pid': '1207',
            'out_trade_no': order_no,
            'type': data['paymentMethod'],
            'notify_url': data['notify_url'],
            'name': f'代理订单：{node_type}-{period}-{node_count}节点',
            'money': data['money'],
            'clientip': data['clientip'],
            'device': data['device'],
            'param': f'代理信息：{data["region"]}-{data["nodeType"]}-{data["protocol"]}-{data["period"]}',
            'trade_status': 'TRADE_SUCCESS',
        }
        
        # 生成签名
        sign_data['sign'] = generate_sign(sign_data)
        sign_data['sign_type'] = 'MD5'
        
        # 查询在线的代理面板，按国家筛选（不区分大小写）
        panels_3x_ui = AgentPanel.objects.filter(
            is_online=True,
            country__iexact=country,
            panel_type='3x-ui'
        ).order_by('nodes_count')

        panels_x_ui = AgentPanel.objects.filter(
            is_online=True,
            country__iexact=country,
            panel_type='x-ui'
        ).order_by('nodes_count')
        
        
        if not panels_3x_ui.exists() and not panels_x_ui.exists():
            return Response({
                'code': 404,
                'message': f'未找到国家为 {country} 的可用代理面板',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)


        # 获取所有可用面板列表
        panel_servers = {}
        for panel in panels_3x_ui:
            try:
                # 构建请求头
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel.ip_address.split("/")[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel.ip_address.split("/")[0]}',
                    'Referer': f'http://{panel.ip_address}/panel/'
                }
                
                # 获取xray配置
                url = f"http://{panel.ip_address}/panel/xray/"
                response = make_request_with_cookie(panel, {
                    'ip': panel.ip_address,
                    'username': panel.username,
                    'password': panel.password,
                    'panel_type': panel.panel_type
                }, url, headers, method='post')
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        xray_setting = json.loads(result['obj'])['xraySetting']
                        servers = []
                        # 提取所有可用的servers节点
                        for outbound in xray_setting.get('outbounds', []):
                            try:
                                if outbound.get('protocol') == 'socks':
                                    settings = outbound.get('settings', {})
                                    # 检查settings是否是字符串，如果是则需要解析
                                    if isinstance(settings, str):
                                        settings = json.loads(settings)
                                    
                                    # 获取servers数组
                                    servers_data = settings.get('servers', [])
                                    # 如果servers是字符串，需要解析
                                    if isinstance(servers_data, str):
                                        servers_data = json.loads(servers_data)
                                    
                                    # 确保servers_data是列表
                                    if isinstance(servers_data, list):
                                        for server in servers_data:
                                            # 获取users数组
                                            users = server.get('users', [])
                                            # 如果users是字符串，需要解析
                                            if isinstance(users, str):
                                                users = json.loads(users)
                                            
                                            # 确保至少有一个用户
                                            if users and len(users) > 0:
                                                user = users[0]  # 获取第一个用户
                                                servers.append({
                                                    'address': server.get('address'),
                                                    'port': server.get('port'),
                                                    'user': user.get('user'),
                                                    'pass': user.get('pass'),
                                                    'tag': outbound.get('tag', '')
                                                })
                            except Exception as e:
                                logger.error(f"处理outbound数据时出错: {str(e)}")
                                continue

                        if servers:
                            random.shuffle(servers)
                            panel_servers[panel.id] = servers
            except Exception as e:
                logger.error(f"获取面板 {panel.id} 的servers配置失败: {str(e)}")
                continue

            # 修改节点创建逻辑
        remaining_nodes = node_count
        node_info_list = []
        # 创建节点的参数
        node_data = request.data
        # 获取协议类型
        protocol = node_data.get('protocol', 'vmess')
        for panel in panels_3x_ui:
            print(f"开始创建3x-ui节点: {panel.id}")
            if remaining_nodes <= 0:
                break
            available_servers = panel_servers.get(panel.id, [])
            while True:
                skip_remaining_iterations = False
                for server in available_servers:
                    if remaining_nodes <= 0:
                        skip_remaining_iterations = True
                        break
                
                    try:
                        # 生成随机未使用端口
                        random_port = agent_panel_viewset.generate_random_port(panel)
                        
                        # 始终生成新的UUID
                        client_id = agent_panel_viewset.generate_uuid()
                        
                        # 生成随机subId
                        sub_id = agent_panel_viewset.generate_sub_id()
                        
                        # 3x-ui的节点创建数据结构，与x-ui类似但可能有所不同
                        three_x_ui_create_node_data = {
                            'up': 0,
                            'down': 0,
                            'total': 0,
                            'remark': node_data.get('remark', '自动创建'),
                            'enable': True,
                            'expiryTime': expiry_time,  # 使用计算好的过期时间
                            'listen':'',
                            'port': random_port,
                            'protocol': protocol.lower(),
                            'settings': {},
                            'streamSettings': {
                                "network": "tcp",
                                "security": "none",
                                "externalProxy": [],
                                "tcpSettings": {
                                    "acceptProxyProtocol": False,
                                    "header": {
                                        "type": "none"
                                    }
                                }
                            },
                            'sniffing': {
                                "enabled": False,
                                "destOverride": [
                                    "http",
                                    "tls",
                                    "quic",
                                    "fakedns"
                                ],
                                "metadataOnly": False,
                                "routeOnly": False
                            },
                            'allocate': {
                                "strategy": "always",
                                "refresh": 5,
                                "concurrency": 3
                                }
                        }
                        
                        if protocol == 'vmess' or protocol == 'Vmess':
                            three_x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,
                                    "security": "auto",
                                    "email": sub_id+str(random_port),
                                    "limitIp": 0,
                                    "totalGB": 0,
                                    "expiryTime": 0,
                                    "enable": True,
                                    "tgId": "",
                                    "subId": sub_id,
                                    "comment": "",
                                    "reset": 0
                                    }
                                ],
                            }
                        elif protocol == 'vless' or protocol == 'Vless':
                            three_x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,  # 使用生成的UUID
                                    "flow": "",
                                    "email": sub_id+str(random_port),
                                    "limitIp": 0,
                                    "totalGB": 0,
                                    "expiryTime": 0,
                                    "enable": True,
                                    "tgId": "",
                                    "subId": sub_id,
                                    "comment": "",
                                    "reset": 0
                                    }
                                ],
                                "decryption": "none",
                                "fallbacks": []
                            }
                        elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                            three_x_ui_create_node_data['settings'] = {
                                "method": "2022-blake3-aes-256-gcm",
                                "password": node_password,
                                "network": "tcp,udp",
                                "clients": [
                                    {
                                    "method": "",
                                    "password": node_password,
                                    "email": sub_id+str(random_port),
                                    "limitIp": 0,
                                    "totalGB": 0,
                                    "expiryTime": 0,
                                    "enable": True,
                                    "tgId": "",
                                    "subId": sub_id,
                                    "comment": "",
                                    "reset": 0
                                    }
                                ],
                                "ivCheck": False
                            }
                        elif protocol == 'socks' or protocol == 'Socks':
                            three_x_ui_create_node_data['streamSettings']=""
                            three_x_ui_create_node_data['settings'] = {
                                "auth": "password",
                                "accounts": [
                                    {
                                    "user": node_user,
                                    "pass": node_password
                                    }
                                ],
                                "udp": False,
                                "ip": "127.0.0.1"
                            }
                            three_x_ui_create_node_data['sniffing'] = {}
                        elif protocol == 'http' or protocol == 'Http':
                            three_x_ui_create_node_data['streamSettings']=""
                            three_x_ui_create_node_data['settings'] = {
                                "accounts": [
                                    {
                                    "user": node_user,
                                    "pass": node_password
                                    }
                                ],
                                "allowTransparent": False
                            }
                        
                        # 确保端口不在已使用列表中
                        used_ports = []
                        if panel.used_ports:
                            used_ports = [int(port) for port in panel.used_ports.split(',') if port.strip().isdigit()]
                        
                        # 检查端口是否已被使用
                        while True:
                            if random_port not in used_ports:
                                three_x_ui_create_node_data['port'] = random_port
                                # 更新used_ports列表
                                used_ports.append(random_port)
                                panel.used_ports = ','.join(map(str, used_ports))
                                panel.save()
                                break
                            else:
                                # 生成新的随机端口
                                random_port = random.randint(1, 65534)
                        
                        # 设置为节点数据
                        node_data = three_x_ui_create_node_data
                        # 创建FormData格式的数据
                        form_data = {
                            'up': node_data.get('up', 0),
                            'down': node_data.get('down', 0),
                            'total': node_data.get('total', 0),
                            'remark': node_data.get('remark', '自动创建'),
                            'enable': node_data.get('enable', True),
                            'expiryTime': node_data.get('expiryTime', 0),
                            'listen': node_data.get('listen', ''),
                            'port': node_data.get('port', random_port),
                            'protocol': node_data.get('protocol', 'vmess'),
                            'settings': node_data.get('settings', {}),
                            'streamSettings': node_data.get('streamSettings', {}),
                            'sniffing': node_data.get('sniffing', {}),
                            'allocate': node_data.get('allocate', {})
                        }

                        # 创建节点
                        panel_info = {
                            'tag': server.get('tag', ''),
                            'type': '3x-ui',
                            'id': panel.id,
                            'ip': panel.ip_address,
                            'port': panel.port,
                            'username': panel.username,
                            'password': panel.password,
                            'panel_type': panel.panel_type
                        }
                        port = form_data.get('port')
                        protocol = form_data.get('protocol')
                        host_config = json.dumps(panel_info, ensure_ascii=False, indent=4)
                        remark = f"自助下单-{timezone.now().strftime('%Y%m%d%H%M%S')}"
                        
                        # 获取节点设置信息
                        settings = form_data.get('settings', {})
                        # 获取特定协议的配置信息
                        uuid_str = None
                        node_user = None
                        node_password = None
                        
                        if protocol in ['vmess', 'vless', 'Vmess', 'Vless']:
                            # vmess和vless只使用uuid，没有用户名和密码
                            clients = settings.get('clients', [{}])
                            if clients:
                                uuid_str = clients[0].get('id')
                        elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                            # shadowsocks没有用户名和uuid，只有密码
                            if panel.panel_type == 'x-ui':
                                node_password = settings.get('password')
                            else:  # 3x-ui
                                clients = settings.get('clients', [{}])
                                if clients:
                                    node_password = clients[0].get('password')
                        elif protocol in ['socks', 'http', 'Socks', 'Http']:
                            # socks和http使用用户名和密码，没有uuid
                            accounts = settings.get('accounts', [{}])
                            if accounts:
                                node_user = accounts[0].get('user', '')
                                node_password = accounts[0].get('pass', '')
                        # 创建节点信息字典，但不立即保存
                        
                        node_info_dict = {
                            'user': request.user,
                            'protocol': protocol,
                            'host_config': host_config,
                            'remark': remark,
                            'remark_custom': '',
                            'host': panel.ip or panel.ip_address,
                            'port': port,
                            'uuid': uuid_str,
                            'udp': data.get('udpForward', False),
                            'node_user': node_user,
                            'node_password': node_password,
                            'panel_id': panel.id,
                            'panel_node_id': None,
                            'config_text': json.dumps(form_data, ensure_ascii=False, indent=4),
                            'status': 'pending',
                            'expiry_time': datetime.fromtimestamp(form_data.get('expiryTime', 0)/1000),  # 从毫秒转换为datetime对象
                            'form_data': form_data
                        }


                        udp_config = None  # 初始化 udp_config 变量
                        if data.get('udpForward', False):
                            try:
                                # 获取登录账户的二级代理
                                agent = request.user.parent if request.user.parent else None
                                if agent and agent.user_type == 'agent_l2':
                                    # 获取中转账号信息
                                    transit_account = agent.default_transit_account
                                    if transit_account:
                                        # 获取默认入口和出口
                                        default_in = transit_account.default_inbound
                                        default_out = transit_account.default_outbound
                                        
                                        # 构建中转配置
                                        udp_config =  {
                                            "config": {
                                                "id": transit_account.id,
                                                "username": transit_account.username,
                                                "password": transit_account.password,
                                            },
                                            "udpConfig": {
                                                "device_group_in": json.loads(default_in).get('id'),
                                                "device_group_out": json.loads(default_out).get('id'),
                                                "config": json.dumps({
                                                    "dest": [f"{panel.ip}:{form_data['port']}"]
                                                }),
                                                "name": f"{country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
                                            }
                                        }
                                        
                                        # 更新 NodeInfo 表的 udp_config 字段
                                        print(f"最终生成的udp_config: {udp_config}")
                                    else:
                                        print("transit_account 不存在")
                                else:
                                    print("用户没有关联的二级代理或代理不是二级代理")
                            except Exception as e:
                                logger.error(f"处理UDP中转配置失败: {str(e)}")
                                udp_config = None  # 发生错误时设置为 None
                        node_info_dict['udp_config'] = json.dumps(udp_config)
                        # 添加到节点信息列表
                        node_info_list.append(node_info_dict)

                        # 更新剩余节点数
                        remaining_nodes -= 1
                    except Exception as e:
                        logger.error(f"获取面板 {panel.id} 的节点信息失败: {str(e)}")
                        continue
                if skip_remaining_iterations:
                    break
                if list(panels_3x_ui):
                    break

        
        if remaining_nodes > 0:
            x_ui_list = list(panels_x_ui)
            for i in range(remaining_nodes):
                if remaining_nodes <= 0:
                    break
                panel_index = i % len(x_ui_list)
                panel = x_ui_list[panel_index]
                # 获取面板连接信息
                panel_info = {
                    'type': 'x-ui',
                    'id': panel.id,
                    'ip': panel.ip_address,
                    'port': panel.port,
                    'username': panel.username,
                    'password': panel.password,
                    'panel_type': panel.panel_type
                }
                
                form_data = None
                try:
                    random_port = agent_panel_viewset.generate_random_port(panel)
                    # 始终生成新的UUID
                    client_id = agent_panel_viewset.generate_uuid()
                    
                    # 生成随机subId
                    sub_id = agent_panel_viewset.generate_sub_id()
                    
                    x_ui_create_node_data = {
                        'up': 0,
                        'down': 0,
                        'total': 0,
                        'remark': node_data.get('remark', '自动创建'),
                        'enable': True,
                        'expiryTime': expiry_time,  # 使用计算好的过期时间
                        'listen':'',
                        'port': random_port,  # 使用生成的随机端口
                        'protocol': protocol.lower(),
                        'settings': {},
                        'streamSettings': {
                            "network": "tcp",
                            "security": "none",
                            "tcpSettings": {
                                "header": {
                                "type": "none"
                                }
                            }
                        },
                        'sniffing': {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls",
                                "quic"
                            ]
                        }
                    }
                    if protocol == 'vmess' or protocol == 'Vmess':
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        x_ui_create_node_data['settings'] = {
                            "clients": [
                                {
                                "id": client_id,  # 使用生成的UUID
                                "alterId": 0
                                }
                            ],
                            "disableInsecureEncryption": False
                        }
                    elif protocol == 'vless' or protocol == 'Vless':
                        # 尝试获取cookie
                        if not panel.cookie:
                            cookie = get_login_cookie(panel, panel_info)
                            if not cookie:
                                logger.error(f"无法获取面板 {panel_id} 的cookie")
                                continue
                        url_version = f"http://{panel.ip_address}/server/status"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                        response_version = make_request_with_cookie(
                                    panel, 
                                    panel_info, 
                                    url_version, 
                                    headers, 
                                    method='post', 
                                    data=None
                                )
                        # 添加状态码检查
                        if response_version.status_code != 200:
                            logger.error(f"面板 {panel.id} 版本检查失败，状态码: {response_version.status_code}")
                            panel.is_online = False
                            panel.save()
                            continue
                        # 获取系统版本
                        version = response_version.json().get('obj').get('xray').get('version')
                        
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        if version == '25.3.6':
                            x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,  # 使用生成的UUID
                                    "flow": ""
                                    }
                                ],
                                "decryption": "none",
                                "fallbacks": []
                            }
                        else:
                            x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,  # 使用生成的UUID
                                    "flow": "xtls-rprx-direct"
                                    }
                                ],
                                "decryption": "none",
                                "fallbacks": []
                            }
                    elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        x_ui_create_node_data['settings'] = {
                            "method": "2022-blake3-aes-256-gcm",
                            "password": node_password,
                            "network": "tcp,udp"
                        }
                    elif protocol == 'socks' or protocol == 'Socks':
                        x_ui_create_node_data['sniffing'] = {}
                        x_ui_create_node_data['settings'] = {
                            "auth": "password",
                            "accounts": [
                                {
                                "user": node_user,
                                "pass": node_password
                                }
                            ],
                            "udp": False,
                            "ip": "127.0.0.1"
                        }
                    elif protocol == 'http' or protocol == 'Http':
                        x_ui_create_node_data['sniffing'] = {}
                        x_ui_create_node_data['settings'] = {
                            "accounts": [
                                {
                                "user": node_user,
                                "pass": node_password
                                }
                            ]    
                        }    
                    # 确保端口不在已使用列表中
                    used_ports = []
                    if panel.used_ports:
                        used_ports = [int(port) for port in panel.used_ports.split(',') if port.strip().isdigit()]
                    
                    # 检查端口是否已被使用
                    while True:
                        if random_port not in used_ports:
                            x_ui_create_node_data['port'] = random_port
                            # 更新used_ports列表
                            used_ports.append(random_port)
                            panel.used_ports = ','.join(map(str, used_ports))
                            panel.save()
                            break
                        else:
                            # 生成新的随机端口
                            random_port = random.randint(1, 65534)
                    
                    # 设置为节点数据
                    node_data = x_ui_create_node_data
                    
                    # 创建FormData格式的数据
                    form_data = {
                        'up': node_data.get('up', 0),
                        'down': node_data.get('down', 0),
                        'total': node_data.get('total', 0),
                        'remark': node_data.get('remark', '自动创建'),
                        'enable': node_data.get('enable', True),
                        'expiryTime': node_data.get('expiryTime', 0),
                        'listen': node_data.get('listen', ''),
                        'port': node_data.get('port', random_port),
                        'protocol': node_data.get('protocol', 'vmess'),
                        'settings': node_data.get('settings', {}),
                        'streamSettings': node_data.get('streamSettings', {}),
                        'sniffing': node_data.get('sniffing', {})
                    }
                    # 获取节点基本信息
                    port = form_data.get('port')
                    protocol = form_data.get('protocol')
                    host_config = json.dumps(panel_info, ensure_ascii=False, indent=4)
                    remark = f"自助下单-{timezone.now().strftime('%Y%m%d%H%M%S')}"
                    
                    # 获取节点设置信息
                    settings = form_data.get('settings', {})
                    
                    # 获取特定协议的配置信息
                    uuid_str = None
                    node_user = None
                    node_password = None
                    
                    if protocol in ['vmess', 'vless', 'Vmess', 'Vless']:
                        # vmess和vless只使用uuid，没有用户名和密码
                        clients = settings.get('clients', [{}])
                        if clients:
                            uuid_str = clients[0].get('id')
                    elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                        # shadowsocks没有用户名和uuid，只有密码
                        if panel.panel_type == 'x-ui':
                            node_password = settings.get('password')
                        else:  # 3x-ui
                            clients = settings.get('clients', [{}])
                            if clients:
                                node_password = clients[0].get('password')
                    elif protocol in ['socks', 'http', 'Socks', 'Http']:
                        # socks和http使用用户名和密码，没有uuid
                        accounts = settings.get('accounts', [{}])
                        if accounts:
                            node_user = accounts[0].get('user', '')
                            node_password = accounts[0].get('pass', '')
                    # 创建节点信息字典，但不立即保存
                    
                    node_info_dict = {
                        'user': request.user,
                        'protocol': protocol,
                        'host_config': host_config,
                        'remark': remark,
                        'remark_custom': '',
                        'host': panel.ip or panel.ip_address,
                        'port': port,
                        'uuid': uuid_str,
                        'udp': data.get('udpForward', False),
                        'node_user': node_user,
                        'node_password': node_password,
                        'panel_id': panel.id,
                        'panel_node_id': None,
                        'config_text': json.dumps(form_data, ensure_ascii=False, indent=4),
                        'status': 'pending',
                        'expiry_time': datetime.fromtimestamp(form_data.get('expiryTime', 0)/1000),  # 从毫秒转换为datetime对象
                        'form_data': form_data
                    }
                    udp_config = None  # 初始化 udp_config 变量
                    if data.get('udpForward', False):
                        try:
                            # 获取登录账户的二级代理
                            agent = request.user.parent if request.user.parent else None
                            if agent and agent.user_type == 'agent_l2':
                                # 获取中转账号信息
                                transit_account = agent.default_transit_account
                                if transit_account:
                                    # 获取默认入口和出口
                                    default_in = transit_account.default_inbound
                                    default_out = transit_account.default_outbound
                                    
                                    # 构建中转配置
                                    udp_config =  {
                                        "config": {
                                            "id": transit_account.id,
                                            "username": transit_account.username,
                                            "password": transit_account.password,
                                        },
                                        "udpConfig": {
                                            "device_group_in": json.loads(default_in).get('id'),
                                            "device_group_out": json.loads(default_out).get('id'),
                                            "config": json.dumps({
                                                "dest": [f"{panel.ip}:{form_data['port']}"]
                                            }),
                                            "name": f"{country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
                                        }
                                    }
                                    
                                    # 更新 NodeInfo 表的 udp_config 字段
                                else:
                                    print("transit_account 不存在")
                            else:
                                print("用户没有关联的二级代理或代理不是二级代理")
                        except Exception as e:
                            logger.error(f"处理UDP中转配置失败: {str(e)}")
                            udp_config = None  # 发生错误时设置为 None
                    node_info_dict['udp_config'] = json.dumps(udp_config)
                    # 添加到节点信息列表
                    node_info_list.append(node_info_dict)
                    # ... 原有的x-ui节点创建逻辑 ...
                    
                    remaining_nodes -= 1
                    
                except Exception as e:
                    logger.error(f"使用x-ui面板创建节点失败: {str(e)}")
                    continue
        
        # 发送请求到第三方支付接口
        try:
            response = requests.post('https://pototapay.com/mapi.php', data=sign_data, timeout=30)
            logger.info(f"支付请求响应码: {response.status_code}")
            
            # 记录响应内容（仅用于调试）
            
            try:
                response_data = response.json()
            except json.JSONDecodeError as e:
                logger.error(f"解析支付接口响应失败: {str(e)}, 响应内容: {response.text}")
                return Response({
                    'code': 0,
                    'msg': f'解析支付接口响应失败，请联系管理员',
                    'debug_info': {
                        'error': str(e),
                        'response_content': response.text
                    }
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # 将订单号添加到响应数据中
            response_data['order_no'] = order_no
            
            # 只有当支付接口返回code=1时才保存订单和节点信息
            if response_data.get('code') == 1:
                logger.info(f"支付请求成功，开始创建订单和节点信息")
                
                # 创建支付订单
                payment_order = PaymentOrder(
                    user=request.user,
                    out_trade_no=order_no,
                    payment_type=data['paymentMethod'],
                    product_name=f"{node_type}-{period}-{node_count}节点",
                    amount=Decimal(str(data['money'])),
                    status='pending',
                    param=json.dumps({
                        'region': country,
                        'nodeType': node_type,
                        'protocol': data.get('protocol', 'vmess'),
                        'period': period
                    }),
                    country=country,
                    node_count=node_count,
                    node_protocol=data.get('protocol', 'vmess')
                )
                payment_order.save()
                logger.info(f"订单已创建: {payment_order.out_trade_no}")
                
                # 如果响应数据中包含易支付订单号(trade_no)，更新到支付订单表中
                if 'trade_no' in response_data:
                    payment_order.trade_no = response_data['trade_no']
                    payment_order.save(update_fields=['trade_no'])
                
                # 保存所有节点信息
                for node_info_dict in node_info_list:
                    try:
                        # 从字典中移除表单数据
                        form_data = node_info_dict.pop('form_data', None)
                        
                        
                        # 创建NodeInfo实例并设置订单
                        print(node_info_dict)
                        # 创建NodeInfo实例
                        node_info = NodeInfo(
                            order=payment_order,
                            **node_info_dict
                        )
                        
                        # 保存节点信息
                        node_info.save()
                        logger.info(f"节点信息已保存: {node_info.id}")
                        
                            
                    except Exception as e:
                        logger.error(f"保存节点信息失败: {str(e)}")
            else:
                logger.warning(f"支付接口返回非成功响应: {response_data}")
            
            # 返回第三方接口的响应
            return Response(response_data)
        
        except requests.exceptions.RequestException as e:
            logger.error(f"请求第三方支付接口失败: {str(e)}")
            return Response({
                'code': 0,
                'msg': f'请求支付接口失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"支付处理异常: {str(e)}")
        return Response({
            'code': 0,
            'msg': f'支付处理异常: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def validate_coupon(request):
    """
    验证优惠码 (CDK)
    """
    coupon_code = request.data.get('coupon_code')
    if not coupon_code:
        return Response({
            'valid': False,
            'message': '请输入优惠码'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 获取请求来源域名
    # 获取请求域名
    requesting_domain = request.META.get('HTTP_HOST', '')
    origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
    referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
    
    # 尝试从HTTP_REFERER中提取域名
    referer_domain = ''
    if referer and '://' in referer:
        referer_parts = referer.split('://', 1)[1]
        if '/' in referer_parts:
            referer_domain = referer_parts.split('/', 1)[0]
        else:
            referer_domain = referer_parts
    
    # 尝试从HTTP_ORIGIN中提取域名
    origin_domain = ''
    if origin and '://' in origin:
        origin_domain = origin.split('://', 1)[1]
    
    
    # 使用多种方法尝试获取源地址
    requesting_domain = referer_domain or origin_domain or requesting_domain
    if not requesting_domain:
        logger.warning("无法获取请求来源域名")

    try:
        # 1. 先根据 code 查找优惠码
        coupon = CDK.objects.get(code=coupon_code)

        # 2. 检查优惠码的有效性条件
        now = timezone.now()
        print(coupon.valid_until)
        if not coupon.is_active:
            return Response({'valid': False, 'message': '优惠码已失效'})
        if coupon.valid_from > now:
            return Response({'valid': False, 'message': '优惠码尚未生效'})
        if coupon.valid_until < now:
            return Response({'valid': False, 'message': '优惠码已过期'})
        if coupon.used_count >= coupon.max_uses:
             return Response({'valid': False, 'message': '优惠码已达使用上限'})

        # 3. 验证创建者和域名
        creator = coupon.created_by

        if creator.user_type == 'agent_l1': # 确认一级代理逻辑
            return Response({
                'valid': True,
                'discount': coupon.discount
            })
        elif creator.user_type == 'agent_l2':
            if creator.domain and requesting_domain and requesting_domain.endswith(creator.domain):
                return Response({
                    'valid': True,
                    'discount': coupon.discount
                })
            else:
                return Response({
                    'valid': False,
                    'message': '优惠码不适用于此网站'
                })
        else:
            logger.warning(f"优惠码 {coupon_code} 由未知类型用户 {creator.username} 创建")
            return Response({
                'valid': False,
                'message': '优惠码类型无效'
            })

    except CDK.DoesNotExist:
        # 只有当 code 不存在时才返回这个消息
        return Response({
            'valid': False,
            'message': '优惠码不存在' 
        })
    except Exception as e:
        logger.error(f"验证优惠码时出错: {str(e)}")
        return Response({
            'valid': False,
            'message': '验证优惠码时发生错误'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_prices(request):
    """
    获取价格接口
    1. 如果请求携带token，优先使用当前用户的自定义价格
    2. 如果用户没有自定义价格，根据请求域名获取对应二级代理设置的价格
    3. 如果二级代理设置了自定义价格(custom_*)，则优先使用自定义价格
    4. 如果没有设置自定义价格，则使用普通价格字段
    """
    try:
        # 获取请求域名
        requesting_domain = request.META.get('HTTP_HOST', '')
        origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
        host = request.META.get('HTTP_HOST', '')
        referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
        
        # 尝试从HTTP_REFERER中提取域名
        referer_domain = ''
        if referer and '://' in referer:
            referer_parts = referer.split('://', 1)[1]
            if '/' in referer_parts:
                referer_domain = referer_parts.split('/', 1)[0]
            else:
                referer_domain = referer_parts
        
        # 尝试从HTTP_ORIGIN中提取域名
        origin_domain = ''
        if origin and '://' in origin:
            origin_domain = origin.split('://', 1)[1]
        
        # 使用多种方法尝试获取源地址
        source_domain = referer_domain or origin_domain or requesting_domain
        
        if not source_domain:
            return Response({
                'code': 400,
                'message': '无法获取请求域名',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 查找匹配的二级代理
        matched_agent = None
        agents = User.objects.filter(user_type='agent_l2')
        
        for agent in agents:
            if agent.domain and source_domain.endswith(agent.domain):
                matched_agent = agent
                break
        
        if not matched_agent:
            return Response({
                'code': 404,
                'message': '未找到匹配的代理',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 获取当前登录用户（如果有）
        current_user = request.user if request.user.is_authenticated else None
        
        # 构建价格数据
        prices = {
            "normal": {
                "monthly": get_price_or_parent(matched_agent, 'normal_monthly_price', current_user),
                "quarterly": get_price_or_parent(matched_agent, 'normal_quarterly_price', current_user),
                "half_yearly": get_price_or_parent(matched_agent, 'normal_half_yearly_price', current_user),
                "yearly": get_price_or_parent(matched_agent, 'normal_yearly_price', current_user)
            },
            "live": {
                "monthly": get_price_or_parent(matched_agent, 'live_monthly_price', current_user),
                "quarterly": get_price_or_parent(matched_agent, 'live_quarterly_price', current_user),
                "half_yearly": get_price_or_parent(matched_agent, 'live_half_yearly_price', current_user),
                "yearly": get_price_or_parent(matched_agent, 'live_yearly_price', current_user)
            },
            "transit": {
                "monthly": get_price_or_parent(matched_agent, 'transit_monthly_price', current_user),
                "quarterly": get_price_or_parent(matched_agent, 'transit_quarterly_price', current_user),
                "half_yearly": get_price_or_parent(matched_agent, 'transit_half_yearly_price', current_user),
                "yearly": get_price_or_parent(matched_agent, 'transit_yearly_price', current_user)
            }
        }
        
        return Response({
            'code': 200,
            'message': '获取价格成功',
            'data': prices
        })
        
    except Exception as e:
        logger.error(f"获取价格失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'获取价格失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def get_price_or_parent(agent, field_name, user=None):
    """
    获取价格的优先级：
    1. 如果提供了用户且用户有自定义价格，使用用户的自定义价格
    2. 如果代理设置了自定义价格，使用代理的自定义价格
    3. 使用代理的标准价格
    
    :param agent: 代理对象
    :param field_name: 价格字段名
    :param user: 用户对象（可选）
    :return: 价格值
    """
    # 如果提供了用户，先检查用户的自定义价格
    if user:
        custom_user_field = 'custom_' + field_name
        user_price = getattr(user, custom_user_field, None)
        if user_price is not None and user_price > 0:
            return user_price
    
    # 检查代理的自定义价格
    custom_field_name = 'custom_' + field_name
    custom_price = getattr(agent, custom_field_name, None)
    if custom_price is not None and custom_price > 0:
        return custom_price
    
    # 获取代理的标准价格
    standard_price = getattr(agent, field_name, 0)
    return standard_price if standard_price is not None else 0

def get_login_cookie(panel, panel_info):
    """获取或刷新登录cookie"""
    try:
        login_data = {
            'username': panel_info['username'],
            'password': panel_info['password']
        }
        
        # 构建登录请求头
        if panel_info['panel_type'] == 'x-ui':
            headers_login = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'host': f'{panel_info['ip']}',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Origin': f'http://{panel_info['ip']}',
                'Referer': f'http://{panel_info['ip']}/'
            }
        else:  # 3x-ui面板
            headers_login = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'host': f'{panel_info['ip'].split('/')[0]}',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                'Referer': f'http://{panel_info['ip']}/'
            }

        # 发送登录请求
        response_login = requests.post(
            f'http://{panel_info['ip']}/login', 
            data=login_data,
            headers=headers_login,
            timeout=10,
            verify=False
        )
        
        # 获取新的cookie
        login_cookie = response_login.headers.get('Set-Cookie')
        if login_cookie:
            # 更新数据库中的cookie
            panel.cookie = login_cookie
            panel.save(update_fields=['cookie'])
            return login_cookie
        
        return None
        
    except Exception as e:
        print(f"登录获取cookie失败: {str(e)}")
        return None

def make_request_with_cookie(panel, panel_info, url, headers, method='post', data=None):
    """使用cookie发送请求，如果失败则尝试刷新cookie重试"""
    response = None
    try:
        # 如果存在cookie，添加到请求头中
        if panel.cookie:
            headers['cookie'] = panel.cookie
        
        if method.lower() == 'post':
            response = requests.post(url, headers=headers, data=data, timeout=10, verify=False)
        elif method.lower() == 'post_params':
            response = requests.post(url, headers=headers, params=data, timeout=10, verify=False)
        else:
            response = requests.get(url, headers=headers, timeout=10, verify=False)
        
        # 检查响应是否成功或是否需要重新登录
        cookie_expired = False
        
        # 检查HTTP状态码
        if response.status_code == 404 or response.status_code == 401:
            cookie_expired = True
        
        # 检查响应内容是否包含需要重新登录的信息
        try:
            result = response.json()
            if 'success' in result and not result['success']:
                if 'msg' in result and ('请重新登录' in result['msg'] or '登录已过期' in result['msg']):
                    cookie_expired = True
        except Exception:
            # 尝试检查响应文本
            if '请重新登录' in response.text or '登录已过期' in response.text:
                cookie_expired = True
        
        # 如果cookie已过期，尝试刷新
        if cookie_expired:
            print(f"Cookie已过期或无效，尝试重新登录获取新cookie")
            new_cookie = get_login_cookie(panel, panel_info)
            if new_cookie:
                headers['cookie'] = new_cookie
                if method.lower() == 'post':
                    response = requests.post(url, headers=headers, data=data, timeout=10, verify=False)
                elif method.lower() == 'post_params':
                    response = requests.post(url, headers=headers, params=data, timeout=10, verify=False)
                else:
                    response = requests.get(url, headers=headers, timeout=10, verify=False)
            else:
                # 获取新cookie失败，将面板标记为离线
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                raise Exception("尝试重新登录失败，无法获取有效cookie")
        
        return response
        
    except (requests.exceptions.ConnectionError, 
            requests.exceptions.Timeout, 
            requests.exceptions.ReadTimeout, 
            requests.exceptions.RequestException) as req_error:
        print(f"请求失败: {str(req_error)}")
        # 尝试刷新cookie
        try:
            new_cookie = get_login_cookie(panel, panel_info)
            if new_cookie:
                headers['cookie'] = new_cookie
                if method.lower() == 'post':
                    return requests.post(url, headers=headers, data=data, timeout=10, verify=False)
                elif method.lower() == 'post_params':
                    return requests.post(url, headers=headers, params=data, timeout=10, verify=False)
                else:
                    return requests.get(url, headers=headers, timeout=10, verify=False)
            else:
                # 获取新cookie失败，将面板标记为离线
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                raise Exception(f"获取Cookie失败，节点可能离线: {str(req_error)}")
        except Exception as login_error:
            # 重新登录也失败，记录错误并将面板标记为离线
            print(f"重新登录失败: {str(login_error)}")
            panel.is_online = False
            panel.save(update_fields=['is_online'])
            raise Exception(f"重新登录失败，节点离线: {str(login_error)}")
    
    except Exception as e:
        # 其他所有异常情况，确保面板被标记为离线
        print(f"请求处理过程中出错: {str(e)}")
        panel.is_online = False
        panel.save(update_fields=['is_online'])
        
        # 如果已经有响应但处理失败，返回该响应
        if response:
            return response
            
        raise Exception(f"请求节点失败，节点已标记为离线: {str(e)}")

@api_view(['GET'])
@permission_classes([AllowAny])
def payment_status(request):
    """
    获取订单支付状态
    """
    try:
        # 从查询参数获取订单号
        order_no = request.GET.get('order_no')
        if not order_no:
            return Response({
                'code': 400,
                'message': '订单号不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 查找订单
        try:
            order = PaymentOrder.objects.get(out_trade_no=order_no)
        except PaymentOrder.DoesNotExist:
            return Response({
                'code': 404,
                'message': '订单不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 构建响应数据
        order_data = {
            'order_no': order.out_trade_no,
            'trade_no': order.trade_no,
            'status': order.status,
            'product_name': order.product_name,
            'amount': float(order.amount),
            'payment_type': order.payment_type,
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'is_processed': order.is_processed
        }
        
        return Response({
            'code': 200,
            'message': '获取订单状态成功',
            'data': order_data
        })
    
    except Exception as e:
        logger.error(f"获取订单状态出错: {str(e)}")
        return Response({
            'code': 500,
            'message': f'获取订单状态出错: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PaymentOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """订单视图集"""
    serializer_class = PaymentOrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPagination

    def get_queryset(self):
        """根据用户类型返回不同的订单查询集"""
        user = self.request.user
        queryset = PaymentOrder.objects.all()

        # 根据用户类型过滤订单
        if user.user_type == 'customer':
            # 客户只能查看自己的订单
            queryset = queryset.filter(user=user)
        elif user.user_type == 'agent_l2':
            # 二级代理只能查看自己客户的订单
            queryset = queryset.filter(user__parent=user)
        # 一级代理和管理员可以查看所有订单

        # 添加搜索和筛选功能
        # 1. 通过代理商名字搜索（仅限一级代理）
        agent_username = self.request.query_params.get('agent_username', None)
        if agent_username and user.user_type == 'agent_l1':
            queryset = queryset.filter(user__parent__username__icontains=agent_username)

        # 2. 通过客户名搜索
        customer_username = self.request.query_params.get('customer_username', None)
        if customer_username:
            queryset = queryset.filter(user__username__icontains=customer_username)

        # 3. 通过支付方式筛选
        payment_type = self.request.query_params.get('payment_type', None)
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)

        # 4. 通过订单号筛选
        trade_no = self.request.query_params.get('trade_no', None)
        if trade_no:
            queryset = queryset.filter(trade_no__icontains=trade_no)

        # 5. 通过时间范围筛选
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # 6. 通过订单状态筛选
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)

        # 7. 通过国家筛选
        country = self.request.query_params.get('country', None)
        if country:
            # 通过节点关联的面板国家筛选订单
            from panels.models import AgentPanel
            # 先找到匹配国家的面板ID列表
            matching_panels = AgentPanel.objects.filter(country__icontains=country).values_list('id', flat=True)
            if matching_panels:
                # 找到使用这些面板的节点的订单ID
                from users.models import NodeInfo
                matching_order_ids = NodeInfo.objects.filter(
                    panel_id__in=matching_panels
                ).values_list('order_id', flat=True).distinct()
                # 只返回包含匹配国家节点的订单
                queryset = queryset.filter(id__in=matching_order_ids)
            else:
                # 如果没有找到匹配的面板，返回空查询集
                queryset = queryset.none()

        # 按创建时间倒序排序
        return queryset.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """获取订单列表"""
        try:
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                paginated_data = self.get_paginated_response(serializer.data).data
                return Response({
                    'code': 200,
                    'message': '获取订单列表成功',
                    'data': paginated_data
                })
            
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'code': 200,
                'message': '获取订单列表成功',
                'data': {
                    'results': serializer.data,
                    'count': len(serializer.data),
                    'next': None,
                    'previous': None
                }
            })
        except Exception as e:
            logger.error(f"获取订单列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取订单列表失败: {str(e)}',
                'data': None
            }, status=500)

    def retrieve(self, request, *args, **kwargs):
        """获取订单详情"""
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response({
                'code': 200,
                'message': '获取订单详情成功',
                'data': serializer.data
            })
        except Exception as e:
            logger.error(f"获取订单详情失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取订单详情失败: {str(e)}',
                'data': None
            }, status=500)

    @action(detail=True, methods=['get'])
    def node_info(self, request, pk=None):
        """获取订单关联的节点详情"""
        try:
            # 直接通过订单ID查询NodeInfo表
            nodes = NodeInfo.objects.filter(order_id=pk)
            if not nodes.exists():
                return Response({
                    'code': 404,
                    'message': '该订单未关联节点信息',
                    'data': None
                }, status=404)

            # 获取节点关联的所有面板ID
            panel_ids = [node.panel_id for node in nodes if node.panel_id]
            
            # 查询这些面板信息
            from panels.models import AgentPanel
            panels = AgentPanel.objects.filter(id__in=panel_ids)
            
            # 创建面板ID到国家的映射
            panel_country_map = {panel.id: panel.country for panel in panels}

            # 返回所有关联的节点信息
            node_data = []
            
            for node in nodes:
                # 获取面板国家
                country = panel_country_map.get(node.panel_id, '未知') if node.panel_id else '未知'
                
                node_dict = {
                    'id': node.id,
                    'order_id': node.order_id,
                    'user_id': node.user_id,
                    'remark': node.remark,
                    'remark_custom': node.remark_custom,
                    'protocol': node.protocol,
                    'host_config': node.host_config,
                    'host': node.host,
                    'port': node.port,
                    'uuid': node.uuid,
                    'node_user': node.node_user,
                    'node_password': node.node_password,
                    'panel_id': node.panel_id,
                    'panel_node_id': node.panel_node_id,
                    'status': node.status,
                    'expiry_time': node.expiry_time.isoformat() if node.expiry_time else None,
                    'config_text': node.config_text,
                    'udp': node.udp,
                    'udp_host': node.udp_host,
                    'udp_host_domain': get_udp_host_domain(node),
                    'udp_config': node.udp_config,
                    'country': country  # 添加国家字段
                }
                node_data.append(node_dict)

            return Response({
                'code': 200,
                'message': '获取节点详情成功',
                'data': node_data
            })
        except Exception as e:
            logger.error(f"获取节点详情失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取节点详情失败: {str(e)}',
                'data': None
            }, status=500)

class ContactInfoViewSet(viewsets.ModelViewSet):
    """联系方式视图集"""
    serializer_class = ContactInfoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """根据用户类型返回不同的查询集"""
        user = self.request.user
        if user.user_type == 'customer':
            # 客户只能查看自己的联系方式
            return ContactInfo.objects.filter(user=user)
        elif user.user_type == 'agent_l2':
            # 二级代理可以查看自己客户的联系方式
            return ContactInfo.objects.filter(user__parent=user)
        # 一级代理和管理员可以查看所有联系方式
        return ContactInfo.objects.all()

    def get_object(self):
        """获取当前用户的联系方式"""
        try:
            return ContactInfo.objects.get(user=self.request.user)
        except ContactInfo.DoesNotExist:
            # 如果不存在，创建一个新的联系方式记录
            return ContactInfo.objects.create(user=self.request.user)

    def perform_create(self, serializer):
        """创建联系方式时自动关联当前用户"""
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """更新联系方式时自动关联当前用户"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def my_contact(self, request):
        """获取当前用户的联系方式"""
        try:
            contact_info = ContactInfo.objects.get(user=request.user)
            serializer = self.get_serializer(contact_info)
            return Response({
                'code': 200,
                'message': '获取联系方式成功',
                'data': serializer.data
            })
        except ContactInfo.DoesNotExist:
            # 如果不存在，创建一个新的联系方式记录
            contact_info = ContactInfo.objects.create(user=request.user)
            serializer = self.get_serializer(contact_info)
            return Response({
                'code': 200,
                'message': '创建联系方式成功',
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'code': 500,
                'message': f'获取联系方式失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def balance_payment(request):
    # update_panel = 'http://127.0.0.1:8008/api/agent-panel/update_all_nodes_count/'
    # headers = {
    #     'Content-Type': 'application/json'
    # }
    # response = requests.post(update_panel, headers=headers)
    # print(f'刷新面板的在线情况: {response.json()}')
    try:
        # 从token中获取当前用户
        user = request.user
        
        # 获取请求数据
        data = request.data
        node_user = request.data.get('username')
        node_password = request.data.get('password')
        country = request.data.get('region')
        node_count = request.data.get('quantity', 1)  # 默认创建1个节点
        
        # 验证请求数据
        required_fields = ['region','nodeType', 'protocol','period', 'quantity', 'paymentMethod']
        for field in required_fields:
            if field not in data:
                return Response({
                    'code': 0,
                    'msg': f'缺少必要参数: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)
        requesting_domain = request.META.get('HTTP_HOST', '')
        origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
        referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
        # 尝试从HTTP_REFERER中提取域名
        referer_domain = ''
        if referer and '://' in referer:
            referer_parts = referer.split('://', 1)[1]
            if '/' in referer_parts:
                referer_domain = referer_parts.split('/', 1)[0]
            else:
                referer_domain = referer_parts
        
        # 尝试从HTTP_ORIGIN中提取域名
        origin_domain = ''
        if origin and '://' in origin:
            origin_domain = origin.split('://', 1)[1]
        
        
        # 使用多种方法尝试获取源地址
        source_domain = referer_domain or origin_domain or requesting_domain
            
        # 计算价格和过期时间
        money = 0
        expiry_time = 0
        now = timezone.now()  # 获取当前时间
# 通过请求域名查找匹配的二级代理
        matched_agent = None
        agents = User.objects.filter(user_type='agent_l2')
        
        for agent in agents:
            if agent.domain and source_domain.endswith(agent.domain):
                matched_agent = agent
                break
        
        if not matched_agent:
            return Response({
                'code': 404,
                'message': '未找到匹配的代理',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)

        node_type = data.get('nodeType', '').lower()  # 'normal' 或 'live' 或 'transit'
        period = data.get('period', '').lower()  # 'monthly', 'quarterly', 'half_yearly', 'yearly'
        
        # 根据节点类型和付费周期获取对应的价格
        if node_type == 'normal':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'normal_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'normal_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'normal_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'normal_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'live':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'live_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'live_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'live_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'live_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'transit':
            # 获取中转节点价格
            if period == 'monthly':
                field_name = 'transit_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'transit_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'transit_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'transit_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'code': 400,
                'message': f'无效的节点类型: {node_type}',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取价格（优先使用自定义价格）
        money = get_price_or_parent(matched_agent, field_name, user)
        
        # 处理优惠券代码
        coupon_code = data.get('coupon')
        discount = 0
        if coupon_code:
            print('处理优惠券:', coupon_code)
            try:
                # 检查优惠券是否存在
                coupon = CDK.objects.get(code=coupon_code)
                
                # 检查优惠券的有效性条件
                now = timezone.now()
                if (coupon.is_active and 
                    coupon.valid_from <= now and 
                    coupon.valid_until >= now and 
                    coupon.used_count < coupon.max_uses):
                    
                    # 验证创建者和域名权限
                    creator = coupon.created_by
                    is_valid = False
                    
                    if creator.user_type == 'agent_l1':
                        # 一级代理创建的优惠券对所有站点有效
                        is_valid = True
                    elif creator.user_type == 'agent_l2':
                        # 二级代理创建的优惠券只对自己的域名有效
                        if creator.domain and source_domain.endswith(creator.domain):
                            is_valid = True
                    
                    if is_valid:
                        # 应用折扣
                        discount = coupon.discount
                        print(f'应用优惠券折扣: {discount}%')
                        # 更新已使用次数
                        coupon.used_count += 1
                        coupon.save()
                    else:
                        print('优惠券不适用于此网站')
                else:
                    print('优惠券无效(过期/未生效/已达使用上限)')
            except CDK.DoesNotExist:
                print('优惠券不存在')
            except Exception as e:
                print(f'验证优惠券时出错: {str(e)}')
        
        # 应用折扣
        if discount > 0:
            # 将 discount/100 转换为 Decimal 类型以避免类型不匹配
            discount_factor = Decimal(str(1 - discount / 100))
            money = money * discount_factor
            print(f'折扣后金额: {money}')
        
        # 计算过期时间（当前时间 + 天数）
        expiry_time = int((now + timedelta(days=days)).timestamp() * 1000)  # 转换为毫秒级时间戳
        
        # 设置订单金额
        data['money'] = float(money) * int(node_count)  # 价格乘以节点数量
        user_balance = user.balance
        if user_balance < data['money']:
            return Response({
                'code': 400,
                'message': '余额不足',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        # 扣除用户余额
        user.balance -= Decimal(str(data['money']))
        user.save(update_fields=['balance'])
        if user.user_type == 'customer' and user.parent:
            try:
                agent = user.parent
                agent.balance -= Decimal(str(data['money']))
                agent.save(update_fields=['balance'])
                logger.info(f"从代理 {agent.username} 的余额中扣除 {data['money']} 元，当前余额: {agent.balance}")
            except Exception as e:
                logger.error(f"扣除代理余额时出错: {str(e)}")
        order_no = f"{timezone.now().strftime('%Y%m%d')}{int(timezone.now().timestamp())}{random.randint(100000, 999999)}"
        data['order_no'] = order_no
        remark = f"自助下单-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        # 分别查询3x-ui和x-ui面板
        if node_type == 'live' and country == "美国":
            
            print('==进入live美国节点创建==')
        else:
            print('==进入非live美国节点创建==',node_type,country)
            panels_3x_ui = AgentPanel.objects.filter(
                is_online=True,
                country__iexact=country,
                panel_type='3x-ui'
            ).order_by('nodes_count')
        panels_x_ui = AgentPanel.objects.filter(
            is_online=True,
            country__iexact=country,
            panel_type='x-ui'
        ).order_by('nodes_count')
        if node_type == 'live' and country == "美国":
                # 获取所有可用面板列表
            if not panels_x_ui.exists():
                return Response({
                    'code': 404,
                    'message': f'未找到国家为 {country} 的可用代理面板',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            if not panels_3x_ui.exists() and not panels_x_ui.exists():
                return Response({
                    'code': 404,
                    'message': f'未找到国家为 {country} 的可用代理面板',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)

        panel_servers = {}
        if node_type == 'live' and country == "美国":
            
            print('==进入live美国节点创建==')
        else:
            for panel in panels_3x_ui:
                try:
                    # 构建请求头
                    headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'host': f'{panel.ip_address.split("/")[0]}',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                        'Origin': f'http://{panel.ip_address.split("/")[0]}',
                        'Referer': f'http://{panel.ip_address}/panel/'
                    }
                    
                    # 获取xray配置
                    url = f"http://{panel.ip_address}/panel/xray/"
                    try:
                        response = make_request_with_cookie(panel, {
                            'ip': panel.ip_address,
                            'username': panel.username,
                            'password': panel.password,
                            'panel_type': panel.panel_type
                        }, url, headers, method='post')
                    except Exception as e:
                        logger.error(f"获取面板 {panel.id} 的servers配置失败: {str(e)}")
                        continue
                    response = make_request_with_cookie(panel, {
                        'ip': panel.ip_address,
                        'username': panel.username,
                        'password': panel.password,
                        'panel_type': panel.panel_type
                    }, url, headers, method='post')
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result.get('success'):
                            xray_setting = json.loads(result['obj'])['xraySetting']
                            servers = []
                            # 提取所有可用的servers节点
                            for outbound in xray_setting.get('outbounds', []):
                                try:
                                    if outbound.get('protocol') == 'socks':
                                        settings = outbound.get('settings', {})
                                        # 检查settings是否是字符串，如果是则需要解析
                                        if isinstance(settings, str):
                                            settings = json.loads(settings)
                                        
                                        # 获取servers数组
                                        servers_data = settings.get('servers', [])
                                        # 如果servers是字符串，需要解析
                                        if isinstance(servers_data, str):
                                            servers_data = json.loads(servers_data)
                                        
                                        # 确保servers_data是列表
                                        if isinstance(servers_data, list):
                                            for server in servers_data:
                                                # 获取users数组
                                                users = server.get('users', [])
                                                # 如果users是字符串，需要解析
                                                if isinstance(users, str):
                                                    users = json.loads(users)
                                                
                                                # 确保至少有一个用户
                                                if users and len(users) > 0:
                                                    user = users[0]  # 获取第一个用户
                                                    servers.append({
                                                        'address': server.get('address'),
                                                        'port': server.get('port'),
                                                        'user': user.get('user'),
                                                        'pass': user.get('pass'),
                                                        'tag': outbound.get('tag', '')
                                                    })
                                except Exception as e:
                                    logger.error(f"处理outbound数据时出错: {str(e)}")
                                    continue

                            if servers:
                                random.shuffle(servers)
                                panel_servers[panel.id] = servers
                    else:
                        logger.error(f"面板 {panel.id} HTTP状态码异常: {response.status_code}")
                        panel.is_online = False
                        panel.save()
                        continue
                except Exception as e:
                    logger.error(f"获取面板 {panel.id} 的servers配置失败: {str(e)}")
                    continue

                # 修改节点创建逻辑
            
        remaining_nodes = node_count
        node_info_list = []
        # 创建节点的参数
        node_data = request.data
        # 获取协议类型
        protocol = node_data.get('protocol', 'vmess')
        print(f"panel_servers: {panel_servers}")
        if node_type == 'live' and country == "美国":
            print('==进入live美国节点创建==')
        else:
            for panel in panels_3x_ui:
                print(f"开始创建3x-ui节点: {panel.id}")
                if remaining_nodes <= 0:
                    break
                available_servers = panel_servers.get(panel.id, [])
                panel_info = {
                        'type': 'x-ui',
                        'id': panel.id,
                        'ip': panel.ip_address,
                        'port': panel.port,
                        'username': panel.username,
                        'password': panel.password,
                        'panel_type': panel.panel_type
                    }
                while True:
                    skip_remaining_iterations = False

                    for server in available_servers:
                        if remaining_nodes <= 0:
                            skip_remaining_iterations = True
                            break
                    
                        try:
                            # 生成随机未使用端口
                            random_port = agent_panel_viewset.generate_random_port(panel)
                            
                            # 始终生成新的UUID
                            client_id = agent_panel_viewset.generate_uuid()
                            
                            # 生成随机subId
                            sub_id = agent_panel_viewset.generate_sub_id()
                            
                            # 3x-ui的节点创建数据结构，与x-ui类似但可能有所不同
                            three_x_ui_create_node_data = {
                                'up': 0,
                                'down': 0,
                                'total': 0,
                                'remark': node_data.get('remark', '自动创建'),
                                'enable': True,
                                'expiryTime': expiry_time,  # 使用计算好的过期时间
                                'listen':'',
                                'port': random_port,
                                'protocol': protocol.lower(),
                                'settings': {},
                                'streamSettings': {
                                    "network": "tcp",
                                    "security": "none",
                                    "externalProxy": [],
                                    "tcpSettings": {
                                        "acceptProxyProtocol": False,
                                        "header": {
                                            "type": "none"
                                        }
                                    }
                                },
                                'sniffing': {
                                    "enabled": False,
                                    "destOverride": [
                                        "http",
                                        "tls",
                                        "quic",
                                        "fakedns"
                                    ],
                                    "metadataOnly": False,
                                    "routeOnly": False
                                },
                                'allocate': {
                                    "strategy": "always",
                                    "refresh": 5,
                                    "concurrency": 3
                                    }
                            }
                            # 获取特定协议的配置信息
                            
                            if protocol == 'vmess' or protocol == 'Vmess':
                                three_x_ui_create_node_data['settings'] = {
                                    "clients": [
                                        {
                                        "id": client_id,
                                        "security": "auto",
                                        "email": sub_id+str(random_port),
                                        "limitIp": 0,
                                        "totalGB": 0,
                                        "expiryTime": 0,
                                        "enable": True,
                                        "tgId": "",
                                        "subId": sub_id,
                                        "comment": "",
                                        "reset": 0
                                        }
                                    ],
                                }
                            elif protocol == 'vless' or protocol == 'Vless':
                                three_x_ui_create_node_data['settings'] = {
                                    "clients": [
                                        {
                                        "id": client_id,  # 使用生成的UUID
                                        "flow": "",
                                        "email": sub_id+str(random_port),
                                        "limitIp": 0,
                                        "totalGB": 0,
                                        "expiryTime": 0,
                                        "enable": True,
                                        "tgId": "",
                                        "subId": sub_id,
                                        "comment": "",
                                        "reset": 0
                                        }
                                    ],
                                    "decryption": "none",
                                    "fallbacks": []
                                }
                            elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                                three_x_ui_create_node_data['settings'] = {
                                    "method": "2022-blake3-aes-256-gcm",
                                    "password": node_password,
                                    "network": "tcp,udp",
                                    "clients": [
                                        {
                                        "method": "",
                                        "password": node_password,
                                        "email": sub_id+str(random_port),
                                        "limitIp": 0,
                                        "totalGB": 0,
                                        "expiryTime": 0,
                                        "enable": True,
                                        "tgId": "",
                                        "subId": sub_id,
                                        "comment": "",
                                        "reset": 0
                                        }
                                    ],
                                    "ivCheck": False
                                }
                            elif protocol == 'socks' or protocol == 'Socks':
                                three_x_ui_create_node_data['streamSettings']=""
                                three_x_ui_create_node_data['settings'] = {
                                    "auth": "password",
                                    "accounts": [
                                        {
                                        "user": node_user,
                                        "pass": node_password
                                        }
                                    ],
                                    "udp": False,
                                    "ip": "127.0.0.1"
                                }
                                three_x_ui_create_node_data['sniffing'] = {}
                            elif protocol == 'http' or protocol == 'Http':
                                three_x_ui_create_node_data['streamSettings']=""
                                three_x_ui_create_node_data['settings'] = {
                                    "accounts": [
                                        {
                                        "user": node_user,
                                        "pass": node_password
                                        }
                                    ],
                                    "allowTransparent": False
                                }
                            

                            # 确保端口不在已使用列表中
                            used_ports = []
                            if panel.used_ports:
                                used_ports = [int(port) for port in panel.used_ports.split(',') if port.strip().isdigit()]
                            
                            # 检查端口是否已被使用
                            while True:
                                if random_port not in used_ports:
                                    three_x_ui_create_node_data['port'] = random_port
                                    # 更新used_ports列表
                                    used_ports.append(random_port)
                                    panel.used_ports = ','.join(map(str, used_ports))
                                    panel.save()
                                    break
                                else:
                                    # 生成新的随机端口
                                    random_port = random.randint(1, 65534)
                            
                            # 设置为节点数据
                            node_data = three_x_ui_create_node_data
                            # 创建FormData格式的数据
                            form_data = {
                                'up': node_data.get('up', 0),
                                'down': node_data.get('down', 0),
                                'total': node_data.get('total', 0),
                                'remark': node_data.get('remark', '自动创建'),
                                'enable': node_data.get('enable', True),
                                'expiryTime': node_data.get('expiryTime', 0),
                                'listen': node_data.get('listen', ''),
                                'port': node_data.get('port', random_port),
                                'protocol': node_data.get('protocol', 'vmess'),
                                'settings': node_data.get('settings', {}),
                                'streamSettings': node_data.get('streamSettings', {}),
                                'sniffing': node_data.get('sniffing', {}),
                                'allocate': node_data.get('allocate', {})
                            }

                            port = form_data.get('port')
                            protocol = form_data.get('protocol')
                            panel_info["tag"] = server.get('tag')
                            host_config = json.dumps(panel_info, ensure_ascii=False, indent=4)
                            print('==host_config--------------tiaos==',host_config)
                            # 获取节点设置信息
                            settings = form_data.get('settings', {})
                            uuid_str = None
                            node_user = None
                            node_password = None
                            if protocol in ['vmess', 'vless', 'Vmess', 'Vless']:
                                # vmess和vless只使用uuid，没有用户名和密码
                                clients = settings.get('clients', [{}])
                                if clients:
                                    uuid_str = clients[0].get('id')
                            elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                                # shadowsocks没有用户名和uuid，只有密码
                                if panel.panel_type == 'x-ui':
                                    node_password = settings.get('password')
                                else:  # 3x-ui
                                    clients = settings.get('clients', [{}])
                                    if clients:
                                        node_password = clients[0].get('password')
                            elif protocol in ['socks', 'http', 'Socks', 'Http']:
                                # socks和http使用用户名和密码，没有uuid
                                accounts = settings.get('accounts', [{}])
                                if accounts:
                                    node_user = accounts[0].get('user', '')
                                    node_password = accounts[0].get('pass', '')
                        # 创建节点信息字典，但不立即保存

                            node_info_dict = {
                                'user': request.user,
                                'protocol': protocol,
                                'host_config': host_config,
                                'remark': remark,
                                'remark_custom': '',
                                'host': panel.ip or panel.ip_address,
                                'port': port,
                                'uuid': uuid_str,
                                'udp': data.get('udpForward', False),
                                'node_user': node_user,
                                'node_password': node_password,
                                'panel_id': panel.id,
                                'panel_node_id': None,
                                'config_text': json.dumps(form_data, ensure_ascii=False, indent=4),
                                'status': 'pending',
                                'expiry_time': datetime.fromtimestamp(form_data.get('expiryTime', 0)/1000),  # 从毫秒转换为datetime对象
                                'form_data': form_data
                            }
                            udp_config = None  # 初始化 udp_config 变量
                            if data.get('udpForward', False):
                                try:
                                    # 获取登录账户的二级代理
                                    agent = request.user.parent if request.user.parent else None
                                    if agent and agent.user_type == 'agent_l2':
                                        # 获取中转账号信息
                                        transit_account = agent.default_transit_account
                                        if transit_account:
                                            # 获取默认入口和出口
                                            default_in = transit_account.default_inbound
                                            default_out = transit_account.default_outbound
                                            
                                            # 构建中转配置
                                            udp_config =  {
                                                "config": {
                                                    "id": transit_account.id,
                                                    "username": transit_account.username,
                                                    "password": transit_account.password,
                                                },
                                                "udpConfig": {
                                                    "device_group_in": json.loads(default_in).get('id'),
                                                    "device_group_out": json.loads(default_out).get('id'),
                                                    "config": json.dumps({
                                                        "dest": [f"{panel.ip}:{form_data['port']}"]
                                                    }),
                                                    "name": f"{country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
                                                }
                                            }
                                            
                                            # 更新 NodeInfo 表的 udp_config 字段
                                            print(f"最终生成的udp_config: {udp_config}")
                                        else:
                                            print("transit_account 不存在")
                                    else:
                                        print("用户没有关联的二级代理或代理不是二级代理")
                                except Exception as e:
                                    logger.error(f"处理UDP中转配置失败: {str(e)}")
                                    udp_config = None  # 发生错误时设置为 None
                            node_info_dict['udp_config'] = json.dumps(udp_config)
                            # 添加到节点信息列表
                            node_info_list.append(node_info_dict)

                            # 更新剩余节点数
                            remaining_nodes -= 1
                        except Exception as e:
                            logger.error(f"获取面板 {panel.id} 的节点信息失败: {str(e)}")
                            break

                    if skip_remaining_iterations:
                        break
                    if list(panels_x_ui):
                        break

        if remaining_nodes > 0:
            x_ui_list = list(panels_x_ui)
            for i in range(remaining_nodes):
                if remaining_nodes <= 0:
                    break
                panel_index = i % len(x_ui_list)
                panel = x_ui_list[panel_index]
                # 获取面板连接信息
                panel_info = {
                    'type': 'x-ui',
                    'id': panel.id,
                    'ip': panel.ip_address,
                    'port': panel.port,
                    'username': panel.username,
                    'password': panel.password,
                    'panel_type': panel.panel_type
                }
                
                form_data = None
                try:
                    random_port = agent_panel_viewset.generate_random_port(panel)
                    # 始终生成新的UUID
                    client_id = agent_panel_viewset.generate_uuid()
                    
                    # 生成随机subId
                    sub_id = agent_panel_viewset.generate_sub_id()
                    
                    x_ui_create_node_data = {
                        'up': 0,
                        'down': 0,
                        'total': 0,
                        'remark': node_data.get('remark', '自动创建'),
                        'enable': True,
                        'expiryTime': expiry_time,  # 使用计算好的过期时间
                        'listen':'',
                        'port': random_port,  # 使用生成的随机端口
                        'protocol': protocol.lower(),
                        'settings': {},
                        'streamSettings': {
                            "network": "tcp",
                            "security": "none",
                            "tcpSettings": {
                                "header": {
                                "type": "none"
                                }
                            }
                        },
                        'sniffing': {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls",
                                "quic"
                            ]
                        }
                    }
                    if protocol == 'vmess' or protocol == 'Vmess':
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        x_ui_create_node_data['settings'] = {
                            "clients": [
                                {
                                "id": client_id,  # 使用生成的UUID
                                "alterId": 0
                                }
                            ],
                            "disableInsecureEncryption": False
                        }
                    elif protocol == 'vless' or protocol == 'Vless':
                        # 尝试获取cookie
                        if not panel.cookie:
                            cookie = get_login_cookie(panel, panel_info)
                            if not cookie:
                                logger.error(f"无法获取面板 {panel.id} 的cookie")
                                continue
                        url_version = f"http://{panel.ip_address}/server/status"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                        try:
                            response_version = make_request_with_cookie(
                                    panel, 
                                    panel_info, 
                                    url_version, 
                                    headers, 
                                    method='post', 
                                    data=None
                                )
                        except Exception as e:
                            logger.error(f"获取面板 {panel.id} 的版本信息失败: {str(e)}")
                            continue
                        # 添加状态码检查
                        if response_version.status_code != 200:
                            logger.error(f"面板 {panel.id} 版本检查失败，状态码: {response_version.status_code}")
                            panel.is_online = False
                            panel.save()
                            continue

                        # 获取系统版本
                        version = response_version.json().get('obj').get('xray').get('version')
                        
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        if version == '25.3.6':
                            x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,  # 使用生成的UUID
                                    "flow": ""
                                    }
                                ],
                                "decryption": "none",
                                "fallbacks": []
                            }
                        else:
                            x_ui_create_node_data['settings'] = {
                                "clients": [
                                    {
                                    "id": client_id,  # 使用生成的UUID
                                    "flow": "xtls-rprx-direct"
                                    }
                                ],
                                "decryption": "none",
                                "fallbacks": []
                            }
                    elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                        x_ui_create_node_data['sniffing'] = {
                            "enabled": True,
                            "destOverride": [
                                "http",
                                "tls"
                            ]
                        }
                        x_ui_create_node_data['settings'] = {
                            "method": "2022-blake3-aes-256-gcm",
                            "password": node_password,
                            "network": "tcp,udp"
                        }
                    elif protocol == 'socks' or protocol == 'Socks':
                        x_ui_create_node_data['sniffing'] = {}
                        x_ui_create_node_data['settings'] = {
                            "auth": "password",
                            "accounts": [
                                {
                                "user": node_user,
                                "pass": node_password
                                }
                            ],
                            "udp": False,
                            "ip": "127.0.0.1"
                        }
                    elif protocol == 'http' or protocol == 'Http':
                        x_ui_create_node_data['sniffing'] = {}
                        x_ui_create_node_data['settings'] = {
                            "accounts": [
                                {
                                "user": node_user,
                                "pass": node_password
                                }
                            ]    
                        }    
                    # 确保端口不在已使用列表中
                    used_ports = []
                    if panel.used_ports:
                        used_ports = [int(port) for port in panel.used_ports.split(',') if port.strip().isdigit()]
                    
                    # 检查端口是否已被使用
                    while True:
                        if random_port not in used_ports:
                            x_ui_create_node_data['port'] = random_port
                            # 更新used_ports列表
                            used_ports.append(random_port)
                            panel.used_ports = ','.join(map(str, used_ports))
                            panel.save()
                            break
                        else:
                            # 生成新的随机端口
                            random_port = random.randint(1, 65534)
                    
                    # 设置为节点数据
                    node_data = x_ui_create_node_data
                    
                    # 创建FormData格式的数据
                    form_data = {
                        'up': node_data.get('up', 0),
                        'down': node_data.get('down', 0),
                        'total': node_data.get('total', 0),
                        'remark': node_data.get('remark', '自动创建'),
                        'enable': node_data.get('enable', True),
                        'expiryTime': node_data.get('expiryTime', 0),
                        'listen': node_data.get('listen', ''),
                        'port': node_data.get('port', random_port),
                        'protocol': node_data.get('protocol', 'vmess'),
                        'settings': node_data.get('settings', {}),
                        'streamSettings': node_data.get('streamSettings', {}),
                        'sniffing': node_data.get('sniffing', {})
                    }
                    # 获取节点基本信息
                    port = form_data.get('port')
                    protocol = form_data.get('protocol')
                    host_config = json.dumps(panel_info, ensure_ascii=False, indent=4)
                    
                    
                    # 获取节点设置信息
                    settings = form_data.get('settings', {})
                    
                    # 获取特定协议的配置信息
                    uuid_str = None
                    node_user = None
                    node_password = None
                    
                    if protocol in ['vmess', 'vless', 'Vmess', 'Vless']:
                        # vmess和vless只使用uuid，没有用户名和密码
                        clients = settings.get('clients', [{}])
                        if clients:
                            uuid_str = clients[0].get('id')
                    elif protocol == 'shadowsocks' or protocol == 'Shadowsocks':
                        # shadowsocks没有用户名和uuid，只有密码
                        if panel.panel_type == 'x-ui':
                            node_password = settings.get('password')
                        else:  # 3x-ui
                            clients = settings.get('clients', [{}])
                            if clients:
                                node_password = clients[0].get('password')
                    elif protocol in ['socks', 'http', 'Socks', 'Http']:
                        # socks和http使用用户名和密码，没有uuid
                        accounts = settings.get('accounts', [{}])
                        if accounts:
                            node_user = accounts[0].get('user', '')
                            node_password = accounts[0].get('pass', '')
                    # 创建节点信息字典，但不立即保存
                    
                    node_info_dict = {
                        'user': request.user,
                        'protocol': protocol,
                        'host_config': host_config,
                        'remark': remark,
                        'remark_custom': '',
                        'host': panel.ip or panel.ip_address,
                        'port': port,
                        'uuid': uuid_str,
                        'udp': data.get('udpForward', False),
                        'node_user': node_user,
                        'node_password': node_password,
                        'panel_id': panel.id,
                        'panel_node_id': None,
                        'config_text': json.dumps(form_data, ensure_ascii=False, indent=4),
                        'status': 'pending',
                        'expiry_time': datetime.fromtimestamp(form_data.get('expiryTime', 0)/1000),  # 从毫秒转换为datetime对象
                        'form_data': form_data
                    }
                    udp_config = None  # 初始化 udp_config 变量
                    if data.get('udpForward', False):
                        try:
                            # 获取登录账户的二级代理
                            agent = request.user.parent if request.user.parent else None
                            if agent and agent.user_type == 'agent_l2':
                                # 获取中转账号信息
                                transit_account = agent.default_transit_account
                                if transit_account:
                                    # 获取默认入口和出口
                                    default_in = transit_account.default_inbound
                                    default_out = transit_account.default_outbound
                                    
                                    # 构建中转配置
                                    udp_config =  {
                                        "config": {
                                            "id": transit_account.id,
                                            "username": transit_account.username,
                                            "password": transit_account.password,
                                        },
                                        "udpConfig": {
                                            "device_group_in": json.loads(default_in).get('id'),
                                            "device_group_out": json.loads(default_out).get('id'),
                                            "config": json.dumps({
                                                "dest": [f"{panel.ip}:{form_data['port']}"]
                                            }),
                                            "name": f"{country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
                                        }
                                    }
                                    
                                    # 更新 NodeInfo 表的 udp_config 字段
                                else:
                                    print("transit_account 不存在")
                            else:
                                print("用户没有关联的二级代理或代理不是二级代理")
                        except Exception as e:
                            logger.error(f"处理UDP中转配置失败: {str(e)}")
                            udp_config = None  # 发生错误时设置为 None
                    node_info_dict['udp_config'] = json.dumps(udp_config)
                    # 添加到节点信息列表
                    node_info_list.append(node_info_dict)
                    # ... 原有的x-ui节点创建逻辑 ...
                    
                    remaining_nodes -= 1
                    
                except Exception as e:
                    logger.error(f"使用x-ui面板创建节点失败: {str(e)}")
                    continue
        # 
        # 创建订单
        payment_order = PaymentOrder(
                    user=request.user,
                    out_trade_no=order_no,
                    payment_type=data['paymentMethod'],
                    product_name=f"{node_type}-{period}-{node_count}节点",
                    amount=Decimal(str(data['money'])),
                    status='pending',
                    param=json.dumps({
                        'region': country,
                        'nodeType': node_type,
                        'protocol': data.get('protocol', 'vmess'),
                        'period': period
                    }),
                    country=country,
                    node_count=node_count,
                    node_protocol=data.get('protocol', 'vmess')
                )
        payment_order.save()
        
        payment_order.trade_no = order_no
        payment_order.save(update_fields=['trade_no'])
        # 保存所有节点信息
        for node_info_dict in node_info_list:
            try:
                # 从字典中移除表单数据
                form_data = node_info_dict.pop('form_data', None)
                # 创建NodeInfo实例
                node_info = NodeInfo(
                    order=payment_order,
                    **node_info_dict
                )
                
                # 保存节点信息
                node_info.save()
                    
            except Exception as e:
                logger.error(f"保存节点信息失败: {str(e)}")
        
                # 继续处理，不中断流程
        
        nodes = NodeInfo.objects.filter(order=payment_order.id)
        # 异步处理节点创建
        thread = Thread(target=process_node_creation, args=(nodes,))
        thread.start()

        # 更新订单状态
        payment_order.status = 'success'
        payment_order.is_processed = True
        payment_order.save()

        return Response({
            'code': 200,
            'message': '支付成功，等待1-2分钟后，到节点列表查看创建状态，如状态与预期不符，建议联系客服处理',
            'data': {}
        })
            
    except Exception as e:
        logger.error(f"余额支付处理失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'支付处理失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AgentContactView(APIView):
    """获取和修改二级代理联系方式"""
    permission_classes = [AllowAny]  # 允许任何人访问
    
    def get(self, request):
        try:
            agent = None
            contact_info = None
            
            # 如果用户已登录
            if request.user.is_authenticated:
                user = request.user
                # 如果是二级代理，直接获取自己的联系信息
                if user.user_type == 'agent_l2':
                    agent = user
                # 如果是客户，获取其所属二级代理的联系信息
                elif user.user_type == 'customer' and user.parent:
                    agent = user.parent
            
            # 如果未登录或未找到代理，尝试通过域名查找
            if not agent:
                # 获取请求的域名，按优先级尝试多种方式
                requesting_domain = request.META.get('HTTP_HOST', '')
                origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
                referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
                
                # 尝试从HTTP_REFERER中提取域名
                referer_domain = ''
                if referer and '://' in referer:
                    referer_parts = referer.split('://', 1)[1]
                    if '/' in referer_parts:
                        referer_domain = referer_parts.split('/', 1)[0]
                    else:
                        referer_domain = referer_parts
                
                # 尝试从HTTP_ORIGIN中提取域名
                origin_domain = ''
                if origin and '://' in origin:
                    origin_domain = origin.split('://', 1)[1]
                
                # 使用多种方法尝试获取源地址
                domain = referer_domain or origin_domain or requesting_domain
                
                if not domain:
                    return Response({
                        'code': 400,
                        'message': '无法获取请求域名'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 查找匹配的二级代理
                agent = User.objects.filter(
                    user_type='agent_l2',
                    domain=domain,
                    is_active=True
                ).first()
            
            if not agent:
                return Response({
                    'code': 404,
                    'message': '未找到对应的二级代理'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 获取联系方式信息
            contact_info = ContactInfo.objects.filter(user=agent).first()
            
            # 返回联系方式
            return Response({
                'code': 200,
                'message': '获取成功',
                'data': {
                    'qq': contact_info.qq if contact_info else None,
                    'wechat': contact_info.wechat if contact_info else None,
                    'phone': contact_info.phone if contact_info else None,
                    'qq_qrcode_url': request.build_absolute_uri(contact_info.qq_qrcode.url) if contact_info and contact_info.qq_qrcode else None,
                    'wechat_qrcode_url': request.build_absolute_uri(contact_info.wechat_qrcode.url) if contact_info and contact_info.wechat_qrcode else None
                }
            })
            
        except Exception as e:
            logger.error(f"获取二级代理联系方式失败: {str(e)}")
            return Response({
                'code': 500,
                'message': '获取失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """修改二级代理联系方式"""
        try:
            # 验证用户是否登录且是二级代理
            if not request.user.is_authenticated or request.user.user_type != 'agent_l2':
                return Response({
                    'code': 403,
                    'message': '无权限修改联系方式'
                }, status=status.HTTP_403_FORBIDDEN)
            
            agent = request.user
            data = request.data
            
            # 获取或创建联系方式信息
            contact_info, created = ContactInfo.objects.get_or_create(user=agent)
            
            # 更新联系方式
            if 'qq' in data:
                contact_info.qq = data['qq']
            if 'wechat' in data:
                contact_info.wechat = data['wechat']
            if 'phone' in data:
                contact_info.phone = data['phone']
            
            # 处理QQ二维码上传
            if 'qq_qrcode' in request.FILES:
                qr_code = request.FILES['qq_qrcode']
                if qr_code.size > 2 * 1024 * 1024:  # 2MB
                    return Response({
                        'code': 400,
                        'message': 'QQ二维码图片不能超过2MB'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if contact_info.qq_qrcode:
                    contact_info.qq_qrcode.delete(save=False)
                contact_info.qq_qrcode = qr_code
            
            # 处理微信二维码上传
            if 'wechat_qrcode' in request.FILES:
                qr_code = request.FILES['wechat_qrcode']
                if qr_code.size > 2 * 1024 * 1024:  # 2MB
                    return Response({
                        'code': 400,
                        'message': '微信二维码图片不能超过2MB'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if contact_info.wechat_qrcode:
                    contact_info.wechat_qrcode.delete(save=False)
                contact_info.wechat_qrcode = qr_code
            
            contact_info.save()
            
            return Response({
                'code': 200,
                'message': '更新成功',
                'data': {
                    'qq': contact_info.qq,
                    'wechat': contact_info.wechat,
                    'phone': contact_info.phone,
                    'qq_qrcode_url': request.build_absolute_uri(contact_info.qq_qrcode.url) if contact_info.qq_qrcode else None,
                    'wechat_qrcode_url': request.build_absolute_uri(contact_info.wechat_qrcode.url) if contact_info.wechat_qrcode else None
                }
            })
            
        except Exception as e:
            logger.error(f"更新二级代理联系方式失败: {str(e)}")
            return Response({
                'code': 500,
                'message': '更新失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AgentPricingView(APIView):
    """获取二级代理定价"""
    permission_classes = [AllowAny]  # 修改为允许所有访问，我们将在方法内部处理权限
    
    def get(self, request):
        try:
            # 获取查询参数中的用户ID
            user_id = request.query_params.get('user_id')
            
            # 获取当前登录用户（如果有）
            current_user = request.user if request.user.is_authenticated else None
            
            # 初始化响应数据
            response_data = {}
            
            # 如果指定了用户ID，查询该用户
            target_user = None
            if user_id:
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    return Response({
                        'code': 404,
                        'message': '未找到指定用户',
                        'data': None
                    }, status=status.HTTP_404_NOT_FOUND)
            
            # 如果有当前登录用户但没有指定user_id，使用当前用户
            if not target_user and current_user:
                target_user = current_user
            
            # 如果既没有指定用户ID也没有当前登录用户，返回错误
            if not target_user:
                return Response({
                    'code': 401,
                    'message': '未授权访问',
                    'data': None
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            # 获取用户的代理（如果用户是客户）或用户本身（如果用户是代理）
            agent = target_user if target_user.is_agent else target_user.parent
            
            if not agent:
                return Response({
                    'code': 404,
                    'message': '未找到关联的代理',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 获取默认定价
            default_prices = {
                'normal': {
                    'monthly': agent.normal_monthly_price,
                    'quarterly': agent.normal_quarterly_price,
                    'half_yearly': agent.normal_half_yearly_price,
                    'yearly': agent.normal_yearly_price
                },
                'live': {
                    'monthly': agent.live_monthly_price,
                    'quarterly': agent.live_quarterly_price,
                    'half_yearly': agent.live_half_yearly_price,
                    'yearly': agent.live_yearly_price
                },
                'transit': {
                    'monthly': agent.transit_monthly_price,
                    'quarterly': agent.transit_quarterly_price,
                    'half_yearly': agent.transit_half_yearly_price,
                    'yearly': agent.transit_yearly_price
                }
            }
            
            response_data['default_prices'] = default_prices
            
            # 获取代理的自定义定价
            agent_custom_prices = {
                'normal': {
                    'monthly': agent.custom_normal_monthly_price,
                    'quarterly': agent.custom_normal_quarterly_price,
                    'half_yearly': agent.custom_normal_half_yearly_price,
                    'yearly': agent.custom_normal_yearly_price
                },
                'live': {
                    'monthly': agent.custom_live_monthly_price,
                    'quarterly': agent.custom_live_quarterly_price,
                    'half_yearly': agent.custom_live_half_yearly_price,
                    'yearly': agent.custom_live_yearly_price
                },
                'transit': {
                    'monthly': agent.custom_transit_monthly_price,
                    'quarterly': agent.custom_transit_quarterly_price,
                    'half_yearly': agent.custom_transit_half_yearly_price,
                    'yearly': agent.custom_transit_yearly_price
                }
            }
            
            response_data['custom_prices'] = agent_custom_prices
            
            # 如果目标用户是客户且有自定义价格，添加用户价格
            if not target_user.is_agent:
                user_custom_prices = {
                    'normal': {
                        'monthly': target_user.custom_normal_monthly_price,
                        'quarterly': target_user.custom_normal_quarterly_price,
                        'half_yearly': target_user.custom_normal_half_yearly_price,
                        'yearly': target_user.custom_normal_yearly_price
                    },
                    'live': {
                        'monthly': target_user.custom_live_monthly_price,
                        'quarterly': target_user.custom_live_quarterly_price,
                        'half_yearly': target_user.custom_live_half_yearly_price,
                        'yearly': target_user.custom_live_yearly_price
                    },
                    'transit': {
                        'monthly': target_user.custom_transit_monthly_price,
                        'quarterly': target_user.custom_transit_quarterly_price,
                        'half_yearly': target_user.custom_transit_half_yearly_price,
                        'yearly': target_user.custom_transit_yearly_price
                    }
                }
                response_data['user_prices'] = user_custom_prices
            
            return Response({
                'code': 200,
                'message': '获取成功',
                'data': response_data
            })
            
        except Exception as e:
            logger.error(f"获取定价失败: {str(e)}")
            return Response({
                'code': 500,
                'message': '获取失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateCustomPricingView(APIView):
    """修改二级代理自定义定价"""
    permission_classes = [IsAuthenticated, IsAgentL2]  # 只允许二级代理访问
    
    def post(self, request):
        try:
            agent = request.user
            data = request.data
            
            # 验证请求数据格式
            if not isinstance(data, dict):
                return Response({
                    'code': 400,
                    'message': '请求数据格式无效'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 定义所有可能的节点类型和周期
            node_types = ['normal', 'live', 'transit']
            periods = ['monthly', 'quarterly', 'half_yearly', 'yearly']
            
            # 验证并更新每个价格
            updated_prices = {}
            update_fields = []  # 用于记录需要更新的字段
            
            for node_type in node_types:
                if node_type not in data:
                    continue
                    
                node_prices = data[node_type]
                if not isinstance(node_prices, dict):
                    continue
                
                updated_prices[node_type] = {}
                for period in periods:
                    if period not in node_prices:
                        continue
                    
                    try:
                        # 验证价格
                        price = Decimal(str(node_prices[period]))
                        if price <= 0:
                            continue
                        
                        # 获取对应的默认定价
                        default_price_field = f"{node_type}_{period}_price"
                        default_price = getattr(agent, default_price_field)
                        
                        # 验证自定义价格不能低于默认定价
                        if price < default_price:
                            continue
                        
                        # 更新自定义价格
                        custom_price_field = f"custom_{node_type}_{period}_price"
                        setattr(agent, custom_price_field, price)
                        updated_prices[node_type][period] = str(price)
                        update_fields.append(custom_price_field)  # 记录需要更新的字段
                        
                    except (ValueError, TypeError):
                        continue
            
            # 保存所有更新
            if update_fields:
                agent.save(update_fields=update_fields)
            
            return Response({
                'code': 200,
                'message': '更新成功',
                'data': {
                    'updated_prices': updated_prices,
                    'update_fields': update_fields  # 返回更新的字段列表，方便调试
                }
            })
            
        except Exception as e:
            logger.error(f"更新二级代理自定义定价失败: {str(e)}")
            return Response({
                'code': 500,
                'message': '更新失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def process_node_creation(nodes):
    """
    异步处理节点创建和中转配置的函数
    """
    print('==开始处理节点创建和中转配置==')
    try:
        # 用于收集需要重启的面板
        panels_to_restart = set()
        
        # 遍历所有节点信息
        for node in nodes:
            try:
                # 解析host_config
                print('==host_config==',node.host_config)
                if node.host_config:
                    if isinstance(node.host_config, dict):
                        host_config = node.host_config
                    else:
                        host_config = json.loads(node.host_config)
                    logger.info(f"处理节点 {node.id}, 面板: {host_config}")
                    
                    # 获取面板信息
                    panel_id = host_config.get('id')
                    if not panel_id:
                        logger.error(f"节点 {node.id} 的host_config中没有panel_id")
                        continue
                        
                    try:
                        panel = AgentPanel.objects.get(id=panel_id)
                    except AgentPanel.DoesNotExist:
                        logger.error(f"找不到ID为 {panel_id} 的面板")
                        continue
                    
                    # 解析config_text获取节点配置
                    if not node.config_text:
                        logger.error(f"节点 {node.id} 没有config_text数据")
                        continue
                        
                    # 解析config_text为JSON对象
                    form_data = json.loads(node.config_text)
                    
                    # 调整form_data格式，将嵌套对象转为字符串
                    nested_fields = ['settings', 'streamSettings', 'sniffing', 'allocate']
                    for field in nested_fields:
                        if field in form_data and isinstance(form_data[field], (dict, list)):
                            # 将对象转为JSON字符串
                            form_data[field] = json.dumps(form_data[field])
                    
                    
                    # 构建请求头
                    if panel.panel_type == 'x-ui':
                        url = f"http://{panel.ip_address}/xui/inbound/add"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                    else:  # 3x-ui
                        url = f"http://{panel.ip_address}/panel/api/inbounds/add"
                        headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                        }
                        panels_to_restart.add(panel)
                    
                    # 尝试获取cookie
                    if not panel.cookie:
                        logger.info(f"面板 {panel_id} 无cookie，尝试登录获取")
                        cookie = get_login_cookie(panel, host_config)
                        if not cookie:
                            logger.error(f"无法获取面板 {panel_id} 的cookie")
                            continue
                    
                    # 发送创建节点请求
                    try:
                        # 使用封装的请求函数，自动处理cookie过期问题
                        response = make_request_with_cookie(
                            panel, 
                            host_config, 
                            url, 
                            headers, 
                            method='post_params', 
                            data=form_data
                        )
                        # 检查响应
                        if response.status_code == 200:
                            try:
                                result = response.json()
                                success = result.get('success', False)
                                if success:
                                    # 获取新创建的节点ID
                                    if panel.panel_type == 'x-ui':
                                        list_url = f"http://{panel.ip_address}/xui/inbound/list"
                                        list_response = make_request_with_cookie(
                                            panel,
                                            host_config,
                                            list_url,
                                            headers,
                                            method='post'
                                        )
                                        
                                        if list_response.status_code == 200:
                                            list_result = list_response.json()
                                            if list_result.get('success'):
                                                # 获取请求中的端口号
                                                request_port = form_data.get('port')
                                                if request_port:
                                                    # 遍历节点列表查找匹配的端口
                                                    for inbound in list_result.get('obj', []):
                                                        if str(inbound.get('port')) == str(request_port):
                                                            panel_node_id = inbound.get('id')
                                                            break
                                    else:  # 3x-ui
                                        panel_node_id = result.get('obj', {}).get('id')
                                        #创建绑定出站规则和路由规则
                                        tag = result.get('obj', {}).get('tag')
                                        print('==tag==',tag)
                                        headers = {
                                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                            'host': f'{panel.ip_address.split("/")[0]}',
                                            'Accept': 'application/json, text/plain, */*',
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                            'Origin': f'http://{panel.ip_address.split("/")[0]}',
                                            'Referer': f'http://{panel.ip_address}/panel/'
                                        }
                                        
                                        # 获取xray配置
                                        url = f"http://{panel.ip_address}/panel/xray/"
                                        response = make_request_with_cookie(panel, {
                                            'ip': panel.ip_address,
                                            'username': panel.username,
                                            'password': panel.password,
                                            'panel_type': panel.panel_type
                                        }, url, headers, method='post')
                                        
                                        if response.status_code == 200:
                                            result = response.json()
                                            if result.get('success'):
                                                print('==result==',host_config)
                                                # 获取xray配置
                                                xraySetting = json.loads(result.get('obj', {}))
                                                # 创建绑定出站规则和路由规则
                                                # outbound_rules = 
                                                xraySetting['xraySetting']['routing']['rules'].append({
                                                    "type": "field",
                                                    "outboundTag": host_config.get('tag'),
                                                    "inboundTag": [
                                                        tag
                                                    ]
                                                })
                                                update_data = {
                                                    'xraySetting': json.dumps(xraySetting.get('xraySetting'))
                                                }
                                                # 发送更新请求
                                                update_response = make_request_with_cookie(
                                                    panel,
                                                    host_config,
                                                    f"http://{panel.ip_address}/panel/xray/update",
                                                    {
                                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                                        'Accept': 'application/json, text/plain, */*',
                                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                                    },
                                                    method='post',
                                                    data=update_data
                                                )
                                                if update_response.status_code == 200:
                                                    print(f"更新xray配置成功")
                                                else:
                                                    print(f"更新xray配置失败: {update_response.text}")
                                            
                                        # # 重启面板/server/restartXrayService
                                        # url_restart = f"http://{panel.ip_address}/server/restartXrayService"
                                        # response = make_request_with_cookie(panel, {
                                        #     'ip': panel.ip_address,
                                        #     'username': panel.username,
                                        #     'password': panel.password,
                                        #     'panel_type': panel.panel_type
                                        # }, url_restart, headers, method='get')
                                        # if response.status_code == 200:
                                        #     print(f"重启面板成功")
                                        # else:
                                        #     print(f"重启面板失败: {response.text}")
                                    # 更新节点状态和面板节点ID
                                    update_single_panel(panel)
                                    node.status = 'active'
                                    node.panel_node_id = panel_node_id
                                    if node.udp:
                                        try:
                                            # 解析 JSON 字符串
                                            udp_config_json = json.loads(node.udp_config)
                                            
                                            # 获取配置信息
                                            udp_zhanghao = udp_config_json.get('config', {})
                                            udp_peizhi = udp_config_json.get('udpConfig', {})
                                            transit_account = TransitAccount.objects.get(id=udp_zhanghao.get('id'))
                                            auth_token = transit_account.token
                                            if not auth_token:
                                                login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                login_data = {
                                                    "username": udp_zhanghao.get('username'),
                                                    "password": udp_zhanghao.get('password')
                                                }
                                                headers_nyanpass = {
                                                    "Content-Type": "text/plain;charset=UTF-8",
                                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                    "Accept": "*/*",
                                                    "Origin": settings.API_BASE_URL,
                                                }
                                                login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                if login_response.status_code == 200:
                                                    login_result = login_response.json()
                                                    auth_token = login_result.get('data', {})
                                                    transit_account.token = auth_token
                                                    transit_account.save(update_fields=['token'])
                                            print('==中转配置==',udp_peizhi)
                                            udp_peizhi['config'] = json.dumps({
                                                        "dest": [f"{panel.ip}:{node.port}"]
                                                    })
                                            
                                            # 中转登录
                                            print('==处理后的中转配置==',udp_peizhi)
                                            try:
                                                login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                login_data = {
                                                    "username": udp_zhanghao.get('username'),
                                                    "password": udp_zhanghao.get('password')
                                                }
                                                headers_nyanpass = {
                                                    "Content-Type": "text/plain;charset=UTF-8",
                                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                    "Accept": "*/*",
                                                    "Origin": settings.API_BASE_URL,
                                                }
                                                # login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                            
                                                
                                                if auth_token:
                                                    # 创建转发
                                                    forward_url = f"{settings.API_BASE_URL}/api/v1/user/forward"
                                                    forward_headers = {
                                                        "Authorization": f"{auth_token}",
                                                        "Content-Type": "application/json"
                                                    }
                                                    
                                                    # 执行中转注册，添加重试机制
                                                    retry_count = 0
                                                    max_retries = 4  # 最大重试次数，加上首次请求总共尝试4次
                                                    forward_success = False
                                                    
                                                    while retry_count <= max_retries and not forward_success:
                                                        forward_response = requests.put(forward_url, headers=forward_headers, json=udp_peizhi)
                                                        if forward_response.status_code == 200:
                                                            forward_success = True
                                                        elif forward_response.status_code == 403 or retry_count==3:
                                                            login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                            login_data = {
                                                                "username": udp_zhanghao.get('username'),
                                                                "password": udp_zhanghao.get('password')
                                                            }
                                                            headers_nyanpass = {
                                                                "Content-Type": "text/plain;charset=UTF-8",
                                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                                "Accept": "*/*",
                                                                "Origin": settings.API_BASE_URL,
                                                            }
                                                            login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                            if login_response.status_code == 200:
                                                                login_result = login_response.json()
                                                                auth_token = login_result.get('data', {})
                                                                transit_account.token = auth_token
                                                                transit_account.save(update_fields=['token'])
                                                                forward_headers = {
                                                                    "Authorization": f"{auth_token}",
                                                                    "Content-Type": "application/json"
                                                                }
                                                        else:
                                                            retry_count += 1
                                                            if retry_count <= max_retries:
                                                                # 随机等待0.5到1秒后重试
                                                                wait_time = random.uniform(5, 15)
                                                                logger.info(f"UDP转发创建失败，等待{wait_time:.2f}秒后进行第{retry_count+1}次尝试")
                                                                time.sleep(wait_time)
                                                            else:
                                                                logger.error(f"UDP转发创建失败，已重试{max_retries}次: {forward_response.text}")
                                                    
                                                    if forward_success:                                                       
                                                        # 获取转发规则
                                                        search_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
                                                        search_rules_data = {
                                                            "gid": 0,
                                                            "gid_in": 0,
                                                            "gid_out": 0,
                                                            "name": "",
                                                            "dest": json.loads(udp_peizhi.get('config')).get('dest')[0],
                                                            "listen_port": 0
                                                        }
                                                        search_rules_response = requests.post(
                                                            search_rules_url,
                                                            headers=forward_headers,
                                                            json=search_rules_data
                                                        )
                                                        
                                                        if search_rules_response.status_code == 200:

                                                            search_rules_data = search_rules_response.json()
                                                            if search_rules_data.get('code') == 0 and search_rules_data.get('data'):
                                                                # 获取监听端口
                                                                listen_port = search_rules_data['data'][0]['listen_port']
                                                                
                                                                # 获取设备组信息
                                                                device_group_url = f"{settings.API_BASE_URL}/api/v1/user/devicegroup"
                                                                device_group_response = requests.get(
                                                                    device_group_url,
                                                                    headers=forward_headers
                                                                )
                                                                
                                                                if device_group_response.status_code == 200:
                                                                    device_group_data = device_group_response.json()
                                                                    if device_group_data.get('code') == 0 and device_group_data.get('data'):
                                                                        # 查找匹配的设备组
                                                                        for group in device_group_data['data']:
                                                                            if group['id'] == search_rules_data['data'][0]['device_group_in']:
                                                                                # 拼装 UDP 主机地址
                                                                                udp_host = f"{group['id']}:{listen_port}"
                                                                                # 更新 NodeInfo 的 udp_host 字段
                                                                                node.udp_host = udp_host
                                                                                node.save(update_fields=['udp_host'])
                                                                                break
                                                    else:
                                                        logger.error(f"UDP转发创建失败，已重试{max_retries}次仍失败")
                                                else:
                                                    logger.error(f"中转登录失败: {login_response.text}")
                                            
                                            except Exception as e:
                                                logger.error(f"处理UDP中转配置时出错: {str(e)}")
                                        except Exception as e:
                                            logger.error(f"处理UDP配置时出错: {str(e)}")
                                    
                                    node.save(update_fields=['status', 'panel_node_id', 'udp_config'])
                                else:
                                    error_msg = result.get('msg', '未知错误')
                                    logger.error(f"创建节点失败: {error_msg}")
                                    node.status = 'inactive'
                                    node.save(update_fields=['status'])
                            except json.JSONDecodeError:
                                logger.error(f"解析面板响应失败: {response.text}")
                                node.status = 'inactive'
                                node.save(update_fields=['status'])
                        else:
                            logger.error(f"面板返回错误状态码: {response.status_code}, 响应: {response.text}")
                            node.status = 'inactive'
                            node.save(update_fields=['status'])
                        

                    except Exception as e:
                        logger.error(f"发送创建节点请求时出错: {str(e)}")
                        node.status = 'inactive'
                        node.save(update_fields=['status'])
                else:
                    logger.error(f"节点 {node.id} 没有有效的host_config")
                    node.status = 'inactive'
                    node.save(update_fields=['status'])
                
            except Exception as e:
                logger.error(f"处理节点 {node.id} 时出错: {str(e)}")
                continue
                
        # 所有节点处理完成后，统一重启所有使用到的面板
        logger.info(f"所有节点创建完成，准备重启 {len(panels_to_restart)} 个面板")
        for panel in panels_to_restart:
            try:
                logger.info(f"重启面板 {panel.id} ({panel.ip_address})")
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                }
                
                panel_info = {
                    'ip': panel.ip_address,
                    'username': panel.username,
                    'password': panel.password,
                    'panel_type': panel.panel_type
                }
                
                url_restart = f"http://{panel.ip_address}/server/restartXrayService"
                response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                print('==重启面板==',response.json())
                if response.json().get('success'):
                    logger.info(f"重启面板 {panel.id} 成功")
                else:
                    response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                    logger.error(f"重启面板 {panel.id} 失败: {response.text}")
                    if response.json().get('success'):
                        logger.info(f"重启面板 {panel.id} 成功")
                    else:
                        response = make_request_with_cookie(panel, panel_info, url_restart, headers, method='post')
                        logger.error(f"重启面板 {panel.id} 失败: {response.text}")
            except Exception as e:
                logger.error(f"重启面板 {panel.id} 时出错: {str(e)}")
    
    except Exception as e:
        logger.error(f"节点创建过程中发生错误: {str(e)}")



def process_node_creation_time(node):
    """
    异步处理节点创建和中转配置的函数
    单节点续费操作
    订单续费操作也是传递订单下所有节点调用这个函数
    通过修改节点到期时间来实现
    """
    print('==开始处理节点创建，修改节点到期时间来实现==')
    try:
        # 遍历所有节点信息
        try:
                # 解析host_config
            print('==host_config==',node.host_config)
            if node.host_config:
                if isinstance(node.host_config, dict):
                    host_config = node.host_config
                else:
                    host_config = json.loads(node.host_config)
                logger.info(f"处理节点 {node.id}, 面板: {host_config}")
                
                # 获取面板信息
                panel_id = host_config.get('id')
                if not panel_id:
                    logger.error(f"节点 {node.id} 的host_config中没有panel_id")
                    
                    
                try:
                    panel = AgentPanel.objects.get(id=panel_id)
                except AgentPanel.DoesNotExist:
                    logger.error(f"找不到ID为 {panel_id} 的面板")
                    
                
                # 解析config_text获取节点配置
                if not node.config_text:
                    logger.error(f"节点 {node.id} 没有config_text数据")
                    
                    
                # 解析config_text为JSON对象
                form_data = json.loads(node.config_text)
                
                # 调整form_data格式，将嵌套对象转为字符串
                nested_fields = ['settings', 'streamSettings', 'sniffing', 'allocate']
                for field in nested_fields:
                    if field in form_data and isinstance(form_data[field], (dict, list)):
                        # 将对象转为JSON字符串
                        form_data[field] = json.dumps(form_data[field])
                
                
                # 构建请求头
                if panel.panel_type == 'x-ui':
                    url = f"http://{panel.ip_address}/xui/inbound/update/{node.panel_node_id}"
                    headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                    }
                else:  # 3x-ui
                    url = f"http://{panel.ip_address}/panel/inbound/update/{node.panel_node_id}"
                    headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                    }
                
                # 尝试获取cookie
                if not panel.cookie:
                    logger.info(f"面板 {panel_id} 无cookie，尝试登录获取")
                    cookie = get_login_cookie(panel, host_config)
                    if not cookie:
                        logger.error(f"无法获取面板 {panel_id} 的cookie")
                        
                
                # 发送创建节点请求
                try:
                    # 使用封装的请求函数，自动处理cookie过期问题
                    response = make_request_with_cookie(
                        panel, 
                        host_config, 
                        url, 
                        headers, 
                        method='post_params', 
                        data=form_data
                    )
                    # 检查响应
                    if response.status_code == 200:
                        logger.info(f"节点 {node.id} 续费更新成功")
                    else:
                        logger.error(f"面板返回错误状态码: {response.status_code}, 响应: {response.text}")
                        node.status = 'inactive'
                        node.save(update_fields=['status'])
                    
                    if node.udp:
                        udp_config_json = json.loads(node.udp_config)
                        udp_zhanghao = udp_config_json.get('config', {})
                        udp_peizhi = udp_config_json.get('udpConfig', {})
                        udp_search_dest_ip = json.loads(udp_peizhi.get('config')).get('dest')[0]
                        print("+++++++++续费udp+udp_search_dest_ip++++++++",udp_search_dest_ip)
                        transit_account = TransitAccount.objects.get(id=udp_zhanghao.get('id'))
                        auth_token = transit_account.token
                        if not auth_token:
                            login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                            login_data = {
                                "username": udp_zhanghao.get('username'),
                                "password": udp_zhanghao.get('password')
                            }
                            headers_nyanpass = {
                                "Content-Type": "text/plain;charset=UTF-8",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Accept": "*/*",
                                "Origin": settings.API_BASE_URL,
                            }
                            login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                            if login_response.status_code == 200:
                                login_result = login_response.json()
                                auth_token = login_result.get('data', {})
                                transit_account.token = auth_token
                                transit_account.save(update_fields=['token'])

                        if auth_token:
                            forward_headers = {
                                        "Authorization": f"{auth_token}",
                                        "Content-Type": "application/json"
                                    }
                            retry_count = 0
                            max_retries = 4  # 最大重试次数，加上首次请求总共尝试2次
                            forward_success = False
                            search_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
                            search_rules_data = {
                                "gid": 0,
                                "gid_in": 0,
                                "gid_out": 0,
                                "name": "",
                                "dest": udp_search_dest_ip,
                                "listen_port": 0
                            }
                            while retry_count <= max_retries and not forward_success:
                                search_rules_response = requests.post(
                                            search_rules_url,
                                            headers=forward_headers,
                                            json=search_rules_data
                                        )
                                if search_rules_response.status_code == 200 and search_rules_response.json().get('code') != 403:
                                    search_rules_data = search_rules_response.json()
                                    if search_rules_data.get('code') == 0 and search_rules_data.get('data'):
                                        pass_data = search_rules_data.get('data')
                                        for pass_item in pass_data:
                                            pass_item["name"] = udp_peizhi.get('name')
                                            print("+++++++++续费udp+pass_item++++++++",pass_item)
                                            forward_headers = {
                                                        "Authorization": f"{auth_token}",
                                                        "Content-Type": "application/json"
                                                    }
                                            res_change_forward = requests.post(
                                                        f"{settings.API_BASE_URL}/api/v1/user/forward/{pass_item.get('id')}",
                                                        headers=forward_headers,
                                                        json=pass_item
                                                    )
                                            retry_count_change_forward = 0
                                            max_retries_change_forward = 4
                                            forward_success_change_forward = False
                                            while retry_count_change_forward <= max_retries_change_forward and not forward_success_change_forward:
                                                if res_change_forward.status_code == 200 and res_change_forward.json().get('code') == 0:
                                                    forward_success_change_forward = True
                                                    break
                                                elif res_change_forward.status_code == 403 or res_change_forward.json().get('code') == 403 or retry_count_change_forward==3:
                                                    retry_count_change_forward+=1
                                                    login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                    login_data = {
                                                        "username": udp_zhanghao.get('username'),
                                                        "password": udp_zhanghao.get('password')
                                                    }
                                                    headers_nyanpass = {
                                                        "Content-Type": "text/plain;charset=UTF-8",
                                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                        "Accept": "*/*",
                                                        "Origin": settings.API_BASE_URL,
                                                    }
                                                    login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                    if login_response.status_code == 200:
                                                        login_result = login_response.json()
                                                        auth_token = login_result.get('data', {})
                                                        transit_account.token = auth_token
                                                        transit_account.save(update_fields=['token'])
                                                        forward_headers = {
                                                            "Authorization": f"{auth_token}",
                                                            "Content-Type": "application/json"
                                                        }
                                                else:
                                                    retry_count_change_forward += 1
                                                    if retry_count_change_forward <= max_retries_change_forward:
                                                        time.sleep(random.uniform(3, 7))
                                        forward_success = True
                                        break
                                elif search_rules_response.status_code == 403 or search_rules_response.json().get('code') == 403 or retry_count==3:
                                    retry_count += 1
                                    login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                    login_data = {
                                        "username": udp_zhanghao.get('username'),
                                        "password": udp_zhanghao.get('password')
                                    }
                                    headers_nyanpass = {
                                        "Content-Type": "text/plain;charset=UTF-8",
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                        "Accept": "*/*",
                                        "Origin": settings.API_BASE_URL,
                                    }
                                    login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                    if login_response.status_code == 200:
                                        login_result = login_response.json()
                                        auth_token = login_result.get('data', {})
                                        transit_account.token = auth_token
                                        transit_account.save(update_fields=['token'])
                                        forward_headers = {
                                            "Authorization": f"{auth_token}",
                                            "Content-Type": "application/json"
                                        }
                                else:
                                    retry_count += 1
                                    if retry_count <= max_retries:
                                        # 随机等待0.5到1秒后重试
                                        wait_time = random.uniform(5, 15)
                                        logger.info(f"UDP转发更新失败，等待{wait_time:.2f}秒后进行第{retry_count+1}次尝试")
                                        time.sleep(wait_time)
                                    else:
                                        logger.error(f"UDP转发更新失败，已重试{max_retries}次仍失败")

                except Exception as e:
                    logger.error(f"发送创建节点请求时出错: {str(e)}")
                    node.status = 'inactive'
                    node.save(update_fields=['status'])
            else:
                logger.error(f"节点 {node.id} 没有有效的host_config")
                node.status = 'inactive'
                node.save(update_fields=['status'])
            
        except Exception as e:
            logger.error(f"处理节点 {node.id} 时出错: {str(e)}")
    except Exception as e:
        logger.error(f"节点创建过程中发生错误: {str(e)}")

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_node_panel(request):
    """
    修改节点所属面板接口
    将节点迁移到新的面板，并重新创建配置
    """
    try:
        # 获取请求数据
        node_id = request.data.get('node_id')
        new_panel_id = request.data.get('panel_id')
        
        if not node_id or not new_panel_id:
            return Response({
                'code': 400,
                'message': '节点ID和面板ID不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 查询节点和面板
        try:
            node = NodeInfo.objects.get(id=node_id)
        except NodeInfo.DoesNotExist:
            return Response({
                'code': 404,
                'message': '节点不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
            
        try:
            new_panel = AgentPanel.objects.get(id=new_panel_id)
        except AgentPanel.DoesNotExist:
            return Response({
                'code': 404,
                'message': '面板不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 解析当前节点配置
        if not node.config_text:
            return Response({
                'code': 400,
                'message': '节点配置信息不完整',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        
        # 创建新的host_config
        new_host_config = {
            'id': new_panel.id,
            'ip': new_panel.ip_address,
            'username': new_panel.username,
            'password': new_panel.password,
            'panel_type': new_panel.panel_type,
            'tag': '',
        }
        
        new_config = json.loads(node.config_text)
        if new_panel.panel_type == 'x-ui':
            if node.protocol == 'vless' or node.protocol == 'Vless':
                url_version = f"http://{new_panel.ip_address}/server/status"
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                }
                response_version = make_request_with_cookie(
                            new_panel, 
                            new_host_config, 
                            url_version, 
                            headers, 
                            method='post', 
                            data=None
                        )
                # 获取系统版本
                if response_version.status_code != 200:
                    logger.error(f"面板 {new_panel.id} 版本检查失败，状态码: {response_version.status_code}")
                    new_panel.is_online = False
                    new_panel.save()
                    return Response({
                        'code': 500,
                        'message': f'处理失败: {str(e)}',
                        'data': None
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                else:
                    version = response_version.json().get('obj').get('xray').get('version')
                    if version == '25.3.6':
                        new_config['settings']['clients'][0]['flow'] = ""
                    else:
                        new_config['settings']['clients'][0]['flow'] = "xtls-rprx-direct"
                    
                print('==处理后的配置==',new_config)
            # 确保端口不在已使用列表中
            used_ports = []
            if new_panel.used_ports:
                used_ports = [int(port) for port in new_panel.used_ports.split(',') if port.strip().isdigit()]
            
            random_port = node.port
            print('==随机端口==',random_port)
            print('==已使用端口==',used_ports)
            # 检查端口是否已被使用
            while True:
                if random_port not in used_ports:
                    node.port = random_port
                    new_config['port'] = random_port
                    print('==更新后的端口==',new_config)
                    # 更新used_ports列表
                    used_ports.append(random_port)
                    new_panel.used_ports = ','.join(map(str, used_ports))
                    new_panel.save(update_fields=['used_ports'])
                    break
                else:
                    # 生成新的随机端口
                    random_port = random.randint(1, 65534)
                    
            if not new_panel.cookie:
                cookie = get_login_cookie(new_panel, new_host_config)
                if not cookie:
                    logger.error(f"无法获取面板 {new_panel.id} 的cookie")
                    
        else:
            headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{new_panel.ip_address.split("/")[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{new_panel.ip_address.split("/")[0]}',
                    'Referer': f'http://{new_panel.ip_address}/panel/'
                }
            url = f"http://{new_panel.ip_address}/panel/xray/"
            response = make_request_with_cookie(new_panel, {
                    'ip': new_panel.ip_address,
                    'username': new_panel.username,
                    'password': new_panel.password,
                    'panel_type': new_panel.panel_type
                }, url, headers, method='post')
            if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        xray_setting = json.loads(result['obj'])['xraySetting']
                        servers = []
                        # 提取所有可用的servers节点
                        for outbound in xray_setting.get('outbounds', []):
                            try:
                                if outbound.get('protocol') == 'socks':
                                    settings = outbound.get('settings', {})
                                    # 检查settings是否是字符串，如果是则需要解析
                                    if isinstance(settings, str):
                                        settings = json.loads(settings)
                                    
                                    # 获取servers数组
                                    servers_data = settings.get('servers', [])
                                    # 如果servers是字符串，需要解析
                                    if isinstance(servers_data, str):
                                        servers_data = json.loads(servers_data)
                                    
                                    # 确保servers_data是列表
                                    if isinstance(servers_data, list):
                                        for server in servers_data:
                                            # 获取users数组
                                            users = server.get('users', [])
                                            # 如果users是字符串，需要解析
                                            if isinstance(users, str):
                                                users = json.loads(users)
                                            
                                            # 确保至少有一个用户
                                            if users and len(users) > 0:
                                                user = users[0]  # 获取第一个用户
                                                servers.append({
                                                    'address': server.get('address'),
                                                    'port': server.get('port'),
                                                    'user': user.get('user'),
                                                    'pass': user.get('pass'),
                                                    'tag': outbound.get('tag', '')
                                                })
                            except Exception as e:
                                logger.error(f"处理outbound数据时出错: {str(e)}")
                                continue

                        if servers:
                            random.shuffle(servers)
                            panel_servers = servers
            

            # 确保端口不在已使用列表中
            
            used_ports = []
            if new_panel.used_ports:
                used_ports = [int(port) for port in new_panel.used_ports.split(',') if port.strip().isdigit()]
            
            random_port = node.port
            new_host_config['tag']=panel_servers[0].get('tag', '')
            if new_config['protocol'] == 'vless' or new_config['protocol'] == 'shadowsocks' or new_config['protocol'] == 'vmess':
                new_config['settings']['clients'][0]['email'] = new_config['settings']['clients'][0]['email'] + str(random.randint(1000, 9000))
            # 检查端口是否已被使用
            while True:
                if random_port not in used_ports:
                    node.port = random_port
                    new_config['port'] = random_port
                    # 更新used_ports列表
                    used_ports.append(random_port)
                    new_panel.used_ports = ','.join(map(str, used_ports))
                    new_panel.save(update_fields=['used_ports'])
                    break
                else:
                    # 生成新的随机端口
                    random_port = random.randint(1, 65534)
                    
        
        
        # 更新节点host_config
        node.host = new_panel.ip
        node.host_config = json.dumps(new_host_config)
        node.panel_node_id = None  # 清除旧的面板节点ID
        node.status = 'pending'  # 设置为待处理状态
        node.config_text = json.dumps(new_config)
        node.panel_id = new_panel.id
        node.save(update_fields=['host_config','host','panel_id', 'panel_node_id','port', 'status', 'config_text'])
        
        # 异步处理节点迁移
        thread = Thread(target=migrate_node, args=(node, new_panel))
        thread.start()
        
        return Response({
            'code': 200,
            'message': '节点面板修改任务已提交，请稍后查看节点状态',
            'data': None
        })
            
    except Exception as e:
        logger.error(f"修改节点面板失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'处理失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def migrate_node(node, new_panel):
    """
    迁移节点到新面板的异步处理函数
    """
    try:
        print(f"开始迁移节点 {node.id} 到面板 {new_panel.id}")
        
        # 解析节点配置
        form_data = json.loads(node.config_text)
        host_config = json.loads(node.host_config)
        # 构建请求头
        if new_panel.panel_type == 'x-ui':
            url = f"http://{new_panel.ip_address}/xui/inbound/add"
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
            }
            
        else:  # 3x-ui
            url = f"http://{new_panel.ip_address}/panel/api/inbounds/add"
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
            }
        
        # 获取登录cookie
        cookie = get_login_cookie(new_panel, host_config)
        if not cookie:
            logger.error(f"获取面板登录cookie失败")
            node.status = 'inactive'
            node.save(update_fields=['status'])
            return
        
        # 解析config_text为JSON对象
        form_data = json.loads(node.config_text)
        
        # 调整form_data格式，将嵌套对象转为字符串
        nested_fields = ['settings', 'streamSettings', 'sniffing', 'allocate']
        for field in nested_fields:
            if field in form_data and isinstance(form_data[field], (dict, list)):
                # 将对象转为JSON字符串
                form_data[field] = json.dumps(form_data[field])
        
        
        print('==form_data==',form_data)
        response = make_request_with_cookie(new_panel,host_config, url, headers, method='post_params', 
                            data=form_data)
        
        panel_node_id = None
        
        if response.status_code == 200:
            try:
                result = response.json()
                
                if result.get('success', False):
                    logger.info(f"节点 {node.id} 在新面板创建成功")
                    
                    # 获取面板节点ID
                    if new_panel.panel_type == 'x-ui':
                        # 列出所有节点找到匹配的
                        list_url = f"http://{new_panel.ip_address}/xui/inbound/list"
                        list_response = make_request_with_cookie(
                            new_panel,
                            host_config,
                            list_url,
                            headers,
                            method='post'
                        )
                        
                        if list_response.status_code == 200:
                            list_result = list_response.json()
                            if list_result.get('success'):
                                # 获取请求中的端口号
                                request_port = form_data.get('port')
                                if request_port:
                                    # 遍历节点列表查找匹配的端口
                                    for inbound in list_result.get('obj', []):
                                        if str(inbound.get('port')) == str(request_port):
                                            panel_node_id = inbound.get('id')
                                            break
                    else:  # 3x-ui
                        panel_node_id = result.get('obj', {}).get('id')
                        tag = result.get('obj', {}).get('tag')
                        
                        headers = {
                                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                            'host': f'{new_panel.ip_address.split("/")[0]}',
                                            'Accept': 'application/json, text/plain, */*',
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                            'Origin': f'http://{new_panel.ip_address.split("/")[0]}',
                                            'Referer': f'http://{new_panel.ip_address}/panel/'
                                        }
                                        
                                        # 获取xray配置
                        url = f"http://{new_panel.ip_address}/panel/xray/"
                        response = make_request_with_cookie(new_panel, {
                                            'ip': new_panel.ip_address,
                                            'username': new_panel.username,
                                            'password': new_panel.password,
                                            'panel_type': new_panel.panel_type
                                        }, url, headers, method='post')
                        
                        if response.status_code == 200:
                            result = response.json()
                            if result.get('success'):
                                # 获取xray配置
                                xraySetting = json.loads(result.get('obj', {}))
                                # 创建绑定出站规则和路由规则
                                # outbound_rules = 
                                xraySetting['xraySetting']['routing']['rules'].append({
                                    "type": "field",
                                    "outboundTag": host_config.get('tag'),
                                    "inboundTag": [
                                        tag
                                    ]
                                })
                                update_data = {
                                    'xraySetting': json.dumps(xraySetting.get('xraySetting'))
                                }
                                # 发送更新请求
                                update_response = make_request_with_cookie(
                                    new_panel,
                                    host_config,
                                    f"http://{new_panel.ip_address}/panel/xray/update",
                                    {
                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                        'Accept': 'application/json, text/plain, */*',
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                                    },
                                    method='post',
                                    data=update_data
                                )
                                if update_response.status_code == 200:
                                    print(f"更新xray配置成功")
                                else:
                                    print(f"更新xray配置失败: {update_response.text}")

                        url_restart = f"http://{new_panel.ip_address}/server/restartXrayService"
                        response = make_request_with_cookie(new_panel, host_config, url_restart, headers, method='post')
                        if response.json().get('success'):
                            logger.info(f"重启面板 {new_panel.id} 成功")
                        else:
                            response = make_request_with_cookie(new_panel, host_config, url_restart, headers, method='post')
                            logger.error(f"重启面板 {new_panel.id} 失败: {response.text}，重试一次")
                        node.status = 'active'
                        node.panel_node_id = panel_node_id
                        node.save(update_fields=['status', 'panel_node_id'])
                    if node.udp:
                        print('==中转配置==',node.udp_config)
                        try:
                            # 解析 JSON 字符串
                            udp_config_json = json.loads(node.udp_config)
                            print('==旧的中转配置==',node.udp_config)
                            # 获取配置信息
                            udp_zhanghao = udp_config_json.get('config', {})
                            udp_peizhi = udp_config_json.get('udpConfig', {})
                            udp_search_dest_ip = json.loads(udp_peizhi.get('config')).get('dest')[0]
                            udp_peizhi['config'] = json.dumps({
                                            "dest": [f"{new_panel.ip}:{node.port}"]
                                        })
                            node.udp_config = json.dumps(
                                {
                                    'config': udp_zhanghao,
                                    'udpConfig': udp_peizhi
                                }
                            )
                            node.save(update_fields=['udp_config'])
                            
                            print('==新的中转配置==',node.udp_config)
                            # 中转登录
                            transit_account = TransitAccount.objects.get(id=udp_zhanghao.get('id'))
                            auth_token = transit_account.token
                            if not auth_token:
                                print('==未登录，进入登录逻辑==')
                                login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                login_data = {
                                    "username": udp_zhanghao.get('username'),
                                    "password": udp_zhanghao.get('password')
                                }
                                headers_nyanpass = {
                                    "Content-Type": "text/plain;charset=UTF-8",
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                    "Accept": "*/*",
                                    "Origin": settings.API_BASE_URL,
                                }
                                login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                if login_response.status_code == 200:
                                    login_result = login_response.json()
                                    auth_token = login_result.get('data', {})
                                    transit_account.token = auth_token
                                    transit_account.save(update_fields=['token'])
                            try:
                                if auth_token:
                                    # 创建转发
                                    forward_headers = {
                                        "Authorization": f"{auth_token}",
                                        "Content-Type": "application/json"
                                    }
                                    
                                    # 执行中转注册，添加重试机制
                                    retry_count = 0
                                    max_retries = 4  # 最大重试次数，加上首次请求总共尝试2次
                                    forward_success = False

                                    
                                    search_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
                                    search_rules_data = {
                                        "gid": 0,
                                        "gid_in": 0,
                                        "gid_out": 0,
                                        "name": "",
                                        "dest": udp_search_dest_ip,
                                        "listen_port": 0
                                    }
                                    print('==search_rules_data==',search_rules_data)

                                    while retry_count <= max_retries and not forward_success:
                                        search_rules_response = requests.post(
                                            search_rules_url,
                                            headers=forward_headers,
                                            json=search_rules_data
                                        )
                                        print('==search_rules_response==',search_rules_response.json())
                                        print('==search_rules_response.status_code==',search_rules_response.status_code)
                                        print('==search_rules_response.json().get("code")==',search_rules_response.json().get('code'))
                                        if search_rules_response.status_code == 200 and search_rules_response.json().get('code') == 0:
                                            search_rules_data = search_rules_response.json()
                                            if search_rules_data.get('code') == 0 and search_rules_data.get('data'):
                                                pass_data = search_rules_data.get('data')
                                                print("===========pass_data============",pass_data)
                                                for pass_item in pass_data:
                                                    pass_item["config"] = json.dumps({
                                                        "dest": [f"{new_panel.ip}:{node.port}"]
                                                    })
                                                    forward_headers = {
                                                        "Authorization": f"{auth_token}",
                                                        "Content-Type": "application/json"
                                                    }
                                                    print('==pass_item==',pass_item)
                                                    res_change_forward = requests.post(
                                                        f"{settings.API_BASE_URL}/api/v1/user/forward/{pass_item.get('id')}",
                                                        headers=forward_headers,
                                                        json=pass_item
                                                    )
                                                    retry_count_change_forward = 0
                                                    max_retries_change_forward = 4
                                                    forward_success_change_forward = False
                                                    while retry_count_change_forward <= max_retries_change_forward and not forward_success_change_forward:
                                                        if res_change_forward.status_code == 200 and res_change_forward.json().get('code') != 403:
                                                            forward_success_change_forward = True
                                                            break
                                                        elif res_change_forward.status_code == 403 or res_change_forward.json().get('code') == 403:
                                                            retry_count_change_forward+=1
                                                            login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                                            login_data = {
                                                                "username": udp_zhanghao.get('username'),
                                                                "password": udp_zhanghao.get('password')
                                                            }
                                                            headers_nyanpass = {
                                                                "Content-Type": "text/plain;charset=UTF-8",
                                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                                "Accept": "*/*",
                                                                "Origin": settings.API_BASE_URL,
                                                            }
                                                            login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                                            if login_response.status_code == 200:
                                                                login_result = login_response.json()
                                                                auth_token = login_result.get('data', {})
                                                                transit_account.token = auth_token
                                                                transit_account.save(update_fields=['token'])
                                                                forward_headers = {
                                                                    "Authorization": f"{auth_token}",
                                                                    "Content-Type": "application/json"
                                                                }
                                                        else:
                                                            retry_count_change_forward += 1
                                                            if retry_count_change_forward <= max_retries_change_forward:
                                                                time.sleep(random.uniform(3, 7))
                                                                
                                                forward_success = True
                                                break
                                        elif search_rules_response.status_code == 403 or search_rules_response.json().get('code') == 403 or retry_count==3:
                                            print('==search_rules_response登录逻辑==',search_rules_response.status_code)
                                            retry_count += 1
                                            login_url = f"{settings.API_BASE_URL}/api/v1/auth/login"
                                            login_data = {
                                                "username": udp_zhanghao.get('username'),
                                                "password": udp_zhanghao.get('password')
                                            }
                                            headers_nyanpass = {
                                                "Content-Type": "text/plain;charset=UTF-8",
                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                "Accept": "*/*",
                                                "Origin": settings.API_BASE_URL,
                                            }
                                            login_response = requests.post(login_url, json=login_data, headers=headers_nyanpass)
                                            if login_response.status_code == 200:
                                                login_result = login_response.json()
                                                auth_token = login_result.get('data', {})
                                                transit_account.token = auth_token
                                                transit_account.save(update_fields=['token'])
                                                forward_headers = {
                                                        "Authorization": f"{auth_token}",
                                                        "Content-Type": "application/json"
                                                    }
                                        else:
                                            retry_count += 1
                                            if retry_count <= max_retries:
                                                # 随机等待0.5到1秒后重试
                                                wait_time = random.uniform(5, 15)
                                                logger.info(f"UDP转发更新失败，等待{wait_time:.2f}秒后进行第{retry_count+1}次尝试")
                                                time.sleep(wait_time)
                                            else:
                                                logger.error(f"UDP转发更新失败，已重试{max_retries}次仍失败")
                                else:
                                    logger.error(f"中转登录失败: {login_response.text}")
                            
                            except Exception as e:
                                logger.error(f"处理UDP中转配置时出错: {str(e)}")
                        except Exception as e:
                            logger.error(f"处理UDP配置时出错: {str(e)}")
                # 更新节点状态
                    update_single_panel(new_panel)
                    node.status = 'active'
                    node.save()
                    
                    
                else:
                    error_msg = result.get('msg', '未知错误')
                    logger.error(f"创建节点失败: {error_msg}")
                    node.status = 'inactive'
                    node.save(update_fields=['status'])
            except json.JSONDecodeError:
                logger.error(f"解析面板响应失败: {response.text}")
                node.status = 'inactive'
                node.save(update_fields=['status'])
        else:
            logger.error(f"面板返回错误状态码: {response.status_code}, 响应: {response.text}")
            node.status = 'inactive'
            node.save(update_fields=['status'])
        
    except Exception as e:
        logger.error(f"迁移节点 {node.id} 到面板 {new_panel.id} 时出错: {str(e)}")
        node.status = 'inactive'
        node.save(update_fields=['status'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_order_panel(request):
    """
    修改订单下所有节点的面板
    """
    try:
        # 获取请求数据
        order_id = request.data.get('order_id')
        new_panel_id = request.data.get('panel_id')
        print('==order_id==',order_id)
        print('==new_panel_id==',new_panel_id)
        
        if not order_id or not new_panel_id:
            return Response({
                'code': 400,
                'message': '订单ID和面板ID不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 查询订单
        try:
            payment_order = PaymentOrder.objects.get(id=order_id)
        except PaymentOrder.DoesNotExist:
            return Response({
                'code': 404,
                'message': '订单不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 查询新面板
        try:
            new_panel = AgentPanel.objects.get(id=new_panel_id)
            if not new_panel.is_active or not new_panel.is_online:
                return Response({
                    'code': 400,
                    'message': '所选面板不可用',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        except AgentPanel.DoesNotExist:
            return Response({
                'code': 404,
                'message': '面板不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 获取订单下的所有节点
        nodes = NodeInfo.objects.filter(order=payment_order)
        
        if not nodes.exists():
            return Response({
                'code': 404,
                'message': '该订单下没有节点',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        # 创建新的host_config
        new_host_config = {
            'id': new_panel.id,
            'ip': new_panel.ip_address,
            'username': new_panel.username,
            'password': new_panel.password,
            'panel_type': new_panel.panel_type,
            'tag': '',
        }
        # 准备节点迁移
        server_index = 0
        for node in nodes:
            
            new_config = json.loads(node.config_text)
            if new_panel.panel_type == 'x-ui':
                if node.protocol == 'vless' or node.protocol == 'Vless':
                    url_version = f"http://{new_panel.ip_address}/server/status"
                    headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
                    }
                    response_version = make_request_with_cookie(
                                new_panel, 
                                new_host_config, 
                                url_version, 
                                headers, 
                                method='post', 
                                data=None
                            )
                    # 获取系统版本
                    # 添加状态码检查
                    if response_version.status_code != 200:
                        logger.error(f"面板 {new_panel.id} 版本检查失败，状态码: {response_version.status_code}")
                        new_panel.is_online = False
                        new_panel.save()
                        continue
                    print('==获取系统版本6639==',response_version.text)
                    version = response_version.json().get('obj').get('xray').get('version')
                    if version == '25.3.6':
                        new_config['settings']['clients'][0]['flow'] = ""
                    else:
                        new_config['settings']['clients'][0]['flow'] = "xtls-rprx-direct"
                        
                    print('==处理后的配置==',new_config)
                # 确保端口不在已使用列表中
                used_ports = []
                if new_panel.used_ports:
                    used_ports = [int(port) for port in new_panel.used_ports.split(',') if port.strip().isdigit()]
                
                random_port = node.port
                # 检查端口是否已被使用
                while True:
                    if random_port not in used_ports:
                        node.port = random_port
                        new_config['port'] = random_port
                        # 更新used_ports列表
                        used_ports.append(random_port)
                        new_panel.used_ports = ','.join(map(str, used_ports))
                        new_panel.save(update_fields=['used_ports'])
                        break
                    else:
                        print('==端口已存在==')
                        # 生成新的随机端口
                        random_port = random.randint(1, 65534)
                        
                if not new_panel.cookie:
                    cookie = get_login_cookie(new_panel, new_host_config)
                    if not cookie:
                        logger.error(f"无法获取面板 {new_panel.id} 的cookie")
                        
            else:
                headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'host': f'{new_panel.ip_address.split("/")[0]}',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                        'Origin': f'http://{new_panel.ip_address.split("/")[0]}',
                        'Referer': f'http://{new_panel.ip_address}/panel/'
                    }
                url = f"http://{new_panel.ip_address}/panel/xray/"
                response = make_request_with_cookie(new_panel, {
                        'ip': new_panel.ip_address,
                        'username': new_panel.username,
                        'password': new_panel.password,
                        'panel_type': new_panel.panel_type
                    }, url, headers, method='post')
                if response.status_code == 200:
                        result = response.json()
                        if result.get('success'):
                            xray_setting = json.loads(result['obj'])['xraySetting']
                            servers = []
                            # 提取所有可用的servers节点
                            for outbound in xray_setting.get('outbounds', []):
                                try:
                                    if outbound.get('protocol') == 'socks':
                                        settings = outbound.get('settings', {})
                                        # 检查settings是否是字符串，如果是则需要解析
                                        if isinstance(settings, str):
                                            settings = json.loads(settings)
                                        
                                        # 获取servers数组
                                        servers_data = settings.get('servers', [])
                                        # 如果servers是字符串，需要解析
                                        if isinstance(servers_data, str):
                                            servers_data = json.loads(servers_data)
                                        
                                        # 确保servers_data是列表
                                        if isinstance(servers_data, list):
                                            for server in servers_data:
                                                # 获取users数组
                                                users = server.get('users', [])
                                                # 如果users是字符串，需要解析
                                                if isinstance(users, str):
                                                    users = json.loads(users)
                                                
                                                # 确保至少有一个用户
                                                if users and len(users) > 0:
                                                    user = users[0]  # 获取第一个用户
                                                    servers.append({
                                                        'address': server.get('address'),
                                                        'port': server.get('port'),
                                                        'user': user.get('user'),
                                                        'pass': user.get('pass'),
                                                        'tag': outbound.get('tag', '')
                                                    })
                                except Exception as e:
                                    logger.error(f"处理outbound数据时出错: {str(e)}")
                                    continue

                            if servers:
                                random.shuffle(servers)
                                panel_servers = servers
                

                # 确保端口不在已使用列表中
                used_ports = []
                if new_panel.used_ports:
                    used_ports = [int(port) for port in new_panel.used_ports.split(',') if port.strip().isdigit()]
                
                random_port = node.port
                
                new_host_config['tag']=panel_servers[server_index].get('tag', '')
                server_index = (server_index + 1) % len(panel_servers)
                if new_config['protocol'] == 'vless' or new_config['protocol'] == 'shadowsocks' or new_config['protocol'] == 'vmess':
                    new_config['settings']['clients'][0]['email'] = new_config['settings']['clients'][0]['email'] + str(random.randint(1000, 9000))
                # 检查端口是否已被使用
                while True:
                    if random_port not in used_ports:
                        node.port = random_port
                        new_config['port'] = random_port
                        # 更新used_ports列表
                        used_ports.append(random_port)
                        new_panel.used_ports = ','.join(map(str, used_ports))
                        new_panel.save(update_fields=['used_ports'])
                        break
                    else:
                        # 生成新的随机端口
                        random_port = random.randint(1, 65534)
                        
                
            
            
            # 更新节点host_config
            node.host = new_panel.ip
            node.host_config = json.dumps(new_host_config)
            node.panel_node_id = None  # 清除旧的面板节点ID
            node.status = 'pending'  # 设置为待处理状态
            node.config_text = json.dumps(new_config)
            node.panel_id = new_panel.id
            node.save(update_fields=['host_config','host', 'panel_id','panel_node_id','port', 'status', 'config_text'])
            
            # 异步处理节点迁移
            thread = Thread(target=migrate_node, args=(node, new_panel))
            thread.start()
            
        
        payment_order.country = new_panel.country
        param_old = json.loads(payment_order.param)
        param_old['country'] = new_panel.country
        payment_order.param = json.dumps(param_old)
        payment_order.save(update_fields=['country', 'param'])
        return Response({
            'code': 200,
            'message': '订单节点迁移任务已提交，请稍后查看节点状态',
            'data': {
                'order_id': payment_order.id,
                'nodes_count': nodes.count(),
                'new_panel_id': new_panel.id,
                'new_panel_ip': new_panel.ip_address
            }
        })
            
    except Exception as e:
        logger.error(f"修改订单内节点失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'处理失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_balance(request):
    """获取当前用户的余额信息"""
    try:
        user = request.user
        
        return Response({
            'code': 200,
            'message': '获取余额成功',
            'data': {
                'balance': float(user.balance)
            }
        })
        
    except Exception as e:
        logger.error(f"获取余额失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'获取余额失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateUserPricingView(APIView):
    """修改用户独立定价"""
    permission_classes = [IsAuthenticated, IsAgentL2]  # 只允许二级代理访问
    
    def post(self, request):
        try:
            # 获取请求数据
            data = request.data
            user_id = data.get('userid')
            user_prices = data.get('user_prices')
            
            # 验证必要参数
            if not user_id or not user_prices:
                return Response({
                    'code': 400,
                    'message': '缺少必要参数',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 查找用户
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '未找到指定用户',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 验证用户是否属于当前代理
            if user.parent != request.user:
                return Response({
                    'code': 403,
                    'message': '无权修改此用户的价格',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 定义价格字段映射
            price_fields = {
                'normal': {
                    'monthly': 'custom_normal_monthly_price',
                    'quarterly': 'custom_normal_quarterly_price',
                    'half_yearly': 'custom_normal_half_yearly_price',
                    'yearly': 'custom_normal_yearly_price'
                },
                'live': {
                    'monthly': 'custom_live_monthly_price',
                    'quarterly': 'custom_live_quarterly_price',
                    'half_yearly': 'custom_live_half_yearly_price',
                    'yearly': 'custom_live_yearly_price'
                },
                'transit': {
                    'monthly': 'custom_transit_monthly_price',
                    'quarterly': 'custom_transit_quarterly_price',
                    'half_yearly': 'custom_transit_half_yearly_price',
                    'yearly': 'custom_transit_yearly_price'
                }
            }
            
            # 更新字段
            update_fields = []
            for node_type, periods in user_prices.items():
                if node_type not in price_fields:
                    continue
                    
                for period, value in periods.items():
                    if period not in price_fields[node_type]:
                        continue
                        
                    field_name = price_fields[node_type][period]
                    if value is not None:
                        try:
                            # 转换为Decimal类型
                            decimal_value = Decimal(str(value))
                            # 获取代理的对应价格字段
                            agent_field_name = field_name.replace('custom_', '')
                            agent_price = getattr(request.user, agent_field_name)
                            
                            # 验证价格不能低于代理价格
                            if decimal_value < agent_price:
                                continue
                                
                            setattr(user, field_name, decimal_value)
                            update_fields.append(field_name)
                        except (ValueError, TypeError, InvalidOperation):
                            continue
                    else:
                        # 如果值为null，设置为0
                        setattr(user, field_name, Decimal('0'))
                        update_fields.append(field_name)
            
            # 保存更新
            if update_fields:
                user.save(update_fields=update_fields)
                
            return Response({
                'code': 200,
                'message': '更新用户价格成功',
                'data': None
            })
            
        except Exception as e:
            logger.error(f"更新用户价格失败: {str(e)}")
            return Response({
                'code': 500,
                'message': '更新失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def node_renewal(request):
    """节点续费接口"""
    try:
        # 获取节点ID
        node_id = request.data.get('node_id')
        if not node_id:
            return Response({
                'code': 400,
                'message': '节点ID不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 获取节点信息
        try:
            node = NodeInfo.objects.select_related('order', 'user').get(
                id=node_id,
                user=request.user  # 确保只能续费自己的节点
            )
            
            # 创建节点
            node_data = {
                'user': request.user,
                'remark': node.remark,
                'remark_custom': node.remark_custom,
                'protocol': node.protocol,
                'host_config': node.host_config,
                'host': node.host,
                'port': node.port,
                'uuid': node.uuid,
                'node_user': node.node_user,
                'node_password': node.node_password,
                'panel_id': node.panel_id,
                'panel_node_id': node.panel_node_id,
                'status': node.status,
                'expiry_time': node.expiry_time,
                'config_text': node.config_text,
                'udp': node.udp,
                'udp_config': node.udp_config,
                'udp_host': node.udp_host,
            }
            
        except NodeInfo.DoesNotExist:
            return Response({
                'code': 404,
                'message': '节点不存在或无权访问',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
            
        # 获取原始订单信息
        original_order = node.order
        
        
        # 解析host_config获取面板信息
        try:
            import json
            host_config = json.loads(node.host_config)
            panel_type = host_config.get('panel_type', '')  # x-ui 或 3x-ui
            panel_id = host_config.get('id')
            # 解析节点配置
            form_data = json.loads(node.config_text)
            
            # 获取面板详细信息
            print(f'panel_id: {panel_id}')
            
            panel = None
            if panel_id:
                try:
                    panel = AgentPanel.objects.get(id=panel_id)
                except AgentPanel.DoesNotExist:
                    logger.warning(f"面板不存在: panel_id={panel_id}")
        except json.JSONDecodeError:
            logger.error(f"解析host_config失败: {node.host_config}")
            panel = None
            panel_type = ''
        

        original_param = json.loads(original_order.param)  # 'normal' 或 'live' 或 'transit'
        node_type =original_param.get('nodeType', '').lower()  # 'normal' 或 'live' 或 'transit'
        period = original_param.get("period", '').lower()  # 'monthly', 'quarterly', 'half_yearly', 'yearly'
        field_name =''
        user = request.user
        days = 0
        # 根据节点类型和付费周期获取对应的价格
        if node_type == 'normal':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'normal_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'normal_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'normal_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'normal_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'live':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'live_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'live_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'live_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'live_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'transit':
            # 获取中转节点价格
            if period == 'monthly':
                field_name = 'transit_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'transit_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'transit_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'transit_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'code': 400,
                'message': f'无效的节点类型: {node_type}',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        # 获取价格（优先使用自定义价格）

        referer_domain = ''
        requesting_domain = request.META.get('HTTP_HOST', '')
        origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
        referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
        if referer and '://' in referer:
            referer_parts = referer.split('://', 1)[1]
            if '/' in referer_parts:
                referer_domain = referer_parts.split('/', 1)[0]
            else:
                referer_domain = referer_parts
        
        # 尝试从HTTP_ORIGIN中提取域名
        origin_domain = ''
        if origin and '://' in origin:
            origin_domain = origin.split('://', 1)[1]
        
        
        # 使用多种方法尝试获取源地址
        source_domain = referer_domain or origin_domain or requesting_domain
            
        # 计算价格和过期时间
        money = 0
        expiry_time = 0
        now = timezone.now()  # 获取当前时间

        matched_agent = None
        agents = User.objects.filter(user_type='agent_l2')
        
        for agent in agents:
            if agent.domain and source_domain.endswith(agent.domain):
                matched_agent = agent
                break
        
        if not matched_agent:
            return Response({
                'code': 404,
                'message': '未找到匹配的代理',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)

        money = get_price_or_parent(matched_agent, field_name, user)
        expiry_time = int((node.expiry_time + timedelta(days=days)).timestamp() * 1000)  # 转换为毫秒级时间戳
        order_no = f"{timezone.now().strftime('%Y%m%d')}{int(timezone.now().timestamp())}{random.randint(100000, 999999)}"

        form_data['expiryTime'] = expiry_time
        node_data['expiry_time'] =datetime.fromtimestamp(expiry_time/1000)
        print('==node_data==',node_data)
        if node_data['udp']:
            new_udp_config = json.loads(node_data['udp_config'])
            new_udp_config['udpConfig']['name'] = f"{original_order.country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
            print('==new_udp_config-udpConfig-name==',new_udp_config['udpConfig']['name'])
            node_data['udp_config'] = json.dumps(new_udp_config)
        print('==form_data==',expiry_time)
        node_data['config_text'] = json.dumps(form_data)
        user_balance = user.balance
        if user_balance < money:
            return Response({
                'code': 400,
                'message': '余额不足',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        # 扣除用户余额
        user.balance -= Decimal(str(money))
        user.save(update_fields=['balance'])
        if user.user_type == 'customer' and user.parent:
            try:
                agent = user.parent
                agent.balance -= Decimal(str(money))
                agent.save(update_fields=['balance'])
                logger.info(f"从代理 {agent.username} 的余额中扣除 {money} 元，当前余额: {agent.balance}")
            except Exception as e:
                logger.error(f"扣除代理余额时出错: {str(e)}")
        
        remark = f"单节点续费-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        node_data['remark'] = remark
        payment_order = PaymentOrder(
                    user=request.user,
                    out_trade_no=order_no,
                    trade_no=order_no,
                    payment_type='balance',
                    product_name= original_order.product_name,
                    amount=Decimal(money),
                    status='pending',
                    param=original_order.param,
                    country=original_order.country,
                    node_count=1,
                    node_protocol= original_order.node_protocol
                )
        payment_order.save()
        node_info = NodeInfo(
                    order=payment_order,
                    **node_data
        )
        node_info.save()
        
        
        nodes = NodeInfo.objects.filter(order=payment_order.id)
        # 异步处理节点创建
        thread = Thread(target=process_node_creation_time, args=(nodes))
        thread.start()
        # 更新订单状态
        payment_order.status = 'success'
        payment_order.is_processed = True
        payment_order.save()

        return Response({
            'code': 200,
            'money': money,
            'message': f'支付成功，本次扣费{money}元，等待1-2分钟后，到节点列表查看创建状态，如状态与预期不符，建议联系客服处理'.format(money),
            'data': {}
        })
            
    except Exception as e:
        logger.error(f"节点续费失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'节点续费失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_renewal(request):
    """订单续费接口"""
    try:
        # 获取节点ID
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({
                'code': 400,
                'message': '订单ID不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 获取节点信息
        try:
            node_list = NodeInfo.objects.filter(
                order_id=order_id,
                user=request.user  # 确保只能续费自己的节点
            )
            print(node_list)
            order = PaymentOrder.objects.get(id=order_id)
            print(order)
            
            
            
        except NodeInfo.DoesNotExist:
            return Response({
                'code': 404,
                'message': '节点不存在或无权访问',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
            

        original_param = json.loads(order.param)  # 'normal' 或 'live' 或 'transit'
        node_type =original_param.get('nodeType', '').lower()  # 'normal' 或 'live' 或 'transit'
        period = original_param.get("period", '').lower()  # 'monthly', 'quarterly', 'half_yearly', 'yearly'
        field_name =''
        user = request.user
        days = 0
        # 根据节点类型和付费周期获取对应的价格
        if node_type == 'normal':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'normal_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'normal_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'normal_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'normal_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'live':
            # 先检查是否有自定义价格，如果没有则使用普通价格
            if period == 'monthly':
                field_name = 'live_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'live_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'live_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'live_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        elif node_type == 'transit':
            # 获取中转节点价格
            if period == 'monthly':
                field_name = 'transit_monthly_price'
                days = 30
            elif period == 'quarterly':
                field_name = 'transit_quarterly_price'
                days = 90
            elif period == 'half_yearly':
                field_name = 'transit_half_yearly_price'
                days = 180
            elif period == 'yearly':
                field_name = 'transit_yearly_price'
                days = 365
            else:
                return Response({
                    'code': 400,
                    'message': f'无效的付费周期: {period}',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'code': 400,
                'message': f'无效的节点类型: {node_type}',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取价格（优先使用自定义价格）

        referer_domain = ''
        requesting_domain = request.META.get('HTTP_HOST', '')
        origin = request.META.get('HTTP_ORIGIN', '')    # 获取请求的源域名
        referer = request.META.get('HTTP_REFERER', '')  # 获取请求的来源URL
        if referer and '://' in referer:
            referer_parts = referer.split('://', 1)[1]
            if '/' in referer_parts:
                referer_domain = referer_parts.split('/', 1)[0]
            else:
                referer_domain = referer_parts
        
        # 尝试从HTTP_ORIGIN中提取域名
        origin_domain = ''
        if origin and '://' in origin:
            origin_domain = origin.split('://', 1)[1]
        
        
        # 使用多种方法尝试获取源地址
        source_domain = referer_domain or origin_domain or requesting_domain
            
        # 计算价格和过期时间
        money = 0
        expiry_time = 0
        now = timezone.now()  # 获取当前时间

        matched_agent = None
        agents = User.objects.filter(user_type='agent_l2')
        
        for agent in agents:
            if agent.domain and source_domain.endswith(agent.domain):
                matched_agent = agent
                break
        
        if not matched_agent:
            return Response({
                'code': 404,
                'message': '未找到匹配的代理',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)

        money = get_price_or_parent(matched_agent, field_name, user)
        money = money * order.node_count
        
        expiry_time = int((now + timedelta(days=days)).timestamp() * 1000)  # 转换为毫秒级时间戳

        
        user_balance = user.balance
        if user_balance < money:
            return Response({
                'code': 400,
                'message': '余额不足',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        # 扣除用户余额
        user.balance -= Decimal(str(money))
        user.save(update_fields=['balance'])
        if user.user_type == 'customer' and user.parent:
            try:
                agent = user.parent
                agent.balance -= Decimal(str(money))
                agent.save(update_fields=['balance'])
                logger.info(f"从代理 {agent.username} 的余额中扣除 {money} 元，当前余额: {agent.balance}")
            except Exception as e:
                logger.error(f"扣除代理余额时出错: {str(e)}")
        order_no = f"{timezone.now().strftime('%Y%m%d')}{int(timezone.now().timestamp())}{random.randint(100000, 999999)}"
        remark = f"订单续费-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        payment_order = PaymentOrder(
                    user=request.user,
                    out_trade_no=order_no,
                    trade_no=order_no,
                    payment_type='balance',
                    product_name= order.product_name,
                    amount=Decimal(money),
                    status='pending',
                    param=order.param,
                    country=order.country,
                    node_count=order.node_count,
                    node_protocol= order.node_protocol
                )
        payment_order.save()
        
        
        for node in node_list:
            # 创建节点
            expiry_time = int((node.expiry_time + timedelta(days=days)).timestamp() * 1000)  # 转换为毫秒级时间戳
            node_data = {
                'user': request.user,
                'remark': node.remark,
                'remark_custom': node.remark_custom,
                'protocol': node.protocol,
                'host_config': node.host_config,
                'host': node.host,
                'port': node.port,
                'uuid': node.uuid,
                'node_user': node.node_user,
                'node_password': node.node_password,
                'panel_id': node.panel_id,
                'panel_node_id': node.panel_node_id,
                'status': node.status,
                'expiry_time': expiry_time,
                'config_text': node.config_text,
                'udp': node.udp,
                'udp_config': node.udp_config,
                'udp_host': node.udp_host,
            }
            node_data['remark'] = remark
            print(node_data)
            host_config = json.loads(node.host_config)
            panel_type = host_config.get('panel_type', '')  # x-ui 或 3x-ui
            panel_id = host_config.get('id')
            form_data = json.loads(node.config_text)
            form_data['expiryTime'] = expiry_time
            panel = None
            if panel_id:
                try:
                    panel = AgentPanel.objects.get(id=panel_id)
                except AgentPanel.DoesNotExist:
                    logger.warning(f"面板不存在: panel_id={panel_id}")
            node_data['expiry_time'] =datetime.fromtimestamp(expiry_time/1000)
            if node_data['udp']:
                new_udp_config = json.loads(node_data['udp_config'])
                new_udp_config['udpConfig']['name'] = f"{order.country}-{datetime.fromtimestamp(expiry_time / 1000).strftime('%Y/%m/%d')}-{order_no}"
                print('==new_udp_config-udpConfig-name==',new_udp_config['udpConfig']['name'])
                node_data['udp_config'] = json.dumps(new_udp_config)
        
            node_data['config_text'] = json.dumps(form_data)
            node_info = NodeInfo(
                        order=payment_order,
                        **node_data
            )
            node_info.save()
        
        
        
        nodes_new = NodeInfo.objects.filter(order=payment_order.id)
        for nodes_n_new in nodes_new:
            # 异步处理节点创建
            thread = Thread(target=process_node_creation_time, args=(nodes_n_new,))
        thread.start()
        # 更新订单状态
        payment_order.status = 'success'
        payment_order.is_processed = True
        payment_order.save()

        return Response({
            'code': 200,
            'money': money,
            'message': f'支付成功，本次扣费{money}元，等待1-2分钟后，到节点列表查看创建状态，如状态与预期不符，建议联系客服处理'.format(money),
            'data': {}
        })
            
    except Exception as e:
        logger.error(f"节点续费失败: {str(e)}")
        return Response({
            'code': 500,
            'message': f'节点续费失败: {str(e)}',
            'data': None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


def update_single_panel(panel):
        """更新单个面板的节点数量和状态"""
        result = {
            'panel_id': panel.id,
            'panel_ip': panel.ip_address,
            'success': False,
            'error': None
        }
        
        try:
            # 设置单个面板处理的参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                get_login_cookie(panel, panel_info)
            
            # 构建请求头和URL
            if panel_info['panel_type'] == 'x-ui':
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip']}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip']}',
                    'x-requested-with': 'XMLHttpRequest',
                    'Referer': f'http://{panel_info['ip']}/xui/inbounds'
                }
                url = f"http://{panel_info['ip']}/xui/inbound/list"
            else:
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/panel/inbounds'
                }
                url = f"http://{panel_info['ip']}/panel/inbound/list"

            # 发送请求获取节点列表，设置较短的超时时间
            try:
                response = make_request_with_cookie(panel, panel_info, url, headers, method='post')
                
                # 尝试解析响应
                try:
                    result_json = response.json()
                    if not result_json.get('success', False):
                        # 请求成功但返回失败状态
                        panel.is_online = False
                        panel.save(update_fields=['is_online'])
                        result['error'] = f"获取节点列表失败: {result_json.get('msg', '未知错误')}"
                        return result
                    
                    nodes_data = result_json.get('obj', [])
                    
                    # 收集已使用的端口
                    used_ports = []
                    for node in nodes_data:
                        # 根据面板类型提取端口
                        if panel_info['panel_type'] == 'x-ui':
                            port = node.get('port')
                            if port:
                                used_ports.append(str(port))
                        elif panel_info['panel_type'] == '3x-ui':
                            port = node.get('port')
                            if port:
                                used_ports.append(str(port))
                    
                    # 更新节点数量、在线状态和已使用端口
                    panel.nodes_count = len(nodes_data)
                    panel.is_online = True  # 成功获取节点列表，设置为在线
                    panel.used_ports = ','.join(used_ports)  # 使用逗号分隔的端口列表
                    print(f"更新面板状态: {panel.id} {panel.nodes_count} {panel.is_online} {panel.used_ports}")
                    panel.save(update_fields=['nodes_count', 'is_online', 'used_ports'])
                    
                    result['success'] = True
                    return result
                    
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    result['error'] = f"解析节点列表响应失败: {str(json_error)}"
                    return result
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                result['error'] = f"请求节点列表失败: {str(req_error)}"
                return result
        
        except Exception as e:
            # 更新节点列表失败，将面板状态设置为离线
            try:
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as save_error:
                print(f"保存面板状态失败: {str(save_error)}")
            
            result['error'] = str(e)
            return result
