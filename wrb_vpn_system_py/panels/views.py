from threading import Thread
from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone

from .models import AgentPanel
from .serializers import AgentPanelSerializer
import requests
import json
import ipaddress
from urllib.parse import urlencode
from django.db.models import Q
from django.db import models
import random
import uuid
from users.models import NodeInfo, PaymentOrder

def get_ip_country(ip):
    """获取IP地址所在国家"""
    try:
        # 使用ip-api.com的免费API
        response = requests.get(f'http://ip-api.com/json/{ip}', timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data['status'] == 'success':
                return data['country']
    except Exception as e:
        print(f"获取IP国家信息失败: {str(e)}")
    return "未知"

# Create your views here.

class AgentPanelViewSet(viewsets.ModelViewSet):
    queryset = AgentPanel.objects.all()
    serializer_class = AgentPanelSerializer
    permission_classes = [AllowAny]  # 设置默认权限为允许所有访问

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
        
        # 过滤启用状态
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            is_active = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)
        
        # 过滤在线状态
        is_online = self.request.query_params.get('is_online', None)
        if is_online is not None:
            is_online = is_online.lower() == 'true'
            queryset = queryset.filter(is_online=is_online)
        
        # 过滤国家
        country = self.request.query_params.get('country', None)
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        return queryset

    def list(self, request, *args, **kwargs):
        """重写list方法以返回符合前端格式的数据"""
        queryset = self.get_queryset()
        
        # 获取分页参数
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 10)
        
        try:
            page = int(page)
            page_size = int(page_size)
        except (TypeError, ValueError):
            page = 1
            page_size = 10
        
        # 确保分页参数合理
        page = max(1, page)
        page_size = max(1, min(100, page_size))  # 限制每页最大记录数
        
        paginator = self.paginate_queryset(queryset)
        if paginator is not None:
            serializer = self.get_serializer(paginator, many=True)
            response = self.get_paginated_response(serializer.data)
            return Response({
                'code': 200,
                'message': '获取面板列表成功',
                'data': response.data
            })

        # 手动分页
        start = (page - 1) * page_size
        end = start + page_size
        
        serializer = self.get_serializer(queryset[start:end], many=True)
        
        return Response({
            'code': 200,
            'message': '获取面板列表成功',
            'data': {
                'results': serializer.data,
                'count': queryset.count(),
                'page': page,
                'page_size': page_size
            }
        })

    def create(self, request, *args, **kwargs):
        """重写create方法以返回符合前端格式的数据"""
        data = request.data.copy()
        
        # 如果数据在data字段中，提取出来
        if 'data' in data:
            data = data['data']
            
        # 直接使用ip作为ip_address，不拼接端口
        if 'ip' in data:
            data['ip_address'] = data['ip']
            if data["country"]:
                data['country'] = data['country']
            else:
                # 获取IP所在国家
                country = get_ip_country(data['ip'].split(':')[0])
                data['country'] = country
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'code': 200,
            'message': '添加面板成功',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        """重写destroy方法以返回符合前端格式的数据"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'code': 200,
            'message': '删除面板成功'
        })

    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """测试面板连接"""
        try:
            
            # 获取请求数据
            ip = request.data.get('ip')
            port = request.data.get('port')
            username = request.data.get('username')
            password = request.data.get('password')
            panel_type = request.data.get('panel_type')

            # 验证必要参数
            required_fields = {'ip': ip, 'port': port, 'username': username, 
                             'password': password, 'panel_type': panel_type}
            missing_fields = [field for field, value in required_fields.items() if not value]
            
            if missing_fields:
                return Response({
                    'code': 400,
                    'message': f'请提供完整的连接信息，缺少: {", ".join(missing_fields)}',
                    'data': {'connected': False}
                }, status=status.HTTP_400_BAD_REQUEST)

            # 验证面板类型
            if panel_type not in ['x-ui', '3x-ui']:
                return Response({
                    'code': 400,
                    'message': '面板类型必须是 x-ui 或 3x-ui',
                    'data': {'connected': False}
                }, status=status.HTTP_400_BAD_REQUEST)

            # 构建请求URL和数据
            url = f'http://{ip}/login'
            
            # x-ui面板的登录数据格式
            if panel_type == 'x-ui':
                login_data = {
                    'username': username,
                    'password': password
                }
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{ip}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{ip}',
                    'Referer': f'http://{ip}/'
                }
            else:  # 3x-ui面板
                login_data = {
                    'username': username,
                    'password': password
                }
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{ip.split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{ip.split('/')[0]}',
                    'Referer': f'http://{ip}/'
                }

            try:
                # print(f"Sending request to: {url}")
                # print(f"Headers: {headers}")
                # print(f"Data: {login_data}")
                
                # 发送POST请求
                response = requests.post(
                    url, 
                    data=login_data,
                    headers=headers,
                    timeout=10,  # 10秒超时
                    verify=False  # 忽略SSL证书验证
                )

                print(f"Response status: {response.status_code}")
                print(f"Response headers: {response.headers}")
                print(f"Response content Login: {response.text}")

                # 尝试解析响应
                try:
                    result = response.json()
                except json.JSONDecodeError:
                    # 如果无法解析JSON，检查响应状态码
                    if response.status_code == 200:
                        return Response({
                            'code': 200,
                            'message': '连接测试成功',
                            'data': {'connected': True}
                        })
                    else:
                        return Response({
                            'code': 400,
                            'message': f'连接测试失败: HTTP {response.status_code}',
                            'data': {'connected': False}
                        }, status=status.HTTP_400_BAD_REQUEST)

                # 检查登录结果
                if result.get('success') or (result.get('msg') == '登录成功'):
                    return Response({
                        'code': 200,
                        'message': '连接测试成功',
                        'data': {'connected': True}
                    })
                else:
                    return Response({
                        'code': 400,
                        'message': f'连接测试失败: {result.get("msg", "未知错误")}',
                        'data': {'connected': False}
                    }, status=status.HTTP_400_BAD_REQUEST)

            except requests.exceptions.RequestException as e:
                return Response({
                    'code': 400,
                    'message': f'连接测试失败: {str(e)}',
                    'data': {'connected': False}
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            print("Error:", str(e))  # 打印错误信息
            return Response({
                'code': 500,
                'message': f'服务器错误: {str(e)}',
                'data': {'connected': False}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    def get_login_cookie(self, panel, panel_info):
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
                timeout=30,
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
            # 将面板标记为离线
            panel.is_online = False
            panel.save(update_fields=['is_online'])
            return None

    def make_request_with_cookie(self, panel, panel_info, url, headers, method='post', data=None):
        """使用cookie发送请求，如果失败则尝试刷新cookie重试"""
        response = None
        try:
            # 如果存在cookie，添加到请求头中
            if panel.cookie:
                headers['cookie'] = panel.cookie
            
            if method.lower() == 'post':
                response = requests.post(url, headers=headers, data=data, timeout=30, verify=False)
            elif method.lower() == 'post_params':
                response = requests.post(url, headers=headers, data=data, timeout=30, verify=False)
            else:
                response = requests.get(url, headers=headers, timeout=30, verify=False)
            
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
                new_cookie = self.get_login_cookie(panel, panel_info)
                if new_cookie:
                    headers['cookie'] = new_cookie
                    if method.lower() == 'post':
                        response = requests.post(url, headers=headers, data=data, timeout=30, verify=False)
                    elif method.lower() == 'post_params':
                        response = requests.post(url, headers=headers, data=data, timeout=30, verify=False)
                    else:
                        response = requests.get(url, headers=headers, timeout=30, verify=False)
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
                new_cookie = self.get_login_cookie(panel, panel_info)
                if new_cookie:
                    headers['cookie'] = new_cookie
                    if method.lower() == 'post':
                        return requests.post(url, headers=headers, data=data, timeout=30, verify=False)
                    elif method.lower() == 'post_params':
                        return requests.post(url, headers=headers, params=data, timeout=30, verify=False)
                    else:
                        return requests.get(url, headers=headers, timeout=30, verify=False)
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

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """获取指定代理面板的系统状态"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
            # 构建请求头和URL
            if panel_info['panel_type'] == 'x-ui':
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip']}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip']}',
                    'x-requested-with': 'XMLHttpRequest',
                    'Referer': f'http://{panel_info['ip']}/xui'
                }
                url = f"http://{panel_info['ip']}/server/status"
            else:
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/panel'
                }
                url = f"http://{panel_info['ip']}/server/status"

            # 发送请求获取系统状态
            response = self.make_request_with_cookie(panel, panel_info, url, headers)
            
            # 返回数据
            return Response({
                'code': 200,
                'message': '获取系统状态成功',
                'data': response.json().get('obj', {})  # 假设状态数据在obj字段中
            })
            
        except Exception as e:
            print(f"获取系统状态失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取系统状态失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def nodes(self, request, pk=None):
        """获取指定代理面板的节点列表"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
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

            # 发送请求获取节点列表
            try:
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post')
                
                # 尝试解析响应
                try:
                    result = response.json()
                    if not result.get('success', False):
                        # 请求成功但返回失败状态
                        panel.is_online = False
                        panel.save(update_fields=['is_online'])
                        raise Exception(f"获取节点列表失败: {result.get('msg', '未知错误')}")
                    
                    nodes_data = result.get('obj', [])
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    raise Exception(f"解析节点列表响应失败: {str(json_error)}")
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                raise Exception(f"请求节点列表失败: {str(req_error)}")
            
            # 收集已使用的端口
            used_ports = []
            for node in nodes_data:
                # 根据面板类型提取端口
                if panel_info['panel_type'] == 'x-ui':
                    # x-ui 面板中的端口通常在 port 字段中
                    port = node.get('port')
                    if port:
                        used_ports.append(str(port))
                elif panel_info['panel_type'] == '3x-ui':
                    # 3x-ui 面板中的端口可能在 port 字段中
                    port = node.get('port')
                    if port:
                        used_ports.append(str(port))
            
            # 更新节点数量、在线状态和已使用端口
            panel.nodes_count = len(nodes_data)
            panel.is_online = True  # 成功获取节点列表，设置为在线
            panel.used_ports = ','.join(used_ports)  # 使用逗号分隔的端口列表
            panel.save(update_fields=['nodes_count', 'is_online', 'used_ports'])
            
            # 返回数据
            return Response({
                'code': 200,
                'message': '获取节点列表成功',
                'data': nodes_data
            })
            
        except Exception as e:
            # 获取节点列表失败，将面板状态设置为离线
            try:
                panel = self.get_object()
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as panel_error:
                print(f"保存面板状态失败: {str(panel_error)}")
            
            print(f"获取节点列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取节点列表失败: {str(e)}',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def total_nodes_count(self, request):
        """获取所有代理面板的节点总数"""
        try:
            # 获取所有激活的代理面板
            active_panels = AgentPanel.objects.filter(is_active=True)
            
            # 计算总节点数
            total_count = active_panels.aggregate(models.Sum('nodes_count'))['nodes_count__sum'] or 0
            
            # 返回数据
            return Response({
                'code': 200,
                'message': '获取节点总数成功',
                'data': {
                    'total_nodes_count': total_count,
                    'active_panels_count': active_panels.count()
                }
            })
            
        except Exception as e:
            print(f"获取节点总数失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取节点总数失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def update_all_nodes_count(self, request):
        """更新所有代理面板的节点数量、已使用端口和在线状态"""
        try:
            # 获取所有已启用的代理面板
            active_panels = AgentPanel.objects.filter(is_active=True)
            total_panels = active_panels.count()
            
            # 立即返回响应，在后台处理更新
            import threading
            
            def background_process():
                try:
                    updated_count = 0
                    failed_count = 0
                    failed_panels = []
                    
                    # 单线程循环处理所有面板
                    for panel in active_panels:
                        try:
                            result = self.update_single_panel(panel)
                            if result['success']:
                                updated_count += 1
                            else:
                                failed_count += 1
                                failed_panels.append({
                                    'id': result['panel_id'],
                                    'ip': result['panel_ip'],
                                    'error': result['error']
                                })
                        except Exception as exc:
                            print(f'面板 {panel.id} 处理过程中产生异常: {exc}')
                            failed_count += 1
                            failed_panels.append({
                                'id': panel.id,
                                'ip': panel.ip_address,
                                'error': str(exc)
                            })
                    
                    print(f"后台更新完成: 成功 {updated_count} 个, 失败 {failed_count} 个")
                except Exception as e:
                    print(f"后台更新过程出错: {str(e)}")
            
            # 启动后台线程
            update_thread = threading.Thread(target=background_process)
            update_thread.daemon = True
            update_thread.start()
            
            # 立即返回响应
            return Response({
                'code': 200,
                'message': '更新任务已在后台启动，请稍后查看结果',
                'data': {
                    'total_panels': total_panels
                }
            })
            
        except Exception as e:
            print(f"启动更新任务失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'启动更新任务失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # 将单个面板更新的逻辑提取为一个单独的方法
    def update_single_panel(self, panel):
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
                self.get_login_cookie(panel, panel_info)
            
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
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post')
                
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

    @action(detail=True, methods=['delete'])
    def delete_node(self, request, pk=None, node_id=None):
        """删除指定代理面板的指定节点"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
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
                url = f"http://{panel_info['ip']}/xui/inbound/del/{node_id}"
            else:
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/'
                }
                url = f"http://{panel_info['ip']}/panel/inbound/del/{node_id}"

            # 发送删除请求
            try:
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post')
                
                # 尝试解析响应
                try:
                    result = response.json()
                    if result.get('success') or result.get('msg') == '删除成功':
                        # 删除成功后，更新节点列表以更新面板的节点数量和已使用端口
                        try:
                            self.nodes(request, pk=pk)
                        except Exception as update_error:
                            print(f"删除节点后更新节点列表失败: {str(update_error)}")
                        
                        return Response({
                            'code': 200,
                            'message': '删除节点成功'
                        })
                    else:
                        # 删除失败但请求成功
                        error_msg = result.get('msg', '未知错误')
                        return Response({
                            'code': 400,
                            'message': f'删除节点失败: {error_msg}',
                            'data': result
                        }, status=status.HTTP_400_BAD_REQUEST)
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    raise Exception(f"解析删除节点响应失败: {str(json_error)}")
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                raise Exception(f"删除节点请求失败: {str(req_error)}")
            
        except Exception as e:
            # 确保面板状态为离线
            try:
                panel = self.get_object()
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as panel_error:
                print(f"更新面板状态失败: {str(panel_error)}")
                
            print(f"删除节点失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'删除节点失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, *args, **kwargs):
        """重写retrieve方法以返回符合前端格式的数据"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'code': 200,
            'message': '获取面板详情成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def countries(self, request):
        """获取所有不重复的国家列表，按首字母排序
        
        查询参数：
        - online_only: 是否只返回有在线面板的国家（默认true）
          - true: 只返回至少有一个在线面板的国家
          - false: 返回所有激活面板的国家（不管是否在线）
        """
        try:
            # 获取查询参数，默认只返回在线的国家
            online_only = request.query_params.get('online_only', 'true').lower() == 'true'
            
            # 获取所有激活的面板
            active_panels = AgentPanel.objects.filter(is_active=True)
            
            # 统计每个国家的面板数量和在线面板数量
            country_stats = {}
            
            # 遍历所有面板，统计每个国家的面板数量和在线面板数量
            for panel in active_panels:
                country = panel.country
                if not country or country == '未知':
                    continue  # 跳过未知国家
                
                # 如果国家不在统计字典中，初始化计数
                if country not in country_stats:
                    country_stats[country] = {
                        'total': 0,
                        'online': 0
                    }
                
                country_stats[country]['total'] += 1
                if panel.is_online:
                    country_stats[country]['online'] += 1
            
            # 根据参数筛选有效的国家
            valid_countries = []
            for country, stats in country_stats.items():
                if online_only:
                    # 只添加至少有一个在线面板的国家
                    if stats['online'] > 0:
                        valid_countries.append(country)
                else:
                    # 添加所有有面板的国家（不管是否在线）
                    if stats['total'] > 0:
                        valid_countries.append(country)
            
            # 按首字母排序
            sorted_countries = sorted(valid_countries, key=lambda x: x[0].lower() if x else '')
            
            return Response({
                'code': 200,
                'message': '获取国家列表成功',
                'data': sorted_countries
            })
            
        except Exception as e:
            print(f"获取国家列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取国家列表失败: {str(e)}',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def get_panels_by_country(self, request):
        """
        根据国家获取所有代理面板
        返回数据包含ip_address, 端口, 面板类型, 存在的节点数
        """
        try:
            # 获取查询参数
            country = request.query_params.get('country')
            if not country:
                return Response({
                    'code': 400,
                    'message': '国家参数不能为空',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 查询指定国家的所有激活面板
            panels = AgentPanel.objects.filter(
                country__iexact=country,
                is_active=True
            )
            
            if not panels.exists():
                return Response({
                    'code': 404,
                    'message': f'未找到国家为 {country} 的可用代理面板',
                    'data': []
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 构建返回数据
            panels_data = []
            for panel in panels:
                panels_data.append({
                    'id': panel.id,
                    'ip_address': panel.ip_address,
                    'port': panel.port,
                    'panel_type': panel.panel_type,
                    'nodes_count': panel.nodes_count,
                    'is_online': panel.is_online
                })
            
            return Response({
                'code': 200,
                'message': f'获取国家为 {country} 的代理面板成功',
                'data': panels_data
            })
            
        except Exception as e:
            print(f"获取面板列表失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取面板列表失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def start_update_all_nodes_count(self, request):
        """开始异步更新所有代理面板的节点数量，立即返回，不等待结果"""
        import threading
        
        def background_update():
            try:
                # 获取所有已启用的代理面板
                active_panels = AgentPanel.objects.filter(is_active=True)
                total_panels = active_panels.count()
                
                # 每批处理的面板数量
                batch_size = 10
                
                for page in range(1, (total_panels + batch_size - 1) // batch_size + 1):
                    try:
                        # 构造请求对象并调用update_all_nodes_count方法
                        from django.http import HttpRequest
                        from rest_framework.request import Request
                        from io import BytesIO
                        
                        # 创建一个临时请求对象
                        http_request = HttpRequest()
                        http_request.method = 'POST'
                        http_request._body = json.dumps({'page': page, 'batch_size': batch_size}).encode('utf-8')
                        http_request.META = {
                            'CONTENT_TYPE': 'application/json',
                            'HTTP_CONTENT_TYPE': 'application/json',
                            'CONTENT_LENGTH': len(http_request._body),
                            'HTTP_ACCEPT': 'application/json',
                            'REQUEST_METHOD': 'POST'
                        }
                        http_request._stream = BytesIO(http_request._body)
                        
                        # 包装为DRF请求对象
                        api_request = Request(http_request)
                        api_request.authenticators = []  # 跳过认证
                        api_request.data = {'page': page, 'batch_size': batch_size}
                        api_request.user = request.user  # 复制用户信息
                        
                        # 调用更新方法
                        self.update_all_nodes_count(api_request)
                        
                        # 等待一段时间再处理下一批，避免过度占用资源
                        import time
                        time.sleep(2)
                    except Exception as batch_error:
                        print(f"处理第{page}批面板时出错: {str(batch_error)}")
                        continue
                
                print(f"所有面板更新完成，共处理 {total_panels} 个面板")
            except Exception as e:
                print(f"异步更新面板过程中出错: {str(e)}")
        
        # 启动后台线程进行处理
        update_thread = threading.Thread(target=background_update)
        update_thread.daemon = True  # 设置为守护线程，不阻止程序退出
        update_thread.start()
        
        # 立即返回成功响应
        return Response({
            'code': 200,
            'message': '已启动更新所有面板节点数量的后台任务',
            'data': None
        })

    @action(detail=False, methods=['get'])
    def update_progress(self, request):
        """获取面板更新进度，返回在线/离线面板数量等统计信息"""
        try:
            # 获取所有代理面板
            all_panels = AgentPanel.objects.all()
            active_panels = all_panels.filter(is_active=True)
            
            # 统计在线/离线面板数量
            online_panels = active_panels.filter(is_online=True)
            offline_panels = active_panels.filter(is_online=False)
            
            # 计算最近更新的面板数量（假设面板有last_updated字段，如果没有可以忽略这部分）
            from django.utils import timezone
            recent_updated = 0
            
            
            # 统计节点总数
            total_nodes = active_panels.aggregate(models.Sum('nodes_count'))['nodes_count__sum'] or 0
            
            return Response({
                'code': 200,
                'message': '获取更新进度成功',
                'data': {
                    'total_panels': all_panels.count(),
                    'active_panels': active_panels.count(),
                    'online_panels': online_panels.count(),
                    'offline_panels': offline_panels.count(),
                    'total_nodes': total_nodes,
                    'recent_updated': recent_updated
                }
            })
        except Exception as e:
            print(f"获取更新进度失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取更新进度失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def outbounds(self, request, pk=None):
        """获取指定代理面板的出站规则列表"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
            # 构建请求头和URL
            if panel_info['panel_type'] == '3x-ui':
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/panel'
                }
                url = f"http://{panel_info['ip']}/panel/xray/"
            else:
                return Response({
                    'code': 400,
                    'message': '只有3x-ui面板支持获取出站规则',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 发送请求获取出站规则
            try:
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post')
                # 尝试解析响应
                try:
                    result = response.json()
                    if not result.get('success', False):
                        # 请求成功但返回失败状态
                        panel.is_online = False
                        panel.save(update_fields=['is_online'])
                        raise Exception(f"获取出站规则失败: {result.get('msg', '未知错误')}")
                    
                    # 解析 obj 字段中的 JSON 字符串
                    obj_data = json.loads(result.get('obj', '{}'))
                    
                    # 返回数据
                    return Response({
                        'code': 200,
                        'message': '获取出站规则成功',
                        'data': obj_data
                    })
                    
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    raise Exception(f"解析出站规则响应失败: {str(json_error)}")
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                raise Exception(f"请求出站规则失败: {str(req_error)}")
            
        except Exception as e:
            # 确保面板状态为离线
            try:
                panel = self.get_object()
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as panel_error:
                print(f"更新面板状态失败: {str(panel_error)}")
                
            print(f"获取出站规则失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取出站规则失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def save_outbounds(self, request, pk=None):
        """保存出站规则"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
            # 构建请求头和URL
            if panel_info['panel_type'] == '3x-ui':
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/panel'
                }
                url = f"http://{panel_info['ip']}/panel/xray/update"
            else:
                return Response({
                    'code': 400,
                    'message': '只有3x-ui面板支持保存出站规则',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 发送请求保存出站规则
            try:
                # 将请求数据转换为FormData格式
                form_data = {
                    'xraySetting': json.dumps(request.data)
                }
                
                # 发送请求
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post', data=form_data)
                
                # 打印响应信息
                
                # 尝试解析响应
                try:
                    result = response.json()
                    if result.get('success', False):
                        return Response({
                            'code': 200,
                            'message': '保存出站规则成功',
                            'data': None
                        })
                    else:
                        # 保存失败
                        panel.is_online = False
                        panel.save(update_fields=['is_online'])
                        return Response({
                            'code': 400,
                            'message': f'保存出站规则失败: {result.get("msg", "未知错误")}',
                            'data': None
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    return Response({
                        'code': 400,
                        'message': f'解析响应失败: {str(json_error)}',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                return Response({
                    'code': 500,
                    'message': f'请求保存出站规则失败: {str(req_error)}',
                    'data': None
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            # 确保面板状态为离线
            try:
                panel = self.get_object()
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as panel_error:
                print(f"更新面板状态失败: {str(panel_error)}")
                
            print(f"保存出站规则失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'保存出站规则失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def restart_xray(self, request, pk=None):
        """重启 Xray 服务"""
        try:
            # 获取代理面板实例
            panel = self.get_object()
            
            # 获取连接参数
            panel_info = {
                'ip': panel.ip_address,
                'port': panel.port,
                'username': panel.username,
                'password': panel.password,
                'panel_type': panel.panel_type
            }
            
            # 如果没有cookie，先获取cookie
            if not panel.cookie:
                self.get_login_cookie(panel, panel_info)
            
            # 构建请求头和URL
            if panel_info['panel_type'] == '3x-ui':
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'host': f'{panel_info['ip'].split('/')[0]}',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    'Origin': f'http://{panel_info['ip'].split('/')[0]}',
                    'Referer': f'http://{panel_info['ip']}/panel'
                }
                url = f"http://{panel_info['ip']}/server/restartXrayService"
            else:
                return Response({
                    'code': 400,
                    'message': '只有3x-ui面板支持重启Xray服务',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)

            # 发送重启请求
            try:
                response = self.make_request_with_cookie(panel, panel_info, url, headers, method='post')
                
                # 尝试解析响应
                try:
                    result = response.json()
                    if result.get('success', False):
                        return Response({
                            'code': 200,
                            'message': '重启Xray服务成功',
                            'data': None
                        })
                    else:
                        # 重启失败
                        panel.is_online = False
                        panel.save(update_fields=['is_online'])
                        return Response({
                            'code': 400,
                            'message': f'重启Xray服务失败: {result.get("msg", "未知错误")}',
                            'data': None
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                except ValueError as json_error:
                    # JSON解析失败
                    panel.is_online = False
                    panel.save(update_fields=['is_online'])
                    return Response({
                        'code': 400,
                        'message': f'解析响应失败: {str(json_error)}',
                        'data': None
                    }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as req_error:
                # 请求过程中出错
                panel.is_online = False
                panel.save(update_fields=['is_online'])
                return Response({
                    'code': 500,
                    'message': f'请求重启Xray服务失败: {str(req_error)}',
                    'data': None
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            # 确保面板状态为离线
            try:
                panel = self.get_object()
                panel.is_online = False
                panel.save(update_fields=['is_online'])
            except Exception as panel_error:
                print(f"更新面板状态失败: {str(panel_error)}")
                
            print(f"重启Xray服务失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'重启Xray服务失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def generate_random_port(self, panel, min_port=10000, max_port=65000):
        """生成一个随机端口，确保不在已使用的端口列表中"""
        # 获取已使用的端口列表
        used_ports = []
        if panel.used_ports:
            used_ports = [int(port) for port in panel.used_ports.split(',') if port.strip().isdigit()]
        
        # 生成随机端口，直到找到一个未使用的端口
        max_attempts = 100  # 设置最大尝试次数，避免无限循环
        for _ in range(max_attempts):
            port = random.randint(min_port, max_port)
            if port not in used_ports:
                return port
        
        # 如果尝试多次仍找不到未使用的端口，则顺序查找
        for port in range(min_port, max_port + 1):
            if port not in used_ports:
                return port
        
        # 如果所有端口都已使用，返回一个错误
        raise Exception("所有可用端口已用尽")
    
    def generate_uuid(self):
        """生成UUID"""
        return str(uuid.uuid4())

    def generate_sub_id(self, length=16):
        """生成随机subId，包含小写字母a-z和数字1-9，长度默认为16位"""
        import string
        # 创建字符集：小写字母a-z和数字1-9
        chars = string.ascii_lowercase + '123456789'
        # 随机选择指定长度的字符
        return ''.join(random.choice(chars) for _ in range(length))

    @action(detail=False, methods=['post'])
    def check_node_status(self, request):
        """检查节点激活状态"""
        try:
            # 获取节点ID
            node_id = request.data.get('node_id')
            if not node_id:
                return Response({
                    'code': 400,
                    'message': '节点ID不能为空',
                    'data': None
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 查询节点信息
            try:
                node_info = NodeInfo.objects.get(id=node_id)
            except NodeInfo.DoesNotExist:
                return Response({
                    'code': 404,
                    'message': '节点不存在',
                    'data': None
                }, status=status.HTTP_404_NOT_FOUND)
            
            # 检查节点状态
            if node_info.status == '132':
                return Response({
                    'code': 200,
                    'message': '节点已激活，无需重复激活',
                    'data': {
                        'node_id': node_id,
                        'status': node_info.status
                    }
                })
            else:
                host_config = json.loads(node_info.host_config)
                panel = AgentPanel.objects.get(id=host_config.get('id'))
                headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'host': f'{panel.ip_address.split("/")[0]}',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    }
                if host_config.get('panel_type') == '3x-ui':
                    list_url = f"http://{panel.ip_address}/panel/inbound/list"
                    list_response = self.make_request_with_cookie(
                        panel,
                        host_config,
                        list_url,
                        headers,
                        method='post'
                    )
                    if list_response.status_code == 200:
                        list_result = list_response.json()
                        if list_result.get('success'):
                                # 遍历节点列表查找匹配的端口
                            for inbound in list_result.get('obj', []):
                                if str(inbound.get('port')) ==  str(node_info.port):
                                    node_info.status = 'active'
                                    node_info.save(update_fields=['status'])
                                    return Response({
                                        'code': 200,
                                        'message': '节点已激活',
                                        'data': {
                                            'node_id': node_id,
                                            'status': node_info.status
                                        }
                                    })
                    
                    # 动态导入migrate_node函数
                    from users.views import migrate_node
                    thread = Thread(target=migrate_node, args=(node_info, panel))
                    thread.start()
                    return Response({
                        'code': 200,
                        'message': '节点激活中，请稍后刷新查看结果...',
                        'data': {
                            'node_id': node_id,
                            'status': node_info.status
                        }
                    })
                else:
                    
                    list_url = f"http://{panel.ip_address}/xui/inbound/list"
                    list_response = self.make_request_with_cookie(
                        panel,
                        host_config,
                        list_url,
                        headers,
                        method='post'
                    )
                    if list_response.status_code == 200:
                        list_result = list_response.json()
                        if list_result.get('success'):
                                # 遍历节点列表查找匹配的端口
                            for inbound in list_result.get('obj', []):
                                
                                if str(inbound.get('port')) == str(node_info.port):
                                    node_info.status = 'active'
                                    node_info.save(update_fields=['status'])
                                    return Response({
                                        'code': 200,
                                        'message': '节点已激活',
                                        'data': {
                                            'node_id': node_id,
                                            'status': node_info.status
                                        }
                                    })
                            
                    # 动态导入migrate_node函数
                    from users.views import migrate_node
                    thread = Thread(target=migrate_node, args=(node_info, panel))
                    thread.start()
                    return Response({
                        'code': 200,
                        'message': '节点激活中，请稍后刷新查看结果...',
                        'data': {
                            'node_id': node_id,
                            'status': node_info.status
                        }
                    })
            
        except Exception as e:
            print(f"检查节点状态失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'检查节点状态失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

