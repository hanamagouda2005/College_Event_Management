from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.shortcuts import get_object_or_404, redirect, render

from .forms import EventForm
from .models import Event


def staff_required(view_function):
    return login_required(user_passes_test(lambda user: user.is_staff)(view_function))


def event_list(request):
    events = Event.objects.all()
    return render(request, "events/event_list.html", {"events": events})


@staff_required
def create_event(request):
    form = EventForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        event = form.save()
        messages.success(request, "Event created successfully.")
        return redirect("events:event_detail", pk=event.pk)
    return render(request, "events/create_event.html", {"form": form})


@staff_required
def edit_event(request, pk):
    event = get_object_or_404(Event, pk=pk)
    form = EventForm(request.POST or None, instance=event)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Event updated successfully.")
        return redirect("events:event_detail", pk=event.pk)
    return render(request, "events/edit_event.html", {"form": form, "event": event})


@staff_required
def delete_event(request, pk):
    event = get_object_or_404(Event, pk=pk)
    if request.method == "POST":
        event_name = event.name
        event.delete()
        messages.success(request, f'"{event_name}" was deleted.')
        return redirect("events:event_list")
    return render(request, "events/confirm_delete.html", {"event": event})


def event_detail(request, pk):
    event = get_object_or_404(Event, pk=pk)
    return render(request, "events/event_detail.html", {"event": event})