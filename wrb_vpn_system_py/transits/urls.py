from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransitAccountViewSet

router = DefaultRouter()
router.register(r'accounts', TransitAccountViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 