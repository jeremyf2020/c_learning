# CM3035 Advanced Web Development — Final Coursework Report

# eLearning Web Application

---

## 1. Introduction

This report describes the design, implementation, and evaluation of an eLearning web application developed for the CM3035 Advanced Web Development module. The application allows students and teachers to interact through course management, real-time chat with a shared whiteboard, and an integrated notification system. The project is built as a decoupled architecture with a Django 4.2 REST back-end served via Daphne (ASGI), and a React 18 single-page application (SPA) front-end built with TypeScript and Vite. Real-time features are powered by Django Channels 4 with a Redis channel layer, and the entire stack is containerised with Docker Compose for reproducible deployment.

The remainder of this report is organised as follows. Section 2 presents the high-level architecture. Section 3 discusses the database design and its compliance with relational normalisation. Sections 4 through 8 cover the back-end, REST API, WebSocket layer, front-end, and authentication respectively. Section 9 explains the testing strategy. Section 10 maps every functional and technical requirement to the concrete code that implements it. Section 11 covers containerisation. Section 12 provides a critical evaluation, and Section 13 gives the information needed to install and run the application.

---

## 2. Application Architecture

The application follows a three-tier, decoupled client–server architecture:

1. **Presentation tier** — a React 18 SPA (TypeScript, Vite, Bootstrap 5) served on port 5173.
2. **Application tier** — a Django 4.2 back-end exposing a REST API via Django REST Framework 3.14 and WebSocket endpoints via Django Channels 4, served by Daphne on port 8080.
3. **Data tier** — an SQLite database (configurable to PostgreSQL via environment variables) and a Redis 7 instance used as the Channels channel layer.

Docker Compose orchestrates all three services (backend, frontend, redis). The front-end communicates with the back-end exclusively through HTTP REST calls (via Axios) and WebSocket connections; there is no server-side template rendering for the user-facing pages. This separation of concerns allows the front-end to be developed, tested, and deployed independently of the back-end, and permits future replacement of either tier without affecting the other.

The choice of React with TypeScript was deliberate: TypeScript provides compile-time type safety that catches many classes of bugs (e.g. passing an incorrect prop type) before they reach the browser, while React's component model enables code reuse across the thirteen page-level components that make up the application. Vite was chosen over Create React App for its significantly faster hot-module replacement (HMR) during development.

---

## 3. Database Design and Normalisation

### 3.1 Entity-Relationship Overview

The data model comprises ten Django models spread across four apps:

| App | Models |
|-----|--------|
| accounts | User, StatusUpdate, Invitation |
| courses | Course, CourseMaterial, Enrollment, Feedback |
| chat | ChatRoom, ChatMessage |
| notifications | Notification |

Key relationships:

