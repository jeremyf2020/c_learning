#!/bin/bash
# Generates the complete rebuild guide with all code blocks from the actual source files
# Usage: bash generate_rebuild_guide.sh > REBUILD_GUIDE.md

cd "$(dirname "$0")"

cat << 'HEADER'
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
mkdir -p elearning/backend/elearning_project
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
HEADER

echo '```'
cat .gitignore
echo '```'

cat << 'SECTION'

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
SECTION

echo '```yaml'
cat docker-compose.yml
echo '```'

cat << 'SECTION'

### 1.4 `backend/Dockerfile`
SECTION

echo '```dockerfile'
cat backend/Dockerfile
echo '```'

cat << 'SECTION'

### 1.5 `backend/requirements.txt`
SECTION

echo '```'
cat backend/requirements.txt
echo '```'

cat << 'SECTION'

### 1.6 `backend/manage.py`
SECTION

echo '```python'
cat backend/manage.py
echo '```'

cat << 'SECTION'

### 1.7 `frontend/Dockerfile`
SECTION

echo '```dockerfile'
cat frontend/Dockerfile
echo '```'

cat << 'SECTION'

### 1.8 `frontend/package.json`
SECTION

echo '```json'
cat frontend/package.json
echo '```'

cat << 'SECTION'

### 1.9 `frontend/index.html`
SECTION

echo '```html'
cat frontend/index.html
echo '```'

cat << 'SECTION'

### 1.10 `frontend/.env`
SECTION

echo '```'
cat frontend/.env
echo '```'

cat << 'SECTION'

### 1.11 `frontend/vite.config.ts`
SECTION

echo '```typescript'
cat frontend/vite.config.ts
echo '```'

cat << 'SECTION'

### 1.12 `frontend/tsconfig.json`
SECTION

echo '```json'
cat frontend/tsconfig.json
echo '```'

cat << 'SECTION'

### 1.13 `frontend/jest.config.ts`
SECTION

echo '```typescript'
cat frontend/jest.config.ts
echo '```'

cat << 'SECTION'

### Checkpoint 1
```bash
docker compose build
# Both images should build successfully
```

---

## Step 2: Django Project Configuration

### 2.1 `backend/elearning_project/__init__.py`
```python
# Empty file — just create it
```

### 2.2 `backend/elearning_project/settings.py`
SECTION

echo '```python'
cat backend/elearning_project/settings.py
echo '```'

cat << 'SECTION'

### 2.3 `backend/elearning_project/wsgi.py`
SECTION

echo '```python'
cat backend/elearning_project/wsgi.py
echo '```'

cat << 'SECTION'

### 2.4 `backend/elearning_project/asgi.py`
SECTION

echo '```python'
cat backend/elearning_project/asgi.py
echo '```'

cat << 'SECTION'

### 2.5 `backend/elearning_project/urls.py`
SECTION

echo '```python'
cat backend/elearning_project/urls.py
echo '```'

cat << 'SECTION'

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
SECTION

echo '```python'
cat backend/accounts/apps.py
echo '```'

cat << 'SECTION'

### 3.2 `backend/accounts/models.py`
SECTION

echo '```python'
cat backend/accounts/models.py
echo '```'

cat << 'SECTION'

### 3.3 `backend/accounts/serializers.py`
SECTION

echo '```python'
cat backend/accounts/serializers.py
echo '```'

cat << 'SECTION'

### 3.4 `backend/accounts/api.py`
SECTION

echo '```python'
cat backend/accounts/api.py
echo '```'

cat << 'SECTION'

### 3.5 `backend/accounts/admin.py`
SECTION

echo '```python'
cat backend/accounts/admin.py
echo '```'

cat << 'SECTION'

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
SECTION

echo '```python'
cat backend/courses/apps.py
echo '```'

cat << 'SECTION'

### 4.2 `backend/courses/models.py`
SECTION

echo '```python'
cat backend/courses/models.py
echo '```'

cat << 'SECTION'

### 4.3 `backend/courses/serializers.py`
SECTION

