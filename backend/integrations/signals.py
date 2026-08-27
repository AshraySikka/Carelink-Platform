"""
Keeps Resource embeddings in sync automatically.

Whenever a Resource is created or edited, from the admin Resources page,
seed data, anywhere, re-embed it as part of the same request. This runs
inline rather than through a background task queue since this project has
no worker process: the call is a single Gemini request, and resources are
edited far less often than they are read, so the extra latency on save is
a reasonable trade.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from care.models import Resource


@receiver(post_save, sender=Resource)
def reindex_resource_on_save(sender, instance, **kwargs):
    from . import embeddings
    try:
        embeddings.reindex_resource(instance)
    except Exception:
        # Never let an embedding failure block saving the resource itself.
        # Worst case the resource just isn't searchable by the AI agent
        # until the next save or a manual backfill_resource_embeddings run.
        pass
