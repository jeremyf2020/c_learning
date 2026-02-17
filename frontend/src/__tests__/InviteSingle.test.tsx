import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InviteSingle from '../pages/InviteSingle';
import client from '../api/client';

const mockNavigate = jest.fn();

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'teacher1', user_type: 'teacher' },
    isAuthenticated: true,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderInviteSingle() {
  return render(
    <BrowserRouter>
      <InviteSingle />
    </BrowserRouter>
  );
}

describe('InviteSingle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all invitation form fields', () => {
    renderInviteSingle();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
  });

  it('submits invitation and shows success', async () => {
    mockedClient.post.mockResolvedValue({
      data: { id: 1, email: 'student@example.com', status: 'pending' },
    });

    renderInviteSingle();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'student@example.com');
    await user.type(screen.getByLabelText(/full name/i), 'Student One');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(mockedClient.post).toHaveBeenCalledWith(
        '/invitations/',
        expect.objectContaining({ email: 'student@example.com', full_name: 'Student One' })
      );
    });
  });

  it('shows validation error from server', async () => {
    mockedClient.post.mockRejectedValue({
      response: { data: { email: ['A user with this email already exists.'] } },
    });

    renderInviteSingle();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });
});
