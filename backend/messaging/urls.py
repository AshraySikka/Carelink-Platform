from django.urls import path

from . import views

urlpatterns = [
    path("contacts/", views.contacts_view),
    path("conversations/", views.conversations_view),
    path("conversations/<int:conversation_id>/messages/", views.messages_view),
    path("connect-agent/", views.connect_agent_view),
]
