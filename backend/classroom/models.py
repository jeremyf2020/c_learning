from django.db import models
from accounts.models import User


class Classroom(models.Model):
    """
    Model for classroom rooms between users.
    """
    name = models.CharField(max_length=255)
    participants = models.ManyToManyField(User, related_name='classrooms')
    whiteboard_data = models.TextField(default='[]')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        db_table = 'chat_chatroom'

    def __str__(self):
        return self.name


class ClassroomMessage(models.Model):
    """
    Model for messages in classroom rooms.
    """
    room = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        db_table = 'chat_chatmessage'

    def __str__(self):
        return f"{self.sender.username} in {self.room.name}: {self.content[:50]}"
