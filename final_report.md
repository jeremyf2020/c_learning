# CM3035 Advanced Web Development — Final Coursework Report

# eLearning Web Application

---

## Introduction

This report presents the design, implementation, and evaluation of an eLearning web application developed for the CM3035 Advanced Web Development module. The platform enables students and teachers to interact through course management, real-time classroom sessions with a shared whiteboard and audio streaming, AI-powered assignment generation, and an integrated dual-channel notification system (in-app and email).

The application is built as a decoupled, three-tier architecture:

- **Front-end:** A React 18 single-page application (SPA) with TypeScript and Vite, served on port 5173.
- **Back-end:** A Django 4.2 REST API served via Daphne (ASGI), exposing both HTTP endpoints (Django REST Framework 3.14) and WebSocket endpoints (Django Channels 4), on port 8080.
- **Data tier:** An SQLite database for persistent storage and a Redis 7 instance serving dual roles as the Django Channels channel layer for real-time message broadcasting and the Celery message broker for asynchronous task processing.

The entire stack is containerised with Docker Compose (five services: backend, frontend, Redis, Celery worker, Celery beat scheduler) for reproducible deployment. The report is organised to follow the assessment rubric: it covers the application design, database schema, requirement satisfaction (R1–R5), techniques used, cloud hosting considerations, a critical evaluation, and instructions for running the application.

---

## Design

The application follows the Model-View-Controller (MVC) pattern, implemented through Django's convention of Models, Serializers, and ViewSets on the back-end, and React components on the front-end. This section explains the architectural decisions, design patterns, and rationale behind the system's structure.

### Architecture Overview

The system is built as a decoupled client-server application. The front-end is a single-page application (SPA) built with React 18 and TypeScript, served by Vite's development server on port 5173. It communicates with the back-end exclusively through HTTP REST API calls (via Axios) and WebSocket connections — there is no server-side template rendering for user-facing pages. This separation allows the front-end and back-end to be developed, tested, and deployed independently.

The back-end is a Django 4.2 application served through Daphne, an ASGI server that handles both HTTP and WebSocket traffic on port 8080. It is organised into four Django apps: `accounts` (user models, authentication, invitations), `courses` (course management, materials, assignments, AI generation), `classroom` (real-time WebSocket chat), and `notifications` (in-app notification system with email delivery). Django REST Framework provides the REST API layer, while Django Channels enables WebSocket support for the live classroom feature.

Asynchronous task processing is handled by Celery 5.3.6, with a dedicated worker process that executes long-running operations such as sending notification emails, sending invitation emails, and generating AI-powered assignments via the OpenAI API. A separate Celery Beat process acts as a periodic task scheduler, using `django-celery-beat`'s `DatabaseScheduler` to store schedules in the Django database rather than in a static configuration file. Both the Celery worker and Celery Beat connect to Redis as their message broker.

Redis serves a dual role in the architecture: it acts as the Celery message broker for task queuing and as the Django Channels channel layer for WebSocket message routing. This consolidation avoids the need for a separate message-queue service and keeps the infrastructure simple.

The entire stack is orchestrated with Docker Compose, which defines five services: `backend` (Django/Daphne), `frontend` (React/Vite), `redis`, `celery_worker`, and `celery_beat`. Each service runs in its own container, and the `backend`, `celery_worker`, and `celery_beat` containers all share the same Docker image built from the `backend/` directory, differing only in their startup command.

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Front-end Framework | React | 18.2.0 |
| Front-end Language | TypeScript | 5.3.3 |
| Build Tool | Vite | 5.1.0 |
| CSS Framework | Bootstrap | 5.3.3 |
| HTTP Client | Axios | 1.6.7 |
| Routing | React Router DOM | 6.22.0 |
| Back-end Framework | Django | 4.2.27 |
| REST Framework | Django REST Framework | 3.14.0 |
| WebSocket Support | Django Channels | 4.0.0 |
| ASGI Server | Daphne | 4.0.0 |
| Channel Layer | channels-redis | 4.1.0 |
| Task Queue | Celery | 5.3.6 |
| Task Scheduler | django-celery-beat | 2.5.0 |
| Task Results | django-celery-results | 2.5.1 |
| Image Processing | Pillow | 10.2.0 |
| PDF Extraction | pypdf | 4.1.0 |
| CORS | django-cors-headers | 4.3.1 |
| API Docs | drf-spectacular | 0.28.0 |
| Database | SQLite 3 | (built-in) |
| Caching/Messaging | Redis | 7 (Alpine) |
| Containerisation | Docker Compose | v2 |

### Back-end App Structure

The Django back-end is modular, organised into four apps under the `core/` project configuration package:

| App | Responsibility |
|-----|---------------|
| `accounts` | User model, authentication, registration, invitations, status updates, profile management |
| `courses` | Course CRUD, materials upload, enrollment, feedback, AI-generated assignments (via Celery) |
| `classroom` | Real-time chat rooms, shared whiteboard, audio streaming via WebSockets |
| `notifications` | In-app notification management, asynchronous email delivery (via Celery) |

Each app follows a consistent three-layer pattern: `models.py` → `serializers.py` → `api.py` (ViewSets). This layered approach separates data definition (models), data transformation (serializers), and business logic (ViewSets), making each layer independently testable and replaceable. Apps that require background processing also include a `tasks.py` module containing Celery shared tasks.

### API Design

The REST API is designed around **resources as nouns** with **HTTP methods as verbs**, following RESTful conventions. Django REST Framework's `DefaultRouter` auto-generates URL endpoints for each ViewSet, producing a consistent and predictable URL structure (e.g., `/api/courses/`, `/api/users/`).

Beyond standard CRUD, domain-specific operations are exposed as **custom ViewSet actions** using the `@action` decorator. For example, enrolling in a course is `POST /api/courses/{id}/enroll/` rather than creating a separate `/api/enrollments/` endpoint with a course ID in the body. This keeps related logic co-located and produces intuitive, self-documenting URLs.

**Token authentication** was chosen over JWT for its simplicity and instant revocability. Database-backed tokens can be deleted to immediately invalidate a session, whereas JWTs remain valid until expiration unless a server-side blacklist is maintained — negating the stateless advantage that motivates JWT adoption. For a classroom-scale application, the marginal database lookup per request is an acceptable trade-off for simpler session management.

**Permission enforcement** operates at three levels:
1. **Class-level:** Custom `IsTeacher` permission class restricts entire ViewSets to teacher accounts.
2. **Object-level:** `perform_create()`, `perform_update()`, and `perform_destroy()` check ownership before allowing mutations — for example, only the course teacher can modify their own course.
3. **Queryset-level:** `get_queryset()` methods scope data visibility by role — students only see assignments for courses they are enrolled in, and teachers only see data for their own courses.

### Real-time Design (WebSocket Architecture)

The real-time classroom feature uses Django Channels 4 with an `AsyncWebsocketConsumer`, chosen over polling or Server-Sent Events because WebSockets provide full-duplex communication with lower latency — essential for synchronized whiteboard drawing and audio streaming.

**Protocol routing:** The ASGI configuration (`core/asgi.py`) uses Channels' `ProtocolTypeRouter` to split incoming connections: HTTP requests are routed to Django's standard ASGI handler, while WebSocket connections are routed through a custom `TokenAuthMiddleware` to the Channels URL router. This allows both protocols to share the same port (8080) and Docker service.

**WebSocket authentication** required custom middleware because the browser's WebSocket API does not support custom HTTP headers during the handshake (unlike regular HTTP requests). The `TokenAuthMiddleware` extracts the DRF auth token from the WebSocket query string (`?token=...`) and attaches the authenticated user to the connection scope. This provides the same authentication guarantee as the REST API while working within the constraints of the WebSocket protocol.

**Message multiplexing:** A single WebSocket connection per room handles all real-time features: chat messages, whiteboard drawing commands (pen, line, text, eraser, move, undo, clear), and audio data streams. Each message carries a `type` field that the consumer dispatches to the appropriate handler. This avoids the overhead and complexity of maintaining multiple WebSocket connections per user.

**Channel groups via Redis:** The Redis channel layer enables broadcasting messages to all participants in a room via `group_send()`. When a user draws on the whiteboard, the coordinates are sent to the server, which broadcasts them to the entire channel group. This architecture supports horizontal scaling — multiple Daphne workers can share the same Redis channel layer, allowing real-time features to work across multiple server instances.

