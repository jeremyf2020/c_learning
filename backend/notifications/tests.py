from unittest.mock import patch

from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Notification
from .utils import create_notification, create_bulk_notifications


# ── Model Tests ──────────────────────────────────────────────────────

class NotificationModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')

    def test_str(self):
        n = Notification.objects.create(
            recipient=self.user,
            notification_type='general',
            title='Test',
            message='A message',
        )
        self.assertIn('u1', str(n))
        self.assertIn('Test', str(n))

    def test_default_is_read_false(self):
        n = Notification.objects.create(
            recipient=self.user,
            notification_type='enrollment',
            title='Enrolled',
            message='Someone enrolled',
        )
        self.assertFalse(n.is_read)

    def test_ordering(self):
        n1 = Notification.objects.create(
            recipient=self.user, notification_type='general',
            title='First', message='1',
        )
        n2 = Notification.objects.create(
            recipient=self.user, notification_type='general',
            title='Second', message='2',
        )
        notifications = list(Notification.objects.all())
        self.assertEqual(notifications[0], n2)


# ── Notification API Tests ───────────────────────────────────────────

class NotificationAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')
        self.other = User.objects.create_user(username='u2', password='p')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_list_notifications(self):
        Notification.objects.create(
            recipient=self.user, notification_type='general',
            title='Test', message='Hello',
        )
        Notification.objects.create(
            recipient=self.other, notification_type='general',
            title='Other', message='Not mine',
        )
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_list_empty(self):
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_mark_read(self):
        n = Notification.objects.create(
            recipient=self.user, notification_type='general',
            title='Test', message='Hello',
        )
        res = self.client.post(f'/api/notifications/{n.id}/mark_read/')
        self.assertEqual(res.status_code, 200)
        n.refresh_from_db()
        self.assertTrue(n.is_read)

    def test_mark_all_read(self):
        Notification.objects.create(
            recipient=self.user, notification_type='general',
            title='N1', message='M1',
        )
        Notification.objects.create(
            recipient=self.user, notification_type='enrollment',
            title='N2', message='M2',
        )
        res = self.client.post('/api/notifications/mark_all_read/')
        self.assertEqual(res.status_code, 200)
        unread = Notification.objects.filter(recipient=self.user, is_read=False).count()
        self.assertEqual(unread, 0)

    def test_mark_all_read_doesnt_affect_others(self):
        Notification.objects.create(
            recipient=self.other, notification_type='general',
            title='Other', message='Not mine',
        )
        self.client.post('/api/notifications/mark_all_read/')
        n = Notification.objects.get(recipient=self.other)
        self.assertFalse(n.is_read)

    def test_unauthenticated_access(self):
        self.client.credentials()
        res = self.client.get('/api/notifications/')
        self.assertIn(res.status_code, [401, 403])


# ── Utility Function Tests ────────────────────────────────────────────

class CreateNotificationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='student1', password='p', email='student1@example.com',
        )
        self.user_no_email = User.objects.create_user(
            username='student2', password='p', email='',
        )

    @patch('notifications.utils.send_mail')
    def test_creates_notification_and_sends_email(self, mock_send):
        n = create_notification(
            recipient=self.user,
            notification_type='general',
            title='Test',
            message='Hello',
        )
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(n.recipient, self.user)
        mock_send.assert_called_once()

    @patch('notifications.utils.send_mail')
    def test_skips_email_when_no_email(self, mock_send):
        create_notification(
            recipient=self.user_no_email,
            notification_type='general',
            title='Test',
            message='Hello',
        )
        self.assertEqual(Notification.objects.count(), 1)
        mock_send.assert_not_called()

    @patch('notifications.utils.send_mass_mail')
    def test_bulk_creates_notifications_and_sends_mass_email(self, mock_mass):
        results = create_bulk_notifications(
            recipients=[self.user, self.user_no_email],
            notification_type='material',
            title='New Material',
            message='A new file was uploaded.',
        )
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(len(results), 2)
        mock_mass.assert_called_once()
        # Only 1 user has email, so 1 tuple in the mass mail call
        email_tuples = mock_mass.call_args[0][0]
        self.assertEqual(len(email_tuples), 1)

    @patch('notifications.utils.send_mail', side_effect=Exception('SMTP down'))
    def test_email_failure_does_not_crash(self, mock_send):
        n = create_notification(
            recipient=self.user,
            notification_type='general',
            title='Test',
            message='Hello',
        )
        self.assertIsNotNone(n)
        self.assertEqual(Notification.objects.count(), 1)
