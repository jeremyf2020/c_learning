from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import ChatRoom, ChatMessage
from accounts.models import User


@login_required
def chat_room_list(request):
    """List all chat rooms for the user"""
    chat_rooms = request.user.chat_rooms.all()
    return render(request, 'chat/room_list.html', {'chat_rooms': chat_rooms})


@login_required
def chat_room(request, room_name):
    """Chat room view"""
    room, created = ChatRoom.objects.get_or_create(name=room_name)

    if request.user not in room.participants.all():
        room.participants.add(request.user)

    messages_list = room.messages.all().select_related('sender')[:100]

    context = {
        'room_name': room_name,
        'room': room,
        'messages': messages_list,
    }

    return render(request, 'chat/room.html', context)


@login_required
def create_chat_room(request):
    """Create a new chat room"""
    if request.method == 'POST':
        room_name = request.POST.get('room_name', '').strip()
        participant_ids = request.POST.getlist('participants')

        if not room_name:
            messages.error(request, 'Room name is required.')
            return redirect('chat:create_room')

        room_name = room_name.replace(' ', '_').lower()

        room, created = ChatRoom.objects.get_or_create(name=room_name)

        room.participants.add(request.user)

        for user_id in participant_ids:
            try:
                user = User.objects.get(id=user_id)
                room.participants.add(user)
            except User.DoesNotExist:
                pass

        messages.success(request, f'Chat room "{room_name}" created!')
        return redirect('chat:room', room_name=room_name)

    users = User.objects.exclude(id=request.user.id).filter(is_blocked=False)
    return render(request, 'chat/create_room.html', {'users': users})
