from django.urls import path

from . import views

app_name = "events"

urlpatterns = [
	path("", views.event_list, name="event_list"),
	path("events/new/", views.create_event, name="create_event"),
	path("events/<int:pk>/", views.event_detail, name="event_detail"),
	path("events/<int:pk>/edit/", views.edit_event, name="edit_event"),
	path("events/<int:pk>/delete/", views.delete_event, name="delete_event"),
]