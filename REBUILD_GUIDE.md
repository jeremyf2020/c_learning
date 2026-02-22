# eLearning Platform — Complete Step-by-Step Rebuild Guide

This document contains every file you need to rebuild the entire eLearning platform from scratch.
Follow each step in order. Copy each code block into the specified file path.

## Prerequisites
- Docker & Docker Compose installed
- Node.js 20+ and Python 3.11+ (optional, for local development)

---

## Step 1: Project Skeleton & Docker Setup

Create the root project directory and all subdirectories:

```bash
mkdir -p elearning/backend/core
mkdir -p elearning/backend/accounts/management/commands
mkdir -p elearning/backend/accounts/migrations
mkdir -p elearning/backend/courses/migrations
mkdir -p elearning/backend/classroom/migrations
mkdir -p elearning/backend/notifications/migrations
mkdir -p elearning/backend/seed_data
mkdir -p elearning/frontend/src/api
mkdir -p elearning/frontend/src/context
mkdir -p elearning/frontend/src/components
mkdir -p elearning/frontend/src/pages
mkdir -p elearning/frontend/src/types
mkdir -p elearning/frontend/src/__tests__
cd elearning
```

### 1.1 `.gitignore`
```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
*.egg-info/
dist/
build/
*.egg

# Virtual environment
venv/
env/
.venv/

# Django
db.sqlite3
db.sqlite3-journal
media/
staticfiles/
*.log

# Environment
.env
.env.*

# Node / Frontend
node_modules/
frontend/node_modules/
frontend/dist/
frontend/coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

```

### 1.2 `.env`

> **Important:** Replace the email credentials and OpenAI API key with your own values.

```env
# Database
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/app/db.sqlite3

# Django
DJANGO_SECRET_KEY=django-insecure-change-this-to-a-random-string
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend

# Email — Gmail SMTP (use App Password, not regular password)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=YOUR_EMAIL@gmail.com
EMAIL_HOST_PASSWORD=YOUR_APP_PASSWORD
DEFAULT_FROM_EMAIL=YOUR_EMAIL@gmail.com

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Frontend
VITE_API_URL=http://localhost:8080/api
VITE_BASE_URL=http://localhost:5173

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

OPENAI_API_KEY=sk-your-openai-api-key
```

### 1.3 `docker-compose.yml`
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      - redis
    volumes:
      - ./backend:/app
      - media_data:/app/media

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    env_file: .env
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

  celery_worker:
    build: ./backend
    command: celery -A core worker -l info
    env_file: .env
    depends_on:
      - redis
    volumes:
      - ./backend:/app
      - media_data:/app/media

  celery_beat:
    build: ./backend
    command: celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file: .env
    depends_on:
      - redis
    volumes:
      - ./backend:/app

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  media_data:
```

### 1.4 `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y graphviz && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["daphne", "-b", "0.0.0.0", "-p", "8080", "core.asgi:application"]
```

### 1.5 `backend/requirements.txt`
```
Django==4.2.27
djangorestframework==3.14.0
channels==4.0.0
channels-redis==4.1.0
daphne==4.0.0
Pillow==10.2.0
redis==5.0.1
django-cors-headers==4.3.1
pypdf==4.1.0
django-extensions==4.1
pydotplus==2.0.2
drf-spectacular==0.28.0
celery==5.3.6
django-celery-beat==2.5.0
django-celery-results==2.5.1
```

### 1.6 `backend/manage.py`
```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
```

### 1.7 `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

### 1.8 `frontend/package.json`
```json
{
  "name": "elearning-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "bootstrap": "^5.3.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^14.2.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/jest": "^29.5.12",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "identity-obj-proxy": "^3.0.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "tailwindcss": "^4.1.18",
    "ts-jest": "^29.1.2",
    "ts-jest-mock-import-meta": "^1.3.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

### 1.9 `frontend/index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>eLearning Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 1.10 `frontend/.env`
```
VITE_API_URL=http://localhost:8080/api
```

### 1.11 `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
```

### 1.12 `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

### 1.13 `frontend/jest.config.ts`
```typescript
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      jsx: 'react-jsx',
      diagnostics: { ignoreDiagnostics: [1343] },
      astTransformers: {
        before: [{
          path: 'ts-jest-mock-import-meta',
          options: {
            metaObjectReplacement: {
              env: {
                VITE_API_URL: 'http://localhost:8080/api',
              },
            },
          },
        }],
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 25,
      lines: 35,
      statements: 35,
    },
  },
};

export default config;
```

### Checkpoint 1
```bash
docker compose build
# Both images should build successfully
```

---

## Step 2: Django Project Configuration (backend/core/)

### 2.1 `backend/core/__init__.py`
```python
from .celery import app as celery_app

__all__ = ('celery_app',)
```

### 2.2 `backend/core/celery.py`
```python
"""
Celery configuration for eLearning platform.

Uses Redis as message broker (shared with Django Channels).
"""

import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Load config from Django settings, using the CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()
```

### 2.3 `backend/core/settings.py`
```python
"""
Django settings for core project.

Generated by 'django-admin startproject' using Django 4.2.27.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/4.2/ref/settings/
"""

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-y+1k&5=&b^l%j&s$u!guwlly%aie#n(3le*+xxr&q3q8yi(6@%',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'channels',
    'django_extensions',
    'drf_spectacular',
    'django_celery_beat',
    'django_celery_results',
    'accounts',
    'courses',
    'classroom',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

db_engine = os.environ.get('DB_ENGINE', 'django.db.backends.sqlite3')
db_name = os.environ.get('DB_NAME', str(BASE_DIR / 'db.sqlite3'))

DATABASES = {
    'default': {
        'ENGINE': db_engine,
        'NAME': db_name,
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Login/Logout URLs
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/accounts/profile/'
LOGOUT_REDIRECT_URL = '/'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'eLearning Platform API',
    'DESCRIPTION': 'API for the eLearning platform with courses, classrooms, assignments, and notifications.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Channels configuration
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [(os.environ.get('REDIS_HOST', '127.0.0.1'), int(os.environ.get('REDIS_PORT', 6379)))],
        },
    },
}

# CORS configuration
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173',
).split(',')
CORS_ALLOW_CREDENTIALS = True

# Email configuration
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@elearning.local')

# Celery configuration
CELERY_BROKER_URL = f"redis://{os.environ.get('REDIS_HOST', '127.0.0.1')}:{os.environ.get('REDIS_PORT', 6379)}/0"
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
```

### 2.4 `backend/core/wsgi.py`
```python
"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

application = get_wsgi_application()
```

### 2.5 `backend/core/asgi.py`
```python
"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django_asgi_app = get_asgi_application()

from classroom.routing import websocket_urlpatterns
from classroom.middleware import TokenAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
```

### 2.6 `backend/core/urls.py`
```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from accounts.api import (
    UserViewSet, StatusUpdateViewSet, InvitationViewSet,
    validate_invite, accept_invite,
    auth_login, auth_register, auth_me,
)
from courses.api import CourseViewSet, CourseMaterialViewSet, EnrollmentViewSet, FeedbackViewSet, AssignmentViewSet, AssignmentSubmissionViewSet
from classroom.api import ClassroomViewSet
from notifications.api import NotificationViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'status-updates', StatusUpdateViewSet)
router.register(r'invitations', InvitationViewSet, basename='invitation')
router.register(r'courses', CourseViewSet)
router.register(r'materials', CourseMaterialViewSet)
router.register(r'enrollments', EnrollmentViewSet)
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'assignment-submissions', AssignmentSubmissionViewSet, basename='assignment-submission')
router.register(r'classrooms', ClassroomViewSet, basename='classroom')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls')),

    # Public invite endpoints
    path('api/invite/<str:token>/', validate_invite, name='validate_invite'),
    path('api/invite/<str:token>/accept/', accept_invite, name='accept_invite'),

    # Auth endpoints
    path('api/auth/login/', auth_login, name='auth_login'),
    path('api/auth/register/', auth_register, name='auth_register'),
    path('api/auth/me/', auth_me, name='auth_me'),

    # OpenAPI / Swagger docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

---

## Step 3: Accounts App

Create empty `__init__.py` files:
```bash
touch backend/accounts/__init__.py
touch backend/accounts/migrations/__init__.py
touch backend/accounts/management/__init__.py
touch backend/accounts/management/commands/__init__.py
touch backend/accounts/views.py
touch backend/accounts/forms.py
touch backend/accounts/urls.py
```

### 3.1 `backend/accounts/apps.py`
```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
```

### 3.2 `backend/accounts/models.py`
```python
import secrets
from datetime import timedelta

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.utils import timezone


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Supports two types of users: Students and Teachers.
    """
    USER_TYPE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
    )

    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='student')
    full_name = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    photo = models.ImageField(
        upload_to='profile_photos/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])]
    )
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    is_blocked = models.BooleanField(default=False)
    ai_api_key = models.CharField(max_length=255, blank=True, help_text='OpenAI API key for AI-generated assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.get_user_type_display()})"

    def is_student(self):
        """Check if user is a student"""
        return self.user_type == 'student'

    def is_teacher(self):
        """Check if user is a teacher"""
        return self.user_type == 'teacher'


class StatusUpdate(models.Model):
    """
    Model for user status updates displayed on home pages.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='status_updates')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.content[:50]}"


class Invitation(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
    )

    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_invitations',
    )
    email = models.EmailField()
    full_name = models.CharField(max_length=255, blank=True)
    user_type = models.CharField(
        max_length=10,
        choices=User.USER_TYPE_CHOICES,
        default='student',
    )
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    bio = models.TextField(blank=True)

    token = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invitation',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation for {self.email} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(48)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.status == 'pending' and not self.is_expired
