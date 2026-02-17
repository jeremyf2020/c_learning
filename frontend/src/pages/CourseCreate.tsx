import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function CourseCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '', description: '', code: '', start_date: '', end_date: '',
  });
  const [error, setError] = useState('');

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
      navigate(`/courses/${res.data.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) setError(Object.values(data).flat().join(' '));
      else setError('Failed to create course.');
    }
  };

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
              <button type="submit" className="btn btn-primary">Create Course</button>
              <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/')}>Cancel</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
