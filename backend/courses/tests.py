from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Course, CourseMaterial, Enrollment, Feedback


# ── Model Tests ──────────────────────────────────────────────────────

class CourseModelTest(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='p', user_type='teacher',
        )
        self.course = Course.objects.create(
            title='Test Course', description='Desc',
            teacher=self.teacher, code='CS101',
        )

    def test_str(self):
        self.assertEqual(str(self.course), 'CS101 - Test Course')

    def test_default_is_active(self):
        self.assertTrue(self.course.is_active)

    def test_get_enrolled_students_count_empty(self):
        self.assertEqual(self.course.get_enrolled_students_count(), 0)

    def test_get_enrolled_students_count(self):
        s1 = User.objects.create_user(username='s1', password='p', user_type='student')
        s2 = User.objects.create_user(username='s2', password='p', user_type='student')
        Enrollment.objects.create(student=s1, course=self.course, is_active=True)
        Enrollment.objects.create(student=s2, course=self.course, is_active=False)
        self.assertEqual(self.course.get_enrolled_students_count(), 1)

    def test_get_average_rating_empty(self):
        self.assertIsNone(self.course.get_average_rating())

    def test_get_average_rating(self):
        s1 = User.objects.create_user(username='s1', password='p', user_type='student')
        s2 = User.objects.create_user(username='s2', password='p', user_type='student')
        Feedback.objects.create(course=self.course, student=s1, rating=4, comment='Good')
        Feedback.objects.create(course=self.course, student=s2, rating=2, comment='Ok')
        self.assertEqual(self.course.get_average_rating(), 3.0)