```

### 3.3 `backend/accounts/serializers.py`
```python
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from .models import User, StatusUpdate, Invitation


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    has_ai_key = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'user_type', 'bio', 'photo', 'date_of_birth', 'phone_number', 'is_blocked', 'created_at', 'ai_api_key', 'has_ai_key']
        read_only_fields = ['id', 'created_at', 'is_blocked', 'has_ai_key']
        extra_kwargs = {'ai_api_key': {'write_only': True}}

    def get_has_ai_key(self, obj):
        return bool(obj.ai_api_key)


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model with status updates"""
    status_updates = serializers.SerializerMethodField()
    has_ai_key = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'user_type', 'bio', 'photo', 'date_of_birth', 'phone_number', 'created_at', 'status_updates', 'has_ai_key']
        read_only_fields = ['id', 'created_at']

    def get_has_ai_key(self, obj):
        return bool(obj.ai_api_key)

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
        # Force student role on open registration — teachers are created via invitation only
        data['user_type'] = 'student'
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
```

### 3.4 `backend/accounts/api.py`
```python
from datetime import timedelta

from django.contrib.auth import authenticate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from notifications.tasks import send_invitation_email

from .models import User, StatusUpdate, Invitation
from .serializers import (
    UserSerializer, UserDetailSerializer, StatusUpdateSerializer,
    InvitationSerializer, InvitationPublicSerializer,
    AcceptInvitationSerializer, LoginSerializer, RegisterSerializer,
)


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_teacher() or request.user.is_staff)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.filter(is_blocked=False)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserDetailSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['patch'], parser_classes=[MultiPartParser, FormParser])
    def update_profile(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        user_type = request.query_params.get('user_type', '')
        include_blocked = request.query_params.get('include_blocked', '').lower() in ('true', '1')
        qs = User.objects.exclude(id=request.user.id)
        if not include_blocked:
            qs = qs.filter(is_blocked=False)
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=query) | Q(full_name__icontains=query) | Q(email__icontains=query))
        if user_type:
            qs = qs.filter(user_type=user_type)
        serializer = UserSerializer(qs[:50], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can block users'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        user.is_blocked = True
        user.save(update_fields=['is_blocked'])
        return Response({'message': f'{user.username} has been blocked.'})

    @action(detail=True, methods=['post'])
    def unblock(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can unblock users'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user.is_blocked = False
        user.save(update_fields=['is_blocked'])
        return Response({'message': f'{user.username} has been unblocked.'})

    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can delete users'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if user == request.user:
            return Response({'error': 'You cannot delete yourself'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser:
            return Response({'error': 'Cannot delete a superuser'}, status=status.HTTP_403_FORBIDDEN)
        username = user.username
        user.delete()
        return Response({'message': f'{username} has been deleted.'}, status=status.HTTP_200_OK)


class StatusUpdateViewSet(viewsets.ModelViewSet):
    queryset = StatusUpdate.objects.all()
    serializer_class = StatusUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return StatusUpdate.objects.filter(user=self.request.user)
        return StatusUpdate.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [IsTeacher]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        return Invitation.objects.filter(invited_by=self.request.user)

    def perform_create(self, serializer):
        invitation = serializer.save(invited_by=self.request.user)
        send_invitation_email.delay(invitation.pk)

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        invitation = self.get_object()
        if invitation.status == 'accepted':
            return Response(
                {'detail': 'This invitation has already been accepted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.expires_at = timezone.now() + timedelta(days=30)
        invitation.status = 'pending'
        invitation.save(update_fields=['expires_at', 'status'])
        send_invitation_email.delay(invitation.pk)
        return Response({'detail': f'Invitation resent to {invitation.email}.'})

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.csv'):
            return Response({'detail': 'Only .csv files are supported.'}, status=status.HTTP_400_BAD_REQUEST)
        if csv_file.size > 5 * 1024 * 1024:
            return Response({'detail': 'File size must be under 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        results = _process_csv_upload(csv_file, request.user, request)
        return Response(results)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import csv as csv_mod
        import io

        output = io.StringIO()
        writer = csv_mod.writer(output)
        headers = ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio']
        writer.writerow(headers)
        writer.writerow(['John Doe', 'john@example.com', 'student', '2000-01-15', '+1234567890', 'A new student'])

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="invitation_template.csv"'
        response.write(output.getvalue())
        return response


# ---------- Public invite endpoints ----------

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def validate_invite(request, token):
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        return Response({'detail': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.status == 'accepted':
        return Response({'detail': 'This invitation has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.is_expired:
        invitation.status = 'expired'
        invitation.save(update_fields=['status'])
        return Response({'detail': 'This invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = InvitationPublicSerializer(invitation)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def accept_invite(request, token):
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        return Response({'detail': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.status == 'accepted':
        return Response({'detail': 'This invitation has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.is_expired:
        invitation.status = 'expired'
        invitation.save(update_fields=['status'])
        return Response({'detail': 'This invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AcceptInvitationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = User.objects.create_user(
        username=serializer.validated_data['username'],
        email=invitation.email,
        password=serializer.validated_data['password'],
        full_name=invitation.full_name,
        user_type=invitation.user_type,
        date_of_birth=invitation.date_of_birth,
        phone_number=invitation.phone_number,
        bio=invitation.bio,
    )

    invitation.status = 'accepted'
    invitation.created_user = user
    invitation.save(update_fields=['status', 'created_user'])

    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


# ---------- Auth endpoints ----------

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )

    if user is None:
        return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    if user.is_blocked:
        return Response({'detail': 'Your account has been blocked.'}, status=status.HTTP_403_FORBIDDEN)

    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auth_me(request):
    serializer = UserDetailSerializer(request.user, context={'request': request})
    return Response(serializer.data)


# ---------- Helper functions ----------

def _process_csv_upload(csv_file, invited_by, request):
    import csv as csv_mod
    import io
    from datetime import datetime

    results = {'success': [], 'errors': [], 'total': 0}

    try:
        content = csv_file.read().decode('utf-8')
        reader = csv_mod.reader(io.StringIO(content))
        rows = list(reader)
    except Exception:
        results['errors'].append({'row': 0, 'error': 'Could not read the CSV file. Ensure it is a valid UTF-8 encoded .csv file.'})
        return results

    if len(rows) < 2:
        results['errors'].append({'row': 0, 'error': 'The file has no data rows.'})
        return results

    expected_headers = ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio']
    header = [str(h).strip().lower() for h in rows[0]]
    if header != expected_headers:
        results['errors'].append({
            'row': 1,
            'error': f'Invalid headers. Expected: {expected_headers}. Got: {header}',
        })
        return results

    valid_user_types = {'student', 'teacher'}

    for row_num, row in enumerate(rows[1:], start=2):
        results['total'] += 1

        if len(row) < 6:
            results['errors'].append({'row': row_num, 'error': 'Row has fewer than 6 columns.'})
            continue

        full_name = row[0].strip()
        email = row[1].strip()
        user_type = row[2].strip().lower()
        dob_raw = row[3].strip()
        phone_number = row[4].strip()
        bio = row[5].strip()

        if not email or '@' not in email:
            results['errors'].append({'row': row_num, 'error': f'Invalid or missing email: "{email}"'})
            continue

        if user_type not in valid_user_types:
            results['errors'].append({'row': row_num, 'error': f'Invalid user_type: "{user_type}". Must be "student" or "teacher".'})
            continue

        if User.objects.filter(email=email).exists():
            results['errors'].append({'row': row_num, 'error': f'A user with email {email} already exists.'})
            continue

        if Invitation.objects.filter(email=email, status='pending', expires_at__gt=timezone.now()).exists():
            results['errors'].append({'row': row_num, 'error': f'An active invitation for {email} already exists.'})
            continue

        date_of_birth = None
        if dob_raw:
            try:
                date_of_birth = datetime.strptime(dob_raw, '%Y-%m-%d').date()
            except ValueError:
                results['errors'].append({'row': row_num, 'error': f'Invalid date format: "{dob_raw}". Use YYYY-MM-DD.'})
                continue

        invitation = Invitation(
            invited_by=invited_by,
            email=email,
            full_name=full_name,
            user_type=user_type,
            date_of_birth=date_of_birth,
            phone_number=phone_number,
            bio=bio,
        )
        invitation.save()
        send_invitation_email.delay(invitation.pk)
        results['success'].append({'row': row_num, 'email': email})

    return results
```

### 3.5 `backend/accounts/admin.py`
```python
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
```

---

## Step 4: Courses App

Create empty files:
```bash
touch backend/courses/__init__.py
touch backend/courses/migrations/__init__.py
touch backend/courses/views.py
touch backend/courses/forms.py
touch backend/courses/urls.py
```

### 4.1 `backend/courses/apps.py`
```python
from django.apps import AppConfig


class CoursesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'courses'
```

### 4.2 `backend/courses/models.py`
```python
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


class Assignment(models.Model):
    """
    AI-generated assignment (quiz or flashcards) from uploaded PDF content.
    """
    ASSIGNMENT_TYPE_CHOICES = (
        ('quiz', 'Quiz'),
        ('flashcard', 'Flashcards'),
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=255)
    assignment_type = models.CharField(max_length=10, choices=ASSIGNMENT_TYPE_CHOICES)
    content = models.JSONField(help_text='JSON with questions or flashcards')
    source_file = models.FileField(
        upload_to='assignment_sources/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])]
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.course.code} - {self.title} ({self.get_assignment_type_display()})"


class AssignmentSubmission(models.Model):
    """
    Student submission/attempt for an assignment.
    """
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='assignment_submissions',
        limit_choices_to={'user_type': 'student'}
    )
    answers = models.JSONField(default=list, help_text='Student answers')
    score = models.IntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('assignment', 'student')
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.username} - {self.assignment.title}"
```

### 4.3 `backend/courses/serializers.py`
```python
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
```

### 4.4 `backend/courses/api.py`
```python
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
```

### 4.5 `backend/courses/tasks.py` (Celery task for AI assignment generation)
```python
import json
import logging
import urllib.request
import urllib.error

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def generate_assignment_task(course_id, user_id, assignment_type, pdf_text, title, deadline_str=None):
    """Generate quiz/flashcard assignment from PDF text using OpenAI API.

    Runs as a background Celery task to avoid blocking the HTTP request.
    """
    from django.utils.dateparse import parse_datetime
    from courses.models import Course, Assignment, Enrollment
    from accounts.models import User
    from notifications.utils import create_bulk_notifications

    try:
        course = Course.objects.get(pk=course_id)
        user = User.objects.get(pk=user_id)
    except (Course.DoesNotExist, User.DoesNotExist) as e:
        logger.error('generate_assignment_task: %s', e)
        return {'error': str(e)}

    api_key = user.ai_api_key
    if not api_key:
        return {'error': 'No API key configured'}

    # Build prompt
    if assignment_type == 'flashcard':
        prompt = (
            'Based on the following text, create 10 educational flashcards.\n'
            'Return ONLY valid JSON with this exact format (no markdown, no extra text):\n'
            '{"cards": [{"front": "term or question", "back": "definition or answer"}]}\n\n'
            f'Text:\n{pdf_text}'
        )
    else:
        prompt = (
            'Based on the following text, create a quiz with 10 multiple-choice questions.\n'
            'Each question must have 4 answer options. The options must be the actual answer text, '
            'NOT letter labels. Do NOT prefix options with "A.", "B.", etc.\n'
            'Return ONLY valid JSON (no markdown, no extra text) with this exact structure:\n'
            '{"questions": [{"question": "What is photosynthesis?", '
            '"options": ["The process of converting light to energy", '
            '"The process of cell division", '
            '"The process of water absorption", '
            '"The process of respiration"], '
            '"correct": 0}]}\n'
            '"correct" is the zero-based index (0-3) of the correct option.\n\n'
            f'Text:\n{pdf_text}'
        )

    # Call OpenAI API
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = json.dumps({
        'model': 'gpt-3.5-turbo',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7,
    }).encode('utf-8')

    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            ai_response = data['choices'][0]['message']['content']
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        logger.error('OpenAI API error: %s', e)
        return {'error': f'OpenAI API error: {e}'}

    # Parse JSON from response
    raw = ai_response.strip()
    if raw.startswith('```'):
        lines = raw.split('\n')
        lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        raw = '\n'.join(lines)

    try:
        content = json.loads(raw)
    except json.JSONDecodeError:
        return {'error': 'AI returned invalid JSON', 'raw_response': ai_response}

    if not title:
        title = f'{assignment_type.capitalize()} - {course.code}'

    deadline_val = parse_datetime(deadline_str) if deadline_str else None

    assignment = Assignment.objects.create(
        course=course,
        title=title,
        assignment_type=assignment_type,
        content=content,
        created_by=user,
        deadline=deadline_val,
    )

    # Send deadline notifications if applicable
    if assignment.deadline:
        enrollments = Enrollment.objects.filter(
            course=course, is_active=True
        ).select_related('student')
        recipients = [enrollment.student for enrollment in enrollments]
        create_bulk_notifications(
            recipients=recipients,
            notification_type='deadline',
            title=f'Assignment Deadline: {assignment.title}',
            message=(
                f'A deadline has been set for "{assignment.title}" in {course.title}: '
                f'{assignment.deadline.strftime("%b %d, %Y %I:%M %p")}.'
            ),
            link=f'/assignments/{assignment.id}',
        )

    return {'assignment_id': assignment.id, 'title': assignment.title}
```

### 4.6 `backend/courses/admin.py`
```python
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
```

---

## Step 5: Classroom App (WebSocket / Real-time)

Create empty files:
```bash
touch backend/classroom/__init__.py
touch backend/classroom/migrations/__init__.py
touch backend/classroom/views.py
touch backend/classroom/urls.py
```

### 5.1 `backend/classroom/apps.py`
```python
from django.apps import AppConfig


class ClassroomConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'classroom'
```

### 5.2 `backend/classroom/models.py`
```python
from django.db import models
from accounts.models import User


class Classroom(models.Model):
    """
    Model for classroom rooms between users.
    """
    name = models.CharField(max_length=255)
    participants = models.ManyToManyField(User, related_name='classrooms')
    whiteboard_data = models.TextField(default='[]')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        db_table = 'chat_chatroom'

    def __str__(self):
        return self.name


class ClassroomMessage(models.Model):
    """
    Model for messages in classroom rooms.
    """
    room = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        db_table = 'chat_chatmessage'

    def __str__(self):
        return f"{self.sender.username} in {self.room.name}: {self.content[:50]}"
```

### 5.3 `backend/classroom/serializers.py`
```python
from rest_framework import serializers
from .models import Classroom, ClassroomMessage


class ClassroomMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = ClassroomMessage
        fields = ['id', 'room', 'sender', 'sender_name', 'content', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']


class ClassroomSerializer(serializers.ModelSerializer):
    participant_names = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = ['id', 'name', 'participants', 'participant_names', 'last_message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'participants': {'required': False},
        }

    def get_participant_names(self, obj):
        return [u.username for u in obj.participants.all()]

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {'sender': msg.sender.username, 'content': msg.content[:100], 'created_at': msg.created_at}
        return None
```

### 5.4 `backend/classroom/api.py`
```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Classroom, ClassroomMessage
from .serializers import ClassroomSerializer, ClassroomMessageSerializer


class ClassroomViewSet(viewsets.ModelViewSet):
    serializer_class = ClassroomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Classroom.objects.filter(participants=self.request.user)

    def perform_create(self, serializer):
        room = serializer.save()
        room.participants.add(self.request.user)
        participant_ids = self.request.data.get('participants', [])
        if participant_ids:
            from accounts.models import User
            users = User.objects.filter(id__in=participant_ids)
            room.participants.add(*users)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a classroom room"""
        room = self.get_object()
        room.participants.add(request.user)
        return Response(ClassroomSerializer(room).data)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room = self.get_object()
        if request.user not in room.participants.all():
            return Response({'error': 'You are not a participant in this room.'}, status=status.HTTP_403_FORBIDDEN)
        messages = room.messages.select_related('sender').order_by('-created_at')[:100]
        serializer = ClassroomMessageSerializer(reversed(list(messages)), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        room = self.get_object()
        if request.user not in room.participants.all():
            return Response({'error': 'You are not a participant in this room.'}, status=status.HTTP_403_FORBIDDEN)
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Message content required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 5000:
            return Response({'detail': 'Message too long (max 5000 characters).'}, status=status.HTTP_400_BAD_REQUEST)
        msg = ClassroomMessage.objects.create(room=room, sender=request.user, content=content)
        return Response(ClassroomMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
```

### 5.5 `backend/classroom/middleware.py`
```python
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """Extract DRF token from WebSocket query string and authenticate user."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_key = params.get('token', [None])[0]

        if token_key:
            scope['user'] = await get_user_from_token(token_key)
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
```

### 5.6 `backend/classroom/routing.py`
```python
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/classroom/(?P<room_name>[\w-]+)/$', consumers.ClassroomConsumer.as_asgi()),
]
```

### 5.7 `backend/classroom/consumers.py`
```python
import json
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Classroom, ClassroomMessage
from accounts.models import User


def find_room(room_name):
    """Find a Classroom by name, trying sanitized and original variants."""
    room = Classroom.objects.filter(name=room_name).first()
    if room:
        return room
    original_name = re.sub(r'_', ' ', room_name)
    if original_name != room_name:
        room = Classroom.objects.filter(name=original_name).first()
    return room


class ClassroomConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time classroom chat and whiteboard"""

    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'classroom_{self.room_name}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        if not await self.is_participant(self.user.id, self.room_name):
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        self.user_group_name = f'{self.room_group_name}_user_{self.user.username}'
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)

        await self.accept()

        wb_data = await self.get_whiteboard_data(self.room_name)
        await self.send(text_data=json.dumps({'type': 'whiteboard_state', 'actions': wb_data}))

        await self.channel_layer.group_send(
            self.room_group_name, {'type': 'user_join', 'username': self.user.username}
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_send(
                self.room_group_name, {'type': 'user_leave', 'username': self.user.username}
            )
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', 'chat')

        if msg_type == 'chat':
            message = data.get('message', '')
            if message.strip() and len(message) <= 5000:
                await self.save_message(self.user.id, self.room_name, message)
                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'chat_message', 'message': message,
                    'username': self.user.username, 'user_type': self.user.user_type
                })

        elif msg_type in ('draw', 'line', 'text', 'erase'):
            if self.user.user_type != 'teacher':
                return
            action = {k: v for k, v in data.items()}
            await self.append_whiteboard_action(self.room_name, action)
            await self.channel_layer.group_send(
                self.room_group_name, {'type': f'wb_{msg_type}', 'action': action}
            )

        elif msg_type == 'move':
            if self.user.user_type != 'teacher':
                return
            index = data.get('index')
            dx = data.get('dx', 0)
            dy = data.get('dy', 0)
            if index is None:
                return
            await self.move_whiteboard_action(self.room_name, index, dx, dy)
            await self.channel_layer.group_send(
                self.room_group_name, {'type': 'wb_move', 'index': index, 'dx': dx, 'dy': dy}
            )

        elif msg_type == 'undo':
            if self.user.user_type != 'teacher':
                return
            removed = await self.pop_whiteboard_action(self.room_name)
            if removed is not None:
                await self.channel_layer.group_send(self.room_group_name, {'type': 'wb_undo'})

        elif msg_type == 'clear':
            if self.user.user_type != 'teacher':
                return
            await self.clear_whiteboard_data(self.room_name)
            await self.channel_layer.group_send(
                self.room_group_name, {'type': 'wb_clear', 'action': {'type': 'clear'}}
            )

        elif msg_type == 'audio_start':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'audio_signal',
                'payload': {'type': 'audio_start', 'username': self.user.username}
            })

        elif msg_type == 'audio_stop':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'audio_signal', 'payload': {'type': 'audio_stop'}
            })

        elif msg_type == 'audio_data':
            if self.user.user_type != 'teacher':
                return
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'audio_data', 'data': data.get('data', '')
            })

    # --- Chat handlers ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message', 'message': event['message'],
            'username': event['username'], 'user_type': event['user_type']
        }))

    async def user_join(self, event):
        await self.send(text_data=json.dumps({'type': 'user_join', 'username': event['username']}))

    async def user_leave(self, event):
        await self.send(text_data=json.dumps({'type': 'user_leave', 'username': event['username']}))

    # --- Whiteboard handlers ---
    async def wb_draw(self, event):
        await self.send(text_data=json.dumps({**event['action'], 'type': 'wb_draw'}))

    async def wb_line(self, event):
        await self.send(text_data=json.dumps({**event['action'], 'type': 'wb_line'}))

    async def wb_text(self, event):
        await self.send(text_data=json.dumps({**event['action'], 'type': 'wb_text'}))

    async def wb_erase(self, event):
        await self.send(text_data=json.dumps({**event['action'], 'type': 'wb_erase'}))

    async def wb_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'wb_move', 'index': event['index'], 'dx': event['dx'], 'dy': event['dy']
        }))

    async def wb_undo(self, event):
        await self.send(text_data=json.dumps({'type': 'wb_undo'}))

    async def wb_clear(self, event):
        await self.send(text_data=json.dumps({'type': 'wb_clear'}))

    # --- Audio streaming handlers ---
    async def audio_signal(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    async def audio_data(self, event):
        if self.user.user_type == 'teacher':
            return
        await self.send(text_data=json.dumps({'type': 'audio_data', 'data': event['data']}))

    # --- Database helpers ---
    @database_sync_to_async
    def is_participant(self, user_id, room_name):
        room = find_room(room_name)
        if not room:
            return False
        return room.participants.filter(id=user_id).exists()

    @database_sync_to_async
    def add_participant(self, user_id, room_name):
        user = User.objects.get(id=user_id)
        room = find_room(room_name)
        if room and user not in room.participants.all():
            room.participants.add(user)

    @database_sync_to_async
    def save_message(self, user_id, room_name, message):
        user = User.objects.get(id=user_id)
        room = find_room(room_name)
        if not room:
            return
        if user not in room.participants.all():
            room.participants.add(user)
        ClassroomMessage.objects.create(room=room, sender=user, content=message)

    @database_sync_to_async
    def get_whiteboard_data(self, room_name):
        room = find_room(room_name)
        if room and room.whiteboard_data:
            try:
                return json.loads(room.whiteboard_data)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @database_sync_to_async
    def pop_whiteboard_action(self, room_name):
        room = find_room(room_name)
        if not room:
            return None
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if not actions:
            return None
        removed = actions.pop()
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])
        return removed

    MAX_WHITEBOARD_ACTIONS = 500

    @database_sync_to_async
    def append_whiteboard_action(self, room_name, action):
        room = find_room(room_name)
        if not room:
            return
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if len(actions) >= self.MAX_WHITEBOARD_ACTIONS:
            actions = actions[-(self.MAX_WHITEBOARD_ACTIONS - 1):]
        actions.append(action)
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])

    @database_sync_to_async
    def move_whiteboard_action(self, room_name, index, dx, dy):
        room = find_room(room_name)
        if not room:
            return
        try:
            actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
        except (json.JSONDecodeError, TypeError):
            actions = []
        if index < 0 or index >= len(actions):
            return
        action = actions[index]
        if action.get('type') == 'text':
            action['x'] = action.get('x', 0) + dx
            action['y'] = action.get('y', 0) + dy
        elif action.get('type') == 'line':
            action['x1'] = action.get('x1', 0) + dx
            action['y1'] = action.get('y1', 0) + dy
            action['x2'] = action.get('x2', 0) + dx
            action['y2'] = action.get('y2', 0) + dy
        actions[index] = action
        room.whiteboard_data = json.dumps(actions)
        room.save(update_fields=['whiteboard_data'])

    @database_sync_to_async
    def clear_whiteboard_data(self, room_name):
        room = find_room(room_name)
        if room:
            room.whiteboard_data = '[]'
            room.save(update_fields=['whiteboard_data'])
```

### 5.8 `backend/classroom/admin.py`
```python
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
```

---

## Step 6: Notifications App

Create empty files:
```bash
touch backend/notifications/__init__.py
touch backend/notifications/migrations/__init__.py
touch backend/notifications/views.py
```

### 6.1 `backend/notifications/apps.py`
```python
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
```

### 6.2 `backend/notifications/models.py`
```python
from django.db import models
from accounts.models import User


class Notification(models.Model):
    """
    Model for user notifications.
    Handles notifications for enrollments and new course materials.
    """
    NOTIFICATION_TYPE_CHOICES = (
        ('enrollment', 'New Enrollment'),
        ('material', 'New Material'),
        ('feedback', 'New Feedback'),
        ('deadline', 'Assignment Deadline'),
        ('general', 'General'),
    )

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username} - {self.title}"
```

### 6.3 `backend/notifications/serializers.py`
```python
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = ['id', 'notification_type', 'title', 'message', 'link', 'created_at']
```

### 6.4 `backend/notifications/api.py`
```python
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)
```

### 6.5 `backend/notifications/tasks.py` (Celery tasks for async email)
```python
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail, send_mass_mail

logger = logging.getLogger(__name__)


