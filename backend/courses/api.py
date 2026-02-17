from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Course, CourseMaterial, Enrollment, Feedback
from .serializers import CourseSerializer, CourseMaterialSerializer, EnrollmentSerializer, FeedbackSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.filter(is_active=True)
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        course = self.get_object()
        if not request.user.is_student():
            return Response({'error': 'Only students can enroll'}, status=status.HTTP_403_FORBIDDEN)
        enrollment, created = Enrollment.objects.get_or_create(
            student=request.user, course=course, defaults={'is_active': True}
        )
        if not created and not enrollment.is_active:
            enrollment.is_active = True
            enrollment.save()
        return Response({'message': 'Enrolled successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unenroll(self, request, pk=None):
        course = self.get_object()
        try:
            enrollment = Enrollment.objects.get(student=request.user, course=course)
            enrollment.is_active = False
            enrollment.save()
            return Response({'message': 'Unenrolled successfully'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not enrolled'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='block/(?P<student_id>[^/.]+)')
    def block_student(self, request, pk=None, student_id=None):
        course = self.get_object()
        if course.teacher != request.user:
            return Response({'error': 'Only the course teacher can block students'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.get(student_id=student_id, course=course)
            enrollment.is_active = False
            enrollment.save()
            return Response({'message': 'Student blocked from course'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Student not enrolled'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        course = self.get_object()
        enrollments = Enrollment.objects.filter(course=course, is_active=True).select_related('student')
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def materials(self, request, pk=None):
        course = self.get_object()
        materials = CourseMaterial.objects.filter(course=course)
        serializer = CourseMaterialSerializer(materials, many=True)
        return Response(serializer.data)


class CourseMaterialViewSet(viewsets.ModelViewSet):
    queryset = CourseMaterial.objects.all()
    serializer_class = CourseMaterialSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


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
    queryset = Feedback.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
