from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("care", "0005_change_request_reasons"),
    ]

    operations = [
        migrations.AddField(
            model_name="shift",
            name="geofence_override_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="shift",
            name="geofence_override_distance_meters",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
