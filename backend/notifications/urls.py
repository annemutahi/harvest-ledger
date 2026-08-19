from django.urls import path

from .views import dismiss, mark_read, notification_state

urlpatterns = [
    path("state/", notification_state, name="notification-state"),
    path("read/", mark_read, name="notification-read"),
    path("dismiss/", dismiss, name="notification-dismiss"),
]
