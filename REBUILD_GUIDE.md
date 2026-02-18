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
| Email | Gmail SMTP / Mailhog | Invitation emails |
| AI | OpenAI API (gpt-3.5-turbo) | Quiz/flashcard generation from PDF |
| PDF | pypdf | Text extraction from uploaded PDFs |

---

## Phase 1: Project Setup & Docker

**Goal:** Set up the project skeleton with Docker so backend and frontend can run together.

### Step 1.1: Create project structure

```
elearning/
├── backend/
├── frontend/
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

### Step 1.5: Write docker-compose.yml

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

### Step 1.6: Write .env file

```env
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
VITE_API_URL=http://localhost:8080/api
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Step 1.7: Verify

```bash
docker compose up --build
```
- Backend at http://localhost:8080
- Frontend at http://localhost:5173

**Concepts learned:** Docker, Docker Compose, volumes, environment variables, Vite, Django project structure, CORS

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
- `auth_login` — Authenticates user, returns Token
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

### Step 3.2: Create CourseViewSet with actions

**`courses/api.py`:**
- Standard CRUD via `ModelViewSet`
- `@action enroll` — Student enrolls (get_or_create Enrollment)
- `@action unenroll` — Student unenrolls (set is_active=False)
- `@action students` — List enrolled students
- `@action add_student` — Teacher force-adds a student

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

**Concepts learned:** Django models, ForeignKey, unique_together, ModelViewSet, @action decorator, DRF Router, GET/POST/PATCH/DELETE, React state management

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

### Step 4.3: API with MultiPartParser

```python
class CourseMaterialViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, JSONParser]
```

### Step 4.4: Frontend upload UI

- Use `FormData` to send files via Axios
- Drag-and-drop zone with file type validation
- Display uploaded materials as a list with download links

**Concepts learned:** FileField, MEDIA_ROOT/MEDIA_URL, MultiPartParser, FormData, multipart/form-data, static file serving in Django

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

### Step 5.2: FeedbackViewSet with filtering

```python
class FeedbackViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = Feedback.objects.all()
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs
```

**Important:** When using `get_queryset()` instead of class-level `queryset`, you must pass `basename` to `router.register()`.

### Step 5.3: Frontend feedback section

