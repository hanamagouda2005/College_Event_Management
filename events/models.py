from django.db import models


class Event(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateField()
    time = models.TimeField()
    venue = models.CharField(max_length=200)
    max_participants = models.PositiveIntegerField()
    registration_deadline = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "time"]

    def __str__(self):
        return self.name

    @property
    def available_seats(self):
        # Registration records will be counted when that module is integrated.
        return self.max_participants

    @property
    def registration_is_open(self):
        from django.utils import timezone

        today = timezone.localdate()
        return today <= self.registration_deadline and self.date >= today
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=15)

    def __str__(self):
        return self.full_name
