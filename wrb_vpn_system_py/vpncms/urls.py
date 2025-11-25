"""
URL configuration for vpncms project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users.views import UserViewSet, LoginView, CustomTokenObtainPairView, AgentViewSet, CustomerViewSet, PackageViewSet, CustomerPackageViewSet, WebsiteTemplateViewSet, CustomerLoginView, payment_callback, payment_submit, validate_coupon, get_prices, payment_status, PaymentOrderViewSet, ContactInfoViewSet, balance_payment, get_user_balance
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from news.urls import urlpatterns as news_urls
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import csrf_exempt
from panels.views import AgentPanelViewSet
from django.views.static import serve

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'agent-panel', AgentPanelViewSet, basename='panels-agent')
router.register(r'payment-orders', PaymentOrderViewSet, basename='payment-order')
router.register(r'contact-info', ContactInfoViewSet, basename='contact-info')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include(router.urls)),
    path('api/', include('users.urls')),
    path('api/', include('news.urls')),
    path('api/cdk/', include('cdk.urls')),
    path('api/', include('transits.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/balance-payment/', balance_payment, name='balance-payment'),
    path('api/user-balance/', get_user_balance, name='user-balance'),
    
    # 无论是开发环境还是生产环境，都使用相同的方式处理媒体文件
    path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
]

# 开发环境下额外添加静态文件处理
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
