import re

from django import forms
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from .models import StudentProfile

User = get_user_model()


class StudentRegistrationForm(forms.Form):
    full_name = forms.CharField(max_length=150, min_length=2)
    email = forms.EmailField()
    phone_number = forms.CharField(max_length=15)
    password = forms.CharField(widget=forms.PasswordInput)
    confirm_password = forms.CharField(widget=forms.PasswordInput)

    def clean_full_name(self):
        full_name = self.cleaned_data['full_name'].strip()
        if not full_name:
            raise forms.ValidationError('Full name is required.')
        return full_name

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('This email is already registered. Please use another email.')
        return email

    def clean_phone_number(self):
        phone = self.cleaned_data['phone_number'].strip()
        if not re.fullmatch(r'^[0-9]{10,15}$', phone):
            raise forms.ValidationError('Phone number must contain only digits and be 10 to 15 characters long.')
        return phone

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')

        if password and confirm_password and password != confirm_password:
            raise forms.ValidationError('Password and confirm password do not match.')

        return cleaned_data


class StudentLoginForm(forms.Form):
    email = forms.EmailField(widget=forms.EmailInput(attrs={'placeholder': 'Enter your email'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': 'Enter your password'}))

    def clean_email(self):
        return self.cleaned_data['email'].strip().lower()


class StudentProfileForm(forms.ModelForm):
    email = forms.EmailField()

    class Meta:
        model = StudentProfile
        fields = ['full_name', 'phone_number']

    def __init__(self, *args, user=None, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
        if self.user:
            self.fields['email'].initial = self.user.email

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exclude(pk=self.user.pk).exists():
            raise ValidationError('This email is already registered. Please use another email.')
        return email

    def clean_phone_number(self):
        phone = self.cleaned_data['phone_number'].strip()
        if not re.fullmatch(r'^[0-9]{10,15}$', phone):
            raise ValidationError('Phone number must contain only digits and be 10 to 15 characters long.')
        return phone


class ChangePasswordForm(forms.Form):
    old_password = forms.CharField(widget=forms.PasswordInput)
    new_password = forms.CharField(widget=forms.PasswordInput)
    confirm_new_password = forms.CharField(widget=forms.PasswordInput)

    def __init__(self, *args, user=None, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_old_password(self):
        old_password = self.cleaned_data['old_password']
        if self.user and not self.user.check_password(old_password):
            raise forms.ValidationError('Old password is incorrect.')
        return old_password

    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get('new_password')
        confirm_new_password = cleaned_data.get('confirm_new_password')

        if new_password and confirm_new_password and new_password != confirm_new_password:
            raise forms.ValidationError('New password and confirm password do not match.')

        return cleaned_data
