from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token

from courses.models import Course, Enrollment, Feedback
from accounts.models import StatusUpdate, Invitation
from notifications.models import Notification

User = get_user_model()


class Command(BaseCommand):
    help = 'Populate database with demo users, invitations, and sample data'

    def handle(self, *args, **kwargs):
        # ── Registered accounts ──────────────────────────────────────

        self.stdout.write('Creating registered accounts...')

        admin_user = self._create_user(
            username='admin',
            email='admin@elearning.com',
            password='admin123',
            full_name='Admin User',
            user_type='teacher',
            is_staff=True,
            is_superuser=True,
        )

        teacher1 = self._create_user(
            username='john_teacher',
            email='john@elearning.com',
            password='teacher123',
            full_name='John Smith',
            user_type='teacher',
            bio='Experienced computer science professor with 10 years of teaching experience.',
            phone_number='+1-555-0101',
            date_of_birth=date(1980, 3, 15),
        )

        teacher2 = self._create_user(
            username='maria_teacher',
            email='maria@elearning.com',
            password='teacher123',
            full_name='Maria Garcia',
            user_type='teacher',
            bio='Mathematics educator passionate about making learning fun and accessible.',
            phone_number='+1-555-0102',
            date_of_birth=date(1985, 7, 22),
        )

        student1 = self._create_user(
            username='alice_student',
            email='alice@elearning.com',
            password='student123',
            full_name='Alice Johnson',
            user_type='student',
            bio='Computer Science student eager to learn new technologies.',
            phone_number='+1-555-0201',
            date_of_birth=date(2002, 1, 10),
        )

        student2 = self._create_user(
            username='bob_student',
            email='bob@elearning.com',
            password='student123',
            full_name='Bob Williams',
            user_type='student',
            bio='Passionate about web development and design.',
            phone_number='+1-555-0202',
            date_of_birth=date(2001, 5, 18),
        )

        student3 = self._create_user(
            username='charlie_student',
            email='charlie@elearning.com',
            password='student123',
            full_name='Charlie Brown',
            user_type='student',
            bio='Mathematics enthusiast and problem solver.',
            phone_number='+1-555-0203',
            date_of_birth=date(2003, 11, 30),
        )

        # Students who registered via invitation (accepted invitations)
        student4 = self._create_user(
            username='diana_student',
            email='diana@school.edu',
            password='student123',
            full_name='Diana Prince',
            user_type='student',
            bio='Interested in data science and machine learning.',
            phone_number='+1-555-0204',
            date_of_birth=date(2002, 6, 14),
        )

        student5 = self._create_user(
            username='ethan_student',
            email='ethan@school.edu',
            password='student123',
            full_name='Ethan Hunt',
            user_type='student',
            bio='Cybersecurity enthusiast.',
            phone_number='+1-555-0205',
            date_of_birth=date(2001, 9, 3),
        )

        # ── Auth tokens ─────────────────────────────────────────────

        self.stdout.write('Creating auth tokens...')
        for u in [admin_user, teacher1, teacher2, student1, student2, student3, student4, student5]:
            Token.objects.get_or_create(user=u)

        # ── Status updates ───────────────────────────────────────────

        self.stdout.write('Creating status updates...')

        StatusUpdate.objects.get_or_create(
            user=student1,
            content='Excited to start learning Django! Looking forward to building amazing web applications.'
        )
        StatusUpdate.objects.get_or_create(
            user=student2,
            content='Just finished my first Python project. Programming is so much fun!'
        )
        StatusUpdate.objects.get_or_create(
            user=teacher1,
            content='Looking forward to teaching the new Web Development course this semester!'
        )
        StatusUpdate.objects.get_or_create(
            user=student4,
            content='Just registered via the invite link. Thanks for adding me to the platform!'
        )

        # ── Courses ──────────────────────────────────────────────────

        self.stdout.write('Creating courses...')

        course1, _ = Course.objects.get_or_create(
            code='CS101',
            defaults={
                'title': 'Introduction to Python Programming',
                'description': 'Learn the fundamentals of Python programming.',
                'teacher': teacher1,
                'is_active': True,
            }
        )

        course2, _ = Course.objects.get_or_create(
            code='CS201',
            defaults={
                'title': 'Advanced Web Development with Django',
                'description': 'Master Django framework for building scalable web applications.',
                'teacher': teacher1,
                'is_active': True,
            }
        )

        course3, _ = Course.objects.get_or_create(
            code='MATH101',
            defaults={
                'title': 'Calculus I',
                'description': 'Introduction to differential and integral calculus.',
                'teacher': teacher2,
                'is_active': True,
            }
        )

        course4, _ = Course.objects.get_or_create(
            code='CS301',
            defaults={
                'title': 'Data Structures and Algorithms',
                'description': 'Study fundamental data structures and algorithms.',
                'teacher': teacher1,
                'is_active': True,
            }
        )

        # ── Enrollments ──────────────────────────────────────────────

        self.stdout.write('Creating enrollments...')

        for student, course in [
            (student1, course1), (student1, course2),
            (student2, course1), (student2, course2),
            (student3, course3),
            (student4, course1), (student4, course4),
            (student5, course2),
        ]:
            Enrollment.objects.get_or_create(student=student, course=course, defaults={'is_active': True})

        # ── Feedback ─────────────────────────────────────────────────

        self.stdout.write('Creating feedback...')

        Feedback.objects.get_or_create(course=course1, student=student1, defaults={'rating': 5, 'comment': 'Excellent course!'})
        Feedback.objects.get_or_create(course=course1, student=student2, defaults={'rating': 4, 'comment': 'Great content, needs more exercises.'})
        Feedback.objects.get_or_create(course=course3, student=student3, defaults={'rating': 5, 'comment': 'Amazing teacher!'})

        # ── Notifications ────────────────────────────────────────────

        self.stdout.write('Creating notifications...')

        Notification.objects.get_or_create(
            recipient=teacher1,
            notification_type='enrollment',
            defaults={
                'title': 'New enrollment in CS101',
                'message': 'alice_student has enrolled in Introduction to Python Programming.',
                'link': f'/courses/{course1.pk}/',
            }
        )

        # ── Invitations ──────────────────────────────────────────────

        self.stdout.write('Creating invitations...')

        # Accepted invitations (linked to diana & ethan who already registered)
        inv_accepted_1, created = Invitation.objects.get_or_create(
            email='diana@school.edu',
            defaults={
                'invited_by': teacher1,
                'full_name': 'Diana Prince',
                'user_type': 'student',
                'date_of_birth': date(2002, 6, 14),
                'phone_number': '+1-555-0204',
                'bio': 'Interested in data science and machine learning.',
                'status': 'accepted',
                'created_user': student4,
                'expires_at': timezone.now() + timedelta(days=30),
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('  Accepted invitation: diana@school.edu'))

        inv_accepted_2, created = Invitation.objects.get_or_create(
            email='ethan@school.edu',
            defaults={
                'invited_by': teacher1,
                'full_name': 'Ethan Hunt',
                'user_type': 'student',
                'date_of_birth': date(2001, 9, 3),
                'phone_number': '+1-555-0205',
                'bio': 'Cybersecurity enthusiast.',
                'status': 'accepted',
                'created_user': student5,
                'expires_at': timezone.now() + timedelta(days=30),
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('  Accepted invitation: ethan@school.edu'))

        # Pending invitations (students who haven't registered yet)
        pending_invitees = [
            {
                'email': 'fiona@school.edu',
                'full_name': 'Fiona Green',
                'user_type': 'student',
                'date_of_birth': date(2003, 2, 20),
                'phone_number': '+1-555-0206',
                'bio': 'Aspiring software engineer.',
                'invited_by': teacher1,
            },
            {
                'email': 'george@school.edu',
                'full_name': 'George Martin',
                'user_type': 'student',
                'date_of_birth': date(2002, 8, 5),
                'phone_number': '+1-555-0207',
                'bio': 'Loves frontend development.',
                'invited_by': teacher1,
            },
            {
                'email': 'hannah@school.edu',
                'full_name': 'Hannah Lee',
                'user_type': 'student',
                'date_of_birth': date(2003, 4, 12),
                'phone_number': '+1-555-0208',
                'bio': 'Math and physics student.',
                'invited_by': teacher2,
            },
            {
                'email': 'ivan@school.edu',
                'full_name': 'Ivan Petrov',
                'user_type': 'student',
                'date_of_birth': date(2001, 12, 1),
                'phone_number': '+1-555-0209',
                'bio': 'Database and backend enthusiast.',
                'invited_by': teacher2,
            },
            {
                'email': 'julia@school.edu',
                'full_name': 'Julia Roberts',
                'user_type': 'student',
                'date_of_birth': date(2002, 10, 28),
                'phone_number': '+1-555-0210',
                'bio': 'Interested in AI and robotics.',
                'invited_by': teacher1,
            },
            {
                'email': 'new_teacher@school.edu',
                'full_name': 'Kevin Chen',
                'user_type': 'teacher',
                'date_of_birth': date(1990, 6, 15),
                'phone_number': '+1-555-0301',
                'bio': 'New physics teacher joining next semester.',
                'invited_by': admin_user,
            },
        ]

        for data in pending_invitees:
            invited_by = data.pop('invited_by')
            inv, created = Invitation.objects.get_or_create(
                email=data['email'],
                defaults={
                    **data,
                    'invited_by': invited_by,
                    'status': 'pending',
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Pending invitation: {data["email"]} (token: {inv.token[:20]}...)'))

        # Expired invitation
        inv_expired, created = Invitation.objects.get_or_create(
            email='expired_user@school.edu',
            defaults={
                'invited_by': teacher1,
                'full_name': 'Old Student',
                'user_type': 'student',
                'date_of_birth': date(2000, 1, 1),
                'phone_number': '+1-555-0299',
                'bio': 'This invitation has expired.',
                'status': 'expired',
                'expires_at': timezone.now() - timedelta(days=5),
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('  Expired invitation: expired_user@school.edu'))

        # ── Summary ──────────────────────────────────────────────────

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Database populated successfully!'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')
        self.stdout.write('Registered accounts (username / password):')
        self.stdout.write('  Admin:    admin / admin123')
        self.stdout.write('  Teacher:  john_teacher / teacher123')
        self.stdout.write('  Teacher:  maria_teacher / teacher123')
        self.stdout.write('  Student:  alice_student / student123')
        self.stdout.write('  Student:  bob_student / student123')
        self.stdout.write('  Student:  charlie_student / student123')
        self.stdout.write('  Student:  diana_student / student123  (registered via invite)')
        self.stdout.write('  Student:  ethan_student / student123  (registered via invite)')
        self.stdout.write('')
        self.stdout.write('Pending invitations (not yet registered):')
        pending = Invitation.objects.filter(status='pending')
        for inv in pending:
            self.stdout.write(f'  {inv.email:30s} token: {inv.token[:30]}...')
        self.stdout.write('')
        self.stdout.write(f'  Use link: http://localhost:5173/invite/<token>')
        self.stdout.write('')
        self.stdout.write('Expired invitations:')
        self.stdout.write('  expired_user@school.edu')

    def _create_user(self, username, email, password, full_name, user_type, **extra):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'full_name': full_name,
                'user_type': user_type,
                **{k: v for k, v in extra.items() if v is not None},
            }
        )
        if created:
            user.set_password(password)
            for k, v in extra.items():
                if v is not None:
                    setattr(user, k, v)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'  Created {user_type}: {username} / {password}'))
        return user
