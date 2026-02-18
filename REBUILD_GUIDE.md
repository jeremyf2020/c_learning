# eLearning Platform - Step-by-Step Rebuild Guide

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript + Vite | UI framework |
| Backend | Django 4.2 + Django REST Framework | API server |
| Real-time | Django Channels + Redis | WebSocket (chat, whiteboard, audio) |
| Database | SQLite | Data storage |
| Server | Daphne (ASGI) | Serves HTTP + WebSocket |
| Container | Docker + Docker Compose | Environment management |
| Email | Gmail SMTP | Notification + invitation emails |
| AI | OpenAI API (gpt-3.5-turbo) | Quiz/flashcard generation from PDF |
| API Docs | drf-spectacular (OpenAPI 3.0) | Swagger UI + ReDoc auto-generated docs |
| PDF | pypdf | Text extraction from uploaded PDFs |

---

## Phase 1: Project Setup & Docker

**Goal:** Set up the project skeleton with Docker so backend and frontend can run together.

### Step 1.1: Create project structure

```
elearning/
├── backend/
│   ├── .dockerignore
│   └── Dockerfile
├── frontend/
│   ├── .dockerignore
│   └── Dockerfile
├── docker-compose.yml
└── .env
```

### Step 1.2: Initialize Django backend

```bash
cd backend
pip install django djangorestframework django-cors-headers
django-admin startproject elearning_project .
```

Key files to configure:
- `settings.py` — Add `rest_framework`, `corsheaders` to `INSTALLED_APPS`
- `settings.py` — Configure CORS to allow frontend origin (`http://localhost:5173`)
- `settings.py` — Set `MEDIA_URL` and `MEDIA_ROOT` for file uploads

### Step 1.3: Initialize React + TypeScript frontend

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install axios react-router-dom bootstrap
```

Key files:
- `src/api/client.ts` — Axios instance with `baseURL` pointing to backend API
- `src/App.tsx` — React Router setup
- `main.tsx` — Import Bootstrap CSS

### Step 1.4: Write Dockerfiles

**backend/Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]
```

**frontend/Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

### Step 1.5: Write .dockerignore files

**backend/.dockerignore:**
```
__pycache__
*.pyc
*.pyo
.env
db.sqlite3
media/
*.log
.git
```

**frontend/.dockerignore:**
```
node_modules
dist
```

These prevent local files from overriding Docker-installed dependencies or leaking secrets into images.

### Step 1.6: Write docker-compose.yml

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    env_file: .env
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
```

### Step 1.7: Write .env file

```env
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
VITE_API_URL=http://localhost:8080/api
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Step 1.8: Verify

```bash
docker compose up --build
```
- Backend at http://localhost:8080
- Frontend at http://localhost:5173

**Concepts learned:** Docker, Docker Compose, volumes, .dockerignore, environment variables, Vite, Django project structure, CORS

---

## Phase 2: User Authentication

**Goal:** Custom User model with student/teacher roles, token-based login/register.

### Step 2.1: Create accounts app

```bash
python manage.py startapp accounts
```

### Step 2.2: Define Custom User model

**`accounts/models.py`:**
```python
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    USER_TYPE_CHOICES = [('student', 'Student'), ('teacher', 'Teacher')]
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='student')
    full_name = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)
    is_blocked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_student(self):
        return self.user_type == 'student'

    def is_teacher(self):
        return self.user_type == 'teacher'
```

**`settings.py`:** Add `AUTH_USER_MODEL = 'accounts.User'`

Then run:
```bash
python manage.py makemigrations accounts
python manage.py migrate
```

### Step 2.3: Create serializers

**`accounts/serializers.py`:**
- `UserSerializer` — For listing/displaying user data
- `LoginSerializer` — Validates username + password
- `RegisterSerializer` — Creates new user with password hashing

### Step 2.4: Create auth API endpoints

**`accounts/api.py`:**
- `auth_login` — Authenticates user, checks `is_blocked`, returns Token
- `auth_register` — Creates user, returns Token
- `auth_me` — Returns current user data (requires token)

**`elearning_project/urls.py`:**
```python
path('api/auth/login/', auth_login),
path('api/auth/register/', auth_register),
path('api/auth/me/', auth_me),
```

### Step 2.5: Frontend AuthContext

**`src/context/AuthContext.tsx`:**
- Stores `user` and `token` in React state
- `login()` — POST `/api/auth/login/`, store token in localStorage
- `register()` — POST `/api/auth/register/`, store token
- `logout()` — Remove token, clear user state
- On mount: check localStorage for token, call `/api/auth/me/`

### Step 2.6: Frontend Login/Register pages

- `src/pages/Login.tsx` — Form with username/password, calls `login()`
- `src/pages/Register.tsx` — Form with username/email/password/user_type, calls `register()`

### Step 2.7: Axios interceptor for token

**`src/api/client.ts`:**
```typescript
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});
```

### Step 2.8: Protected routes

**`src/components/ProtectedRoute.tsx`:**
- Wraps routes that require authentication
- Redirects to `/login` if no token
- Can check `user_type` for role-based access

