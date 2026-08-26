"""Serializers for the care domain."""
from rest_framework import serializers

from .models import (
    ClinicalDocument, EmergencyRequest, FamilyMember, NewsPost, Program,
    Referral, ReferralDocument, Resource, Shift, ShiftChangeRequest,
)


class ProgramSerializer(serializers.ModelSerializer):
    staff_count = serializers.IntegerField(source="staff.count", read_only=True)

    class Meta:
        model = Program
        fields = ["id", "name", "description", "staff_count", "created_at"]


class ReferralDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralDocument
        fields = ["id", "file", "file_name", "created_at"]


class ReferralSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.full_name", read_only=True)
    assigned_staff_name = serializers.CharField(source="assigned_staff.full_name", read_only=True, default=None)
    documents = ReferralDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id", "hospital", "hospital_name", "submitted_by", "submitted_by_name",
            "client_name", "client_details", "intake_data", "urgency", "status",
            "assigned_staff", "assigned_staff_name", "concerns_flag", "notes",
            "source", "documents", "created_at", "updated_at",
        ]
        read_only_fields = ["hospital", "submitted_by", "source"]


class ShiftSerializer(serializers.ModelSerializer):
    field_staff_name = serializers.CharField(source="field_staff.full_name", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)

    class Meta:
        model = Shift
        fields = [
            "id", "field_staff", "field_staff_name", "client", "client_name",
            "start_time", "end_time", "location", "status", "notes",
            "change_request_note", "requested_start_time", "requested_end_time",
            "on_my_way_at", "clock_in_at", "clock_out_at", "geofence_override",
            "cancelled_at", "cancel_reason", "created_at",
        ]


class ShiftChangeRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True)
    decided_by_name = serializers.CharField(source="decided_by.full_name", read_only=True, default=None)
    shift_detail = ShiftSerializer(source="shift", read_only=True)

    class Meta:
        model = ShiftChangeRequest
        fields = [
            "id", "shift", "shift_detail", "requested_by", "requested_by_name",
            "manager", "reason", "requested_start_time", "requested_end_time",
            "status", "decided_by", "decided_by_name", "decision_note", "decided_at", "created_at",
        ]
        read_only_fields = ["requested_by", "manager", "status", "decided_by", "decided_at"]


class EmergencySerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True, default=None)
    reporter_name = serializers.CharField(source="reporter.full_name", read_only=True, default=None)

    class Meta:
        model = EmergencyRequest
        fields = ["id", "client", "client_name", "reporter", "reporter_name", "source", "description", "status", "resolution_notes", "created_at"]


class FamilyMemberSerializer(serializers.ModelSerializer):
    linked = serializers.SerializerMethodField()
    client_name = serializers.CharField(source="client.full_name", read_only=True)

    class Meta:
        model = FamilyMember
        fields = ["id", "client_name", "family_name", "family_email", "family_user", "linked", "created_at"]

    def get_linked(self, obj):
        return obj.family_user_id is not None


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ["id", "title", "category", "summary", "content", "published", "audience", "created_at"]


class NewsPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsPost
        fields = ["id", "title", "body", "published", "audience", "created_at"]


class ClinicalDocumentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)

    class Meta:
        model = ClinicalDocument
        fields = ["id", "shift", "client", "client_name", "notes", "file", "file_name", "created_at"]
