from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import Course, CourseMaterial, Enrollment, Feedback
from .forms import CourseForm, CourseMaterialForm, FeedbackForm
from notifications.utils import create_notification, create_bulk_notifications


@login_required
def course_list(request):
    """List all available courses"""
    courses = Course.objects.filter(is_active=True).select_related('teacher')

    if request.user.is_student():
        enrolled_course_ids = Enrollment.objects.filter(
            student=request.user,
            is_active=True
        ).values_list('course_id', flat=True)
    else:
        enrolled_course_ids = []

    context = {
        'courses': courses,
        'enrolled_course_ids': enrolled_course_ids,
    }

    return render(request, 'courses/course_list.html', context)


@login_required
def course_detail(request, pk):
    """Course detail view"""
    course = get_object_or_404(Course, pk=pk)
    materials = course.materials.all().order_by('-uploaded_at')
    feedbacks = course.feedbacks.all().select_related('student')

    is_enrolled = False
    enrollment = None
    can_leave_feedback = False

    if request.user.is_student():
        enrollment = Enrollment.objects.filter(student=request.user, course=course, is_active=True).first()
        is_enrolled = enrollment is not None
        can_leave_feedback = is_enrolled and not Feedback.objects.filter(student=request.user, course=course).exists()

    is_teacher = request.user == course.teacher

    enrolled_students = []
    if is_teacher:
        enrolled_students = Enrollment.objects.filter(course=course, is_active=True).select_related('student')

    context = {
        'course': course,
        'materials': materials,
        'feedbacks': feedbacks,
        'is_enrolled': is_enrolled,
        'is_teacher': is_teacher,
        'enrolled_students': enrolled_students,
        'can_leave_feedback': can_leave_feedback,
    }

    return render(request, 'courses/course_detail.html', context)


@login_required
def course_create(request):
    """Create new course (teachers only)"""
    if not request.user.is_teacher():
        messages.error(request, 'Only teachers can create courses.')
        return redirect('courses:course_list')

    if request.method == 'POST':
        form = CourseForm(request.POST)
        if form.is_valid():
            course = form.save(commit=False)
            course.teacher = request.user
            course.save()
            messages.success(request, f'Course "{course.title}" created successfully!')
            return redirect('courses:course_detail', pk=course.pk)
    else:
        form = CourseForm()

    return render(request, 'courses/course_form.html', {'form': form, 'action': 'Create'})


@login_required
def course_update(request, pk):
    """Update course (teachers only)"""
    course = get_object_or_404(Course, pk=pk)

    if course.teacher != request.user:
        messages.error(request, 'You can only update your own courses.')
        return redirect('courses:course_detail', pk=pk)

    if request.method == 'POST':
        form = CourseForm(request.POST, instance=course)
        if form.is_valid():
            form.save()
            messages.success(request, 'Course updated successfully!')
            return redirect('courses:course_detail', pk=pk)
    else:
        form = CourseForm(instance=course)

    return render(request, 'courses/course_form.html', {'form': form, 'action': 'Update', 'course': course})


@login_required
def course_delete(request, pk):
    """Delete course (teachers only)"""
    course = get_object_or_404(Course, pk=pk)

    if course.teacher != request.user:
        messages.error(request, 'You can only delete your own courses.')
        return redirect('courses:course_detail', pk=pk)

    if request.method == 'POST':
        course_title = course.title
        course_code = course.code
        enrolled_students = Enrollment.objects.filter(course=course, is_active=True).select_related('student')
        recipients = [enrollment.student for enrollment in enrolled_students]
        if recipients:
            create_bulk_notifications(
                recipients=recipients,
                notification_type='general',
                title=f'Course deleted: {course_code}',
                message=f'The course "{course_title}" has been deleted by the teacher.',
            )
        course.delete()
        messages.success(request, f'Course "{course_title}" deleted successfully!')
        return redirect('courses:course_list')

    return render(request, 'courses/course_confirm_delete.html', {'course': course})


@login_required
def upload_material(request, course_pk):
    """Upload course material (teachers only)"""
    course = get_object_or_404(Course, pk=course_pk)

    if course.teacher != request.user:
        messages.error(request, 'You can only upload materials to your own courses.')
        return redirect('courses:course_detail', pk=course_pk)

    if request.method == 'POST':
        form = CourseMaterialForm(request.POST, request.FILES)
        if form.is_valid():
            material = form.save(commit=False)
            material.course = course
            material.uploaded_by = request.user
            material.save()

            enrolled_students = Enrollment.objects.filter(course=course, is_active=True).select_related('student')
            recipients = [enrollment.student for enrollment in enrolled_students]
            create_bulk_notifications(
                recipients=recipients,
                notification_type='material',
                title=f'New material in {course.code}',
                message=f'New material "{material.title}" has been added to {course.title}.',
                link=f'/courses/{course.pk}/',
            )

            messages.success(request, 'Course material uploaded successfully!')
            return redirect('courses:course_detail', pk=course_pk)
    else:
        form = CourseMaterialForm()

    return render(request, 'courses/upload_material.html', {'form': form, 'course': course})


