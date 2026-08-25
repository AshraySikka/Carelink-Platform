"""
Django settings for the CareLink backend.

Designed to run locally with SQLite for a quick start, and in production
on Render with a Neon Postgres database via the DATABASE_URL variable.
"""
from datetime import timedelta
from pathlib import Path
import os

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "insecure-dev-key-change-me")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    "channels",
    # CareLink apps
    "accounts",
    "care",
    "messaging",
    "notifications",
    "integrations",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "carelink_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "carelink_backend.wsgi.application"
ASGI_APPLICATION = "carelink_backend.asgi.application"

# Database. Neon Postgres in production via DATABASE_URL, SQLite fallback for local dev.
_db_url = os.getenv("DATABASE_URL", "").strip()
if _db_url:
    DATABASES = {"default": dj_database_url.parse(_db_url, conn_max_age=600, ssl_require=True)}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Realtime messaging uses the in memory channel layer. This works on a single
# server instance, which is what a Render web service gives you. If you scale
# to multiple instances later, switch to channels-redis and add a Redis URL.
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# AI assistant configuration. The key is optional so the demo runs without it.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Outlook intake placeholders. See integrations/outlook.py for the plan.
MS_GRAPH_TENANT_ID = os.getenv("MS_GRAPH_TENANT_ID", "")
MS_GRAPH_CLIENT_ID = os.getenv("MS_GRAPH_CLIENT_ID", "")
MS_GRAPH_CLIENT_SECRET = os.getenv("MS_GRAPH_CLIENT_SECRET", "")
OUTLOOK_INTAKE_MAILBOX = os.getenv("OUTLOOK_INTAKE_MAILBOX", "")