@shared_task
def send_notification_email(title, message, recipient_email):
    """Send a single notification email asynchronously."""
    try:
        send_mail(
            subject=title,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Failed to send notification email to %s', recipient_email)


@shared_task
def send_bulk_notification_emails(email_messages_data):
    """Send multiple notification emails asynchronously.

    email_messages_data: list of [subject, message, from_email, [recipient]]
    """
    if not email_messages_data:
        return
    try:
        email_tuples = [tuple(em) for em in email_messages_data]
        send_mass_mail(email_tuples, fail_silently=True)
    except Exception:
        logger.exception('Failed to send bulk notification emails')


@shared_task
def send_invitation_email(invitation_id):
    """Send invitation email asynchronously."""
    from accounts.models import Invitation

    try:
        invitation = Invitation.objects.select_related('invited_by').get(pk=invitation_id)
    except Invitation.DoesNotExist:
        logger.error('Invitation %s not found', invitation_id)
        return

    frontend_base = (
        settings.CORS_ALLOWED_ORIGINS[0]
        if settings.CORS_ALLOWED_ORIGINS
        else 'http://localhost:5173'
    )
    invite_url = f"{frontend_base}/invite/{invitation.token}"

    subject = 'You have been invited to the eLearning Platform'
    message = (
        f"Hello {invitation.full_name or 'there'},\n\n"
        f"You have been invited to join the eLearning Platform "
        f"as a {invitation.get_user_type_display()} "
        f"by {invitation.invited_by.full_name or invitation.invited_by.username}.\n\n"
        f"Click the following link to complete your registration:\n"
        f"{invite_url}\n\n"
        f"This link will expire on {invitation.expires_at.strftime('%B %d, %Y')}.\n\n"
        f"If you did not expect this invitation, you can ignore this email.\n\n"
        f"Best regards,\n"
        f"eLearning Platform"
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [invitation.email],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Failed to send invitation email to %s', invitation.email)
```

### 6.6 `backend/notifications/utils.py`
```python
import logging

from django.conf import settings

from .models import Notification
from .tasks import send_notification_email, send_bulk_notification_emails

logger = logging.getLogger(__name__)


def create_notification(*, recipient, notification_type, title, message, link=''):
    """Create an in-app notification and send a corresponding email via Celery."""
    notification = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )

    if recipient.email:
        send_notification_email.delay(title, message, recipient.email)

    return notification


def create_bulk_notifications(*, recipients, notification_type, title, message, link=''):
    """Create in-app notifications for multiple recipients and send emails via Celery."""
    notifications = []
    email_messages = []

    for recipient in recipients:
        notification = Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
        )
        notifications.append(notification)

        if recipient.email:
            email_messages.append(
                [title, message, settings.DEFAULT_FROM_EMAIL, [recipient.email]]
            )

    if email_messages:
        send_bulk_notification_emails.delay(email_messages)

    return notifications
