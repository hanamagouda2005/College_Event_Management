from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

User = get_user_model()


class StudentAuthTests(TestCase):
    def test_registration_creates_user_and_profile(self):
        response = self.client.post(
            reverse('register'),
            {
                'full_name': 'Alice Student',
                'email': 'alice@example.com',
                'phone_number': '9876543210',
                'password': 'StrongPass123',
                'confirm_password': 'StrongPass123',
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(User.objects.filter(email='alice@example.com').exists())

    def test_login_redirects_to_dashboard_for_valid_user(self):
        user = User.objects.create_user(
            username='student@example.com',
            email='student@example.com',
            password='StrongPass123',
        )
        self.client.post(
            reverse('login'),
            {'email': 'student@example.com', 'password': 'StrongPass123'},
        )
        self.assertIn('_auth_user_id', self.client.session)

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)
