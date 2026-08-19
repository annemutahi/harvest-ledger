from django.contrib import admin

from .models import NotificationState


@admin.register(NotificationState)
class NotificationStateAdmin(admin.ModelAdmin):
    list_display = ("user", "key", "read_at", "dismissed_at", "updated_at")
    search_fields = ("key", "user__username")
