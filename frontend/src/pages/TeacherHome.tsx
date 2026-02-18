import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, User, StatusUpdate } from '../types';

export default function TeacherHome() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/courses/'),
      client.get('/status-updates/'),
    ]).then(([courseRes, statusRes]) => {
      setCourses(courseRes.data.filter((c: Course) => c.teacher === user?.id));
      setStatusUpdates(statusRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  // Live debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await client.get(`/users/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus.trim()) return;
    try {
      const res = await client.post('/status-updates/', { content: newStatus });
      setStatusUpdates([res.data, ...statusUpdates]);
      setNewStatus('');
    } catch { /* ignore */ }
  };

  const handleBlock = async (userId: number) => {
    try {
      await client.post(`/users/${userId}/block/`);
      setSearchResults(searchResults.filter(u => u.id !== userId));
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="row mt-3">
      {/* Left column: Courses & Students */}
      <div className="col-lg-8">
        {/* Course list */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">My Courses</h5>
          <Link to="/courses/create" className="btn btn-primary btn-sm el-btn-gradient">+ New Course</Link>
        </div>
        <div className="row g-3 mb-4">
          {courses.map(c => (
            <div key={c.id} className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <h6 className="card-title">{c.code}</h6>
                  <p className="card-text small">{c.title}</p>
                  <small className="text-muted">{c.enrolled_count} students</small>
                </div>
                <div className="card-footer bg-white border-0">
                  <Link to={`/courses/${c.id}`} className="btn btn-sm btn-outline-primary w-100">Manage</Link>
                </div>
              </div>
            </div>
          ))}
          <div className="col-md-4">
            <Link to="/courses/create" className="card h-100 text-decoration-none text-center border-dashed">
              <div className="card-body d-flex align-items-center justify-content-center">
                <span className="display-4 text-muted">+</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Search students/teachers */}
        <h5 className="mb-3">Students / Teachers</h5>
        <div className="card mb-4">
          <div className="card-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searching && (
              <div className="text-center py-2">
                <div className="spinner-border spinner-border-sm me-2"></div>
                <span className="text-muted">Searching...</span>
              </div>
            )}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-muted mb-0">No results found.</p>
            )}
            {searchResults.length > 0 && (
              <div className="list-group">
                {searchResults.map(u => (
                  <div key={u.id} className="list-group-item">
                    <div className="d-flex align-items-start">
                      {u.photo ? (
                        <img src={u.photo} alt={u.username} className="rounded-circle object-fit-cover me-3 flex-shrink-0" style={{ width: 44, height: 44 }} />
                      ) : (
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0 el-avatar-gradient"
                          style={{ width: 44, height: 44 }}
                        >
                          <span className="text-white fw-bold">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <Link to={`/profile/${u.username}`} className="fw-bold">{u.username}</Link>
                            <span className={`ms-2 badge ${u.user_type === 'teacher' ? 'bg-primary' : 'bg-info'}`}>{u.user_type}</span>
                          </div>
                          <button className="btn btn-sm btn-danger" onClick={() => handleBlock(u.id)}>Block</button>
                        </div>
                        {u.full_name && <div className="small">{u.full_name}</div>}
                        {u.email && <div className="small text-muted">{u.email}</div>}
                        {u.bio && <div className="small text-muted mt-1">{u.bio.length > 80 ? u.bio.slice(0, 80) + '...' : u.bio}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column: Feeds & Profile */}
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
            <Link to={`/profile/${user?.username}`} className="btn btn-sm btn-outline-primary">Profile</Link>
          </div>
        </div>

        {/* Feeds */}
        <div className="card el-card-accent mb-3">
          <div className="card-header"><strong>Feeds</strong></div>
          <div className="card-body">
            <form onSubmit={handlePostStatus} className="mb-3">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Post an update..."
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary">Post</button>
              </div>
            </form>
            {statusUpdates.map(s => (
              <div key={s.id} className="border-bottom py-2">
                <strong className="small">{s.username}</strong>
                <p className="mb-1 small">{s.content}</p>
                <small className="text-muted">{new Date(s.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
