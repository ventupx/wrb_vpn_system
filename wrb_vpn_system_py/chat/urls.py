from django.urls import path, include
from rest_framework_nested import routers
from .views import ChatSessionViewSet, ChatMessageViewSet

# 创建主路由器
router = routers.DefaultRouter()
router.register(r'sessions', ChatSessionViewSet, basename='chat-session')

# 创建嵌套路由器，用于处理会话下的消息
sessions_router = routers.NestedDefaultRouter(router, r'sessions', lookup='session')
sessions_router.register(r'messages', ChatMessageViewSet, basename='chat-message')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(sessions_router.urls)),
] 