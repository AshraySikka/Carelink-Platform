"""Endpoints to list available reports, run one, and export one as Excel."""
import io

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrManager
from accounts.serializers import PublicNameSerializer
from .builders import REPORTS, staff_options_for


@api_view(["GET"])
@permission_classes([IsAdminOrManager])
def report_catalog_view(request):
    """The list of reports this user is allowed to run, for the picker UI."""
    available = [
        {"key": key, "label": cfg["label"], "staff_filter": cfg["staff_filter"], "status_options": cfg["status_options"]}
        for key, cfg in REPORTS.items() if request.user.role in cfg["roles"]
    ]
    staff = PublicNameSerializer(staff_options_for(request.user), many=True).data
    return Response({"reports": available, "staff": staff})


def _run(request):
    """Shared logic: validate the report key and permission, build columns and rows."""
    report_key = request.query_params.get("type")
    cfg = REPORTS.get(report_key)
    if cfg is None:
        return None, None, Response({"detail": "Unknown report type."}, status=400)
    if request.user.role not in cfg["roles"]:
        return None, None, Response({"detail": "You are not allowed to run this report."}, status=403)
    columns, rows = cfg["fn"](request.user, request.query_params)
    return columns, rows, None


@api_view(["GET"])
@permission_classes([IsAdminOrManager])
def run_report_view(request):
    columns, rows, error = _run(request)
    if error:
        return error
    return Response({"columns": columns, "rows": rows})


@api_view(["GET"])
@permission_classes([IsAdminOrManager])
def export_report_view(request):
    columns, rows, error = _run(request)
    if error:
        return error

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        return Response({"detail": "openpyxl is not installed on the server."}, status=500)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Report"
    sheet.append(columns)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in rows:
        sheet.append(row)
    for i, column_cells in enumerate(sheet.columns, start=1):
        longest = max((len(str(c.value)) for c in column_cells if c.value is not None), default=10)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max(longest + 2, 10), 50)

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    report_key = request.query_params.get("type", "report")
    response = HttpResponse(buffer.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = f'attachment; filename="{report_key}.xlsx"'
    return response