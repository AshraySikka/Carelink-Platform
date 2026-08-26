from django.urls import path

from . import views

urlpatterns = [
    path("programs/", views.programs_view),
    path("programs/bulk/", views.programs_bulk_view),
    path("programs/<int:program_id>/", views.program_detail_view),
    path("referrals/", views.referrals_view),
    path("referrals/<int:referral_id>/", views.referral_detail_view),
    path("referrals/<int:referral_id>/documents/", views.referral_documents_view),
    path("shifts/", views.shifts_view),
    path("shifts/<int:shift_id>/", views.shift_detail_view),
    path("shifts/<int:shift_id>/clock-in/", views.shift_clock_in_view),
    path("shifts/<int:shift_id>/clock-out/", views.shift_clock_out_view),
    path("shifts/<int:shift_id>/on-my-way/", views.shift_on_my_way_view),
    path("change-requests/", views.change_requests_view),
    path("change-requests/<int:request_id>/decide/", views.change_request_decide_view),
    path("emergencies/", views.emergencies_view),
    path("emergencies/<int:emergency_id>/", views.emergency_detail_view),
    path("family/", views.family_view),
    path("family/<int:member_id>/", views.family_detail_view),
    path("resources/", views.resources_view),
    path("news/", views.news_view),
    path("news/<int:post_id>/", views.news_detail_view),
    path("news-settings/", views.news_settings_view),
    path("clinical-docs/", views.clinical_docs_view),
    path("manager/dashboard/", views.manager_dashboard_view),
]
