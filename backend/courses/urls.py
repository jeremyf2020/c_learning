from django.urls import path
from . import views

app_name = 'courses'

urlpatterns = [
    path('', views.course_list, name='course_list'),
    path('<int:pk>/', views.course_detail, name='course_detail'),
    path('create/', views.course_create, name='course_create'),
    path('<int:pk>/update/', views.course_update, name='course_update'),
    path('<int:pk>/delete/', views.course_delete, name='course_delete'),
    path('<int:course_pk>/upload/', views.upload_material, name='upload_material'),
    path('<int:pk>/enroll/', views.enroll_course, name='enroll_course'),
    path('<int:pk>/unenroll/', views.unenroll_course, name='unenroll_course'),
    path('<int:course_pk>/feedback/', views.submit_feedback, name='submit_feedback'),
    path('<int:course_pk>/block/<int:student_pk>/', views.block_student, name='block_student'),
]
