from django.contrib import admin
from .models import Course, CourseMaterial, Enrollment, Feedback


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    """Admin configuration for Course model"""
    list_display = ['code', 'title', 'teacher', 'is_active', 'start_date', 'end_date', 'created_at']
    list_filter = ['is_active', 'created_at', 'teacher']
    search_fields = ['code', 'title', 'description', 'teacher__username']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'


@admin.register(CourseMaterial)
class CourseMaterialAdmin(admin.ModelAdmin):
    """Admin configuration for CourseMaterial model"""
    list_display = ['title', 'course', 'material_type', 'uploaded_by', 'uploaded_at']
    list_filter = ['material_type', 'uploaded_at', 'course']
    search_fields = ['title', 'description', 'course__title', 'course__code']
    ordering = ['-uploaded_at']
    date_hierarchy = 'uploaded_at'


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    """Admin configuration for Enrollment model"""
    list_display = ['student', 'course', 'enrolled_at', 'is_active', 'completed']
    list_filter = ['is_active', 'completed', 'enrolled_at', 'course']
    search_fields = ['student__username', 'course__title', 'course__code']
    ordering = ['-enrolled_at']
    date_hierarchy = 'enrolled_at'


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """Admin configuration for Feedback model"""
    list_display = ['student', 'course', 'rating', 'created_at']
    list_filter = ['rating', 'created_at', 'course']
    search_fields = ['student__username', 'course__title', 'course__code', 'comment']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
