import React, { useState, useEffect } from 'react';
import client from '../api/client';
import type { AppNotification } from '../types';

export default function Notifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/notifications/').then(res => {
      setNotifications(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleMarkAllRead = async () => {
    await client.post('/notifications/mark_all_read/');
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Notifications</h4>
        {notifications.some(n => !n.is_read) && (
          <button className="btn btn-sm btn-outline-primary" onClick={handleMarkAllRead}>Mark All Read</button>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="text-muted">No notifications.</p>
      ) : (
        <div className="list-group">
          {notifications.map(n => (
            <div key={n.id} className={`list-group-item ${!n.is_read ? 'list-group-item-light fw-semibold' : ''}`}>
              <div className="d-flex justify-content-between">
                <div>
                  <span className="badge bg-info me-2">{n.notification_type}</span>
                  <strong>{n.title}</strong>
                  <p className="mb-0 small">{n.message}</p>
                </div>
                <small className="text-muted">{new Date(n.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
