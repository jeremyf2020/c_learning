from django import forms
from .models import Course, CourseMaterial, Feedback


class CourseForm(forms.ModelForm):
    """Form for creating and updating courses"""
    class Meta:
        model = Course
        fields = ['title', 'description', 'code', 'start_date', 'end_date', 'is_active']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
        }


class CourseMaterialForm(forms.ModelForm):
    """Form for uploading course materials"""
    class Meta:
        model = CourseMaterial
        fields = ['title', 'description', 'material_type', 'file']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }


class FeedbackForm(forms.ModelForm):
    """Form for submitting course feedback"""
    class Meta:
        model = Feedback
        fields = ['rating', 'comment']
        widgets = {
            'rating': forms.RadioSelect(choices=[(i, str(i)) for i in range(1, 6)]),
            'comment': forms.Textarea(attrs={'rows': 4, 'placeholder': 'Share your thoughts about this course...'}),
        }
