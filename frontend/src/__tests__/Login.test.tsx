import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';

const mockLogin = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders username and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass123');
    });
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { detail: 'Invalid username or password.' } },
    });
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'wrong');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });
  });

  it('has a link to register page', () => {
    renderLogin();
    expect(screen.getByText(/register/i)).toBeInTheDocument();
  });
});