echo '```python'
cat backend/courses/serializers.py
echo '```'

cat << 'SECTION'

### 4.4 `backend/courses/api.py`
SECTION

echo '```python'
cat backend/courses/api.py
echo '```'

cat << 'SECTION'

### 4.5 `backend/courses/admin.py`
SECTION

echo '```python'
cat backend/courses/admin.py
echo '```'

cat << 'SECTION'

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
SECTION

echo '```python'
cat backend/classroom/apps.py
echo '```'

cat << 'SECTION'

### 5.2 `backend/classroom/models.py`
SECTION

echo '```python'
cat backend/classroom/models.py
echo '```'

cat << 'SECTION'

### 5.3 `backend/classroom/serializers.py`
SECTION

echo '```python'
cat backend/classroom/serializers.py
echo '```'

cat << 'SECTION'

### 5.4 `backend/classroom/api.py`
SECTION

echo '```python'
cat backend/classroom/api.py
echo '```'

cat << 'SECTION'

### 5.5 `backend/classroom/middleware.py`
SECTION

echo '```python'
cat backend/classroom/middleware.py
echo '```'

cat << 'SECTION'

### 5.6 `backend/classroom/routing.py`
SECTION

echo '```python'
cat backend/classroom/routing.py
echo '```'

cat << 'SECTION'

### 5.7 `backend/classroom/consumers.py`
SECTION

echo '```python'
cat backend/classroom/consumers.py
echo '```'

cat << 'SECTION'

### 5.8 `backend/classroom/admin.py`
SECTION

echo '```python'
cat backend/classroom/admin.py
echo '```'

cat << 'SECTION'

---

## Step 6: Notifications App

Create empty files:
```bash
touch backend/notifications/__init__.py
touch backend/notifications/migrations/__init__.py
touch backend/notifications/views.py
```

### 6.1 `backend/notifications/apps.py`
SECTION

echo '```python'
cat backend/notifications/apps.py
echo '```'

cat << 'SECTION'

### 6.2 `backend/notifications/models.py`
SECTION

echo '```python'
cat backend/notifications/models.py
echo '```'

cat << 'SECTION'

### 6.3 `backend/notifications/serializers.py`
SECTION

echo '```python'
cat backend/notifications/serializers.py
echo '```'

cat << 'SECTION'

### 6.4 `backend/notifications/api.py`
SECTION

echo '```python'
cat backend/notifications/api.py
echo '```'

cat << 'SECTION'

### 6.5 `backend/notifications/utils.py`
SECTION

echo '```python'
cat backend/notifications/utils.py
echo '```'

cat << 'SECTION'

### 6.6 `backend/notifications/admin.py`
SECTION

echo '```python'
cat backend/notifications/admin.py
echo '```'

cat << 'SECTION'

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
SECTION

echo '```csv'
cat backend/seed_data/users.csv
echo '```'

cat << 'SECTION'

### 7.2 `backend/seed_data/courses.csv`
SECTION

echo '```csv'
cat backend/seed_data/courses.csv
echo '```'

cat << 'SECTION'

### 7.3 `backend/seed_data/enrollments.csv`
SECTION

echo '```csv'
cat backend/seed_data/enrollments.csv
echo '```'

cat << 'SECTION'

### 7.4 `backend/seed_data/feedback.csv`
SECTION

echo '```csv'
cat backend/seed_data/feedback.csv
echo '```'

cat << 'SECTION'

### 7.5 `backend/seed_data/status_updates.csv`
SECTION

echo '```csv'
cat backend/seed_data/status_updates.csv
echo '```'

cat << 'SECTION'

### 7.6 `backend/seed_data/invitations.csv`
SECTION

echo '```csv'
cat backend/seed_data/invitations.csv
echo '```'

cat << 'SECTION'

### 7.7 `backend/accounts/management/commands/populate_db.py`
SECTION

echo '```python'
cat backend/accounts/management/commands/populate_db.py
echo '```'

cat << 'SECTION'

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
SECTION

