from rest_framework.response import Response
from rest_framework import status

def api_response(code=200, message="", data=None):
    """
    统一的API响应格式
    :param code: 状态码，默认200表示成功
    :param message: 提示信息
    :param data: 响应数据
    """
    return Response({
        "code": code,
        "message": message,
        "data": data if data is not None else {}
    }, status=status.HTTP_200_OK) 