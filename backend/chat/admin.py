from django.contrib import admin
from .models import ChatRoom, ChatMessage


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    """Admin configuration for ChatRoom model"""
    list_display = ['name', 'created_at', 'updated_at']
    search_fields = ['name']
    ordering = ['-updated_at']
    filter_horizontal = ['participants']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    """Admin configuration for ChatMessage model"""
    list_display = ['sender', 'room', 'content_preview', 'created_at']
    list_filter = ['created_at', 'room']
    search_fields = ['sender__username', 'content', 'room__name']
    ordering = ['-created_at']

    def content_preview(self, obj):
        """Show preview of content"""
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content'