**Coordinate normalisation:** Whiteboard drawing coordinates are normalised to the 0–1 range before transmission, decoupling the drawing data from the client's screen resolution. This ensures that a drawing created on a 1920×1080 display renders correctly on a 1366×768 laptop or a mobile device.

### Asynchronous Task Processing (Celery)

The application uses Celery 5.3 with Redis as the message broker (shared with Django Channels) for asynchronous task processing. Three categories of work are offloaded from the HTTP request-response cycle:

1. **Email delivery** (`notifications/tasks.py`): All email sending — notification emails, bulk notification emails, and invitation emails — is dispatched to Celery workers via `.delay()`. This prevents SMTP latency (typically 1–3 seconds per email) from blocking API responses. For bulk operations like CSV invitation upload, where a single request may trigger dozens of emails, this is particularly important.

2. **AI assignment generation** (`courses/tasks.py`): The OpenAI API call for quiz/flashcard generation has a 60-second timeout and unpredictable latency. The `generate_assignment_task` Celery task handles the entire pipeline — building the AI prompt, calling the OpenAI API, parsing the JSON response, creating the `Assignment` database record, and sending deadline notifications. The API endpoint returns `HTTP 202 Accepted` with a `task_id` immediately, rather than blocking the teacher's browser for up to 60 seconds.

3. **Scheduled tasks** (`celery_beat`): The Celery Beat scheduler, backed by `django-celery-beat`'s `DatabaseScheduler`, enables periodic task scheduling configurable through the Django admin interface. This supports future requirements such as invitation expiration cleanup or deadline reminder emails.

**Broker choice:** Redis was selected over RabbitMQ because it was already deployed as the Django Channels channel layer. Using a single Redis instance for both Channels and Celery reduces operational complexity — one fewer service to deploy, monitor, and maintain. Task results are stored in the Django database via `django-celery-results`, allowing inspection through the Django admin.

**Docker service topology:** Celery runs as two additional Docker Compose services (`celery_worker` and `celery_beat`) sharing the same backend Docker image but with different entrypoint commands. Both services mount the same code volume as the backend, ensuring they always run the same version of the application code.

### Front-end Architecture

The React SPA follows a **component hierarchy** of `App` → `Layout` (with conditional `Navbar`) → `Pages`, with 14 page components covering all application features.

**State management:** The `AuthContext` (React Context API) provides global authentication state — `user`, `login()`, `logout()`, `refreshUser()`, and `unreadCount` — to all components via the `useAuth()` hook. Redux was deliberately not adopted because the application's global state consists solely of authentication data. Context API is the idiomatic React solution for single-concern global state, avoiding the boilerplate of actions, reducers, and a store that Redux requires.

**Route protection:** The `ProtectedRoute` component wraps authenticated routes, checking the `AuthContext` user state and optionally verifying `requiredType` (student or teacher). Unauthenticated users are redirected to `/login`. This centralises access control in the router rather than duplicating checks in each page component.

**API layer:** A single Axios instance (`api/client.ts`) is configured with a request interceptor that automatically attaches the auth token from `localStorage` to every request. This eliminates repetitive token handling across the 14 page components and ensures consistent authentication headers.

**Theming:** A custom CSS file (`theme.css`) overrides Bootstrap 5 defaults using CSS custom properties (variables). The green-to-blue gradient theme and custom component styling are achieved entirely through variable redefinition (e.g., `--bs-primary`, `--bs-body-bg`) rather than modifying Bootstrap source files. This approach allows theme updates by changing a single variable value, with changes cascading throughout the application.

### Key Design Decisions

**Why Django + React (not Django templates):** The SPA architecture provides a significantly better user experience for the real-time classroom feature. Django template rendering would require full page reloads for navigation, interrupting WebSocket connections. A React SPA maintains persistent WebSocket connections across route changes and provides instant navigation between pages. The trade-off is increased initial complexity (two build systems, CORS configuration, token auth), but the resulting UX for real-time features justifies this cost.

**Why SQLite (not PostgreSQL):** SQLite was chosen for development simplicity — no database server to configure or maintain. The application supports PostgreSQL via environment variables (`DB_ENGINE`, `DB_NAME`) without code changes, making migration straightforward for production deployment.

**Why CSV-based seeding (not Django fixtures):** The `populate_db` management command reads seed data from six CSV files rather than Django JSON fixtures. CSV files are human-readable and editable with any spreadsheet application, making it easy for non-developers to modify demo data. The command is idempotent — it skips records that already exist.

**Why explicit notification calls (not Django signals):** Notification creation uses explicit utility function calls (`create_notification()`, `create_bulk_notifications()`) at each trigger point rather than Django signals. This makes notification logic visible at the call site, easier to debug, and allows passing contextual information (custom messages, links). This follows the Python principle "explicit is better than implicit."

---

## Database Design

### Overview

The data model comprises **12 Django models** spread across four apps. All models use Django's ORM and are normalised to **Third Normal Form (3NF)**.

### Models and Fields

#### Accounts App

