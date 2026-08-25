from django.urls import path

from . import views

urlpatterns = [
    path("ai/chat/", views.ai_chat_view),
    path("ai/search/", views.ai_search_view),
    path("procura/mappings/", views.procura_mappings_view),
    path("procura/mappings/<int:mapping_id>/", views.procura_mapping_detail_view),
    path("procura/sync/", views.procura_sync_view),
    path("outlook/rules/", views.outlook_rules_view),
    path("outlook/rules/<int:rule_id>/", views.outlook_rule_detail_view),
    path("outlook/status/", views.outlook_status_view),
]
