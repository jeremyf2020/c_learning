import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import type { Invitation } from '../types';

export default function InvitationList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/invitations/')
      .then((res) => {
        setInvitations(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleResend = async (id: number) => {
    try {
      await client.post(`/invitations/${id}/resend/`);
      const res = await client.get('/invitations/');
      setInvitations(res.data);
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return <div className="text-center mt-5"><p>Loading invitations...</p></div>;
  }

  return (
    <div className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Invitations</h2>
        <div>
          <Link to="/invitations/new" className="btn btn-primary">Invite User</Link>
          <Link to="/invitations/bulk" className="btn btn-outline-primary ms-2">Bulk Invite</Link>
        </div>
      </div>

      {invitations.length === 0 ? (
        <p className="text-muted">No invitations sent yet.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td>{inv.full_name}</td>
                <td>{inv.user_type}</td>
                <td>
                  <span
                    className={`badge bg-${
                      inv.status === 'accepted'
                        ? 'success'
                        : inv.status === 'expired'
                        ? 'secondary'
                        : 'warning'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                <td>{new Date(inv.expires_at).toLocaleDateString()}</td>
                <td>
                  {inv.status === 'pending' && (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleResend(inv.id)}
                    >
                      Resend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