**User** (extends Django's `AbstractUser`)

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| username | CharField(150) | Unique |
| email | EmailField | - |
| password | CharField | Hashed (PBKDF2) |
| user_type | CharField(10) | Choices: 'student', 'teacher'; Default: 'student' |
| full_name | CharField(255) | Optional |
| bio | TextField | Optional |
| photo | ImageField | Optional; Validators: jpg, jpeg, png |
| date_of_birth | DateField | Optional |
| phone_number | CharField(20) | Optional |
| is_blocked | BooleanField | Default: False |
| ai_api_key | CharField(255) | Optional; For OpenAI integration |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**StatusUpdate**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| user | ForeignKey → User | CASCADE |
| content | TextField | Required |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Invitation**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| invited_by | ForeignKey → User | SET_NULL, nullable |
| email | EmailField | Required |
| full_name | CharField(255) | Optional |
| user_type | CharField(10) | Choices: 'student', 'teacher' |
| date_of_birth | DateField | Optional |
| phone_number | CharField(20) | Optional |
| bio | TextField | Optional |
| token | CharField(64) | Unique, db_index; Auto-generated via `secrets.token_urlsafe(48)` |
| status | CharField(10) | Choices: 'pending', 'accepted', 'expired'; Default: 'pending' |
| created_user | OneToOneField → User | SET_NULL, nullable |
| created_at | DateTimeField | auto_now_add |
| expires_at | DateTimeField | Auto-set to now + 30 days |

#### Courses App

**Course**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| title | CharField(255) | Required |
| description | TextField | Required |
| teacher | ForeignKey → User | CASCADE; limit_choices_to: teacher |
| code | CharField(20) | Unique |
| start_date | DateField | Optional |
| end_date | DateField | Optional |
| is_active | BooleanField | Default: True |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**CourseMaterial**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| course | ForeignKey → Course | CASCADE |
| title | CharField(255) | Required |
| description | TextField | Optional |
| material_type | CharField(20) | Choices: 'document', 'image', 'video', 'other' |
| file | FileField | Validators: pdf, doc, docx, ppt, pptx, jpg, jpeg, png, gif, mp4, avi |
| uploaded_by | ForeignKey → User | CASCADE |
| uploaded_at | DateTimeField | auto_now_add |

**Enrollment**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| student | ForeignKey → User | CASCADE; limit_choices_to: student |
| course | ForeignKey → Course | CASCADE |
| enrolled_at | DateTimeField | auto_now_add |
| is_active | BooleanField | Default: True |
| completed | BooleanField | Default: False |
| completion_date | DateTimeField | Optional |

Constraint: `unique_together('student', 'course')`

**Feedback**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| course | ForeignKey → Course | CASCADE |
| student | ForeignKey → User | CASCADE; limit_choices_to: student |
| rating | IntegerField | Optional; Validators: Min=1, Max=5 |
| comment | TextField | Required |
| created_at | DateTimeField | auto_now_add |

Constraint: `unique_together('course', 'student')`

**Assignment**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| course | ForeignKey → Course | CASCADE |
| title | CharField(255) | Required |
| assignment_type | CharField(10) | Choices: 'quiz', 'flashcard' |
| content | JSONField | Stores questions/cards as JSON |
| source_file | FileField | Optional; Validators: pdf only |
| created_by | ForeignKey → User | CASCADE |
| created_at | DateTimeField | auto_now_add |
| deadline | DateTimeField | Optional |

**AssignmentSubmission**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| assignment | ForeignKey → Assignment | CASCADE |
| student | ForeignKey → User | CASCADE; limit_choices_to: student |
| answers | JSONField | Default: [] |
| score | IntegerField | Optional; Auto-calculated for quizzes |
| submitted_at | DateTimeField | auto_now_add |

Constraint: `unique_together('assignment', 'student')`

#### Classroom App

**Classroom**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| name | CharField(255) | Required |
| participants | ManyToManyField → User | Related name: 'classrooms' |
| whiteboard_data | TextField | Default: '[]'; JSON-encoded drawing actions |
| created_at | DateTimeField | auto_now_add |

**ClassroomMessage**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| room | ForeignKey → Classroom | CASCADE |
| sender | ForeignKey → User | CASCADE |
| content | TextField | Max 5000 characters |
| created_at | DateTimeField | auto_now_add |

#### Notifications App

**Notification**

| Field | Type | Constraints |
|-------|------|------------|
| id | BigAutoField | Primary Key |
| recipient | ForeignKey → User | CASCADE |
| notification_type | CharField(20) | Choices: 'enrollment', 'material', 'feedback', 'deadline', 'general' |
| title | CharField(255) | Required |
| message | TextField | Required |
| link | CharField(500) | Optional |
| is_read | BooleanField | Default: False |
| created_at | DateTimeField | auto_now_add |

### Normalisation

**1NF:** All columns store atomic values. The only structured fields are `Assignment.content` (JSON) and `Classroom.whiteboard_data` (JSON), which are intentional — they are always loaded and saved as whole units and never queried at sub-element level.

**2NF:** Every non-key attribute depends on the entire primary key. Django uses single-column surrogate keys (`id`). Logical composite keys via `unique_together` (`Enrollment(student, course)`, `Feedback(course, student)`, `AssignmentSubmission(assignment, student)`) ensure no partial dependencies.

**3NF:** No non-key attribute transitively depends on the primary key. Denormalised display fields like `teacher_name` and `student_name` are computed at serialisation time using `SerializerMethodField` and are not stored in the database.

### Referential Integrity

- `CASCADE` for most relationships (deleting a User cascades to their StatusUpdates, Enrollments, Feedback).
- `SET_NULL` where parent records should be preserved (`Invitation.invited_by`, `Invitation.created_user`).
- `FileExtensionValidator` on file upload fields.
- `MinValueValidator(1)` and `MaxValueValidator(5)` on `Feedback.rating`.
- `unique=True` on `Course.code` and `Invitation.token` (with `db_index=True`).

---

## ERD Diagram

```
┌──────────────────┐          ┌──────────────────┐
│    Invitation     │          │   StatusUpdate    │
│──────────────────│          │──────────────────│
│ id (PK)          │          │ id (PK)          │
│ invited_by (FK)──┼────┐     │ user (FK)────────┼────┐
│ email            │    │     │ content          │    │
│ full_name        │    │     │ created_at       │    │
│ user_type        │    │     │ updated_at       │    │
│ token (UQ)       │    │     └──────────────────┘    │
│ status           │    │                             │
│ created_user(1:1)┼──┐ │                             │
│ expires_at       │  │ │                             │
└──────────────────┘  │ │    ┌──────────────────┐     │
                      │ │    │      User        │     │
                      │ └───►│  (AbstractUser)  │◄────┘
                      └─────►│──────────────────│
                             │ id (PK)          │◄──────────────────────────┐
                             │ username (UQ)    │                          │
                             │ email            │◄──────────────┐         │
                             │ user_type        │               │         │
                             │ full_name        │               │         │
                             │ photo            │               │         │
                             │ is_blocked       │               │         │
                             │ ai_api_key       │               │         │
                             └────┬───┬───┬─────┘               │         │
                                  │   │   │                     │         │
              ┌───────────────────┘   │   └──────────────┐      │         │
              │                       │                  │      │         │
              ▼                       ▼                  ▼      │         │
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│         │
│     Course       │  │   Enrollment     │  │   Notification   ││         │
│──────────────────│  │──────────────────│  │──────────────────││         │
│ id (PK)          │  │ id (PK)          │  │ id (PK)          ││         │
│ title            │  │ student (FK)─────┼──┘ recipient (FK)───┼┘         │
│ description      │  │ course (FK)──────┼──┐ notification_type│          │
│ teacher (FK)─────┼──┘ enrolled_at      │  │ title            │          │
│ code (UQ)        │◄─┐ is_active        │  │ message          │          │
│ start_date       │  │ completed        │  │ is_read          │          │
│ end_date         │  │ UQ(student,course)│  └──────────────────┘          │
│ is_active        │  └──────────────────┘                                │
└──┬───┬───┬───────┘                                                      │
   │   │   │                                                              │
   │   │   └──────────────────┐                                           │
   │   │                      │                                           │
   ▼   ▼                      ▼                                           │
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐      │
│ CourseMaterial   │  │   Feedback       │  │    Assignment        │      │
│──────────────────│  │──────────────────│  │──────────────────────│      │
│ id (PK)          │  │ id (PK)          │  │ id (PK)              │      │
│ course (FK)      │  │ course (FK)      │  │ course (FK)          │      │
│ title            │  │ student (FK)     │  │ title                │      │
│ file             │  │ rating (1-5)     │  │ assignment_type      │      │
│ material_type    │  │ comment          │  │ content (JSON)       │      │
│ uploaded_by (FK) │  │ UQ(course,student)│  │ created_by (FK)      │      │
└──────────────────┘  └──────────────────┘  │ deadline             │      │
                                            └────────┬─────────────┘      │
                                                     │                    │
                                                     ▼                    │
                                            ┌──────────────────────┐      │
                                            │AssignmentSubmission  │      │
                                            │──────────────────────│      │
                                            │ id (PK)              │      │
                                            │ assignment (FK)      │      │
                                            │ student (FK)─────────┼──────┘
                                            │ answers (JSON)       │
                                            │ score                │
                                            │ UQ(assignment,student)│
                                            └──────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│   Classroom      │       │ClassroomMessage  │
│──────────────────│       │──────────────────│
│ id (PK)          │◄──────┤ room (FK)        │
│ name             │       │ sender (FK) → User│
│ participants(M2M)│→ User │ content          │
│ whiteboard_data  │       │ created_at       │
└──────────────────┘       └──────────────────┘
```

### Key Relationships Summary

| Relationship | Type | On Delete |
|-------------|------|-----------|
| User → StatusUpdate | One-to-Many | CASCADE |
| User → Invitation (invited_by) | One-to-Many | SET_NULL |
| Invitation → User (created_user) | One-to-One | SET_NULL |
| User → Course (teacher) | One-to-Many | CASCADE |
| User ↔ Course (via Enrollment) | Many-to-Many | CASCADE |
| Course → CourseMaterial | One-to-Many | CASCADE |
| Course → Feedback | One-to-Many | CASCADE |
| Course → Assignment | One-to-Many | CASCADE |
| Assignment → AssignmentSubmission | One-to-Many | CASCADE |
| User → Notification (recipient) | One-to-Many | CASCADE |
| User ↔ Classroom (participants) | Many-to-Many | — |
| Classroom → ClassroomMessage | One-to-Many | CASCADE |

---

## Folder Structure (C1)

```
claude_elearning/
├── docker-compose.yml              # Docker orchestration (5 services)
├── .env                            # Environment variables
├── .gitignore
│
├── backend/                        # Django 4.2 Back-End
│   ├── Dockerfile                  # Python 3.11-slim + Daphne
│   ├── manage.py                   # Django management script
│   ├── requirements.txt            # Python dependencies
│   ├── db.sqlite3                  # SQLite database
│   │
│   ├── core/                       # Django project configuration
│   │   ├── settings.py             # Settings (DB, CORS, Channels, Celery, Email)
│   │   ├── urls.py                 # Root URL routing
│   │   ├── asgi.py                 # ASGI config (HTTP + WebSocket routing)
│   │   ├── wsgi.py                 # WSGI config (fallback)
│   │   └── celery.py               # Celery app configuration
│   │
│   ├── accounts/                   # User management app
│   │   ├── models.py               # User, StatusUpdate, Invitation models
│   │   ├── api.py                  # REST ViewSets + auth endpoints
│   │   ├── serializers.py          # 8 serializers (Register, Login, etc.)
│   │   ├── views.py                # Server-side rendered views
│   │   ├── forms.py                # Django forms (Registration, Profile)
│   │   ├── urls.py                 # App URL patterns
│   │   ├── tests.py                # 79 test methods
│   │   ├── admin.py                # Admin registration
│   │   ├── migrations/             # Database migrations
│   │   └── management/commands/    # populate_db
│   │
│   ├── courses/                    # Course management app
│   │   ├── models.py               # Course, Material, Enrollment, etc.
│   │   ├── api.py                  # REST ViewSets + custom actions
│   │   ├── serializers.py          # 6 serializers
│   │   ├── tasks.py                # Celery task: AI assignment generation
│   │   ├── views.py                # Server-side rendered views
│   │   ├── forms.py                # Course, Material, Feedback forms
│   │   ├── urls.py                 # App URL patterns
│   │   ├── tests.py                # 31 test methods
│   │   └── migrations/             # Database migrations
│   │
│   ├── classroom/                  # Real-time classroom app
│   │   ├── models.py               # Classroom, ClassroomMessage models
│   │   ├── api.py                  # REST ViewSet
│   │   ├── serializers.py          # 2 serializers
│   │   ├── consumers.py            # WebSocket consumer (chat/whiteboard/audio)
│   │   ├── middleware.py           # Token auth middleware for WebSocket
│   │   ├── routing.py              # WebSocket URL routing
│   │   ├── tests.py                # 9 test methods
│   │   └── migrations/             # Database migrations
│   │
│   ├── notifications/              # Notification system app
│   │   ├── models.py               # Notification model
│   │   ├── api.py                  # REST ViewSet
│   │   ├── serializers.py          # 1 serializer
│   │   ├── tasks.py                # Celery tasks: async email delivery
│   │   ├── utils.py                # create_notification, create_bulk_notifications
│   │   ├── tests.py                # 13 test methods
│   │   └── migrations/             # Database migrations
│   │
│   ├── templates/                  # Django HTML templates
│   │   ├── base.html               # Base template layout
│   │   ├── accounts/               # Auth & profile templates
│   │   ├── courses/                # Course management templates
│   │   └── chat/                   # Chat room templates
│   │
│   ├── media/                      # User-uploaded files
│   └── seed_data/                  # CSV templates for bulk upload
│
└── frontend/                       # React 18 SPA Front-End
    ├── Dockerfile                  # Node 20-alpine
    ├── package.json                # NPM dependencies
    ├── tsconfig.json               # TypeScript configuration
    ├── vite.config.ts              # Vite build configuration
    ├── jest.config.ts              # Jest test configuration
    ├── index.html                  # SPA entry HTML
    │
    └── src/
        ├── main.tsx                # React entry point
        ├── App.tsx                 # Root component + routing
        ├── theme.css               # Custom CSS theme
        │
        ├── api/
        │   └── client.ts           # Axios client + auth interceptor
        │
        ├── components/
        │   ├── Navbar.tsx           # Navigation bar
        │   └── ProtectedRoute.tsx   # Auth-guarded route wrapper
        │
        ├── context/
        │   └── AuthContext.tsx      # Global auth state (React Context)
        │
        ├── pages/
        │   ├── Login.tsx            # Login page
        │   ├── Register.tsx         # Registration page
        │   ├── Profile.tsx          # User profile (view/edit)
        │   ├── StudentHome.tsx      # Student dashboard
        │   ├── TeacherHome.tsx      # Teacher dashboard
        │   ├── CourseCreate.tsx      # Create new course
        │   ├── CourseDetail.tsx      # Course detail page
        │   ├── AssignmentView.tsx    # Quiz/flashcard viewer
        │   ├── Classroom.tsx        # Real-time classroom (chat/whiteboard/audio)
        │   ├── InvitationList.tsx    # Manage sent invitations
        │   ├── InviteSingle.tsx      # Invite single user
        │   ├── InviteBulk.tsx        # Bulk CSV invitation upload
        │   ├── AcceptInvitation.tsx  # Accept invitation link
        │   └── Notifications.tsx    # Notification centre
        │
        ├── types/
        │   └── index.ts             # TypeScript type definitions
        │
        └── __tests__/              # Front-end unit tests (11 files)
            ├── Login.test.tsx
            ├── Register.test.tsx
            ├── Navbar.test.tsx
            ├── ProtectedRoute.test.tsx
            ├── CourseCreate.test.tsx
            ├── InvitationList.test.tsx
            ├── InviteSingle.test.tsx
            ├── InviteBulk.test.tsx
            ├── AcceptInvitation.test.tsx
            ├── Notifications.test.tsx
            └── TeacherHome.test.tsx
```

---

## Requirement Satisfaction

### R1 — Functionality

---

#### Authentication (R1a, R1b)

As R1a and R1b require users to create accounts and log in/out, the application implements two registration pathways: a **public registration system** available to everyone (for students), and an **invitation-based system** for internal use (allowing teachers to invite other teachers or students). This dual approach supports both an open eLearning platform and an internal school environment.

##### Register

**Public Registration (Students Only)**

Users can self-register through the public registration form at `/register`.

- **Front-end:** `Register.tsx` renders a form with fields for username, email, full name, user type, password, and password confirmation.
- **Back-end:** `POST /api/auth/register/` is handled by `auth_register()` in `accounts/api.py`.
- **Serializer:** `RegisterSerializer` validates the input:
  - Checks password strength using Django's built-in validators (minimum length, common password check, numeric-only prevention, attribute similarity).
  - Confirms passwords match.
  - **Forces `user_type` to `'student'`** — self-registration cannot create teacher accounts, preventing privilege escalation.
- **Flow:** On successful registration, a Django REST Framework auth token is generated, returned to the client, stored in `localStorage`, and the user is redirected to the home page.

**Invitation-Based Registration (Students or Teachers)**

Users can also create accounts through invitation links sent by teachers:

- **Teacher creates invitation:** Via `POST /api/invitations/` with the invitee's email, full name, user type (student or teacher), and optional details. A unique 48-character URL-safe token is generated (`secrets.token_urlsafe(48)`) with a 30-day expiration.
- **Email sent:** The system sends an email asynchronously via Celery's `send_invitation_email.delay()` with an invitation link (`/invite/{token}`).
- **Invitee accepts:** At `/invite/{token}`, the `AcceptInvitation.tsx` page validates the token via `GET /api/invite/{token}/`, displays pre-filled details (name, email, role), and requires only a username and password.
- **Account created:** `POST /api/invite/{token}/accept/` creates the user with invitation data, marks the invitation as `'accepted'`, and returns an auth token.
- **Bulk invitations:** Teachers can upload a CSV file via `POST /api/invitations/bulk_upload/` to invite multiple users at once, with per-row validation and error reporting.

##### Login

- **Front-end:** `Login.tsx` provides a username/password form.
- **Back-end:** `POST /api/auth/login/` authenticates via Django's `authenticate()`, checks if the user is blocked (`is_blocked=True` → 403 Forbidden), and returns an auth token with user data.
- **Token management:** Tokens are stored in `localStorage` and attached to every Axios request via an interceptor (`Authorization: Token <key>`).

##### a) Users to create accounts

Satisfied by both the public registration and invitation-based registration flows described above.

##### b) Users to log in and log out

- **Login:** `POST /api/auth/login/` with token return and localStorage storage.
- **Logout:** The front-end removes the token from `localStorage` and resets the `AuthContext` user state to `null`, redirecting to the login page.
- **Session validation:** `GET /api/auth/me/` allows the SPA to verify the stored token on app load and retrieve the current user.

---

#### Teacher Home Page (Private) (R1c, R1d, R1h, R1i)

The teacher home page (`TeacherHome.tsx`) is a protected route accessible only to authenticated teachers. It provides:

##### c) Teachers to search for students and other teachers

- **Endpoint:** `GET /api/users/search/?q=<query>&user_type=<type>`
- **Implementation:** The `UserViewSet.search` action performs case-insensitive search across `username`, `full_name`, and `email` fields using Django's `icontains` lookup. Results can be filtered by `user_type` (student or teacher).
- **Front-end:** `TeacherHome.tsx` provides a live search interface with a text input and user type filter. Search results display user cards with options to view profiles or add students to courses.
- **Security:** The search endpoint excludes blocked users and the requesting user from results. Only teachers can access this endpoint.

##### d) Teachers to add new courses

- **Endpoint:** `POST /api/courses/`
- **Implementation:** The `CourseViewSet.perform_create()` method verifies `request.user.is_teacher()` before creating the course, automatically setting the teacher to the current user.
- **Front-end:** `CourseCreate.tsx` provides a form with fields for title, description, course code (unique), start date, and end date.
- **The teacher's home page** displays all courses they teach, with links to course detail pages.

##### h) Teachers to remove / block students

Two levels of blocking are implemented:

1. **Per-course blocking:** `POST /api/courses/{id}/block/{student_id}/` deactivates the student's enrollment (`is_active=False`). The student is notified via the notification system.
2. **Global blocking:** `POST /api/users/{id}/block/` sets `is_blocked=True` on the user account, preventing them from logging in entirely. Teachers can also unblock via `POST /api/users/{id}/unblock/`.

Both actions are restricted to teacher accounts via the `IsTeacher` permission class.

---

#### Student Home Page (Private) (R1e, R1f, R1i)

The student home page (`StudentHome.tsx`) is a protected route for authenticated students. It displays enrolled courses, available courses, upcoming assignment deadlines, and a status update feed.

##### e) Students to enrol themselves on a course

- **Endpoint:** `POST /api/courses/{id}/enroll/`
- **Implementation:** The `CourseViewSet.enroll` action creates an `Enrollment` record linking the student to the course. If the student was previously removed (inactive enrollment), the enrollment is reactivated.
- **Notification:** When a student enrols, the course teacher receives an in-app notification and email: "New enrollment in {course.code}".
- **Unenrolling:** Students can leave a course via `POST /api/courses/{id}/unenroll/`, which sets `is_active=False` and notifies the teacher.
- **Front-end:** The student home page shows available courses with an "Enrol" button.

##### f) Students to leave feedback for a course

- **Endpoint:** `POST /api/feedback/`
- **Implementation:** The `FeedbackViewSet.perform_create()` verifies the student is enrolled in the course before allowing feedback submission.
- **Fields:** Rating (1–5 stars, optional) and comment (required).
- **Constraint:** `unique_together('course', 'student')` ensures one feedback per student per course.
- **Notification:** The teacher receives a notification when feedback is submitted.
- **Front-end:** The course detail page includes a feedback form for enrolled students and displays existing feedback with average ratings.

---

#### Shared Requirement (R1i)

##### i) Users to add status updates to their home page

- **Endpoint:** `POST /api/status-updates/` and `GET /api/status-updates/`
- **Model:** `StatusUpdate` with `user` (ForeignKey), `content` (TextField), `created_at` (auto).
- **Implementation:** `StatusUpdateViewSet` allows users to create, list, and delete their own status updates.
- **Front-end:** Both `StudentHome.tsx` and `TeacherHome.tsx` display a text input for posting new status updates and a feed showing recent updates.
- **Profile page:** Status updates also appear on user profile pages.

---

#### Classroom (Realtime) (R1g)

##### g) Users to chat in real time

The classroom feature provides real-time communication through WebSocket connections powered by Django Channels 4 and Redis.

**Architecture:**
- **ASGI configuration** (`asgi.py`): `ProtocolTypeRouter` routes HTTP to Django's ASGI handler and WebSocket connections to the Channels URL router.
- **Consumer:** `ClassroomConsumer` in `classroom/consumers.py` is an `AsyncWebsocketConsumer` handling multiple message types.
- **Authentication:** Custom `TokenAuthMiddleware` extracts the auth token from the WebSocket query string and attaches the user to the connection scope.
- **Channel layer:** Redis enables broadcasting messages to all participants in a room via `group_send`.

**Features:**

1. **Live chat:** Users send text messages (`type: 'chat'`) that are validated for length (max 5000 characters), saved to the database, and broadcast to all room participants in real time.

2. **Shared whiteboard:** Teachers can draw on an HTML5 Canvas that synchronises across all connected clients:
   - Tools: Pen (freehand), Line (straight lines), Text (inline text input), Eraser, Move, Undo, Clear.
   - Coordinates are normalised to the 0–1 range for resolution independence.
   - Drawing actions are stored in `Classroom.whiteboard_data` (JSON, capped at 500 actions).
   - Late joiners receive the full whiteboard state on connection.

3. **Audio streaming:** Teachers can broadcast audio to students via the Web Audio API:
   - `getUserMedia()` captures the microphone.
   - PCM audio is downsampled to 16 kHz, base64-encoded, and sent via WebSocket.
   - Students decode and play back audio with precise timing using `AudioBufferSourceNode`.

**REST endpoints** also exist for managing rooms:
- `POST /api/classrooms/` — Create a room.
- `POST /api/classrooms/{id}/join/` — Join a room.
- `GET /api/classrooms/{id}/messages/` — Retrieve message history (last 100 messages).
- `POST /api/classrooms/{id}/send/` — Send a message (REST fallback).

---

#### Course Page (Student/Teacher) (R1h, R1j)

##### j) Teachers to add files (teaching materials)

- **Endpoint:** `POST /api/materials/`
- **Model:** `CourseMaterial` with fields for title, description, material type, and file upload.
- **Supported file types:** PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG, GIF, MP4, AVI — validated via `FileExtensionValidator`.
- **Implementation:** `CourseMaterialViewSet` handles CRUD operations. Only the course teacher can upload materials.
- **Notification:** When new material is uploaded, all enrolled students receive an in-app notification and email via `create_bulk_notifications()`.
- **Access control:** Materials are accessible only to the course teacher and enrolled students via `GET /api/courses/{id}/materials/`.
- **Front-end:** `CourseDetail.tsx` provides an upload form for teachers and a materials list with download links for students.

**Additionally**, the course page supports:
- **AI-generated assignments:** Teachers can upload a PDF and generate quizzes or flashcards using the OpenAI API (`POST /api/assignments/generate/`). Text is extracted from the PDF via `pypdf`, sent to GPT-3.5-turbo with a structured prompt, and the JSON response is parsed into an `Assignment` model.
- **Assignment submissions:** Students can take quizzes (auto-scored: `score = correct/total * 100`) or review flashcards via `AssignmentView.tsx`.

---

#### Notification (R1k, R1l)

##### k) When a student enrols on a course, the teacher should be notified

When a student calls `POST /api/courses/{id}/enroll/`, the `create_notification()` utility is invoked:
- Creates an in-app `Notification` record for the course teacher.
- Sends an email to the teacher with the notification details.
- Notification type: `'enrollment'`, with the message "New enrollment in {course.code}".

Similarly, notifications are sent when students unenrol, are blocked, or are manually added to a course.

##### l) When new material is added to a course, the student should be notified

When a teacher uploads material via `POST /api/materials/`, `create_bulk_notifications()` is called:
- Creates in-app `Notification` records for all actively enrolled students.
- Sends emails to all enrolled students asynchronously via Celery's `send_bulk_notification_emails.delay()`.
- Notification type: `'material'`, with the message "New material in {course.code}".

**Full notification trigger points:**

| Event | Recipient | Type |
|-------|-----------|------|
| Student enrols | Teacher | enrollment |
| Student unenrols | Teacher | enrollment |
| Teacher blocks student | Student | enrollment |
| Teacher adds student | Student | enrollment |
| New material uploaded | All enrolled students | material |
| Student submits feedback | Teacher | feedback |
| Student submits assignment | Teacher | general |
| Assignment deadline set | All enrolled students | deadline |
| Course deleted | All enrolled students | general |

**Front-end:** `Notifications.tsx` displays all notifications with type badges, mark-as-read, and mark-all-read functionality.

---

### R2: Usage of Taught Material

#### Correct use of models and migrations

- **12 models** across 4 Django apps, using Django's ORM with `AbstractUser`, `ForeignKey`, `OneToOneField`, `ManyToManyField`, `JSONField`, `FileField`, and `ImageField`.
- Custom model methods: `User.is_student()`, `User.is_teacher()`, `Course.get_enrolled_students_count()`, `Course.get_average_rating()`, `Invitation.is_expired`, `Invitation.is_valid`.
- Meta options: `ordering`, `unique_together`, `verbose_name_plural`.
- Validators: `FileExtensionValidator`, `MinValueValidator`, `MaxValueValidator`.
- `AUTH_USER_MODEL = 'accounts.User'` for the custom user model.
- All migrations generated via `makemigrations` and applied via `migrate` (4 migration directories with multiple migration files).
- Management commands: `populate_db` for demo data seeding.

#### Correct use of forms, serialisation, validators

- **7 Django forms** across 2 apps: `UserRegistrationForm`, `UserProfileUpdateForm`, `StatusUpdateForm`, `UserSearchForm`, `CourseForm`, `CourseMaterialForm`, `FeedbackForm`.
- **17 DRF serializers** with features:
  - `SerializerMethodField` for computed fields (`teacher_name`, `enrolled_count`, `average_rating`, `has_ai_key`).
  - Custom `validate_email()`, `validate_username()`, `validate_password()` methods.
  - Cross-field validation (password confirmation matching).
  - `source` parameter for field mapping (`student_name` from `student.username`).
  - Read-only and write-only field declarations.
- Validators at model level (`FileExtensionValidator`, `MinValueValidator`, `MaxValueValidator`) and serializer level (password strength, email uniqueness, username uniqueness).

#### Correct use of django-rest-framework

- **11 ViewSets** (including `ModelViewSet` and `ReadOnlyModelViewSet`).
- `DefaultRouter` for automatic URL generation.
- `TokenAuthentication` for API auth.
- **20+ custom `@action` endpoints**: `enroll`, `unenroll`, `block_student`, `add_student`, `students`, `materials`, `search`, `mark_read`, `mark_all_read`, `bulk_upload`, `download_template`, `generate`, `join`, `messages`, `send`, `resend`, `me`, `update_profile`, `block`, `unblock`.
- Custom permission class: `IsTeacher`.
- Object-level permissions in `perform_create`, `perform_update`, `perform_destroy`.
- `MultiPartParser` and `JSONParser` for file upload endpoints.
- Queryset optimisation: `select_related()` throughout to prevent N+1 queries.
- `drf-spectacular` for auto-generated OpenAPI/Swagger documentation.

#### Correct use of URL routing

- App-level `urlpatterns` with `include()` at the project level.
- `DefaultRouter` for ViewSet URL generation.
- Named URL patterns for server-side views.
- WebSocket URL routing via Channels `URLRouter` with `path('ws/classroom/<str:room_name>/', ...)`.
- ASGI `ProtocolTypeRouter` for HTTP vs WebSocket protocol routing.

#### Appropriate use of unit testing

- **132 back-end test methods** across 16 test classes using `TestCase` and `APITestCase`.
- **11 front-end test files** using Jest and React Testing Library.
- Tests cover: model behaviour, API endpoints, permissions (positive and negative), input validation, email delivery (mocked), edge cases (expired tokens, duplicate entries, blocked users, CSV validation).
- Detailed in the R5 section below.

---

### R3: SQLite Database

The application uses **SQLite** as the default database, configured in `settings.py`:

```python
db_engine = os.environ.get('DB_ENGINE', 'django.db.backends.sqlite3')
db_name = os.environ.get('DB_NAME', str(BASE_DIR / 'db.sqlite3'))
```

The database file `db.sqlite3` is located in the `backend/` directory and is included in the zipped submission for immediate use. The 12-model schema stores:

- **Accounts:** Users (students and teachers), status updates, invitations with tokens and expiration.
- **Courses:** Courses with unique codes, materials with file uploads, enrollments (many-to-many with metadata), feedback with ratings, AI-generated assignments with JSON content, and student submissions.
- **Classrooms:** Chat rooms with participant lists and persistent whiteboard data, and message history.
- **Notifications:** Event-driven notifications with read/unread status.

All relationships are enforced through foreign keys with appropriate `CASCADE` or `SET_NULL` on-delete behaviour. Unique constraints prevent duplicate enrollments, feedback, and submissions. The database engine can be swapped to PostgreSQL via environment variables without code changes.

---

### R4: Your REST API Code

The application provides a comprehensive REST API with approximately **80 endpoints** across 11 ViewSets and additional function-based views. The API follows RESTful conventions:

- **Resources as nouns:** `/api/courses/`, `/api/users/`, `/api/notifications/`
- **HTTP methods as verbs:** GET (read), POST (create), PATCH (update), DELETE (remove)
- **Meaningful status codes:** 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 502 (Bad Gateway for OpenAI errors)

**Key endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Public registration (student only) |
| POST | `/api/auth/login/` | Login with token return |
| GET | `/api/auth/me/` | Get current user |
| GET | `/api/courses/` | List all active courses |
| POST | `/api/courses/` | Create course (teacher) |
| POST | `/api/courses/{id}/enroll/` | Enrol in course (student) |
| POST | `/api/courses/{id}/unenroll/` | Leave course (student) |
| GET | `/api/courses/{id}/students/` | List enrolled students (teacher) |
| POST | `/api/courses/{id}/block/{sid}/` | Block student from course (teacher) |
| POST | `/api/materials/` | Upload teaching material (teacher) |
| POST | `/api/feedback/` | Submit feedback (enrolled student) |
| POST | `/api/assignments/generate/` | AI-generate quiz/flashcard from PDF |
| POST | `/api/assignment-submissions/` | Submit assignment answers |
| GET | `/api/users/search/` | Search users (teacher) |
| POST | `/api/users/{id}/block/` | Block user account (teacher) |
| POST | `/api/invitations/` | Create invitation (teacher) |
| POST | `/api/invitations/bulk_upload/` | Bulk invite via CSV (teacher) |
| GET | `/api/invite/{token}/` | Validate invitation token (public) |
| POST | `/api/invite/{token}/accept/` | Accept invitation (public) |
| GET | `/api/classrooms/{id}/messages/` | Get chat history |
| POST | `/api/notifications/{id}/mark_read/` | Mark notification as read |

**Access control** is enforced at multiple levels:
- **Role-based:** Only teachers can create courses, upload materials, manage invitations, and search users.
- **Ownership:** Only the course teacher can modify their course; only the feedback author can edit their feedback.
- **Queryset scoping:** Students see only their enrolled courses' data; teachers see only their own courses' data.
- **Registration enforcement:** `RegisterSerializer` forces `user_type='student'` on open registration.

**API documentation** is auto-generated via `drf-spectacular`:
- Swagger UI: `/api/docs/`
- ReDoc: `/api/redoc/`
- OpenAPI Schema: `/api/schema/`

---

### R5: Testing

#### Back-End Tests (132 Test Methods)

The project contains **132 test methods** across **16 test classes** in 4 test files, using Django's `TestCase` and DRF's `APITestCase`.

**accounts/tests.py — 79 tests across 8 classes:**

| Test Class | Tests | Status Codes Covered |
|-----------|-------|---------------------|
| UserModelTest | 6 tests: user type checks, string representation, defaults | N/A (model) |
| StatusUpdateModelTest | 2 tests: string representation, reverse chronological ordering | N/A (model) |
| InvitationModelTest | 9 tests: token auto-generation, expiration logic, validity checks | N/A (model) |
| AuthAPITest | 11 tests: login success/failure, register success/failure, blocked user, auth/me | **200, 201, 400, 401, 403** |
| InvitationAPITest | 20 tests: create/list/resend invitations, bulk CSV upload (valid/invalid/mixed), template download | **200, 201, 400, 403** |
| PublicInviteAPITest | 12 tests: validate/accept tokens, expired/accepted/invalid tokens, duplicate username | **200, 201, 400, 404** |
| UserAPITest | 16 tests: list/retrieve/search users, block/unblock, profile update, blocked user exclusion | **200, 403, 404** |
| StatusUpdateAPITest | 3 tests: create, list, unauthenticated access | **201, 401, 403** |

**courses/tests.py — 31 tests across 6 classes:**

| Test Class | Tests | Status Codes Covered |
|-----------|-------|---------------------|
| CourseModelTest | 6 tests: string rep, default active, enrollment count, average rating | N/A (model) |
| EnrollmentModelTest | 2 tests: string rep, unique constraint | N/A (model) |
| FeedbackModelTest | 2 tests: string rep, unique constraint | N/A (model) |
| CourseAPITest | 15 tests: CRUD, enroll/unenroll, block student, list students/materials | **200, 201, 400, 403** |
| EnrollmentAPITest | 3 tests: visibility by role, inactive exclusion | **200** |
| FeedbackAPITest | 3 tests: create, enrollment check, list | **201, 403** |

**classroom/tests.py — 9 tests across 3 classes:**

| Test Class | Tests | Status Codes Covered |
|-----------|-------|---------------------|
| ClassroomModelTest | 2 tests: string rep, participants | N/A (model) |
| ClassroomMessageModelTest | 2 tests: string rep, ordering | N/A (model) |
| ClassroomAPITest | 5 tests: create room, list, send/get messages, unauth access | **201, 401, 403** |

**notifications/tests.py — 13 tests across 4 classes:**

| Test Class | Tests | Status Codes Covered |
|-----------|-------|---------------------|
| NotificationModelTest | 3 tests: string rep, default is_read, ordering | N/A (model) |
| NotificationAPITest | 6 tests: list, mark read, mark all read, cross-user isolation, unauth | **200, 401, 403** |
| CreateNotificationTest | 4 tests: create with email, skip email, bulk with mass email, email failure resilience | N/A (utility) |

**Status codes covered across all tests:** 200, 201, 204, 400, 401, 403, 404.

**Testing methodology:**
- **Positive paths:** Correct creation, successful operations, expected responses.
- **Negative paths:** Permission denied (student attempting teacher actions), duplicate entries, invalid data, expired tokens.
- **Edge cases:** Re-enrolling after being blocked, accepting expired invitations, CSV with mixed valid/invalid rows, email delivery failure not crashing the app.
- **Mocking:** `unittest.mock.patch` used to mock `send_mail` and `send_mass_mail` for email tests.

#### Front-End Tests (11 Test Files)

Located in `frontend/src/__tests__/`, using Jest and React Testing Library:
- Login, Register, AcceptInvitation, InvitationList, InviteSingle, InviteBulk, CourseCreate, Notifications, Navbar, ProtectedRoute, TeacherHome.

#### Running Tests

```bash
# All back-end tests (132 tests)
docker compose exec backend python manage.py test

# Specific app
docker compose exec backend python manage.py test accounts      # 79 tests
docker compose exec backend python manage.py test courses       # 31 tests
docker compose exec backend python manage.py test classroom     # 9 tests
docker compose exec backend python manage.py test notifications # 13 tests

# Front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## Techniques

This section highlights techniques used in the project, including those beyond the standard course syllabus.

1. **React 18 with TypeScript** — A modern component-based SPA framework with static typing, replacing server-side template rendering with a fully decoupled front-end. TypeScript catches type errors at compile time, improving code reliability.

2. **Vite** — A next-generation build tool with near-instant hot-module replacement (HMR), providing significantly faster development feedback than Webpack-based toolchains.

3. **Django Channels with ASGI** — Asynchronous WebSocket support running alongside HTTP via Daphne. The `AsyncWebsocketConsumer` with `@database_sync_to_async` bridges the async WebSocket layer with Django's synchronous ORM.

4. **HTML5 Canvas API** — Interactive whiteboard with normalised coordinates (0–1 range) for resolution independence, supporting freehand pen, straight lines, text input, eraser, move, and undo tools.

5. **Web Audio API** — Real-time PCM audio streaming from teacher to students via `AudioContext`, `ScriptProcessorNode`, and `AudioBufferSourceNode` for seamless playback with precise timing.

6. **OpenAI API Integration** — AI-powered automatic quiz and flashcard generation from uploaded PDF materials. Text is extracted via `pypdf`, structured prompts are sent to GPT-3.5-turbo, and JSON responses are parsed into auto-gradeable assignments stored in Django's `JSONField`.

7. **Celery with Redis** — Asynchronous task processing using Celery 5.3 with Redis as the message broker (shared with Django Channels). Email delivery and OpenAI API calls are offloaded to background workers via `.delay()`, preventing SMTP latency and long-running AI requests from blocking HTTP responses. Celery Beat provides periodic task scheduling via the Django admin.

8. **Docker Compose** — Containerised development and deployment with five services (Django/Daphne, React/Vite, Redis, Celery Worker, Celery Beat), volume mounts for live development, and `.dockerignore` files for optimised build contexts.

9. **CSS Custom Properties Theming** — A branded visual theme built entirely with CSS custom properties overriding Bootstrap defaults, demonstrating modern CSS theming without modifying framework source files.

10. **React Context API** — Global authentication state management via `AuthContext` with the `useContext` hook, providing `user`, `login`, `logout`, and `refreshUser` across all components.

11. **Dual-Channel Notification System** — Centralised utility functions combining in-app notifications with email delivery via Django's `send_mail`/`send_mass_mail`, with graceful error handling and logging.

12. **OpenAPI / Swagger Documentation** — Automatic API documentation generated by `drf-spectacular` from existing ViewSet and serializer definitions, providing interactive Swagger UI and ReDoc interfaces without manual documentation maintenance.

13. **Token Authentication with WebSocket Middleware** — Custom middleware for WebSocket authentication since WebSocket connections cannot send custom HTTP headers during the handshake. The token is passed via query string and validated against the DRF Token model.

---

## Cloud Hosting

### Deployment on AWS

The application is designed for deployment on AWS using the following architecture:

#### Recommended AWS Architecture

```
                    ┌─────────────────┐
                    │   Route 53      │  ← DNS
                    │  (Domain)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   CloudFront    │  ← CDN (React static assets)
                    │   Distribution  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
    ┌─────────▼─────────┐        ┌─────────▼─────────┐
    │    S3 Bucket       │        │  Application Load  │
    │  (React Build)     │        │    Balancer (ALB)   │
    └────────────────────┘        └─────────┬─────────┘
                                            │
                                  ┌─────────▼─────────┐
                                  │   ECS Fargate      │
                                  │  (Django + Daphne) │
                                  └────┬──────────┬────┘
                                       │          │
                              ┌────────▼──┐ ┌────▼────────┐
                              │ElastiCache│ │    RDS       │
                              │  (Redis)  │ │(PostgreSQL)  │
                              └───────────┘ └─────────────┘
```

#### Deployment Steps

1. **Front-end (S3 + CloudFront):**
   - Build the React SPA: `npm run build` generates static assets in `dist/`.
   - Upload the `dist/` directory to an S3 bucket configured for static website hosting.
   - Create a CloudFront distribution pointing to the S3 bucket for global CDN delivery and HTTPS.
   - Configure CloudFront to redirect all 404s to `index.html` for SPA client-side routing.

2. **Back-end (ECS Fargate):**
   - Build the Docker image from the backend `Dockerfile` and push it to Amazon ECR (Elastic Container Registry).
   - Create an ECS Fargate service using the Docker image, running `daphne -b 0.0.0.0 -p 8080 core.asgi:application`.
   - Place the service behind an Application Load Balancer (ALB) with:
     - HTTP listener redirecting to HTTPS.
     - HTTPS listener forwarding to the ECS target group.
     - WebSocket support enabled (ALB natively supports WebSocket upgrade).
   - Configure environment variables via ECS task definitions: `DJANGO_SECRET_KEY`, `DB_ENGINE`, `DB_NAME`, `REDIS_HOST`, `CORS_ALLOWED_ORIGINS`, etc.

3. **Database (RDS PostgreSQL):**
   - Create an RDS PostgreSQL instance in a private subnet.
   - Set environment variables: `DB_ENGINE=django.db.backends.postgresql`, `DB_NAME=elearning`.
   - The application already supports PostgreSQL via the configurable `DB_ENGINE` setting — no code changes required.
   - Run migrations: `python manage.py migrate`.

4. **Redis (ElastiCache):**
   - Create an ElastiCache Redis cluster for the Django Channels channel layer.
   - Set environment variable: `REDIS_HOST=<elasticache-endpoint>`.
   - Redis handles WebSocket message broadcasting across multiple ECS tasks.

5. **Media Storage (S3):**
   - Configure Django to use `django-storages` with S3 for file uploads (profile photos, course materials, assignment PDFs).
   - This ensures uploaded files persist across container restarts and are accessible from any ECS task.

6. **Email (SES):**
   - Replace Gmail SMTP with Amazon SES for production email delivery.
   - Set `EMAIL_HOST=email-smtp.<region>.amazonaws.com` with SES credentials.

#### Scalability Benefits

- **ECS Fargate** auto-scales based on CPU/memory, handling traffic spikes automatically.
- **Stateless API** with token authentication allows horizontal scaling behind the ALB.
- **Redis channel layer** enables WebSocket message broadcasting across multiple Daphne workers.
- **CloudFront CDN** reduces latency for global users by caching static assets at edge locations.

---

## Critical Evaluation

### Strengths

1. **Decoupled architecture:** The React SPA communicates with the Django back-end exclusively through well-defined API contracts. Each tier is independently testable and replaceable. The front-end can be developed without a running back-end using mock data, and the back-end API can be tested independently via Swagger UI or curl.

2. **Comprehensive real-time features:** The Classroom page combines live chat, a collaborative whiteboard with multiple tools (pen, line, text, eraser, move, undo, clear), and audio streaming — all over a single WebSocket connection with proper access control. This goes significantly beyond a basic chat implementation.

3. **Robust invitation system:** The bulk CSV upload with per-row validation, token-based acceptance links with 30-day expiration, and resend functionality goes beyond the basic registration requirements, supporting real-world institutional use cases.

4. **Dual-channel notifications:** Every in-app notification is also delivered via email through centralised utility functions (`create_notification`, `create_bulk_notifications`), ensuring users are informed even when not logged in. Email failure does not crash the application.

5. **Strong test coverage:** 132 back-end test methods cover positive paths, negative paths, permissions, email delivery mocking, and edge cases. This provides a solid safety net against regressions.

6. **AI-powered assignments:** The OpenAI integration for automatic quiz and flashcard generation from PDF materials adds a modern, practical feature that enhances the teaching experience.

7. **Thorough access control:** Multi-layered permission enforcement — role-based creation checks, ownership verification, queryset scoping, and WebSocket participant verification — ensures that all data access paths are properly secured.

8. **Interactive API documentation:** Auto-generated Swagger UI and ReDoc interfaces via `drf-spectacular` improve developer experience and ensure documentation stays in sync with the implementation.

### Weaknesses and Areas for Improvement

1. **SQLite limitations:** SQLite lacks concurrent write support, making it unsuitable for production with multiple workers. PostgreSQL is already supported via environment variables but was not used by default.

2. **No pagination:** The API returns all results without pagination. For large deployments, `PageNumberPagination` or `CursorPagination` should be added to DRF settings.

3. **ScriptProcessorNode deprecation:** The audio streaming uses `ScriptProcessorNode`, which is deprecated in favour of `AudioWorklet`. While it works in current browsers, future versions should migrate to AudioWorklet for better performance.

4. **No caching:** Frequently accessed data (course lists, user profiles) would benefit from Django's cache framework backed by the already-available Redis instance.

5. **Front-end component complexity:** The Classroom component is approximately 900 lines. Extracting custom hooks (`useWebSocket`, `useWhiteboard`, `useAudioStream`) would improve readability and testability.

6. **No periodic cleanup tasks:** While Celery Beat is configured, no periodic tasks are currently defined. Expired invitations and old notifications could benefit from automatic cleanup via scheduled Celery tasks.

### Comparison of Approaches

**Token vs. JWT authentication:** Database-backed tokens were chosen over JWTs. They are simpler to implement and can be revoked instantly. JWTs would offer stateless scalability but cannot be revoked without a blacklist, negating their stateless advantage. For classroom-scale use, database tokens are pragmatic.

**WebSocket audio vs. WebRTC:** Raw PCM over WebSocket was chosen over WebRTC. WebRTC requires complex signalling and a TURN server for NAT traversal. The WebSocket approach is simpler, works reliably behind firewalls, and leverages the existing WebSocket infrastructure. The trade-off is higher bandwidth (~43 KB/s per listener), acceptable for classroom-sized groups.

**Explicit notifications vs. Django signals:** Notification creation uses explicit utility function calls rather than Django signals. This makes notification logic visible at the call site, easier to debug, and allows passing contextual information. This follows the Python principle "explicit is better than implicit."

---

## Run Information

### Development Environment

- **Operating System:** Windows 11 with WSL2 (Ubuntu), Linux 6.6.87.2-microsoft-standard-WSL2
- **Python:** 3.11 (Docker container, python:3.11-slim)
- **Node.js:** 20 (Docker container, node:20-alpine)
- **Docker:** Docker Desktop with Docker Compose v2

### Installation and Running

```bash
# 1. Unzip the project
unzip claude_elearning.zip
cd claude_elearning

# 2. Start all services (backend, frontend, redis, celery_worker, celery_beat)
docker compose up --build

# 3. (First run only) Run migrations and populate demo data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py populate_db

# 4. Access the application
# Frontend:     http://localhost:5173
# Backend API:  http://localhost:8080/api/
# Django Admin: http://localhost:8080/admin/
# Swagger Docs: http://localhost:8080/api/docs/
# ReDoc:        http://localhost:8080/api/redoc/
```

### Login Credentials

**Django Admin:**

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Teacher (superuser) |

**Teacher Accounts:**

| Username | Password |
|----------|----------|
| john_teacher | teacher123 |
| maria_teacher | teacher123 |

**Student Accounts:**

| Username | Password |
|----------|----------|
| alice_student | student123 |
| bob_student | student123 |
| charlie_student | student123 |
| diana_student | student123 |

### Running Tests

```bash
# All back-end tests (132 tests)
docker compose exec backend python manage.py test

# Specific apps
docker compose exec backend python manage.py test accounts      # 79 tests
docker compose exec backend python manage.py test courses       # 31 tests
docker compose exec backend python manage.py test classroom     # 9 tests
docker compose exec backend python manage.py test notifications # 13 tests

# Front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

### Package Versions

**Back-end (requirements.txt):**

| Package | Version |
|---------|---------|
| Django | 4.2.27 |
| djangorestframework | 3.14.0 |
| channels | 4.0.0 |
| channels-redis | 4.1.0 |
| daphne | 4.0.0 |
| Pillow | 10.2.0 |
| redis | 5.0.1 |
| django-cors-headers | 4.3.1 |
| pypdf | 4.1.0 |
| django-extensions | 4.1 |
| pydotplus | 2.0.2 |
| drf-spectacular | 0.28.0 |
| celery | 5.3.6 |
| django-celery-beat | 2.5.0 |
| django-celery-results | 2.5.1 |

**Front-end (package.json):**

| Package | Version |
|---------|---------|
| react | 18.2.0 |
| react-dom | 18.2.0 |
| react-router-dom | 6.22.0 |
| typescript | 5.3.3 |
| vite | 5.1.0 |
| axios | 1.6.7 |
| bootstrap | 5.3.3 |

---

## Conclusion

This project demonstrates a full-stack eLearning web application built with modern web technologies. The Django back-end provides a comprehensive REST API with 80+ endpoints, token-based authentication, and role-based access control across 12 database models normalised to Third Normal Form. The React front-end delivers a responsive, single-page application with 14 page components, real-time classroom features, and a custom-themed UI.

Key achievements include:

- **All 12 functional requirements (R1a–l)** are satisfied, including real-time chat with a shared whiteboard and audio streaming, AI-powered assignment generation, and a dual-channel notification system.
- **All 5 technical requirements (R2–R5)** are met, with proper use of models, forms, serializers, DRF, URL routing, SQLite, REST API design, and comprehensive testing (132 back-end tests + 11 front-end test files).
- **Advanced techniques** beyond the course syllabus: React with TypeScript, Django Channels with WebSockets, Celery for asynchronous task processing, HTML5 Canvas, Web Audio API, OpenAI API integration, Docker containerisation, and auto-generated API documentation.

The application is containerised for reproducible deployment and has been designed with scalability in mind — stateless API authentication, Redis-backed WebSocket messaging, Celery-based asynchronous task processing, and configurable database engines support future migration to cloud infrastructure such as AWS.

---

## References

1. Django Software Foundation. *Django Documentation 4.2*. https://docs.djangoproject.com/en/4.2/
2. Encode. *Django REST Framework Documentation*. https://www.django-rest-framework.org/
3. Django Channels. *Channels Documentation*. https://channels.readthedocs.io/
4. Meta Platforms. *React Documentation*. https://react.dev/
5. Evan You. *Vite Documentation*. https://vitejs.dev/
6. Mozilla Developer Network. *Web Audio API*. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
7. Mozilla Developer Network. *WebSocket API*. https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
8. Mozilla Developer Network. *Canvas API*. https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
9. OpenAI. *Chat Completions API Documentation*. https://platform.openai.com/docs/api-reference/chat
10. E.F. Codd. *A Relational Model of Data for Large Shared Data Banks*. Communications of the ACM, 1970.
11. Docker Inc. *Docker Compose Documentation*. https://docs.docker.com/compose/
12. Microsoft. *TypeScript Documentation*. https://www.typescriptlang.org/docs/
13. Amazon Web Services. *AWS Documentation*. https://docs.aws.amazon.com/
14. Tom Christie. *drf-spectacular Documentation*. https://drf-spectacular.readthedocs.io/
15. Celery Project. *Celery Documentation*. https://docs.celeryq.dev/
