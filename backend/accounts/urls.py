from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('', views.home, name='home'),
    path('register/', views.register, name='register'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('profile/<str:username>/', views.profile, name='profile'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('status/create/', views.create_status_update, name='create_status'),
    path('status/delete/<int:pk>/', views.delete_status_update, name='delete_status'),
    path('search/', views.search_users, name='search_users'),
    path('notifications/', views.notifications_list, name='notifications'),
]
