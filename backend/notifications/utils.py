import logging

from django.conf import settings

from .models import Notification
from .tasks import send_notification_email, send_bulk_notification_emails

logger = logging.getLogger(__name__)


def create_notification(*, recipient, notification_type, title, message, link=''):
    """Create an in-app notification and send a corresponding email via Celery."""
    notification = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )

    if recipient.email:
        send_notification_email.delay(title, message, recipient.email)

    return notification


def create_bulk_notifications(*, recipients, notification_type, title, message, link=''):
    """Create in-app notifications for multiple recipients and send emails via Celery."""
    notifications = []
    email_messages = []

    for recipient in recipients:
        notification = Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
        )
        notifications.append(notification)

        if recipient.email:
            email_messages.append(
                [title, message, settings.DEFAULT_FROM_EMAIL, [recipient.email]]
            )

    if email_messages:
        send_bulk_notification_emails.delay(email_messages)

    return notifications
