from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from .models import User, StatusUpdate, Invitation


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'user_type', 'bio', 'photo', 'date_of_birth', 'phone_number', 'is_blocked', 'created_at']
        read_only_fields = ['id', 'created_at', 'is_blocked']


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model with status updates"""
    status_updates = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'user_type', 'bio', 'photo', 'date_of_birth', 'phone_number', 'created_at', 'status_updates']
        read_only_fields = ['id', 'created_at']

    def get_status_updates(self, obj):
        status_updates = obj.status_updates.all()[:5]
        return StatusUpdateSerializer(status_updates, many=True).data


class StatusUpdateSerializer(serializers.ModelSerializer):
    """Serializer for StatusUpdate model"""
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = StatusUpdate
        fields = ['id', 'user', 'username', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'username', 'created_at']


class InvitationSerializer(serializers.ModelSerializer):
    invited_by_username = serializers.CharField(source='invited_by.username', read_only=True)

    class Meta:
        model = Invitation
        fields = [
            'id', 'invited_by', 'invited_by_username', 'email', 'full_name',
            'user_type', 'date_of_birth', 'phone_number', 'bio',
            'token', 'status', 'created_at', 'expires_at',
        ]
        read_only_fields = ['id', 'invited_by', 'invited_by_username', 'token', 'status', 'created_at', 'expires_at']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        if Invitation.objects.filter(
            email=value, status='pending', expires_at__gt=timezone.now()
        ).exists():
            raise serializers.ValidationError('An active invitation for this email already exists.')
        return value


class InvitationPublicSerializer(serializers.ModelSerializer):
    """Public serializer for invite token validation (no sensitive fields)."""
    class Meta:
        model = Invitation
        fields = ['email', 'full_name', 'user_type', 'date_of_birth', 'phone_number', 'bio', 'status']
        read_only_fields = fields


class AcceptInvitationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return data


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'full_name', 'user_type', 'password', 'password_confirm']

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
