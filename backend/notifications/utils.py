import logging

from django.conf import settings
from django.core.mail import send_mail, send_mass_mail

from .models import Notification

logger = logging.getLogger(__name__)


def create_notification(*, recipient, notification_type, title, message, link=''):
    """Create an in-app notification and send a corresponding email."""
    notification = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )

    if recipient.email:
        try:
            send_mail(
                subject=title,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient.email],
                fail_silently=True,
            )
        except Exception:
            logger.exception('Failed to send notification email to %s', recipient.email)

    return notification


def create_bulk_notifications(*, recipients, notification_type, title, message, link=''):
    """Create in-app notifications for multiple recipients and send emails."""
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
                (title, message, settings.DEFAULT_FROM_EMAIL, [recipient.email])
            )

    if email_messages:
        try:
            send_mass_mail(email_messages, fail_silently=True)
        except Exception:
            logger.exception('Failed to send bulk notification emails for: %s', title)

    return notifications
