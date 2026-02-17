import React, { useState, useRef } from 'react';
import client from '../api/client';
import type { BulkUploadResult } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export default function InviteBulk() {
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are accepted.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResults(null);

    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    const formData = new FormData();
    formData.append('csv_file', selectedFile);

    setUploading(true);
    try {
      const res = await client.post('/invitations/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h2 className="card-title mb-4">Bulk Invite via CSV</h2>
            <div className="alert alert-info">
              <strong>CSV format:</strong> The file must have these exact column headers in the first row:
              <code> full_name, email, user_type, date_of_birth, phone_number, bio</code>.
              Date format: YYYY-MM-DD. user_type: &quot;student&quot; or &quot;teacher&quot;.
              <br />
              <a
                href={`${API_URL}/invitations/download_template/`}
                className="mt-2 btn btn-sm btn-outline-primary"
              >
                Download Template
              </a>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">CSV File (.csv)</label>
                <div
                  className={`border rounded p-4 text-center ${dragOver ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                  style={{ cursor: 'pointer', borderStyle: dragOver ? 'solid' : 'dashed' }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileDrop(file);
                  }}
                  data-testid="csv-drop-zone"
                >
                  <input
                    type="file"
                    ref={fileRef}
                    className="d-none"
                    accept=".csv"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileDrop(file);
                    }}
                  />
                  {selectedFile ? (
                    <div>
                      <span className="fw-bold">{selectedFile.name}</span>
                      <span className="text-muted ms-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger ms-2"
                        onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted">
                      <div className="mb-1" style={{ fontSize: '2rem' }}>&#128196;</div>
                      <div>Drag & drop your CSV file here, or click to browse</div>
                      <small>Only .csv files are accepted</small>
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFile}>
                {uploading ? 'Uploading...' : 'Upload & Send Invitations'}
              </button>
            </form>

            {results && (
              <div className="mt-4">
                <h4>Results</h4>
                <p>Total rows processed: {results.total}</p>
                {results.success.length > 0 && (
                  <div className="alert alert-success">
                    <strong>{results.success.length} invitation(s) sent:</strong>
                    <ul>
                      {results.success.map((s) => (
                        <li key={s.row}>Row {s.row}: {s.email}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {results.errors.length > 0 && (
                  <div className="alert alert-danger">
                    <strong>{results.errors.length} error(s):</strong>
                    <ul>
                      {results.errors.map((e) => (
                        <li key={e.row}>Row {e.row}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
