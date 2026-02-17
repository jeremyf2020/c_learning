import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InviteBulk from '../pages/InviteBulk';
import client from '../api/client';

jest.mock('../api/client');
const mockedClient = client as jest.Mocked<typeof client>;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'teacher1', user_type: 'teacher' },
    isAuthenticated: true,
  }),
}));

function renderInviteBulk() {
  return render(
    <BrowserRouter>
      <InviteBulk />
    </BrowserRouter>
  );
}

describe('InviteBulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders drag-and-drop upload zone', () => {
    renderInviteBulk();
    expect(screen.getByTestId('csv-drop-zone')).toBeInTheDocument();
    expect(screen.getByText(/drag & drop your csv file here/i)).toBeInTheDocument();
  });

  it('shows download template link', () => {
    renderInviteBulk();
    expect(screen.getByText(/download template/i)).toBeInTheDocument();
  });

  it('shows CSV format instructions', () => {
    renderInviteBulk();
    expect(screen.getByText(/csv format/i)).toBeInTheDocument();
  });

  it('shows page title', () => {
    renderInviteBulk();
    expect(screen.getByText(/bulk invite via csv/i)).toBeInTheDocument();
  });

  it('shows file name after selecting via click', async () => {
    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');
    const hiddenInput = dropZone.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['test'], 'students.csv', { type: 'text/csv' });
    await userEvent.upload(hiddenInput, file);

    expect(screen.getByText('students.csv')).toBeInTheDocument();
    expect(screen.getByText(/remove/i)).toBeInTheDocument();
  });

  it('shows file name after drag and drop', () => {
    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');

    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });

  it('rejects non-csv files on drop', () => {
    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');

    const file = new File(['test'], 'data.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByText(/only .csv files are accepted/i, { selector: '.alert-danger' })).toBeInTheDocument();
    expect(screen.queryByText('data.xlsx')).not.toBeInTheDocument();
  });

  it('removes selected file when Remove is clicked', async () => {
    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');
    const hiddenInput = dropZone.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['test'], 'students.csv', { type: 'text/csv' });
    await userEvent.upload(hiddenInput, file);

    expect(screen.getByText('students.csv')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText(/remove/i));

    expect(screen.queryByText('students.csv')).not.toBeInTheDocument();
    expect(screen.getByText(/drag & drop your csv file here/i)).toBeInTheDocument();
  });

  it('shows results after upload', async () => {
    mockedClient.post.mockResolvedValue({
      data: {
        total: 3,
        success: [
          { row: 2, email: 'a@test.com' },
          { row: 3, email: 'b@test.com' },
        ],
        errors: [
          { row: 4, error: 'Invalid email' },
        ],
      },
    });

    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');
    const hiddenInput = dropZone.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['test'], 'students.csv', { type: 'text/csv' });
    await userEvent.upload(hiddenInput, file);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 invitation\(s\) sent/i)).toBeInTheDocument();
      expect(screen.getByText(/1 error\(s\)/i)).toBeInTheDocument();
    });
  });

  it('shows error when upload fails', async () => {
    mockedClient.post.mockRejectedValue({
      response: { data: { detail: 'Only .csv files are supported.' } },
    });

    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');
    const hiddenInput = dropZone.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['test'], 'students.csv', { type: 'text/csv' });
    await userEvent.upload(hiddenInput, file);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/only .csv files/i)).toBeInTheDocument();
    });
  });

  it('disables submit button when no file selected', () => {
    renderInviteBulk();
    const submitBtn = screen.getByRole('button', { name: /upload/i });
    expect(submitBtn).toBeDisabled();
  });

  it('highlights drop zone on drag over', () => {
    renderInviteBulk();
    const dropZone = screen.getByTestId('csv-drop-zone');

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
    expect(dropZone.className).toContain('border-primary');
  });
});