**Concepts learned:** Custom User model, AbstractUser, Token authentication, DRF serializers, React Context, localStorage, Axios interceptors, protected routes

---

## Phase 3: Course Management

**Goal:** Teachers create courses, students enroll/unenroll.

### Step 3.1: Create courses app & models

**`courses/models.py`:**
```python
class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=20, unique=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

class Enrollment(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('student', 'course')
```

### Step 3.2: Create CourseViewSet with actions and permission checks

**`courses/api.py`:**
- Standard CRUD via `ModelViewSet`
- `perform_create` — check `request.user.is_teacher()`, auto-set `teacher=request.user`
- `perform_update` — verify `instance.teacher == request.user` or raise `PermissionDenied`
- `perform_destroy` — verify ownership before deleting
- `@action enroll` — Student enrolls (get_or_create Enrollment), track `reactivated` flag to avoid duplicate notifications
- `@action unenroll` — Student unenrolls (set is_active=False)
- `@action students` — List enrolled students (teacher-only)
- `@action materials` — List course materials (teacher or enrolled students only)
- `@action add_student` — Teacher force-adds a student
- `@action block_student` — Teacher removes a student

### Step 3.3: Register with DRF Router

**`urls.py`:**
```python
router = DefaultRouter()
router.register(r'courses', CourseViewSet)
router.register(r'enrollments', EnrollmentViewSet)
urlpatterns = [path('api/', include(router.urls))]
```

### Step 3.4: Frontend pages

- `TeacherHome.tsx` — List teacher's courses, + New Course button
- `StudentHome.tsx` — List enrolled courses + available courses to join
- `CourseCreate.tsx` — Form to create new course
- `CourseDetail.tsx` — Show course info, enrolled students, enroll/unenroll button

**Concepts learned:** Django models, ForeignKey, unique_together, ModelViewSet, @action decorator, DRF Router, perform_update/perform_destroy for ownership checks, PermissionDenied exception, GET/POST/PATCH/DELETE, React state management

---

## Phase 4: Course Materials (File Upload)

**Goal:** Teachers upload files (PDF, images, video) to courses.

### Step 4.1: CourseMaterial model

```python
class CourseMaterial(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    material_type = models.CharField(choices=[('document','Document'), ('image','Image'), ('video','Video')])
    file = models.FileField(upload_to='course_materials/')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
```

### Step 4.2: Configure media serving

