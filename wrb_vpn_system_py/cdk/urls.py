from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CDKViewSet

router = DefaultRouter()
router.register('', CDKViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 