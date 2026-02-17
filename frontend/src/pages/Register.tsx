import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    user_type: 'student',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await register(formData);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setError(messages);
      } else {
        setError('Registration failed.');
      }
    }
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6">
        <div className="card shadow">
          <div className="card-body">
            <h2 className="card-title text-center mb-4">Register</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input id="username" name="username" type="text" className="form-control" value={formData.username} onChange={handleChange} required />
              </div>
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
                <label htmlFor="password" className="form-label">Password</label>
                <input id="password" name="password" type="password" className="form-control" value={formData.password} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="password_confirm" className="form-label">Confirm Password</label>
                <input id="password_confirm" name="password_confirm" type="password" className="form-control" value={formData.password_confirm} onChange={handleChange} required />
              </div>
              <button type="submit" className="btn btn-primary w-100">Register</button>
            </form>
            <p className="text-center mt-3">
              Already have an account? <Link to="/login">Log In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
