import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User, Enrollment, Course, Assignment } from '../types';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, refreshUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignmentDeadlines, setAssignmentDeadlines] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', bio: '', phone_number: '', date_of_birth: '' });
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Always fetch courses so taught/registered courses show on any profile
        const courseRes = await client.get('/courses/');
        setCourses(courseRes.data);

        if (isOwnProfile) {
          const [enrollRes, assignRes] = await Promise.all([
            client.get('/enrollments/'),
            client.get('/assignments/'),
          ]);
          setEnrollments(enrollRes.data);
          const allAssignments = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data.results || []);
          setAssignmentDeadlines(allAssignments.filter((a: Assignment) => a.deadline));
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

  const handleSaveApiKey = async () => {
    try {
      await client.patch('/users/update_profile/', { ai_api_key: apiKey });
      setProfileUser(prev => prev ? { ...prev, has_ai_key: !!apiKey } : prev);
      setApiKeySaved(true);
      setApiKey('');
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch { /* ignore */ }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await client.patch('/users/update_profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfileUser(prev => prev ? { ...prev, photo: res.data.photo } : prev);
      await refreshUser();
    } catch { /* ignore */ }
    setUploading(false);
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!profileUser) return <div className="text-center mt-5"><h4>User not found</h4></div>;

  const enrolledCourseIds = new Set(enrollments.map(e => e.course));
  const myCourses = profileUser.user_type === 'teacher'
    ? courses.filter(c => c.teacher === profileUser.id)
    : courses.filter(c => enrolledCourseIds.has(c.id));

  const courseDeadlineItems = myCourses
    .filter(c => c.end_date)
    .map(c => ({ label: `${c.code} - ${c.title}`, deadline: c.end_date!, link: `/courses/${c.id}` }));

  const assignDeadlineItems = assignmentDeadlines
    .filter(a => enrolledCourseIds.has(a.course))
    .map(a => ({ label: `${a.course_title} - ${a.title}`, deadline: a.deadline!, link: `/assignments/${a.id}` }));

  const deadlines = [...courseDeadlineItems, ...assignDeadlineItems]
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="row mt-3">
      {/* Profile info */}
      <div className="col-lg-4">
        <div className="card el-card-accent mb-3">
          <div className="card-body text-center">
            <div
              className="position-relative d-inline-block mb-3"
              style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
              onClick={() => isOwnProfile && fileInputRef.current?.click()}
            >
              {profileUser.photo ? (
                <img
                  src={profileUser.photo}
                  alt={profileUser.username}
                  className="rounded-circle object-fit-cover"
                  style={{ width: 80, height: 80 }}
                />
              ) : (
                <div className="el-avatar-gradient rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 80, height: 80 }}>
                  <span className="text-white display-6">{profileUser.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {isOwnProfile && (
                <div
                  className="position-absolute bottom-0 end-0 bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm border"
                  style={{ width: 28, height: 28 }}
                >
                  {uploading ? (
                    <div className="spinner-border spinner-border-sm text-primary" style={{ width: 14, height: 14 }}></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                      <path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/>
                    </svg>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="d-none"
                onChange={handlePhotoUpload}
              />
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

        {/* AI API Key settings (teachers only, own profile) */}
        {isOwnProfile && profileUser.user_type === 'teacher' && (
          <div className="card mb-3">
            <div className="card-header"><strong>AI API Key (OpenAI)</strong></div>
            <div className="card-body">
              <p className="small text-muted mb-2">
                Set your OpenAI API key to generate quizzes and flashcards from PDF materials using AI.
              </p>
              {profileUser.has_ai_key && (
                <div className="alert alert-success py-1 small mb-2">API key is configured.</div>
              )}
              {apiKeySaved && (
                <div className="alert alert-info py-1 small mb-2">API key saved!</div>
              )}
              <div className="input-group input-group-sm">
                <input
                  type="password"
                  className="form-control"
                  placeholder={profileUser.has_ai_key ? 'Enter new key to update...' : 'sk-...'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleSaveApiKey} disabled={!apiKey}>Save</button>
              </div>
            </div>
          </div>
        )}
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
                  {deadlines.map((d, i) => (
                    <tr key={i}>
                      <td><Link to={d.link}>{d.label}</Link></td>
                      <td className="text-end text-muted">{new Date(d.deadline).toLocaleDateString()}</td>
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