@login_required
def enroll_course(request, pk):
    """Enroll in a course (students only)"""
    if not request.user.is_student():
        messages.error(request, 'Only students can enroll in courses.')
        return redirect('courses:course_detail', pk=pk)

    course = get_object_or_404(Course, pk=pk)

    if not course.is_active:
        messages.error(request, 'This course is not currently active.')
        return redirect('courses:course_detail', pk=pk)

    enrollment, created = Enrollment.objects.get_or_create(
        student=request.user,
        course=course,
        defaults={'is_active': True}
    )

    if created:
        create_notification(
            recipient=course.teacher,
            notification_type='enrollment',
            title=f'New enrollment in {course.code}',
            message=f'{request.user.username} has enrolled in {course.title}.',
            link=f'/courses/{course.pk}/',
        )
        messages.success(request, f'You have successfully enrolled in "{course.title}"!')
    else:
        if not enrollment.is_active:
            enrollment.is_active = True
            enrollment.save()
            messages.success(request, f'You have re-enrolled in "{course.title}"!')
        else:
            messages.info(request, 'You are already enrolled in this course.')

    return redirect('courses:course_detail', pk=pk)


@login_required
def unenroll_course(request, pk):
    """Unenroll from a course (students only)"""
    if not request.user.is_student():
        messages.error(request, 'Only students can unenroll from courses.')
        return redirect('courses:course_detail', pk=pk)

    course = get_object_or_404(Course, pk=pk)
    enrollment = get_object_or_404(Enrollment, student=request.user, course=course, is_active=True)

    if request.method == 'POST':
        enrollment.is_active = False
        enrollment.save()
        create_notification(
            recipient=course.teacher,
            notification_type='enrollment',
            title=f'Student left {course.code}',
            message=f'{request.user.username} has unenrolled from {course.title}.',
            link=f'/courses/{course.pk}/',
        )
        messages.success(request, f'You have unenrolled from "{course.title}".')
        return redirect('courses:course_list')

    return render(request, 'courses/unenroll_confirm.html', {'course': course})


@login_required
def submit_feedback(request, course_pk):
    """Submit feedback for a course (students only)"""
    if not request.user.is_student():
        messages.error(request, 'Only students can submit feedback.')
        return redirect('courses:course_detail', pk=course_pk)

    course = get_object_or_404(Course, pk=course_pk)

    if not Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists():
        messages.error(request, 'You must be enrolled in this course to leave feedback.')
        return redirect('courses:course_detail', pk=course_pk)

    if Feedback.objects.filter(student=request.user, course=course).exists():
        messages.info(request, 'You have already submitted feedback for this course.')
        return redirect('courses:course_detail', pk=course_pk)

    if request.method == 'POST':
        form = FeedbackForm(request.POST)
        if form.is_valid():
            feedback = form.save(commit=False)
            feedback.student = request.user
            feedback.course = course
            feedback.save()

            create_notification(
                recipient=course.teacher,
                notification_type='feedback',
                title=f'New feedback for {course.code}',
                message=f'{request.user.username} has left feedback for {course.title}.',
                link=f'/courses/{course.pk}/',
            )

            messages.success(request, 'Thank you for your feedback!')
            return redirect('courses:course_detail', pk=course_pk)
    else:
        form = FeedbackForm()

    return render(request, 'courses/submit_feedback.html', {'form': form, 'course': course})


@login_required
def block_student(request, course_pk, student_pk):
    """Block a student from a course (teachers only)"""
    course = get_object_or_404(Course, pk=course_pk)

    if course.teacher != request.user:
        messages.error(request, 'You can only manage students in your own courses.')
        return redirect('courses:course_detail', pk=course_pk)

    from accounts.models import User
    student = get_object_or_404(User, pk=student_pk, user_type='student')
    enrollment = get_object_or_404(Enrollment, student=student, course=course)

    if request.method == 'POST':
        enrollment.is_active = False
        enrollment.save()
        create_notification(
            recipient=student,
            notification_type='enrollment',
            title=f'Removed from {course.code}',
            message=f'You have been removed from "{course.title}" by the teacher.',
            link=f'/courses/{course.pk}/',
        )
        messages.success(request, f'Student {student.username} has been removed from the course.')
        return redirect('courses:course_detail', pk=course_pk)

    return render(request, 'courses/block_student.html', {'course': course, 'student': student})
