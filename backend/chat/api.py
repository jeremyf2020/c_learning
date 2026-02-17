from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ChatRoom, ChatMessage
from .serializers import ChatRoomSerializer, ChatMessageSerializer


class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # All authenticated users can see all rooms
        return ChatRoom.objects.all()

    def perform_create(self, serializer):
        room = serializer.save()
        # Add the creator as participant
        room.participants.add(self.request.user)
        # Add any other participants from the request
        participant_ids = self.request.data.get('participants', [])
        if participant_ids:
            from accounts.models import User
            users = User.objects.filter(id__in=participant_ids)
            room.participants.add(*users)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a chat room"""
        room = self.get_object()
        room.participants.add(request.user)
        return Response(ChatRoomSerializer(room).data)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room = self.get_object()
        # Auto-join when viewing messages
        if request.user not in room.participants.all():
            room.participants.add(request.user)
        messages = room.messages.order_by('-created_at')[:100]
        serializer = ChatMessageSerializer(reversed(list(messages)), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        room = self.get_object()
        # Auto-join when sending a message
        if request.user not in room.participants.all():
            room.participants.add(request.user)
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Message content required.'}, status=status.HTTP_400_BAD_REQUEST)
        msg = ChatMessage.objects.create(room=room, sender=request.user, content=content)
        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
