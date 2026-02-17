import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function InviteSingle() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    user_type: 'student',
    date_of_birth: '',
    phone_number: '',
    bio: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...formData,
        date_of_birth: formData.date_of_birth || null,
      };
      await client.post('/invitations/', payload);
      setSuccess(`Invitation sent to ${formData.email}`);
      setTimeout(() => navigate('/invitations'), 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setError(messages);
      } else {
        setError('Failed to send invitation.');
      }
    }
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h2 className="card-title mb-4">Invite a User</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input id="email" name="email" type="email" className="form-control" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="full_name" className="form-label">Full Name</label>
                <input id="full_name" name="full_name" type="text" className="form-control" value={formData.full_name} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="user_type" className="form-label">User Type</label>
                <select id="user_type" name="user_type" className="form-select" value={formData.user_type} onChange={handleChange}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="date_of_birth" className="form-label">Date of Birth</label>
                <input id="date_of_birth" name="date_of_birth" type="date" className="form-control" value={formData.date_of_birth} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="phone_number" className="form-label">Phone Number</label>
                <input id="phone_number" name="phone_number" type="text" className="form-control" value={formData.phone_number} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="bio" className="form-label">Bio</label>
                <textarea id="bio" name="bio" className="form-control" rows={3} value={formData.bio} onChange={handleChange} />
              </div>
              <button type="submit" className="btn btn-primary">Send Invitation</button>
              <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/invitations')}>Cancel</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
