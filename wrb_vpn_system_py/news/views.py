from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from .models import News
from .serializers import NewsSerializer, NewsListSerializer
from django.core.paginator import Paginator
from rest_framework.decorators import action

class NewsViewSet(viewsets.ModelViewSet):
    queryset = News.objects.all()
    serializer_class = NewsSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_serializer_class(self):
        if self.action == 'list':
            return NewsListSerializer
        return NewsSerializer

    def get_queryset(self):
        queryset = News.objects.all()
        
        # 搜索功能
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search)
            )
        
        # 排序
        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering and ordering in ['-created_at', 'created_at', '-updated_at', 'updated_at']:
            queryset = queryset.order_by(ordering)
        
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # 分页
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('pageSize', 10)
        paginator = Paginator(queryset, page_size)
        
        try:
            news_page = paginator.page(page)
        except:
            news_page = paginator.page(1)
        
        serializer = self.get_serializer(news_page, many=True, context={'request': request})
        
        return Response({
            'code': 200,
            'message': '获取新闻列表成功',
            'data': {
                'list': serializer.data,
                'total': paginator.count,
                'current': int(page),
                'pageSize': int(page_size),
                'total_pages': paginator.num_pages
            }
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response({
                'code': 200,
                'message': '新闻发布成功',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response({
            'code': 400,
            'message': '新闻发布失败',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            self.perform_update(serializer)
            return Response({
                'code': 200,
                'message': '新闻更新成功',
                'data': serializer.data
            })
        return Response({
            'code': 400,
            'message': '新闻更新失败',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'code': 200,
            'message': '新闻删除成功'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def my_news(self, request):
        """获取当前用户发布的新闻"""
        queryset = self.get_queryset().filter(author=request.user)
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('pageSize', 10)
        
        paginator = Paginator(queryset, page_size)
        try:
            news_page = paginator.page(page)
        except:
            news_page = paginator.page(1)
        
        serializer = self.get_serializer(news_page, many=True)
        return Response({
            'code': 200,
            'message': '获取我的新闻列表成功',
            'data': {
                'list': serializer.data,
                'total': paginator.count,
                'current': int(page),
                'pageSize': int(page_size),
                'total_pages': paginator.num_pages
            }
        })

    def retrieve(self, request, *args, **kwargs):
        """获取单个新闻详情"""
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response({
                'code': 200,
                'message': '获取新闻详情成功',
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'code': 400,
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST) 