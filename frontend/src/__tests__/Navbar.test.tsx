import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';
import client from '../api/client';

const mockLogout = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

let mockAuthState = {
  user: null as any,
  isAuthenticated: false,
  logout: mockLogout,
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

function renderNavbar() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClient.get.mockResolvedValue({ data: [] });
  });

  it('shows login and register when not authenticated', () => {
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
    };
    renderNavbar();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('shows home link when authenticated', () => {
    mockAuthState = {
      user: { id: 1, username: 'student1', user_type: 'student' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    renderNavbar();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Classroom')).toBeInTheDocument();
  });

  it('shows teacher links for teacher users', () => {
    mockAuthState = {
      user: { id: 1, username: 'teacher1', user_type: 'teacher' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    renderNavbar();
    expect(screen.getByText('Invitations')).toBeInTheDocument();
    expect(screen.getByText('Create Course')).toBeInTheDocument();
  });

  it('does not show teacher links for students', () => {
    mockAuthState = {
      user: { id: 1, username: 'student1', user_type: 'student' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    renderNavbar();
    expect(screen.queryByText('Invitations')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Course')).not.toBeInTheDocument();
  });

  it('shows notification badge with unread count', async () => {
    mockAuthState = {
      user: { id: 1, username: 'student1', user_type: 'student' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    mockedClient.get.mockResolvedValue({
      data: [
        { id: 1, is_read: false },
        { id: 2, is_read: false },
        { id: 3, is_read: true },
      ],
    });
    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows username and user type', () => {
    mockAuthState = {
      user: { id: 1, username: 'teacher1', user_type: 'teacher' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    renderNavbar();
    expect(screen.getByText(/teacher1/)).toBeInTheDocument();
    expect(screen.getByText(/teacher/)).toBeInTheDocument();
  });

  it('logout button calls logout and navigates', async () => {
    mockAuthState = {
      user: { id: 1, username: 'student1', user_type: 'student' },
      isAuthenticated: true,
      logout: mockLogout,
    };
    renderNavbar();
    const user = userEvent.setup();

    await user.click(screen.getByText('Logout'));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows brand name', () => {
    mockAuthState = { user: null, isAuthenticated: false, logout: mockLogout };
    renderNavbar();
    expect(screen.getByText('eLearning Platform')).toBeInTheDocument();
  });
});
