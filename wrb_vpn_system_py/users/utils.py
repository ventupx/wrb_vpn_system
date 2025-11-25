from rest_framework.response import Response
from typing import Any, Dict, Optional

def api_response(
    code: int = 200,
    message: str = "success",
    data: Optional[Any] = None
) -> Response:
    """
    统一的API响应格式
    
    Args:
        code: 状态码
        message: 响应消息
        data: 响应数据
    
    Returns:
        Response: DRF响应对象
    """
    response_data: Dict[str, Any] = {
        "code": code,
        "message": message,
    }
    
    if data is not None:
        response_data["data"] = data
        
    return Response(response_data) 