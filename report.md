# CM3035 Advanced Web Development — Final Coursework Report

# eLearning Web Application

---

## 1. Introduction

This report describes the design, implementation, and evaluation of an eLearning web application developed for the CM3035 Advanced Web Development module. The application allows students and teachers to interact through course management, real-time chat with a shared whiteboard, AI-powered assignment generation, and an integrated notification system with email delivery. The project is built as a decoupled architecture with a Django 4.2 REST back-end served via Daphne (ASGI), and a React 18 single-page application (SPA) front-end built with TypeScript and Vite. Real-time features are powered by Django Channels 4 with a Redis channel layer, and the entire stack is containerised with Docker Compose for reproducible deployment.

The remainder of this report is organised to address the assessment rubric directly. Section 2 presents the application architecture. Section 3 covers the database design and normalisation. Section 4 details the back-end implementation, demonstrating use of Django functionality taught in class (topics 1–10). Section 5 describes the REST API. Section 6 covers asynchronous WebSocket communication. Section 7 describes the front-end design. Section 8 explains authentication and security. Section 9 presents the testing strategy. Section 10 maps every functional and technical requirement to concrete code. Section 11 covers containerisation. Section 12 provides a critical evaluation of the work in relation to the state of the art. Section 13 gives all information needed to install, run, and test the application. Section 14 describes the advanced techniques used beyond the course syllabus.

---

## 2. Application Architecture

The application follows a three-tier, decoupled client–server architecture:

1. **Presentation tier** — a React 18 SPA (TypeScript, Vite, Bootstrap 5) served on port 5173.
2. **Application tier** — a Django 4.2 back-end exposing a REST API via Django REST Framework 3.14 and WebSocket endpoints via Django Channels 4, served by Daphne on port 8080.
3. **Data tier** — an SQLite database (configurable to PostgreSQL via environment variables) and a Redis 7 instance used as the Channels channel layer.

Docker Compose orchestrates all three services (backend, frontend, redis). The front-end communicates with the back-end exclusively through HTTP REST calls (via Axios) and WebSocket connections; there is no server-side template rendering for the user-facing pages. This separation of concerns allows the front-end to be developed, tested, and deployed independently of the back-end, and permits future replacement of either tier without affecting the other.

The choice of React with TypeScript was deliberate: TypeScript provides compile-time type safety that catches many classes of bugs (e.g. passing an incorrect prop type) before they reach the browser, while React's component model enables code reuse across the fourteen page-level components that make up the application. Vite was chosen over Create React App for its significantly faster hot-module replacement (HMR) during development.

---

## 3. Database Design and Normalisation

### 3.1 Entity-Relationship Overview

The data model comprises twelve Django models spread across four apps:

| App | Models |
|-----|--------|
| accounts | User, StatusUpdate, Invitation |
| courses | Course, CourseMaterial, Enrollment, Feedback, Assignment, AssignmentSubmission |
| classroom | Classroom, ClassroomMessage |
| notifications | Notification |

Key relationships:

