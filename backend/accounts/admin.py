from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StatusUpdate, Invitation


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for custom User model"""
    list_display = ['username', 'email', 'full_name', 'user_type', 'is_blocked', 'is_staff', 'created_at']
    list_filter = ['user_type', 'is_blocked', 'is_staff', 'is_superuser']
    search_fields = ['username', 'email', 'full_name']
    ordering = ['-created_at']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('User Type', {'fields': ('user_type',)}),
        ('Profile Information', {'fields': ('full_name', 'bio', 'photo', 'date_of_birth', 'phone_number')}),
        ('Status', {'fields': ('is_blocked',)}),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('User Type', {'fields': ('user_type',)}),
        ('Profile Information', {'fields': ('full_name', 'email')}),
    )


@admin.register(StatusUpdate)
class StatusUpdateAdmin(admin.ModelAdmin):
    """Admin configuration for StatusUpdate model"""
    list_display = ['user', 'content_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'content']
    ordering = ['-created_at']

    def content_preview(self, obj):
        """Show preview of content"""
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content'


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'full_name', 'user_type', 'status', 'invited_by', 'created_at', 'expires_at']
    list_filter = ['status', 'user_type', 'created_at']
    search_fields = ['email', 'full_name', 'invited_by__username']
    readonly_fields = ['token', 'created_at']
    ordering = ['-created_at']
