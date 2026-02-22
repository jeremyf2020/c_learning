import csv
from datetime import date, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token

from courses.models import Course, Enrollment, Feedback
from accounts.models import StatusUpdate, Invitation
from notifications.models import Notification

User = get_user_model()

SEED_DIR = Path(__file__).resolve().parent.parent.parent.parent / 'seed_data'


def parse_date(value):
    """Parse a YYYY-MM-DD string into a date object, or return None."""
    if not value:
        return None
    y, m, d = value.split('-')
    return date(int(y), int(m), int(d))


def parse_bool(value):
    """Parse a string into a boolean."""
    return value.strip().lower() in ('true', '1', 'yes')


def read_csv(filename):
    """Read a CSV file from the seed_data directory and return rows as dicts."""
    path = SEED_DIR / filename
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


class Command(BaseCommand):
    help = 'Populate database with demo data from CSV files in seed_data/'

    def handle(self, *args, **kwargs):
        users = self._load_users()
        self._load_courses(users)
        self._load_enrollments(users)
        self._load_feedback(users)
        self._load_status_updates(users)
        self._load_invitations(users)
        self._print_summary(users)

    def _load_users(self):
        """Create user accounts from seed_data/users.csv and generate auth tokens."""
        self.stdout.write('Loading users from users.csv...')
        users = {}

        for row in read_csv('users.csv'):
            user, created = User.objects.get_or_create(
                username=row['username'],
                defaults={
                    'email': row['email'],
                    'full_name': row['full_name'],
                    'user_type': row['user_type'],
                    'bio': row.get('bio', ''),
                    'phone_number': row.get('phone_number', ''),
                    'date_of_birth': parse_date(row.get('date_of_birth', '')),
                    'is_staff': parse_bool(row.get('is_staff', 'false')),
                    'is_superuser': parse_bool(row.get('is_superuser', 'false')),
                },
            )
            if created:
                user.set_password(row['password'])
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  Created {row["user_type"]}: {row["username"]} / {row["password"]}'
                ))

            Token.objects.get_or_create(user=user)
            users[row['username']] = user

        return users

    def _load_courses(self, users):
        """Create courses from seed_data/courses.csv."""
        self.stdout.write('Loading courses from courses.csv...')

        for row in read_csv('courses.csv'):
            course, created = Course.objects.get_or_create(
                code=row['code'],
                defaults={
                    'title': row['title'],
                    'description': row['description'],
                    'teacher': users[row['teacher_username']],
                    'is_active': True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created course: {row["code"]}'))

    def _load_enrollments(self, users):
        """Create enrollments from seed_data/enrollments.csv."""
        self.stdout.write('Loading enrollments from enrollments.csv...')

        for row in read_csv('enrollments.csv'):
            course = Course.objects.get(code=row['course_code'])
            _, created = Enrollment.objects.get_or_create(
                student=users[row['student_username']],
                course=course,
                defaults={'is_active': True},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Enrolled {row["student_username"]} in {row["course_code"]}'
                ))

    def _load_feedback(self, users):
        """Create feedback from seed_data/feedback.csv."""
        self.stdout.write('Loading feedback from feedback.csv...')

        for row in read_csv('feedback.csv'):
            course = Course.objects.get(code=row['course_code'])
            _, created = Feedback.objects.get_or_create(
                course=course,
                student=users[row['student_username']],
                defaults={
                    'rating': int(row['rating']),
                    'comment': row['comment'],
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Feedback: {row["student_username"]} → {row["course_code"]}'
                ))

    def _load_status_updates(self, users):
        """Create status updates from seed_data/status_updates.csv."""
        self.stdout.write('Loading status updates from status_updates.csv...')

        for row in read_csv('status_updates.csv'):
            _, created = StatusUpdate.objects.get_or_create(
                user=users[row['username']],
                content=row['content'],
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Status: {row["username"]}'
                ))

    def _load_invitations(self, users):
        """Create invitations from seed_data/invitations.csv."""
        self.stdout.write('Loading invitations from invitations.csv...')

        for row in read_csv('invitations.csv'):
            status = row['status']
            created_user_username = row.get('created_user_username', '').strip()

            defaults = {
                'invited_by': users[row['invited_by_username']],
                'full_name': row['full_name'],
                'user_type': row['user_type'],
                'date_of_birth': parse_date(row.get('date_of_birth', '')),
                'phone_number': row.get('phone_number', ''),
                'bio': row.get('bio', ''),
                'status': status,
            }

            if status == 'accepted' and created_user_username:
                defaults['created_user'] = users[created_user_username]
                defaults['expires_at'] = timezone.now() + timedelta(days=30)
            elif status == 'expired':
                defaults['expires_at'] = timezone.now() - timedelta(days=5)

            inv, created = Invitation.objects.get_or_create(
                email=row['email'],
                defaults=defaults,
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Invitation ({status}): {row["email"]}'
                ))

    def _print_summary(self, users):
        """Print a summary of all seeded data."""
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Database populated successfully!'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')

        self.stdout.write('Registered accounts (username / password):')
        for row in read_csv('users.csv'):
            role = 'Admin' if parse_bool(row.get('is_superuser', 'false')) else row['user_type'].title()
            self.stdout.write(f'  {role:10s} {row["username"]} / {row["password"]}')

        self.stdout.write('')
        self.stdout.write('Pending invitations (not yet registered):')
        for inv in Invitation.objects.filter(status='pending'):
            self.stdout.write(f'  {inv.email:30s} token: {inv.token[:30]}...')
        self.stdout.write(f'  Use link: http://localhost:5173/invite/<token>')

        self.stdout.write('')
        self.stdout.write('Expired invitations:')
        for inv in Invitation.objects.filter(status='expired'):
            self.stdout.write(f'  {inv.email}')