class EnrollmentModelTest(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(username='t', password='p', user_type='teacher')
        self.student = User.objects.create_user(username='s', password='p', user_type='student')
        self.course = Course.objects.create(
            title='C', description='D', teacher=self.teacher, code='C1',
        )

    def test_str(self):
        e = Enrollment.objects.create(student=self.student, course=self.course)
        self.assertIn('s', str(e))
        self.assertIn('C1', str(e))

    def test_unique_together(self):
        Enrollment.objects.create(student=self.student, course=self.course)
        with self.assertRaises(Exception):
            Enrollment.objects.create(student=self.student, course=self.course)


class FeedbackModelTest(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(username='t', password='p', user_type='teacher')
        self.student = User.objects.create_user(username='s', password='p', user_type='student')
        self.course = Course.objects.create(
            title='C', description='D', teacher=self.teacher, code='C1',
        )

    def test_str(self):
        f = Feedback.objects.create(
            course=self.course, student=self.student, rating=5, comment='Great',
        )
        self.assertIn('s', str(f))

    def test_unique_together(self):
        Feedback.objects.create(
            course=self.course, student=self.student, comment='First',
        )
        with self.assertRaises(Exception):
            Feedback.objects.create(
                course=self.course, student=self.student, comment='Second',
            )


# ── Course API Tests ─────────────────────────────────────────────────

class CourseAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='p',
            email='t@t.com', user_type='teacher',
        )
        self.student = User.objects.create_user(
            username='student1', password='p',
            email='s@s.com', user_type='student',
        )
        self.teacher_token = Token.objects.create(user=self.teacher)
        self.student_token = Token.objects.create(user=self.student)
        self.course = Course.objects.create(
            title='Test Course', description='Desc',
            teacher=self.teacher, code='CS101',
        )

    def _auth_teacher(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')

    def _auth_student(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')

    def test_list_courses(self):
        self._auth_student()
        res = self.client.get('/api/courses/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_list_courses_unauthenticated(self):
        res = self.client.get('/api/courses/')
        self.assertEqual(res.status_code, 200)

    def test_retrieve_course(self):
        self._auth_student()
        res = self.client.get(f'/api/courses/{self.course.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['title'], 'Test Course')

    def test_create_course_as_teacher(self):
        self._auth_teacher()
        res = self.client.post('/api/courses/', {
            'title': 'New Course', 'description': 'New Desc',
            'code': 'CS201',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Course.objects.count(), 2)

    def test_enroll_as_student(self):
        self._auth_student()
        res = self.client.post(f'/api/courses/{self.course.id}/enroll/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            Enrollment.objects.filter(
                student=self.student, course=self.course, is_active=True,
            ).exists()
        )

    def test_enroll_as_teacher_fails(self):
        self._auth_teacher()
        res = self.client.post(f'/api/courses/{self.course.id}/enroll/')
        self.assertEqual(res.status_code, 403)

    def test_enroll_reactivates_inactive(self):
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=False,
        )
        self._auth_student()
        res = self.client.post(f'/api/courses/{self.course.id}/enroll/')
        self.assertEqual(res.status_code, 200)
        e = Enrollment.objects.get(student=self.student, course=self.course)
        self.assertTrue(e.is_active)

    def test_unenroll(self):
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=True,
        )
        self._auth_student()
        res = self.client.post(f'/api/courses/{self.course.id}/unenroll/')
        self.assertEqual(res.status_code, 200)
        e = Enrollment.objects.get(student=self.student, course=self.course)
        self.assertFalse(e.is_active)

    def test_unenroll_not_enrolled(self):
        self._auth_student()
        res = self.client.post(f'/api/courses/{self.course.id}/unenroll/')
        self.assertEqual(res.status_code, 400)

    def test_block_student_as_course_teacher(self):
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=True,
        )
        self._auth_teacher()
        res = self.client.post(
            f'/api/courses/{self.course.id}/block/{self.student.id}/'
        )
        self.assertEqual(res.status_code, 200)
        e = Enrollment.objects.get(student=self.student, course=self.course)
        self.assertFalse(e.is_active)

    def test_block_student_not_owner_fails(self):
        teacher2 = User.objects.create_user(
            username='teacher2', password='p', user_type='teacher',
        )
        t2_token = Token.objects.create(user=teacher2)
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {t2_token.key}')
        res = self.client.post(
            f'/api/courses/{self.course.id}/block/{self.student.id}/'
        )
        self.assertEqual(res.status_code, 403)

    def test_block_student_not_enrolled(self):
        self._auth_teacher()
        res = self.client.post(
            f'/api/courses/{self.course.id}/block/{self.student.id}/'
        )
        self.assertEqual(res.status_code, 400)

    def test_list_students(self):
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=True,
        )
        self._auth_teacher()
        res = self.client.get(f'/api/courses/{self.course.id}/students/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_list_students_excludes_inactive(self):
        Enrollment.objects.create(
            student=self.student, course=self.course, is_active=False,
        )
        self._auth_teacher()
        res = self.client.get(f'/api/courses/{self.course.id}/students/')
        self.assertEqual(len(res.data), 0)

    def test_list_materials(self):
        self._auth_teacher()
        res = self.client.get(f'/api/courses/{self.course.id}/materials/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)


# ── Enrollment API Tests ─────────────────────────────────────────────

class EnrollmentAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='p', user_type='teacher',
        )
        self.student = User.objects.create_user(
            username='student1', password='p', user_type='student',
        )
        self.course = Course.objects.create(
            title='C', description='D', teacher=self.teacher, code='C1',
        )
        self.teacher_token = Token.objects.create(user=self.teacher)
        self.student_token = Token.objects.create(user=self.student)

    def test_student_sees_own_enrollments(self):
        Enrollment.objects.create(student=self.student, course=self.course, is_active=True)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.get('/api/enrollments/')
        self.assertEqual(len(res.data), 1)

    def test_teacher_sees_course_enrollments(self):
        Enrollment.objects.create(student=self.student, course=self.course, is_active=True)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.teacher_token.key}')
        res = self.client.get('/api/enrollments/')
        self.assertEqual(len(res.data), 1)

    def test_student_doesnt_see_inactive_enrollments(self):
        Enrollment.objects.create(student=self.student, course=self.course, is_active=False)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.get('/api/enrollments/')
        self.assertEqual(len(res.data), 0)


# ── Feedback API Tests ───────────────────────────────────────────────

class FeedbackAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher1', password='p', user_type='teacher',
        )
        self.student = User.objects.create_user(
            username='student1', password='p', user_type='student',
        )
        self.course = Course.objects.create(
            title='C', description='D', teacher=self.teacher, code='C1',
        )
        self.student_token = Token.objects.create(user=self.student)

    def test_create_feedback(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.post('/api/feedback/', {
            'course': self.course.id, 'rating': 5, 'comment': 'Excellent!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Feedback.objects.count(), 1)

    def test_list_feedback(self):
        Feedback.objects.create(
            course=self.course, student=self.student,
            rating=4, comment='Good',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.student_token.key}')
        res = self.client.get('/api/feedback/')
        self.assertEqual(res.status_code, 200)
