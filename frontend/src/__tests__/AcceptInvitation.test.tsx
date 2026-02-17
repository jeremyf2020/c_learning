import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AcceptInvitation from '../pages/AcceptInvitation';
import client from '../api/client';

const mockNavigate = jest.fn();
const mockSetAuthFromResponse = jest.fn();

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    setAuthFromResponse: mockSetAuthFromResponse,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: 'test-token-123' }),
}));

function renderAcceptInvitation() {
  return render(
    <BrowserRouter>
      <AcceptInvitation />
    </BrowserRouter>
  );
}

describe('AcceptInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockedClient.get.mockReturnValue(new Promise(() => {}));
    renderAcceptInvitation();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays invitation details after loading', async () => {
    mockedClient.get.mockResolvedValue({
      data: {
        email: 'test@example.com',
        full_name: 'Test User',
        user_type: 'student',
        date_of_birth: '2000-01-01',
        phone_number: '+123',
        bio: 'A student',
        status: 'pending',
      },
    });

    renderAcceptInvitation();

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  it('shows username and password fields', async () => {
    mockedClient.get.mockResolvedValue({
      data: {
        email: 'test@example.com',
        full_name: 'Test User',
        user_type: 'student',
        date_of_birth: null,
        phone_number: '',
        bio: '',
        status: 'pending',
      },
    });

    renderAcceptInvitation();

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
  });

  it('submits registration and redirects', async () => {
    mockedClient.get.mockResolvedValue({
      data: {
        email: 'test@example.com',
        full_name: 'Test User',
        user_type: 'student',
        date_of_birth: null,
        phone_number: '',
        bio: '',
        status: 'pending',
      },
    });
    mockedClient.post.mockResolvedValue({
      data: { token: 'new-token', user: { id: 1, username: 'newuser' } },
    });

    renderAcceptInvitation();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
    await user.click(screen.getByRole('button', { name: /complete registration/i }));

    await waitFor(() => {
      expect(mockedClient.post).toHaveBeenCalledWith('/invite/test-token-123/accept/', {
        username: 'newuser',
        password: 'SecurePass123!',
        password_confirm: 'SecurePass123!',
      });
      expect(mockSetAuthFromResponse).toHaveBeenCalled();
    });
  });

  it('shows error for expired invitation', async () => {
    mockedClient.get.mockRejectedValue({
      response: { data: { detail: 'This invitation has expired.' } },
    });

    renderAcceptInvitation();

    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });
});
