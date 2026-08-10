import os
import traceback
from json import dumps

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'farm_erp.settings')
import django

django.setup()

from django.test import Client

client = Client()

try:
    response = client.post(
        '/api/auth/login/',
        dumps({'username': 'test', 'password': 'test'}),
        content_type='application/json',
    )
    print('status:', response.status_code)
    print('content:')
    print(response.content.decode('utf-8'))
except Exception:
    traceback.print_exc()
