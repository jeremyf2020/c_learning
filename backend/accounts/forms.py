from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User, StatusUpdate


class UserRegistrationForm(UserCreationForm):
    """Form for user registration"""
    email = forms.EmailField(required=True)
    full_name = forms.CharField(max_length=255, required=False)
    user_type = forms.ChoiceField(
        choices=User.USER_TYPE_CHOICES,
        widget=forms.RadioSelect,
        initial='student'
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'full_name', 'user_type', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.full_name = self.cleaned_data['full_name']
        user.user_type = self.cleaned_data['user_type']
        if commit:
            user.save()
        return user


class UserProfileUpdateForm(forms.ModelForm):
    """Form for updating user profile"""
    class Meta:
        model = User
        fields = ['full_name', 'bio', 'photo', 'date_of_birth', 'phone_number']
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'bio': forms.Textarea(attrs={'rows': 4}),
        }


class StatusUpdateForm(forms.ModelForm):
    """Form for creating status updates"""
    class Meta:
        model = StatusUpdate
        fields = ['content']
        widgets = {
            'content': forms.Textarea(attrs={'rows': 3, 'placeholder': 'What\'s on your mind?'}),
        }


class UserSearchForm(forms.Form):
    """Form for searching users"""
    query = forms.CharField(
        max_length=100,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'Search by username or name...', 'class': 'form-control'})
    )
    user_type = forms.ChoiceField(
        choices=[('', 'All'), ('student', 'Students'), ('teacher', 'Teachers')],
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'})
    )
