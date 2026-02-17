import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Register from '../pages/Register';

const mockRegister = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    isAuthenticated: false,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderRegister() {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
}

describe('Register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('shows password mismatch error', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/email/i), 'new@test.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Pass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('calls register on successful submit', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/email/i), 'new@test.com');
    await user.type(screen.getByLabelText(/full name/i), 'New User');
    await user.type(screen.getByLabelText(/^password$/i), 'Pass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Pass123!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'new@test.com',
          full_name: 'New User',
          password: 'Pass123!',
          password_confirm: 'Pass123!',
        })
      );
    });
  });

  it('navigates to home on success', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/email/i), 'new@test.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Pass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Pass123!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows server error message', async () => {
    mockRegister.mockRejectedValue({
      response: { data: { username: ['This username is already taken.'] } },
    });
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'taken');
    await user.type(screen.getByLabelText(/email/i), 'new@test.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Pass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Pass123!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/already taken/i)).toBeInTheDocument();
    });
  });

  it('has link to login page', () => {
    renderRegister();
    expect(screen.getByText(/log in/i)).toBeInTheDocument();
  });

  it('defaults user type to student', () => {
    renderRegister();
    const select = screen.getByLabelText(/user type/i) as HTMLSelectElement;
    expect(select.value).toBe('student');
  });
});