echo '```typescript'
cat frontend/src/types/index.ts
echo '```'

cat << 'SECTION'

### 8.4 `frontend/src/api/client.ts`
SECTION

echo '```typescript'
cat frontend/src/api/client.ts
echo '```'

cat << 'SECTION'

### 8.5 `frontend/src/context/AuthContext.tsx`
SECTION

echo '```tsx'
cat frontend/src/context/AuthContext.tsx
echo '```'

cat << 'SECTION'

---

## Step 9: Frontend — Theme & Styling

### 9.1 `frontend/src/theme.css`
SECTION

echo '```css'
cat frontend/src/theme.css
echo '```'

cat << 'SECTION'

---

## Step 10: Frontend — Components (Navbar, ProtectedRoute)

### 10.1 `frontend/src/components/Navbar.tsx`
SECTION

echo '```tsx'
cat frontend/src/components/Navbar.tsx
echo '```'

cat << 'SECTION'

### 10.2 `frontend/src/components/ProtectedRoute.tsx`
SECTION

echo '```tsx'
cat frontend/src/components/ProtectedRoute.tsx
echo '```'

cat << 'SECTION'

---

## Step 11: Frontend — Auth Pages (Login, Register, AcceptInvitation)

### 11.1 `frontend/src/pages/Login.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/Login.tsx
echo '```'

cat << 'SECTION'

### 11.2 `frontend/src/pages/Register.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/Register.tsx
echo '```'

cat << 'SECTION'

### 11.3 `frontend/src/pages/AcceptInvitation.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/AcceptInvitation.tsx
echo '```'

cat << 'SECTION'

---

## Step 12: Frontend — Home Pages (Student & Teacher)

### 12.1 `frontend/src/pages/StudentHome.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/StudentHome.tsx
echo '```'

cat << 'SECTION'

### 12.2 `frontend/src/pages/TeacherHome.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/TeacherHome.tsx
echo '```'

cat << 'SECTION'

---

## Step 13: Frontend — Profile & Course Pages

### 13.1 `frontend/src/pages/Profile.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/Profile.tsx
echo '```'

cat << 'SECTION'

### 13.2 `frontend/src/pages/CourseCreate.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/CourseCreate.tsx
echo '```'

cat << 'SECTION'

### 13.3 `frontend/src/pages/CourseDetail.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/CourseDetail.tsx
echo '```'

cat << 'SECTION'

---

## Step 14: Frontend — Assignment & Classroom Pages

### 14.1 `frontend/src/pages/AssignmentView.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/AssignmentView.tsx
echo '```'

cat << 'SECTION'

### 14.2 `frontend/src/pages/Classroom.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/Classroom.tsx
echo '```'

cat << 'SECTION'

---

## Step 15: Frontend — Invitation & Notification Pages

### 15.1 `frontend/src/pages/InvitationList.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/InvitationList.tsx
echo '```'

cat << 'SECTION'

### 15.2 `frontend/src/pages/InviteSingle.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/InviteSingle.tsx
echo '```'

cat << 'SECTION'

### 15.3 `frontend/src/pages/InviteBulk.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/InviteBulk.tsx
echo '```'

cat << 'SECTION'

### 15.4 `frontend/src/pages/Notifications.tsx`
SECTION

echo '```tsx'
cat frontend/src/pages/Notifications.tsx
echo '```'

cat << 'SECTION'

---

## Step 16: Frontend — App Entry Point & Router

### 16.1 `frontend/src/main.tsx`
SECTION

echo '```tsx'
cat frontend/src/main.tsx
echo '```'

cat << 'SECTION'

### 16.2 `frontend/src/App.tsx`
SECTION

echo '```tsx'
cat frontend/src/App.tsx
echo '```'

cat << 'SECTION'

### Checkpoint 4 — Full Application
```bash
docker compose up -d
# Wait for all services to start
# Visit http://localhost:5173 — should show the login page
# Log in with: john_teacher / teacher123 (or any user from seed data)
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
                                     Docker Compose: backend + frontend + redis
```
SECTION
