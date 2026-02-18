from django.contrib import admin
from .models import Classroom, ClassroomMessage


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'updated_at']
    search_fields = ['name']
    ordering = ['-updated_at']
    filter_horizontal = ['participants']


@admin.register(ClassroomMessage)
class ClassroomMessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'room', 'content_preview', 'created_at']
    list_filter = ['created_at', 'room']
    search_fields = ['sender__username', 'content', 'room__name']
    ordering = ['-created_at']

    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content'
