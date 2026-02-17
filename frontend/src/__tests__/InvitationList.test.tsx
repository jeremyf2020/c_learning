import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InvitationList from '../pages/InvitationList';
import client from '../api/client';

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'teacher1', user_type: 'teacher' },
    isAuthenticated: true,
  }),
}));

function renderInvitationList() {
  return render(
    <BrowserRouter>
      <InvitationList />
    </BrowserRouter>
  );
}

describe('InvitationList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockedClient.get.mockReturnValue(new Promise(() => {}));
    renderInvitationList();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays invitations in a table', async () => {
    mockedClient.get.mockResolvedValue({
      data: [
        {
          id: 1,
          email: 'alice@test.com',
          full_name: 'Alice',
          user_type: 'student',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-01-31T00:00:00Z',
          invited_by_username: 'teacher1',
          token: 'tok1',
        },
        {
          id: 2,
          email: 'bob@test.com',
          full_name: 'Bob',
          user_type: 'student',
          status: 'accepted',
          created_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-01-31T00:00:00Z',
          invited_by_username: 'teacher1',
          token: 'tok2',
        },
      ],
    });

    renderInvitationList();

    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    });
  });

  it('shows empty state when no invitations', async () => {
    mockedClient.get.mockResolvedValue({ data: [] });
    renderInvitationList();

    await waitFor(() => {
      expect(screen.getByText(/no invitations/i)).toBeInTheDocument();
    });
  });

  it('has links to invite single and bulk', async () => {
    mockedClient.get.mockResolvedValue({ data: [] });
    renderInvitationList();

    await waitFor(() => {
      expect(screen.getByText(/invite.*user/i)).toBeInTheDocument();
      expect(screen.getByText(/bulk/i)).toBeInTheDocument();
    });
  });
});
