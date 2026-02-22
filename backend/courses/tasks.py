import json
import logging
import urllib.request
import urllib.error

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def generate_assignment_task(course_id, user_id, assignment_type, pdf_text, title, deadline_str=None):
    """Generate quiz/flashcard assignment from PDF text using OpenAI API.

    Runs as a background Celery task to avoid blocking the HTTP request.
    """
    from django.utils.dateparse import parse_datetime
    from courses.models import Course, Assignment, Enrollment
    from accounts.models import User
    from notifications.utils import create_bulk_notifications

    try:
        course = Course.objects.get(pk=course_id)
        user = User.objects.get(pk=user_id)
    except (Course.DoesNotExist, User.DoesNotExist) as e:
        logger.error('generate_assignment_task: %s', e)
        return {'error': str(e)}

    api_key = user.ai_api_key
    if not api_key:
        return {'error': 'No API key configured'}

    # Build prompt
    if assignment_type == 'flashcard':
        prompt = (
            'Based on the following text, create 10 educational flashcards.\n'
            'Return ONLY valid JSON with this exact format (no markdown, no extra text):\n'
            '{"cards": [{"front": "term or question", "back": "definition or answer"}]}\n\n'
            f'Text:\n{pdf_text}'
        )
    else:
        prompt = (
            'Based on the following text, create a quiz with 10 multiple-choice questions.\n'
            'Each question must have 4 answer options. The options must be the actual answer text, '
            'NOT letter labels. Do NOT prefix options with "A.", "B.", etc.\n'
            'Return ONLY valid JSON (no markdown, no extra text) with this exact structure:\n'
            '{"questions": [{"question": "What is photosynthesis?", '
            '"options": ["The process of converting light to energy", '
            '"The process of cell division", '
            '"The process of water absorption", '
            '"The process of respiration"], '
            '"correct": 0}]}\n'
            '"correct" is the zero-based index (0-3) of the correct option.\n\n'
            f'Text:\n{pdf_text}'
        )

    # Call OpenAI API
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = json.dumps({
        'model': 'gpt-3.5-turbo',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7,
    }).encode('utf-8')

    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            ai_response = data['choices'][0]['message']['content']
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        logger.error('OpenAI API error: %s', e)
        return {'error': f'OpenAI API error: {e}'}

    # Parse JSON from response
    raw = ai_response.strip()
    if raw.startswith('```'):
        lines = raw.split('\n')
        lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        raw = '\n'.join(lines)

    try:
        content = json.loads(raw)
    except json.JSONDecodeError:
        return {'error': 'AI returned invalid JSON', 'raw_response': ai_response}

    if not title:
        title = f'{assignment_type.capitalize()} - {course.code}'

    deadline_val = parse_datetime(deadline_str) if deadline_str else None

    assignment = Assignment.objects.create(
        course=course,
        title=title,
        assignment_type=assignment_type,
        content=content,
        created_by=user,
        deadline=deadline_val,
    )

    # Send deadline notifications if applicable
    if assignment.deadline:
        enrollments = Enrollment.objects.filter(
            course=course, is_active=True
        ).select_related('student')
        recipients = [enrollment.student for enrollment in enrollments]
        create_bulk_notifications(
            recipients=recipients,
            notification_type='deadline',
            title=f'Assignment Deadline: {assignment.title}',
            message=(
                f'A deadline has been set for "{assignment.title}" in {course.title}: '
                f'{assignment.deadline.strftime("%b %d, %Y %I:%M %p")}.'
            ),
            link=f'/assignments/{assignment.id}',
        )

    return {'assignment_id': assignment.id, 'title': assignment.title}
