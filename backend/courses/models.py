from django.db import models
from django.core.validators import FileExtensionValidator, MinValueValidator, MaxValueValidator
from accounts.models import User


class Course(models.Model):
    """
    Model for courses created by teachers.
    """
    title = models.CharField(max_length=255)
    description = models.TextField()
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='taught_courses',
        limit_choices_to={'user_type': 'teacher'}
    )
    code = models.CharField(max_length=20, unique=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.title}"

    def get_enrolled_students_count(self):
        """Get count of enrolled students"""
        return self.enrollments.filter(is_active=True).count()

    def get_average_rating(self):
        """Calculate average rating from feedback"""
        feedbacks = self.feedbacks.filter(rating__isnull=False)
        if feedbacks.exists():
            return feedbacks.aggregate(models.Avg('rating'))['rating__avg']
        return None


class CourseMaterial(models.Model):
    """
    Model for course materials uploaded by teachers.
    """
    MATERIAL_TYPE_CHOICES = (
        ('document', 'Document'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('other', 'Other'),
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='materials')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    material_type = models.CharField(max_length=20, choices=MATERIAL_TYPE_CHOICES, default='document')
    file = models.FileField(
        upload_to='course_materials/',
        validators=[FileExtensionValidator(
            allowed_extensions=['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi']
        )]
    )
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_materials')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.course.code} - {self.title}"


class Enrollment(models.Model):
    """
    Model for student enrollments in courses.
    """
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='enrollments',
        limit_choices_to={'user_type': 'student'}
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    completed = models.BooleanField(default=False)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'course')
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.student.username} enrolled in {self.course.code}"


class Feedback(models.Model):
    """
    Model for student feedback on courses.
    """
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='feedbacks')
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='course_feedbacks',
        limit_choices_to={'user_type': 'student'}
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('course', 'student')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.username} feedback for {self.course.code}"