**`settings.py`:**
```python
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

**`urls.py`:** Add `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)` in DEBUG mode

### Step 4.3: API with MultiPartParser and ownership checks

```python
class CourseMaterialViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, JSONParser]

    def perform_create(self, serializer):
        course = serializer.validated_data.get('course')
        if course and course.teacher != self.request.user:
            raise PermissionDenied('You can only upload materials to your own courses.')
        serializer.save(uploaded_by=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.uploaded_by != self.request.user:
            raise PermissionDenied('You can only edit your own materials.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.uploaded_by != self.request.user:
            raise PermissionDenied('You can only delete your own materials.')
        instance.delete()
```

### Step 4.4: Frontend upload UI

- Use `FormData` to send files via Axios
- Drag-and-drop zone with file type validation
- Display uploaded materials as a list with download links

**Concepts learned:** FileField, MEDIA_ROOT/MEDIA_URL, MultiPartParser, FormData, multipart/form-data, static file serving in Django, ownership checks on create/update/delete

---

## Phase 5: Feedback & Ratings

**Goal:** Students rate and comment on courses, teachers can view feedback.

### Step 5.1: Feedback model

```python
class Feedback(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()

    class Meta:
        unique_together = ('course', 'student')
```

### Step 5.2: FeedbackViewSet with filtering and ownership checks

```python
class FeedbackViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = Feedback.objects.select_related('student', 'course')
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        # Scope by role — students see enrolled courses only, teachers see own courses only
        if self.request.user.is_student():
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user, is_active=True
            ).values_list('course_id', flat=True)
            qs = qs.filter(course_id__in=enrolled_courses)
        elif self.request.user.is_teacher():
            qs = qs.filter(course__teacher=self.request.user)
        return qs

    def perform_create(self, serializer):
        # Only enrolled students can submit feedback
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
            raise PermissionDenied('You can only edit your own feedback.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.student != self.request.user:
            raise PermissionDenied('You can only delete your own feedback.')
        instance.delete()
```

**Important:** When using `get_queryset()` instead of class-level `queryset`, you must pass `basename` to `router.register()`.

**Important:** The `get_queryset` scoping is essential — without it, any authenticated user could see all feedback in the system. By scoping to enrolled courses (students) or owned courses (teachers), feedback data is only visible to users with a legitimate relationship to the course.

### Step 5.3: Frontend feedback section

- Star rating selector (1-5)
- Comment textarea
- Submit → POST `/api/feedback/`
- Display existing feedback with average rating
- **Key SPA pattern:** After submitting, append new feedback to state immediately (don't wait for page refresh)

**Concepts learned:** Query parameter filtering, get_queryset vs queryset, basename in router, unique_together for one-review-per-student, select_related for query optimisation, optimistic UI updates

---

## Phase 6: Notifications with Email Delivery

**Goal:** Auto-notify users about enrollments, deadlines, new materials — both in-app and via email.

### Step 6.1: Notification model

```python
class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE)
    notification_type = models.CharField(choices=[
        ('general', 'General'), ('enrollment', 'Enrollment'),
        ('material', 'Material'), ('feedback', 'Feedback'), ('deadline', 'Deadline'),
    ])
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

### Step 6.2: Centralised notification utility with email

**`notifications/utils.py`:**
```python
from django.core.mail import send_mail, send_mass_mail
from .models import Notification

def create_notification(*, recipient, notification_type, title, message, link=''):
    """Create an in-app notification and send an email."""
    notification = Notification.objects.create(
        recipient=recipient, notification_type=notification_type,
        title=title, message=message, link=link,
    )
    if recipient.email:
        try:
            send_mail(
                subject=title, message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient.email], fail_silently=True,
            )
        except Exception:
            logger.exception('Failed to send email to %s', recipient.email)
    return notification

def create_bulk_notifications(*, recipients, notification_type, title, message, link=''):
    """Create notifications for multiple recipients with batch email."""
    notifications = []
    email_messages = []
    for recipient in recipients:
        notification = Notification.objects.create(
            recipient=recipient, notification_type=notification_type,
            title=title, message=message, link=link,
        )
        notifications.append(notification)
        if recipient.email:
            email_messages.append(
                (title, message, settings.DEFAULT_FROM_EMAIL, [recipient.email])
            )
    if email_messages:
        try:
            send_mass_mail(email_messages, fail_silently=True)
        except Exception:
            logger.exception('Failed to send bulk emails for: %s', title)
    return notifications
```

**Key design decision:** Using explicit utility functions instead of Django signals because:
- The notification logic is visible at the call site (easier to debug)
- You can pass contextual information (specific message text)
- Follows Python's "explicit is better than implicit"

### Step 6.3: All nine notification event points

| Event | Where called | Function | Recipient |
|-------|-------------|----------|-----------|
| Student enrols | `api.py` enroll action | `create_notification` | Teacher |
| Student unenrols | `api.py` unenroll action | `create_notification` | Teacher |
| Teacher blocks student | `api.py` block_student | `create_notification` | Student |
| Teacher adds student | `api.py` add_student | `create_notification` | Student |
| Teacher uploads material | `views.py` upload_material | `create_bulk_notifications` | All enrolled students |
| Student submits feedback | `views.py` submit_feedback | `create_notification` | Teacher |
| Student submits assignment | `api.py` perform_create | `create_notification` | Teacher |
| Assignment deadline set | `api.py` perform_update | `create_bulk_notifications` | All enrolled students |
| Course deleted | `views.py` course_delete | `create_bulk_notifications` | All enrolled students |

### Step 6.4: Email configuration

**`settings.py`:**
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')  # Google App Password
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@elearning.com')
```

### Step 6.5: NotificationViewSet

- List user's notifications (filtered by `recipient=request.user`)
- `mark_read` action — Mark single notification as read
- `mark_all_read` action — Mark all as read

### Step 6.6: Frontend with shared state

- Navbar shows unread count badge
- Notifications page lists all notifications
- **Key pattern:** Use shared state (React Context) for `unreadCount` so marking all read in the Notifications page immediately updates the Navbar badge without a page refresh.

### Step 6.7: Avoiding duplicate notifications

**Bug to watch for:** In the `enroll` action, after `get_or_create`, don't use `if created or enrollment.is_active:` — this always evaluates true for already-enrolled students. Instead, track reactivation separately:
```python
enrollment, created = Enrollment.objects.get_or_create(...)
reactivated = False
if not created and not enrollment.is_active:
    enrollment.is_active = True
    enrollment.save()
    reactivated = True
if created or reactivated:
    create_notification(...)  # Only notify on new or re-activated enrollment
```

**Concepts learned:** Django send_mail, send_mass_mail, SMTP configuration, App Passwords, centralised utility functions, fail_silently for resilience, logging for error tracking, notification event patterns, duplicate notification prevention

---

## Phase 7: Invitation System

**Goal:** Teachers invite users via email with a unique token link.

### Step 7.1: Invitation model

```python
class Invitation(models.Model):
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    email = models.EmailField()
    token = models.CharField(max_length=100, unique=True)
    status = models.CharField(choices=[('pending','Pending'), ('accepted','Accepted'), ('expired','Expired')])
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(48)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)
```

### Step 7.2: Send invitation email

```python
from django.core.mail import send_mail

send_mail(
    subject='You have been invited',
    message=f'Click here to register: {invite_url}',
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=[invitation.email],
)
```

### Step 7.3: Public invite endpoints (no auth required)

- `GET /api/invite/<token>/` — Validate token, return invitation data
- `POST /api/invite/<token>/accept/` — Create user account from invitation

### Step 7.4: Bulk CSV upload

- Teacher uploads CSV with columns: full_name, email, user_type, etc.
- Backend parses CSV, validates each row, creates Invitation + sends email
- Returns success/error report per row

### Step 7.5: Frontend pages

- `InvitationList.tsx` — Table of sent invitations with Resend/Delete buttons
- `InviteSingle.tsx` — Form to invite one user
- `InviteBulk.tsx` — CSV drag-and-drop upload with downloadable template
- `AcceptInvitation.tsx` — Public page where invited user creates their account

**Concepts learned:** Token generation (secrets module), Django send_mail, SMTP configuration, App Passwords, CSV parsing, public vs authenticated endpoints, custom permission classes (IsTeacher)

---

## Phase 8: AI-Powered Assignment Generation

**Goal:** Teacher uploads PDF, AI generates quiz or flashcard set.

### Step 8.1: Assignment models

```python
class Assignment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    assignment_type = models.CharField(choices=[('quiz','Quiz'), ('flashcard','Flashcard')])
    content = models.JSONField()  # Stores questions/cards as JSON
    source_file = models.FileField(upload_to='assignments/')
    deadline = models.DateTimeField(null=True, blank=True)

class AssignmentSubmission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    answers = models.JSONField()  # List of selected answer indices
    score = models.IntegerField(null=True)
```

### Step 8.2: PDF text extraction

```python
from pypdf import PdfReader
import io

def extract_pdf_text(file_obj):
    file_obj.seek(0)
    reader = PdfReader(io.BytesIO(file_obj.read()))
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    return text
```

### Step 8.3: OpenAI API call

```python
import urllib.request, json

def call_openai(api_key, prompt):
    url = 'https://api.openai.com/v1/chat/completions'
    payload = json.dumps({
        'model': 'gpt-3.5-turbo',
        'messages': [{'role': 'user', 'content': prompt}],
    }).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        return data['choices'][0]['message']['content']
```

### Step 8.4: Generate endpoint

```python
@action(detail=False, methods=['post'])
def generate(self, request):
    # 1. Validate: teacher only, has API key, PDF file provided
    # 2. Extract text from PDF (truncate to ~12000 chars)
    # 3. Build prompt asking for quiz or flashcard JSON
    # 4. Call OpenAI API
    # 5. Parse JSON response (handle markdown code blocks)
    # 6. Save Assignment with content JSON
    # 7. Send deadline notifications if deadline set
```

**Quiz JSON format:**
```json
{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0}]}
```

**Flashcard JSON format:**
```json
{"cards": [{"front": "term", "back": "definition"}]}
```

### Step 8.5: Auto-scoring quiz submissions with scoped access

```python
class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = AssignmentSubmission.objects.select_related('assignment', 'student')
        if self.request.user.is_student():
            qs = qs.filter(student=self.request.user)
        elif self.request.user.is_teacher():
            qs = qs.filter(assignment__course__teacher=self.request.user)
        return qs

    def perform_create(self, serializer):
        # Verify student is enrolled in the course
        assignment = serializer.validated_data.get('assignment')
        if assignment and not Enrollment.objects.filter(
            student=self.request.user, course=assignment.course, is_active=True
        ).exists():
            raise PermissionDenied('You must be enrolled in this course to submit.')
        submission = serializer.save(student=self.request.user)
        questions = submission.assignment.content.get('questions', [])
        answers = submission.answers
        correct = sum(1 for i, q in enumerate(questions)
                      if i < len(answers) and answers[i] == q.get('correct'))
        submission.score = int((correct / len(questions)) * 100)
        submission.save()
        # Notify teacher
        create_notification(
            recipient=submission.assignment.course.teacher,
            notification_type='general',
            title=f'New submission for {submission.assignment.title}',
            message=f'{self.request.user.username} submitted...',
        )
