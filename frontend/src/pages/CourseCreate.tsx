import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { User } from '../types';

export default function CourseCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '', description: '', code: '', start_date: '', end_date: '',
  });
  const [error, setError] = useState('');

  // Post-creation: add students
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<User[]>([]);
  const [addedStudents, setAddedStudents] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };
      const res = await client.post('/courses/', payload);
      setCreatedCourseId(res.data.id);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) setError(Object.values(data).flat().join(' '));
      else setError('Failed to create course.');
    }
  };

  const handleSearchStudents = async (query: string) => {
    setAddQuery(query);
    if (query.trim().length < 2) { setAddResults([]); return; }
    try {
      const res = await client.get(`/users/search/?q=${encodeURIComponent(query)}&user_type=student`);
      setAddResults(res.data);
    } catch { setAddResults([]); }
  };

  const handleAddStudent = async (student: User) => {
    if (!createdCourseId) return;
    try {
      await client.post(`/courses/${createdCourseId}/add_student/`, { student_id: student.id });
      setAddedStudents(prev => [...prev, student.username]);
      setAddResults(addResults.filter(u => u.id !== student.id));
    } catch { /* ignore */ }
  };

  // Step 2: Add students after course creation
  if (createdCourseId) {
    return (
      <div className="row justify-content-center mt-4">
        <div className="col-md-8">
          <div className="card shadow">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="badge bg-success me-2">Created</span>
                <h4 className="mb-0">{formData.code} - {formData.title}</h4>
              </div>
              <p className="text-muted">Add students to your course, or skip this step and add them later.</p>

              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search students by name or email..."
                  value={addQuery}
                  onChange={e => handleSearchStudents(e.target.value)}
                />
              </div>

              {addResults.length > 0 && (
                <div className="list-group mb-3" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {addResults.filter(u => !addedStudents.includes(u.username)).map(u => (
                    <div key={u.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div>
                        <span className="fw-bold">{u.username}</span>
                        {u.full_name && <span className="text-muted ms-1">({u.full_name})</span>}
                      </div>
                      <button className="btn btn-sm btn-success" onClick={() => handleAddStudent(u)}>Add</button>
                    </div>
                  ))}
                </div>
              )}

              {addQuery.length >= 2 && addResults.filter(u => !addedStudents.includes(u.username)).length === 0 && (
                <p className="text-muted small">No students found.</p>
              )}

              {addedStudents.length > 0 && (
                <div className="mb-3">
                  <strong className="small">Added Students:</strong>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {addedStudents.map(name => (
                      <span key={name} className="badge bg-primary">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="d-flex gap-2">
                <button className="btn btn-primary el-btn-gradient" onClick={() => navigate(`/courses/${createdCourseId}`)}>
                  Go to Course
                </button>
                <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Create course form
  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h3 className="card-title mb-4">Create New Course</h3>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Course Code</label>
                <input name="code" className="form-control" value={formData.code} onChange={handleChange} required placeholder="e.g. CS101" />
              </div>
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input name="title" className="form-control" value={formData.title} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows={4} value={formData.description} onChange={handleChange} required />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Start Date</label>
                  <input type="date" name="start_date" className="form-control" value={formData.start_date} onChange={handleChange} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">End Date</label>
                  <input type="date" name="end_date" className="form-control" value={formData.end_date} onChange={handleChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient">Create Course</button>
              <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/')}>Cancel</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
