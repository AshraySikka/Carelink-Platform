#!/usr/bin/env bash
# Render build script for the CareLink backend.
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
# Migrations are committed to the repo, so production only ever runs migrate.
# After changing a model, run makemigrations locally and commit the result.
python manage.py migrate --no-input