```

**Important:** Teachers should only see submissions for their own courses (`assignment__course__teacher=request.user`), not all submissions in the system.

### Step 8.6: Frontend AssignmentView

- **Quiz mode:** Multiple-choice questions, submit answers, show score
- **Flashcard mode:** Flip card animation (CSS transform), front/back
- Teacher can edit questions/cards inline
- Teacher sees all student submissions in a table

**Concepts learned:** JSONField, OpenAI API, PDF text extraction, prompt engineering, JSON parsing, auto-scoring logic, CSS flip animation, per-user API keys, queryset scoping for multi-tenancy

---

## Phase 9: Real-time Chat (WebSocket)

**Goal:** Live chat in classroom rooms using WebSocket with access control.

### Step 9.1: Install Channels + Redis

```bash
pip install channels channels-redis daphne redis
```

Add to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

### Step 9.2: Configure ASGI

**`settings.py`:**
```python
INSTALLED_APPS = ['daphne', ..., 'channels']
ASGI_APPLICATION = 'elearning_project.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {"hosts": [("redis", 6379)]},
    },
}
```

**`asgi.py`:**
```python
from channels.routing import ProtocolTypeRouter, URLRouter

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": TokenAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
```

### Step 9.3: Switch from runserver to Daphne

**Dockerfile CMD:**
```dockerfile
CMD ["daphne", "-b", "0.0.0.0", "-p", "8080", "elearning_project.asgi:application"]
```

Daphne is an ASGI server that handles both HTTP and WebSocket connections (unlike Django's built-in runserver which only handles HTTP).

### Step 9.4: Chat models

```python
class Classroom(models.Model):
    name = models.CharField(max_length=100)
    participants = models.ManyToManyField(User)
    whiteboard_data = models.TextField(default='[]')

