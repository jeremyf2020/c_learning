from rest_framework import serializers
from .models import Course, CourseMaterial, Enrollment, Feedback, Assignment, AssignmentSubmission


class CourseSerializer(serializers.ModelSerializer):
    """Serializer for Course model"""
    teacher_name = serializers.CharField(source='teacher.username', read_only=True)
    enrolled_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'teacher', 'teacher_name', 'code', 'start_date', 'end_date', 'is_active', 'created_at', 'enrolled_count', 'average_rating']
        read_only_fields = ['id', 'teacher', 'created_at']

    def get_enrolled_count(self, obj):
        return obj.get_enrolled_students_count()

    def get_average_rating(self, obj):
        return obj.get_average_rating()


class CourseMaterialSerializer(serializers.ModelSerializer):
    """Serializer for CourseMaterial model"""
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = CourseMaterial
        fields = ['id', 'course', 'title', 'description', 'material_type', 'file', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class EnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for Enrollment model"""
    student_name = serializers.CharField(source='student.username', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'student_name', 'course', 'course_title', 'enrolled_at', 'is_active', 'completed']
        read_only_fields = ['id', 'enrolled_at']


class FeedbackSerializer(serializers.ModelSerializer):
    """Serializer for Feedback model"""
    student_name = serializers.CharField(source='student.username', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'course', 'student', 'student_name', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'student', 'created_at']


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Assignment model"""
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ['id', 'course', 'course_title', 'title', 'assignment_type', 'content',
                  'source_file', 'created_by', 'created_by_name', 'created_at', 'deadline', 'submission_count']
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_submission_count(self, obj):
        return obj.submissions.count()


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for AssignmentSubmission model"""
    student_name = serializers.CharField(source='student.username', read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'student', 'student_name', 'answers', 'score', 'submitted_at']
        read_only_fields = ['id', 'student', 'score', 'submitted_at']
