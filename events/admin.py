from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "date", "time", "venue", "max_participants")
    list_filter = ("date",)
    search_fields = ("name", "venue")