from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Notification


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
