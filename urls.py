from django.urls import path
from . import views

app_name = 'participants'

urlpatterns = [
    path('', views.participant_list, name='participant_list'),
    path('manage/', views.manage_participants, name='manage_participants'),
    path('details/<int:pk>/', views.participant_details, name='participant_details'),
    path('cancel/<int:pk>/', views.cancel_registration, name='cancel_registration'),
    path('attendance/', views.attendance, name='attendance'),
]
