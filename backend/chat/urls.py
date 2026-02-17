from django.urls import path
from . import views

app_name = 'chat'

urlpatterns = [
    path('', views.chat_room_list, name='room_list'),
    path('create/', views.create_chat_room, name='create_room'),
    path('<str:room_name>/', views.chat_room, name='room'),
]
