from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .forms import ChangePasswordForm, StudentLoginForm, StudentProfileForm, StudentRegistrationForm
from .models import StudentProfile

User = get_user_model()


def register_view(request):
    if request.method == 'POST':
        form = StudentRegistrationForm(request.POST)
        if form.is_valid():
            cleaned = form.cleaned_data
            user = User.objects.create_user(
                username=cleaned['email'],
                email=cleaned['email'],
                password=cleaned['password'],
            )
            StudentProfile.objects.create(
                user=user,
                full_name=cleaned['full_name'],
                phone_number=cleaned['phone_number'],
            )
            messages.success(request, 'Registration successful! Please login to continue.')
            return redirect('login')
    else:
        form = StudentRegistrationForm()

    return render(request, 'events/register.html', {'form': form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = StudentLoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            user = authenticate(request, email=email, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, 'Login successful!')
                return redirect('dashboard')
            messages.error(request, 'Invalid email or password. Please try again.')
    else:
        form = StudentLoginForm()

    return render(request, 'events/login.html', {'form': form})


@login_required(login_url='login')
def dashboard_view(request):
    profile = request.user.student_profile
    return render(request, 'events/dashboard.html', {'profile': profile})


@login_required(login_url='login')
def profile_view(request):
    profile = request.user.student_profile

    if request.method == 'POST':
        profile_form = StudentProfileForm(request.POST, instance=profile, user=request.user)
        password_form = ChangePasswordForm(request.POST, user=request.user)

        if 'update_profile' in request.POST and profile_form.is_valid():
            profile_form.save()
            request.user.email = profile_form.cleaned_data['email']
            request.user.save()
            messages.success(request, 'Profile updated successfully.')
            return redirect('profile')

        if 'change_password' in request.POST and password_form.is_valid():
            request.user.set_password(password_form.cleaned_data['new_password'])
            request.user.save()
            messages.success(request, 'Password changed successfully.')
            return redirect('login')
    else:
        profile_form = StudentProfileForm(instance=profile, user=request.user)
        password_form = ChangePasswordForm(user=request.user)

    return render(
        request,
        'events/profile.html',
        {'profile_form': profile_form, 'password_form': password_form, 'profile': profile},
    )


@login_required(login_url='login')
def logout_view(request):
    logout(request)
    messages.success(request, 'You have been logged out.')
    return redirect('login')
