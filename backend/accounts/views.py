from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q
from .models import User, StatusUpdate
from .forms import UserRegistrationForm, UserProfileUpdateForm, StatusUpdateForm, UserSearchForm
from courses.models import Course, Enrollment
from notifications.models import Notification


def home(request):
    """Home page view"""
    if request.user.is_authenticated:
        return redirect('accounts:profile', username=request.user.username)
    return render(request, 'accounts/home.html')


def register(request):
    """User registration view"""
    if request.user.is_authenticated:
        return redirect('accounts:profile', username=request.user.username)

    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Registration successful! Welcome to eLearning.')
            return redirect('accounts:profile', username=user.username)
    else:
        form = UserRegistrationForm()

    return render(request, 'accounts/register.html', {'form': form})


def user_login(request):
    """User login view"""
    if request.user.is_authenticated:
        return redirect('accounts:profile', username=request.user.username)

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_blocked:
                messages.error(request, 'Your account has been blocked. Please contact admin.')
            else:
                login(request, user)
                messages.success(request, f'Welcome back, {user.username}!')
                next_url = request.GET.get('next', 'accounts:profile')
                if next_url == 'accounts:profile':
                    return redirect('accounts:profile', username=user.username)
                return redirect(next_url)
        else:
            messages.error(request, 'Invalid username or password.')

    return render(request, 'accounts/login.html')


@login_required
def user_logout(request):
    """User logout view"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('accounts:home')


@login_required
def profile(request, username):
    """User profile view"""
    user = get_object_or_404(User, username=username)

    if user.is_blocked and request.user != user and not request.user.is_staff:
        messages.error(request, 'This user account is not accessible.')
        return redirect('accounts:home')

    status_updates = user.status_updates.all()[:10]

    enrolled_courses = []
    taught_courses = []
    upcoming_deadlines = []

    if user.is_student():
        enrollments = Enrollment.objects.filter(student=user, is_active=True).select_related('course')
        enrolled_courses = [enrollment.course for enrollment in enrollments]

        for course in enrolled_courses:
            if course.end_date:
                upcoming_deadlines.append({
                    'course': course,
                    'deadline': course.end_date
                })

    elif user.is_teacher():
        taught_courses = Course.objects.filter(teacher=user, is_active=True)

    unread_notifications = Notification.objects.filter(recipient=user, is_read=False).count()

    context = {
        'profile_user': user,
        'status_updates': status_updates,
        'enrolled_courses': enrolled_courses,
        'taught_courses': taught_courses,
        'upcoming_deadlines': sorted(upcoming_deadlines, key=lambda x: x['deadline'])[:5],
        'unread_notifications': unread_notifications,
    }

    return render(request, 'accounts/profile.html', context)


@login_required
def update_profile(request):
    """Update user profile view"""
    if request.method == 'POST':
        form = UserProfileUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('accounts:profile', username=request.user.username)
    else:
        form = UserProfileUpdateForm(instance=request.user)

    return render(request, 'accounts/update_profile.html', {'form': form})


@login_required
def create_status_update(request):
    """Create status update view"""
    if request.method == 'POST':
        form = StatusUpdateForm(request.POST)
        if form.is_valid():
            status_update = form.save(commit=False)
            status_update.user = request.user
            status_update.save()
            messages.success(request, 'Status update posted!')
            return redirect('accounts:profile', username=request.user.username)
    else:
        form = StatusUpdateForm()

    return render(request, 'accounts/create_status_update.html', {'form': form})


@login_required
def delete_status_update(request, pk):
    """Delete status update view"""
    status_update = get_object_or_404(StatusUpdate, pk=pk)

    if status_update.user != request.user:
        messages.error(request, 'You can only delete your own status updates.')
        return redirect('accounts:profile', username=request.user.username)

    if request.method == 'POST':
        status_update.delete()
        messages.success(request, 'Status update deleted!')
        return redirect('accounts:profile', username=request.user.username)

    return render(request, 'accounts/delete_status_update.html', {'status_update': status_update})


@login_required
def search_users(request):
    """Search for users (teachers only)"""
    if not request.user.is_teacher():
        messages.error(request, 'Only teachers can search for users.')
        return redirect('accounts:profile', username=request.user.username)

    form = UserSearchForm(request.GET or None)
    users = []

    if form.is_valid():
        query = form.cleaned_data.get('query', '')
        user_type = form.cleaned_data.get('user_type', '')

        users = User.objects.filter(is_blocked=False).exclude(id=request.user.id)

        if query:
            users = users.filter(
                Q(username__icontains=query) |
                Q(full_name__icontains=query) |
                Q(email__icontains=query)
            )

        if user_type:
            users = users.filter(user_type=user_type)

        users = users[:50]

    context = {
        'form': form,
        'users': users,
    }

    return render(request, 'accounts/search_users.html', context)


@login_required
def notifications_list(request):
    """List user notifications"""
    notifications = Notification.objects.filter(recipient=request.user)[:50]
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)

    return render(request, 'accounts/notifications.html', {'notifications': notifications})
