from django.contrib import admin

from .models import OutlookIntakeRule, ProcuraFieldMapping

admin.site.register(ProcuraFieldMapping)
admin.site.register(OutlookIntakeRule)
