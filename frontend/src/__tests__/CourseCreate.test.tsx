import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CourseCreate from '../pages/CourseCreate';
import client from '../api/client';

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

const mockNavigate = jest.fn();

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

function renderCourseCreate() {
  return render(
    <BrowserRouter>
      <CourseCreate />
    </BrowserRouter>
  );
}

describe('CourseCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    renderCourseCreate();
    expect(screen.getByPlaceholderText(/cs101/i)).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('renders create and cancel buttons', () => {
    renderCourseCreate();
    expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('submits form and navigates on success', async () => {
    mockedClient.post.mockResolvedValue({ data: { id: 42 } });
    renderCourseCreate();
    const user = userEvent.setup();

    const inputs = document.querySelectorAll('input.form-control');
    const textarea = document.querySelector('textarea.form-control')!;
    // inputs: code, start_date, end_date; title is second input
    await user.type(screen.getByPlaceholderText(/cs101/i), 'CS201');
    await user.type(inputs[1] as HTMLElement, 'New Course');
    await user.type(textarea as HTMLElement, 'A great course');
    await user.click(screen.getByRole('button', { name: /create course/i }));

    await waitFor(() => {
      expect(mockedClient.post).toHaveBeenCalledWith('/courses/', expect.objectContaining({
        code: 'CS201',
        title: 'New Course',
        description: 'A great course',
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/courses/42');
    });
  });

  it('shows error on failure', async () => {
    mockedClient.post.mockRejectedValue({
      response: { data: { code: ['A course with this code already exists.'] } },
    });
    renderCourseCreate();
    const user = userEvent.setup();

    const inputs = document.querySelectorAll('input.form-control');
    const textarea = document.querySelector('textarea.form-control')!;
    await user.type(screen.getByPlaceholderText(/cs101/i), 'CS101');
    await user.type(inputs[1] as HTMLElement, 'Dup');
    await user.type(textarea as HTMLElement, 'Desc');
    await user.click(screen.getByRole('button', { name: /create course/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it('cancel navigates to home', async () => {
    renderCourseCreate();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows page title', () => {
    renderCourseCreate();
    expect(screen.getByText(/create new course/i)).toBeInTheDocument();
  });
});
