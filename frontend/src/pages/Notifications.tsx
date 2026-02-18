import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

const typeBadge: Record<string, { label: string; cls: string }> = {
  enrollment: { label: 'Enrollment', cls: 'bg-success' },
  material: { label: 'Material', cls: 'bg-primary' },
  feedback: { label: 'Feedback', cls: 'bg-info' },
  deadline: { label: 'Deadline', cls: 'bg-warning text-dark' },
  general: { label: 'General', cls: 'bg-secondary' },
};

export default function Notifications() {
  const { setUnreadCount } = useAuth();
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
    setUnreadCount(0);
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
          {notifications.map(n => {
            const badge = typeBadge[n.notification_type] || typeBadge.general;
            const inner = (
              <div className="d-flex justify-content-between">
                <div>
                  <span className={`badge ${badge.cls} me-2`}>{badge.label}</span>
                  <strong>{n.title}</strong>
                  <p className="mb-0 small">{n.message}</p>
                </div>
                <small className="text-muted text-nowrap ms-3">{new Date(n.created_at).toLocaleString()}</small>
              </div>
            );
            const cls = `list-group-item list-group-item-action ${!n.is_read ? 'list-group-item-light fw-semibold' : ''}`;
            return n.link ? (
              <Link key={n.id} to={n.link} className={cls}>{inner}</Link>
            ) : (
              <div key={n.id} className={cls}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
