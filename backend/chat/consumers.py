import json
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, ChatMessage
from accounts.models import User


def find_room(room_name):
    """Find a ChatRoom by name, trying sanitized and original variants."""
    room = ChatRoom.objects.filter(name=room_name).first()
    if room:
        return room
    # Try replacing underscores with spaces (frontend sanitizes spaces to _)
    original_name = re.sub(r'_', ' ', room_name)
    if original_name != room_name:
        room = ChatRoom.objects.filter(name=original_name).first()
    return room


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat and whiteboard"""

    async def connect(self):
        """Handle WebSocket connection"""
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Verify room exists and user is a participant
        if not await self.is_participant(self.user.id, self.room_name):
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Join per-user group for targeted signaling messages
        self.user_group_name = f'{self.room_group_name}_user_{self.user.username}'
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

        # Send existing whiteboard state to the connecting client
        wb_data = await self.get_whiteboard_data(self.room_name)
        await self.send(text_data=json.dumps({
            'type': 'whiteboard_state',
            'actions': wb_data
        }))

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_join',
                'username': self.user.username
            }
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_leave',
                    'username': self.user.username
                }
            )

            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Receive message from WebSocket and dispatch by type"""
        data = json.loads(text_data)
        msg_type = data.get('type', 'chat')

        if msg_type == 'chat':
            message = data.get('message', '')
            if message.strip() and len(message) <= 5000:
                await self.save_message(self.user.id, self.room_name, message)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': message,
                        'username': self.user.username,
                        'user_type': self.user.user_type
                    }
                )

        elif msg_type in ('draw', 'line', 'text', 'erase'):
            # Teacher-only whiteboard actions
            if self.user.user_type != 'teacher':
                return
            action = {k: v for k, v in data.items()}
            await self.append_whiteboard_action(self.room_name, action)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': f'wb_{msg_type}',
                    'action': action
                }
            )

        elif msg_type == 'move':
            if self.user.user_type != 'teacher':
                return
            index = data.get('index')
            dx = data.get('dx', 0)
            dy = data.get('dy', 0)
            if index is None:
                return
            await self.move_whiteboard_action(self.room_name, index, dx, dy)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'wb_move',
                    'index': index,
                    'dx': dx,
                    'dy': dy
                }
            )

        elif msg_type == 'undo':
            if self.user.user_type != 'teacher':
                return
            removed = await self.pop_whiteboard_action(self.room_name)
            if removed is not None:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'wb_undo'}
                )

        elif msg_type == 'clear':
            if self.user.user_type != 'teacher':
                return
            await self.clear_whiteboard_data(self.room_name)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'wb_clear',
                    'action': {'type': 'clear'}
                }
            )

        # --- Audio streaming ---
        elif msg_type == 'audio_start':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'audio_signal',
                    'payload': {'type': 'audio_start', 'username': self.user.username}
                }
            )

        elif msg_type == 'audio_stop':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'audio_signal',
                    'payload': {'type': 'audio_stop'}
                }
            )

        elif msg_type == 'audio_data':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'audio_data',
                    'data': data.get('data', '')
                }
            )

    # --- Chat handlers ---

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'username': event['username'],
            'user_type': event['user_type']
        }))

    async def user_join(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_join',
            'username': event['username']
        }))

    async def user_leave(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_leave',
            'username': event['username']
        }))

    # --- Whiteboard handlers ---

    async def wb_draw(self, event):
        await self.send(text_data=json.dumps({
            **event['action'],
            'type': 'wb_draw',
        }))

    async def wb_line(self, event):
        await self.send(text_data=json.dumps({
            **event['action'],
            'type': 'wb_line',
        }))

    async def wb_text(self, event):
        await self.send(text_data=json.dumps({
            **event['action'],
            'type': 'wb_text',
        }))

    async def wb_erase(self, event):
        await self.send(text_data=json.dumps({
            **event['action'],
            'type': 'wb_erase',
        }))

    async def wb_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'wb_move',
            'index': event['index'],
            'dx': event['dx'],
            'dy': event['dy'],
        }))

    async def wb_undo(self, event):
        await self.send(text_data=json.dumps({'type': 'wb_undo'}))

    async def wb_clear(self, event):
        await self.send(text_data=json.dumps({
            'type': 'wb_clear'
        }))

    # --- Audio streaming handlers ---

    async def audio_signal(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    async def audio_data(self, event):
        # Don't echo audio back to the teacher
        if self.user.user_type == 'teacher':
            return
        await self.send(text_data=json.dumps({
            'type': 'audio_data',
            'data': event['data']
        }))

    # --- Database helpers ---

    @database_sync_to_async
    def is_participant(self, user_id, room_name):
        room = find_room(room_name)
        if not room:
            return False
        return room.participants.filter(id=user_id).exists()

    @database_sync_to_async
    def add_participant(self, user_id, room_name):
        user = User.objects.get(id=user_id)
        room = find_room(room_name)
        if room and user not in room.participants.all():
            room.participants.add(user)

    @database_sync_to_async
    def save_message(self, user_id, room_name, message):
        user = User.objects.get(id=user_id)
        room = find_room(room_name)
        if not room:
            return
        if user not in room.participants.all():
            room.participants.add(user)
        ChatMessage.objects.create(room=room, sender=user, content=message)

    @database_sync_to_async
    def get_whiteboard_data(self, room_name):
        room = find_room(room_name)
        if room and room.whiteboard_data:
            try:
                return json.loads(room.whiteboard_data)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @database_sync_to_async
    def pop_whiteboard_action(self, room_name):
        room = find_room(room_name)
        if not room:
            return None
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if not actions:
            return None
        removed = actions.pop()
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])
        return removed

    MAX_WHITEBOARD_ACTIONS = 500

    @database_sync_to_async
    def append_whiteboard_action(self, room_name, action):
        room = find_room(room_name)
        if not room:
            return
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if len(actions) >= self.MAX_WHITEBOARD_ACTIONS:
            # Drop oldest actions to stay within limit
            actions = actions[-(self.MAX_WHITEBOARD_ACTIONS - 1):]
        actions.append(action)
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])

    @database_sync_to_async
    def move_whiteboard_action(self, room_name, index, dx, dy):
        room = find_room(room_name)
        if not room:
            return
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if index < 0 or index >= len(actions):
            return
        action = actions[index]
        if action.get('type') == 'text':
            action['x'] = action.get('x', 0) + dx
            action['y'] = action.get('y', 0) + dy
        elif action.get('type') == 'line':
            action['x1'] = action.get('x1', 0) + dx
            action['y1'] = action.get('y1', 0) + dy
            action['x2'] = action.get('x2', 0) + dx
            action['y2'] = action.get('y2', 0) + dy
        actions[index] = action
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])

    @database_sync_to_async
    def clear_whiteboard_data(self, room_name):
        room = find_room(room_name)
        if room:
            room.whiteboard_data = '[]'
            room.save(update_fields=['whiteboard_data'])
