import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail, send_mass_mail

logger = logging.getLogger(__name__)


@shared_task
def send_notification_email(title, message, recipient_email):
    """Send a single notification email asynchronously."""
    try:
        send_mail(
            subject=title,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Failed to send notification email to %s', recipient_email)


@shared_task
def send_bulk_notification_emails(email_messages_data):
    """Send multiple notification emails asynchronously.

    email_messages_data: list of [subject, message, from_email, [recipient]]
    """
    if not email_messages_data:
        return
    try:
        email_tuples = [tuple(em) for em in email_messages_data]
        send_mass_mail(email_tuples, fail_silently=True)
    except Exception:
        logger.exception('Failed to send bulk notification emails')


@shared_task
def send_invitation_email(invitation_id):
    """Send invitation email asynchronously."""
    from accounts.models import Invitation

    try:
        invitation = Invitation.objects.select_related('invited_by').get(pk=invitation_id)
    except Invitation.DoesNotExist:
        logger.error('Invitation %s not found', invitation_id)
        return

    frontend_base = (
        settings.CORS_ALLOWED_ORIGINS[0]
        if settings.CORS_ALLOWED_ORIGINS
        else 'http://localhost:5173'
    )
    invite_url = f"{frontend_base}/invite/{invitation.token}"

    subject = 'You have been invited to the eLearning Platform'
    message = (
        f"Hello {invitation.full_name or 'there'},\n\n"
        f"You have been invited to join the eLearning Platform "
        f"as a {invitation.get_user_type_display()} "
        f"by {invitation.invited_by.full_name or invitation.invited_by.username}.\n\n"
        f"Click the following link to complete your registration:\n"
        f"{invite_url}\n\n"
        f"This link will expire on {invitation.expires_at.strftime('%B %d, %Y')}.\n\n"
        f"If you did not expect this invitation, you can ignore this email.\n\n"
        f"Best regards,\n"
        f"eLearning Platform"
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [invitation.email],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Failed to send invitation email to %s', invitation.email)
