from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=15)

    def __str__(self):
        return self.full_name
