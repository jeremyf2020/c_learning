from rest_framework import serializers
from .models import Classroom, ClassroomMessage


class ClassroomMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = ClassroomMessage
        fields = ['id', 'room', 'sender', 'sender_name', 'content', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']


class ClassroomSerializer(serializers.ModelSerializer):
    participant_names = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = ['id', 'name', 'participants', 'participant_names', 'last_message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'participants': {'required': False},
        }

    def get_participant_names(self, obj):
        return [u.username for u in obj.participants.all()]

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {'sender': msg.sender.username, 'content': msg.content[:100], 'created_at': msg.created_at}
        return None