class ClassroomMessage(models.Model):
    room = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Step 9.5: Chat API with access control

```python
class ClassroomViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # Users only see rooms they participate in
        return Classroom.objects.filter(participants=self.request.user)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room = self.get_object()
        if request.user not in room.participants.all():
            return Response({'error': 'Not a participant'}, status=403)
        messages = room.messages.select_related('sender').order_by('-created_at')[:100]
        return Response(ClassroomMessageSerializer(reversed(list(messages)), many=True).data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        room = self.get_object()
        if request.user not in room.participants.all():
            return Response({'error': 'Not a participant'}, status=403)
        content = request.data.get('content', '').strip()
        if len(content) > 5000:
            return Response({'detail': 'Message too long'}, status=400)
        msg = ClassroomMessage.objects.create(room=room, sender=request.user, content=content)
        return Response(ClassroomMessageSerializer(msg).data, status=201)
```

**Important access control points:**
- `get_queryset` filters rooms to participant-only visibility
- `messages` and `send` verify participation before allowing access
- `select_related('sender')` prevents N+1 queries when loading messages
- Message length capped at 5000 characters

### Step 9.6: WebSocket Consumer with access control

**`classroom/consumers.py`:**
```python
class ClassroomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Verify room exists and user is a participant
        if not await self.is_participant(self.user.id, self.room_name):
            await self.close()
            return

        await self.channel_layer.group_add(f'classroom_{self.room_name}', self.channel_name)
        await self.accept()

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('type') == 'chat':
            message = data.get('message', '')
            if message.strip() and len(message) <= 5000:
                await self.save_message(self.user.id, self.room_name, message)
                await self.channel_layer.group_send(...)

    @database_sync_to_async
    def is_participant(self, user_id, room_name):
        room = Classroom.objects.filter(name=room_name).first()
        if not room:
            return False
        return room.participants.filter(id=user_id).exists()
```

**Critical:** Always verify participation on WebSocket connect. Without this, any authenticated user could access any chat room by guessing the room name.

### Step 9.7: WebSocket routing

**`classroom/routing.py`:**
```python
websocket_urlpatterns = [
    path('ws/classroom/<str:room_name>/', ClassroomConsumer.as_asgi()),
]
```

### Step 9.8: Token-based WebSocket auth

WebSocket doesn't support HTTP headers, so pass token as query parameter:
```
ws://localhost:8080/ws/classroom/room1/?token=abc123
```

Create custom middleware to extract token and set `scope['user']`.

### Step 9.9: Frontend WebSocket

```typescript
const ws = new WebSocket(`ws://localhost:8080/ws/classroom/${roomName}/?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setClassroomMessages(prev => [...prev, data]);
};

const sendMessage = (text: string) => {
  ws.send(JSON.stringify({ type: 'chat', message: text }));
};
```

**Concepts learned:** ASGI vs WSGI, Daphne server, Django Channels, Redis channel layer, WebSocket Consumer, group_send/group_add, WebSocket routing, token auth for WebSocket, participant-based access control, select_related for N+1 prevention, message length validation, frontend WebSocket API

---

## Phase 10: Interactive Whiteboard

**Goal:** Teacher draws on canvas, all students see it in real-time.

### Step 10.1: HTML Canvas basics

```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);
const ctx = canvasRef.current?.getContext('2d');

// Draw a line
ctx.beginPath();
ctx.moveTo(x1, y1);
ctx.lineTo(x2, y2);
ctx.stroke();
```

### Step 10.2: Mouse event handling

- `onMouseDown` — Start drawing, record start position
- `onMouseMove` — Draw while mouse is held down
- `onMouseUp` — Finish drawing, send shape via WebSocket

### Step 10.3: Drawing tools

Implement tool modes: pen (freehand), line, text, eraser, move
- **Pen:** Collect points on mousemove, draw path
- **Line:** Record start on mousedown, draw on mouseup
- **Text:** Prompt for input, place on canvas
- **Eraser:** Draw with white color / remove objects
- **Move:** Detect click on existing object, reposition

### Step 10.4: Broadcast via WebSocket

When teacher draws, send normalized coordinates:
```json
{
  "type": "draw",
  "points": [[0.1, 0.2], [0.15, 0.25]],
  "color": "#ff0000",
  "width": 3
}
```

Use normalized coordinates (0-1 range) so different screen sizes render correctly.

### Step 10.5: Persist whiteboard state with size limit

Store whiteboard objects in `Classroom.whiteboard_data` (JSON field) so late joiners can see existing drawings. **Cap at 500 actions** to prevent unbounded growth:

```python
MAX_WHITEBOARD_ACTIONS = 500

