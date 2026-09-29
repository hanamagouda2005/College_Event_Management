from django.conf import settings
from django.db import models


class Attendance(models.Model):
    PRESENT = 'present'
    ABSENT = 'absent'
    STATUS_CHOICES = [
        (PRESENT, 'Present'),
        (ABSENT, 'Absent'),
    ]

    # Strings like 'events.Event' point to the other apps' models,
    # so we never copy or duplicate them.
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    registration = models.ForeignKey(
        'student_registration.Registration',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    attendance_status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=ABSENT
    )
    attendance_date = models.DateTimeField(auto_now=True)  # updates on every save

    class Meta:
        # Prevents duplicate attendance for the same student and event
        unique_together = ('student', 'event')

    def __str__(self):
        return f"{self.student} - {self.event} - {self.attendance_status}"
