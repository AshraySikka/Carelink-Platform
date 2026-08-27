"""
Turns Resource text into vectors and finds the closest ones to a question.

This is the RAG half of the AI layer. Chunking and embedding happen once,
whenever a Resource is created or edited (see signals.py). Search happens
per question: embed the question, compare it to every stored chunk with
cosine similarity, and hand the closest ones to Gemini as context through
the search_resources tool in tools.py.

Vectors are stored as plain JSON float lists on ResourceChunk rather than
a native Postgres vector column. At the scale of a resource library (tens
to low hundreds of chunks) comparing everything in Python is fast enough,
and it means this works identically on SQLite locally and Postgres in
production, no database extension to enable. If the resource library
grows into the thousands, the upgrade path is the pgvector extension
(Neon supports it) with an approximate nearest neighbor index, this
module is written so only semantic_search() below would need to change,
the chunking and embedding calls stay the same.
"""
import math

import requests
from django.conf import settings

EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
EMBEDDING_DIMENSIONS = 768
CHUNK_SIZE = 700  # characters, roughly a short paragraph


def _model_name() -> str:
    return getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")


def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list:
    """
    Returns a vector for one piece of text, or [] if embedding isn't
    available (no key, or the request failed). Callers treat an empty
    list as "skip this", never as an error to surface to the user.

    task_type matters: RETRIEVAL_DOCUMENT and RETRIEVAL_QUERY produce
    vectors tuned for search, an indexed chunk and the question asking
    about it land closer together than if both used the same generic
    encoding.
    """
    if not settings.GEMINI_API_KEY or not text.strip():
        return []
    url = EMBED_URL.format(model=_model_name())
    try:
        response = requests.post(
            f"{url}?key={settings.GEMINI_API_KEY}",
            json={
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["embedding"]["values"]
    except Exception:
        return []


def chunk_text(text: str) -> list:
    """Splits text into roughly paragraph sized pieces, merging short lines
    together so a chunk carries enough context to be useful on its own."""
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks, current = [], ""
    for p in paragraphs:
        if current and len(current) + len(p) + 1 > CHUNK_SIZE:
            chunks.append(current.strip())
            current = p
        else:
            current = f"{current}\n{p}" if current else p
    if current.strip():
        chunks.append(current.strip())
    if not chunks and text.strip():
        chunks = [text.strip()]
    return chunks


def cosine_similarity(a: list, b: list) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def reindex_resource(resource) -> int:
    """
    Rebuilds the stored chunks and vectors for one Resource. Safe to call
    repeatedly, every save just replaces what was there before. Returns
    how many chunks were embedded, mainly for the backfill command to
    report progress.
    """
    from .models import ResourceChunk

    ResourceChunk.objects.filter(resource=resource).delete()
    full_text = f"{resource.title}\n{resource.summary}\n{resource.content}"
    rows = []
    for chunk in chunk_text(full_text):
        vector = embed_text(chunk, task_type="RETRIEVAL_DOCUMENT")
        if vector:
            rows.append(ResourceChunk(resource=resource, text=chunk, embedding=vector))
    if rows:
        ResourceChunk.objects.bulk_create(rows)
    return len(rows)


def semantic_search(question: str, user, top_k: int = 5) -> list:
    """
    Returns the top_k ResourceChunk rows closest in meaning to the
    question, restricted to resources that are published and visible to
    the asking user's role, same audience rule the Resources page and
    the admin Resources screen already use.
    """
    from care.models import Resource
    from .models import ResourceChunk

    query_vector = embed_text(question, task_type="RETRIEVAL_QUERY")
    if not query_vector:
        return []

    visible_ids = [
        r.id for r in Resource.objects.filter(published=True)
        if not r.audience or user.role in r.audience
    ]
    if not visible_ids:
        return []

    chunks = ResourceChunk.objects.filter(resource_id__in=visible_ids).select_related("resource")
    scored = [(cosine_similarity(query_vector, c.embedding), c) for c in chunks if c.embedding]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    # 0.3 is a floor, not a tuned threshold, it just keeps obviously
    # unrelated chunks out when nothing in the library actually matches.
    return [c for score, c in scored[:top_k] if score > 0.3]