@database_sync_to_async
def append_whiteboard_action(self, room_name, action):
    room = find_room(room_name)
    actions = json.loads(room.whiteboard_data) if room.whiteboard_data else []
    if len(actions) >= self.MAX_WHITEBOARD_ACTIONS:
        actions = actions[-(self.MAX_WHITEBOARD_ACTIONS - 1):]  # Drop oldest
    actions.append(action)
    room.whiteboard_data = json.dumps(actions)
    room.save(update_fields=['whiteboard_data'])
```

**Concepts learned:** HTML Canvas API, mouse events, coordinate normalization, real-time drawing sync, tool state management, data size limits to prevent unbounded growth

---

## Phase 11: Audio Streaming

**Goal:** Teacher streams microphone audio to students in real-time.

### Step 11.1: Capture microphone

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);
```

### Step 11.2: Process and send audio

- Downsample from browser's sample rate (typically 44.1kHz/48kHz) to 16kHz
- Convert Float32 samples to Int16 PCM
- Base64 encode the PCM data
- Send via WebSocket

### Step 11.3: Student playback

- Receive base64 audio chunks
- Decode to PCM samples
- Create AudioBuffer and play via AudioContext
- Queue chunks for smooth playback

**Concepts learned:** Web Audio API, getUserMedia, AudioContext, PCM audio, sample rate conversion, base64 encoding, audio buffering

---

## Phase 12: Profile Photos

**Goal:** Users upload profile photos, displayed across the app.

### Step 12.1: Add photo field to User model

```python
photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
```

Requires: `pip install Pillow`

### Step 12.2: Upload via multipart form

**Backend:** Add `MultiPartParser` to the update_profile endpoint.

**Frontend:**
```typescript
const formData = new FormData();
formData.append('photo', file);
await client.patch('/users/update_profile/', formData);
```

### Step 12.3: Return absolute URLs

**Key gotcha:** When frontend and backend run on different ports, DRF's ImageField returns relative URLs (`/media/photo.jpg`) unless you pass `context={'request': request}` to the serializer. Always pass request context so the URL includes the full host (`http://localhost:8080/media/photo.jpg`).

### Step 12.4: Display photos everywhere

Check every page that shows user info (Home, Navbar, Profile, search results) and add:
```tsx
{user.photo ? (
  <img src={user.photo} className="rounded-circle" style={{ width: 60, height: 60 }} />
) : (
  <div className="bg-primary rounded-circle">
    <span>{user.username.charAt(0).toUpperCase()}</span>
  </div>
)}
```

**Concepts learned:** ImageField, Pillow, multipart upload, serializer context for absolute URLs, fallback avatars

---

## Phase 13: Status Updates (Social Feed)

**Goal:** Users post status updates visible on the home page.

### Step 13.1: StatusUpdate model

```python
class StatusUpdate(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='status_updates')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Step 13.2: StatusUpdateViewSet

Simple CRUD — users can only see/edit their own status updates.

### Step 13.3: Frontend feed

- Input field + Post button
- After posting, prepend new status to the list (no page refresh needed)
- Show username + timestamp with each status

**Concepts learned:** Simple CRUD viewset, related_name, optimistic UI updates

---

## Phase 14: Testing

**Goal:** Comprehensive back-end test suite covering models, APIs, permissions, and edge cases.

### Step 14.1: Test structure

Each app has a `tests.py` with test classes inheriting from `TestCase` or `APITestCase`:

```python
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

