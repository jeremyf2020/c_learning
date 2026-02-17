import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Notifications from '../pages/Notifications';
import client from '../api/client';

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'student1', user_type: 'student' },
    isAuthenticated: true,
  }),
}));

function renderNotifications() {
  return render(
    <BrowserRouter>
      <Notifications />
    </BrowserRouter>
  );
}

describe('Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    mockedClient.get.mockReturnValue(new Promise(() => {}));
    renderNotifications();
    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('displays notifications', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1, notification_type: 'enrollment', title: 'New Enrollment',
          message: 'Alice enrolled', link: '', is_read: false,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2, notification_type: 'material', title: 'New Material',
          message: 'Lecture uploaded', link: '', is_read: true,
          created_at: '2026-01-02T00:00:00Z',
        },
      ],
    });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText('New Enrollment')).toBeInTheDocument();
      expect(screen.getByText('New Material')).toBeInTheDocument();
      expect(screen.getByText('Alice enrolled')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockedClient.get.mockResolvedValue({ data: [] });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });

  it('shows mark all read button when unread notifications exist', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1, notification_type: 'general', title: 'Unread',
          message: 'msg', link: '', is_read: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText(/mark all read/i)).toBeInTheDocument();
    });
  });

  it('hides mark all read when all notifications are read', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1, notification_type: 'general', title: 'Read',
          message: 'msg', link: '', is_read: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText('Read')).toBeInTheDocument();
    });
    expect(screen.queryByText(/mark all read/i)).not.toBeInTheDocument();
  });

  it('calls mark all read API', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1, notification_type: 'general', title: 'Unread',
          message: 'msg', link: '', is_read: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    mockedClient.post.mockResolvedValue({ data: {} });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText(/mark all read/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText(/mark all read/i));

    await waitFor(() => {
      expect(mockedClient.post).toHaveBeenCalledWith('/notifications/mark_all_read/');
    });
  });

  it('shows notification type badge', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1, notification_type: 'enrollment', title: 'Test',
          message: 'msg', link: '', is_read: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    renderNotifications();

    await waitFor(() => {
      expect(screen.getByText('enrollment')).toBeInTheDocument();
    });
  });
});
