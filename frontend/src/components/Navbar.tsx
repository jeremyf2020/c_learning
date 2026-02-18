import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Navbar() {
  const { user, isAuthenticated, logout, unreadCount, setUnreadCount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      client.get('/notifications/').then(res => {
        const unread = res.data.filter((n: { is_read: boolean }) => !n.is_read).length;
        setUnreadCount(unread);
      }).catch(() => {});
    }
  }, [isAuthenticated, setUnreadCount]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark el-navbar">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">eLearning Platform</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">Home</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/classroom">Classroom</Link>
                </li>
                {user?.user_type === 'teacher' && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to="/invitations">Invitations</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/courses/create">Create Course</Link>
                    </li>
                  </>
                )}
              </>
            )}
          </ul>
          <ul className="navbar-nav">
            {isAuthenticated ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link position-relative" to="/notifications">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="badge bg-danger rounded-pill ms-1">{unreadCount}</span>
                    )}
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link d-flex align-items-center" to={`/profile/${user?.username}`}>
                    {user?.photo ? (
                      <img src={user.photo} alt={user.username} className="rounded-circle me-1" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                    ) : null}
                    {user?.username} ({user?.user_type})
                  </Link>
                </li>
                <li className="nav-item">
                  <button className="btn btn-outline-light btn-sm mt-1 ms-2" onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">Register</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
