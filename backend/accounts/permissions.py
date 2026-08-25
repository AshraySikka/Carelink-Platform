"""Reusable role based permission classes for the API."""
from rest_framework.permissions import BasePermission


def role_permission(*roles):
    """Build a permission class that allows only the given roles."""

    class RolePermission(BasePermission):
        message = "Your role does not have access to this action."

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated and request.user.role in roles)

    return RolePermission


IsAdmin = role_permission("admin")
IsAdminOrCS = role_permission("admin", "customer_service")
IsAdminOrManager = role_permission("admin", "manager")
IsSchedulingStaff = role_permission("admin", "customer_service", "manager")
