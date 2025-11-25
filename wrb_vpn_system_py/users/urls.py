from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import (
    UserViewSet,
    CustomTokenObtainPairView,
    PasswordResetView,
    VerifyCodeView,
    ResetPasswordView,
    AgentViewSet,
    CustomerViewSet,
    PackageViewSet,
    CustomerPackageViewSet,
    WebsiteTemplateViewSet,
    CustomerLoginView,
    payment_callback,
    payment_status,
    AgentContactView,
    AgentPricingView,
    UpdateCustomPricingView,
    UpdateUserPricingView,
    change_node_panel,
    change_order_panel,
)
from django.views.decorators.csrf import csrf_exempt

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'agents', AgentViewSet, basename='agent')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'packages', PackageViewSet, basename='package')
router.register(r'customer-packages', CustomerPackageViewSet, basename='customer-package')
router.register(r'website-template', WebsiteTemplateViewSet, basename='website-template')

urlpatterns = [
    path('', include(router.urls)),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('forgot-password/', csrf_exempt(PasswordResetView.as_view()), name='forgot-password'),
    path('verify-code/', csrf_exempt(VerifyCodeView.as_view()), name='verify-code'),
    path('reset-password/', csrf_exempt(ResetPasswordView.as_view()), name='reset-password'),
    path('customer/login/', CustomerLoginView.as_view(), name='customer-login'),
    path('update_profile/', UserViewSet.as_view({'put': 'update_profile'}), name='update-profile'),
    path('change_password/', UserViewSet.as_view({'put': 'change_password'}), name='change-password'),
    path('payment/callback/', payment_callback, name='payment-callback'),
    path('payment/submit/', views.payment_submit, name='payment-submit'),
    path('payment/status/', payment_status, name='payment-status'),
    path('coupon/validate/', views.validate_coupon, name='validate-coupon'),
    path('prices/', views.get_prices, name='get-prices'),
    path('agent-contact/', AgentContactView.as_view(), name='agent-contact'),
    path('agent/pricing/', AgentPricingView.as_view(), name='agent-pricing'),
    path('agent/pricing/update/', UpdateCustomPricingView.as_view(), name='update-custom-pricing'),
    path('agent/pricing/update-user/', UpdateUserPricingView.as_view(), name='update-user-pricing'),
    path('change-node-panel/', change_node_panel, name='change-node-panel'),
    path('change-order-panel/', change_order_panel, name='change-order-panel'),
    path('node/renewal/', views.node_renewal, name='node-renewal'),
    path('order/renewal/', views.order_renewal, name='order-renewal'),
] 