from datetime import datetime
from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, BasePermission
from django.db.models import Q
from django.conf import settings
import requests
import json
import logging

class IsAdminOrAgentL2(BasePermission):
    """
    自定义权限类：允许管理员或二级代理访问
    """
    def has_permission(self, request, view):
        # 检查用户是否已认证
        if not request.user or not request.user.is_authenticated:
            return False
            
        # 允许管理员访问
        if request.user.is_staff:
            return True
            
        # 如果是以下方法，允许二级代理访问
        if view.action in ['order_endpoints', 'save_transit', 'endpoints_user', 'save_domain', 'domain_list', 'delete_domain']:
            return request.user.user_type == 'agent_l2'
            
        # 其他情况只允许管理员访问
        return request.user.is_staff

from .models import TransitAccount, TransitDomain
from .serializers import (
    TransitAccountSerializer, 
    TransitAccountCreateSerializer,
    TransitAccountUpdateSerializer,
    TransitDomainSerializer,
    TransitDomainCreateSerializer,
    TransitDomainUpdateSerializer
)
from users.models import PaymentOrder, User, NodeInfo

# 配置日志
logger = logging.getLogger(__name__)

def login_transit_account(username, password):
    """
    登录中转账号获取token
    """
    try:
        url = f"{settings.API_BASE_URL}/api/v1/auth/login"
        payload = {
            "username": username,
            "password": password
        }
        response = requests.post(url, json=payload)
        response_data = response.json()
        
        if response_data.get("code") == 0 and response_data.get("data"):
            return response_data["data"]  # 返回token
        else:
            logger.error(f"登录失败: {response_data}")
            return None
    except Exception as e:
        logger.error(f"登录请求异常: {str(e)}")
        return None

def get_transit_info(token):
    """
    获取中转账号信息和规则数据
    """
    try:
        # 获取用户信息
        user_info_url = f"{settings.API_BASE_URL}/api/v1/user/info"
        headers = {
            "authorization": token
        }
        
        user_response = requests.get(user_info_url, headers=headers)
        user_data = user_response.json()
        
        if user_data.get("code") != 0:
            logger.error(f"获取用户信息失败: {user_data}")
            return None
            
        # 获取转发规则信息
        rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward?page=1&size=10"
        rules_response = requests.get(rules_url, headers=headers)
        rules_data = rules_response.json()
        
        if rules_data.get("code") != 0:
            logger.error(f"获取规则信息失败: {rules_data}")
            return None
            
        # 处理数据
        user_info = user_data.get("data", {})
        rules_count = rules_data.get("count", 0)
        
        # 组装需要的数据
        result = {
            "balance": user_info.get("balance", "0"),
            "traffic": {
                "used": user_info.get("traffic_used", 0),
                "total": user_info.get("traffic_enable", 0)
            },
            "rules": {
                "used": rules_count,
                "max": user_info.get("max_rules", 10)
            }
        }
            

        return result
    except Exception as e:
        logger.error(f"获取中转信息异常: {str(e)}")
        return None

