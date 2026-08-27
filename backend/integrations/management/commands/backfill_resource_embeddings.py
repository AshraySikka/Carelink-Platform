"""
One time (or run anytime you want) command to embed every Resource.

Run this once right after deploying the AI upgrade, so the resource
search tool has something to search from day one instead of waiting for
someone to re-save each resource by hand. Safe to run again later too,
for example after bulk importing resources outside the admin panel,
where the post_save signal would not have fired for each one.

Usage: python manage.py backfill_resource_embeddings
"""
from django.core.management.base import BaseCommand

from care.models import Resource
from integrations import embeddings


class Command(BaseCommand):
    help = "Rebuilds embedded, searchable chunks for every Resource."

    def handle(self, *args, **options):
        resources = Resource.objects.all()
        if not resources.exists():
            self.stdout.write("No resources found, nothing to embed.")
            return

        total_chunks = 0
        for resource in resources:
            count = embeddings.reindex_resource(resource)
            total_chunks += count
            self.stdout.write(f"  {resource.title}: {count} chunk(s)")

        self.stdout.write(self.style.SUCCESS(
            f"Embedded {total_chunks} chunk(s) across {resources.count()} resource(s)."
        ))