class CourseAPITest(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(username='t1', password='p', user_type='teacher')
        self.student = User.objects.create_user(username='s1', password='p', user_type='student')
        self.token = Token.objects.create(user=self.teacher)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
```

### Step 14.2: What to test

- **Model tests:** String representations, default values, model methods, unique constraints
- **API positive paths:** Create, list, retrieve, update, delete with correct permissions
- **API negative paths:** Permission denied (403), invalid data (400), not found (404)
- **Permission tests:** Every restricted action tested with both authorized and unauthorized users
- **Edge cases:** Re-enrollment after blocking, expired tokens, duplicate submissions, CSV with invalid data
- **Email tests:** Use `unittest.mock.patch` to mock `send_mail` and verify it's called correctly

### Step 14.3: Mock testing for email

```python
from unittest.mock import patch

@patch('notifications.utils.send_mail')
def test_creates_notification_and_sends_email(self, mock_send):
    create_notification(recipient=self.user, ...)
    self.assertEqual(Notification.objects.count(), 1)
    mock_send.assert_called_once()

@patch('notifications.utils.send_mail', side_effect=Exception('SMTP down'))
def test_email_failure_does_not_crash(self, mock_send):
    n = create_notification(recipient=self.user, ...)
    self.assertIsNotNone(n)  # Notification still created despite email failure
```

### Step 14.4: Running tests

```bash
docker compose exec backend python manage.py test              # All 132 tests
docker compose exec backend python manage.py test accounts     # 79 tests
docker compose exec backend python manage.py test courses      # 31 tests
docker compose exec backend python manage.py test classroom         # 9 tests
docker compose exec backend python manage.py test notifications # 13 tests
```

**Concepts learned:** Django TestCase, DRF APITestCase, setUp for test isolation, Token authentication in tests, unittest.mock.patch, testing email without SMTP, permission testing patterns, edge case coverage

---

## Phase 15: API Documentation (Swagger / OpenAPI)

**Goal:** Auto-generate interactive API documentation from existing ViewSets and serializers.

### Step 15.1: Install drf-spectacular

```bash
pip install drf-spectacular
```

Add to `requirements.txt`:
```
drf-spectacular==0.28.0
```

### Step 15.2: Configure settings

**`settings.py`:**
```python
INSTALLED_APPS = [
    ...
    'drf_spectacular',
]

REST_FRAMEWORK = {
    ...
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'eLearning Platform API',
    'DESCRIPTION': 'API for the eLearning platform with courses, classrooms, assignments, and notifications.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
```

### Step 15.3: Add URL patterns

**`urls.py`:**
```python
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    ...
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
```

### Step 15.4: Verify

Visit:
- `http://localhost:8080/api/docs/` — Swagger UI (interactive, can test endpoints)
- `http://localhost:8080/api/redoc/` — ReDoc (clean reading layout)
- `http://localhost:8080/api/schema/` — Raw OpenAPI 3.0 JSON schema

The documentation is generated automatically from ViewSet definitions, serializer fields, and URL routing. No manual documentation is required — when you add or modify a ViewSet, the docs update automatically.

**Concepts learned:** OpenAPI 3.0, Swagger UI, automatic schema generation, API documentation best practices

---

## Architecture: Model → Serializer → ViewSet

This section explains the three-layer architecture pattern used throughout the Django back-end, why it exists, and how the layers interact.

### Why Three Layers?

Django REST Framework applications separate concerns into three layers:

```
HTTP Request → ViewSet → Serializer → Model → Database
HTTP Response ← ViewSet ← Serializer ← Model ← Database
```

Each layer has a single responsibility. This separation makes the code easier to test, maintain, and extend.

### Layer 1: Model — What Data Exists

Models define database tables, fields, relationships, and constraints. They are the single source of truth for data structure.

```python
class Course(models.Model):
    title = models.CharField(max_length=200)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=20, unique=True)
```

**Models do NOT know about:** HTTP requests, JSON, authentication, or who is asking for data.

**Why?** The same model is used by the REST API, Django Admin, management commands, WebSocket consumers, and tests. If models depended on HTTP requests, none of these other contexts would work.

### Layer 2: Serializer — What Data is Exposed

Serializers control the translation between Python objects and JSON. They handle:

1. **Output shaping** — Deciding which fields to include in the API response
2. **Computed fields** — Adding derived data that isn't stored in the database
3. **Input validation** — Checking incoming data before it reaches the model

```python
class CourseSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'title', 'code', 'teacher', 'teacher_name', 'enrolled_count']

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() or obj.teacher.username

    def get_enrolled_count(self, obj):
        return obj.enrollment_set.filter(is_active=True).count()
```

**Why not put computed fields in the model?** Fields like `enrolled_count` depend on the context. The admin might want different computed fields than the API. By keeping them in the serializer, each API consumer can have its own view of the data without polluting the model.

**Why not validate in the model?** Models enforce database constraints (unique, not null). Serializers enforce API constraints (password confirmation, checking if an email is already invited, cross-field validation). Different contexts (API vs admin vs CLI) may have different validation needs.

### Layer 3: ViewSet — Who Can Do What

ViewSets handle authentication, permissions, business logic, and queryset scoping:

```python
class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.select_related('teacher')

    def perform_create(self, serializer):
        if not self.request.user.is_teacher():
            raise PermissionDenied('Only teachers can create courses.')
        serializer.save(teacher=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.teacher != self.request.user:
            raise PermissionDenied('You can only edit your own courses.')
        serializer.save()
```

**Why not put permissions in the serializer?** Serializers validate data shape and content. They should not care about *who* is sending the data. The same serializer might be used in a management command where there is no HTTP request and no concept of "the current user."

**Why not put business logic in the model?** `request.user` is an HTTP concept. Models should not depend on the request context. By keeping permission checks in the ViewSet, models remain portable and testable without mocking HTTP requests.

### How They Work Together

**Example: Creating a course (POST /api/courses/)**

1. **ViewSet** receives the POST request, checks the user is authenticated
2. **ViewSet.perform_create()** checks `request.user.is_teacher()`, raises 403 if not
3. **Serializer** validates the incoming JSON (title required, code unique, etc.)
4. **Serializer.save()** calls `Model.save()` with `teacher=request.user`
5. **Model** writes the row to the database
6. **Serializer** converts the saved model to JSON, computing `teacher_name` and `enrolled_count`
7. **ViewSet** returns the JSON with status 201

**Example: Listing feedback (GET /api/feedback/?course=1)**

1. **ViewSet.get_queryset()** checks the user's role:
   - Student → filter to enrolled courses only
   - Teacher → filter to own courses only
2. **ViewSet** applies query parameter filtering (`course=1`)
3. **Serializer** converts each Feedback object to JSON with `student_name`
4. **ViewSet** returns the JSON list with status 200

### Testing Each Layer Independently

- **Model tests** — verify data integrity, constraints, and model methods without any HTTP
- **Serializer tests** — verify JSON shape, computed fields, and validation without any permissions
- **ViewSet tests** — verify permissions, HTTP status codes, and business logic using DRF's `APITestCase`

This separation is why the project has 132 tests that are each focused and fast.

---

## Implementation Order Summary

| Phase | Feature | New Concepts |
|-------|---------|-------------|
| 1 | Docker + project setup | Docker, Compose, volumes, .dockerignore, Vite, Django |
| 2 | Authentication | Custom User, Token auth, Context, Protected routes |
| 3 | Course CRUD + enrollment | Models, ViewSets, Router, ForeignKey, ownership checks |
| 4 | File uploads | FileField, MediaRoot, MultiPartParser, FormData |
| 5 | Feedback & ratings | Query filtering, unique_together, select_related |
| 6 | Notifications + email | send_mail, send_mass_mail, SMTP, utility functions, duplicate prevention |
| 7 | Invitations | Token generation, CSV parsing, public endpoints |
| 8 | AI assignments | OpenAI API, JSONField, PDF extraction, auto-scoring, queryset scoping |
| 9 | WebSocket chat | ASGI, Channels, Redis, Consumer, WS auth, access control |
| 10 | Whiteboard | Canvas API, mouse events, coordinate normalization, size limits |
| 11 | Audio streaming | Web Audio API, PCM, base64, getUserMedia |
| 12 | Profile photos | ImageField, Pillow, serializer context, absolute URLs |
| 13 | Status feed | Simple CRUD, related_name, social features |
| 14 | Testing | TestCase, APITestCase, mock.patch, permission testing |
| 15 | API documentation | drf-spectacular, OpenAPI 3.0, Swagger UI, ReDoc |

---

## Key Patterns to Remember

### 1. SPA State Updates
After any mutation (POST/PATCH/DELETE), always update the frontend state immediately:
```typescript
// Good — update state after successful API call
const res = await client.post('/feedback/', data);
setFeedbacks([...feedbacks, res.data]);

// Bad — requires page refresh to see changes
await client.post('/feedback/', data);
```

### 2. Serializer Context
Always pass `context={'request': request}` when manually creating serializers (outside of ViewSet's default methods). This ensures file URLs are absolute:
```python
# Good
serializer = UserSerializer(user, context={'request': request})

# Bad — photo URLs will be relative (/media/...)
serializer = UserSerializer(user)
```

### 3. ViewSet Queryset vs get_queryset
When you need dynamic filtering, override `get_queryset()` instead of setting class-level `queryset`. But remember to add `basename` to the router:
```python
router.register(r'feedback', FeedbackViewSet, basename='feedback')
```

### 4. Object-Level Permissions
Always check ownership in `perform_update` and `perform_destroy`:
```python
def perform_update(self, serializer):
    if serializer.instance.teacher != self.request.user:
        raise PermissionDenied('You can only edit your own courses.')
    serializer.save()
```

### 5. Docker Container Updates
- **Code changes (volume-mounted):** Backend auto-reloads; or `docker restart <container>`
- **Environment variable changes (.env):** Must `docker compose up -d --force-recreate <service>`
- **Dependency changes (requirements.txt/package.json):** Must `docker compose up --build`

### 6. WebSocket + REST Fallback
Always implement a REST API fallback for WebSocket features, so the app still works if WebSocket connection fails:
```typescript
if (ws?.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({ type: 'chat', message: text }));
} else {
  await client.post(`/classrooms/${roomId}/send/`, { content: text });
}
```

### 7. Permission Checks at Every Layer
Always enforce permissions server-side, never rely on the frontend hiding buttons:
```python
# In perform_create — check role AND ownership
def perform_create(self, serializer):
    if not self.request.user.is_teacher():
        raise PermissionDenied('Only teachers can create assignments.')
    course = serializer.validated_data.get('course')
    if course and course.teacher != self.request.user:
        raise PermissionDenied('You can only create assignments for your own courses.')
    serializer.save(created_by=self.request.user)

# In get_queryset — scope data to prevent leakage
def get_queryset(self):
    if self.request.user.is_student():
        enrolled = Enrollment.objects.filter(student=self.request.user, is_active=True)
        return Assignment.objects.filter(course__in=enrolled.values('course'))
    elif self.request.user.is_teacher():
        return Assignment.objects.filter(course__teacher=self.request.user)
```

A student bypassing the frontend and making a direct API request (e.g. via curl or Postman) should still be denied. This is why `perform_create` checks the user's role even though the frontend only shows the "Create" button to teachers.

### 8. Prevent N+1 Queries
Always use `select_related` when you'll access ForeignKey fields:
```python
# Good — 1 query with JOIN
messages = room.messages.select_related('sender').order_by('-created_at')[:100]

# Bad — 1 query for messages + 1 query per message to get sender
messages = room.messages.order_by('-created_at')[:100]
```
