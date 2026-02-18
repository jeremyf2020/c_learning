export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  bio: string;
  photo: string | null;
  date_of_birth: string | null;
  phone_number: string;
  is_blocked: boolean;
  created_at: string;
  status_updates?: StatusUpdate[];
  has_ai_key?: boolean;
}

export interface StatusUpdate {
  id: number;
  user: number;
  username: string;
  content: string;
  created_at: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  teacher: number;
  teacher_name: string;
  code: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  enrolled_count: number;
  average_rating: number | null;
}

export interface CourseMaterial {
  id: number;
  course: number;
  title: string;
  description: string;
  material_type: 'document' | 'image' | 'video' | 'other';
  file: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface Enrollment {
  id: number;
  student: number;
  student_name: string;
  course: number;
  course_title: string;
  enrolled_at: string;
  is_active: boolean;
  completed: boolean;
}

export interface Feedback {
  id: number;
  course: number;
  student: number;
  student_name: string;
  rating: number | null;
  comment: string;
  created_at: string;
}

export interface Invitation {
  id: number;
  invited_by: number;
  invited_by_username: string;
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  date_of_birth: string | null;
  phone_number: string;
  bio: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface InvitationPublic {
  email: string;
  full_name: string;
  user_type: 'student' | 'teacher';
  date_of_birth: string | null;
  phone_number: string;
  bio: string;
  status: string;
}

export interface ClassroomRoom {
  id: number;
  name: string;
  participants: number[];
  participant_names: string[];
  last_message: { sender: string; content: string; created_at: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ClassroomMessage {
  id: number;
  room: number;
  sender: number;
  sender_name: string;
  content: string;
  created_at: string;
  user_type?: 'student' | 'teacher';
}

export type WhiteboardTool = 'pen' | 'line' | 'text' | 'eraser' | 'move';

export interface WbDrawAction {
  type: 'draw';
  points: [number, number][];
  color: string;
  width: number;
}

export interface WbLineAction {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface WbTextAction {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;
  color: string;
}

export interface WbEraseAction {
  type: 'erase';
  points: [number, number][];
  width: number;
}

export interface WbClearAction {
  type: 'clear';
}

export type WhiteboardAction = WbDrawAction | WbLineAction | WbTextAction | WbEraseAction | WbClearAction;

export interface AppNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface BulkUploadResult {
  success: Array<{ row: number; email: string }>;
  errors: Array<{ row: number; error: string }>;
  total: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Assignment {
  id: number;
  course: number;
  course_title: string;
  title: string;
  assignment_type: 'quiz' | 'flashcard';
  content: { questions?: QuizQuestion[]; cards?: Flashcard[] };
  source_file: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  deadline: string | null;
  submission_count: number;
}

export interface AssignmentSubmission {
  id: number;
  assignment: number;
  student: number;
  student_name: string;
  answers: number[];
  score: number | null;
  submitted_at: string;
}
