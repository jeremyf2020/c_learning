from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from .models import ChatRoom, ChatMessage


# ── Model Tests ──────────────────────────────────────────────────────

class ChatRoomModelTest(TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='p')
        self.u2 = User.objects.create_user(username='u2', password='p')

    def test_str(self):
        room = ChatRoom.objects.create(name='Test Room')
        self.assertEqual(str(room), 'Test Room')

    def test_participants(self):
        room = ChatRoom.objects.create(name='Room')
        room.participants.add(self.u1, self.u2)
        self.assertEqual(room.participants.count(), 2)


class ChatMessageModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')
        self.room = ChatRoom.objects.create(name='Room')
        self.room.participants.add(self.user)

    def test_str(self):
        msg = ChatMessage.objects.create(
            room=self.room, sender=self.user, content='Hello world',
        )
        self.assertIn('u1', str(msg))
        self.assertIn('Room', str(msg))

    def test_ordering(self):
        m1 = ChatMessage.objects.create(room=self.room, sender=self.user, content='First')
        m2 = ChatMessage.objects.create(room=self.room, sender=self.user, content='Second')
        msgs = list(ChatMessage.objects.all())
        self.assertEqual(msgs[0], m1)
        self.assertEqual(msgs[1], m2)


# ── ChatRoom API Tests ───────────────────────────────────────────────

class ChatRoomAPITest(APITestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='p')
        self.u2 = User.objects.create_user(username='u2', password='p')
        self.token = Token.objects.create(user=self.u1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_create_chatroom(self):
        res = self.client.post('/api/chatrooms/', {
            'name': 'New Room',
            'participants': [self.u1.id, self.u2.id],
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(ChatRoom.objects.count(), 1)

    def test_list_chatrooms(self):
        room = ChatRoom.objects.create(name='Room')
        room.participants.add(self.u1)
        res = self.client.get('/api/chatrooms/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 1)

    def test_send_message(self):
        room = ChatRoom.objects.create(name='Room')
        room.participants.add(self.u1)
        res = self.client.post(f'/api/chatrooms/{room.id}/send/', {
            'content': 'Hello!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(ChatMessage.objects.count(), 1)

    def test_get_messages(self):
        room = ChatRoom.objects.create(name='Room')
        room.participants.add(self.u1)
        ChatMessage.objects.create(room=room, sender=self.u1, content='Hi')
        ChatMessage.objects.create(room=room, sender=self.u1, content='There')
        res = self.client.get(f'/api/chatrooms/{room.id}/messages/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_send_message_unauthenticated(self):
        room = ChatRoom.objects.create(name='Room')
        self.client.credentials()
        res = self.client.post(f'/api/chatrooms/{room.id}/send/', {
            'content': 'Hello!',
        })
        self.assertIn(res.status_code, [401, 403])
