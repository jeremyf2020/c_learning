from datetime import timedelta

from django.contrib.auth import authenticate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from notifications.tasks import send_invitation_email

from .models import User, StatusUpdate, Invitation
from .serializers import (
    UserSerializer, UserDetailSerializer, StatusUpdateSerializer,
    InvitationSerializer, InvitationPublicSerializer,
    AcceptInvitationSerializer, LoginSerializer, RegisterSerializer,
)


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_teacher() or request.user.is_staff)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.filter(is_blocked=False)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserDetailSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['patch'], parser_classes=[MultiPartParser, FormParser])
    def update_profile(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        user_type = request.query_params.get('user_type', '')
        include_blocked = request.query_params.get('include_blocked', '').lower() in ('true', '1')
        qs = User.objects.exclude(id=request.user.id)
        if not include_blocked:
            qs = qs.filter(is_blocked=False)
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=query) | Q(full_name__icontains=query) | Q(email__icontains=query))
        if user_type:
            qs = qs.filter(user_type=user_type)
        serializer = UserSerializer(qs[:50], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can block users'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        user.is_blocked = True
        user.save(update_fields=['is_blocked'])
        return Response({'message': f'{user.username} has been blocked.'})

    @action(detail=True, methods=['post'])
    def unblock(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can unblock users'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user.is_blocked = False
        user.save(update_fields=['is_blocked'])
        return Response({'message': f'{user.username} has been unblocked.'})

    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        if not request.user.is_teacher() and not request.user.is_staff:
            return Response({'error': 'Only teachers can delete users'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if user == request.user:
            return Response({'error': 'You cannot delete yourself'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser:
            return Response({'error': 'Cannot delete a superuser'}, status=status.HTTP_403_FORBIDDEN)
        username = user.username
        user.delete()
        return Response({'message': f'{username} has been deleted.'}, status=status.HTTP_200_OK)


class StatusUpdateViewSet(viewsets.ModelViewSet):
    queryset = StatusUpdate.objects.all()
    serializer_class = StatusUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return StatusUpdate.objects.filter(user=self.request.user)
        return StatusUpdate.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [IsTeacher]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        return Invitation.objects.filter(invited_by=self.request.user)

    def perform_create(self, serializer):
        invitation = serializer.save(invited_by=self.request.user)
        send_invitation_email.delay(invitation.pk)

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        invitation = self.get_object()
        if invitation.status == 'accepted':
            return Response(
                {'detail': 'This invitation has already been accepted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.expires_at = timezone.now() + timedelta(days=30)
        invitation.status = 'pending'
        invitation.save(update_fields=['expires_at', 'status'])
        send_invitation_email.delay(invitation.pk)
        return Response({'detail': f'Invitation resent to {invitation.email}.'})

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if not csv_file.name.endswith('.csv'):
            return Response({'detail': 'Only .csv files are supported.'}, status=status.HTTP_400_BAD_REQUEST)
        if csv_file.size > 5 * 1024 * 1024:
            return Response({'detail': 'File size must be under 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        results = _process_csv_upload(csv_file, request.user, request)
        return Response(results)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import csv as csv_mod
        import io

        output = io.StringIO()
        writer = csv_mod.writer(output)
        headers = ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio']
        writer.writerow(headers)
        writer.writerow(['John Doe', 'john@example.com', 'student', '2000-01-15', '+1234567890', 'A new student'])

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="invitation_template.csv"'
        response.write(output.getvalue())
        return response


# ---------- Public invite endpoints ----------

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def validate_invite(request, token):
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        return Response({'detail': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.status == 'accepted':
        return Response({'detail': 'This invitation has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.is_expired:
        invitation.status = 'expired'
        invitation.save(update_fields=['status'])
        return Response({'detail': 'This invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = InvitationPublicSerializer(invitation)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def accept_invite(request, token):
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        return Response({'detail': 'Invalid invitation token.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.status == 'accepted':
        return Response({'detail': 'This invitation has already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.is_expired:
        invitation.status = 'expired'
        invitation.save(update_fields=['status'])
        return Response({'detail': 'This invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AcceptInvitationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = User.objects.create_user(
        username=serializer.validated_data['username'],
        email=invitation.email,
        password=serializer.validated_data['password'],
        full_name=invitation.full_name,
        user_type=invitation.user_type,
        date_of_birth=invitation.date_of_birth,
        phone_number=invitation.phone_number,
        bio=invitation.bio,
    )

    invitation.status = 'accepted'
    invitation.created_user = user
    invitation.save(update_fields=['status', 'created_user'])

    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


# ---------- Auth endpoints ----------

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )

    if user is None:
        return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    if user.is_blocked:
        return Response({'detail': 'Your account has been blocked.'}, status=status.HTTP_403_FORBIDDEN)

    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token_obj, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token_obj.key,
        'user': UserSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auth_me(request):
    serializer = UserDetailSerializer(request.user, context={'request': request})
    return Response(serializer.data)


# ---------- Helper functions ----------

def _process_csv_upload(csv_file, invited_by, request):
    import csv as csv_mod
    import io
    from datetime import datetime

    results = {'success': [], 'errors': [], 'total': 0}

    try:
        content = csv_file.read().decode('utf-8')
        reader = csv_mod.reader(io.StringIO(content))
        rows = list(reader)
    except Exception:
        results['errors'].append({'row': 0, 'error': 'Could not read the CSV file. Ensure it is a valid UTF-8 encoded .csv file.'})
        return results

    if len(rows) < 2:
        results['errors'].append({'row': 0, 'error': 'The file has no data rows.'})
        return results

    expected_headers = ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio']
    header = [str(h).strip().lower() for h in rows[0]]
    if header != expected_headers:
        results['errors'].append({
            'row': 1,
            'error': f'Invalid headers. Expected: {expected_headers}. Got: {header}',
        })
        return results

    valid_user_types = {'student', 'teacher'}

    for row_num, row in enumerate(rows[1:], start=2):
        results['total'] += 1

        if len(row) < 6:
            results['errors'].append({'row': row_num, 'error': 'Row has fewer than 6 columns.'})
            continue

        full_name = row[0].strip()
        email = row[1].strip()
        user_type = row[2].strip().lower()
        dob_raw = row[3].strip()
        phone_number = row[4].strip()
        bio = row[5].strip()

        if not email or '@' not in email:
            results['errors'].append({'row': row_num, 'error': f'Invalid or missing email: "{email}"'})
            continue

        if user_type not in valid_user_types:
            results['errors'].append({'row': row_num, 'error': f'Invalid user_type: "{user_type}". Must be "student" or "teacher".'})
            continue

        if User.objects.filter(email=email).exists():
            results['errors'].append({'row': row_num, 'error': f'A user with email {email} already exists.'})
            continue

        if Invitation.objects.filter(email=email, status='pending', expires_at__gt=timezone.now()).exists():
            results['errors'].append({'row': row_num, 'error': f'An active invitation for {email} already exists.'})
            continue

        date_of_birth = None
        if dob_raw:
            try:
                date_of_birth = datetime.strptime(dob_raw, '%Y-%m-%d').date()
            except ValueError:
                results['errors'].append({'row': row_num, 'error': f'Invalid date format: "{dob_raw}". Use YYYY-MM-DD.'})
                continue

        invitation = Invitation(
            invited_by=invited_by,
            email=email,
            full_name=full_name,
            user_type=user_type,
            date_of_birth=date_of_birth,
            phone_number=phone_number,
            bio=bio,
        )
        invitation.save()
        send_invitation_email.delay(invitation.pk)
        results['success'].append({'row': row_num, 'email': email})

    return results
