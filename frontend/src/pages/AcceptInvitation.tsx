import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { InvitationPublic } from '../types';

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setAuthFromResponse } = useAuth();

  const [invitation, setInvitation] = useState<InvitationPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    client
      .get(`/invite/${token}/`)
      .then((res) => {
        setInvitation(res.data);
        setLoading(false);
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'Invalid or expired invitation.';
        setError(detail);
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await client.post(`/invite/${token}/accept/`, {
        username,
        password,
        password_confirm: passwordConfirm,
      });
      setAuthFromResponse(res.data);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, string | string[]> } };
      const data = axiosErr.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(' ');
        setFormError(messages);
      } else {
        setFormError('Registration failed.');
      }
    }
  };

  if (loading) {
    return <div className="text-center mt-5"><p>Loading invitation...</p></div>;
  }

  if (error) {
    return (
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 text-center">
          <h2>Invitation Error</h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6">
        <div className="card el-glow">
          <div className="el-auth-header">
            <h3>Complete Your Registration</h3>
            <p>Set up your account to get started</p>
          </div>
          <div className="card-body">
            {invitation && (
              <div className="alert alert-info">
                <p><strong>Name:</strong> {invitation.full_name}</p>
                <p><strong>Email:</strong> {invitation.email}</p>
                <p><strong>Role:</strong> {invitation.user_type}</p>
                {invitation.date_of_birth && <p><strong>Date of Birth:</strong> {invitation.date_of_birth}</p>}
                {invitation.phone_number && <p><strong>Phone:</strong> {invitation.phone_number}</p>}
              </div>
            )}
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                  id="username"
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password_confirm" className="form-label">Confirm Password</label>
                <input
                  id="password_confirm"
                  type="password"
                  className="form-control"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary el-btn-gradient w-100">Complete Registration</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
