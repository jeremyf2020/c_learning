from django.db import models
from accounts.models import User


class Notification(models.Model):
    """
    Model for user notifications.
    Handles notifications for enrollments and new course materials.
    """
    NOTIFICATION_TYPE_CHOICES = (
        ('enrollment', 'New Enrollment'),
        ('material', 'New Material'),
        ('feedback', 'New Feedback'),
        ('general', 'General'),
    )

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username} - {self.title}"
