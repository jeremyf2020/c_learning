from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from accounts.api import (
    UserViewSet, StatusUpdateViewSet, InvitationViewSet,
    validate_invite, accept_invite,
    auth_login, auth_register, auth_me,
)
from courses.api import CourseViewSet, CourseMaterialViewSet, EnrollmentViewSet, FeedbackViewSet
from chat.api import ChatRoomViewSet
from notifications.api import NotificationViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'status-updates', StatusUpdateViewSet)
router.register(r'invitations', InvitationViewSet, basename='invitation')
router.register(r'courses', CourseViewSet)
router.register(r'materials', CourseMaterialViewSet)
router.register(r'enrollments', EnrollmentViewSet)
router.register(r'feedback', FeedbackViewSet)
router.register(r'chatrooms', ChatRoomViewSet, basename='chatroom')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('accounts.urls')),
    path('courses/', include('courses.urls')),
    path('chat/', include('chat.urls')),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls')),

    # Public invite endpoints
    path('api/invite/<str:token>/', validate_invite, name='validate_invite'),
    path('api/invite/<str:token>/accept/', accept_invite, name='accept_invite'),

    # Auth endpoints
    path('api/auth/login/', auth_login, name='auth_login'),
    path('api/auth/register/', auth_register, name='auth_register'),
    path('api/auth/me/', auth_me, name='auth_me'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
