from django.db import models
from accounts.models import User


class ChatRoom(models.Model):
    """
    Model for chat rooms between users.
    """
    name = models.CharField(max_length=255)
    participants = models.ManyToManyField(User, related_name='chat_rooms')
    whiteboard_data = models.TextField(default='[]')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name


class ChatMessage(models.Model):
    """
    Model for chat messages in chat rooms.
    """
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username} in {self.room.name}: {self.content[:50]}"
