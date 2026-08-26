from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("care", "0004_resource_audience"),
    ]

    operations = [
        migrations.AlterField(
            model_name="shift",
            name="status",
            field=models.CharField(
                choices=[
                    ("scheduled", "Scheduled"),
                    ("confirmed", "Confirmed"),
                    ("in_progress", "In Progress"),
                    ("completed", "Completed"),
                    ("change_requested", "Change Requested"),
                    ("approved_pending_change", "Approved, Pending Change"),
                    ("cancelled", "Cancelled"),
                ],
                default="scheduled",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="shiftchangerequest",
            name="request_type",
            field=models.CharField(
                choices=[("reschedule", "Reschedule"), ("cancel", "Cancel")],
                default="reschedule",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="shiftchangerequest",
            name="reason_code",
            field=models.CharField(
                choices=[
                    ("illness", "I'm sick and can't safely provide care"),
                    ("transportation", "Transportation problem (car trouble, no ride, etc.)"),
                    ("personal_emergency", "Personal emergency"),
                    ("family_emergency", "Family emergency"),
                    ("scheduling_conflict", "Double booked or scheduling conflict"),
                    ("weather", "Weather or unsafe travel conditions"),
                    ("client_no_longer_needs_visit", "Client no longer needs this visit"),
                    ("client_safety_concern", "Safety concern at the client's location"),
                    ("client_medical_emergency", "Client is having a medical emergency right now"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="shiftchangerequest",
            name="escalated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
