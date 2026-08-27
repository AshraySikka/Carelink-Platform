from django.contrib import admin

from .models import OutlookIntakeRule, ProcuraFieldMapping, ResourceChunk

admin.site.register(ProcuraFieldMapping)
admin.site.register(OutlookIntakeRule)


@admin.register(ResourceChunk)
class ResourceChunkAdmin(admin.ModelAdmin):
    """Read only: chunks are generated automatically, never edited by hand."""
    list_display = ["id", "resource", "created_at"]
    list_filter = ["resource"]
    search_fields = ["text", "resource__title"]
    readonly_fields = ["resource", "text", "embedding", "created_at"]

    def has_add_permission(self, request):
        return False
