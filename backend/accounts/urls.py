from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.login_view),
    path("me/", views.me_view),
    path("set-password/", views.set_password_view),
    path("users/", views.users_view),
    path("users/<int:user_id>/", views.user_detail_view),
    path("users/<int:user_id>/resend-invite/", views.resend_invite_view),
    path("hospitals/", views.hospitals_view),
    path("staff-directory/", views.staff_directory_view),
]
