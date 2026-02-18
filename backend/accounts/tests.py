import csv
import io
from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import User, StatusUpdate, Invitation


# ── Model Tests ──────────────────────────────────────────────────────

class UserModelTest(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='pass1234',
            email='teacher@test.com', user_type='teacher', full_name='Teacher One',
        )
        self.student = User.objects.create_user(
            username='student1', password='pass1234',
            email='student@test.com', user_type='student', full_name='Student One',
        )

    def test_is_teacher(self):
        self.assertTrue(self.teacher.is_teacher())
        self.assertFalse(self.teacher.is_student())

    def test_is_student(self):
        self.assertTrue(self.student.is_student())
        self.assertFalse(self.student.is_teacher())

    def test_str(self):
        self.assertEqual(str(self.teacher), 'teacher1 (Teacher)')
        self.assertEqual(str(self.student), 'student1 (Student)')

    def test_default_is_blocked_false(self):
        self.assertFalse(self.teacher.is_blocked)

    def test_default_user_type(self):
        user = User.objects.create_user(username='default', password='pass1234')
        self.assertEqual(user.user_type, 'student')

    def test_user_creation_fields(self):
        self.assertEqual(self.teacher.email, 'teacher@test.com')
        self.assertEqual(self.teacher.full_name, 'Teacher One')


class StatusUpdateModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')
        self.status = StatusUpdate.objects.create(user=self.user, content='Hello world')

    def test_str(self):
        self.assertIn('u1', str(self.status))

    def test_ordering(self):
        s2 = StatusUpdate.objects.create(user=self.user, content='Second')
        updates = list(StatusUpdate.objects.all())
        self.assertEqual(updates[0], s2)


