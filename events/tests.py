from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .forms import EventForm
from .models import Event


class EventManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.event = Event.objects.create(
            name="Campus Fair",
            description="A campus event",
            date=self.today + timedelta(days=10),
            time=time(10, 0),
            venue="Main Quad",
            max_participants=100,
            registration_deadline=self.today + timedelta(days=5),
        )

    def event_form_data(self, **changes):
        data = {
            "name": "New Event",
            "description": "Event description",
            "date": (self.today + timedelta(days=8)).isoformat(),
            "time": "11:30",
            "venue": "Student Hall",
            "max_participants": "20",
            "registration_deadline": (self.today + timedelta(days=3)).isoformat(),
        }
        data.update(changes)
        return data

    def test_form_rejects_past_event_date(self):
        form = EventForm(self.event_form_data(date=(self.today - timedelta(days=1)).isoformat()))
        self.assertFalse(form.is_valid())
        self.assertIn("date", form.errors)

    def test_form_rejects_deadline_after_event(self):
        form = EventForm(
            self.event_form_data(
                date=(self.today + timedelta(days=3)).isoformat(),
                registration_deadline=(self.today + timedelta(days=4)).isoformat(),
            )
        )
        self.assertFalse(form.is_valid())
        self.assertIn("registration_deadline", form.errors)

    def test_form_rejects_past_registration_deadline(self):
        form = EventForm(
            self.event_form_data(registration_deadline=(self.today - timedelta(days=1)).isoformat())
        )
        self.assertFalse(form.is_valid())
        self.assertIn("registration_deadline", form.errors)

    def test_form_rejects_zero_participants(self):
        form = EventForm(self.event_form_data(max_participants="0"))
        self.assertFalse(form.is_valid())
        self.assertIn("max_participants", form.errors)

    def test_staff_can_create_event(self):
        user = get_user_model().objects.create_user(username="staff", password="test-pass", is_staff=True)
        self.client.force_login(user)
        response = self.client.post(reverse("events:create_event"), self.event_form_data())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Event.objects.count(), 2)

    def test_staff_can_edit_event(self):
        user = get_user_model().objects.create_user(username="editor", password="test-pass", is_staff=True)
        self.client.force_login(user)
        data = self.event_form_data(name="Updated Campus Fair")
        response = self.client.post(reverse("events:edit_event", args=[self.event.pk]), data)
        self.assertEqual(response.status_code, 302)
        self.event.refresh_from_db()
        self.assertEqual(self.event.name, "Updated Campus Fair")

    def test_non_staff_cannot_manage_events(self):
        user = get_user_model().objects.create_user(username="student", password="test-pass")
        self.client.force_login(user)
        for url in (
            reverse("events:create_event"),
            reverse("events:edit_event", args=[self.event.pk]),
            reverse("events:delete_event", args=[self.event.pk]),
        ):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302)
        self.assertEqual(Event.objects.count(), 1)

    def test_anonymous_user_cannot_create_event(self):
        response = self.client.get(reverse("events:create_event"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Event.objects.count(), 1)

    def test_public_can_view_details_and_delete_requires_post(self):
        listing = self.client.get(reverse("events:event_list"))
        self.assertEqual(listing.status_code, 200)
        self.assertContains(listing, self.event.name)

        detail = self.client.get(reverse("events:event_detail", args=[self.event.pk]))
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, "Available seats")
        self.assertContains(detail, f'data-event-id="{self.event.pk}"')
        self.assertContains(detail, "Register")

        staff = get_user_model().objects.create_user(username="manager", password="test-pass", is_staff=True)
        self.client.force_login(staff)
        delete_page = self.client.get(reverse("events:delete_event", args=[self.event.pk]))
        self.assertEqual(delete_page.status_code, 200)
        self.assertTrue(Event.objects.filter(pk=self.event.pk).exists())

    def test_staff_can_delete_event(self):
        user = get_user_model().objects.create_user(username="manager", password="test-pass", is_staff=True)
        self.client.force_login(user)
        response = self.client.post(reverse("events:delete_event", args=[self.event.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Event.objects.filter(pk=self.event.pk).exists())