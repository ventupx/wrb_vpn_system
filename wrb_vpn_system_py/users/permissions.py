from rest_framework.permissions import BasePermission

class IsAgentL1(BasePermission):
    """
    允许一级代理访问
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'agent_l1'


class IsAgentL2(BasePermission):
    """
    允许二级代理访问
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'agent_l2'


class IsAgentOrAdmin(BasePermission):
    """
    允许代理或管理员访问
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_agent or 
            request.user.user_type == 'agent_l1' or 
            request.user.user_type == 'agent_l2' or 
            request.user.is_staff
        )


class IsCustomer(BasePermission):
    """
    允许客户访问
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'customer'


class IsOwnerOrAdmin(BasePermission):
    """
    只允许对象所有者或管理员访问
    """
    def has_object_permission(self, request, view, obj):
        # 管理员总是可以访问
        if request.user.is_staff:
            return True
        
        # 检查对象是否属于当前用户
        return obj.user == request.user 