class InvitationModelTest(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='t1', password='p', user_type='teacher',
        )

    def test_token_auto_generated(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        self.assertTrue(len(inv.token) > 20)

    def test_expires_at_auto_set(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        self.assertIsNotNone(inv.expires_at)
        self.assertGreater(inv.expires_at, timezone.now())

    def test_is_expired(self):
        inv = Invitation(
            invited_by=self.teacher, email='a@b.com',
            expires_at=timezone.now() - timedelta(days=1),
        )
        inv.save()
        self.assertTrue(inv.is_expired)

    def test_is_not_expired(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        self.assertFalse(inv.is_expired)

    def test_is_valid(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        self.assertTrue(inv.is_valid)

    def test_is_valid_false_when_accepted(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com', status='accepted')
        inv.save()
        self.assertFalse(inv.is_valid)

    def test_is_valid_false_when_expired(self):
        inv = Invitation(
            invited_by=self.teacher, email='a@b.com',
            expires_at=timezone.now() - timedelta(days=1),
        )
        inv.save()
        self.assertFalse(inv.is_valid)

    def test_str(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        self.assertIn('a@b.com', str(inv))

    def test_token_preserved_on_save(self):
        inv = Invitation(invited_by=self.teacher, email='a@b.com')
        inv.save()
        original_token = inv.token
        inv.status = 'accepted'
        inv.save()
        self.assertEqual(inv.token, original_token)


# ── Auth API Tests ───────────────────────────────────────────────────

class AuthAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='TestPass123!',
            email='test@test.com', user_type='student', full_name='Test User',
        )
        self.token = Token.objects.create(user=self.user)

    def test_login_success(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'testuser', 'password': 'TestPass123!',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user']['username'], 'testuser')

    def test_login_returns_user_data(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'testuser', 'password': 'TestPass123!',
        })
        self.assertEqual(res.data['user']['email'], 'test@test.com')
        self.assertEqual(res.data['user']['user_type'], 'student')

    def test_login_wrong_password(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'testuser', 'password': 'wrong',
        })
        self.assertEqual(res.status_code, 401)

    def test_login_nonexistent_user(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'noone', 'password': 'pass',
        })
        self.assertEqual(res.status_code, 401)

    def test_login_blocked_user(self):
        self.user.is_blocked = True
        self.user.save()
        res = self.client.post('/api/auth/login/', {
            'username': 'testuser', 'password': 'TestPass123!',
        })
        self.assertEqual(res.status_code, 403)

    def test_register_success(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'newuser', 'email': 'new@test.com',
            'full_name': 'New User', 'user_type': 'student',
            'password': 'StrongPass123!', 'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user']['username'], 'newuser')

    def test_register_creates_user(self):
        """Open registration forces student role regardless of user_type sent"""
        self.client.post('/api/auth/register/', {
            'username': 'newuser', 'email': 'new@test.com',
            'full_name': 'New User', 'user_type': 'teacher',
            'password': 'StrongPass123!', 'password_confirm': 'StrongPass123!',
        })
        user = User.objects.get(username='newuser')
        self.assertEqual(user.user_type, 'student')
        self.assertTrue(user.check_password('StrongPass123!'))

    def test_register_duplicate_username(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser', 'email': 'new2@test.com',
            'full_name': 'Dup', 'user_type': 'student',
            'password': 'StrongPass123!', 'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_register_password_mismatch(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'newuser2', 'email': 'new3@test.com',
            'full_name': 'New', 'user_type': 'student',
            'password': 'StrongPass123!', 'password_confirm': 'DifferentPass!',
        })
        self.assertEqual(res.status_code, 400)

    def test_auth_me_authenticated(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'testuser')

    def test_auth_me_unauthenticated(self):
        res = self.client.get('/api/auth/me/')
        self.assertIn(res.status_code, [401, 403])


# ── Invitation API Tests ─────────────────────────────────────────────

class InvitationAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='pass1234',
            email='teacher@test.com', user_type='teacher',
        )
        self.student = User.objects.create_user(
            username='student1', password='pass1234',
            email='student@test.com', user_type='student',
        )
        self.teacher_token = Token.objects.create(user=self.teacher)
        self.student_token = Token.objects.create(user=self.student)

    def _auth_teacher(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')

    def _auth_student(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')

    def _make_csv(self, rows):
        output = io.StringIO()
        writer = csv.writer(output)
        for row in rows:
            writer.writerow(row)
        return io.BytesIO(output.getvalue().encode('utf-8'))

    def test_create_invitation(self):
        self._auth_teacher()
        res = self.client.post('/api/invitations/', {
            'email': 'new@test.com', 'full_name': 'New Student',
            'user_type': 'student',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Invitation.objects.count(), 1)

    def test_create_invitation_with_all_fields(self):
        self._auth_teacher()
        res = self.client.post('/api/invitations/', {
            'email': 'new@test.com', 'full_name': 'New Student',
            'user_type': 'student', 'phone_number': '+123',
            'bio': 'A student', 'date_of_birth': '2000-01-15',
        })
        self.assertEqual(res.status_code, 201)
        inv = Invitation.objects.first()
        self.assertEqual(inv.phone_number, '+123')

    def test_create_invitation_student_forbidden(self):
        self._auth_student()
        res = self.client.post('/api/invitations/', {
            'email': 'new@test.com', 'full_name': 'New',
            'user_type': 'student',
        })
        self.assertEqual(res.status_code, 403)

    def test_create_invitation_duplicate_email(self):
        self._auth_teacher()
        res = self.client.post('/api/invitations/', {
            'email': 'student@test.com', 'full_name': 'Dup',
            'user_type': 'student',
        })
        self.assertEqual(res.status_code, 400)

    def test_list_invitations(self):
        self._auth_teacher()
        Invitation.objects.create(invited_by=self.teacher, email='a@b.com')
        res = self.client.get('/api/invitations/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_list_invitations_only_own(self):
        teacher2 = User.objects.create_user(
            username='teacher2', password='p', user_type='teacher',
        )
        Invitation.objects.create(invited_by=self.teacher, email='a@b.com')
        Invitation.objects.create(invited_by=teacher2, email='c@d.com')
        self._auth_teacher()
        res = self.client.get('/api/invitations/')
        self.assertEqual(len(res.data), 1)

    def test_resend_invitation(self):
        self._auth_teacher()
        inv = Invitation.objects.create(invited_by=self.teacher, email='a@b.com')
        old_expires = inv.expires_at
        res = self.client.post(f'/api/invitations/{inv.id}/resend/')
        self.assertEqual(res.status_code, 200)
        inv.refresh_from_db()
        self.assertGreater(inv.expires_at, old_expires)

    def test_resend_accepted_fails(self):
        self._auth_teacher()
        inv = Invitation.objects.create(
            invited_by=self.teacher, email='a@b.com', status='accepted',
        )
        res = self.client.post(f'/api/invitations/{inv.id}/resend/')
        self.assertEqual(res.status_code, 400)

    def test_resend_expired_resets_status(self):
        self._auth_teacher()
        inv = Invitation.objects.create(
            invited_by=self.teacher, email='a@b.com', status='expired',
        )
        res = self.client.post(f'/api/invitations/{inv.id}/resend/')
        self.assertEqual(res.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'pending')

    def test_bulk_upload_valid_csv(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['Alice', 'alice@new.com', 'student', '2000-01-15', '+123', 'Bio'],
            ['Bob', 'bob@new.com', 'teacher', '1990-05-20', '+456', 'Teacher bio'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['success']), 2)
        self.assertEqual(len(res.data['errors']), 0)
        self.assertEqual(res.data['total'], 2)
        self.assertEqual(Invitation.objects.count(), 2)

    def test_bulk_upload_wrong_file_type(self):
        self._auth_teacher()
        csv_file = self._make_csv([['a']])
        csv_file.name = 'test.xlsx'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('.csv', res.data['detail'])

    def test_bulk_upload_no_file(self):
        self._auth_teacher()
        res = self.client.post('/api/invitations/bulk_upload/', {}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_bulk_upload_invalid_headers(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['name', 'email', 'type', 'dob', 'phone', 'bio'],
            ['Alice', 'alice@new.com', 'student', '2000-01-15', '+123', 'Bio'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['errors']), 1)
        self.assertIn('Invalid headers', res.data['errors'][0]['error'])

    def test_bulk_upload_empty_file(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['errors']), 1)
        self.assertIn('no data rows', res.data['errors'][0]['error'])

    def test_bulk_upload_mixed_rows(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['Valid', 'valid@new.com', 'student', '2000-01-15', '+123', 'Bio'],
            ['No Email', '', 'student', '2000-01-15', '+123', 'Bio'],
            ['Bad Type', 'bad@new.com', 'admin', '2000-01-15', '+123', 'Bio'],
            ['Bad Date', 'date@new.com', 'student', 'not-a-date', '+123', 'Bio'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['success']), 1)
        self.assertEqual(len(res.data['errors']), 3)
        self.assertEqual(res.data['total'], 4)

    def test_bulk_upload_duplicate_email(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['Dup', 'student@test.com', 'student', '', '', ''],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['errors']), 1)
        self.assertIn('already exists', res.data['errors'][0]['error'])

    def test_bulk_upload_existing_pending_invitation(self):
        self._auth_teacher()
        Invitation.objects.create(
            invited_by=self.teacher, email='pending@test.com', status='pending',
        )
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['Pending', 'pending@test.com', 'student', '', '', ''],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['errors']), 1)
        self.assertIn('active invitation', res.data['errors'][0]['error'])

    def test_bulk_upload_short_row(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['Short', 'short@test.com'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['errors']), 1)
        self.assertIn('fewer than 6', res.data['errors'][0]['error'])

    def test_bulk_upload_no_date_of_birth(self):
        self._auth_teacher()
        csv_file = self._make_csv([
            ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio'],
            ['No DOB', 'nodob@new.com', 'student', '', '+123', 'Bio'],
        ])
        csv_file.name = 'test.csv'
        res = self.client.post(
            '/api/invitations/bulk_upload/',
            {'csv_file': csv_file},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['success']), 1)
        inv = Invitation.objects.get(email='nodob@new.com')
        self.assertIsNone(inv.date_of_birth)

    def test_download_template(self):
        self._auth_teacher()
        res = self.client.get('/api/invitations/download_template/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'text/csv')
        self.assertIn('invitation_template.csv', res['Content-Disposition'])
        content = res.content.decode('utf-8')
        self.assertIn('full_name', content)
        self.assertIn('email', content)


# ── Public Invite Endpoint Tests ─────────────────────────────────────

class PublicInviteAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='pass1234', user_type='teacher',
        )
        self.invitation = Invitation.objects.create(
            invited_by=self.teacher, email='inv@test.com',
            full_name='Invited User', user_type='student',
            phone_number='+123', bio='A bio',
        )

    def test_validate_valid_token(self):
        res = self.client.get(f'/api/invite/{self.invitation.token}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], 'inv@test.com')
        self.assertEqual(res.data['full_name'], 'Invited User')

    def test_validate_invalid_token(self):
        res = self.client.get('/api/invite/bad-token-123/')
        self.assertEqual(res.status_code, 404)

    def test_validate_expired_token(self):
        self.invitation.expires_at = timezone.now() - timedelta(days=1)
        self.invitation.save()
        res = self.client.get(f'/api/invite/{self.invitation.token}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('expired', res.data['detail'].lower())

    def test_validate_expired_updates_status(self):
        self.invitation.expires_at = timezone.now() - timedelta(days=1)
        self.invitation.save()
        self.client.get(f'/api/invite/{self.invitation.token}/')
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, 'expired')

    def test_validate_accepted_token(self):
        self.invitation.status = 'accepted'
        self.invitation.save()
        res = self.client.get(f'/api/invite/{self.invitation.token}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already been used', res.data['detail'])

    def test_accept_invitation(self):
        res = self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, 'accepted')
        self.assertIsNotNone(self.invitation.created_user)

    def test_accept_creates_user_with_invitation_data(self):
        self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        user = User.objects.get(username='newuser')
        self.assertEqual(user.email, 'inv@test.com')
        self.assertEqual(user.full_name, 'Invited User')
        self.assertEqual(user.user_type, 'student')
        self.assertEqual(user.phone_number, '+123')
        self.assertEqual(user.bio, 'A bio')

    def test_accept_invalid_token(self):
        res = self.client.post('/api/invite/bad-token/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 404)

    def test_accept_duplicate_username(self):
        User.objects.create_user(username='taken', password='p')
        res = self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'taken', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_accept_password_mismatch(self):
        res = self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'Different123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_accept_expired_invitation(self):
        self.invitation.expires_at = timezone.now() - timedelta(days=1)
        self.invitation.save()
        res = self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_accept_already_accepted(self):
        self.invitation.status = 'accepted'
        self.invitation.save()
        res = self.client.post(f'/api/invite/{self.invitation.token}/accept/', {
            'username': 'newuser', 'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)


# ── User API Tests ───────────────────────────────────────────────────

class UserAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='pass1234',
            email='teacher@test.com', user_type='teacher', full_name='Teacher One',
        )
        self.student = User.objects.create_user(
            username='student1', password='pass1234',
            email='student@test.com', user_type='student', full_name='Student One',
        )
        self.teacher_token = Token.objects.create(user=self.teacher)
        self.student_token = Token.objects.create(user=self.student)

    def test_list_users(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_list_excludes_blocked_users(self):
        self.student.is_blocked = True
        self.student.save()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/')
        usernames = [u['username'] for u in res.data]
        self.assertNotIn('student1', usernames)

    def test_list_users_unauthenticated(self):
        res = self.client.get('/api/users/')
        self.assertIn(res.status_code, [401, 403])

    def test_retrieve_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get(f'/api/users/{self.student.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'student1')

    def test_retrieve_returns_status_updates(self):
        StatusUpdate.objects.create(user=self.student, content='Hello')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get(f'/api/users/{self.student.id}/')
        self.assertIn('status_updates', res.data)
        self.assertEqual(len(res.data['status_updates']), 1)

    def test_search_users_by_name(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/search/', {'q': 'Student'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_search_users_by_type(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/search/', {'user_type': 'student'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_search_excludes_self(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/search/', {'q': 'Teacher'})
        self.assertEqual(len(res.data), 0)

    def test_search_by_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/users/search/', {'q': 'student@test'})
        self.assertEqual(len(res.data), 1)

    def test_update_profile(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.patch('/api/users/update_profile/', {'bio': 'Updated bio'})
        self.assertEqual(res.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.bio, 'Updated bio')

    def test_block_user_as_teacher(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.post(f'/api/users/{self.student.id}/block/')
        self.assertEqual(res.status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.is_blocked)

    def test_block_user_as_student_fails(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.post(f'/api/users/{self.teacher.id}/block/')
        self.assertEqual(res.status_code, 403)

    def test_unblock_user(self):
        self.student.is_blocked = True
        self.student.save()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.post(f'/api/users/{self.student.id}/unblock/')
        self.assertEqual(res.status_code, 200)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_blocked)

    def test_unblock_nonexistent_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.post('/api/users/9999/unblock/')
        self.assertEqual(res.status_code, 404)

    def test_unblock_as_student_fails(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.post(f'/api/users/{self.teacher.id}/unblock/')
        self.assertEqual(res.status_code, 403)

    def test_me_endpoint(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.get('/api/users/me/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'student1')


# ── StatusUpdate API Tests ───────────────────────────────────────────

class StatusUpdateAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='p')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_create_status_update(self):
        res = self.client.post('/api/status-updates/', {'content': 'Hello'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(StatusUpdate.objects.count(), 1)

    def test_list_own_status_updates(self):
        StatusUpdate.objects.create(user=self.user, content='Test')
        user2 = User.objects.create_user(username='u2', password='p')
        StatusUpdate.objects.create(user=user2, content='Other')
        res = self.client.get('/api/status-updates/')
        self.assertEqual(len(res.data), 1)

    def test_unauthenticated_access_denied(self):
        self.client.credentials()
        res = self.client.get('/api/status-updates/')
        self.assertIn(res.status_code, [401, 403])
