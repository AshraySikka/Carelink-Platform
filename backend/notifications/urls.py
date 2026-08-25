from django.urls import path

from . import views

urlpatterns = [
    path("", views.list_view),
    path("mark-read/", views.mark_read_view),
    path("preferences/", views.preferences_view),
]
