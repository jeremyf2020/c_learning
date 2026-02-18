from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Classroom, ClassroomMessage


class ClassroomModelTest(TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='p')
        self.u2 = User.objects.create_user(username='u2', password='p')

    def test_str(self):
        room = Classroom.objects.create(name='Test Room')
        self.assertEqual(str(room), 'Test Room')

    def test_participants(self):
        room = Classroom.objects.create(name='Room')
        room.participants.add(self.u1, self.u2)
        self.assertEqual(room.participants.count(), 2)


class ClassroomMessageModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')
        self.room = Classroom.objects.create(name='Room')
        self.room.participants.add(self.user)

    def test_str(self):
        msg = ClassroomMessage.objects.create(
            room=self.room, sender=self.user, content='Hello world',
        )
        self.assertIn('u1', str(msg))
        self.assertIn('Room', str(msg))

    def test_ordering(self):
        m1 = ClassroomMessage.objects.create(room=self.room, sender=self.user, content='First')
        m2 = ClassroomMessage.objects.create(room=self.room, sender=self.user, content='Second')
        msgs = list(ClassroomMessage.objects.all())
        self.assertEqual(msgs[0], m1)
        self.assertEqual(msgs[1], m2)


class ClassroomAPITest(APITestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='p')
        self.u2 = User.objects.create_user(username='u2', password='p')
        self.token = Token.objects.create(user=self.u1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_create_classroom(self):
        res = self.client.post('/api/classrooms/', {
            'name': 'New Room',
            'participants': [self.u1.id, self.u2.id],
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Classroom.objects.count(), 1)

    def test_list_classrooms(self):
        room = Classroom.objects.create(name='Room')
        room.participants.add(self.u1)
        res = self.client.get('/api/classrooms/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 1)

    def test_send_message(self):
        room = Classroom.objects.create(name='Room')
        room.participants.add(self.u1)
        res = self.client.post(f'/api/classrooms/{room.id}/send/', {
            'content': 'Hello!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(ClassroomMessage.objects.count(), 1)

    def test_get_messages(self):
        room = Classroom.objects.create(name='Room')
        room.participants.add(self.u1)
        ClassroomMessage.objects.create(room=room, sender=self.u1, content='Hi')
        ClassroomMessage.objects.create(room=room, sender=self.u1, content='There')
        res = self.client.get(f'/api/classrooms/{room.id}/messages/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_send_message_unauthenticated(self):
        room = Classroom.objects.create(name='Room')
        self.client.credentials()
        res = self.client.post(f'/api/classrooms/{room.id}/send/', {
            'content': 'Hello!',
        })
        self.assertIn(res.status_code, [401, 403])
