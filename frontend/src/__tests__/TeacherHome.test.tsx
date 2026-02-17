import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TeacherHome from '../pages/TeacherHome';
import client from '../api/client';

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'teacher1', user_type: 'teacher', full_name: 'Teacher One' },
    isAuthenticated: true,
  }),
}));

function setupMocks(searchResults: any[] = []) {
  mockedClient.get.mockImplementation((url: string) => {
    if (url === '/courses/') return Promise.resolve({ data: [] });
    if (url === '/status-updates/') return Promise.resolve({ data: [] });
    if (url.startsWith('/users/search/')) return Promise.resolve({ data: searchResults });
    return Promise.resolve({ data: [] });
  });
}

async function renderAndWait() {
  render(
    <BrowserRouter>
      <TeacherHome />
    </BrowserRouter>
  );
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });
}

const mockUser = (overrides: any = {}) => ({
  id: 2, username: 'alice', email: 'alice@test.com',
  full_name: 'Alice Smith', user_type: 'student', bio: 'A student',
  photo: null, date_of_birth: null, phone_number: '', is_blocked: false, created_at: '',
  ...overrides,
});

// The debounce is 300ms, so we wait a bit longer for results
const DEBOUNCE_WAIT = 500;

describe('TeacherHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockedClient.get.mockReturnValue(new Promise(() => {}));
    render(
      <BrowserRouter>
        <TeacherHome />
      </BrowserRouter>
    );
    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    setupMocks();
    await renderAndWait();
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  it('does not have a search button (live search)', async () => {
    setupMocks();
    await renderAndWait();
    expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();
  });

  it('triggers live search after typing with debounce', async () => {
    setupMocks([mockUser()]);
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });
  });

  it('shows user preview card with avatar, email, bio', async () => {
    setupMocks([mockUser({
      username: 'bob', email: 'bob@test.com',
      full_name: 'Bob Jones', user_type: 'teacher',
      bio: 'I teach math and science to high school students',
    })]);
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'bob' } });

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      expect(screen.getByText('teacher')).toBeInTheDocument();
      expect(screen.getByText(/I teach math/)).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });
  });

  it('shows "No results found" when search returns empty', async () => {
    setupMocks([]);
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });
  });

  it('clears results when search input is cleared', async () => {
    setupMocks([mockUser()]);
    await renderAndWait();

    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });

    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });

  it('shows block button for search results', async () => {
    setupMocks([mockUser()]);
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('Block')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });
  });

  it('truncates long bio in preview', async () => {
    const longBio = 'A'.repeat(100);
    setupMocks([mockUser({ bio: longBio })]);
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('A'.repeat(80) + '...')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });
  });

  it('calls block API and removes user from results', async () => {
    setupMocks([mockUser()]);
    mockedClient.post.mockResolvedValue({ data: {} });
    await renderAndWait();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    }, { timeout: DEBOUNCE_WAIT + 1000 });

    const user = userEvent.setup();
    await user.click(screen.getByText('Block'));

    await waitFor(() => {
      expect(mockedClient.post).toHaveBeenCalledWith('/users/2/block/');
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });
});