```

### 6.7 `backend/notifications/admin.py`
```python
from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin configuration for Notification model"""
    list_display = ['recipient', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['recipient__username', 'title', 'message']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
```

### Checkpoint 2 — Backend
```bash
docker compose up -d backend redis
docker compose exec backend python manage.py makemigrations accounts courses classroom notifications
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
# Visit http://localhost:8080/admin/ — should show Django admin with styled CSS
docker compose exec backend python manage.py collectstatic --noinput
```

---

## Step 7: Seed Data (CSV files + Management Command)

### 7.1 `backend/seed_data/users.csv`
```csv
username,email,password,full_name,user_type,bio,phone_number,date_of_birth,is_staff,is_superuser
admin,admin@elearning.com,admin123,Admin User,teacher,,,,,true,true
john_teacher,john@elearning.com,teacher123,John Smith,teacher,Experienced computer science professor with 10 years of teaching experience.,+1-555-0101,1980-03-15,false,false
maria_teacher,maria@elearning.com,teacher123,Maria Garcia,teacher,Mathematics educator passionate about making learning fun and accessible.,+1-555-0102,1985-07-22,false,false
alice_student,alice@elearning.com,student123,Alice Johnson,student,Computer Science student eager to learn new technologies.,+1-555-0201,2002-01-10,false,false
bob_student,bob@elearning.com,student123,Bob Williams,student,Passionate about web development and design.,+1-555-0202,2001-05-18,false,false
charlie_student,charlie@elearning.com,student123,Charlie Brown,student,Mathematics enthusiast and problem solver.,+1-555-0203,2003-11-30,false,false
diana_student,diana@school.edu,student123,Diana Prince,student,Interested in data science and machine learning.,+1-555-0204,2002-06-14,false,false
ethan_student,ethan@school.edu,student123,Ethan Hunt,student,Cybersecurity enthusiast.,+1-555-0205,2001-09-03,false,false
```

### 7.2 `backend/seed_data/courses.csv`
```csv
code,title,description,teacher_username
CS101,Introduction to Python Programming,Learn the fundamentals of Python programming.,john_teacher
CS201,Advanced Web Development with Django,Master Django framework for building scalable web applications.,john_teacher
MATH101,Calculus I,Introduction to differential and integral calculus.,maria_teacher
CS301,Data Structures and Algorithms,Study fundamental data structures and algorithms.,john_teacher
```

### 7.3 `backend/seed_data/enrollments.csv`
```csv
student_username,course_code
alice_student,CS101
alice_student,CS201
bob_student,CS101
bob_student,CS201
charlie_student,MATH101
diana_student,CS101
diana_student,CS301
ethan_student,CS201
```

### 7.4 `backend/seed_data/feedback.csv`
```csv
student_username,course_code,rating,comment
alice_student,CS101,5,Excellent course!
bob_student,CS101,4,"Great content, needs more exercises."
charlie_student,MATH101,5,Amazing teacher!
```

### 7.5 `backend/seed_data/status_updates.csv`
```csv
username,content
alice_student,Excited to start learning Django! Looking forward to building amazing web applications.
bob_student,Just finished my first Python project. Programming is so much fun!
john_teacher,Looking forward to teaching the new Web Development course this semester!
diana_student,Just registered via the invite link. Thanks for adding me to the platform!
```

### 7.6 `backend/seed_data/invitations.csv`
```csv
email,full_name,user_type,date_of_birth,phone_number,bio,invited_by_username,status,created_user_username
diana@school.edu,Diana Prince,student,2002-06-14,+1-555-0204,Interested in data science and machine learning.,john_teacher,accepted,diana_student
ethan@school.edu,Ethan Hunt,student,2001-09-03,+1-555-0205,Cybersecurity enthusiast.,john_teacher,accepted,ethan_student
fiona@school.edu,Fiona Green,student,2003-02-20,+1-555-0206,Aspiring software engineer.,john_teacher,pending,
george@school.edu,George Martin,student,2002-08-05,+1-555-0207,Loves frontend development.,john_teacher,pending,
hannah@school.edu,Hannah Lee,student,2003-04-12,+1-555-0208,Math and physics student.,maria_teacher,pending,
ivan@school.edu,Ivan Petrov,student,2001-12-01,+1-555-0209,Database and backend enthusiast.,maria_teacher,pending,
julia@school.edu,Julia Roberts,student,2002-10-28,+1-555-0210,Interested in AI and robotics.,john_teacher,pending,
new_teacher@school.edu,Kevin Chen,teacher,1990-06-15,+1-555-0301,New physics teacher joining next semester.,admin,pending,
expired_user@school.edu,Old Student,student,2000-01-01,+1-555-0299,This invitation has expired.,john_teacher,expired,
```

### 7.7 `backend/accounts/management/commands/populate_db.py`
```python
import csv
from datetime import date, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token

from courses.models import Course, Enrollment, Feedback
from accounts.models import StatusUpdate, Invitation
from notifications.models import Notification

User = get_user_model()

SEED_DIR = Path(__file__).resolve().parent.parent.parent.parent / 'seed_data'


def parse_date(value):
    """Parse a YYYY-MM-DD string into a date object, or return None."""
    if not value:
        return None
    y, m, d = value.split('-')
    return date(int(y), int(m), int(d))


def parse_bool(value):
    """Parse a string into a boolean."""
    return value.strip().lower() in ('true', '1', 'yes')


def read_csv(filename):
    """Read a CSV file from the seed_data directory and return rows as dicts."""
    path = SEED_DIR / filename
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


class Command(BaseCommand):
    help = 'Populate database with demo data from CSV files in seed_data/'

    def handle(self, *args, **kwargs):
        users = self._load_users()
        self._load_courses(users)
        self._load_enrollments(users)
        self._load_feedback(users)
        self._load_status_updates(users)
        self._load_invitations(users)
        self._print_summary(users)

    def _load_users(self):
        """Create user accounts from seed_data/users.csv and generate auth tokens."""
        self.stdout.write('Loading users from users.csv...')
        users = {}

        for row in read_csv('users.csv'):
            user, created = User.objects.get_or_create(
                username=row['username'],
                defaults={
                    'email': row['email'],
                    'full_name': row['full_name'],
                    'user_type': row['user_type'],
                    'bio': row.get('bio', ''),
                    'phone_number': row.get('phone_number', ''),
                    'date_of_birth': parse_date(row.get('date_of_birth', '')),
                    'is_staff': parse_bool(row.get('is_staff', 'false')),
                    'is_superuser': parse_bool(row.get('is_superuser', 'false')),
                },
            )
            if created:
                user.set_password(row['password'])
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  Created {row["user_type"]}: {row["username"]} / {row["password"]}'
                ))

            Token.objects.get_or_create(user=user)
            users[row['username']] = user

        return users

    def _load_courses(self, users):
        """Create courses from seed_data/courses.csv."""
        self.stdout.write('Loading courses from courses.csv...')

        for row in read_csv('courses.csv'):
            course, created = Course.objects.get_or_create(
                code=row['code'],
                defaults={
                    'title': row['title'],
                    'description': row['description'],
                    'teacher': users[row['teacher_username']],
                    'is_active': True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created course: {row["code"]}'))

    def _load_enrollments(self, users):
        """Create enrollments from seed_data/enrollments.csv."""
        self.stdout.write('Loading enrollments from enrollments.csv...')

        for row in read_csv('enrollments.csv'):
            course = Course.objects.get(code=row['course_code'])
            _, created = Enrollment.objects.get_or_create(
                student=users[row['student_username']],
                course=course,
                defaults={'is_active': True},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Enrolled {row["student_username"]} in {row["course_code"]}'
                ))

    def _load_feedback(self, users):
        """Create feedback from seed_data/feedback.csv."""
        self.stdout.write('Loading feedback from feedback.csv...')

        for row in read_csv('feedback.csv'):
            course = Course.objects.get(code=row['course_code'])
            _, created = Feedback.objects.get_or_create(
                course=course,
                student=users[row['student_username']],
                defaults={
                    'rating': int(row['rating']),
                    'comment': row['comment'],
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Feedback: {row["student_username"]} → {row["course_code"]}'
                ))

    def _load_status_updates(self, users):
        """Create status updates from seed_data/status_updates.csv."""
        self.stdout.write('Loading status updates from status_updates.csv...')

        for row in read_csv('status_updates.csv'):
            _, created = StatusUpdate.objects.get_or_create(
                user=users[row['username']],
                content=row['content'],
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Status: {row["username"]}'
                ))

    def _load_invitations(self, users):
        """Create invitations from seed_data/invitations.csv."""
        self.stdout.write('Loading invitations from invitations.csv...')

        for row in read_csv('invitations.csv'):
            status = row['status']
            created_user_username = row.get('created_user_username', '').strip()

            defaults = {
                'invited_by': users[row['invited_by_username']],
                'full_name': row['full_name'],
                'user_type': row['user_type'],
                'date_of_birth': parse_date(row.get('date_of_birth', '')),
                'phone_number': row.get('phone_number', ''),
                'bio': row.get('bio', ''),
                'status': status,
            }

            if status == 'accepted' and created_user_username:
                defaults['created_user'] = users[created_user_username]
                defaults['expires_at'] = timezone.now() + timedelta(days=30)
            elif status == 'expired':
                defaults['expires_at'] = timezone.now() - timedelta(days=5)

            inv, created = Invitation.objects.get_or_create(
                email=row['email'],
                defaults=defaults,
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  Invitation ({status}): {row["email"]}'
                ))

    def _print_summary(self, users):
        """Print a summary of all seeded data."""
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Database populated successfully!'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')

        self.stdout.write('Registered accounts (username / password):')
        for row in read_csv('users.csv'):
            role = 'Admin' if parse_bool(row.get('is_superuser', 'false')) else row['user_type'].title()
            self.stdout.write(f'  {role:10s} {row["username"]} / {row["password"]}')

        self.stdout.write('')
        self.stdout.write('Pending invitations (not yet registered):')
        for inv in Invitation.objects.filter(status='pending'):
            self.stdout.write(f'  {inv.email:30s} token: {inv.token[:30]}...')
        self.stdout.write(f'  Use link: http://localhost:5173/invite/<token>')

        self.stdout.write('')
        self.stdout.write('Expired invitations:')
        for inv in Invitation.objects.filter(status='expired'):
            self.stdout.write(f'  {inv.email}')
```

### Checkpoint 3 — Seed Data
```bash
docker compose exec backend python manage.py populate_db
# Should show all created users, courses, enrollments, etc.
```

---

## Step 8: Frontend — Foundation (Types, API Client, Auth Context)

### 8.1 `frontend/src/vite-env.d.ts`
```typescript
/// <reference types="vite/client" />
```

### 8.2 `frontend/src/setupTests.ts`
```typescript
import '@testing-library/jest-dom';
```

### 8.3 `frontend/src/types/index.ts`
```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  bio: string;
  photo: string | null;
  date_of_birth: string | null;
  phone_number: string;
  is_blocked: boolean;
  created_at: string;
  status_updates?: StatusUpdate[];
  has_ai_key?: boolean;
}

export interface StatusUpdate {
  id: number;
  user: number;
  username: string;
  content: string;
  created_at: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  teacher: number;
  teacher_name: string;
  code: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  enrolled_count: number;
  average_rating: number | null;
}

export interface CourseMaterial {
  id: number;
  course: number;
  title: string;
  description: string;
  material_type: 'document' | 'image' | 'video' | 'other';
  file: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface Enrollment {
  id: number;
  student: number;
  student_name: string;
  course: number;
  course_title: string;
  enrolled_at: string;
  is_active: boolean;
  completed: boolean;
}

export interface Feedback {
  id: number;
  course: number;
  student: number;
  student_name: string;
  rating: number | null;
  comment: string;
  created_at: string;
}

export interface Invitation {
  id: number;
  invited_by: number;
  invited_by_username: string;
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  date_of_birth: string | null;
  phone_number: string;
  bio: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface InvitationPublic {
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  date_of_birth: string | null;
  phone_number: string;
  bio: string;
  status: string;
}

export interface ClassroomRoom {
  id: number;
  name: string;
  participants: number[];
  participant_names: string[];
  last_message: { sender: string; content: string; created_at: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ClassroomMessage {
  id: number;
  room: number;
  sender: number;
  sender_name: string;
  content: string;
  created_at: string;
  user_type?: 'student' | 'teacher';
}

export type WhiteboardTool = 'pen' | 'line' | 'text' | 'eraser' | 'move';

export interface WbDrawAction {
  type: 'draw';
  points: [number, number][];
  color: string;
  width: number;
}

export interface WbLineAction {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface WbTextAction {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;
  color: string;
}

export interface WbEraseAction {
  type: 'erase';
  points: [number, number][];
  width: number;
}

export interface WbClearAction {
  type: 'clear';
}

export type WhiteboardAction = WbDrawAction | WbLineAction | WbTextAction | WbEraseAction | WbClearAction;

export interface AppNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface BulkUploadResult {
  success: Array<{ row: number; email: string }>;
  errors: Array<{ row: number; error: string }>;
  total: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Assignment {
  id: number;
  course: number;
  course_title: string;
  title: string;
  assignment_type: 'quiz' | 'flashcard';
  content: { questions?: QuizQuestion[]; cards?: Flashcard[] };
  source_file: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  deadline: string | null;
  submission_count: number;
}

export interface AssignmentSubmission {
  id: number;
  assignment: number;
  student: number;
  student_name: string;
  answers: number[];
  score: number | null;
  submitted_at: string;
}
```

### 8.4 `frontend/src/api/client.ts`
```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default client;
```

### 8.5 `frontend/src/context/AuthContext.tsx`
```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    full_name: string;
    user_type: string;
    password: string;
    password_confirm: string;
  }) => Promise<void>;
  logout: () => void;
  setAuthFromResponse: (response: AuthResponse) => void;
  refreshUser: () => Promise<void>;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/auth/me/');
      setUser(res.data);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (username: string, password: string) => {
    const res = await client.post<AuthResponse>('/auth/login/', { username, password });
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const register = async (data: {
    username: string;
    email: string;
    full_name: string;
    user_type: string;
    password: string;
    password_confirm: string;
  }) => {
    const res = await client.post<AuthResponse>('/auth/register/', data);
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const setAuthFromResponse = (response: AuthResponse) => {
    localStorage.setItem('auth_token', response.token);
    setUser(response.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        setAuthFromResponse,
        refreshUser: fetchUser,
        unreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

## Step 9: Frontend — Theme & Styling

### 9.1 `frontend/src/theme.css`
```css
/* ===== CSS Custom Properties ===== */
:root {
  --el-green: #4ade80;
  --el-green-dark: #16a34a;
  --el-green-50: #f0fdf4;
  --el-blue: #38bdf8;
  --el-blue-dark: #0284c7;
  --el-blue-50: #eff6ff;
  --el-gradient: linear-gradient(135deg, #4ade80, #38bdf8);
  --el-gradient-hover: linear-gradient(135deg, #16a34a, #0284c7);
  --el-shadow: 0 2px 12px rgba(74, 222, 128, 0.15);
  --el-shadow-hover: 0 4px 20px rgba(74, 222, 128, 0.25);
}

/* ===== Global ===== */
body {
  background-color: #f8fafc !important;
}

/* ===== Bootstrap Variable Overrides ===== */
.btn-primary {
  --bs-btn-bg: var(--el-green);
  --bs-btn-border-color: var(--el-green);
  --bs-btn-hover-bg: var(--el-green-dark);
  --bs-btn-hover-border-color: var(--el-green-dark);
  --bs-btn-active-bg: var(--el-green-dark);
  --bs-btn-active-border-color: var(--el-green-dark);
  --bs-btn-disabled-bg: var(--el-green);
  --bs-btn-disabled-border-color: var(--el-green);
}

.btn-outline-primary {
  --bs-btn-color: var(--el-green-dark);
  --bs-btn-border-color: var(--el-green);
  --bs-btn-hover-bg: var(--el-green);
  --bs-btn-hover-border-color: var(--el-green);
  --bs-btn-hover-color: #fff;
  --bs-btn-active-bg: var(--el-green-dark);
  --bs-btn-active-border-color: var(--el-green-dark);
  --bs-btn-active-color: #fff;
}

.btn-outline-light {
  --bs-btn-hover-bg: rgba(255, 255, 255, 0.15);
  --bs-btn-hover-color: #fff;
}

.badge.bg-primary {
  background-color: var(--el-green) !important;
}

.badge.bg-info {
  background-color: var(--el-blue) !important;
  color: #fff !important;
}

.badge.bg-success {
  background-color: var(--el-green) !important;
}

/* ===== Cards ===== */
.card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: var(--el-shadow);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.card:hover {
  box-shadow: var(--el-shadow-hover);
}

.card-header {
  background-color: var(--el-green-50) !important;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 0.75rem 0.75rem 0 0 !important;
}

.card-footer {
  border-radius: 0 0 0.75rem 0.75rem !important;
}

/* ===== Forms ===== */
.form-control:focus,
.form-select:focus {
  border-color: var(--el-green) !important;
  box-shadow: 0 0 0 0.2rem rgba(74, 222, 128, 0.25) !important;
}

/* ===== Tables ===== */
.table thead th {
  background-color: var(--el-green-50);
  border-bottom-color: #d1fae5;
  color: #166534;
  font-weight: 600;
}

/* ===== Alerts ===== */
.alert-info {
  background-color: var(--el-blue-50) !important;
  border-color: #bae6fd !important;
  color: var(--el-blue-dark) !important;
}

.alert-success {
  background-color: var(--el-green-50) !important;
  border-color: #bbf7d0 !important;
  color: var(--el-green-dark) !important;
}

/* ===== Spinners ===== */
.spinner-border {
  color: var(--el-green) !important;
}

/* ===== Links ===== */
a {
  color: var(--el-blue-dark);
}

a:hover {
  color: #0369a1;
}

/* ===== Navbar override ===== */
.navbar.bg-primary {
  background: var(--el-gradient) !important;
}

/* ===== Custom Classes ===== */

/* Gradient navbar */
.el-navbar {
  background: var(--el-gradient) !important;
  box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3);
}

/* Gradient button */
.el-btn-gradient {
  background: var(--el-gradient) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3);
}

.el-btn-gradient:hover {
  background: var(--el-gradient-hover) !important;
  box-shadow: 0 4px 16px rgba(74, 222, 128, 0.4);
  transform: translateY(-1px);
  color: #fff !important;
}

/* Auth page header */
.el-auth-header {
  background: var(--el-gradient);
  padding: 2rem 1.5rem;
  text-align: center;
  color: #fff;
  border-radius: 0.75rem 0.75rem 0 0;
}

.el-auth-header h3 {
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.el-auth-header p {
  margin: 0.5rem 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

/* Card with top gradient accent */
.el-card-accent {
  border-top: 3px solid transparent;
  border-image: var(--el-gradient) 1;
}

/* Gradient avatar fallback */
.el-avatar-gradient {
  background: var(--el-gradient) !important;
}

/* Glow card (auth pages) */
.el-glow {
  box-shadow: 0 4px 24px rgba(74, 222, 128, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* Drop zone */
.el-drop-zone {
  border: 2px dashed var(--el-green) !important;
  border-radius: 0.75rem;
  background-color: var(--el-green-50);
  transition: all 0.2s ease;
}

.el-drop-zone:hover,
.el-drop-zone.dragging {
  border-color: var(--el-green-dark) !important;
  background-color: #dcfce7;
}

/* Gradient text */
.el-gradient-text {
  background: var(--el-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Dashed card border for "add" tiles */
.border-dashed {
  border: 2px dashed #d1fae5 !important;
  transition: border-color 0.2s ease;
}

.border-dashed:hover {
  border-color: var(--el-green) !important;
}

/* Notification unread */
.list-group-item.bg-light {
  background-color: var(--el-blue-50) !important;
}

/* Flashcard gradient back */
.el-flashcard-back {
  background: var(--el-gradient);
  color: #fff;
}

/* Scrollbar theming */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
```

---

## Step 10: Frontend — Components (Navbar, ProtectedRoute)

### 10.1 `frontend/src/components/Navbar.tsx`
```tsx
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Navbar() {
  const { user, isAuthenticated, logout, unreadCount, setUnreadCount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      client.get('/notifications/').then(res => {
        const unread = res.data.filter((n: { is_read: boolean }) => !n.is_read).length;
        setUnreadCount(unread);
      }).catch(() => {});
    }
  }, [isAuthenticated, setUnreadCount]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark el-navbar">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">eLearning Platform</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">Home</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/classroom">Classroom</Link>
                </li>
                {user?.user_type === 'teacher' && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to="/invitations">Invitations</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/courses/create">Create Course</Link>
                    </li>
                  </>
                )}
              </>
            )}
          </ul>
          <ul className="navbar-nav">
            {isAuthenticated ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link position-relative" to="/notifications">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="badge bg-danger rounded-pill ms-1">{unreadCount}</span>
                    )}
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link d-flex align-items-center" to={`/profile/${user?.username}`}>
                    {user?.photo ? (
                      <img src={user.photo} alt={user.username} className="rounded-circle me-1" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                    ) : null}
                    {user?.username} ({user?.user_type})
                  </Link>
                </li>
                <li className="nav-item">
                  <button className="btn btn-outline-light btn-sm mt-1 ms-2" onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">Register</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
```

### 10.2 `frontend/src/components/ProtectedRoute.tsx`
```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredType?: 'teacher' | 'student';
}

export default function ProtectedRoute({ children, requiredType }: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-5"><p>Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredType && user?.user_type !== requiredType) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

---

## Step 11: Frontend — Auth Pages (Login, Register, AcceptInvitation)

### 11.1 `frontend/src/pages/Login.tsx`
```tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Login failed.');
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card el-glow" style={{ maxWidth: 420, width: '100%' }}>
        <div className="el-auth-header">
          <h3>eLearning Platform</h3>
          <p>Sign in to your account</p>
        </div>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                id="username"
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary el-btn-gradient w-100 mb-3">Log In</button>
          </form>
          <div className="text-center">
            <small className="text-muted">
              Have an invite link? Use it to register.<br />
              Or <Link to="/register">create an account</Link>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 11.2 `frontend/src/pages/Register.tsx`
```tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    user_type: 'student',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await register(formData);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setError(messages);
      } else {
        setError('Registration failed.');
      }
    }
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6">
        <div className="card el-glow">
          <div className="el-auth-header">
            <h3>Create Account</h3>
            <p>Join the eLearning platform</p>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input id="username" name="username" type="text" className="form-control" value={formData.username} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input id="email" name="email" type="email" className="form-control" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="full_name" className="form-label">Full Name</label>
                <input id="full_name" name="full_name" type="text" className="form-control" value={formData.full_name} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="user_type" className="form-label">User Type</label>
                <select id="user_type" name="user_type" className="form-select" value={formData.user_type} onChange={handleChange}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input id="password" name="password" type="password" className="form-control" value={formData.password} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="password_confirm" className="form-label">Confirm Password</label>
                <input id="password_confirm" name="password_confirm" type="password" className="form-control" value={formData.password_confirm} onChange={handleChange} required />
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient w-100">Register</button>
            </form>
            <p className="text-center mt-3">
              Already have an account? <Link to="/login">Log In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 11.3 `frontend/src/pages/AcceptInvitation.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { InvitationPublic } from '../types';

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setAuthFromResponse } = useAuth();

  const [invitation, setInvitation] = useState<InvitationPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    client
      .get(`/invite/${token}/`)
      .then((res) => {
        setInvitation(res.data);
        setLoading(false);
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'Invalid or expired invitation.';
        setError(detail);
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await client.post(`/invite/${token}/accept/`, {
        username,
        password,
        password_confirm: passwordConfirm,
      });
      setAuthFromResponse(res.data);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string | string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setFormError(messages);
      } else {
        setFormError('Registration failed.');
      }
    }
  };

  if (loading) {
    return <div className="text-center mt-5"><p>Loading invitation...</p></div>;
  }

  if (error) {
    return (
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 text-center">
          <h2>Invitation Error</h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6">
        <div className="card el-glow">
          <div className="el-auth-header">
            <h3>Complete Your Registration</h3>
            <p>Set up your account to get started</p>
          </div>
          <div className="card-body">
            {invitation && (
              <div className="alert alert-info">
                <p><strong>Name:</strong> {invitation.full_name}</p>
                <p><strong>Email:</strong> {invitation.email}</p>
                <p><strong>Role:</strong> {invitation.user_type}</p>
                {invitation.date_of_birth && <p><strong>Date of Birth:</strong> {invitation.date_of_birth}</p>}
                {invitation.phone_number && <p><strong>Phone:</strong> {invitation.phone_number}</p>}
              </div>
            )}
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                  id="username"
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password_confirm" className="form-label">Confirm Password</label>
                <input
                  id="password_confirm"
                  type="password"
                  className="form-control"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient w-100">Complete Registration</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 12: Frontend — Home Pages (Student & Teacher)

### 12.1 `frontend/src/pages/StudentHome.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, Enrollment, StatusUpdate, Assignment } from '../types';

export default function StudentHome() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [assignmentDeadlines, setAssignmentDeadlines] = useState<Assignment[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/enrollments/'),
      client.get('/courses/'),
      client.get('/status-updates/'),
      client.get('/assignments/'),
    ]).then(([enrollRes, courseRes, statusRes, assignRes]) => {
      setEnrollments(enrollRes.data);
      setCourses(courseRes.data);
      setStatusUpdates(statusRes.data);
      const allAssignments = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data.results || []);
      setAssignmentDeadlines(allAssignments.filter((a: Assignment) => a.deadline));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus.trim()) return;
    try {
      const res = await client.post('/status-updates/', { content: newStatus });
      setStatusUpdates([res.data, ...statusUpdates]);
      setNewStatus('');
    } catch { /* ignore */ }
  };

  const enrolledCourseIds = new Set(enrollments.map(e => e.course));
  const enrolledCourses = courses.filter(c => enrolledCourseIds.has(c.id));
  const availableCourses = courses.filter(c => !enrolledCourseIds.has(c.id));

  const courseDeadlines = enrolledCourses
    .filter(c => c.end_date)
    .map(c => ({ label: `${c.code} - ${c.title}`, deadline: c.end_date!, link: `/courses/${c.id}`, badge: 'Enrolled', badgeClass: 'bg-info' }));

  const assignDeadlines = assignmentDeadlines
    .filter(a => enrolledCourseIds.has(a.course))
    .map(a => ({ label: `${a.course_title} - ${a.title}`, deadline: a.deadline!, link: `/assignments/${a.id}`, badge: a.assignment_type === 'quiz' ? 'Quiz' : 'Flashcards', badgeClass: 'bg-warning text-dark' }));

  const deadlines = [...courseDeadlines, ...assignDeadlines]
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const handleEnroll = async (courseId: number) => {
    try {
      await client.post(`/courses/${courseId}/enroll/`);
      const enrollRes = await client.get('/enrollments/');
      setEnrollments(enrollRes.data);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="row mt-3">
      {/* Left column: Feeds & Deadlines */}
      <div className="col-lg-8">
        {/* Status update form */}
        <div className="card mb-3">
          <div className="card-body">
            <form onSubmit={handlePostStatus} className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="What's on your mind?"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Post</button>
            </form>
          </div>
        </div>

        {/* Feeds / Status */}
        <div className="card mb-3">
          <div className="card-header"><strong>Feeds</strong></div>
          <div className="card-body">
            {statusUpdates.length === 0 ? (
              <p className="text-muted mb-0">No status updates yet.</p>
            ) : (
              statusUpdates.map(s => (
                <div key={s.id} className="border-bottom py-2">
                  <strong>{s.username}</strong>
                  <p className="mb-1">{s.content}</p>
                  <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deadlines table */}
        <div className="card mb-3">
          <div className="card-header"><strong>Deadlines</strong></div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr><th>Course / Assignment</th><th>Type</th><th>Deadline</th></tr>
              </thead>
              <tbody>
                {deadlines.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-muted">No upcoming deadlines</td></tr>
                ) : (
                  deadlines.map((d, i) => (
                    <tr key={i}>
                      <td><Link to={d.link}>{d.label}</Link></td>
                      <td><span className={`badge ${d.badgeClass}`}>{d.badge}</span></td>
                      <td>{new Date(d.deadline).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Course list */}
        <h5 className="mb-3">My Courses</h5>
        <div className="row g-3 mb-4">
          {enrolledCourses.length === 0 ? (
            <p className="text-muted">Not enrolled in any courses yet.</p>
          ) : (
            enrolledCourses.map(c => (
              <div key={c.id} className="col-md-3">
                <div className="card h-100">
                  <div className="card-body">
                    <h6 className="card-title">{c.code}</h6>
                    <p className="card-text small text-truncate">{c.title}</p>
                    <small className="text-muted">{c.enrolled_count} enrolled</small>
                  </div>
                  <div className="card-footer bg-white border-0">
                    <Link to={`/courses/${c.id}`} className="btn btn-sm btn-outline-primary w-100">View</Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Available courses */}
        <h5 className="mb-3">Available Courses</h5>
        <div className="row g-3">
          {availableCourses.map(c => (
            <div key={c.id} className="col-md-3">
              <div className="card h-100 border-dashed">
                <div className="card-body">
                  <h6 className="card-title">{c.code}</h6>
                  <p className="card-text small text-truncate">{c.title}</p>
                  <small className="text-muted">by {c.teacher_name}</small>
                </div>
                <div className="card-footer bg-white border-0">
                  <button onClick={() => handleEnroll(c.id)} className="btn btn-sm btn-success w-100">Enroll</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: Profile summary */}
      <div className="col-lg-4">
        <div className="card el-card-accent mb-3">
          <div className="card-body text-center">
            {user?.photo ? (
              <img src={user.photo} alt={user.username} className="rounded-circle object-fit-cover mb-2" style={{ width: 60, height: 60 }} />
            ) : (
              <div className="el-avatar-gradient rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 60, height: 60 }}>
                <span className="text-white fs-4">{user?.username?.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <h6>{user?.username}</h6>
            <p className="text-muted small">{user?.full_name}</p>
            <Link to={`/profile/${user?.username}`} className="btn btn-sm btn-outline-primary">View Profile</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 12.2 `frontend/src/pages/TeacherHome.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, User, StatusUpdate } from '../types';

export default function TeacherHome() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/courses/'),
      client.get('/status-updates/'),
    ]).then(([courseRes, statusRes]) => {
      setCourses(courseRes.data.filter((c: Course) => c.teacher === user?.id));
      setStatusUpdates(statusRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  // Live debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (includeBlocked) params.set('include_blocked', 'true');
        const res = await client.get(`/users/search/?${params}`);
        setSearchResults(res.data);
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, includeBlocked]);

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus.trim()) return;
    try {
      const res = await client.post('/status-updates/', { content: newStatus });
      setStatusUpdates([res.data, ...statusUpdates]);
      setNewStatus('');
    } catch { /* ignore */ }
  };

  const handleBlock = async (userId: number) => {
    try {
      await client.post(`/users/${userId}/block/`);
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: true } : u));
    } catch { /* ignore */ }
  };

  const handleUnblock = async (userId: number) => {
    try {
      await client.post(`/users/${userId}/unblock/`);
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: false } : u));
    } catch { /* ignore */ }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to delete "${username}"? This cannot be undone.`)) return;
    try {
      await client.delete(`/users/${userId}/delete_user/`);
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="row mt-3">
      {/* Left column: Courses & Students */}
      <div className="col-lg-8">
        {/* Course list */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">My Courses</h5>
          <Link to="/courses/create" className="btn btn-primary btn-sm el-btn-gradient">+ New Course</Link>
        </div>
        <div className="row g-3 mb-4">
          {courses.map(c => (
            <div key={c.id} className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <h6 className="card-title">{c.code}</h6>
                  <p className="card-text small">{c.title}</p>
                  <small className="text-muted">{c.enrolled_count} students</small>
                </div>
                <div className="card-footer bg-white border-0">
                  <Link to={`/courses/${c.id}`} className="btn btn-sm btn-outline-primary w-100">Manage</Link>
                </div>
              </div>
            </div>
          ))}
          <div className="col-md-4">
            <Link to="/courses/create" className="card h-100 text-decoration-none text-center border-dashed">
              <div className="card-body d-flex align-items-center justify-content-center">
                <span className="display-4 text-muted">+</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Search students/teachers */}
        <h5 className="mb-3">Students / Teachers</h5>
        <div className="card mb-4">
          <div className="card-body">
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="includeBlocked"
                checked={includeBlocked}
                onChange={e => setIncludeBlocked(e.target.checked)}
              />
              <label className="form-check-label small text-muted" htmlFor="includeBlocked">
                Include blocked users
              </label>
            </div>
            {searching && (
              <div className="text-center py-2">
                <div className="spinner-border spinner-border-sm me-2"></div>
                <span className="text-muted">Searching...</span>
              </div>
            )}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-muted mb-0">No results found.</p>
            )}
            {searchResults.length > 0 && (
              <div className="list-group">
                {searchResults.map(u => (
                  <div key={u.id} className="list-group-item">
                    <div className="d-flex align-items-start">
                      {u.photo ? (
                        <img src={u.photo} alt={u.username} className="rounded-circle object-fit-cover me-3 flex-shrink-0" style={{ width: 44, height: 44 }} />
                      ) : (
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0 el-avatar-gradient"
                          style={{ width: 44, height: 44 }}
                        >
                          <span className="text-white fw-bold">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <Link to={`/profile/${u.username}`} className="fw-bold">{u.username}</Link>
                            <span className={`ms-2 badge ${u.user_type === 'teacher' ? 'bg-primary' : 'bg-info'}`}>{u.user_type}</span>
                            {u.is_blocked && <span className="ms-1 badge bg-danger">Blocked</span>}
                          </div>
                          <div className="d-flex gap-1">
                            {u.is_blocked ? (
                              <button className="btn btn-sm btn-success" onClick={() => handleUnblock(u.id)}>Unblock</button>
                            ) : (
                              <button className="btn btn-sm btn-warning" onClick={() => handleBlock(u.id)}>Block</button>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id, u.username)}>Delete</button>
                          </div>
                        </div>
                        {u.full_name && <div className="small">{u.full_name}</div>}
                        {u.email && <div className="small text-muted">{u.email}</div>}
                        {u.bio && <div className="small text-muted mt-1">{u.bio.length > 80 ? u.bio.slice(0, 80) + '...' : u.bio}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column: Feeds & Profile */}
      <div className="col-lg-4">
        <div className="card el-card-accent mb-3">
          <div className="card-body text-center">
            {user?.photo ? (
              <img src={user.photo} alt={user.username} className="rounded-circle object-fit-cover mb-2" style={{ width: 60, height: 60 }} />
            ) : (
              <div className="el-avatar-gradient rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 60, height: 60 }}>
                <span className="text-white fs-4">{user?.username?.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <h6>{user?.username}</h6>
            <p className="text-muted small">{user?.full_name}</p>
            <Link to={`/profile/${user?.username}`} className="btn btn-sm btn-outline-primary">Profile</Link>
          </div>
        </div>

        {/* Feeds */}
        <div className="card el-card-accent mb-3">
          <div className="card-header"><strong>Feeds</strong></div>
          <div className="card-body">
            <form onSubmit={handlePostStatus} className="mb-3">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Post an update..."
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary">Post</button>
              </div>
            </form>
            {statusUpdates.map(s => (
              <div key={s.id} className="border-bottom py-2">
                <strong className="small">{s.username}</strong>
                <p className="mb-1 small">{s.content}</p>
                <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 13: Frontend — Profile & Course Pages

### 13.1 `frontend/src/pages/Profile.tsx`
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User, Enrollment, Course, Assignment } from '../types';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, refreshUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignmentDeadlines, setAssignmentDeadlines] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', bio: '', phone_number: '', date_of_birth: '' });
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const usersRes = await client.get('/users/');
        const found = usersRes.data.find((u: User) => u.username === username);
        if (found) {
          const detailRes = await client.get(`/users/${found.id}/`);
          setProfileUser(detailRes.data);
          setEditData({
            full_name: detailRes.data.full_name || '',
            bio: detailRes.data.bio || '',
            phone_number: detailRes.data.phone_number || '',
            date_of_birth: detailRes.data.date_of_birth || '',
          });
        }
        // Always fetch courses so taught/registered courses show on any profile
        const courseRes = await client.get('/courses/');
        setCourses(courseRes.data);

        if (isOwnProfile) {
          const [enrollRes, assignRes] = await Promise.all([
            client.get('/enrollments/'),
            client.get('/assignments/'),
          ]);
          setEnrollments(enrollRes.data);
          const allAssignments = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data.results || []);
          setAssignmentDeadlines(allAssignments.filter((a: Assignment) => a.deadline));
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchProfile();
  }, [username, isOwnProfile]);

  const handleSave = async () => {
    try {
      await client.patch('/users/update_profile/', editData);
      setProfileUser(prev => prev ? { ...prev, ...editData } : prev);
      setEditing(false);
    } catch { /* ignore */ }
  };

  const handleSaveApiKey = async () => {
    try {
      await client.patch('/users/update_profile/', { ai_api_key: apiKey });
      setProfileUser(prev => prev ? { ...prev, has_ai_key: !!apiKey } : prev);
      setApiKeySaved(true);
      setApiKey('');
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch { /* ignore */ }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await client.patch('/users/update_profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfileUser(prev => prev ? { ...prev, photo: res.data.photo } : prev);
      await refreshUser();
    } catch { /* ignore */ }
    setUploading(false);
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!profileUser) return <div className="text-center mt-5"><h4>User not found</h4></div>;

  const enrolledCourseIds = new Set(enrollments.map(e => e.course));
  const myCourses = profileUser.user_type === 'teacher'
    ? courses.filter(c => c.teacher === profileUser.id)
    : courses.filter(c => enrolledCourseIds.has(c.id));

  const courseDeadlineItems = myCourses
    .filter(c => c.end_date)
    .map(c => ({ label: `${c.code} - ${c.title}`, deadline: c.end_date!, link: `/courses/${c.id}` }));

  const assignDeadlineItems = assignmentDeadlines
    .filter(a => enrolledCourseIds.has(a.course))
    .map(a => ({ label: `${a.course_title} - ${a.title}`, deadline: a.deadline!, link: `/assignments/${a.id}` }));

  const deadlines = [...courseDeadlineItems, ...assignDeadlineItems]
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="row mt-3">
      {/* Profile info */}
      <div className="col-lg-4">
        <div className="card el-card-accent mb-3">
          <div className="card-body text-center">
            <div
              className="position-relative d-inline-block mb-3"
              style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
              onClick={() => isOwnProfile && fileInputRef.current?.click()}
            >
              {profileUser.photo ? (
                <img
                  src={profileUser.photo}
                  alt={profileUser.username}
                  className="rounded-circle object-fit-cover"
                  style={{ width: 80, height: 80 }}
                />
              ) : (
                <div className="el-avatar-gradient rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 80, height: 80 }}>
                  <span className="text-white display-6">{profileUser.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {isOwnProfile && (
                <div
                  className="position-absolute bottom-0 end-0 bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm border"
                  style={{ width: 28, height: 28 }}
                >
                  {uploading ? (
                    <div className="spinner-border spinner-border-sm text-primary" style={{ width: 14, height: 14 }}></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                      <path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/>
                    </svg>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="d-none"
                onChange={handlePhotoUpload}
              />
            </div>
            <h5>{profileUser.username}</h5>
            <span className="badge bg-info mb-2">{profileUser.user_type}</span>

            {!editing ? (
              <>
                <p className="text-muted">{profileUser.full_name || 'No name set'}</p>
                <p className="small">{profileUser.bio || 'No bio'}</p>
                {profileUser.email && <p className="small text-muted">{profileUser.email}</p>}
                {profileUser.phone_number && <p className="small text-muted">{profileUser.phone_number}</p>}
                {profileUser.date_of_birth && <p className="small text-muted">Born: {profileUser.date_of_birth}</p>}
                {isOwnProfile && (
                  <button className="btn btn-sm btn-outline-primary" onClick={() => setEditing(true)}>Edit Profile</button>
                )}
              </>
            ) : (
              <div className="text-start">
                <div className="mb-2">
                  <label className="form-label small">Full Name</label>
                  <input className="form-control form-control-sm" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Bio</label>
                  <textarea className="form-control form-control-sm" rows={3} value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Phone</label>
                  <input className="form-control form-control-sm" value={editData.phone_number} onChange={e => setEditData({ ...editData, phone_number: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Date of Birth</label>
                  <input type="date" className="form-control form-control-sm" value={editData.date_of_birth} onChange={e => setEditData({ ...editData, date_of_birth: e.target.value })} />
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI API Key settings (teachers only, own profile) */}
        {isOwnProfile && profileUser.user_type === 'teacher' && (
          <div className="card mb-3">
            <div className="card-header"><strong>AI API Key (OpenAI)</strong></div>
            <div className="card-body">
              <p className="small text-muted mb-2">
                Set your OpenAI API key to generate quizzes and flashcards from PDF materials using AI.
              </p>
              {profileUser.has_ai_key && (
                <div className="alert alert-success py-1 small mb-2">API key is configured.</div>
              )}
              {apiKeySaved && (
                <div className="alert alert-info py-1 small mb-2">API key saved!</div>
              )}
              <div className="input-group input-group-sm">
                <input
                  type="password"
                  className="form-control"
                  placeholder={profileUser.has_ai_key ? 'Enter new key to update...' : 'sk-...'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleSaveApiKey} disabled={!apiKey}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Status, Courses, Deadlines */}
      <div className="col-lg-8">
        {/* Status updates */}
        {profileUser.status_updates && profileUser.status_updates.length > 0 && (
          <div className="card mb-3">
            <div className="card-header"><strong>Status</strong></div>
            <div className="card-body">
              {profileUser.status_updates.map((s) => (
                <div key={s.id} className="border-bottom py-2">
                  <p className="mb-1">{s.content}</p>
                  <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered/Taught courses */}
        <div className="card mb-3">
          <div className="card-header">
            <strong>{profileUser.user_type === 'teacher' ? 'Taught Courses' : 'Registered Courses'}</strong>
          </div>
          <div className="card-body">
            {myCourses.length === 0 ? (
              <p className="text-muted mb-0">No courses yet.</p>
            ) : (
              <div className="row g-2">
                {myCourses.map(c => (
                  <div key={c.id} className="col-md-4">
                    <Link to={`/courses/${c.id}`} className="card text-decoration-none h-100">
                      <div className="card-body p-2">
                        <h6 className="mb-1">{c.code}</h6>
                        <small className="text-muted">{c.title}</small>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        {deadlines.length > 0 && (
          <div className="card mb-3">
            <div className="card-header"><strong>Upcoming Deadlines</strong></div>
            <div className="card-body p-0">
              <table className="table mb-0">
                <tbody>
                  {deadlines.map((d, i) => (
                    <tr key={i}>
                      <td><Link to={d.link}>{d.label}</Link></td>
                      <td className="text-end text-muted">{new Date(d.deadline).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 13.2 `frontend/src/pages/CourseCreate.tsx`
```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { User } from '../types';

export default function CourseCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '', description: '', code: '', start_date: '', end_date: '',
  });
  const [error, setError] = useState('');

  // Post-creation: add students
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<User[]>([]);
  const [addedStudents, setAddedStudents] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };
      const res = await client.post('/courses/', payload);
      setCreatedCourseId(res.data.id);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) setError(Object.values(data).flat().join(' '));
      else setError('Failed to create course.');
    }
  };

  const handleSearchStudents = async (query: string) => {
    setAddQuery(query);
    if (query.trim().length < 2) { setAddResults([]); return; }
    try {
      const res = await client.get(`/users/search/?q=${encodeURIComponent(query)}&user_type=student`);
      setAddResults(res.data);
    } catch { setAddResults([]); }
  };

  const handleAddStudent = async (student: User) => {
    if (!createdCourseId) return;
    try {
      await client.post(`/courses/${createdCourseId}/add_student/`, { student_id: student.id });
      setAddedStudents(prev => [...prev, student.username]);
      setAddResults(addResults.filter(u => u.id !== student.id));
    } catch { /* ignore */ }
  };

  // Step 2: Add students after course creation
  if (createdCourseId) {
    return (
      <div className="row justify-content-center mt-4">
        <div className="col-md-8">
          <div className="card shadow">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="badge bg-success me-2">Created</span>
                <h4 className="mb-0">{formData.code} - {formData.title}</h4>
              </div>
              <p className="text-muted">Add students to your course, or skip this step and add them later.</p>

              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search students by name or email..."
                  value={addQuery}
                  onChange={e => handleSearchStudents(e.target.value)}
                />
              </div>

              {addResults.length > 0 && (
                <div className="list-group mb-3" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {addResults.filter(u => !addedStudents.includes(u.username)).map(u => (
                    <div key={u.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div>
                        <span className="fw-bold">{u.username}</span>
                        {u.full_name && <span className="text-muted ms-1">({u.full_name})</span>}
                      </div>
                      <button className="btn btn-sm btn-success" onClick={() => handleAddStudent(u)}>Add</button>
                    </div>
                  ))}
                </div>
              )}

              {addQuery.length >= 2 && addResults.filter(u => !addedStudents.includes(u.username)).length === 0 && (
                <p className="text-muted small">No students found.</p>
              )}

              {addedStudents.length > 0 && (
                <div className="mb-3">
                  <strong className="small">Added Students:</strong>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {addedStudents.map(name => (
                      <span key={name} className="badge bg-primary">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="d-flex gap-2">
                <button className="btn btn-primary el-btn-gradient" onClick={() => navigate(`/courses/${createdCourseId}`)}>
                  Go to Course
                </button>
                <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Create course form
  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h3 className="card-title mb-4">Create New Course</h3>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Course Code</label>
                <input name="code" className="form-control" value={formData.code} onChange={handleChange} required placeholder="e.g. CS101" />
              </div>
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input name="title" className="form-control" value={formData.title} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows={4} value={formData.description} onChange={handleChange} required />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Start Date</label>
                  <input type="date" name="start_date" className="form-control" value={formData.start_date} onChange={handleChange} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">End Date</label>
                  <input type="date" name="end_date" className="form-control" value={formData.end_date} onChange={handleChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient">Create Course</button>
              <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/')}>Cancel</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 13.3 `frontend/src/pages/CourseDetail.tsx`
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, CourseMaterial, Enrollment, Feedback, Assignment, User } from '../types';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload material form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadType, setUploadType] = useState('document');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genType, setGenType] = useState<'quiz' | 'flashcard'>('quiz');
  const [genTitle, setGenTitle] = useState('');
  const [genFile, setGenFile] = useState<File | null>(null);
  const [genDeadline, setGenDeadline] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Feedback form
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState('');

  // Add student
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentQuery, setAddStudentQuery] = useState('');
  const [addStudentResults, setAddStudentResults] = useState<User[]>([]);

  const isTeacher = user?.user_type === 'teacher';
  const isOwner = course?.teacher === user?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, matRes, studRes] = await Promise.all([
          client.get(`/courses/${id}/`),
          client.get(`/courses/${id}/materials/`),
          client.get(`/courses/${id}/students/`),
        ]);
        setCourse(courseRes.data);
        setMaterials(matRes.data);
        setStudents(studRes.data);

        const [fbRes, assignRes] = await Promise.all([
          client.get(`/feedback/?course=${id}`),
          client.get(`/assignments/?course=${id}`),
        ]);
        setFeedbacks(Array.isArray(fbRes.data) ? fbRes.data : (fbRes.data.results || []));
        setAssignments(Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data.results || []));
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('course', id!);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDesc);
    formData.append('material_type', uploadType);
    formData.append('file', uploadFile);
    try {
      await client.post('/materials/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const matRes = await client.get(`/courses/${id}/materials/`);
      setMaterials(matRes.data);
      setShowUpload(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadFile(null);
    } catch { /* ignore */ }
  };

  const handleBlock = async (studentId: number) => {
    try {
      await client.post(`/courses/${id}/block/${studentId}/`);
      setStudents(students.filter(s => s.student !== studentId));
    } catch { /* ignore */ }
  };

  const handleSearchStudents = async (query: string) => {
    setAddStudentQuery(query);
    if (query.trim().length < 2) { setAddStudentResults([]); return; }
    try {
      const res = await client.get(`/users/search/?q=${encodeURIComponent(query)}&user_type=student`);
      const enrolledIds = new Set(students.map(s => s.student));
      setAddStudentResults(res.data.filter((u: User) => !enrolledIds.has(u.id)));
    } catch { setAddStudentResults([]); }
  };

  const handleAddStudent = async (studentId: number) => {
    try {
      await client.post(`/courses/${id}/add_student/`, { student_id: studentId });
      const studRes = await client.get(`/courses/${id}/students/`);
      setStudents(studRes.data);
      setAddStudentResults(addStudentResults.filter(u => u.id !== studentId));
    } catch { /* ignore */ }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await client.post('/feedback/', { course: Number(id), rating: fbRating, comment: fbComment });
      setFeedbacks([...feedbacks, res.data]);
      setShowFeedback(false);
      setFbRating(5);
      setFbComment('');
    } catch { /* ignore */ }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genFile) return;
    setGenerating(true);
    setGenError('');
    const formData = new FormData();
    formData.append('course', id!);
    formData.append('assignment_type', genType);
    formData.append('file', genFile);
    if (genTitle) formData.append('title', genTitle);
    if (genDeadline) formData.append('deadline', new Date(genDeadline).toISOString());
    try {
      await client.post('/assignments/generate/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const res = await client.get(`/assignments/?course=${id}`);
      setAssignments(Array.isArray(res.data) ? res.data : (res.data.results || []));
      setShowGenerate(false);
      setGenTitle('');
      setGenDeadline('');
      setGenFile(null);
    } catch (err: any) {
      setGenError(err.response?.data?.error || 'Failed to generate assignment');
    }
    setGenerating(false);
  };

  const filteredStudents = students.filter(s =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!course) return <div className="text-center mt-5"><h4>Course not found</h4></div>;

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8080';

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h3>{course.code} - {course.title}</h3>
          <p className="text-muted">by {course.teacher_name}</p>
          <p>{course.description}</p>
          {course.average_rating && (
            <span className="badge bg-warning text-dark">Rating: {course.average_rating.toFixed(1)} / 5</span>
          )}
        </div>
      </div>

      <div className="row">
        {/* Materials */}
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Course Materials</strong>
              {isOwner && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowUpload(!showUpload)}>+ Upload</button>
              )}
            </div>
            <div className="card-body">
              {showUpload && (
                <form onSubmit={handleUpload} className="border rounded p-3 mb-3 bg-light">
                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Title" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Description" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} />
                  </div>
                  <div className="mb-2">
                    <select className="form-select form-select-sm" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                      <option value="document">Document</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <div
                      className={`p-3 text-center ${uploadDragOver ? 'el-drop-zone dragging' : 'el-drop-zone'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => uploadFileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                      onDragEnter={e => { e.preventDefault(); setUploadDragOver(true); }}
                      onDragLeave={() => setUploadDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setUploadDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file) setUploadFile(file);
                      }}
                      data-testid="material-drop-zone"
                    >
                      <input
                        type="file"
                        ref={uploadFileRef}
                        className="d-none"
                        onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      />
                      {uploadFile ? (
                        <div>
                          <span className="small fw-bold">{uploadFile.name}</span>
                          <span className="small text-muted ms-2">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" className="btn btn-sm btn-link text-danger ms-2" onClick={e => { e.stopPropagation(); setUploadFile(null); }}>Remove</button>
                        </div>
                      ) : (
                        <div className="text-muted small">
                          <div className="mb-1">Drag & drop a file here, or click to browse</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-sm btn-success" disabled={!uploadFile}>Upload</button>
                </form>
              )}
              {materials.length === 0 ? (
                <p className="text-muted mb-0">No materials uploaded yet.</p>
              ) : (
                <div className="list-group">
                  {materials.map(m => (
                    <a key={m.id} href={`${API_BASE}${m.file}`} target="_blank" rel="noopener noreferrer" className="list-group-item list-group-item-action">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{m.title}</strong>
                          <span className="ms-2 badge bg-secondary">{m.material_type}</span>
                          {m.description && <p className="mb-0 small text-muted">{m.description}</p>}
                        </div>
                        <small className="text-muted">{new Date(m.uploaded_at).toLocaleDateString()}</small>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignments section */}
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Assignments</strong>
              {isOwner && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowGenerate(!showGenerate)}>+ Generate with AI</button>
              )}
            </div>
            <div className="card-body">
              {showGenerate && (
                <form onSubmit={handleGenerate} className="border rounded p-3 mb-3 bg-light">
                  {genError && <div className="alert alert-danger py-1 small">{genError}</div>}
                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Title (optional)" value={genTitle} onChange={e => setGenTitle(e.target.value)} />
                  </div>
                  <div className="mb-2">
                    <select className="form-select form-select-sm" value={genType} onChange={e => setGenType(e.target.value as 'quiz' | 'flashcard')}>
                      <option value="quiz">Quiz (Multiple Choice)</option>
                      <option value="flashcard">Flashcards</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <input type="file" className="form-control form-control-sm" accept=".pdf" onChange={e => setGenFile(e.target.files?.[0] || null)} />
                    <div className="form-text">Upload a PDF to generate questions from</div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-0">Deadline (optional)</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={genDeadline} onChange={e => setGenDeadline(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-sm btn-success" disabled={!genFile || generating}>
                    {generating ? <><span className="spinner-border spinner-border-sm me-1"></span>Generating...</> : 'Generate'}
                  </button>
                </form>
              )}
              {assignments.length === 0 ? (
                <p className="text-muted mb-0">No assignments yet.</p>
              ) : (
                <div className="list-group">
                  {assignments.map(a => (
                    <Link key={a.id} to={`/assignments/${a.id}`} className="list-group-item list-group-item-action">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{a.title}</strong>
                          <span className={`ms-2 badge ${a.assignment_type === 'quiz' ? 'bg-primary' : 'bg-info'}`}>
                            {a.assignment_type === 'quiz' ? 'Quiz' : 'Flashcards'}
                          </span>
                          {a.deadline && (
                            <small className="ms-2 text-muted">Due: {new Date(a.deadline).toLocaleDateString()}</small>
                          )}
                        </div>
                        <small className="text-muted">{new Date(a.created_at).toLocaleDateString()}</small>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Feedback section */}
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between">
              <strong>Feedback</strong>
              {user?.user_type === 'student' && (
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFeedback(!showFeedback)}>Leave Feedback</button>
              )}
            </div>
            <div className="card-body">
              {showFeedback && user?.user_type === 'student' && (
                <form onSubmit={handleFeedback} className="border rounded p-3 mb-3 bg-light">
                  <div className="mb-2">
                    <label className="form-label small">Rating (1-5)</label>
                    <select className="form-select form-select-sm" value={fbRating} onChange={e => setFbRating(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <textarea className="form-control form-control-sm" placeholder="Your comment..." rows={2} value={fbComment} onChange={e => setFbComment(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-sm btn-success">Submit</button>
                </form>
              )}
              {feedbacks.length === 0 ? (
                <p className="text-muted mb-0">No feedback yet.</p>
              ) : (
                feedbacks.map(f => (
                  <div key={f.id} className="border-bottom py-2">
                    <strong>{f.student_name}</strong>
                    {f.rating && <span className="ms-2 badge bg-warning text-dark">{f.rating}/5</span>}
                    <p className="mb-0 small">{f.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Students panel */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Students ({students.length})</strong>
              {isOwner && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowAddStudent(!showAddStudent)}>+ Add Student</button>
              )}
            </div>
            <div className="card-body">
              {showAddStudent && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    placeholder="Search students by name or email..."
                    value={addStudentQuery}
                    onChange={e => handleSearchStudents(e.target.value)}
                  />
                  {addStudentResults.length > 0 && (
                    <div className="list-group list-group-flush" style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {addStudentResults.map(u => (
                        <div key={u.id} className="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
                          <div>
                            <span className="fw-bold small">{u.username}</span>
                            {u.full_name && <span className="text-muted small ms-1">({u.full_name})</span>}
                          </div>
                          <button className="btn btn-sm btn-success py-0 px-2" onClick={() => handleAddStudent(u.id)}>Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {addStudentQuery.length >= 2 && addStudentResults.length === 0 && (
                    <p className="text-muted small mb-0">No students found.</p>
                  )}
                </div>
              )}
              <input
                type="text"
                className="form-control form-control-sm mb-3"
                placeholder="Search enrolled students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {filteredStudents.length === 0 ? (
                <p className="text-muted mb-0">No students enrolled.</p>
              ) : (
                <div className="list-group">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="list-group-item">
                      <div className="d-flex align-items-center">
                        <div
                          className="rounded-circle el-avatar-gradient d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                          style={{ width: 36, height: 36 }}
                        >
                          <span className="text-white fw-bold small">{s.student_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-grow-1">
                          <Link to={`/profile/${s.student_name}`} className="fw-bold">{s.student_name}</Link>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Enrolled {new Date(s.enrolled_at).toLocaleDateString()}</div>
                        </div>
                        {isOwner && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleBlock(s.student)}>Block</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 14: Frontend — Assignment & Classroom Pages

### 14.1 `frontend/src/pages/AssignmentView.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Assignment, AssignmentSubmission, QuizQuestion, Flashcard } from '../types';

export default function AssignmentView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<AssignmentSubmission[]>([]);

  // Editing state
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const [editCards, setEditCards] = useState<Flashcard[]>([]);
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const isTeacher = user?.user_type === 'teacher';
  const isOwner = isTeacher && assignment?.created_by === user?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await client.get(`/assignments/${id}/`);
        setAssignment(res.data);
        if (res.data.assignment_type === 'quiz') {
          setAnswers(new Array(res.data.content.questions?.length || 0).fill(-1));
        }
        const subRes = await client.get(`/assignment-submissions/?assignment=${id}`);
        const subs = Array.isArray(subRes.data) ? subRes.data : (subRes.data.results || []);
        if (user?.user_type === 'student') {
          if (subs.length > 0) {
            setSubmission(subs[0]);
            setAnswers(subs[0].answers);
            setSubmitted(true);
          }
        } else if (user?.user_type === 'teacher') {
          setAllSubmissions(subs);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  const handleSubmitQuiz = async () => {
    try {
      const res = await client.post('/assignment-submissions/', {
        assignment: Number(id),
        answers,
      });
      setSubmission(res.data);
      setSubmitted(true);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this assignment? This cannot be undone.')) return;
    try {
      await client.delete(`/assignments/${id}/`);
      navigate(-1);
    } catch { /* ignore */ }
  };

  const startEdit = () => {
    if (!assignment) return;
    setEditTitle(assignment.title);
    setEditQuestions(JSON.parse(JSON.stringify(assignment.content.questions || [])));
    setEditCards(JSON.parse(JSON.stringify(assignment.content.cards || [])));
    setEditDeadline(assignment.deadline ? new Date(assignment.deadline).toISOString().slice(0, 16) : '');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!assignment) return;
    setSaving(true);
    const content = assignment.assignment_type === 'quiz'
      ? { questions: editQuestions }
      : { cards: editCards };
    try {
      const res = await client.patch(`/assignments/${id}/`, {
        title: editTitle,
        content,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      setAssignment(res.data);
      setEditMode(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Quiz editing helpers
  const updateQuestion = (qi: number, field: string, value: string) => {
    const updated = [...editQuestions];
    (updated[qi] as any)[field] = value;
    setEditQuestions(updated);
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const updated = [...editQuestions];
    updated[qi].options[oi] = value;
    setEditQuestions(updated);
  };

  const setCorrectAnswer = (qi: number, oi: number) => {
    const updated = [...editQuestions];
    updated[qi].correct = oi;
    setEditQuestions(updated);
  };

  const removeQuestion = (qi: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== qi));
  };

  const addQuestion = () => {
    setEditQuestions([...editQuestions, { question: '', options: ['', '', '', ''], correct: 0 }]);
  };

  // Flashcard editing helpers
  const updateCard = (ci: number, field: 'front' | 'back', value: string) => {
    const updated = [...editCards];
    updated[ci][field] = value;
    setEditCards(updated);
  };

  const removeCard = (ci: number) => {
    setEditCards(editCards.filter((_, i) => i !== ci));
  };

  const addCard = () => {
    setEditCards([...editCards, { front: '', back: '' }]);
  };

  const toggleCard = (index: number) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!assignment) return <div className="text-center mt-5"><h4>Assignment not found</h4></div>;

  const questions = assignment.content.questions || [];
  const cards = assignment.content.cards || [];
  const revealAnswers = submitted || (isTeacher && showAnswerKey);

  return (
    <div className="mt-3" style={{ maxWidth: 800, margin: '0 auto' }}>
      <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => navigate(-1)}>&larr; Back</button>

      {/* Title */}
      {editMode ? (
        <>
          <input className="form-control form-control-lg mb-2" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          <div className="mb-2">
            <label className="form-label small mb-0">Deadline (optional)</label>
            <input type="datetime-local" className="form-control" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="d-flex align-items-center gap-2 mb-1">
          <h4 className="mb-0">{assignment.title}</h4>
          {isOwner && (
            <>
              <button className="btn btn-sm btn-outline-secondary" onClick={startEdit}>Edit</button>
              <button className="btn btn-sm btn-outline-danger" onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>
      )}
      <p className="text-muted">
        {assignment.assignment_type === 'quiz' ? 'Quiz' : 'Flashcards'} &middot; {assignment.course_title}
      </p>
      {!editMode && assignment.deadline && (
        <p className="text-warning mb-3">
          <strong>Deadline:</strong> {new Date(assignment.deadline).toLocaleString()}
        </p>
      )}

      {/* ===== EDIT MODE: Quiz ===== */}
      {editMode && assignment.assignment_type === 'quiz' && (
        <div>
          {editQuestions.map((q, qi) => (
            <div key={qi} className="card mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>Q{qi + 1}</strong>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeQuestion(qi)}>Remove</button>
                </div>
                <input
                  className="form-control mb-2"
                  placeholder="Question text"
                  value={q.question}
                  onChange={e => updateQuestion(qi, 'question', e.target.value)}
                />
                {q.options.map((opt, oi) => (
                  <div key={oi} className="input-group mb-1">
                    <div className="input-group-text">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct === oi}
                        onChange={() => setCorrectAnswer(qi, oi)}
                        title="Mark as correct answer"
                      />
                    </div>
                    <span className="input-group-text">{String.fromCharCode(65 + oi)}</span>
                    <input
                      className="form-control"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                    />
                  </div>
                ))}
                <small className="text-muted">Select the radio button next to the correct answer</small>
              </div>
            </div>
          ))}
          <button className="btn btn-outline-primary mb-3" onClick={addQuestion}>+ Add Question</button>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-success" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== EDIT MODE: Flashcards ===== */}
      {editMode && assignment.assignment_type === 'flashcard' && (
        <div>
          {editCards.map((card, ci) => (
            <div key={ci} className="card mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>Card {ci + 1}</strong>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeCard(ci)}>Remove</button>
                </div>
                <div className="mb-2">
                  <label className="form-label small text-muted mb-0">Front (Question/Term)</label>
                  <input className="form-control" value={card.front} onChange={e => updateCard(ci, 'front', e.target.value)} />
                </div>
                <div>
                  <label className="form-label small text-muted mb-0">Back (Answer/Definition)</label>
                  <input className="form-control" value={card.back} onChange={e => updateCard(ci, 'back', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-outline-primary mb-3" onClick={addCard}>+ Add Card</button>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-success" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== VIEW MODE: Quiz ===== */}
      {!editMode && assignment.assignment_type === 'quiz' && (
        <div>
          {isTeacher && (
            <div className="d-flex align-items-center gap-2 mb-3">
              <button
                className={`btn btn-sm ${showAnswerKey ? 'btn-warning' : 'btn-outline-warning'}`}
                onClick={() => setShowAnswerKey(!showAnswerKey)}
              >
                {showAnswerKey ? 'Hide Answer Key' : 'Show Answer Key'}
              </button>
              <span className="text-muted small">Submissions: {assignment.submission_count}</span>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} className="card mb-3">
              <div className="card-body">
                <h6>Q{qi + 1}: {q.question}</h6>
                {q.options.map((opt, oi) => {
                  let btnClass = 'btn btn-outline-secondary w-100 text-start mb-1';
                  if (revealAnswers) {
                    if (oi === q.correct) btnClass = 'btn btn-success w-100 text-start mb-1';
                    else if (submitted && oi === answers[qi] && oi !== q.correct) btnClass = 'btn btn-danger w-100 text-start mb-1';
                  } else if (answers[qi] === oi) {
                    btnClass = 'btn btn-primary w-100 text-start mb-1';
                  }
                  return (
                    <button
                      key={oi}
                      className={btnClass}
                      onClick={() => {
                        if (!submitted && !isTeacher) {
                          const newAnswers = [...answers];
                          newAnswers[qi] = oi;
                          setAnswers(newAnswers);
                        }
                      }}
                      disabled={submitted || isTeacher}
                    >
                      {String.fromCharCode(65 + oi)}. {opt.replace(/^[A-Da-d][.):\s]+/, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!isTeacher && !submitted && (
            <button
              className="btn btn-primary el-btn-gradient btn-lg w-100"
              onClick={handleSubmitQuiz}
              disabled={answers.includes(-1)}
            >
              {answers.includes(-1)
                ? `Answer all questions to submit (${answers.filter(a => a !== -1).length}/${questions.length})`
                : 'Submit Quiz'}
            </button>
          )}

          {submitted && submission && (
            <div className="alert alert-info mt-3">
              Your score: <strong>{submission.score}%</strong> ({Math.round((submission.score || 0) * questions.length / 100)}/{questions.length} correct)
            </div>
          )}

          {isTeacher && (
            <div className="card mt-3">
              <div className="card-header"><strong>Student Scores</strong></div>
              <div className="card-body p-0">
                {allSubmissions.length === 0 ? (
                  <p className="text-muted p-3 mb-0">No students have submitted yet.</p>
                ) : (
                  <table className="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Score</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubmissions.map(sub => (
                        <tr key={sub.id}>
                          <td>{sub.student_name}</td>
                          <td>
                            <span className={`badge ${(sub.score || 0) >= 70 ? 'bg-success' : (sub.score || 0) >= 50 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                              {sub.score}%
                            </span>
                          </td>
                          <td className="text-muted small">{new Date(sub.submitted_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW MODE: Flashcards ===== */}
      {!editMode && assignment.assignment_type === 'flashcard' && (
        <>
          <style>{`
            .flip-card { perspective: 800px; cursor: pointer; min-height: 180px; }
            .flip-card-inner {
              position: relative; width: 100%; height: 100%; min-height: 180px;
              transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
              transform-style: preserve-3d;
            }
            .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
            .flip-card-front, .flip-card-back {
              position: absolute; inset: 0; backface-visibility: hidden;
              border-radius: 0.375rem; display: flex; flex-direction: column;
              align-items: center; justify-content: center; padding: 1.5rem;
              text-align: center;
            }
            .flip-card-front { background: #fff; border: 1px solid #dee2e6; }
            .flip-card-back {
              background: var(--el-gradient);
              color: #fff; transform: rotateY(180deg); border: none;
            }
            .flip-card:hover .flip-card-inner { box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
          `}</style>
          <div className="row g-3">
            {cards.map((card, ci) => (
              <div key={ci} className="col-md-6">
                <div
                  className={`flip-card${flippedCards.has(ci) ? ' flipped' : ''}`}
                  onClick={() => toggleCard(ci)}
                >
                  <div className="flip-card-inner">
                    <div className="flip-card-front">
                      <small className="text-muted mb-2">Card {ci + 1}</small>
                      <h5 className="mb-2">{card.front}</h5>
                      <small className="text-muted">(click to flip)</small>
                    </div>
                    <div className="flip-card-back">
                      <small style={{ opacity: 0.8 }} className="mb-2">Answer</small>
                      <p className="mb-2" style={{ fontSize: '1.1rem' }}>{card.back}</p>
                      <small style={{ opacity: 0.7 }}>(click to flip back)</small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

### 14.2 `frontend/src/pages/Classroom.tsx`
```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ClassroomRoom, WhiteboardTool, WhiteboardAction } from '../types';

interface LiveChatMsg {
  id: number;
  username: string;
  message: string;
  user_type?: string;
}

export default function Classroom() {
  const { user } = useAuth();
  const isTeacher = user?.user_type === 'teacher';

  // Room state
  const [rooms, setRooms] = useState<ClassroomRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<LiveChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Whiteboard state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [fontSize, setFontSize] = useState(20);
  const drawingRef = useRef(false);
  const pointsRef = useRef<[number, number][]>([]);
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const actionsRef = useRef<WhiteboardAction[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Inline text input state
  const [textInput, setTextInput] = useState<{ visible: boolean; nx: number; ny: number; cssX: number; cssY: number; value: string }>({
    visible: false, nx: 0, ny: 0, cssX: 0, cssY: 0, value: ''
  });
  const textInputRef = useRef<HTMLInputElement>(null);

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);

  // Move tool state
  const movingIndexRef = useRef<number | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveTotalDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Audio streaming state
  const [micActive, setMicActive] = useState(false);
  const [teacherStreaming, setTeacherStreaming] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null;

  // Load rooms
  useEffect(() => {
    client.get('/classrooms/').then(res => {
      setRooms(res.data);
      if (res.data.length > 0) setSelectedRoomId(res.data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // --- Canvas drawing helpers ---

  const getCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? { w: canvas.width, h: canvas.height } : { w: 1, h: 1 };
  }, []);

  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: WhiteboardAction, cw: number, ch: number) => {
    if (action.type === 'draw' || action.type === 'erase') {
      ctx.beginPath();
      ctx.strokeStyle = action.type === 'erase' ? '#ffffff' : action.color;
      ctx.lineWidth = action.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = action.points;
      if (pts.length > 0) {
        ctx.moveTo(pts[0][0] * cw, pts[0][1] * ch);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0] * cw, pts[i][1] * ch);
        }
        ctx.stroke();
      }
    } else if (action.type === 'line') {
      ctx.beginPath();
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.width;
      ctx.lineCap = 'round';
      ctx.moveTo(action.x1 * cw, action.y1 * ch);
      ctx.lineTo(action.x2 * cw, action.y2 * ch);
      ctx.stroke();
    } else if (action.type === 'text') {
      ctx.fillStyle = action.color;
      ctx.font = `${action.fontSize}px sans-serif`;
      ctx.fillText(action.content, action.x * cw, action.y * ch);
    } else if (action.type === 'clear') {
      ctx.clearRect(0, 0, cw, ch);
    }
  }, []);

  const replayAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);
    for (const action of actionsRef.current) {
      drawAction(ctx, action, w, h);
    }
  }, [drawAction, getCanvasSize]);

  // Fixed canvas resolution for consistent rendering across screens
  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    replayAll();
  }, [replayAll, selectedRoomId]);

  // --- WebSocket connection with auto-reconnect ---
  useEffect(() => {
    if (!selectedRoom) {
      setChatMessages([]);
      actionsRef.current = [];
      return;
    }

    // Load messages via REST
    client.get(`/classrooms/${selectedRoom.id}/messages/`).then(res => {
      setChatMessages(res.data.map((m: any) => ({
        id: m.id,
        username: m.sender_name,
        message: m.content,
        user_type: m.user_type,
      })));
    }).catch(() => {});

    // WebSocket with token auth + auto-reconnect
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '').replace('/api', '') || 'localhost:8080';
    const roomName = selectedRoom.name.replace(/[^a-zA-Z0-9]/g, '_');
    const token = localStorage.getItem('auth_token') || '';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/classroom/${roomName}/?token=${token}`;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          setChatMessages(prev => [...prev, {
            id: Date.now(),
            username: data.username,
            message: data.message,
            user_type: data.user_type,
          }]);
        } else if (data.type === 'whiteboard_state') {
          actionsRef.current = data.actions || [];
          replayAll();
        } else if (data.type === 'wb_draw') {
          const action: WhiteboardAction = { type: 'draw', points: data.points, color: data.color, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_line') {
          const action: WhiteboardAction = { type: 'line', x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2, color: data.color, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_text') {
          const action: WhiteboardAction = { type: 'text', x: data.x, y: data.y, content: data.content, fontSize: data.fontSize, color: data.color };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_erase') {
          const action: WhiteboardAction = { type: 'erase', points: data.points, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_clear') {
          actionsRef.current = [];
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_undo') {
          actionsRef.current.pop();
          replayAll();
        } else if (data.type === 'wb_move') {
          const idx = data.index;
          const action = actionsRef.current[idx];
          if (action) {
            if (action.type === 'text') {
              action.x += data.dx;
              action.y += data.dy;
            } else if (action.type === 'line') {
              action.x1 += data.dx;
              action.y1 += data.dy;
              action.x2 += data.dx;
              action.y2 += data.dy;
            }
            replayAll();
          }
        } else if (data.type === 'user_join' || data.type === 'user_leave') {
          // Could show system messages if desired

        // --- Audio streaming (PCM via AudioContext) ---
        } else if (data.type === 'audio_start') {
          setTeacherStreaming(true);
          // Student: create AudioContext for playback
          if (user?.user_type !== 'teacher') {
            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            nextStartTimeRef.current = 0;
            // Auto-resume if browser suspends it
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
              const resumeOnClick = () => {
                ctx.resume().catch(() => {});
                document.removeEventListener('click', resumeOnClick);
              };
              document.addEventListener('click', resumeOnClick);
            }
          }
        } else if (data.type === 'audio_stop') {
          setTeacherStreaming(false);
          const ctx = audioContextRef.current;
          if (ctx) { ctx.close().catch(() => {}); }
          audioContextRef.current = null;
          nextStartTimeRef.current = 0;
        } else if (data.type === 'audio_data') {
          // Student: decode PCM Int16 → Float32 and play via AudioContext
          const ctx = audioContextRef.current;
          if (!ctx || user?.user_type === 'teacher') return;
          const binary = atob(data.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          const buffer = ctx.createBuffer(1, float32.length, 16000);
          buffer.getChannelData(0).set(float32);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          const now = ctx.currentTime;
          if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
          // Cap latency: if scheduled too far ahead, reset
          if (nextStartTimeRef.current > now + 1.0) nextStartTimeRef.current = now + 0.05;
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [selectedRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Ctrl+Z undo for teacher
  useEffect(() => {
    if (!isTeacher) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'undo' }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTeacher]);

  // --- Mouse handlers for canvas (teacher only) ---

  const getNormCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  // Hit-test: find the topmost line or text action near (nx, ny)
  const hitTestAction = (nx: number, ny: number): number | null => {
    const threshold = 0.02; // ~2% of canvas
    for (let i = actionsRef.current.length - 1; i >= 0; i--) {
      const a = actionsRef.current[i];
      if (a.type === 'text') {
        // Rough bounding box: anchor is bottom-left of text
        const textW = (a.content.length * a.fontSize * 0.6) / CANVAS_W;
        const textH = a.fontSize / CANVAS_H;
        if (nx >= a.x - threshold && nx <= a.x + textW + threshold &&
            ny >= a.y - textH - threshold && ny <= a.y + threshold) {
          return i;
        }
      } else if (a.type === 'line') {
        // Distance from point to line segment
        const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((nx - a.x1) * dx + (ny - a.y1) * dy) / lenSq));
        const px = a.x1 + t * dx, py = a.y1 + t * dy;
        const dist = Math.sqrt((nx - px) ** 2 + (ny - py) ** 2);
        if (dist < threshold) return i;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher) return;
    const [nx, ny] = getNormCoords(e);

    if (tool === 'move') {
      const idx = hitTestAction(nx, ny);
      if (idx !== null) {
        movingIndexRef.current = idx;
        moveStartRef.current = { x: nx, y: ny };
        moveTotalDeltaRef.current = { dx: 0, dy: 0 };
        drawingRef.current = true;
      }
      return;
    }

    if (tool === 'text') {
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        setTextInput({
          visible: true,
          nx, ny,
          cssX: (e.clientX - containerRect.left),
          cssY: (e.clientY - containerRect.top),
          value: ''
        });
        setTimeout(() => textInputRef.current?.focus(), 0);
      }
      return;
    }

    drawingRef.current = true;

    if (tool === 'line') {
      lineStartRef.current = { x: nx, y: ny };
    } else {
      pointsRef.current = [[nx, ny]];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.arc(nx * canvas.width, ny * canvas.height, (tool === 'eraser' ? eraserWidth : lineWidth) / 2, 0, Math.PI * 2);
          ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
          ctx.fill();
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !drawingRef.current) return;
    const [nx, ny] = getNormCoords(e);

    if (tool === 'move' && movingIndexRef.current !== null && moveStartRef.current) {
      const dx = nx - moveStartRef.current.x;
      const dy = ny - moveStartRef.current.y;
      moveTotalDeltaRef.current.dx += dx;
      moveTotalDeltaRef.current.dy += dy;
      const action = actionsRef.current[movingIndexRef.current];
      if (action) {
        if (action.type === 'text') {
          action.x += dx; action.y += dy;
        } else if (action.type === 'line') {
          action.x1 += dx; action.y1 += dy;
          action.x2 += dx; action.y2 += dy;
        }
        moveStartRef.current = { x: nx, y: ny };
        replayAll();
      }
      return;
    }

    if (tool === 'line') {
      replayAll();
      const canvas = canvasRef.current;
      if (canvas && lineStartRef.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.moveTo(lineStartRef.current.x * canvas.width, lineStartRef.current.y * canvas.height);
          ctx.lineTo(nx * canvas.width, ny * canvas.height);
          ctx.stroke();
        }
      }
    } else {
      pointsRef.current.push([nx, ny]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pts = pointsRef.current;
          if (pts.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.lineWidth = tool === 'eraser' ? eraserWidth : lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(pts[pts.length - 2][0] * canvas.width, pts[pts.length - 2][1] * canvas.height);
            ctx.lineTo(pts[pts.length - 1][0] * canvas.width, pts[pts.length - 1][1] * canvas.height);
            ctx.stroke();
          }
        }
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !drawingRef.current) return;
    drawingRef.current = false;

    if (tool === 'move' && movingIndexRef.current !== null) {
      const { dx, dy } = moveTotalDeltaRef.current;
      if ((dx !== 0 || dy !== 0) && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'move', index: movingIndexRef.current, dx, dy
        }));
      }
      movingIndexRef.current = null;
      moveStartRef.current = null;
      return;
    }

    if (tool === 'line' && lineStartRef.current) {
      const [nx, ny] = getNormCoords(e);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'line',
          x1: lineStartRef.current.x, y1: lineStartRef.current.y,
          x2: nx, y2: ny, color, width: lineWidth
        }));
      }
      lineStartRef.current = null;
    } else if (tool === 'pen' || tool === 'eraser') {
      if (pointsRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        if (tool === 'pen') {
          wsRef.current.send(JSON.stringify({
            type: 'draw', points: pointsRef.current, color, width: lineWidth
          }));
        } else {
          wsRef.current.send(JSON.stringify({
            type: 'erase', points: pointsRef.current, width: eraserWidth
          }));
        }
      }
      pointsRef.current = [];
    }
  };

  const submitTextInput = () => {
    if (textInput.value.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text', x: textInput.nx, y: textInput.ny,
        content: textInput.value.trim(), fontSize, color
      }));
    }
    setTextInput(prev => ({ ...prev, visible: false, value: '' }));
  };

  const cancelTextInput = () => {
    setTextInput(prev => ({ ...prev, visible: false, value: '' }));
  };

  const handleClear = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  };

  // --- Audio streaming helpers (PCM via AudioContext) ---

  const cleanupAudio = useCallback(() => {
    // Close AudioContext (used by both teacher for capture and student for playback)
    const ctx = audioContextRef.current;
    if (ctx) { ctx.close().catch(() => {}); }
    audioContextRef.current = null;
    nextStartTimeRef.current = 0;
    // Stop mic tracks (teacher)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setMicActive(false);
    setTeacherStreaming(false);
  }, []);

  const handleMicToggle = useCallback(async () => {
    if (micActive) {
      // Stop broadcasting
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'audio_stop' }));
      }
      cleanupAudio();
    } else {
      // Start broadcasting: capture mic → downsample to 16kHz PCM → base64 → WS
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setMicActive(true);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio_start' }));
        }
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        // Mute local output to prevent feedback
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0;
        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const ratio = audioCtx.sampleRate / 16000;
          const outLen = Math.floor(float32.length / ratio);
          const int16 = new Int16Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const idx = Math.floor(i * ratio);
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[idx] * 32768)));
          }
          const uint8 = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          const base64 = btoa(binary);
          wsRef.current!.send(JSON.stringify({ type: 'audio_data', data: base64 }));
        };
      } catch {
        setToast('Could not access microphone. Please allow microphone access.');
        setTimeout(() => setToast(null), 4000);
      }
    }
  }, [micActive, cleanupAudio]);

  // Cleanup audio when changing rooms
  useEffect(() => {
    return () => { cleanupAudio(); };
  }, [selectedRoomId, cleanupAudio]);

  // --- Chat send ---
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', message: newMessage }));
    } else {
      client.post(`/classrooms/${selectedRoom.id}/send/`, { content: newMessage }).then(res => {
        setChatMessages(prev => [...prev, {
          id: res.data.id,
          username: res.data.sender_name,
          message: res.data.content,
          user_type: res.data.user_type,
        }]);
      }).catch(() => {});
    }
    setNewMessage('');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await client.post('/classrooms/', { name: newRoomName, participants: [user?.id] });
      setRooms(prev => [res.data, ...prev]);
      setSelectedRoomId(res.data.id);
      setNewRoomName('');
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar with room selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6' }}>
        <select
          className="form-select form-select-sm"
          style={{ width: 220 }}
          value={selectedRoomId ?? ''}
          onChange={e => setSelectedRoomId(Number(e.target.value))}
        >
          <option value="" disabled>Select a room...</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.participant_names?.length || 0})</option>
          ))}
        </select>
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: 4 }}>
          <input
            className="form-control form-control-sm"
            style={{ width: 140 }}
            placeholder="New room..."
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">+</button>
        </form>
        {selectedRoom && (
          <span className="text-muted small ms-auto">
            {selectedRoom.participant_names?.join(', ')}
          </span>
        )}
      </div>

      {!selectedRoom ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Select a room or create a new one</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Whiteboard — left 70% */}
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', borderRight: '1px solid #dee2e6' }}>
            {/* Teacher toolbar */}
            {isTeacher && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6', flexWrap: 'wrap' }}>
                {([
                  { id: 'pen' as WhiteboardTool, title: 'Pen', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l9.5-9.5zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z"/></svg> },
                  { id: 'line' as WhiteboardTool, title: 'Line', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0z"/></svg> },
                  { id: 'text' as WhiteboardTool, title: 'Text', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.258 3H3.747l-.082 2.46h.479c.26-1.544.758-1.783 2.693-1.845l.424-.013v7.827c0 .663-.144.82-1.3.923v.52h4.082v-.52c-1.162-.103-1.306-.26-1.306-.923V3.602l.43.013c1.935.062 2.434.3 2.694 1.845h.479L12.258 3z"/></svg> },
                  { id: 'eraser' as WhiteboardTool, title: 'Eraser', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l5.88-5.879zm2.121.707a1 1 0 0 0-1.414 0L4.16 7.547l5.293 5.293 4.633-4.633a1 1 0 0 0 0-1.414l-3.879-3.879zM8.746 13.547 3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293l.16-.16z"/></svg> },
                  { id: 'move' as WhiteboardTool, title: 'Move', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10zM.146 8.354a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L1.707 7.5H5.5a.5.5 0 0 1 0 1H1.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2zM10 8a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L14.293 8.5H10.5A.5.5 0 0 1 10 8z"/></svg> },
                ]).map(t => (
                  <button
                    key={t.id}
                    className={`btn btn-sm ${tool === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setTool(t.id)}
                    title={t.title}
                    style={{ padding: '4px 8px', lineHeight: 1 }}
                  >
                    {t.icon}
                  </button>
                ))}
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                {(tool === 'pen' || tool === 'line' || tool === 'text') && (
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 30, height: 28, border: 'none', padding: 0, cursor: 'pointer' }} title="Color" />
                )}
                {(tool === 'pen' || tool === 'line') && (
                  <select className="form-select form-select-sm" style={{ width: 70 }} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} title="Width">
                    {[1, 2, 3, 5, 8, 12].map(w => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                )}
                {tool === 'text' && (
                  <select className="form-select form-select-sm" style={{ width: 70 }} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} title="Font size">
                    {[12, 16, 20, 28, 36, 48].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                )}
                {tool === 'eraser' && (
                  <select className="form-select form-select-sm" style={{ width: 75 }} value={eraserWidth} onChange={e => setEraserWidth(Number(e.target.value))} title="Eraser size">
                    {[10, 20, 40, 60, 80].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                )}
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'undo' }));
                    }
                  }}
                  title="Undo (Ctrl+Z)"
                  style={{ padding: '4px 8px', lineHeight: 1 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={handleClear}>Clear All</button>
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                <button
                  className={`btn btn-sm ${micActive ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={handleMicToggle}
                  title={micActive ? 'Stop microphone' : 'Start microphone'}
                >
                  {micActive ? 'Mic ON' : 'Mic'}
                </button>
              </div>
            )}
            {/* Canvas — fixed 16:9 aspect ratio */}
            <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ecef', overflow: 'hidden', position: 'relative' }}>
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9',
                  background: '#ffffff', display: 'block',
                  cursor: (() => {
                    if (!isTeacher) return 'default';
                    if (tool === 'move') return 'grab';
                    if (tool === 'text') return 'text';
                    if (tool === 'eraser') {
                      const canvas = canvasRef.current;
                      const scale = canvas ? canvas.getBoundingClientRect().width / canvas.width : 0.5;
                      const sz = Math.max(8, Math.min(128, Math.round(eraserWidth * scale)));
                      const half = Math.round(sz / 2);
                      return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}'%3E%3Crect x='1' y='1' width='${sz - 2}' height='${sz - 2}' fill='rgba(200,200,200,0.3)' stroke='%23333' stroke-width='1.5'/%3E%3C/svg%3E") ${half} ${half}, auto`;
                    }
                    return 'crosshair';
                  })()
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  if (drawingRef.current && isTeacher) {
                    drawingRef.current = false;
                    if (tool === 'pen' || tool === 'eraser') {
                      if (pointsRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify(
                          tool === 'pen'
                            ? { type: 'draw', points: pointsRef.current, color, width: lineWidth }
                            : { type: 'erase', points: pointsRef.current, width: eraserWidth }
                        ));
                      }
                      pointsRef.current = [];
                    }
                    lineStartRef.current = null;
                  }
                }}
              />
              {/* Inline text input overlay */}
              {textInput.visible && (
                <input
                  ref={textInputRef}
                  value={textInput.value}
                  onChange={e => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitTextInput();
                    if (e.key === 'Escape') cancelTextInput();
                  }}
                  onBlur={submitTextInput}
                  placeholder="Type here..."
                  style={{
                    position: 'absolute',
                    left: textInput.cssX,
                    top: textInput.cssY - fontSize / 2,
                    fontSize: fontSize * 0.7,
                    color,
                    background: 'rgba(255,255,255,0.9)',
                    border: '1.5px solid var(--el-green)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    outline: 'none',
                    minWidth: 120,
                    zIndex: 10,
                    fontFamily: 'sans-serif',
                  }}
                />
              )}
              {!isTeacher && (
                <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 6 }}>
                  <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                    View only
                  </div>
                  {teacherStreaming && (
                    <div
                      style={{ background: 'rgba(220,53,69,0.85)', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: '0.75rem', animation: 'pulse 1.5s infinite', cursor: 'pointer' }}
                      onClick={() => {
                        const ctx = audioContextRef.current;
                        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
                      }}
                    >
                      Teacher speaking
                    </div>
                  )}
                </div>
              )}
              {/* Toast notification */}
              {toast && (
                <div style={{
                  position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                  background: '#dc3545', color: '#fff', padding: '6px 16px', borderRadius: 6,
                  fontSize: '0.85rem', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  {toast}
                </div>
              )}
            </div>
          </div>

          {/* Chat — right 30%, YouTube live chat style */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 12px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6', fontWeight: 600, fontSize: '0.9rem' }}>
              Live Chat
            </div>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {chatMessages.map(m => {
                const isMsgTeacher = m.user_type === 'teacher';
                const isMe = m.username === user?.username;
                return (
                  <div key={m.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.85rem', lineHeight: 1.3 }}>
                    <span style={{
                      fontWeight: 600,
                      flexShrink: 0,
                      padding: '1px 6px',
                      borderRadius: 4,
                      ...(isMsgTeacher
                        ? { background: 'var(--el-green)', color: '#fff' }
                        : isMe
                          ? { border: '1.5px solid var(--el-green)', color: 'var(--el-green-dark)' }
                          : { color: '#495057' }
                      )
                    }}>
                      {m.username}
                    </span>
                    <span style={{ color: '#212529', wordBreak: 'break-word' }}>{m.message}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <form onSubmit={handleSend} style={{ display: 'flex', padding: 8, borderTop: '1px solid #dee2e6', gap: 4 }}>
              <input
                className="form-control form-control-sm"
                placeholder="Say something..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary btn-sm">Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 15: Frontend — Invitation & Notification Pages

### 15.1 `frontend/src/pages/InvitationList.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import type { Invitation } from '../types';

export default function InvitationList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/invitations/')
      .then((res) => {
        setInvitations(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleResend = async (id: number) => {
    try {
      await client.post(`/invitations/${id}/resend/`);
      const res = await client.get('/invitations/');
      setInvitations(res.data);
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this invitation?')) return;
    try {
      await client.delete(`/invitations/${id}/`);
      setInvitations(invitations.filter(inv => inv.id !== id));
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return <div className="text-center mt-5"><p>Loading invitations...</p></div>;
  }

  return (
    <div className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Invitations</h2>
        <div>
          <Link to="/invitations/new" className="btn btn-primary el-btn-gradient">Invite User</Link>
          <Link to="/invitations/bulk" className="btn btn-outline-primary ms-2">Bulk Invite</Link>
        </div>
      </div>

      {invitations.length === 0 ? (
        <p className="text-muted">No invitations sent yet.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td>{inv.full_name}</td>
                <td>{inv.user_type}</td>
                <td>
                  <span
                    className={`badge bg-${
                      inv.status === 'accepted'
                        ? 'success'
                        : inv.status === 'expired'
                        ? 'secondary'
                        : 'warning'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                <td>{new Date(inv.expires_at).toLocaleDateString()}</td>
                <td>
                  {inv.status === 'pending' && (
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleResend(inv.id)}
                    >
                      Resend
                    </button>
                  )}
                  {inv.status !== 'accepted' && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(inv.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### 15.2 `frontend/src/pages/InviteSingle.tsx`
```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function InviteSingle() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    user_type: 'student',
    date_of_birth: '',
    phone_number: '',
    bio: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...formData,
        date_of_birth: formData.date_of_birth || null,
      };
      await client.post('/invitations/', payload);
      setSuccess(`Invitation sent to ${formData.email}`);
      setTimeout(() => navigate('/invitations'), 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setError(messages);
      } else {
        setError('Failed to send invitation.');
      }
    }
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h2 className="card-title mb-4">Invite a User</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input id="email" name="email" type="email" className="form-control" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="full_name" className="form-label">Full Name</label>
                <input id="full_name" name="full_name" type="text" className="form-control" value={formData.full_name} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="user_type" className="form-label">User Type</label>
                <select id="user_type" name="user_type" className="form-select" value={formData.user_type} onChange={handleChange}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="date_of_birth" className="form-label">Date of Birth</label>
                <input id="date_of_birth" name="date_of_birth" type="date" className="form-control" value={formData.date_of_birth} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="phone_number" className="form-label">Phone Number</label>
                <input id="phone_number" name="phone_number" type="text" className="form-control" value={formData.phone_number} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="bio" className="form-label">Bio</label>
                <textarea id="bio" name="bio" className="form-control" rows={3} value={formData.bio} onChange={handleChange} />
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient">Send Invitation</button>
              <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/invitations')}>Cancel</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 15.3 `frontend/src/pages/InviteBulk.tsx`
```tsx
import React, { useState, useRef } from 'react';
import client from '../api/client';
import type { BulkUploadResult } from '../types';

export default function InviteBulk() {
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are accepted.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResults(null);

    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    const formData = new FormData();
    formData.append('csv_file', selectedFile);

    setUploading(true);
    try {
      const res = await client.post('/invitations/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h2 className="card-title mb-4">Bulk Invite via CSV</h2>
            <div className="alert alert-info">
              <strong>CSV format:</strong> The file must have these exact column headers in the first row:
              <code> full_name, email, user_type, date_of_birth, phone_number, bio</code>.
              Date format: YYYY-MM-DD. user_type: &quot;student&quot; or &quot;teacher&quot;.
              <br />
              <button
                type="button"
                className="mt-2 btn btn-sm btn-outline-primary"
                onClick={async () => {
                  try {
                    const res = await client.get('/invitations/download_template/', { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'invitation_template.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch { /* ignore */ }
                }}
              >
                Download Template
              </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">CSV File (.csv)</label>
                <div
                  className={`p-4 text-center ${dragOver ? 'el-drop-zone dragging' : 'el-drop-zone'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileDrop(file);
                  }}
                  data-testid="csv-drop-zone"
                >
                  <input
                    type="file"
                    ref={fileRef}
                    className="d-none"
                    accept=".csv"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileDrop(file);
                    }}
                  />
                  {selectedFile ? (
                    <div>
                      <span className="fw-bold">{selectedFile.name}</span>
                      <span className="text-muted ms-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger ms-2"
                        onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted">
                      <div className="mb-1" style={{ fontSize: '2rem' }}>&#128196;</div>
                      <div>Drag & drop your CSV file here, or click to browse</div>
                      <small>Only .csv files are accepted</small>
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient" disabled={uploading || !selectedFile}>
                {uploading ? 'Uploading...' : 'Upload & Send Invitations'}
              </button>
            </form>

            {results && (
              <div className="mt-4">
                <h4>Results</h4>
                <p>Total rows processed: {results.total}</p>
                {results.success.length > 0 && (
                  <div className="alert alert-success">
                    <strong>{results.success.length} invitation(s) sent:</strong>
                    <ul>
                      {results.success.map((s) => (
                        <li key={s.row}>Row {s.row}: {s.email}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {results.errors.length > 0 && (
                  <div className="alert alert-danger">
                    <strong>{results.errors.length} error(s):</strong>
                    <ul>
                      {results.errors.map((e) => (
                        <li key={e.row}>Row {e.row}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 15.4 `frontend/src/pages/Notifications.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

const typeBadge: Record<string, { label: string; cls: string }> = {
  enrollment: { label: 'Enrollment', cls: 'bg-success' },
  material: { label: 'Material', cls: 'bg-primary' },
  feedback: { label: 'Feedback', cls: 'bg-info' },
  deadline: { label: 'Deadline', cls: 'bg-warning text-dark' },
  general: { label: 'General', cls: 'bg-secondary' },
};

export default function Notifications() {
  const { setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/notifications/').then(res => {
      setNotifications(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleMarkAllRead = async () => {
    await client.post('/notifications/mark_all_read/');
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Notifications</h4>
        {notifications.some(n => !n.is_read) && (
          <button className="btn btn-sm btn-outline-primary" onClick={handleMarkAllRead}>Mark All Read</button>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="text-muted">No notifications.</p>
      ) : (
        <div className="list-group">
          {notifications.map(n => {
            const badge = typeBadge[n.notification_type] || typeBadge.general;
            const inner = (
              <div className="d-flex justify-content-between">
                <div>
                  <span className={`badge ${badge.cls} me-2`}>{badge.label}</span>
                  <strong>{n.title}</strong>
                  <p className="mb-0 small">{n.message}</p>
                </div>
                <small className="text-muted text-nowrap ms-3">{new Date(n.created_at).toLocaleString()}</small>
              </div>
            );
            const cls = `list-group-item list-group-item-action ${!n.is_read ? 'list-group-item-light fw-semibold' : ''}`;
            return n.link ? (
              <Link key={n.id} to={n.link} className={cls}>{inner}</Link>
            ) : (
              <div key={n.id} className={cls}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## Step 16: Frontend — App Entry Point & Router

### 16.1 `frontend/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 16.2 `frontend/src/App.tsx`
```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import AcceptInvitation from './pages/AcceptInvitation';
import InvitationList from './pages/InvitationList';
import InviteSingle from './pages/InviteSingle';
import InviteBulk from './pages/InviteBulk';
import StudentHome from './pages/StudentHome';
import TeacherHome from './pages/TeacherHome';
import Profile from './pages/Profile';
import CourseDetail from './pages/CourseDetail';
import CourseCreate from './pages/CourseCreate';
import Classroom from './pages/Classroom';
import Notifications from './pages/Notifications';
import AssignmentView from './pages/AssignmentView';

function Home() {
    const { user } = useAuth();
    if (user?.user_type === 'teacher') return <TeacherHome />;
    return <StudentHome />;
}

function AppRoutes() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
    }

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
            <Route path="/invite/:token" element={<AcceptInvitation />} />

            {/* Protected: Home (auto-routes to student or teacher home) */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

            {/* Profile */}
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Courses */}
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/courses/create" element={<ProtectedRoute requiredType="teacher"><CourseCreate /></ProtectedRoute>} />

            {/* Assignments */}
            <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentView /></ProtectedRoute>} />

            {/* Classroom / Chat */}
            <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
            <Route path="/classroom/:roomId" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />

            {/* Notifications */}
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* Teacher: Invitations */}
            <Route path="/invitations" element={<ProtectedRoute requiredType="teacher"><InvitationList /></ProtectedRoute>} />
            <Route path="/invitations/new" element={<ProtectedRoute requiredType="teacher"><InviteSingle /></ProtectedRoute>} />
            <Route path="/invitations/bulk" element={<ProtectedRoute requiredType="teacher"><InviteBulk /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

function Layout() {
    const { isAuthenticated } = useAuth();
    return (
        <>
            {isAuthenticated && <Navbar />}
            <div className={isAuthenticated ? 'container-fluid px-4 mt-3' : ''}>
                <AppRoutes />
            </div>
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Layout />
            </AuthProvider>
        </BrowserRouter>
    );
}
```

### Checkpoint 4 — Full Application
```bash
docker compose up -d
# Wait for all 5 services to start (backend, frontend, redis, celery_worker, celery_beat)
docker compose ps
# Visit http://localhost:5173 — should show the login page
# Log in with: john_teacher / teacher123 (or any user from seed data)
```

### Checkpoint 5 — Verify Celery
```bash
docker compose logs celery_worker
# Should show: "celery@... ready." and list discovered tasks
docker compose logs celery_beat
# Should show: "beat: Starting..."
```

---

## Step 17: Verify Everything Works

Test these features after the full build:

1. **Login/Register** — Go to http://localhost:5173/login, log in as `john_teacher` / `teacher123`
2. **Teacher Home** — Should see courses, feeds, student search with block/unblock/delete
3. **Create Course** — Click "+ New Course", fill in details, add students
4. **Course Detail** — Upload materials, generate AI assignments (requires OpenAI key)
5. **Classroom** — Create a room, send chat messages, draw on whiteboard
6. **Invitations** — Send single/bulk invitations via CSV
7. **Notifications** — Check notification bell, mark as read
8. **Student View** — Log out, log in as `alice_student` / `student123`, verify student dashboard
9. **Enroll** — Enroll in available courses as a student
10. **Quiz/Flashcards** — Take a quiz or flip flashcards if assignments exist
11. **Profile** — Edit profile, upload photo, view deadlines
12. **Django Admin** — Visit http://localhost:8080/admin/ with `admin` / `admin123`
13. **Celery Tasks** — Check `docker compose logs celery_worker` after sending an invitation or enrolling — emails should appear as processed tasks

---

## Demo Accounts (from seed data)

| Role    | Username        | Password     |
|---------|-----------------|--------------|
| Admin   | admin           | admin123     |
| Teacher | john_teacher    | teacher123   |
| Teacher | maria_teacher   | teacher123   |
| Student | alice_student   | student123   |
| Student | bob_student     | student123   |
| Student | charlie_student | student123   |
| Student | diana_student   | student123   |
| Student | ethan_student   | student123   |

---

## Architecture Summary

```
Frontend (React 18 + TypeScript)     Backend (Django 4.2 + DRF)
┌─────────────────────────────┐     ┌──────────────────────────────┐
│ src/                        │     │ 4 Django Apps:               │
│   api/client.ts (Axios)  ───┼──→  │   accounts/ (User, Auth)     │
│   context/AuthContext.tsx    │REST │   courses/  (Course, Material)│
│   components/ (Navbar, etc) │API  │   classroom/(WebSocket Chat) │
│   pages/ (14 page components│     │   notifications/ (In-app)    │
│   types/index.ts            │     │                              │
│                             │     │ ASGI via Daphne              │
│ Bootstrap 5 + theme.css     │     │ Django Channels + Redis      │
│ React Router 6              │     │ Token Authentication         │
│ WebSocket (Classroom)    ───┼──→  │ WebSocket Consumer           │
└─────────────────────────────┘     └──────────────────────────────┘
          │                           │               │
          │                           ▼               ▼
          │                    ┌─────────────┐ ┌─────────────┐
          │                    │ Celery       │ │ Celery Beat │
          │                    │ Worker       │ │ (Scheduler) │
          │                    │ - Emails     │ │             │
          │                    │ - AI Tasks   │ │             │
          │                    └──────┬───────┘ └──────┬──────┘
          │                           │                │
          │                           ▼                ▼
          │                    ┌──────────────────────────┐
          └────────────────────│       Redis (Broker)     │
                               └──────────────────────────┘
         Docker Compose: backend + frontend + redis + celery_worker + celery_beat
```
