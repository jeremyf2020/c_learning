from django.urls import path
from . import views

app_name = 'classroom'

urlpatterns = [
    path('', views.classroom_list, name='room_list'),
    path('create/', views.create_classroom, name='create_room'),
    path('<str:room_name>/', views.classroom_detail, name='room'),
]
