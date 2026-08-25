#!/usr/bin/env bash
# Render build script for the CareLink backend.
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
# makemigrations here covers the very first deploy. Best practice: run
# makemigrations locally once, commit the generated migrations folders, and
# then delete the next line so production only ever runs migrate.
python manage.py makemigrations accounts care messaging notifications integrations --no-input
python manage.py migrate --no-input