- **User → Course** (one-to-many via `teacher` ForeignKey with `limit_choices_to={'user_type': 'teacher'}`).
- **User ↔ Course** (many-to-many through the `Enrollment` junction table, which carries additional metadata: `enrolled_at`, `is_active`, `completed`, `completion_date`).
- **User → StatusUpdate** (one-to-many, cascade delete).
- **Course → CourseMaterial** (one-to-many) and **Course → Feedback** (one-to-many).
- **ChatRoom ↔ User** (many-to-many via Django's built-in intermediary table for the `participants` M2M field).
- **ChatRoom → ChatMessage** (one-to-many).
- **User → Notification** (one-to-many via `recipient` ForeignKey).
- **User → Invitation** (one-to-many via `invited_by` ForeignKey, plus a OneToOneField `created_user` linking to the account that was eventually created from the invitation).

### 3.2 Normalisation to Third Normal Form

**First Normal Form (1NF):** Every column stores atomic values. There are no repeating groups or multi-valued columns. The only field that stores structured data is `ChatRoom.whiteboard_data`, which holds a JSON-encoded list of drawing actions. This is intentional: the whiteboard data is always loaded and saved as a whole unit, never queried at the sub-element level, so a JSON text field is more appropriate than creating a separate table with thousands of rows per drawing session.

**Second Normal Form (2NF):** 2NF requires that every non-key attribute depends on the *entire* primary key. In Django, every model has a single-column surrogate primary key (`id`), so there are no composite keys at the physical level. However, two models have logical composite keys enforced via `unique_together`:

- `Enrollment(student, course)` — additional attributes (`enrolled_at`, `is_active`, `completed`) depend on the full combination of student and course, not on either alone.
- `Feedback(course, student)` — `rating` and `comment` describe a specific student's assessment of a specific course.

Both satisfy 2NF because no non-key attribute depends on only part of the composite candidate key.

**Third Normal Form (3NF):** 3NF requires that no non-key attribute transitively depends on the primary key. Consider the `Course` model: `teacher` is a ForeignKey to `User`. The teacher's name is not stored redundantly in the Course table; it is accessed via the relationship. Similarly, `Enrollment` does not duplicate the course title or the student's name; these are resolved through ForeignKey joins. The serialisers expose denormalised fields such as `teacher_name` and `student_name` using `SerializerMethodField`, but these are computed at serialisation time and are not stored in the database. This approach maintains 3NF in the schema while providing a convenient, flat JSON representation for the API consumer.

The only deliberate denormalisation is the `whiteboard_data` JSON field, justified above. All other tables are in 3NF.

### 3.3 Referential Integrity and Constraints

Django's ORM enforces referential integrity through foreign-key constraints. The project uses `CASCADE` for most relationships (e.g. deleting a User cascades to their StatusUpdates, Enrollments, Feedback), and `SET_NULL` where the parent record should be preserved even if the related record is removed (e.g. `Invitation.invited_by`). Field-level validation is enforced through Django validators:

- `FileExtensionValidator` on `User.photo` (jpg, jpeg, png) and `CourseMaterial.file` (pdf, doc, docx, ppt, pptx, jpg, jpeg, png, gif, mp4, avi).
- `MinValueValidator(1)` and `MaxValueValidator(5)` on `Feedback.rating`.
- `unique=True` on `Course.code` and `Invitation.token` with `db_index=True` for fast look-ups.

---

## 4. Back-End Implementation

### 4.1 Django Project Structure

The back-end is organised into four Django apps, each responsible for a distinct domain:

- **accounts** — user management, authentication, invitations, status updates.
- **courses** — course CRUD, materials upload, enrollment, feedback.
- **chat** — real-time chat rooms, whiteboard, audio streaming via WebSockets.
- **notifications** — notification creation and retrieval.

This modular structure follows Django best practice: models live in `models.py`, business logic in `views.py` and `api.py`, form validation in `forms.py`, and serialisation in `serializers.py`. URL routing is defined per-app in `urls.py` and aggregated at the project level.

### 4.2 Custom User Model

The application extends Django's `AbstractUser` to create a custom `User` model (set via `AUTH_USER_MODEL = 'accounts.User'` in `settings.py`). This is the approach recommended by the Django documentation because it allows adding fields (e.g. `user_type`, `photo`, `bio`) to the user model without the limitations of a separate profile table. The `user_type` field uses a `choices` parameter with two options — `'student'` and `'teacher'` — and convenience methods `is_student()` and `is_teacher()` encapsulate the check.

### 4.3 Django REST Framework

The API layer is built entirely with Django REST Framework (DRF) 3.14. The project makes use of:

- **ModelViewSet** for full CRUD operations (CourseViewSet, CourseMaterialViewSet, FeedbackViewSet, StatusUpdateViewSet, ChatRoomViewSet).
- **ReadOnlyModelViewSet** for read-only resources (UserViewSet, EnrollmentViewSet, NotificationViewSet).
- **Custom actions** via the `@action` decorator for operations that do not map to standard CRUD verbs, such as `enroll`, `unenroll`, `block_student`, `search`, `mark_all_read`, `bulk_upload`.
- **DefaultRouter** for automatic URL generation from ViewSets, registered in the project-level `urls.py`.
- **Token authentication** (`rest_framework.authtoken`) — a token is generated on login or registration and sent in the `Authorization: Token <key>` header for all subsequent requests.
- **Custom permission classes** — `IsTeacher` checks `request.user.is_teacher() or request.user.is_staff` and is applied to invitation management endpoints.
- **SerializerMethodField** for computed, read-only fields such as `teacher_name`, `enrolled_count`, `average_rating`, `participant_names`, and `last_message`. These are calculated at serialisation time using model methods or queryset aggregations, avoiding database denormalisation.

### 4.4 Serialisers and Validation

Each app defines serialisers that handle both input validation and output representation. Notable validation logic includes:

- `InvitationSerializer.validate_email` checks for existing users and active pending invitations before allowing a new invitation.
- `AcceptInvitationSerializer` validates username uniqueness, password strength (via Django's `validate_password`), and password confirmation matching.
- `RegisterSerializer` similarly validates passwords and creates a new user with a hashed password via `User.objects.create_user()`.

The serialisers form a clean boundary between the HTTP layer and the domain logic: views receive already-validated data and can focus on orchestration (e.g. creating notifications after enrollment).

### 4.5 Business Logic in Views

The views layer orchestrates multi-step operations that go beyond simple CRUD. For example, the `enroll_course` view in `courses/views.py` performs four distinct steps: (1) validates that the requesting user is a student, (2) creates or reactivates an Enrollment record (handling the case where a student re-enrols after being removed), (3) creates a Notification for the course teacher with a descriptive message including the student's name, and (4) returns an appropriate HTTP response. Similarly, `upload_material` not only saves the file and creates a CourseMaterial record, but also iterates over all active enrollments to generate per-student notifications. This event-driven notification pattern ensures that stakeholders are informed of relevant actions without requiring polling or manual checks.

The `bulk_upload` action on `InvitationViewSet` demonstrates more complex validation logic: it reads a CSV file from the request, validates that the required headers (`email`, `full_name`, `user_type`) are present, checks each row for email format validity and date parsing, skips rows where an active invitation or existing user already exists, and returns a detailed JSON response listing successes and per-row errors. This is useful for teachers who need to onboard an entire class at once.

### 4.6 Forms

Although the primary interface is the React SPA consuming the REST API, Django forms are also provided for server-side rendering as a fallback. `UserRegistrationForm` extends `UserCreationForm` with `email`, `full_name`, and `user_type` fields. `CourseForm` uses `DateInput` widgets for `start_date` and `end_date`. `FeedbackForm` uses a `RadioSelect` widget for the 1–5 star rating. These forms serve a dual purpose: they provide validation logic that can be reused by views, and they enable progressive enhancement should the React front-end be unavailable.

### 4.7 Notifications

The notification system is event-driven. When a student enrols on a course (in `courses/views.py:enroll_course`), a `Notification` is created with `notification_type='enrollment'` and the teacher as `recipient`. When a teacher uploads new material (in `courses/views.py:upload_material`), the system iterates over all active enrollments for that course and creates a `Notification` with `notification_type='material'` for each student. The front-end polls notifications via the REST API and displays them on the Notifications page.

---

## 5. REST API Design

The API follows RESTful conventions: resources are nouns (`/api/courses/`, `/api/users/`), HTTP methods indicate the operation (GET for reads, POST for creates, PATCH for updates, DELETE for removes), and status codes convey outcomes (200, 201, 400, 403, 404). The full list of endpoints is extensive; highlights include:

- `GET /api/users/search/?q=<query>&user_type=<type>` — teacher-only search across username, full_name, and email using case-insensitive icontains lookups.
- `POST /api/courses/{id}/enroll/` — student enrols; creates Enrollment and Notification.
- `POST /api/courses/{id}/block/{student_id}/` — teacher deactivates a student's enrollment.
- `POST /api/invitations/bulk_upload/` — accepts a CSV file, validates headers and data, creates invitations in bulk, and returns per-row error details.
- `GET /api/invite/{token}/` and `POST /api/invite/{token}/accept/` — public endpoints for the invitation acceptance flow, allowing unregistered users to create accounts.

CORS is configured via `django-cors-headers` to allow the React dev server at `localhost:5173` to make cross-origin requests to the API at `localhost:8080`.

---

## 6. Real-Time Communication with WebSockets

### 6.1 Django Channels and ASGI

The application uses Django Channels 4 to handle WebSocket connections alongside standard HTTP. The ASGI entry point (`asgi.py`) uses `ProtocolTypeRouter` to route HTTP requests to Django's standard ASGI handler and WebSocket connections to the Channels URL router, wrapped in a custom `TokenAuthMiddleware`.

The Channels layer uses Redis as the backing store (`channels_redis.core.RedisChannelLayer`), which enables message passing between multiple worker processes — essential for broadcasting messages to all participants in a chat room.

### 6.2 Token Authentication Middleware

WebSocket connections cannot send custom HTTP headers during the handshake, so token authentication is implemented via a query string parameter. The custom `TokenAuthMiddleware` in `chat/middleware.py` extracts the `token` query parameter from the WebSocket URL, looks up the corresponding `Token` object, and attaches the associated user to the connection's `scope`. If the token is missing or invalid, `AnonymousUser` is assigned, and the consumer's `connect()` method rejects the connection with `await self.close()`.

### 6.3 Chat Consumer

The `ChatConsumer` in `chat/consumers.py` is an `AsyncWebsocketConsumer` that handles multiple message types through a dispatch pattern in the `receive()` method:

- **Chat messages** (`type: 'chat'`) — saved to the database via `@database_sync_to_async` and broadcast to all room members.
- **Whiteboard actions** (`type: 'draw' | 'line' | 'text' | 'erase' | 'move' | 'undo' | 'clear'`) — teacher-only; persisted in the `whiteboard_data` JSON field and broadcast for real-time rendering on all connected clients.
- **Audio streaming** (`type: 'audio_start' | 'audio_stop' | 'audio_data'`) — teacher-only; broadcasts raw PCM audio data (base64-encoded 16 kHz Int16 samples) to all room members. The `audio_data` handler skips echoing back to the teacher to prevent feedback loops.

On connection, the consumer sends the full whiteboard state to the joining client, ensuring late joiners see the current board. The consumer also joins a per-user group (`chat_{room}_user_{username}`) for targeted signalling messages.

### 6.4 Whiteboard Implementation Detail

The whiteboard uses an HTML5 Canvas with a fixed logical resolution of 1920x1080, rendered via CSS `aspect-ratio: 16/9` to maintain consistent proportions across different screen sizes. All drawing coordinates are normalised to the 0–1 range before transmission, so a point at (960, 540) is sent as (0.5, 0.5). This normalisation ensures that drawings appear in the same relative position regardless of the client's actual canvas dimensions.

The whiteboard supports five tools: pen (freehand drawing), line (straight lines between two points), text (inline text input at click position), eraser (white overdraw with adjustable width), and move (drag text and line elements to new positions). Each tool action is sent as a typed WebSocket message (e.g. `{type: 'draw', points: [[0.1, 0.2], ...], color: '#000', width: 3}`), stored server-side in the `whiteboard_data` JSON field, and broadcast to all room members for real-time rendering. The undo feature removes the last action from the server-side list and broadcasts a `wb_undo` message; clients respond by popping the last action from their local array and replaying all remaining actions.

The `@database_sync_to_async` decorator is used throughout the consumer for database operations, since Django's ORM is synchronous. Each whiteboard mutation (append, pop, move, clear) reads the current JSON, modifies it in Python, and writes it back. This is acceptable for a classroom setting with one teacher drawing, but for a high-throughput collaborative whiteboard, a Redis-backed data structure or a dedicated drawing database would be more appropriate.

### 6.5 Front-End Audio Streaming

The audio streaming implementation uses the Web Audio API for maximum browser compatibility:

- **Teacher side:** `getUserMedia()` captures the microphone, an `AudioContext` with a `ScriptProcessorNode` captures raw PCM samples, which are downsampled from the native sample rate (typically 48 kHz) to 16 kHz, encoded as Int16 arrays, base64-encoded, and sent via WebSocket every ~85 ms (4096 samples at 48 kHz).
- **Student side:** On receiving `audio_start`, the student creates an `AudioContext`. Each `audio_data` chunk is decoded from base64 to Int16, converted to Float32, wrapped in an `AudioBuffer`, and scheduled for seamless playback using `AudioBufferSourceNode.start()` with precise timing. A latency cap of 1 second prevents runaway buffering.

This approach avoids the complexity of WebRTC (offer/answer/ICE negotiation) and the fragility of the MediaSource Extensions API with audio-only WebM, while achieving low-latency one-to-many broadcasting.

---

## 7. Front-End Implementation

### 7.1 Technology Stack

The front-end is built with React 18 and TypeScript 5.3, bundled with Vite 5.1. Bootstrap 5.3 provides the CSS framework. React Router DOM 6 handles client-side routing via a `BrowserRouter`. Axios is configured with a base URL and an interceptor that attaches the authentication token to every request.

### 7.2 State Management

Global authentication state is managed through React Context (`AuthContext`). Per-page state uses React's built-in `useState` and `useRef` hooks. The Classroom page, the most complex component (approximately 900 lines), manages WebSocket connections, canvas drawing state, inline text input, audio streaming, and chat messages — all via local state and refs. A custom reconnection mechanism in the WebSocket `useEffect` automatically re-establishes the connection with a 2-second retry if the backend restarts.

### 7.3 Key Pages

- **StudentHome** and **TeacherHome** — role-specific dashboards showing enrolled/taught courses, status update feeds, and (for teachers) a live user search interface.
- **CourseDetail** — displays course information, materials (with download links), enrolled student list (teacher view), and a feedback form (student view).
- **Classroom** — the real-time feature hub with a shared whiteboard (pen, line, text, eraser, move tools with adjustable sizes), live chat, and audio streaming.
- **Profile** — shows user information, status updates, and enrolled courses; editable by the owner.
- **InviteBulk** — drag-and-drop CSV upload for bulk student invitations with per-row validation feedback.

### 7.4 Advanced Front-End Techniques

The project uses several techniques beyond the standard Bootstrap/jQuery taught in the course:

- **React with TypeScript** — a modern component-based SPA framework with static typing.
- **Vite** — a next-generation build tool with near-instant HMR.
- **HTML5 Canvas API** — for the whiteboard, with normalised coordinates (0–1 range) for resolution independence across screens.
- **Web Audio API** — for real-time PCM audio streaming via `AudioContext` and `ScriptProcessorNode`.
- **Custom cursor rendering** — the eraser tool renders a dynamically-sized SVG rectangle cursor that matches the actual eraser size on the canvas.

---

## 8. Authentication and Security

Authentication uses DRF's `TokenAuthentication`. On login or registration, the server generates and returns a token. The React front-end stores this token in `localStorage` and attaches it to every Axios request via an interceptor. WebSocket authentication is handled by the custom `TokenAuthMiddleware` described in Section 6.2.

Security measures include:

- **CORS** restricted to the front-end origin.
- **CSRF protection** enabled (though token-authenticated API requests are exempt per DRF convention).
- **Password hashing** via Django's default PBKDF2 hasher.
- **Input validation** at both the serialiser and model levels.
- **File upload validation** using `FileExtensionValidator` to restrict uploaded file types.
- **Blocked user handling** — blocked users cannot log in (checked during `auth_login`) and are excluded from user lists.
- **Permission enforcement** — teacher-only actions (course creation, student blocking, invitation management) are protected by the custom `IsTeacher` permission class.

---

## 9. Testing Strategy

### 9.1 Back-End Tests

The project contains approximately 130 test methods across four test files, using Django's `TestCase` and DRF's `APITestCase`:

- **accounts/tests.py** (738 lines) — 8 test classes covering user model methods, status updates, invitation lifecycle, authentication API, user search, blocking, and profile updates.
- **courses/tests.py** (304 lines) — 6 test classes covering course model methods, enrollment constraints, feedback constraints, course API operations, and enrollment visibility filtering.
- **chat/tests.py** (96 lines) — 3 test classes covering room and message models, and the chat room API.
- **notifications/tests.py** (111 lines) — 2 test classes covering notification model properties and the notification API.

Tests verify both positive paths (correct creation, successful operations) and negative paths (permission denied, duplicate entries, invalid data, expired tokens). The `setUp` method in each test class creates isolated test data, ensuring tests are independent and reproducible. Permission tests are particularly important: every teacher-only action is tested with both a teacher account (expecting success) and a student account (expecting 403 Forbidden), ensuring that role-based access control works correctly. Edge cases such as re-enrolling after being blocked, accepting an expired invitation token, and uploading a CSV with missing headers are also covered.

### 9.2 Front-End Tests

The front-end includes 12 test files under `src/__tests__/` using Jest and React Testing Library, covering rendering and basic interactions for Login, Register, AcceptInvitation, InvitationList, InviteSingle, InviteBulk, CourseCreate, Notifications, Navbar, ProtectedRoute, and TeacherHome components.

---

## 10. Meeting the Requirements

### R1 — Functional Requirements

| Req | Description | Implementation |
|-----|-------------|----------------|
| a | Account creation | `RegisterSerializer` + `auth_register` API + `Register.tsx` |
| b | Login/Logout | `auth_login`/`user_logout` APIs + `Login.tsx` with token management |
| c | Teacher search | `UserViewSet.search` with icontains on username, full_name, email + filter by user_type |
| d | Add courses | `CourseViewSet.create` (teacher auto-set via `perform_create`) + `CourseCreate.tsx` |
| e | Student enrolment | `CourseViewSet.enroll` action + Enrollment model with unique constraint |
| f | Course feedback | `FeedbackViewSet` + Feedback model (rating 1–5 + comment, unique per student–course) |
| g | Real-time chat | `ChatConsumer` (Channels) + Redis + `Classroom.tsx` WebSocket client |
| h | Block students | `UserViewSet.block/unblock` (global) + `CourseViewSet.block_student` (per-course) |
| i | Status updates | `StatusUpdateViewSet` + `StudentHome.tsx`/`TeacherHome.tsx` post form |
| j | Upload materials | `CourseMaterialViewSet` + file validation + `CourseDetail.tsx` upload form |
| k | Enrollment notification | `Notification` created in `enroll_course` view, type='enrollment' |
| l | Material notification | Notification loop in `upload_material` for all active enrollees |

### R2 — Technical Requirements

| Req | Description | Evidence |
|-----|-------------|----------|
| a | Models & migrations | 10 models, 4 migration directories, custom User with AUTH_USER_MODEL |
| b | Forms, validators, serialisation | 7 forms, 8 serialisers, FileExtensionValidator, MinValue/MaxValueValidator, custom validate methods |
| c | DRF | ViewSets, DefaultRouter, TokenAuth, @action, permissions, SerializerMethodField |
| d | URL routing | App-level urlpatterns, DefaultRouter, named routes, WebSocket routing |
| e | Unit testing | ~130 back-end test methods + 12 front-end test files |

### R3 — Database Model

The schema models accounts (User, Invitation), academic data (Course, CourseMaterial, Enrollment, Feedback), social features (StatusUpdate, ChatRoom, ChatMessage), and system data (Notification) with appropriate foreign-key relationships, unique constraints, and validators as detailed in Section 3.

### R4 — REST Interface

A comprehensive REST API is provided, with 30+ endpoints covering all resources. The API uses standard HTTP methods, meaningful status codes, and consistent JSON response formats. All endpoints require authentication except login, registration, and invitation acceptance.

### R5 — Server-Side Tests

Approximately 130 test methods cover model behaviour, API endpoints, permissions, input validation, and edge cases. Tests are runnable via `python manage.py test`.

---

## 11. Containerisation

Docker Compose defines three services:

1. **backend** — Python 3.11-slim, runs `daphne -b 0.0.0.0 -p 8080 elearning_project.asgi:application`. The source code is volume-mounted for live development; media files are stored in a named Docker volume.
2. **frontend** — Node 20-alpine, runs `npm run dev -- --host`. Source code is volume-mounted with `node_modules` excluded to avoid platform mismatches.
3. **redis** — Redis 7-alpine, used as the Channels channel layer.

A single `docker compose up --build` command brings up the entire stack. Environment variables are loaded from a `.env` file at the project root.

---

## 12. Critical Evaluation

### 12.1 Strengths

- **Decoupled architecture:** The React SPA communicates with the Django back-end exclusively through well-defined API contracts. This makes each tier independently testable and replaceable.
- **Comprehensive real-time features:** The Classroom page combines live chat, a collaborative whiteboard with multiple tools (pen, line, text, eraser, move, undo), and audio streaming — all over a single WebSocket connection.
- **Robust invitation system:** The bulk CSV upload with per-row validation, token-based acceptance links, and expiration handling goes beyond the basic requirements.
- **Strong test coverage:** With approximately 130 back-end tests covering positive paths, negative paths, permissions, and edge cases, the application has a solid safety net against regressions.

### 12.2 Weaknesses and Improvements

- **SQLite limitations:** The default SQLite database is adequate for development and demonstration but lacks concurrent write support. For production, PostgreSQL would be a better choice and is already supported via environment variables.
- **ScriptProcessorNode deprecation:** The audio streaming uses `ScriptProcessorNode`, which is deprecated in favour of `AudioWorklet`. The ScriptProcessorNode still works in all current browsers, but a future version should migrate to AudioWorklet for better performance and forward compatibility. The AudioWorklet API requires a separate JavaScript file for the processor, which adds complexity but eliminates the main-thread audio processing overhead.
- **No pagination:** The API currently returns all results without pagination. For a production deployment with hundreds of courses or thousands of users, `PageNumberPagination` or `CursorPagination` should be configured in the DRF settings.
- **No caching:** Frequently accessed, rarely changing data (e.g. course lists, user profiles) would benefit from Django's cache framework, backed by the already-available Redis instance.
- **Whiteboard data storage:** Storing the entire whiteboard history as a JSON string in a text field is simple but does not scale well for long sessions. A more scalable approach would be to store individual actions in a separate table, or to use Redis for ephemeral session data and only persist final snapshots.
- **Front-end state management:** The Classroom component is approximately 900 lines because it manages WebSocket state, canvas drawing, audio streaming, and chat in a single component. Extracting custom hooks (e.g. `useWebSocket`, `useWhiteboard`, `useAudioStream`) would improve readability and testability.
- **Email notifications:** The application uses Django's console email backend for development. Integrating a real email service (e.g. SendGrid, Amazon SES) would enable actual invitation emails to be delivered.

### 12.3 What I Would Change

If starting the project again, I would:

1. **Use PostgreSQL from the start** to support concurrent access and full-text search (replacing the current icontains search with `SearchVector`/`SearchRank`).
2. **Implement AudioWorklet** for audio streaming, avoiding the deprecated ScriptProcessorNode.
3. **Add WebSocket-based notifications** instead of polling, so students receive enrollment and material notifications in real-time without page refresh.
4. **Use React custom hooks** to decompose the Classroom component into smaller, focused units.
5. **Add Celery for background tasks** such as sending invitation emails and processing large CSV uploads asynchronously, which was covered in the course material and would demonstrate use of task queues.

### 12.4 Relation to State of the Art

Modern web applications increasingly adopt real-time, event-driven architectures. This project demonstrates several state-of-the-art patterns:

- **WebSocket-first real-time features** — rather than long-polling or Server-Sent Events, the application uses bidirectional WebSockets for chat, whiteboard, and audio.
- **Token-based API authentication** — following the industry standard for SPA back-ends, avoiding session cookies and CSRF complexity for API calls.
- **Container-based development** — Docker Compose ensures reproducibility across development environments, mirroring production deployment practices.
- **TypeScript** — the adoption of TypeScript reflects the industry trend towards type-safe front-end development, reducing runtime errors.
- **Component-based UI** — React's component model is the dominant paradigm in modern front-end development, and the project leverages it throughout.

However, the project could further align with state-of-the-art practices by adopting server-side rendering (Next.js) for SEO, implementing GraphQL for more flexible data fetching, using WebAuthn for passwordless authentication, and deploying to a cloud provider with CI/CD pipelines.

### 12.5 Comparison of Approaches

Several design decisions involved choosing between competing approaches:

**Token vs. JWT authentication:** The project uses DRF's database-backed token authentication rather than JSON Web Tokens (JWTs). Database-backed tokens are simpler to implement and can be revoked instantly by deleting the token record. JWTs, while stateless and more scalable, cannot be revoked without maintaining a blacklist, which negates their stateless advantage. For a classroom-scale application, database-backed tokens are the pragmatic choice.

**WebSocket audio vs. WebRTC:** The initial design used WebRTC for peer-to-peer audio, which is the standard for real-time media. However, WebRTC requires complex signalling (offer/answer/ICE negotiation) and a separate peer connection per listener. The final implementation uses raw PCM over the existing WebSocket connection, which is simpler, works reliably behind firewalls and NATs without TURN servers, and leverages the already-established WebSocket infrastructure. The trade-off is higher bandwidth (~43 KB/s of base64-encoded audio per listener) and processing on the server to broadcast to all clients, but this is acceptable for classroom-sized groups.

**SQLite vs. PostgreSQL:** SQLite was chosen for development simplicity (no additional service required, single-file database). The project's environment-variable-based configuration (`DB_ENGINE`, `DB_NAME`) allows switching to PostgreSQL without code changes, which would be necessary for any production deployment to support concurrent writes from multiple Daphne workers.

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
# Back-end tests (all apps)
docker compose exec backend python manage.py test

# Back-end tests (specific app)
docker compose exec backend python manage.py test accounts
docker compose exec backend python manage.py test courses
docker compose exec backend python manage.py test chat
docker compose exec backend python manage.py test notifications

# Front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## References

1. Django Software Foundation. *Django Documentation 4.2*. https://docs.djangoproject.com/en/4.2/
2. Encode. *Django REST Framework Documentation*. https://www.django-rest-framework.org/
3. Django Channels. *Channels Documentation*. https://channels.readthedocs.io/
4. Meta Platforms. *React Documentation*. https://react.dev/
5. Evan You. *Vite Documentation*. https://vitejs.dev/
6. Mozilla Developer Network. *Web Audio API*. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
7. Mozilla Developer Network. *WebSocket API*. https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
8. E.F. Codd. *A Relational Model of Data for Large Shared Data Banks*. Communications of the ACM, 1970.
