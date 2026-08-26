"""
Finds shift change requests still waiting on a decision while the shift
itself is getting close, and pings the manager again plus customer service
and admin directly, so someone with authority to decide (CS can now
approve/decline too, see change_request_decide_view) actually sees it
before nobody shows up for the client.

Run on a schedule, e.g. every 15 minutes:
    python manage.py escalate_change_requests

Safe to rerun: each request is escalated once (escalated_at gets set).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Roles
from care.models import ChangeRequestStatus, ShiftChangeRequest
from notifications.utils import notify, notify_role

# How close to the shift's start a still-pending request has to be before
# it gets escalated. Tune to how much lead time CS actually needs.
ESCALATION_WINDOW_HOURS = 3


class Command(BaseCommand):
    help = "Escalate shift change requests still pending as the shift start time approaches."

    def handle(self, *args, **options):
        now = timezone.now()
        cutoff = now + timedelta(hours=ESCALATION_WINDOW_HOURS)

        stale = ShiftChangeRequest.objects.filter(
            status=ChangeRequestStatus.PENDING,
            escalated_at__isnull=True,
            shift__start_time__lte=cutoff,
        ).select_related("shift", "shift__client", "shift__field_staff", "requested_by", "manager")

        count = 0
        for change in stale:
            shift = change.shift
            overdue = shift.start_time <= now
            urgency = "OVERDUE, the shift may already be uncovered" if overdue else f"shift starts {shift.start_time:%b %d, %I:%M %p}"
            detail = (
                f"{change.requested_by.full_name}'s {change.request_type} request for "
                f"{shift.client.full_name}'s shift is still pending. {urgency}. Reason: {change.reason}"
            )

            if change.manager:
                notify(change.manager, "approvals", "Action needed: unanswered change request", detail, link="/approvals")
            notify_role(Roles.CUSTOMER_SERVICE, "approvals", "Unanswered change request needs coverage", detail, link="/cs/change-requests")
            notify_role(Roles.ADMIN, "approvals", "Unanswered change request needs coverage", detail, link="/cs/change-requests")

            change.escalated_at = now
            change.save(update_fields=["escalated_at"])
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Escalated {count} pending change request(s)."))
