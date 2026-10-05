from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST

from events.models import Event
from student_registration.models import Registration
from .forms import ParticipantFilterForm
from .models import Attendance

# Change this if your teammate uses a different word, e.g. "cancelled"
CANCELLED_STATUS = 'Cancelled'


# ---------- Helpers ----------

def admin_required(view_func):
    """Only logged-in staff/superusers may open the page."""
    @login_required
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied          # shows a 403 page
        return view_func(request, *args, **kwargs)
    return wrapper


def get_phone(user):
    """Finds the phone number wherever the auth team stored it."""
    if hasattr(user, 'phone'):
        return user.phone
    profile = getattr(user, 'profile', None)
    if profile is not None and hasattr(profile, 'phone'):
        return profile.phone
    return 'N/A'


def build_rows(registrations):
    """Adds the phone number next to each registration."""
    return [{'reg': r, 'phone': get_phone(r.student)} for r in registrations]


# ---------- Story 4.1: Participant list ----------

@admin_required
def participant_list(request):
    events = Event.objects.all()
    selected_event = None
    rows = []

    event_id = request.GET.get('event')
    if event_id:
        selected_event = get_object_or_404(Event, pk=event_id)
        registrations = Registration.objects.filter(
            event=selected_event).select_related('student')
        rows = build_rows(registrations)

    context = {
        'events': events,
        'selected_event': selected_event,
        'rows': rows,
        'total': len(rows),
    }
    return render(request, 'participants/participant_list.html', context)


# ---------- Story 4.2: Manage participants (search + filter) ----------

@admin_required
def manage_participants(request):
    form = ParticipantFilterForm(request.GET or None)
    registrations = Registration.objects.select_related('student', 'event')

    if form.is_valid():
        q = form.cleaned_data['q']
        event = form.cleaned_data['event']
        status = form.cleaned_data['status']

        if q:
            registrations = registrations.filter(
                Q(student__first_name__icontains=q) |
                Q(student__last_name__icontains=q) |
                Q(student__username__icontains=q) |
                Q(student__email__icontains=q)
            )
        if event:
            registrations = registrations.filter(event=event)
        if status:
            registrations = registrations.filter(status=status)

    context = {
        'form': form,
        'rows': build_rows(registrations),
        'total': registrations.count(),
        'cancelled_status': CANCELLED_STATUS,
    }
    return render(request, 'participants/manage_participants.html', context)


@admin_required
def participant_details(request, pk):
    registration = get_object_or_404(
        Registration.objects.select_related('student', 'event'), pk=pk)
    attendance = Attendance.objects.filter(registration=registration).first()
    context = {
        'reg': registration,
        'phone': get_phone(registration.student),
        'attendance': attendance,
        'cancelled_status': CANCELLED_STATUS,
    }
    return render(request, 'participants/participant_details.html', context)


@admin_required
@require_POST                       # cancelling only works via a form POST
def cancel_registration(request, pk):
    registration = get_object_or_404(Registration, pk=pk)

    if registration.status == CANCELLED_STATUS:
        messages.error(request, 'This registration is already cancelled.')
    else:
        # We only change the status. The record is NOT deleted, so history is kept.
        registration.status = CANCELLED_STATUS
        registration.save()
        messages.success(request, 'Registration cancelled successfully.')

    # Go back to the page the admin came from
    return redirect(request.POST.get('next') or 'participants:manage_participants')


# ---------- Story 4.3: Attendance ----------

def event_stats(event):
    """Returns present / absent / total / percentage for one event."""
    active = Registration.objects.filter(event=event).exclude(status=CANCELLED_STATUS)
    total = active.count()
    records = Attendance.objects.filter(registration__in=active)
    present = records.filter(attendance_status=Attendance.PRESENT).count()
    absent = records.filter(attendance_status=Attendance.ABSENT).count()
    percentage = round(present / total * 100, 1) if total > 0 else 0
    return {'total': total, 'present': present, 'absent': absent,
            'percentage': percentage}


@admin_required
def attendance(request):
    events = Event.objects.all()
    event_id = request.GET.get('event')

    # No event chosen yet: show every event with its attendance percentage
    if not event_id:
        event_rows = [{'event': e, 'stats': event_stats(e)} for e in events]
        return render(request, 'participants/attendance.html',
                      {'event_rows': event_rows})

    event = get_object_or_404(Event, pk=event_id)
    registrations = Registration.objects.filter(event=event).exclude(
        status=CANCELLED_STATUS).select_related('student')

    # Save attendance when the form is submitted
    if request.method == 'POST':
        saved = 0
        for reg in registrations:
            value = request.POST.get(f'status_{reg.id}')
            if value in (Attendance.PRESENT, Attendance.ABSENT):
                # update_or_create: updates the row if it exists, else creates it.
                # This is what prevents duplicates.
                Attendance.objects.update_or_create(
                    student=reg.student,
                    event=event,
                    defaults={'registration': reg, 'attendance_status': value},
                )
                saved += 1
        if saved > 0:
            messages.success(request, f'Attendance saved for {saved} student(s).')
        else:
            messages.error(request, 'Nothing to save. Please mark at least one student.')
        return redirect(f'/participants/attendance/?event={event.id}')

    # Show the attendance list
    existing = {a.registration_id: a.attendance_status
                for a in Attendance.objects.filter(event=event)}
    rows = [{'reg': r, 'status': existing.get(r.id, '')} for r in registrations]

    context = {
        'event': event,
        'rows': rows,
        'stats': event_stats(event),
    }
    return render(request, 'participants/attendance.html', context)
