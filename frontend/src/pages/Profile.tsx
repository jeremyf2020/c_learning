import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User, Enrollment, Course } from '../types';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', bio: '', phone_number: '', date_of_birth: '' });

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const usersRes = await client.get('/users/');
        const found = usersRes.data.find((u: User) => u.username === username);
        if (found) {
          const detailRes = await client.get(`/users/${found.id}/`);
          setProfileUser(detailRes.data);
          setEditData({
            full_name: detailRes.data.full_name || '',
            bio: detailRes.data.bio || '',
            phone_number: detailRes.data.phone_number || '',
            date_of_birth: detailRes.data.date_of_birth || '',
          });
        }
        if (isOwnProfile) {
          const [enrollRes, courseRes] = await Promise.all([
            client.get('/enrollments/'),
            client.get('/courses/'),
          ]);
          setEnrollments(enrollRes.data);
          setCourses(courseRes.data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchProfile();
  }, [username, isOwnProfile]);

  const handleSave = async () => {
    try {
      await client.patch('/users/update_profile/', editData);
      setProfileUser(prev => prev ? { ...prev, ...editData } : prev);
      setEditing(false);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!profileUser) return <div className="text-center mt-5"><h4>User not found</h4></div>;

  const enrolledCourseIds = new Set(enrollments.map(e => e.course));
  const myCourses = profileUser.user_type === 'teacher'
    ? courses.filter(c => c.teacher === profileUser.id)
    : courses.filter(c => enrolledCourseIds.has(c.id));

  const deadlines = myCourses
    .filter(c => c.end_date)
    .sort((a, b) => (a.end_date || '').localeCompare(b.end_date || ''));

  return (
    <div className="row mt-3">
      {/* Profile info */}
      <div className="col-lg-4">
        <div className="card mb-3">
          <div className="card-body text-center">
            <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 80, height: 80 }}>
              <span className="text-white display-6">{profileUser.username.charAt(0).toUpperCase()}</span>
            </div>
            <h5>{profileUser.username}</h5>
            <span className="badge bg-info mb-2">{profileUser.user_type}</span>

            {!editing ? (
              <>
                <p className="text-muted">{profileUser.full_name || 'No name set'}</p>
                <p className="small">{profileUser.bio || 'No bio'}</p>
                {profileUser.email && <p className="small text-muted">{profileUser.email}</p>}
                {profileUser.phone_number && <p className="small text-muted">{profileUser.phone_number}</p>}
                {profileUser.date_of_birth && <p className="small text-muted">Born: {profileUser.date_of_birth}</p>}
                {isOwnProfile && (
                  <button className="btn btn-sm btn-outline-primary" onClick={() => setEditing(true)}>Edit Profile</button>
                )}
              </>
            ) : (
              <div className="text-start">
                <div className="mb-2">
                  <label className="form-label small">Full Name</label>
                  <input className="form-control form-control-sm" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Bio</label>
                  <textarea className="form-control form-control-sm" rows={3} value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Phone</label>
                  <input className="form-control form-control-sm" value={editData.phone_number} onChange={e => setEditData({ ...editData, phone_number: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Date of Birth</label>
                  <input type="date" className="form-control form-control-sm" value={editData.date_of_birth} onChange={e => setEditData({ ...editData, date_of_birth: e.target.value })} />
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Status, Courses, Deadlines */}
      <div className="col-lg-8">
        {/* Status updates */}
        {profileUser.status_updates && profileUser.status_updates.length > 0 && (
          <div className="card mb-3">
            <div className="card-header"><strong>Status</strong></div>
            <div className="card-body">
              {profileUser.status_updates.map((s) => (
                <div key={s.id} className="border-bottom py-2">
                  <p className="mb-1">{s.content}</p>
                  <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered/Taught courses */}
        <div className="card mb-3">
          <div className="card-header">
            <strong>{profileUser.user_type === 'teacher' ? 'Taught Courses' : 'Registered Courses'}</strong>
          </div>
          <div className="card-body">
            {myCourses.length === 0 ? (
              <p className="text-muted mb-0">No courses yet.</p>
            ) : (
              <div className="row g-2">
                {myCourses.map(c => (
                  <div key={c.id} className="col-md-4">
                    <Link to={`/courses/${c.id}`} className="card text-decoration-none h-100">
                      <div className="card-body p-2">
                        <h6 className="mb-1">{c.code}</h6>
                        <small className="text-muted">{c.title}</small>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        {deadlines.length > 0 && (
          <div className="card mb-3">
            <div className="card-header"><strong>Upcoming Deadlines</strong></div>
            <div className="card-body p-0">
              <table className="table mb-0">
                <tbody>
                  {deadlines.map(c => (
                    <tr key={c.id}>
                      <td><Link to={`/courses/${c.id}`}>{c.code} - {c.title}</Link></td>
                      <td className="text-end text-muted">{new Date(c.end_date!).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
