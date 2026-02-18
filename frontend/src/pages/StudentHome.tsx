import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, Enrollment, StatusUpdate, Assignment } from '../types';

export default function StudentHome() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [assignmentDeadlines, setAssignmentDeadlines] = useState<Assignment[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/enrollments/'),
      client.get('/courses/'),
      client.get('/status-updates/'),
      client.get('/assignments/'),
    ]).then(([enrollRes, courseRes, statusRes, assignRes]) => {
      setEnrollments(enrollRes.data);
      setCourses(courseRes.data);
      setStatusUpdates(statusRes.data);
      const allAssignments = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data.results || []);
      setAssignmentDeadlines(allAssignments.filter((a: Assignment) => a.deadline));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus.trim()) return;
    try {
      const res = await client.post('/status-updates/', { content: newStatus });
      setStatusUpdates([res.data, ...statusUpdates]);
      setNewStatus('');
    } catch { /* ignore */ }
  };

  const enrolledCourseIds = new Set(enrollments.map(e => e.course));
  const enrolledCourses = courses.filter(c => enrolledCourseIds.has(c.id));
  const availableCourses = courses.filter(c => !enrolledCourseIds.has(c.id));

  const courseDeadlines = enrolledCourses
    .filter(c => c.end_date)
    .map(c => ({ label: `${c.code} - ${c.title}`, deadline: c.end_date!, link: `/courses/${c.id}`, badge: 'Enrolled', badgeClass: 'bg-info' }));

  const assignDeadlines = assignmentDeadlines
    .filter(a => enrolledCourseIds.has(a.course))
    .map(a => ({ label: `${a.course_title} - ${a.title}`, deadline: a.deadline!, link: `/assignments/${a.id}`, badge: a.assignment_type === 'quiz' ? 'Quiz' : 'Flashcards', badgeClass: 'bg-warning text-dark' }));

  const deadlines = [...courseDeadlines, ...assignDeadlines]
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const handleEnroll = async (courseId: number) => {
    try {
      await client.post(`/courses/${courseId}/enroll/`);
      const enrollRes = await client.get('/enrollments/');
      setEnrollments(enrollRes.data);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="row mt-3">
      {/* Left column: Feeds & Deadlines */}
      <div className="col-lg-8">
        {/* Status update form */}
        <div className="card mb-3">
          <div className="card-body">
            <form onSubmit={handlePostStatus} className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="What's on your mind?"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Post</button>
            </form>
          </div>
        </div>

        {/* Feeds / Status */}
        <div className="card mb-3">
          <div className="card-header"><strong>Feeds</strong></div>
          <div className="card-body">
            {statusUpdates.length === 0 ? (
              <p className="text-muted mb-0">No status updates yet.</p>
            ) : (
              statusUpdates.map(s => (
                <div key={s.id} className="border-bottom py-2">
                  <strong>{s.username}</strong>
                  <p className="mb-1">{s.content}</p>
                  <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deadlines table */}
        <div className="card mb-3">
          <div className="card-header"><strong>Deadlines</strong></div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr><th>Course / Assignment</th><th>Type</th><th>Deadline</th></tr>
              </thead>
              <tbody>
                {deadlines.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-muted">No upcoming deadlines</td></tr>
                ) : (
                  deadlines.map((d, i) => (
                    <tr key={i}>
                      <td><Link to={d.link}>{d.label}</Link></td>
                      <td><span className={`badge ${d.badgeClass}`}>{d.badge}</span></td>
                      <td>{new Date(d.deadline).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Course list */}
        <h5 className="mb-3">My Courses</h5>
        <div className="row g-3 mb-4">
          {enrolledCourses.length === 0 ? (
            <p className="text-muted">Not enrolled in any courses yet.</p>
          ) : (
            enrolledCourses.map(c => (
              <div key={c.id} className="col-md-3">
                <div className="card h-100">
                  <div className="card-body">
                    <h6 className="card-title">{c.code}</h6>
                    <p className="card-text small text-truncate">{c.title}</p>
                    <small className="text-muted">{c.enrolled_count} enrolled</small>
                  </div>
                  <div className="card-footer bg-white border-0">
                    <Link to={`/courses/${c.id}`} className="btn btn-sm btn-outline-primary w-100">View</Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Available courses */}
        <h5 className="mb-3">Available Courses</h5>
        <div className="row g-3">
          {availableCourses.map(c => (
            <div key={c.id} className="col-md-3">
              <div className="card h-100 border-dashed">
                <div className="card-body">
                  <h6 className="card-title">{c.code}</h6>
                  <p className="card-text small text-truncate">{c.title}</p>
                  <small className="text-muted">by {c.teacher_name}</small>
                </div>
                <div className="card-footer bg-white border-0">
                  <button onClick={() => handleEnroll(c.id)} className="btn btn-sm btn-success w-100">Enroll</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: Profile summary */}
      <div className="col-lg-4">
        <div className="card el-card-accent mb-3">
          <div className="card-body text-center">
            {user?.photo ? (
              <img src={user.photo} alt={user.username} className="rounded-circle object-fit-cover mb-2" style={{ width: 60, height: 60 }} />
            ) : (
              <div className="el-avatar-gradient rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 60, height: 60 }}>
                <span className="text-white fs-4">{user?.username?.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <h6>{user?.username}</h6>
            <p className="text-muted small">{user?.full_name}</p>
            <Link to={`/profile/${user?.username}`} className="btn btn-sm btn-outline-primary">View Profile</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
