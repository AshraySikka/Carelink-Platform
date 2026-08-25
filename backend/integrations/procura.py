"""
Procura (AlayaCare) sync. PLACEHOLDER MODULE.

Procura access is typically granted through vendor arranged exports or
middleware rather than a self serve public API. Until the access method on
your contract is confirmed with the vendor, this module only validates the
field mapping table so the demo can show the intended flow end to end.
"""
from .models import ProcuraFieldMapping


def sync_from_procura():
    mappings = list(ProcuraFieldMapping.objects.values("procura_field", "carelink_field"))
    if not mappings:
        return {"status": "no_mappings", "detail": "Add field mappings in the admin panel first."}
    return {
        "status": "awaiting_vendor_access",
        "detail": "Field mappings are saved and ready. Connect the vendor supplied export or API here once Procura confirms your access method.",
        "mappings": mappings,
    }