class TransitAccountViewSet(viewsets.ModelViewSet):
    """中转账号视图集"""
    queryset = TransitAccount.objects.all()
    serializer_class = TransitAccountSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgentL2]  # 允许管理员和二级代理访问特定接口
    
    def get_serializer_class(self):
        """根据操作类型选择不同的序列化器"""
        if self.action == 'create':
            return TransitAccountCreateSerializer
        elif self.action in ['update_inbound', 'update_outbound']:
            return TransitAccountUpdateSerializer
        return TransitAccountSerializer
    
    def list(self, request, *args, **kwargs):
        """列出中转账号（分页查询）"""
        # 获取查询参数
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 10)
        search = request.query_params.get('search', None)
        status_filter = request.query_params.get('status', None)
        
        # 转换参数
        try:
            page = int(page)
            page_size = int(page_size)
        except (TypeError, ValueError):
            page = 1
            page_size = 10
            
        # 构建查询条件
        queryset = self.get_queryset()
        
        if search:
            queryset = queryset.filter(username__icontains=search)
            
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        # 分页
        start = (page - 1) * page_size
        end = page * page_size
        total_count = queryset.count()
        queryset = queryset[start:end]
        
        # 序列化
        serializer = self.get_serializer(queryset, many=True)
        
        # 返回数据
        return Response({
            'code': 200,
            'message': '获取中转账号列表成功',
            'data': {
                'total': total_count,
                'page': page,
                'page_size': page_size,
                'results': serializer.data
            }
        })
    
    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """测试连接接口"""
        username = request.data.get('username')
        password = request.data.get('password')
        
        # 验证必要参数
        if not username or not password:
            return Response({
                'code': 400,
                'message': '账号和密码不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 尝试登录
        token = login_transit_account(username, password)
        if token:
            # 登录成功，获取账号信息
            transit_info = get_transit_info(token)
            
            return Response({
                'code': 200,
                'message': '测试连接成功',
                'data': {
                    'token': token,
                    'info': transit_info
                }
            })
        else:
            # 登录失败
            return Response({
                'code': 400,
                'message': '连接失败，请检查账号密码',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
    def create(self, request, *args, **kwargs):
        """创建中转账号"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 提取用户名和密码
        username = serializer.validated_data.get('username')
        password = serializer.validated_data.get('password')
        
        # 检查数据库中是否已存在该账号
        if TransitAccount.objects.filter(username=username).exists():
            return Response({
                'code': 400,
                'message': f'该中转账号({username})已经存在，请添加其他账号',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 登录获取token
        token = login_transit_account(username, password)
        if not token:
            return Response({
                'code': 400,
                'message': '登录中转账号失败，请检查账号密码',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 保存账号和token
        account = serializer.save(token=token)
        
        # 获取账号信息并更新
        transit_info = get_transit_info(token)
        if transit_info:
            # 更新账号信息
            account.balance = transit_info.get('balance', 0)
            account.traffic = json.dumps(transit_info.get('traffic', {"used": 0, "total": 0}))
            account.rules = json.dumps(transit_info.get('rules', {"used": 0, "max": 10}))
            
            # 更新默认入口和出口
            if transit_info.get('default_inbound'):
                account.default_inbound = transit_info.get('default_inbound')
            if transit_info.get('default_outbound'):
                account.default_outbound = transit_info.get('default_outbound')
                
            account.save()
        
        # 创建成功后，返回完整的账号信息
        full_serializer = TransitAccountSerializer(account)
        
        return Response({
            'code': 200,
            'message': '创建中转账号成功',
            'data': full_serializer.data
        })
    
    def retrieve(self, request, *args, **kwargs):
        """获取单个中转账号详情"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'code': 200,
            'message': '获取中转账号详情成功',
            'data': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def refresh_info(self, request, pk=None):
        """刷新账号信息"""
        instance = self.get_object()
        
        # 先尝试使用已有token获取信息
        transit_info = get_transit_info(instance.token)
        
        # 如果token失效，重新登录获取token
        if not transit_info:
            token = login_transit_account(instance.username, instance.password)
            if not token:
                return Response({
                    'code': 400,
                    'message': '刷新账号信息失败，登录失败',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
                
            # 更新token
            instance.token = token
            instance.save(update_fields=['token'])
            
            # 重新获取账号信息
            transit_info = get_transit_info(token)
            
        if transit_info:
            # 更新账号信息
            instance.balance = transit_info.get('balance', 0)
            instance.traffic = json.dumps(transit_info.get('traffic', {"used": 0, "total": 0}))
            instance.rules = json.dumps(transit_info.get('rules', {"used": 0, "max": 10}))
        
                
            instance.save()
            
            # 返回更新后的数据
            serializer = self.get_serializer(instance)
            return Response({
                'code': 200,
                'message': '刷新账号信息成功',
                'data': serializer.data
            })
        else:
            return Response({
                'code': 400,
                'message': '获取账号信息失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def update_endpoints(self, request, pk=None):
        """更新默认入口和出口"""
        instance = self.get_object()
        
        # 获取入口和出口数据
        default_inbound = request.data.get('default_inbound')
        default_outbound = request.data.get('default_outbound')
        
        # 记录需要更新的字段
        update_fields = ['updated_at']
        
        # 更新默认入口
        if default_inbound is not None:
            instance.default_inbound = default_inbound
            update_fields.append('default_inbound')
        
        # 更新默认出口
        if default_outbound is not None:
            instance.default_outbound = default_outbound
            update_fields.append('default_outbound')
        
        # 保存更新
        instance.save(update_fields=update_fields)
        
        # 返回更新后的完整数据
        full_serializer = TransitAccountSerializer(instance)
        return Response({
            'code': 200,
            'message': '更新默认出入口成功',
            'data': full_serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """停用中转账号"""
        instance = self.get_object()
        instance.status = 'inactive'
        instance.save(update_fields=['status', 'updated_at'])
        
        serializer = self.get_serializer(instance)
        return Response({
            'code': 200,
            'message': '停用中转账号成功',
            'data': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """启用中转账号"""
        instance = self.get_object()
        instance.status = 'active'
        instance.save(update_fields=['status', 'updated_at'])
        
        serializer = self.get_serializer(instance)
        return Response({
            'code': 200,
            'message': '启用中转账号成功',
            'data': serializer.data
        })
    
    def destroy(self, request, *args, **kwargs):
        """删除中转账号（直接从数据库删除）"""
        instance = self.get_object()
        
        # 获取账号信息用于记录
        account_id = instance.id
        username = instance.username
        
        # 直接从数据库删除
        instance.delete()
        
        # 记录删除操作
        logger.info(f"中转账号已删除: ID={account_id}, Username={username}")
        
        return Response({
            'code': 200,
            'message': '删除中转账号成功',
            'data': None
        })
    
    @action(detail=False, methods=['post'])
    def refresh_all(self, request):
        """刷新所有中转账号信息"""
        # 获取所有活跃的中转账号
        accounts = TransitAccount.objects.filter(status='active')
        
        if not accounts.exists():
            return Response({
                'code': 200,
                'message': '没有活跃的中转账号需要刷新',
                'data': None
            })
        
        # 统计刷新结果
        success_count = 0
        failed_count = 0
        failed_accounts = []
        
        # 遍历所有账号进行刷新
        for account in accounts:
            # 尝试使用已有token获取信息
            transit_info = get_transit_info(account.token)
            
            # 如果token失效，重新登录获取token
            if not transit_info:
                token = login_transit_account(account.username, account.password)
                if not token:
                    failed_count += 1
                    failed_accounts.append({
                        'id': account.id,
                        'username': account.username,
                        'reason': '登录失败'
                    })
                    continue
                    
                # 更新token
                account.token = token
                
                # 重新获取账号信息
                transit_info = get_transit_info(token)
                
            if transit_info:
                # 更新账号信息
                account.balance = transit_info.get('balance', 0)
                account.traffic = json.dumps(transit_info.get('traffic', {"used": 0, "total": 0}))
                account.rules = json.dumps(transit_info.get('rules', {"used": 0, "max": 10}))
                
                # 如果有默认入口和出口，也更新
                if transit_info.get('default_inbound'):
                    account.default_inbound = transit_info.get('default_inbound')
                if transit_info.get('default_outbound'):
                    account.default_outbound = transit_info.get('default_outbound')
                    
                account.save()
                success_count += 1
            else:
                failed_count += 1
                failed_accounts.append({
                    'id': account.id,
                    'username': account.username,
                    'reason': '获取信息失败'
                })
        
        # 返回刷新结果
        return Response({
            'code': 200,
            'message': f'刷新完成，成功: {success_count}，失败: {failed_count}',
            'data': {
                'total': accounts.count(),
                'success': success_count,
                'failed': failed_count,
                'failed_accounts': failed_accounts
            }
        })
    
    @action(detail=False, methods=['get'])
    def endpoints(self, request):
        """获取所有出入口"""
        # 获取查询参数
        account_id = request.query_params.get('account_id')
        
        # 验证account_id是必传参数
        if not account_id:
            return Response({
                'code': 400,
                'message': 'account_id是必传参数',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取指定账号
        try:
            account = TransitAccount.objects.get(id=account_id, status='active')
            token = account.token
        except TransitAccount.DoesNotExist:
            return Response({
                'code': 400,
                'message': '指定的中转账号不存在或未激活',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 请求设备组数据
        device_groups = self._get_device_groups(token, account)
        if not device_groups:
            return Response({
                'code': 400,
                'message': '获取出入口数据失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 分类处理数据
        inbounds = []
        outbounds = []
        
        for group in device_groups:
            group_type = group.get('type')
            
            # 根据类型分类，不提取字段直接返回原始数据
            if group_type == 'DeviceGroupType_Inbound':
                inbounds.append(group)
            elif group_type == 'DeviceGroupType_OutboundBySite':
                outbounds.append(group)
        
        # 按照show_order排序
        inbounds.sort(key=lambda x: x.get('show_order', 999))
        outbounds.sort(key=lambda x: x.get('show_order', 999))
        
        return Response({
            'code': 200,
            'message': '获取所有出入口成功',
            'data': {
                'inbounds': inbounds,
                'outbounds': outbounds
            }
        })
    

    @action(detail=False, methods=['get'])
    def endpoints_user(self, request):
        """获取所有出入口"""
        # 从当前登录用户获取二级代理信息
        user = request.user
        
        # 检查用户是否为二级代理
        if user.user_type != 'agent_l2':
            return Response({
                'code': 403,
                'message': '只有二级代理可以访问此接口',
                'data': None
            }, status=status.HTTP_403_FORBIDDEN)
        
        # 获取代理绑定的默认中转账号
        transit_account = user.default_transit_account
        if not transit_account:
            # 如果代理没有默认中转账号，则获取第一个可用的中转账号
            transit_account = TransitAccount.objects.filter(status='active').first()
        
        if not transit_account:
            return Response({
                'code': 400,
                'message': '未找到可用的中转账号',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取token并检查
        token = transit_account.token
        if not token:
            # 尝试重新登录获取token
            token = login_transit_account(transit_account.username, transit_account.password)
            if not token:
                return Response({
                    'code': 400,
                    'message': '中转账号token获取失败',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            # 更新token
            transit_account.token = token
            transit_account.save(update_fields=['token'])
        
        # 请求设备组数据
        device_groups = self._get_device_groups(token, transit_account)
        if not device_groups:
            return Response({
                'code': 400,
                'message': '获取出入口数据失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 分类处理数据
        inbounds = []
        outbounds = []
        
        for group in device_groups:
            group_type = group.get('type')
            
            # 根据类型分类，不提取字段直接返回原始数据
            if group_type == 'DeviceGroupType_Inbound':
                inbounds.append(group)
            elif group_type == 'DeviceGroupType_OutboundBySite':
                outbounds.append(group)
        
        # 按照show_order排序
        inbounds.sort(key=lambda x: x.get('show_order', 999))
        outbounds.sort(key=lambda x: x.get('show_order', 999))
        
        return Response({
            'code': 200,
            'message': '获取所有出入口成功',
            'data': {
                'inbounds': inbounds,
                'outbounds': outbounds
            }
        })
    
    def _get_device_groups(self, token, account):
        """
        获取设备组数据，如果token失效会自动刷新
        """
        # 尝试使用token获取设备组
        url = f"{settings.API_BASE_URL}/api/v1/user/devicegroup"
        headers = {
            "authorization": token
        }
        
        try:
            response = requests.get(url, headers=headers)
            data = response.json()
            
            # 检查是否成功
            if data.get('code') == 0 and data.get('data'):
                return data.get('data')
                
            # Token可能已失效，尝试重新登录
            new_token = login_transit_account(account.username, account.password)
            if not new_token:
                new_token = login_transit_account(account.username, account.password)
                if not new_token:
                    logger.error(f"重新登录失败: {account.username}")
                    return None
                
            # 更新账号token
            account.token = new_token
            account.save(update_fields=['token'])
            
            # 使用新token重新请求
            headers["authorization"] = new_token
            response = requests.get(url, headers=headers)
            data = response.json()
            
            if data.get('code') == 0 and data.get('data'):
                return data.get('data')
            else:
                logger.error(f"使用新token获取设备组失败: {data}")
                return None
                
        except Exception as e:
            logger.error(f"获取设备组异常: {str(e)}")
            return None

    @action(detail=False, methods=['get'])
    def order_endpoints(self, request):
        """通过订单ID获取所有出入口"""
        # 获取订单ID
        order_id = request.query_params.get('order_id')
        
        # 验证order_id是必传参数
        if not order_id:
            return Response({
                'code': 400,
                'message': 'order_id是必传参数',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 获取订单信息
            order = PaymentOrder.objects.get(id=order_id)
            
            # 获取订单关联的用户，然后获取用户的上级代理
            user = order.user
            agent = user.parent if user and hasattr(user, 'parent') else None
            
            if not agent or agent.user_type != 'agent_l2':
                return Response({
                    'code': 400,
                    'message': '未找到有效的二级代理',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取代理绑定的中转账号
            transit_account = agent.default_transit_account
            if not transit_account:
                # 如果代理没有默认中转账号，则获取第一个可用的中转账号
                transit_account = TransitAccount.objects.filter(status='active').first()
            
            if not transit_account:
                return Response({
                    'code': 400,
                    'message': '未找到可用的中转账号',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取token并检查
            token = transit_account.token
            if not token:
                print('token为空尝试重新登录获取token')
            # 尝试重新登录获取token
                token = login_transit_account(transit_account.username, transit_account.password)
                if not token:
                    return Response({
                        'code': 400,
                        'message': '中转账号token获取失败',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                # 更新token
                transit_account.token = token
                transit_account.save(update_fields=['token'])
            print('token',token)
            print('transit_account',transit_account)
            # 请求设备组数据
            device_groups = self._get_device_groups(token, transit_account)
            if not device_groups:
                return Response({
                    'code': 400,
                    'message': '获取出入口数据失败',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            

            print('device_groups',device_groups)
            # 分类处理数据
            inbounds = []
            outbounds = []
            
            for group in device_groups:
                group_type = group.get('type')
                
                # 根据类型分类
                if group_type == 'DeviceGroupType_Inbound':
                    inbounds.append(group)
                elif group_type == 'DeviceGroupType_OutboundBySite':
                    outbounds.append(group)
            
            # 按照show_order排序
            inbounds.sort(key=lambda x: x.get('show_order', 999))
            outbounds.sort(key=lambda x: x.get('show_order', 999))
            
            return Response({
                'code': 200,
                'message': '获取所有出入口成功',
                'data': {
                    'inbounds': inbounds,
                    'outbounds': outbounds
                }
            })
            
        except PaymentOrder.DoesNotExist:
            logger.error(f"订单不存在: order_id={order_id}")
            return Response({
                'code': 404,
                'message': '订单不存在',
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取订单出入口异常: order_id={order_id}, error={str(e)}")
            return Response({
                'code': 500,
                'message': f'获取出入口数据失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def save_transit(self, request):
        """保存中转配置并开通中转"""
        try:
            # 获取请求数据
            node_id = request.data.get('node_id')
            inbound = request.data.get('inbound')  # 入口配置
            outbound = request.data.get('outbound')  # 出口配置
            order_id = request.data.get('order_id')


            # 验证必要参数
            if not all([node_id, inbound, outbound]):
                return Response({
                    'code': 400,
                    'message': '缺少必要参数',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取节点信息
            try:
                node = NodeInfo.objects.get(id=node_id)
            except NodeInfo.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '节点不存在',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 获取订单账号
            order = PaymentOrder.objects.get(id=order_id)
            
            # 获取订单关联的用户，然后获取用户的上级代理
            user = order.user
            agent = user.parent if user and hasattr(user, 'parent') else None
            
            if not agent or agent.user_type != 'agent_l2':
                return Response({
                    'code': 400,
                    'message': '未找到有效的二级代理',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取代理绑定的中转账号
            transit_account = agent.default_transit_account
            print('代理绑定的中转账号',agent.default_transit_account_id)
            print(transit_account)
            if not transit_account:
                # 如果代理没有默认中转账号，则获取第一个可用的中转账号
                transit_account = TransitAccount.objects.filter(status='active').first()
            
            if not transit_account:
                return Response({
                    'code': 400,
                    'message': '未找到可用的中转账号',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 登录获取token
            print(transit_account.token)
            auth_token = transit_account.token
            if not auth_token:
                auth_token = login_transit_account(transit_account.username, transit_account.password)
                if not auth_token:
                    return Response({
                        'code': 400,
                        'message': '中转账号登录失败',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                
            # 构建中转配置
            udp_config = {
                "config": json.dumps({
                    "dest": [f"{node.host}:{node.port}"]
                })
            }
            forward_headers = {
                "Authorization": f"{auth_token}",
                "Content-Type": "application/json"
            }
            if node.udp:
                search_rules_urls = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
                search_rules_datas = {
                    "gid": 0,
                    "gid_in": 0,
                    "gid_out": 0,
                    "name": "",
                    "dest": f"{node.host}:{node.port}",
                    "listen_port": 0
                }
                print('搜索转发规则',f"{node.host}:{node.port}")
                search_rules_responsess = requests.post(search_rules_urls, headers=forward_headers, json=search_rules_datas)
                print(search_rules_responsess.json())
                if search_rules_responsess.status_code == 200:
                    res_id = search_rules_responsess.json().get('data')
                    id_list =[]
                    for i in res_id:
                        id_list.append(i.get('id'))
                    del_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward"
                    if id_list:
                        res_rules_del = requests.delete(del_rules_url, headers=forward_headers, json={"ids":id_list})
                        if res_rules_del.status_code == 200:
                            print('删除成功')
                        else:
                            print('删除失败')
                else:
                    auth_token = login_transit_account(transit_account.username, transit_account.password)
                    if not auth_token:
                        return Response({
                            'code': 400,
                            'message': '中转账号登录失败',
                            'data': None
                        }, status=status.HTTP_400_BAD_REQUEST)
                    search_rules_responsess = requests.post(search_rules_urls, headers=forward_headers, json=search_rules_datas)
                    print(search_rules_responsess.json())
                    if search_rules_responsess.status_code == 200:
                        res_id = search_rules_responsess.json().get('data')[0].get('id')
                        del_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward"
                        res_rules_del = requests.delete(del_rules_url, headers=forward_headers, json={"ids":[res_id]})
                        if res_rules_del.status_code == 200:
                            print('删除成功')
                        else:
                            print('删除失败')
            
            # 创建转发规则
            forward_url = f"{settings.API_BASE_URL}/api/v1/user/forward"
            
            endTime = node.expiry_time.strftime('%Y/%m/%d')
            print('endTime',endTime)
            # 构建完整的转发配置
            forward_data = {
                "device_group_in": inbound.get('id'),
                "device_group_out": outbound.get('id'),
                "config": udp_config["config"],
                "name": f"{order.country}-{endTime}-{order.out_trade_no}"
            }
            # 创建转发规则
            forward_response = requests.put(forward_url, headers=forward_headers, json=forward_data)
            print('创建转发规则',forward_response.json())
            if forward_response.status_code != 200:
                return Response({
                    'code': 400,
                    'message': '创建转发规则失败',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 查询转发规则获取中转IP和端口
            search_rules_url = f"{settings.API_BASE_URL}/api/v1/user/forward/search_rules"
            search_rules_data = {
                "gid": 0,
                "gid_in": 0,
                "gid_out": 0,
                "name": "",
                "dest": f"{node.host}:{node.port}",
                "listen_port": 0
            }
            
            search_rules_response = requests.post(
                search_rules_url,
                headers=forward_headers,
                json=search_rules_data
            )
            
            if search_rules_response.status_code == 200:
                search_rules_result = search_rules_response.json()
                if search_rules_result.get('code') == 0 and search_rules_result.get('data'):
                    rule_data = search_rules_result['data'][0]
                    
                    # 更新节点信息
                    node.udp_host = str(inbound.get('id'))+':'+str(rule_data.get('listen_port'))
                    node.udp_config = json.dumps({
                        "config": {
                            "id": transit_account.id,
                            "username": transit_account.username,
                            "password": transit_account.password,
                        },
                        "udpConfig":forward_data
                    })
                    node.udp = True  # 设置UDP标志
                    node.save(update_fields=['udp_host','udp_config', 'udp'])
                    
                    return Response({
                        'code': 200,
                        'message': '中转配置保存成功',
                        'data': {
                            'udp_host': node.udp_host,
                        }
                    })
            else:
                auth_token = login_transit_account(transit_account.username, transit_account.password)
                if not auth_token:
                    return Response({
                        'code': 400,
                        'message': '中转账号登录失败',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                search_rules_response = requests.post(
                    search_rules_url,
                    headers=forward_headers,
                    json=search_rules_data
                )
                if search_rules_response.status_code == 200:
                    search_rules_result = search_rules_response.json()
                    if search_rules_result.get('code') == 0 and search_rules_result.get('data'):
                        rule_data = search_rules_result['data'][0]
                        
                        # 更新节点信息
                        node.udp_host = str(inbound.get('id'))+':'+str(rule_data.get('listen_port'))
                        node.udp_config = json.dumps({
                            "config": {
                                "id": transit_account.id,
                                "username": transit_account.username,
                                "password": transit_account.password,
                            },
                            "udpConfig":forward_data
                        })
                        node.udp = True  # 设置UDP标志
                        node.save(update_fields=['udp_host','udp_config', 'udp'])
                        
                        return Response({
                            'code': 200,
                            'message': '中转配置保存成功',
                            'data': {
                                'udp_host': node.udp_host,
                            }
                        })
            
            return Response({
                'code': 400,
                'message': '获取中转信息失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"保存中转配置异常: {str(e)}")
            return Response({
                'code': 500,
                'message': f'保存中转配置失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post', 'put'])
    def save_domain(self, request):
        """保存或更新域名"""
        try:
            # 获取当前登录用户
            user = request.user
            
            # 检查用户是否为二级代理
            if user.user_type != 'agent_l2':
                return Response({
                    'code': 403,
                    'message': '只有二级代理可以保存域名',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 判断是创建还是更新操作
            is_update = request.method == 'PUT'
            domain_id = request.data.get('id') if is_update else None
            
            if is_update:
                # 更新操作
                if not domain_id:
                    return Response({
                        'code': 400,
                        'message': 'PUT请求必须提供域名ID',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 获取要更新的域名记录
                try:
                    domain_record = TransitDomain.objects.get(id=domain_id, agent=user)
                except TransitDomain.DoesNotExist:
                    return Response({
                        'code': 404,
                        'message': '域名记录不存在或无权限访问',
                        'data': None
                    }, status=status.HTTP_404_NOT_FOUND)
                
                # 验证请求数据
                serializer = TransitDomainUpdateSerializer(data=request.data)
                if not serializer.is_valid():
                    return Response({
                        'code': 400,
                        'message': '参数验证失败',
                        'data': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 获取验证后的数据
                validated_data = serializer.validated_data
                name = validated_data.get('name')
                
                # 检查名称是否与其他域名冲突（排除当前记录）
                if TransitDomain.objects.filter(agent=user, name=name).exclude(id=domain_id).exists():
                    return Response({
                        'code': 400,
                        'message': f'名称"{name}"已存在，请使用其他名称',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 更新域名记录
                domain_record.name = name
                domain_record.ip = validated_data.get('ip')
                domain_record.domain = validated_data.get('domain')
                domain_record.save()
                
                # 返回更新后的域名信息
                response_serializer = TransitDomainSerializer(domain_record)
                
                return Response({
                    'code': 200,
                    'message': '域名更新成功',
                    'data': response_serializer.data
                })
            else:
                # 创建操作
                # 验证请求数据
                serializer = TransitDomainCreateSerializer(data=request.data)
                if not serializer.is_valid():
                    return Response({
                        'code': 400,
                        'message': '参数验证失败',
                        'data': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 获取验证后的数据
                validated_data = serializer.validated_data
                name = validated_data.get('name')
                ip = validated_data.get('ip')
                domain = validated_data.get('domain')
                
                # 检查同一代理下是否已存在相同名称的域名
                if TransitDomain.objects.filter(agent=user, name=name).exists():
                    return Response({
                        'code': 400,
                        'message': f'名称"{name}"已存在，请使用其他名称',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # 创建域名记录
                domain_record = TransitDomain.objects.create(
                    name=name,
                    ip=ip,
                    domain=domain,
                    agent=user
                )
                
                # 返回创建的域名信息
                response_serializer = TransitDomainSerializer(domain_record)
                
                return Response({
                    'code': 200,
                    'message': '域名保存成功',
                    'data': response_serializer.data
                })
            
        except Exception as e:
            logger.error(f"保存/更新域名异常: {str(e)}")
            return Response({
                'code': 500,
                'message': f'保存/更新域名失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def domain_list(self, request):
        """获取当前代理的域名列表"""
        try:
            # 获取当前登录用户
            user = request.user
            
            # 检查用户是否为二级代理
            if user.user_type != 'agent_l2':
                return Response({
                    'code': 403,
                    'message': '只有二级代理可以查看域名列表',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 获取查询参数
            page = request.query_params.get('page', 1)
            page_size = request.query_params.get('page_size', 10)
            search = request.query_params.get('search', None)
            
            # 转换参数
            try:
                page = int(page)
                page_size = int(page_size)
            except (TypeError, ValueError):
                page = 1
                page_size = 10
            
            # 构建查询条件
            queryset = TransitDomain.objects.filter(agent=user)
            
            if search:
                queryset = queryset.filter(
                    Q(name__icontains=search) | 
                    Q(domain__icontains=search) | 
                    Q(ip__icontains=search)
                )
            
            # 分页
            start = (page - 1) * page_size
            end = page * page_size
            total_count = queryset.count()
            queryset = queryset[start:end]
            
            # 序列化
            serializer = TransitDomainSerializer(queryset, many=True)
            
            # 返回数据
            return Response({
                'code': 200,
                'message': '获取域名列表成功',
                'data': {
                    'total': total_count,
                    'page': page,
                    'page_size': page_size,
                    'results': serializer.data
                }
            })
            
        except Exception as e:
            logger.error(f"获取域名列表异常: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取域名列表失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    @action(detail=False, methods=['delete'])
    def delete_domain(self, request):
        """删除域名"""
        try:
            # 获取当前登录用户
            user = request.user
            
            # 检查用户是否为二级代理
            if user.user_type != 'agent_l2':
                return Response({
                    'code': 403,
                    'message': '只有二级代理可以删除域名',
                    'data': None
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 获取域名ID
            domain_id = request.data.get('id')
            if not domain_id:
                return Response({
                    'code': 400,
                    'message': '必须提供域名ID',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 获取要删除的域名记录
            try:
                domain_record = TransitDomain.objects.get(id=domain_id, agent=user)
            except TransitDomain.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '域名记录不存在或无权限访问',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 记录删除信息
            domain_name = domain_record.name
            domain_record.delete()
            
            logger.info(f"域名已删除: ID={domain_id}, Name={domain_name}, Agent={user.username}")
            
            return Response({
                'code': 200,
                'message': '域名删除成功',
                'data': None
            })
            
        except Exception as e:
            logger.error(f"删除域名异常: {str(e)}")
            return Response({
                'code': 500,
                'message': f'删除域名失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            