- **User → Course** (one-to-many via `teacher` ForeignKey with `limit_choices_to={'user_type': 'teacher'}`).
- **User ↔ Course** (many-to-many through the `Enrollment` junction table, which carries additional metadata: `enrolled_at`, `is_active`, `completed`, `completion_date`).
- **User → StatusUpdate** (one-to-many, cascade delete).
- **Course → CourseMaterial** (one-to-many) and **Course → Feedback** (one-to-many).
- **Course → Assignment** (one-to-many) and **Assignment → AssignmentSubmission** (one-to-many).
- **Classroom ↔ User** (many-to-many via Django's built-in intermediary table for the `participants` M2M field).
- **Classroom → ClassroomMessage** (one-to-many).
- **User → Notification** (one-to-many via `recipient` ForeignKey).
- **User → Invitation** (one-to-many via `invited_by` ForeignKey, plus a OneToOneField `created_user` linking to the account that was eventually created from the invitation).

### 3.2 Normalisation to Third Normal Form

**First Normal Form (1NF):** Every column stores atomic values. There are no repeating groups or multi-valued columns. The only fields that store structured data are `Classroom.whiteboard_data` (JSON-encoded list of drawing actions) and `Assignment.content` (JSON-encoded quiz questions or flashcards). These are intentional: the data is always loaded and saved as a whole unit, never queried at the sub-element level, so a JSON text field is more appropriate than creating a separate table with thousands of rows.

**Second Normal Form (2NF):** 2NF requires that every non-key attribute depends on the *entire* primary key. In Django, every model has a single-column surrogate primary key (`id`), so there are no composite keys at the physical level. However, two models have logical composite keys enforced via `unique_together`:

- `Enrollment(student, course)` — additional attributes (`enrolled_at`, `is_active`, `completed`) depend on the full combination of student and course, not on either alone.
- `Feedback(course, student)` — `rating` and `comment` describe a specific student's assessment of a specific course.

Both satisfy 2NF because no non-key attribute depends on only part of the composite candidate key.

**Third Normal Form (3NF):** 3NF requires that no non-key attribute transitively depends on the primary key. Consider the `Course` model: `teacher` is a ForeignKey to `User`. The teacher's name is not stored redundantly in the Course table; it is accessed via the relationship. Similarly, `Enrollment` does not duplicate the course title or the student's name; these are resolved through ForeignKey joins. The serialisers expose denormalised fields such as `teacher_name` and `student_name` using `SerializerMethodField`, but these are computed at serialisation time and are not stored in the database. This approach maintains 3NF in the schema while providing a convenient, flat JSON representation for the API consumer.

The only deliberate denormalisations are the `whiteboard_data` and `Assignment.content` JSON fields, justified above. All other tables are in 3NF.

### 3.3 Referential Integrity and Constraints

Django's ORM enforces referential integrity through foreign-key constraints. The project uses `CASCADE` for most relationships (e.g. deleting a User cascades to their StatusUpdates, Enrollments, Feedback), and `SET_NULL` where the parent record should be preserved even if the related record is removed (e.g. `Invitation.invited_by`). Field-level validation is enforced through Django validators:

- `FileExtensionValidator` on `User.photo` (jpg, jpeg, png) and `CourseMaterial.file` (pdf, doc, docx, ppt, pptx, jpg, jpeg, png, gif, mp4, avi).
- `MinValueValidator(1)` and `MaxValueValidator(5)` on `Feedback.rating`.
- `unique=True` on `Course.code` and `Invitation.token` with `db_index=True` for fast look-ups.

---

## 4. Back-End Implementation (Django Functionality — Topics 1–10)

This section demonstrates how the application makes use of Django functionality as described in class across all ten topics from the CM3035 syllabus.

### 4.1 Topic 1: The Web Stack

The application is built as a full-stack MVC (Model-View-Controller) architecture using Django 4.2. The back-end is organised into four Django apps, each responsible for a distinct domain:

- **accounts** — user management, authentication, invitations, status updates.
- **courses** — course CRUD, materials upload, enrollment, feedback, AI-generated assignments.
- **classroom** — real-time chat rooms, whiteboard, audio streaming via WebSockets.
- **notifications** — notification creation, retrieval, and email delivery.

This modular structure follows Django best practice: models live in `models.py`, business logic in `views.py` and `api.py`, form validation in `forms.py`, and serialisation in `serializers.py`. URL routing is defined per-app in `urls.py` and aggregated at the project level via `include()`. The application is configured in `settings.py` with `INSTALLED_APPS`, `MIDDLEWARE`, `DATABASES`, `TEMPLATES`, and custom settings for CORS, email, and Channels.

### 4.2 Topic 2: Database Schemas and ORMs

The application defines 12 models across four apps, using Django's ORM to map Python classes to SQL tables:

- **Custom User Model** — extends `AbstractUser` with additional fields (`user_type`, `photo`, `bio`, `phone_number`, `date_of_birth`, `ai_api_key`), set via `AUTH_USER_MODEL = 'accounts.User'` as recommended by Django documentation. The `user_type` field uses a `choices` parameter with `'student'` and `'teacher'` options, and convenience methods `is_student()` and `is_teacher()` encapsulate the check.
- **ForeignKey relationships** — `Course.teacher → User`, `Enrollment.student → User`, `Enrollment.course → Course`, `ClassroomMessage.sender → User`, `Notification.recipient → User`, `Assignment.course → Course`, `AssignmentSubmission.assignment → Assignment`.
- **ManyToManyField** — `Classroom.participants` creates the many-to-many relationship between users and chat rooms.
- **OneToOneField** — `Invitation.created_user → User` links an invitation to the account created from it.
- **Model methods** — `Course.get_enrolled_students_count()`, `Course.get_average_rating()`, `Invitation.is_expired`, `Invitation.is_valid`.
- **Meta options** — `ordering`, `unique_together`, `verbose_name_plural` on multiple models.
- **Validators** — `FileExtensionValidator`, `MinValueValidator`, `MaxValueValidator`.
- **Auto-generated fields** — `auto_now_add` for timestamps, `default=uuid.uuid4` for invitation tokens.

All models have migrations generated by `makemigrations` and applied via `migrate`. The ORM maps function calls to SQL queries transparently — for example, `Enrollment.objects.filter(course=course, is_active=True).select_related('student')` generates a single SQL JOIN query. The database schema is normalised to Third Normal Form as detailed in Section 3.

### 4.3 Topic 3: Interaction through Serving HTML, CSS and JavaScript

The project provides Django templates for server-side rendering, using Django's templating language with forms and validators for user input:

**Templates** extend a `base.html` layout and are organised per-app:
- `courses/templates/courses/` — `course_list.html`, `course_detail.html`, `course_form.html`, `course_confirm_delete.html`, `upload_material.html`, `unenroll_confirm.html`, `submit_feedback.html`, `block_student.html`.
- `accounts/templates/accounts/` — `login.html`, `register.html`.

Templates use Django template tags (`{% extends %}`, `{% block %}`, `{% for %}`, `{% if %}`, `{% url %}`) and template filters.

**Forms and validators** — seven form classes are defined across two apps:
- **accounts/forms.py** — `UserRegistrationForm` (extends `UserCreationForm` with `email`, `full_name`, `user_type`), `UserProfileUpdateForm`, `StatusUpdateForm`, `UserSearchForm`.
- **courses/forms.py** — `CourseForm` (uses `DateInput` widgets for dates), `CourseMaterialForm`, `FeedbackForm` (uses `RadioSelect` widget for 1–5 star rating).

Forms provide server-side validation with custom widget configuration:
```python
widgets = {
    'start_date': forms.DateInput(attrs={'type': 'date'}),
    'end_date': forms.DateInput(attrs={'type': 'date'}),
}
```

Function-based views in `courses/views.py` handle server-side rendered pages:
- `course_list`, `course_detail`, `course_create`, `course_update`, `course_delete` — full CRUD with `@login_required` decorator.
- `enroll_course`, `unenroll_course` — enrollment management with role checks.
- `upload_material` — file upload handling with `request.FILES`.
- `submit_feedback`, `block_student` — additional course actions.

### 4.4 Topic 4: Build a CRUD and RESTful API (Part 1)

The API layer is built entirely with Django REST Framework (DRF) 3.14, implementing RESTful CRUD operations:

- **ModelViewSet** for full CRUD operations (CourseViewSet, CourseMaterialViewSet, FeedbackViewSet, AssignmentViewSet, AssignmentSubmissionViewSet, StatusUpdateViewSet, ClassroomViewSet).
- **ReadOnlyModelViewSet** for read-only resources (UserViewSet, EnrollmentViewSet, NotificationViewSet).
- **DefaultRouter** for automatic URL generation from ViewSets, mapping HTTP methods to CRUD operations (GET→Read, POST→Create, PUT/PATCH→Update, DELETE→Destroy).
- **17 Serialisers** across all apps, handling both input validation and output representation:
  - `SerializerMethodField` for computed, read-only fields (`teacher_name`, `enrolled_count`, `average_rating`, `participant_names`, `last_message`, `course_title`, `student_name`).
  - Custom `validate_email` on `InvitationSerializer` checking for existing users and pending invitations.
  - `AcceptInvitationSerializer` validating username uniqueness, password strength via Django's `validate_password`, and password confirmation matching.
- **Custom actions** via `@action` decorator for operations beyond standard CRUD: `enroll`, `unenroll`, `block_student`, `add_student`, `students`, `materials`, `search`, `mark_read`, `mark_all_read`, `bulk_upload`, `download_template`, `generate`, `join`, `messages`, `send`.
- **Custom permission classes** — `IsTeacher` checks `request.user.is_teacher() or request.user.is_staff`.
- **Object-level permissions** — `perform_update` and `perform_destroy` on CourseViewSet, CourseMaterialViewSet, FeedbackViewSet, and AssignmentViewSet verify ownership before allowing modification.
- **Parser classes** — `MultiPartParser` and `JSONParser` for file upload endpoints.
- **Queryset optimisation** — `select_related('teacher')`, `select_related('student')`, `select_related('sender')` to prevent N+1 query problems.

**Unit testing** (also introduced in Topic 4) — the project contains 132 test methods using Django's `TestCase` and DRF's `APITestCase`, covering model behaviour, API endpoints, permissions, and edge cases. Details in Section 9.

### 4.5 Topic 5: Build a CRUD and RESTful API (Part 2) — AJAX and SPA

The front-end is built as a single-page application (SPA) using React 18 with TypeScript, consuming the REST API entirely via AJAX calls (Axios). There is no server-side template rendering for the user-facing pages — the React SPA communicates with the back-end exclusively through HTTP REST calls and WebSocket connections.

Key SPA patterns implemented:

- **Axios client** with base URL configuration and a request interceptor that attaches the authentication token to every request.
- **React Router DOM 6** for client-side routing via `BrowserRouter` — page transitions happen without full page reloads.
- **Optimistic UI updates** — after mutations (POST/PATCH/DELETE), the frontend state is updated immediately without waiting for a page refresh. For example, after submitting feedback, the new feedback is appended to the local state array immediately.
- **AJAX data fetching** via `useEffect` hooks that call the REST API on component mount.
- **JavaScript API consumption** — every page component interacts with the server-side API using Axios for CRUD operations (e.g. `client.get('/courses/')`, `client.post('/courses/${id}/enroll/')`, `client.patch('/users/update_profile/', formData)`).

### 4.6 Topic 6: Asynchronous Web Services — Django Channels and WebSockets

The application uses Django Channels 4 to handle WebSocket connections alongside standard HTTP, with Redis as the channel layer. This is covered in detail in Section 6. Key implementations:

- **ASGI configuration** (`asgi.py`) — `ProtocolTypeRouter` routing HTTP to Django's ASGI handler and WebSocket to the Channels URL router, wrapped in custom `TokenAuthMiddleware`.
- **Daphne ASGI server** — replaces Django's built-in `runserver` to handle both HTTP and WebSocket connections.
- **`AsyncWebsocketConsumer`** (`ClassroomConsumer`) — handles chat messages, whiteboard drawing, and audio streaming via a dispatch pattern in `receive()`.
- **`@database_sync_to_async`** — bridges the async WebSocket layer with Django's synchronous ORM for database operations.
- **Redis channel layer** (`channels_redis.core.RedisChannelLayer`) — enables broadcasting messages to all participants in a chat room via `group_send` and `group_add`.
- **WebSocket routing** — `URLRouter` with `path('ws/classroom/<str:room_name>/', ClassroomConsumer.as_asgi())`.

Note: While Celery was covered in the course material, the project uses synchronous email sending via Django's `send_mail` instead of Celery for background tasks, as the classroom-scale workload does not require asynchronous task processing. This is discussed in Section 12.3 as a future improvement.

### 4.7 Topic 7: Working with External APIs

The application integrates with the **OpenAI API** for AI-powered quiz and flashcard generation:

- **API consumption** — the `generate` action on `AssignmentViewSet` calls `https://api.openai.com/v1/chat/completions` using Python's `urllib.request` module, sending a structured prompt and parsing the JSON response.
- **PDF text extraction** — uses the `pypdf` library to extract text from uploaded PDF materials, which is then sent as context to the OpenAI API.
- **Per-user API keys** — teachers store their own OpenAI API key in their user profile (`User.ai_api_key`), which is used to authenticate API calls. This avoids storing a shared key on the server.
- **Structured JSON responses** — the prompt instructs the AI to return responses in a specific JSON format (quiz questions with options and correct answers, or flashcards with front/back pairs), which are parsed and stored in Django's `JSONField`.

The invitation system also demonstrates working with **email as an external service** — Django's `send_mail` function connects to Gmail's SMTP server (`smtp.gmail.com:587`) with TLS encryption and Google App Password authentication.

### 4.8 Topic 8: User Authentication and Security

Authentication uses multiple Django mechanisms:

- **DRF Token Authentication** — tokens generated on login/registration, sent via `Authorization: Token <key>` header. Token-based auth is used instead of session-based auth for the SPA.
- **Django's built-in authentication** — `authenticate()` and `login()` in server-side views.
- **`@login_required` decorator** — on all function-based views.
- **Custom middleware** — `TokenAuthMiddleware` in `classroom/middleware.py` for WebSocket authentication (extracts token from query string, attaches user to scope).
- **Blocked user check** — login is denied for users with `is_blocked=True`.
- **Custom permission classes** — `IsTeacher` restricts invitation management to teacher accounts.

Security measures addressing common web application vulnerabilities:

- **CORS** restricted to the front-end origin via `django-cors-headers`, preventing cross-origin request forgery from unauthorised domains.
- **CSRF protection** enabled (token-authenticated API requests are exempt per DRF convention).
- **Password hashing** via Django's default PBKDF2 hasher — passwords are never stored in plain text.
- **Password validation** using Django's built-in validators (MinimumLengthValidator, CommonPasswordValidator, etc.).
- **Input validation** at both the serialiser and model levels, preventing injection attacks.
- **File upload validation** using `FileExtensionValidator` to restrict uploaded file types.
- **Object-level permission enforcement** — every CRUD endpoint verifies ownership before allowing update or delete operations (see Section 5.1).
- **WebSocket access control** — connections are rejected if the user is not an authenticated participant of the chat room.
- **Message length limits** — chat messages capped at 5000 characters to prevent abuse.

### 4.9 Topic 9: Deploying a Website

The application is containerised for deployment using Docker Compose with three services:

- **backend** — Python 3.11-slim, runs `daphne -b 0.0.0.0 -p 8080 elearning_project.asgi:application`. Daphne is a production-grade ASGI server (unlike Django's built-in `runserver`).
- **frontend** — Node 20-alpine, runs `npm run dev -- --host`. In production, Vite's `build` command would generate static assets served by Nginx.
- **redis** — Redis 7-alpine, used as the Channels channel layer.

Production configuration considerations implemented:
- **Environment variables** loaded from `.env` file (`DEBUG`, `ALLOWED_HOSTS`, `SECRET_KEY`, `EMAIL_HOST_PASSWORD`), keeping secrets out of source code.
- **`.dockerignore` files** for both backend and frontend, excluding `__pycache__`, `db.sqlite3`, `.env`, `node_modules`, and `media/` from build contexts to reduce image size and prevent secret leakage.
- **Volume mounts** for live development; media files stored in a named Docker volume.
- **Database configurability** — `DB_ENGINE` and `DB_NAME` environment variables allow switching from SQLite to PostgreSQL without code changes.

### 4.10 Topic 10: Load Balancing and Scalability

While the application currently runs as a single-instance deployment, several design decisions support future scalability:

- **Stateless API** — Token-based authentication (not session-based) means any backend instance can handle any request, enabling horizontal scaling behind a load balancer.
- **Redis channel layer** — Django Channels uses Redis for inter-process communication, so multiple Daphne workers can broadcast WebSocket messages to each other. This is essential for scaling WebSocket connections across multiple server instances.
- **Query optimisation** — `select_related()` is used throughout to prevent N+1 query problems (e.g. `select_related('sender')` on chat messages, `select_related('teacher')` on courses, `select_related('student')` on enrollments). These would be identified by profiling tools like Django Debug Toolbar or `django-silk`.
- **Database configurability** — The SQLite database can be replaced with PostgreSQL for concurrent write support, which is necessary when running multiple Daphne workers behind a load balancer.
- **Whiteboard action cap** — The 500-action limit on whiteboard data prevents unbounded JSON field growth that would degrade performance over time.
- **Bulk email delivery** — `send_mass_mail()` uses a single SMTP connection for all recipients, reducing overhead compared to individual `send_mail()` calls.

### 4.11 Additional Django Features

**Django Admin** — All 12 models are registered with Django Admin using custom `ModelAdmin` classes with `list_display`, `list_filter`, `search_fields`, and `readonly_fields`. The Django admin is accessible at `http://localhost:8080/admin/`.

**Notification System with Email Delivery** — The notification system is event-driven and dual-channel (in-app + email). A centralised utility module (`notifications/utils.py`) provides two functions:

- **`create_notification()`** — creates an in-app `Notification` record and sends an email to the recipient via Django's `send_mail()` if the recipient has an email address. Uses `fail_silently=True` and try/except with logging to ensure email delivery failures do not crash the application.
- **`create_bulk_notifications()`** — creates notifications for multiple recipients and sends emails efficiently using Django's `send_mass_mail()` in a single SMTP connection.

These utilities are called from nine distinct event points across the application:

| Event | Recipient | Type |
|-------|-----------|------|
| Student enrols in course | Teacher | enrollment |
| Student unenrolls from course | Teacher | enrollment |
| Teacher blocks student from course | Student | enrollment |
| Teacher adds student to course | Student | enrollment |
| Teacher uploads new material | All enrolled students | material |
| Student submits feedback | Teacher | feedback |
| Student submits assignment | Teacher | general |
| Assignment deadline set/changed | All enrolled students | deadline |
| Course deleted by teacher | All enrolled students | general |

Email is configured via SMTP (Gmail) in `settings.py` with `EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'`, `EMAIL_HOST = 'smtp.gmail.com'`, and `EMAIL_USE_TLS = True`.

### 4.12 Architecture Pattern: Model → Serializer → ViewSet

The back-end follows a layered architecture pattern that separates data storage, data transformation, and request handling into three distinct layers. This pattern is central to how Django REST Framework applications are structured, and understanding it is key to understanding why the code is organised the way it is.

**Layer 1: Models — The Data Layer**

Models define *what* data exists and *how it is stored*. Each model maps to a database table and encapsulates field definitions, relationships (ForeignKey, ManyToManyField), constraints (unique_together, validators), and domain-specific methods (e.g. `Course.get_average_rating()`). Models are the single source of truth for the data schema — they do not know about HTTP, JSON, or API consumers.

**Why separate this?** By isolating the data definition, the same models can be used by the REST API, Django Admin, management commands, WebSocket consumers, and background tasks without duplication. If the database schema changes (e.g. adding a field), only the model needs updating — the serialiser and view can adapt independently.

**Layer 2: Serializers — The Transformation Layer**

Serializers sit between the model and the API consumer. They control *what data is exposed* and *how it is validated*. A `ModelSerializer` automatically maps model fields to JSON, but the real value comes from customisation:

- **Controlling output shape** — `SerializerMethodField` computes derived fields (`teacher_name`, `enrolled_count`, `average_rating`) without storing them in the database, maintaining 3NF normalisation while providing a flat, convenient JSON response.
- **Input validation** — serializers validate incoming data before it reaches the database. For example, `AcceptInvitationSerializer` validates password strength, checks username uniqueness, and confirms password matching — all before the model's `save()` is called.
- **Decoupling internal and external representations** — the model might store a ForeignKey to `User`, but the serialiser exposes `teacher_name` as a string. This means the API contract can remain stable even if the internal model relationships change.

**Why not validate in the model?** Models enforce database-level constraints (unique, not null, validators). Serializers enforce API-level constraints (password confirmation matching, checking if an email already has an invitation, cross-field validation). Separating these concerns means models remain reusable across contexts (admin, CLI, tests) while serializers handle API-specific logic.

**Layer 3: ViewSets — The Request Handling Layer**

ViewSets control *who can do what* and *how requests are processed*. They handle:

- **Authentication and permissions** — ensuring the user is logged in and has the right role.
- **Business logic** — `perform_create` sets the course teacher to `request.user`, checks teacher role, verifies course ownership. These are not pure data operations — they encode business rules about who can create what.
- **Queryset scoping** — `get_queryset` filters data based on the requesting user's role and relationships, ensuring students only see their enrolled courses and teachers only see their own.
- **Custom actions** — `@action` methods like `enroll`, `unenroll`, `generate` implement operations that don't map to standard CRUD but are essential to the domain.

**Why not put business logic in the model or serializer?** Models should not depend on `request.user` — they are request-agnostic. Serializers should not handle permission checks — they validate data shape and content. ViewSets are the layer that bridges the HTTP request context with the data layer, making them the right place for access control and request-specific business logic.

**How the layers work together (example: creating a course):**

1. **ViewSet** receives the POST request → checks authentication → calls `perform_create`.
2. **`perform_create`** verifies `request.user.is_teacher()` → passes `teacher=request.user` to the serialiser.
3. **Serializer** validates the incoming data (title, code, dates) → calls `model.save()`.
4. **Model** writes the row to the database, enforcing field constraints and generating the auto-increment ID.
5. **Serializer** converts the saved model instance back to JSON, computing `teacher_name`, `enrolled_count` etc.
6. **ViewSet** returns the serialised JSON with a `201 Created` status.

Each layer has a single responsibility and can be tested independently. The model tests verify data integrity, the serialiser tests verify JSON shape and validation, and the ViewSet tests verify permissions and HTTP behaviour.

---

## 5. REST API Design

The API follows RESTful conventions: resources are nouns (`/api/courses/`, `/api/users/`), HTTP methods indicate the operation (GET for reads, POST for creates, PATCH for updates, DELETE for removes), and status codes convey outcomes (200, 201, 400, 403, 404). The API exposes approximately 80 endpoints through 11 ViewSets plus additional function-based views. Highlights include:

- `GET /api/users/search/?q=<query>&user_type=<type>` — teacher-only search across username, full_name, and email using case-insensitive icontains lookups.
- `POST /api/courses/{id}/enroll/` — student enrols; creates Enrollment and Notification with email.
- `POST /api/courses/{id}/unenroll/` — student unenrols; notifies teacher.
- `POST /api/courses/{id}/block/{student_id}/` — teacher deactivates a student's enrollment; notifies student.
- `POST /api/courses/{id}/add_student/` — teacher manually adds a student; notifies student.
- `GET /api/courses/{id}/students/` — teacher-only; lists enrolled students.
- `GET /api/courses/{id}/materials/` — restricted to enrolled students and course teacher.
- `POST /api/assignments/generate/` — AI-powered quiz/flashcard generation from PDF upload.
- `POST /api/invitations/bulk_upload/` — accepts a CSV file, validates headers and data, creates invitations in bulk, and returns per-row error details.
- `GET /api/invite/{token}/` and `POST /api/invite/{token}/accept/` — public endpoints for the invitation acceptance flow.
- `POST /api/notifications/{id}/mark_read/` and `POST /api/notifications/mark_all_read/` — notification management.
- `POST /api/classrooms/{id}/send/` — send a message with length validation (max 5000 characters).
- `GET /api/classrooms/{id}/messages/` — retrieve messages with `select_related('sender')` optimisation.

CORS is configured via `django-cors-headers` to allow the React dev server at `localhost:5173` to make cross-origin requests to the API at `localhost:8080`.

### 5.1 API Documentation (OpenAPI / Swagger)

The API is documented using **drf-spectacular**, which automatically generates an OpenAPI 3.0 schema from the DRF ViewSets and serialisers. The schema powers two interactive documentation interfaces:

- **Swagger UI** at `/api/docs/` — interactive API explorer where developers can browse endpoints, view request/response schemas, and test API calls directly from the browser.
- **ReDoc** at `/api/redoc/` — a clean, three-panel documentation layout suitable for reading and reference.
- **Raw schema** at `/api/schema/` — the OpenAPI 3.0 JSON schema, usable by code generators and API testing tools.

The schema is generated automatically from the existing ViewSet definitions, serialiser fields, and URL routing — no manual documentation is required. This ensures the documentation stays in sync with the actual API behaviour. The project documents approximately 47 API endpoints across all ViewSets.

### 5.2 Access Control

Every API endpoint enforces appropriate access control at multiple levels: role-based checks on creation, ownership verification on updates and deletes, and queryset scoping to prevent data leakage.

**Creation-level permission checks (`perform_create`):**

- **Course creation** — only users with `user_type='teacher'` can create courses. The `perform_create` method checks `request.user.is_teacher()` and raises `PermissionDenied` if a student attempts to create a course via a direct API request. The teacher is automatically set as the course owner.
- **Assignment creation** — only teachers can create assignments, and only for their own courses. The `perform_create` method verifies both `is_teacher()` and that `course.teacher == request.user`, preventing a teacher from creating assignments in another teacher's course.
- **Feedback creation** — only students enrolled in a course can submit feedback. The `perform_create` method checks `is_student()` and verifies an active `Enrollment` exists for the student and the target course.
- **Assignment submission** — students must be enrolled in the course to submit. The `perform_create` method verifies an active `Enrollment` exists for `request.user` and `assignment.course`.
- **Registration role enforcement** — the `RegisterSerializer` forces `user_type='student'` on open registration, preventing privilege escalation. Teacher accounts can only be created via the invitation system by an existing teacher.

**Update/delete ownership checks (`perform_update`/`perform_destroy`):**

- **Course CRUD** — only the course teacher can update or delete their own courses.
- **Material upload** — only the course teacher can upload materials to their own courses; only the uploader can modify or delete.
- **Feedback** — only the feedback author can edit or delete their own feedback.
- **Assignment CRUD** — only the assignment creator can modify or delete assignments.

**Queryset scoping (`get_queryset`):**

- **Feedback visibility** — students see feedback only for courses they are enrolled in; teachers see feedback only for their own courses. This prevents any user from viewing feedback for courses they have no relationship with.
- **Assignment visibility** — students see assignments only for courses they are enrolled in; teachers see assignments only for courses they teach.
- **Assignment submissions** — students see only their own submissions; teachers see only submissions for their own courses.
- **Classroom rooms** — users see only rooms they participate in; messages and sending are restricted to room participants.

**Endpoint-level restrictions:**

- **Student list** — only the course teacher can view enrolled students via the API.
- **Materials list** — only enrolled students or the course teacher can access course materials.
- **Invitations** — only teachers can create and manage invitations.
- **User search** — restricted to teacher accounts only.

---

## 6. Real-Time Communication with WebSockets

### 6.1 Django Channels and ASGI

The application uses Django Channels 4 to handle WebSocket connections alongside standard HTTP. The ASGI entry point (`asgi.py`) uses `ProtocolTypeRouter` to route HTTP requests to Django's standard ASGI handler and WebSocket connections to the Channels URL router, wrapped in a custom `TokenAuthMiddleware`.

The Channels layer uses Redis as the backing store (`channels_redis.core.RedisChannelLayer`), which enables message passing between multiple worker processes — essential for broadcasting messages to all participants in a chat room.

### 6.2 Token Authentication Middleware

WebSocket connections cannot send custom HTTP headers during the handshake, so token authentication is implemented via a query string parameter. The custom `TokenAuthMiddleware` in `classroom/middleware.py` extracts the `token` query parameter from the WebSocket URL, looks up the corresponding `Token` object, and attaches the associated user to the connection's `scope`. If the token is missing or invalid, `AnonymousUser` is assigned, and the consumer's `connect()` method rejects the connection with `await self.close()`.

### 6.3 Chat Consumer

The `ClassroomConsumer` in `classroom/consumers.py` is an `AsyncWebsocketConsumer` that handles multiple message types through a dispatch pattern in the `receive()` method:

- **Chat messages** (`type: 'chat'`) — validated for length (max 5000 characters), saved to the database via `@database_sync_to_async`, and broadcast to all room members.
- **Whiteboard actions** (`type: 'draw' | 'line' | 'text' | 'erase' | 'move' | 'undo' | 'clear'`) — teacher-only; persisted in the `whiteboard_data` JSON field (capped at 500 actions to prevent unbounded growth) and broadcast for real-time rendering on all connected clients.
- **Audio streaming** (`type: 'audio_start' | 'audio_stop' | 'audio_data'`) — teacher-only; broadcasts raw PCM audio data (base64-encoded 16 kHz Int16 samples) to all room members. The `audio_data` handler skips echoing back to the teacher to prevent feedback loops.

**Access control:** On WebSocket connection, the consumer verifies that the user is authenticated and is a participant in the requested room via `is_participant()`. Unauthenticated users or non-participants have their connections immediately closed. This prevents unauthorised access to chat rooms via the WebSocket layer.

On connection, the consumer sends the full whiteboard state to the joining client, ensuring late joiners see the current board. The consumer also joins a per-user group (`classroom_{room}_user_{username}`) for targeted signalling messages.

### 6.4 Whiteboard Implementation Detail

The whiteboard uses an HTML5 Canvas with a fixed logical resolution of 1920x1080, rendered via CSS `aspect-ratio: 16/9` to maintain consistent proportions across different screen sizes. All drawing coordinates are normalised to the 0–1 range before transmission, so a point at (960, 540) is sent as (0.5, 0.5). This normalisation ensures that drawings appear in the same relative position regardless of the client's actual canvas dimensions.

The whiteboard supports five tools: pen (freehand drawing), line (straight lines between two points), text (inline text input at click position), eraser (white overdraw with adjustable width), and move (drag text and line elements to new positions). Each tool action is sent as a typed WebSocket message (e.g. `{type: 'draw', points: [[0.1, 0.2], ...], color: '#000', width: 3}`), stored server-side in the `whiteboard_data` JSON field, and broadcast to all room members for real-time rendering. The undo feature removes the last action from the server-side list and broadcasts a `wb_undo` message; clients respond by popping the last action from their local array and replaying all remaining actions.

The server-side whiteboard data is capped at 500 actions. When the limit is reached, the oldest actions are dropped to make room for new ones. This prevents the `whiteboard_data` JSON field from growing unboundedly during long classroom sessions.

The `@database_sync_to_async` decorator is used throughout the consumer for database operations, since Django's ORM is synchronous. Each whiteboard mutation (append, pop, move, clear) reads the current JSON, modifies it in Python, and writes it back.

### 6.5 Front-End Audio Streaming

The audio streaming implementation uses the Web Audio API for maximum browser compatibility:

- **Teacher side:** `getUserMedia()` captures the microphone, an `AudioContext` with a `ScriptProcessorNode` captures raw PCM samples, which are downsampled from the native sample rate (typically 48 kHz) to 16 kHz, encoded as Int16 arrays, base64-encoded, and sent via WebSocket every ~85 ms (4096 samples at 48 kHz).
- **Student side:** On receiving `audio_start`, the student creates an `AudioContext`. Each `audio_data` chunk is decoded from base64 to Int16, converted to Float32, wrapped in an `AudioBuffer`, and scheduled for seamless playback using `AudioBufferSourceNode.start()` with precise timing. A latency cap of 1 second prevents runaway buffering.

This approach avoids the complexity of WebRTC (offer/answer/ICE negotiation) and the fragility of the MediaSource Extensions API with audio-only WebM, while achieving low-latency one-to-many broadcasting.

---

## 7. Front-End Implementation

### 7.1 Technology Stack

The front-end is built with React 18 and TypeScript 5.3, bundled with Vite 5.1. Bootstrap 5.3 provides the CSS framework, enhanced with custom CSS properties for a branded theme (gradient accent colours, card styling, custom navbar). React Router DOM 6 handles client-side routing via a `BrowserRouter`. Axios is configured with a base URL and an interceptor that attaches the authentication token to every request.

### 7.2 State Management

Global authentication state is managed through React Context (`AuthContext`), providing `user`, `login`, `logout`, and `refreshUser` functions to all components via the `useAuth()` hook. Per-page state uses React's built-in `useState` and `useRef` hooks. The Classroom page, the most complex component (approximately 900 lines), manages WebSocket connections, canvas drawing state, inline text input, audio streaming, and chat messages — all via local state and refs. A custom reconnection mechanism in the WebSocket `useEffect` automatically re-establishes the connection with a 2-second retry if the backend restarts.

### 7.3 Key Pages (14 Components)

- **StudentHome** and **TeacherHome** — role-specific dashboards showing enrolled/taught courses, status update feeds, and (for teachers) a live user search interface with add-student functionality.
- **CourseDetail** — displays course information, materials (with download links), enrolled student list (teacher view), feedback form (student view), and assignment management.
- **CourseCreate** — form for teachers to create new courses with code, title, description, and dates.
- **AssignmentView** — quiz-taking interface for students (multiple-choice with auto-scoring), flashcard review (flip-card interaction), score display, and submission history. Teachers see all student submissions.
- **Classroom** — the real-time feature hub with a shared whiteboard (pen, line, text, eraser, move tools with adjustable sizes and colours), live chat, and audio streaming.
- **Profile** — shows user information, status updates, taught/enrolled courses, upcoming deadlines, and AI API key management. Editable by the owner with photo upload.
- **InviteBulk** — drag-and-drop CSV upload for bulk student invitations with per-row validation feedback and a downloadable CSV template.
- **InviteSingle** — form for inviting individual students with email, name, user type, and optional date of birth.
- **InvitationList** — teacher's dashboard showing all sent invitations with status (pending/accepted/expired) and resend functionality.
- **AcceptInvitation** — public page for accepting invitation links with username/password creation form.
- **Login** and **Register** — authentication pages with form validation.
- **Notifications** — displays all in-app notifications with mark-as-read functionality and mark-all-read.

### 7.4 Custom Theming

The application uses a custom CSS theme (`theme.css`) built on CSS custom properties that override Bootstrap's defaults. This provides a branded look with gradient accents, custom card styles, navbar styling, avatar gradients, and glow effects — all without modifying Bootstrap's source. The theme demonstrates how CSS custom properties enable theming beyond Bootstrap's built-in utilities:

```css
:root {
  --el-green: #2ecc71;
  --el-blue: #3498db;
  --el-gradient: linear-gradient(135deg, var(--el-green), var(--el-blue));
}
```

---

## 8. Authentication and Security

Authentication uses DRF's `TokenAuthentication`. On login or registration, the server generates and returns a token. The React front-end stores this token in `localStorage` and attaches it to every Axios request via an interceptor. WebSocket authentication is handled by the custom `TokenAuthMiddleware` described in Section 6.2.

Security measures include:

- **CORS** restricted to the front-end origin via `django-cors-headers`.
- **CSRF protection** enabled (though token-authenticated API requests are exempt per DRF convention).
- **Password hashing** via Django's default PBKDF2 hasher.
- **Password validation** using Django's built-in validators (MinimumLengthValidator, etc.).
- **Input validation** at both the serialiser and model levels.
- **File upload validation** using `FileExtensionValidator` to restrict uploaded file types.
- **Blocked user handling** — blocked users cannot log in (checked during `auth_login`) and are excluded from user lists.
- **Multi-layered permission enforcement:**
  - *Creation checks:* Course creation restricted to teachers. Assignment creation restricted to the owning teacher. Feedback restricted to enrolled students. Submissions restricted to enrolled students. Registration forces student role (teachers created via invitation only).
  - *Ownership checks:* CourseViewSet, CourseMaterialViewSet, FeedbackViewSet, and AssignmentViewSet verify ownership before allowing update or delete operations.
  - *Queryset scoping:* Feedback, assignments, and submissions are filtered by user role — students see only enrolled-course data, teachers see only their own courses' data.
- **Endpoint-level access control:**
  - Students endpoint restricted to course teacher only.
  - Materials endpoint restricted to enrolled students and course teacher.
  - Assignment submissions scoped to own courses for teachers.
  - Classroom rooms filtered to participants only; messages/send restricted to participants.
- **WebSocket access control** — connections are rejected if the user is not an authenticated participant of the chat room.
- **Message length limits** — chat messages capped at 5000 characters in both API and WebSocket layers.
- **Whiteboard action limits** — capped at 500 actions to prevent memory exhaustion.

---

## 9. Testing Strategy

### 9.1 Back-End Tests

The project contains 132 test methods across four test files using Django's `TestCase` and DRF's `APITestCase`:

- **accounts/tests.py** — 79 test methods across 8 test classes covering: user model methods (`is_student`, `is_teacher`, `str`), status update CRUD and ordering, invitation lifecycle (creation, token generation, expiration, resend, bulk upload with CSV validation), authentication API (login, register, token management, blocked user denial), user search (by name, email, type with self-exclusion), user blocking/unblocking with permission checks, and profile updates.
- **courses/tests.py** — 31 test methods across 6 test classes covering: course model methods (`get_enrolled_students_count`, `get_average_rating`), enrollment unique constraints and string representations, feedback unique constraints, course API operations (CRUD, enroll/unenroll, block student, student listing, material listing), enrollment visibility filtering (students see own enrollments, teachers see course enrollments), and permission enforcement (feedback requires enrollment, unenrolled users are denied).
- **classroom/tests.py** — 9 test methods across 3 test classes covering: room and message models (string representation, ordering, participants), and chat room API (create, list, send message, get messages, unauthenticated access denial).
- **notifications/tests.py** — 13 test methods across 4 test classes covering: notification model properties (string representation, default is_read, ordering), notification API (list, mark read, mark all read, cross-user isolation, unauthenticated access), and utility function tests (create_notification with email, skip email when no address, bulk notification with mass email, email failure resilience using `unittest.mock.patch`).

### 9.2 Test Coverage and Methodology

Tests verify both positive paths (correct creation, successful operations) and negative paths (permission denied, duplicate entries, invalid data, expired tokens). The `setUp` method in each test class creates isolated test data, ensuring tests are independent and reproducible.

**Permission tests** are particularly thorough: every teacher-only action is tested with both a teacher account (expecting success) and a student account (expecting 403 Forbidden), ensuring that role-based access control works correctly. Edge cases covered include:

- Re-enrolling after being blocked (reactivation logic).
- Accepting an expired invitation token.
- Uploading a CSV with missing headers, duplicate emails, or invalid data.
- Bulk upload with mixed valid/invalid rows returning per-row error details.
- Email delivery failure not crashing notification creation (mock `send_mail` raising `Exception`).
- Mark-all-read not affecting other users' notifications.

**Mock testing:** The notification utility tests use `unittest.mock.patch` to mock `send_mail` and `send_mass_mail`, verifying that emails are sent correctly without requiring a real SMTP server during testing.

### 9.3 Front-End Tests

The front-end includes 12 test files under `src/__tests__/` using Jest and React Testing Library, covering rendering and basic interactions for Login, Register, AcceptInvitation, InvitationList, InviteSingle, InviteBulk, CourseCreate, Notifications, Navbar, ProtectedRoute, and TeacherHome components.

### 9.4 Running Tests

```bash
# Run all 132 back-end tests
docker compose exec backend python manage.py test

# Run tests for a specific app
docker compose exec backend python manage.py test accounts    # 79 tests
docker compose exec backend python manage.py test courses     # 31 tests
docker compose exec backend python manage.py test classroom        # 9 tests
docker compose exec backend python manage.py test notifications  # 13 tests

# Run front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## 10. Meeting the Requirements

### R1 — Functional Requirements

| Req | Description | Implementation |
|-----|-------------|----------------|
| a | Account creation | `RegisterSerializer` + `auth_register` API + `Register.tsx` |
| b | Login/Logout | `auth_login`/`user_logout` APIs + `Login.tsx` with token management |
| c | Teacher search | `UserViewSet.search` with icontains on username, full_name, email + filter by user_type |
| d | Add courses | `CourseViewSet.create` (teacher auto-set via `perform_create`) + `CourseCreate.tsx` |
| e | Student enrolment | `CourseViewSet.enroll`/`unenroll` actions + Enrollment model with unique constraint |
| f | Course feedback | `FeedbackViewSet` + Feedback model (rating 1–5 + comment, unique per student–course) |
| g | Real-time chat | `ClassroomConsumer` (Channels) + Redis + `Classroom.tsx` WebSocket client |
| h | Block students | `UserViewSet.block/unblock` (global) + `CourseViewSet.block_student` (per-course) + student notification |
| i | Status updates | `StatusUpdateViewSet` + `StudentHome.tsx`/`TeacherHome.tsx` post form |
| j | Upload materials | `CourseMaterialViewSet` + file validation + `CourseDetail.tsx` upload form |
| k | Enrollment notification | `create_notification()` called on enroll/unenroll/block — in-app + email to teacher or student |
| l | Material notification | `create_bulk_notifications()` in `upload_material` for all active enrollees — in-app + email |

### R2 — Technical Requirements

| Req | Description | Evidence |
|-----|-------------|----------|
| a | Models & migrations | 12 models, 4 migration directories, custom User with AUTH_USER_MODEL |
| b | Forms, validators, serialisation | 7 forms, 17 serialisers, FileExtensionValidator, MinValue/MaxValueValidator, custom validate methods |
| c | DRF | 11 ViewSets, DefaultRouter, TokenAuth, 20+ @action endpoints, custom permissions, SerializerMethodField |
| d | URL routing | App-level urlpatterns, DefaultRouter, named routes, WebSocket routing via URLRouter |
| e | Unit testing | 132 back-end test methods + 12 front-end test files |

### R3 — Database Model

The schema models accounts (User, Invitation, StatusUpdate), academic data (Course, CourseMaterial, Enrollment, Feedback, Assignment, AssignmentSubmission), social features (Classroom, ClassroomMessage), and system data (Notification) — 12 models total with appropriate foreign-key relationships, unique constraints, and validators as detailed in Section 3. The schema is normalised to 3NF.

### R4 — REST Interface

A comprehensive REST API is provided, with approximately 80 endpoints covering all resources. The API uses standard HTTP methods, meaningful status codes, and consistent JSON response formats. All endpoints require authentication except login, registration, and invitation acceptance. Object-level permissions are enforced on all CRUD operations.

### R5 — Server-Side Tests

132 test methods across 15 test classes cover model behaviour, API endpoints, permissions, input validation, email delivery, and edge cases. Tests are runnable via `docker compose exec backend python manage.py test`.

---

## 11. Containerisation

Docker Compose defines three services:

1. **backend** — Python 3.11-slim, runs `daphne -b 0.0.0.0 -p 8080 elearning_project.asgi:application`. The source code is volume-mounted for live development; media files are stored in a named Docker volume. A `.dockerignore` file excludes `__pycache__`, `*.pyc`, `.env`, `db.sqlite3`, and `media/` from the build context.
2. **frontend** — Node 20-alpine, runs `npm run dev -- --host`. Source code is volume-mounted with `node_modules` excluded via `.dockerignore` to avoid platform mismatches.
3. **redis** — Redis 7-alpine, used as the Channels channel layer.

A single `docker compose up --build` command brings up the entire stack. Environment variables are loaded from a `.env` file at the project root.

---

## 12. Critical Evaluation

### 12.1 Strengths

- **Decoupled architecture:** The React SPA communicates with the Django back-end exclusively through well-defined API contracts. This makes each tier independently testable and replaceable.
- **Comprehensive real-time features:** The Classroom page combines live chat, a collaborative whiteboard with multiple tools (pen, line, text, eraser, move, undo), and audio streaming — all over a single WebSocket connection with proper access control.
- **Robust invitation system:** The bulk CSV upload with per-row validation, token-based acceptance links, and expiration handling goes beyond the basic requirements.
- **Dual-channel notifications:** Every in-app notification is also delivered via email through a centralised utility module, ensuring users are informed even when not logged in.
- **Strong test coverage:** With 132 back-end tests covering positive paths, negative paths, permissions, email delivery mocking, and edge cases, the application has a solid safety net against regressions.
- **AI-powered assignments:** The integration with OpenAI's API for automatic quiz and flashcard generation from PDF materials adds a modern AI-driven feature.
- **Thorough access control:** Multi-layered permission enforcement — role-based creation checks (`perform_create`), ownership verification on updates/deletes, queryset scoping to prevent data leakage, and WebSocket participant verification — ensures that all data access paths are properly secured against both UI-bypassing direct API requests and cross-user data access.
- **Interactive API documentation:** The API is self-documenting via drf-spectacular, providing Swagger UI and ReDoc interfaces generated automatically from the DRF ViewSet definitions. This improves developer experience and ensures documentation stays in sync with the implementation.

### 12.2 Weaknesses and Improvements

- **SQLite limitations:** The default SQLite database is adequate for development and demonstration but lacks concurrent write support. For production, PostgreSQL would be a better choice and is already supported via environment variables.
- **ScriptProcessorNode deprecation:** The audio streaming uses `ScriptProcessorNode`, which is deprecated in favour of `AudioWorklet`. The ScriptProcessorNode still works in all current browsers, but a future version should migrate to AudioWorklet for better performance and forward compatibility. The AudioWorklet API requires a separate JavaScript file for the processor, which adds complexity but eliminates the main-thread audio processing overhead.
- **No pagination:** The API currently returns all results without pagination. For a production deployment with hundreds of courses or thousands of users, `PageNumberPagination` or `CursorPagination` should be configured in the DRF settings.
- **No caching:** Frequently accessed, rarely changing data (e.g. course lists, user profiles) would benefit from Django's cache framework, backed by the already-available Redis instance.
- **Whiteboard data storage:** Storing the whiteboard history as a JSON string in a text field is simple but does not scale well for very long sessions (mitigated by the 500-action cap). A more scalable approach would be to use Redis for ephemeral session data and only persist final snapshots.
- **Front-end state management:** The Classroom component is approximately 900 lines because it manages WebSocket state, canvas drawing, audio streaming, and chat in a single component. Extracting custom hooks (e.g. `useWebSocket`, `useWhiteboard`, `useAudioStream`) would improve readability and testability.

### 12.3 What I Would Change

If starting the project again, I would:

1. **Use PostgreSQL from the start** to support concurrent access and full-text search (replacing the current icontains search with `SearchVector`/`SearchRank`).
2. **Implement AudioWorklet** for audio streaming, avoiding the deprecated ScriptProcessorNode.
3. **Add WebSocket-based notifications** instead of polling, so students receive enrollment and material notifications in real-time without page refresh.
4. **Use React custom hooks** to decompose the Classroom component into smaller, focused units.
5. **Add Celery for background tasks** such as sending emails and processing large CSV uploads asynchronously, which was covered in the course material and would demonstrate use of task queues.

### 12.4 Relation to State of the Art

Modern web applications increasingly adopt real-time, event-driven architectures. This project demonstrates several state-of-the-art patterns:

- **WebSocket-first real-time features** — rather than long-polling or Server-Sent Events, the application uses bidirectional WebSockets for chat, whiteboard, and audio. This is the same approach used by Slack, Discord, and other modern real-time applications.
- **Token-based API authentication** — following the industry standard for SPA back-ends, avoiding session cookies and CSRF complexity for API calls. This pattern is used by virtually all modern single-page applications.
- **AI integration** — the OpenAI API integration for automatic quiz and flashcard generation from PDF materials demonstrates how modern applications incorporate large language models to enhance user productivity. This is a current industry trend (e.g. Notion AI, Google Workspace AI, Duolingo's AI features).
- **Container-based development** — Docker Compose ensures reproducibility across development environments, mirroring production deployment practices used in industry CI/CD pipelines.
- **TypeScript** — the adoption of TypeScript reflects the industry trend towards type-safe front-end development, reducing runtime errors. TypeScript is now used by the majority of professional React projects.
- **Component-based UI** — React's component model is the dominant paradigm in modern front-end development, used by Meta, Netflix, Airbnb, and others.
- **Event-driven notifications** — the dual-channel notification system (in-app + email) with centralised utility functions mirrors patterns used by GitHub, Jira, and other collaboration platforms.

However, the project could further align with state-of-the-art practices by adopting server-side rendering (Next.js) for SEO, implementing GraphQL for more flexible data fetching, using WebAuthn for passwordless authentication, and deploying to a cloud provider with CI/CD pipelines.

### 12.5 Comparison of Approaches

Several design decisions involved choosing between competing approaches:

**Token vs. JWT authentication:** The project uses DRF's database-backed token authentication rather than JSON Web Tokens (JWTs). Database-backed tokens are simpler to implement and can be revoked instantly by deleting the token record. JWTs, while stateless and more scalable, cannot be revoked without maintaining a blacklist, which negates their stateless advantage. For a classroom-scale application, database-backed tokens are the pragmatic choice.

**WebSocket audio vs. WebRTC:** The initial design used WebRTC for peer-to-peer audio, which is the standard for real-time media. However, WebRTC requires complex signalling (offer/answer/ICE negotiation) and a separate peer connection per listener. The final implementation uses raw PCM over the existing WebSocket connection, which is simpler, works reliably behind firewalls and NATs without TURN servers, and leverages the already-established WebSocket infrastructure. The trade-off is higher bandwidth (~43 KB/s of base64-encoded audio per listener) and processing on the server to broadcast to all clients, but this is acceptable for classroom-sized groups.

**SQLite vs. PostgreSQL:** SQLite was chosen for development simplicity (no additional service required, single-file database). The project's environment-variable-based configuration (`DB_ENGINE`, `DB_NAME`) allows switching to PostgreSQL without code changes, which would be necessary for any production deployment to support concurrent writes from multiple Daphne workers.

**Centralised notification utilities vs. Django signals:** Notification creation could have been implemented using Django's signal framework (e.g. `post_save` on Enrollment). Instead, explicit utility function calls were chosen because they make the notification logic visible at the call site, easier to debug, and allow passing contextual information (e.g. specific message text) that would be harder to derive in a generic signal handler. This follows the Python principle "explicit is better than implicit."

---

## 13. Setup and Run Instructions

### 13.1 Development Environment

- **Operating System:** Windows 11 with WSL2 (Ubuntu), Linux 6.6.87.2-microsoft-standard-WSL2
- **Python Version:** 3.11 (inside Docker container, python:3.11-slim)
- **Node.js Version:** 20 (inside Docker container, node:20-alpine)
- **Docker:** Docker Desktop with Docker Compose v2

### 13.2 Package Versions

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

### 13.3 Installation and Running

```bash
# 1. Unzip the project
unzip claude_elearning.zip
cd claude_elearning

# 2. Start all services
docker compose up --build

# 3. (First run only) Run migrations and populate demo data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py populate_db

# 4. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080/api/
# Django Admin: http://localhost:8080/admin/
# API Docs (Swagger): http://localhost:8080/api/docs/
# API Docs (ReDoc): http://localhost:8080/api/redoc/
```

### 13.4 Login Credentials

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

### 13.5 Running Tests

```bash
# Back-end tests (all apps — 132 tests)
docker compose exec backend python manage.py test

# Back-end tests (specific app)
docker compose exec backend python manage.py test accounts
docker compose exec backend python manage.py test courses
docker compose exec backend python manage.py test classroom
docker compose exec backend python manage.py test notifications

# Front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## 14. Advanced Techniques Beyond the Course Syllabus

This section highlights techniques and technologies used in the project that go beyond the standard Bootstrap/jQuery/Django topics covered in the course:

1. **React 18 with TypeScript** — a modern component-based SPA framework with static typing, replacing server-side template rendering with a fully decoupled front-end. TypeScript catches type errors at compile time, improving code reliability.

2. **Vite** — a next-generation build tool with near-instant hot-module replacement, replacing Webpack-based toolchains (Create React App). Vite's ES module-based dev server provides significantly faster feedback during development.

3. **Django Channels with ASGI** — asynchronous WebSocket support running alongside traditional HTTP via Daphne. The `AsyncWebsocketConsumer` with `@database_sync_to_async` bridges the async WebSocket layer with Django's synchronous ORM.

4. **HTML5 Canvas API** — for the interactive whiteboard with normalised coordinates (0–1 range) for resolution independence, freehand pen drawing, straight lines, text input, eraser, move, and undo tools.

5. **Web Audio API** — real-time PCM audio streaming from teacher to students via `AudioContext`, `ScriptProcessorNode`, and `AudioBufferSourceNode` for seamless playback with precise timing.

6. **OpenAI API integration** — AI-powered automatic quiz and flashcard generation from uploaded PDF materials. The system extracts text from PDFs (via pypdf), constructs prompts for OpenAI's Chat Completions API, parses the JSON response, and creates auto-gradeable assignments.

7. **Docker Compose** — containerised development and deployment with three services (Python, Node, Redis), volume mounts for live development, and `.dockerignore` files for optimised build contexts.

8. **CSS Custom Properties theming** — a branded visual theme built entirely with CSS custom properties overriding Bootstrap defaults, demonstrating modern CSS theming techniques without modifying framework source.

9. **React Context API** — global authentication state management via `AuthContext` with `useContext` hook, replacing traditional state management libraries.

10. **Dual-channel notification system** — centralised utility functions combining in-app notifications with email delivery via Django's `send_mail`/`send_mass_mail`, with graceful error handling and logging.

11. **OpenAPI / Swagger documentation** — automatic API documentation generated by drf-spectacular from existing ViewSet and serialiser definitions, providing interactive Swagger UI and ReDoc interfaces at `/api/docs/` and `/api/redoc/` without manual documentation maintenance.

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
