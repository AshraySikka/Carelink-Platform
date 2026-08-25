"""Serializers for user accounts."""
from rest_framework import serializers

from .models import Hospital, User


class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = ["id", "name", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    """Full profile shape returned to the signed in user and to admins."""
    hospital_name = serializers.CharField(source="hospital.name", read_only=True, default=None)
    manager_name = serializers.CharField(source="manager.full_name", read_only=True, default=None)
    program_ids = serializers.PrimaryKeyRelatedField(source="programs", many=True, read_only=True)
    program_names = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role", "hospital", "hospital_name",
            "manager", "manager_name", "invite_status", "address", "latitude", "longitude",
            "date_of_birth", "availability_schedule", "availability_notes", "min_weekly_hours",
            "program_ids", "program_names", "created_at",
        ]
        read_only_fields = ["id", "email", "role", "invite_status", "created_at"]

    def get_program_names(self, obj):
        return [p.name for p in obj.programs.all()]


class PublicNameSerializer(serializers.ModelSerializer):
    """Minimal shape used when one user needs to see another user's name only."""
    class Meta:
        model = User
        fields = ["id", "full_name", "role"]
