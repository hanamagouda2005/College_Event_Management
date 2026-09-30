from django import forms
from django.utils import timezone

from .models import Event


class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = [
            "name",
            "description",
            "date",
            "time",
            "venue",
            "max_participants",
            "registration_deadline",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 5}),
            "date": forms.DateInput(attrs={"type": "date"}),
            "time": forms.TimeInput(attrs={"type": "time"}),
            "registration_deadline": forms.DateInput(attrs={"type": "date"}),
        }

    def clean_max_participants(self):
        maximum = self.cleaned_data["max_participants"]
        if maximum < 1:
            raise forms.ValidationError("Maximum participants must be at least 1.")
        return maximum

    def clean(self):
        cleaned_data = super().clean()
        event_date = cleaned_data.get("date")
        deadline = cleaned_data.get("registration_deadline")
        today = timezone.localdate()

        if event_date and event_date < today:
            self.add_error("date", "The event date cannot be in the past.")
        if deadline:
            if deadline < today:
                self.add_error("registration_deadline", "The registration deadline cannot be in the past.")
            if event_date and deadline > event_date:
                self.add_error("registration_deadline", "The deadline must be on or before the event date.")

        return cleaned_data