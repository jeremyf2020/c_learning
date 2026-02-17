import csv
from pathlib import Path
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Generate sample CSV files for bulk invitation upload'

    def handle(self, *args, **kwargs):
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        seed_dir = base_dir / 'seed_data'
        seed_dir.mkdir(exist_ok=True)

        headers = ['full_name', 'email', 'user_type', 'date_of_birth', 'phone_number', 'bio']

        # ── File 1: Valid sample data ────────────────────────────────
        students = [
            ['Liam Anderson', 'liam.anderson@school.edu', 'student', '2003-05-12', '+1-555-1001', 'First-year CS student'],
            ['Mia Thompson', 'mia.thompson@school.edu', 'student', '2002-09-23', '+1-555-1002', 'Interested in web development'],
            ['Noah Davis', 'noah.davis@school.edu', 'student', '2003-01-07', '+1-555-1003', 'Math and programming enthusiast'],
            ['Olivia Wilson', 'olivia.wilson@school.edu', 'student', '2002-11-15', '+1-555-1004', 'Data science student'],
            ['Lucas Martinez', 'lucas.martinez@school.edu', 'student', '2001-06-30', '+1-555-1005', 'Mobile app developer'],
            ['Sophia Taylor', 'sophia.taylor@school.edu', 'student', '2003-03-18', '+1-555-1006', 'UX/UI design student'],
            ['Aiden Brown', 'aiden.brown@school.edu', 'student', '2002-07-25', '+1-555-1007', 'Game development enthusiast'],
            ['Emma Clark', 'emma.clark@school.edu', 'student', '2003-08-09', '+1-555-1008', 'Cloud computing student'],
            ['James Lewis', 'james.lewis@school.edu', 'student', '2001-04-14', '+1-555-1009', 'DevOps and automation fan'],
            ['Isabella Hall', 'isabella.hall@school.edu', 'student', '2002-12-03', '+1-555-1010', 'Cybersecurity student'],
        ]

        file1 = seed_dir / 'sample_students_valid.csv'
        with open(file1, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(students)
        self.stdout.write(self.style.SUCCESS(f'Created: {file1}'))

        # ── File 2: Mixed valid/invalid (for testing error handling) ─
        mixed_rows = [
            ['Valid Student', 'valid.student@school.edu', 'student', '2003-02-14', '+1-555-2001', 'This row is valid'],
            ['Another Valid', 'another.valid@school.edu', 'teacher', '1988-11-20', '+1-555-2002', 'Valid teacher row'],
            ['No Email', '', 'student', '2003-01-01', '+1-555-2003', 'This row has no email - will fail'],
            ['Bad Type', 'bad.type@school.edu', 'admin', '2003-01-01', '+1-555-2004', 'Invalid user_type - will fail'],
            ['Bad Date', 'bad.date@school.edu', 'student', 'not-a-date', '+1-555-2005', 'Invalid date - will fail'],
            ['Duplicate Email', 'alice@elearning.com', 'student', '2003-01-01', '+1-555-2006', 'Email already registered - will fail'],
            ['Valid Again', 'valid.again@school.edu', 'student', '2002-05-05', '+1-555-2007', 'This row is valid'],
            ['Empty Bio OK', 'empty.bio@school.edu', 'student', '2003-06-10', '+1-555-2008', ''],
        ]

        file2 = seed_dir / 'sample_students_mixed.csv'
        with open(file2, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(mixed_rows)
        self.stdout.write(self.style.SUCCESS(f'Created: {file2}'))

        # ── File 3: Large batch (20 students) ────────────────────────
        first_names = [
            'Alex', 'Blake', 'Casey', 'Drew', 'Eden',
            'Frankie', 'Gray', 'Harper', 'Indie', 'Jordan',
            'Kai', 'Logan', 'Morgan', 'Noel', 'Parker',
            'Quinn', 'Riley', 'Sage', 'Taylor', 'Winter',
        ]
        last_names = [
            'Adams', 'Baker', 'Cooper', 'Dixon', 'Evans',
            'Foster', 'Grant', 'Hayes', 'Irving', 'Jones',
            'Kelly', 'Lane', 'Moore', 'Nash', 'Owen',
            'Patel', 'Reed', 'Stone', 'Turner', 'Walsh',
        ]

        file3 = seed_dir / 'sample_students_batch.csv'
        with open(file3, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for i, (first, last) in enumerate(zip(first_names, last_names)):
                writer.writerow([
                    f'{first} {last}',
                    f'{first.lower()}.{last.lower()}@batch.school.edu',
                    'student',
                    f'200{1 + i % 4}-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}',
                    f'+1-555-3{i + 1:03d}',
                    f'Batch import student #{i + 1}',
                ])
        self.stdout.write(self.style.SUCCESS(f'Created: {file3}'))

        # ── Blank template ───────────────────────────────────────────
        file4 = seed_dir / 'invitation_template.csv'
        with open(file4, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerow(['Jane Doe', 'jane@example.com', 'student', '2000-01-15', '+1234567890', 'Example student'])
        self.stdout.write(self.style.SUCCESS(f'Created: {file4}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('All sample CSV files generated in:'))
        self.stdout.write(f'  {seed_dir}/')
        self.stdout.write('')
        self.stdout.write('Files:')
        self.stdout.write(f'  sample_students_valid.csv  - 10 valid students for clean import')
        self.stdout.write(f'  sample_students_mixed.csv  - 8 rows with intentional errors for testing')
        self.stdout.write(f'  sample_students_batch.csv  - 20 students for batch import')
        self.stdout.write(f'  invitation_template.csv    - Blank template with example row')