- Star rating selector (1-5)
- Comment textarea
- Submit → POST `/api/feedback/`
- Display existing feedback with average rating
- **Key SPA pattern:** After submitting, append new feedback to state immediately (don't wait for page refresh)

**Concepts learned:** Query parameter filtering, get_queryset vs queryset, basename in router, unique_together for one-review-per-student, optimistic UI updates

---

## Phase 6: Notifications

**Goal:** Auto-notify students about enrollments, deadlines, new materials.

### Step 6.1: Notification model

```python
class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE)
    notification_type = models.CharField(choices=[...])
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
```

### Step 6.2: Create notifications from other actions

When a student is enrolled:
```python
Notification.objects.create(
    recipient=student,
    notification_type='enrollment',
    title=f'Added to {course.title}',
    message='You have been added to...',
    link=f'/courses/{course.id}',
)
```

### Step 6.3: NotificationViewSet

- List user's notifications
- `mark_read` action — Mark single notification as read
- `mark_all_read` action — Mark all as read

### Step 6.4: Frontend with shared state

- Navbar shows unread count badge
- Notifications page lists all notifications
- **Key pattern:** Use shared state (React Context) for `unreadCount` so marking all read in the Notifications page immediately updates the Navbar badge without a page refresh.

**Concepts learned:** Creating related objects from other views, unread count badge, shared state across components via React Context

---

## Phase 7: Invitation System + Email

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

### Step 7.2: Email configuration

**Development (Mailhog):**
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'mailhog'
EMAIL_PORT = 1025
```

**Production (Gmail SMTP):**
```python
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'  # Google App Password, not regular password
```

### Step 7.3: Send invitation email

```python
from django.core.mail import send_mail

send_mail(
    subject='You have been invited',
    message=f'Click here to register: {invite_url}',
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=[invitation.email],
)
```

### Step 7.4: Public invite endpoints (no auth required)

- `GET /api/invite/<token>/` — Validate token, return invitation data
- `POST /api/invite/<token>/accept/` — Create user account from invitation

### Step 7.5: Bulk CSV upload

- Teacher uploads CSV with columns: full_name, email, user_type, etc.
- Backend parses CSV, validates each row, creates Invitation + sends email
- Returns success/error report

### Step 7.6: Frontend pages

- `InvitationList.tsx` — Table of sent invitations with Resend/Delete buttons
- `InviteSingle.tsx` — Form to invite one user
- `InviteBulk.tsx` — CSV drag-and-drop upload with downloadable template
- `AcceptInvitation.tsx` — Public page where invited user creates their account

**Concepts learned:** Token generation (secrets module), Django send_mail, SMTP configuration, App Passwords, CSV parsing, public vs authenticated endpoints, Mailhog for dev email testing

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
    # 5. Parse JSON response
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

### Step 8.5: Auto-scoring quiz submissions

```python
def perform_create(self, serializer):
    submission = serializer.save(student=self.request.user)
    questions = submission.assignment.content.get('questions', [])
    answers = submission.answers
    correct = sum(1 for i, q in enumerate(questions) if i < len(answers) and answers[i] == q.get('correct'))
    submission.score = int((correct / len(questions)) * 100)
    submission.save()
```

### Step 8.6: Frontend AssignmentView

- **Quiz mode:** Multiple-choice questions, submit answers, show score
- **Flashcard mode:** Flip card animation (CSS transform), front/back
- Teacher can edit questions/cards inline
- Teacher sees all student submissions in a table

**Concepts learned:** JSONField, OpenAI API, PDF text extraction, prompt engineering, JSON parsing, auto-scoring logic, CSS flip animation, per-user API keys

---

## Phase 9: Real-time Chat (WebSocket)

**Goal:** Live chat in classroom rooms using WebSocket.

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
from channels.auth import AuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
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
class ChatRoom(models.Model):
    name = models.CharField(max_length=100)
    participants = models.ManyToManyField(User)

class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### Step 9.5: WebSocket Consumer

**`chat/consumers.py`:**
```python
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.group_name = f'chat_{self.room_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        # Save message to DB, then broadcast
        await self.channel_layer.group_send(self.group_name, {
            'type': 'chat_message',
            'message': content['message'],
            'username': self.scope['user'].username,
        })

    async def chat_message(self, event):
        await self.send_json(event)
```

### Step 9.6: WebSocket routing

**`chat/routing.py`:**
```python
websocket_urlpatterns = [
    path('ws/chat/<int:room_id>/', ChatConsumer.as_asgi()),
]
```

### Step 9.7: Token-based WebSocket auth

WebSocket doesn't support HTTP headers, so pass token as query parameter:
```
ws://localhost:8080/ws/chat/1/?token=abc123
```

Create custom middleware to extract token and set `scope['user']`.

### Step 9.8: Frontend WebSocket

```typescript
const ws = new WebSocket(`ws://localhost:8080/ws/chat/${roomId}/?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setChatMessages(prev => [...prev, data]);
};

const sendMessage = (text: string) => {
  ws.send(JSON.stringify({ type: 'chat', message: text }));
};
```

**Concepts learned:** ASGI vs WSGI, Daphne server, Django Channels, Redis channel layer, WebSocket Consumer, group_send/group_add, WebSocket routing, token auth for WebSocket, frontend WebSocket API

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
  "type": "whiteboard",
  "action": "draw",
  "tool": "pen",
  "points": [[0.1, 0.2], [0.15, 0.25]],
  "color": "#ff0000",
  "lineWidth": 3
}
```

Use normalized coordinates (0-1 range) so different screen sizes render correctly.

### Step 10.5: Persist whiteboard state

Store whiteboard objects in `ChatRoom.whiteboard_data` (JSON field) so late joiners can see existing drawings.

**Concepts learned:** HTML Canvas API, mouse events, coordinate normalization, real-time drawing sync, tool state management

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

## Implementation Order Summary

| Phase | Feature | New Concepts |
|-------|---------|-------------|
| 1 | Docker + project setup | Docker, Compose, Vite, Django |
| 2 | Authentication | Custom User, Token auth, Context, Protected routes |
| 3 | Course CRUD + enrollment | Models, ViewSets, Router, ForeignKey |
| 4 | File uploads | FileField, MediaRoot, MultiPartParser, FormData |
| 5 | Feedback & ratings | Query filtering, unique_together, optimistic updates |
| 6 | Notifications | Cross-model creation, shared Context state, badges |
| 7 | Invitations + email | Token generation, SMTP, CSV parsing, public endpoints |
| 8 | AI assignments | OpenAI API, JSONField, PDF extraction, auto-scoring |
| 9 | WebSocket chat | ASGI, Channels, Redis, Consumer, WS auth |
| 10 | Whiteboard | Canvas API, mouse events, coordinate normalization |
| 11 | Audio streaming | Web Audio API, PCM, base64, getUserMedia |
| 12 | Profile photos | ImageField, Pillow, serializer context, absolute URLs |
| 13 | Status feed | Simple CRUD, related_name, social features |

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

### 4. Docker Container Updates
- **Code changes (volume-mounted):** Backend auto-reloads; or `docker restart <container>`
- **Environment variable changes (.env):** Must `docker compose up -d --force-recreate <service>`
- **Dependency changes (requirements.txt/package.json):** Must `docker compose up --build`

### 5. WebSocket + REST Fallback
Always implement a REST API fallback for WebSocket features, so the app still works if WebSocket connection fails:
```typescript
if (ws?.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({ type: 'chat', message: text }));
} else {
  await client.post(`/chatrooms/${roomId}/send/`, { content: text });
}
```
