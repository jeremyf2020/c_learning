import logging

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response

from notifications.utils import create_notification, create_bulk_notifications
from accounts.models import User
from .tasks import generate_assignment_task
from .models import Course, CourseMaterial, Enrollment, Feedback, Assignment, AssignmentSubmission
from .serializers import (
    CourseSerializer, CourseMaterialSerializer, EnrollmentSerializer, FeedbackSerializer,
    AssignmentSerializer, AssignmentSubmissionSerializer,
)

logger = logging.getLogger(__name__)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.filter(is_active=True)
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        if not self.request.user.is_teacher():
            raise PermissionDenied('Only teachers can create courses.')
        serializer.save(teacher=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.teacher != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own courses.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.teacher != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own courses.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        course = self.get_object()
        if not request.user.is_student():
            return Response({'error': 'Only students can enroll'}, status=status.HTTP_403_FORBIDDEN)
        enrollment, created = Enrollment.objects.get_or_create(
            student=request.user, course=course, defaults={'is_active': True}
        )
        reactivated = False
        if not created and not enrollment.is_active:
            enrollment.is_active = True
            enrollment.save()
            reactivated = True
        if created or reactivated:
            create_notification(
                recipient=course.teacher,
                notification_type='enrollment',
                title=f'New enrollment in {course.code}',
                message=f'{request.user.username} has enrolled in {course.title}.',
                link=f'/courses/{course.pk}/',
            )
        return Response({'message': 'Enrolled successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unenroll(self, request, pk=None):
        course = self.get_object()
        try:
            enrollment = Enrollment.objects.get(student=request.user, course=course)
            enrollment.is_active = False
            enrollment.save()
            create_notification(
                recipient=course.teacher,
                notification_type='enrollment',
                title=f'Student left {course.code}',
                message=f'{request.user.username} has unenrolled from {course.title}.',
                link=f'/courses/{course.pk}/',
            )
            return Response({'message': 'Unenrolled successfully'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not enrolled'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='block/(?P<student_id>[^/.]+)')
    def block_student(self, request, pk=None, student_id=None):
        course = self.get_object()
        if course.teacher != request.user:
            return Response({'error': 'Only the course teacher can block students'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.select_related('student').get(student_id=student_id, course=course)
            enrollment.is_active = False
            enrollment.save()
            create_notification(
                recipient=enrollment.student,
                notification_type='enrollment',
                title=f'Removed from {course.code}',
                message=f'You have been removed from "{course.title}" by the teacher.',
                link=f'/courses/{course.pk}/',
            )
            return Response({'message': 'Student blocked from course'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Student not enrolled'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        course = self.get_object()
        if course.teacher != request.user:
            return Response({'error': 'Only the course teacher can view students'}, status=status.HTTP_403_FORBIDDEN)
        enrollments = Enrollment.objects.filter(course=course, is_active=True).select_related('student')
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def materials(self, request, pk=None):
        course = self.get_object()
        is_teacher = course.teacher == request.user
        is_enrolled = Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists()
        if not is_teacher and not is_enrolled:
            return Response({'error': 'Only enrolled students or the teacher can view materials'}, status=status.HTTP_403_FORBIDDEN)
        materials = CourseMaterial.objects.filter(course=course)
        serializer = CourseMaterialSerializer(materials, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_student(self, request, pk=None):
        course = self.get_object()
        if course.teacher != request.user:
            return Response({'error': 'Only the course teacher can add students'}, status=status.HTTP_403_FORBIDDEN)
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = User.objects.get(pk=student_id)
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
        if not student.is_student():
            return Response({'error': 'User is not a student'}, status=status.HTTP_400_BAD_REQUEST)
        if student.is_blocked:
            return Response({'error': 'This user is blocked'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment, created = Enrollment.objects.get_or_create(
            student=student, course=course, defaults={'is_active': True}
        )
        if not created and not enrollment.is_active:
            enrollment.is_active = True
            enrollment.save()
        elif not created:
            return Response({'message': 'Student is already enrolled'}, status=status.HTTP_200_OK)
        create_notification(
            recipient=student,
            notification_type='enrollment',
            title=f'Added to {course.title}',
            message=f'You have been added to "{course.title}" by {request.user.full_name or request.user.username}.',
            link=f'/courses/{course.id}',
        )
        serializer = EnrollmentSerializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CourseMaterialViewSet(viewsets.ModelViewSet):
    queryset = CourseMaterial.objects.all()
    serializer_class = CourseMaterialSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        course = serializer.validated_data.get('course')
        if course and course.teacher != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only upload materials to your own courses.')
        serializer.save(uploaded_by=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.uploaded_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own materials.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.uploaded_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own materials.')
        instance.delete()


class EnrollmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_student():
            return Enrollment.objects.filter(student=self.request.user, is_active=True)
        elif self.request.user.is_teacher():
            return Enrollment.objects.filter(course__teacher=self.request.user, is_active=True)
        return Enrollment.objects.none()


class FeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Feedback.objects.select_related('student', 'course')
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        # Scope: students see feedback for courses they're enrolled in, teachers for their courses
        if self.request.user.is_student():
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user, is_active=True
            ).values_list('course_id', flat=True)
            qs = qs.filter(course_id__in=enrolled_courses)
        elif self.request.user.is_teacher():
            qs = qs.filter(course__teacher=self.request.user)
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        if not self.request.user.is_student():
            raise PermissionDenied('Only students can submit feedback.')
        course = serializer.validated_data.get('course')
        if course and not Enrollment.objects.filter(
            student=self.request.user, course=course, is_active=True
        ).exists():
            raise PermissionDenied('You must be enrolled in this course to leave feedback.')
        serializer.save(student=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.student != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own feedback.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.student != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own feedback.')
        instance.delete()


def _extract_pdf_text(file_obj):
    """Extract text from an uploaded PDF file using pypdf."""
    from pypdf import PdfReader
    import io

    file_obj.seek(0)
    reader = PdfReader(io.BytesIO(file_obj.read()))
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return '\n'.join(text_parts)


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def get_queryset(self):
        qs = Assignment.objects.select_related('course', 'created_by')
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        # Scope: students see assignments for enrolled courses, teachers for their courses
        if self.request.user.is_student():
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user, is_active=True
            ).values_list('course_id', flat=True)
            qs = qs.filter(course_id__in=enrolled_courses)
        elif self.request.user.is_teacher():
            qs = qs.filter(course__teacher=self.request.user)
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        if not self.request.user.is_teacher():
            raise PermissionDenied('Only teachers can create assignments.')
        course = serializer.validated_data.get('course')
        if course and course.teacher != self.request.user:
            raise PermissionDenied('You can only create assignments for your own courses.')
        serializer.save(created_by=self.request.user)

    def _notify_deadline(self, assignment):
        """Send deadline notification to all actively enrolled students."""
        enrollments = Enrollment.objects.filter(
            course=assignment.course, is_active=True
        ).select_related('student')
        recipients = [enrollment.student for enrollment in enrollments]
        create_bulk_notifications(
            recipients=recipients,
            notification_type='deadline',
            title=f'Assignment Deadline: {assignment.title}',
            message=(
                f'A deadline has been set for "{assignment.title}" in {assignment.course.title}: '
                f'{assignment.deadline.strftime("%b %d, %Y %I:%M %p")}.'
            ),
            link=f'/assignments/{assignment.id}',
        )

    def perform_update(self, serializer):
        if serializer.instance.created_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own assignments.')
        old_deadline = serializer.instance.deadline
        assignment = serializer.save()
        if assignment.deadline and assignment.deadline != old_deadline:
            self._notify_deadline(assignment)

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own assignments.')
        instance.delete()

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Upload a PDF and generate a quiz or flashcard set using OpenAI via Celery."""
        if not request.user.is_teacher():
            return Response({'error': 'Only teachers can generate assignments'}, status=status.HTTP_403_FORBIDDEN)

        api_key = request.user.ai_api_key
        if not api_key:
            return Response(
                {'error': 'Please set your AI API key in your profile settings first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pdf_file = request.FILES.get('file')
        if not pdf_file:
            return Response({'error': 'A PDF file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not pdf_file.name.lower().endswith('.pdf'):
            return Response({'error': 'Only PDF files are supported.'}, status=status.HTTP_400_BAD_REQUEST)

        course_id = request.data.get('course')
        assignment_type = request.data.get('assignment_type', 'quiz')
        title = request.data.get('title', '')
        deadline_str = request.data.get('deadline')

        if not course_id:
            return Response({'error': 'course is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)

        if course.teacher != request.user:
            return Response({'error': 'You can only generate assignments for your own courses.'}, status=status.HTTP_403_FORBIDDEN)

        # Extract text from PDF (fast, done synchronously)
        try:
            pdf_text = _extract_pdf_text(pdf_file)
        except Exception as e:
            return Response({'error': f'Failed to read PDF: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        if not pdf_text.strip():
            return Response({'error': 'Could not extract any text from the PDF.'}, status=status.HTTP_400_BAD_REQUEST)

        # Truncate to ~12000 chars to stay within token limits
        pdf_text = pdf_text[:12000]

        # Offload OpenAI call + assignment creation to Celery worker
        task = generate_assignment_task.delay(
            course_id=course.pk,
            user_id=request.user.pk,
            assignment_type=assignment_type,
            pdf_text=pdf_text,
            title=title,
            deadline_str=deadline_str,
        )

        return Response(
            {'message': 'Assignment generation started.', 'task_id': task.id},
            status=status.HTTP_202_ACCEPTED,
        )


class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AssignmentSubmission.objects.select_related('assignment', 'student')
        assignment_id = self.request.query_params.get('assignment')
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        if self.request.user.is_student():
            qs = qs.filter(student=self.request.user)
        elif self.request.user.is_teacher():
            qs = qs.filter(assignment__course__teacher=self.request.user)
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        assignment = serializer.validated_data.get('assignment')
        if assignment and not Enrollment.objects.filter(
            student=self.request.user, course=assignment.course, is_active=True
        ).exists():
            raise PermissionDenied('You must be enrolled in this course to submit.')
        submission = serializer.save(student=self.request.user)
        # Auto-score quizzes
        assignment = submission.assignment
        if assignment.assignment_type == 'quiz':
            questions = assignment.content.get('questions', [])
            answers = submission.answers  # list of selected indices
            if questions and isinstance(answers, list):
                correct = 0
                for i, q in enumerate(questions):
                    if i < len(answers) and answers[i] == q.get('correct'):
                        correct += 1
                submission.score = int((correct / len(questions)) * 100)
                submission.save(update_fields=['score'])
        # Notify the course teacher
        create_notification(
            recipient=assignment.course.teacher,
            notification_type='general',
            title=f'New submission for {assignment.title}',
            message=f'{self.request.user.username} submitted "{assignment.title}" in {assignment.course.title}.',
            link=f'/assignments/{assignment.id}',
        )
        return submission
