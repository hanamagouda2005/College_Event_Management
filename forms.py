from django import forms
from events.models import Event
from student_registration.models import Registration


class ParticipantFilterForm(forms.Form):
    q = forms.CharField(required=False, label='Search',
                        widget=forms.TextInput(attrs={'placeholder': 'Name or email'}))
    event = forms.ModelChoiceField(queryset=Event.objects.all(),
                                   required=False, empty_label='All events')
    status = forms.ChoiceField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Build the status dropdown from the values that really exist
        statuses = Registration.objects.values_list('status', flat=True).distinct()
        choices = [('', 'All statuses')] + [(s, s) for s in statuses]
        self.fields['status'].choices = choices
