from django.urls import path

from . import views

urlpatterns = [
    path("catalog/", views.report_catalog_view),
    path("run/", views.run_report_view),
    path("export/", views.export_report_view),
]