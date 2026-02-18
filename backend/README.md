# eLearning Platform - Django Web Application

A comprehensive eLearning web application built with Django, featuring course management, real-time chat, REST API, and role-based access control.

## Table of Contents
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [Demo Users](#demo-users)
- [Application Structure](#application-structure)
- [API Endpoints](#api-endpoints)
- [WebSocket Classroom](#websocket-classroom)

## Features

### Core Functionality
- **User Authentication**: Registration, login, logout with password security
- **Two User Types**: Students and Teachers with different permissions
- **User Profiles**: Personal pages with status updates, courses, and notifications
- **Course Management**: Teachers can create, update, and manage courses
- **Course Materials**: Upload and manage files (PDFs, images, documents)
- **Student Enrollment**: Students can browse and enroll in courses
- **Course Feedback**: Students can rate and comment on courses
- **Real-time Chat**: WebSocket-based chat rooms for communication
- **Notifications**: Automatic notifications for enrollments and new materials
- **REST API**: Full RESTful API for user and course data
- **User Search**: Teachers can search for students and other teachers
- **Block Students**: Teachers can remove students from their courses

### Technical Requirements Met
✅ R1: All required functionality implemented (a-l)
✅ R2: Correct use of models, forms, validators, serialization, DRF, URL routing, and unit testing
✅ R3: Proper database models with normalized relationships
✅ R4: REST API for user data access
✅ R5: Comprehensive unit tests for server-side code

## Technology Stack

- **Framework**: Django 4.2.27
- **REST API**: Django REST Framework 3.14.0
- **Real-time**: Django Channels 4.0.0 + Redis
- **WebSockets**: channels-redis 4.1.0
- **ASGI Server**: Daphne 4.0.0
- **Database**: SQLite (development)
- **Image Processing**: Pillow 10.2.0
- **Frontend**: Bootstrap 5, JavaScript

## Installation

### Prerequisites
- Python 3.8 or higher
- Redis server (for WebSocket functionality)

### Step 1: Clone or Extract the Project
```bash
cd /path/to/elearning_project
```

### Step 2: Create Virtual Environment (Optional but Recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Step 3: Install Dependencies
```bash
pip3 install -r requirements.txt
```

### Step 4: Run Database Migrations
```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

### Step 5: Create Demo Users and Data
```bash
python3 manage.py populate_db
```

This command creates:
- 1 Admin user
- 2 Teacher users
- 3 Student users
- 4 Sample courses
- Sample enrollments, feedback, and notifications

## Running the Application

### Start Redis Server (Required for Chat)
Redis must be running for WebSocket chat to work.

```bash
# On Linux/Mac
redis-server

# On Windows (if installed via WSL)
sudo service redis-server start

# Or using Docker
docker run -p 6379:6379 redis
```

### Start Django Development Server
```bash
python3 manage.py runserver
```

The application will be available at: `http://127.0.0.1:8000/`

### Access Admin Panel
URL: `http://127.0.0.1:8000/admin/`
- Username: `admin`
- Password: `admin123`

## Running Tests

Run all unit tests:
```bash
python3 manage.py test
```

Run tests with verbose output:
```bash
python3 manage.py test --verbosity=2
```

Run tests for specific apps:
```bash
python3 manage.py test accounts
python3 manage.py test courses
```

## Demo Users

### Admin Account
- Username: `admin`
- Password: `admin123`
- Access: Full admin panel access

### Teacher Accounts
1. **John Smith**
   - Username: `john_teacher`
   - Password: `teacher123`
   - Courses: CS101, CS201, CS301

2. **Maria Garcia**
   - Username: `maria_teacher`
   - Password: `teacher123`
   - Courses: MATH101

### Student Accounts
1. **Alice Johnson**
   - Username: `alice_student`
   - Password: `student123`
   - Enrolled in: CS101, CS201

2. **Bob Williams**
   - Username: `bob_student`
   - Password: `student123`
   - Enrolled in: CS101, CS201

3. **Charlie Brown**
   - Username: `charlie_student`
   - Password: `student123`
   - Enrolled in: MATH101

## Application Structure

```
elearning_project/
├── accounts/              # User authentication and profiles
│   ├── models.py         # User and StatusUpdate models
│   ├── views.py          # Authentication and profile views
│   ├── forms.py          # User registration and profile forms
│   ├── api.py            # REST API viewsets
│   ├── serializers.py    # DRF serializers
│   └── tests.py          # Unit tests
├── courses/              # Course management
│   ├── models.py         # Course, Enrollment, Feedback models
│   ├── views.py          # Course CRUD and enrollment views
│   ├── forms.py          # Course and feedback forms
│   ├── api.py            # REST API viewsets
│   ├── serializers.py    # DRF serializers
│   └── tests.py          # Unit tests
├── classroom/                 # Real-time classroom
│   ├── models.py         # Classroom and ClassroomMessage models
│   ├── views.py          # Chat room views
│   ├── consumers.py      # WebSocket consumers
│   └── routing.py        # WebSocket URL routing
├── notifications/        # Notification system
│   ├── models.py         # Notification model
│   └── admin.py          # Admin configuration
├── templates/            # HTML templates
│   ├── base.html        # Base template
│   ├── accounts/        # Account templates
│   ├── courses/         # Course templates
│   └── classroom/            # Classroom templates
├── elearning_project/   # Project settings
│   ├── settings.py      # Django settings
│   ├── urls.py          # Main URL configuration
│   └── asgi.py          # ASGI configuration for Channels
└── manage.py            # Django management script
```

## API Endpoints

### Authentication
API uses session authentication and token authentication.

### User Endpoints
- `GET /api/users/` - List all users
- `GET /api/users/{id}/` - Get user details
- `GET /api/users/me/` - Get current user details
- `PATCH /api/users/update_profile/` - Update profile

### Course Endpoints
- `GET /api/courses/` - List all courses
- `POST /api/courses/` - Create course (teachers only)
- `GET /api/courses/{id}/` - Get course details
- `PATCH /api/courses/{id}/` - Update course
- `DELETE /api/courses/{id}/` - Delete course
- `POST /api/courses/{id}/enroll/` - Enroll in course

### Enrollment Endpoints
- `GET /api/enrollments/` - List user enrollments

### Feedback Endpoints
- `GET /api/feedback/` - List feedback
- `POST /api/feedback/` - Submit feedback

### Example API Usage
```python
import requests

# Get all courses
response = requests.get('http://127.0.0.1:8000/api/courses/')
courses = response.json()

# Get current user (requires authentication)
response = requests.get(
    'http://127.0.0.1:8000/api/users/me/',
    auth=('username', 'password')
)
user = response.json()
```

## WebSocket Classroom

### WebSocket URL
```
ws://127.0.0.1:8000/ws/classroom/{room_name}/
```

### JavaScript Example
```javascript
const roomName = 'general';
const classroomSocket = new WebSocket(
    'ws://' + window.location.host + '/ws/classroom/' + roomName + '/'
);

classroomSocket.onmessage = function(e) {
    const data = JSON.parse(e.data);
    console.log('Message:', data.message);
};

classroomSocket.send(JSON.stringify({
    'message': 'Hello, World!'
}));
```

## Database Design

### Key Models and Relationships

**User Model**
- Custom user model extending AbstractUser
- Fields: username, email, user_type (student/teacher), full_name, bio, photo, etc.
- One-to-many with StatusUpdate
- One-to-many with Course (as teacher)
- Many-to-many with Course (through Enrollment)

**Course Model**
- Fields: title, description, teacher (FK), code, start_date, end_date, is_active
- One-to-many with CourseMaterial
- One-to-many with Enrollment
- One-to-many with Feedback

**Enrollment Model**
- Junction table for Student-Course relationship
- Fields: student (FK), course (FK), enrolled_at, is_active, completed
- Unique together constraint on (student, course)

**Feedback Model**
- Fields: course (FK), student (FK), rating, comment, created_at
- Unique together constraint on (course, student)

**Notification Model**
- Fields: recipient (FK), notification_type, title, message, link, is_read
- Supports enrollment and material notifications

## Development Environment

- **Operating System**: Linux (WSL2)
- **Python Version**: 3.8
- **Database**: SQLite3
- **Redis Version**: Latest stable

## Security Features

- Password hashing using Django's built-in authentication
- CSRF protection on all forms
- User session management
- Login required decorators on protected views
- Permission checks (student vs teacher)
- File upload validation
- XSS protection via template escaping

## Future Enhancements

- Email notifications
- Video streaming support
- Assignment submission system
- Grading system
- Certificate generation
- Mobile responsive improvements
- AWS deployment
- PostgreSQL database
- Caching with Redis
- Full-text search
- Social authentication

## Troubleshooting

### Redis Connection Error
If you get "Connection refused" for Redis:
1. Check if Redis is running: `redis-cli ping` (should return "PONG")
2. Start Redis: `redis-server`
3. Check Redis port: `netstat -an | grep 6379`

### Template Not Found Errors
Ensure templates directory is in settings.py:
```python
TEMPLATES = [
    {
        'DIRS': [BASE_DIR / 'templates'],
        ...
    }
]
```

### Static Files Not Loading
Run collectstatic:
```bash
python3 manage.py collectstatic
```

## License

This project is developed for educational purposes as part of the CM3035 Advanced Web Development coursework.

## Author

Created for University of London BSc Computer Science Program
Course: CM3035 - Advanced Web Development
