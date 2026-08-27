#!/bin/sh
set -e

# Some apps ship models without checked-in migrations; generate them first so
# `migrate` never leaves the schema behind the code.
echo "Ensuring migrations exist..."
python manage.py makemigrations accounts audit customers products sales stock expenses orders notifications --noinput || true

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Optional bootstrap superuser (set all three vars to enable).
# Skipped silently when the account already exists.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -c "
from django.contrib.auth import get_user_model
import os
U = get_user_model()
u = os.environ['DJANGO_SUPERUSER_USERNAME']
if U.objects.filter(username=u).exists():
    print('Superuser %s already exists; skipping.' % u)
else:
    U.objects.create_superuser(u, os.environ.get('DJANGO_SUPERUSER_EMAIL', ''), os.environ['DJANGO_SUPERUSER_PASSWORD'])
    print('Created superuser %s' % u)
"
fi

exec "$@"
