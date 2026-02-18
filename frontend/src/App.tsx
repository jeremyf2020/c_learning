import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import AcceptInvitation from './pages/AcceptInvitation';
import InvitationList from './pages/InvitationList';
import InviteSingle from './pages/InviteSingle';
import InviteBulk from './pages/InviteBulk';
import StudentHome from './pages/StudentHome';
import TeacherHome from './pages/TeacherHome';
import Profile from './pages/Profile';
import CourseDetail from './pages/CourseDetail';
import CourseCreate from './pages/CourseCreate';
import Classroom from './pages/Classroom';
import Notifications from './pages/Notifications';
import AssignmentView from './pages/AssignmentView';

function Home() {
    const { user } = useAuth();
    if (user?.user_type === 'teacher') return <TeacherHome />;
    return <StudentHome />;
}

function AppRoutes() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
    }

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
            <Route path="/invite/:token" element={<AcceptInvitation />} />

            {/* Protected: Home (auto-routes to student or teacher home) */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

            {/* Profile */}
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Courses */}
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/courses/create" element={<ProtectedRoute requiredType="teacher"><CourseCreate /></ProtectedRoute>} />

            {/* Assignments */}
            <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentView /></ProtectedRoute>} />

            {/* Classroom / Chat */}
            <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
            <Route path="/classroom/:roomId" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />

            {/* Notifications */}
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* Teacher: Invitations */}
            <Route path="/invitations" element={<ProtectedRoute requiredType="teacher"><InvitationList /></ProtectedRoute>} />
            <Route path="/invitations/new" element={<ProtectedRoute requiredType="teacher"><InviteSingle /></ProtectedRoute>} />
            <Route path="/invitations/bulk" element={<ProtectedRoute requiredType="teacher"><InviteBulk /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

function Layout() {
    const { isAuthenticated } = useAuth();
    return (
        <>
            {isAuthenticated && <Navbar />}
            <div className={isAuthenticated ? 'container-fluid px-4 mt-3' : ''}>
                <AppRoutes />
            </div>
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Layout />
            </AuthProvider>
        </BrowserRouter>
    );
}
