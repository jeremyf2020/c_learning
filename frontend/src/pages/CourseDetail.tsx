import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, CourseMaterial, Enrollment, Feedback } from '../types';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload material form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadType, setUploadType] = useState('document');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // Feedback form
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState('');

  const isTeacher = user?.user_type === 'teacher';
  const isOwner = course?.teacher === user?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, matRes, studRes] = await Promise.all([
          client.get(`/courses/${id}/`),
          client.get(`/courses/${id}/materials/`),
          client.get(`/courses/${id}/students/`),
        ]);
        setCourse(courseRes.data);
        setMaterials(matRes.data);
        setStudents(studRes.data);

        const fbRes = await client.get(`/feedback/?course=${id}`);
        setFeedbacks(Array.isArray(fbRes.data) ? fbRes.data : (fbRes.data.results || []));
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('course', id!);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDesc);
    formData.append('material_type', uploadType);
    formData.append('file', uploadFile);
    try {
      await client.post('/materials/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const matRes = await client.get(`/courses/${id}/materials/`);
      setMaterials(matRes.data);
      setShowUpload(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadFile(null);
    } catch { /* ignore */ }
  };

  const handleBlock = async (studentId: number) => {
    try {
      await client.post(`/courses/${id}/block/${studentId}/`);
      setStudents(students.filter(s => s.student !== studentId));
    } catch { /* ignore */ }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/feedback/', { course: Number(id), rating: fbRating, comment: fbComment });
      setShowFeedback(false);
      setFbComment('');
    } catch { /* ignore */ }
  };

  const filteredStudents = students.filter(s =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!course) return <div className="text-center mt-5"><h4>Course not found</h4></div>;

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8080';

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h3>{course.code} - {course.title}</h3>
          <p className="text-muted">by {course.teacher_name}</p>
          <p>{course.description}</p>
          {course.average_rating && (
            <span className="badge bg-warning text-dark">Rating: {course.average_rating.toFixed(1)} / 5</span>
          )}
        </div>
      </div>

      <div className="row">
        {/* Materials */}
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Course Materials</strong>
              {isOwner && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowUpload(!showUpload)}>+ Upload</button>
              )}
            </div>
            <div className="card-body">
              {showUpload && (
                <form onSubmit={handleUpload} className="border rounded p-3 mb-3 bg-light">
                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Title" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Description" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} />
                  </div>
                  <div className="mb-2">
                    <select className="form-select form-select-sm" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                      <option value="document">Document</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <div
                      className={`border rounded p-3 text-center ${uploadDragOver ? 'border-primary bg-primary bg-opacity-10' : 'border-dashed'}`}
                      style={{ cursor: 'pointer', borderStyle: uploadDragOver ? 'solid' : 'dashed' }}
                      onClick={() => uploadFileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                      onDragEnter={e => { e.preventDefault(); setUploadDragOver(true); }}
                      onDragLeave={() => setUploadDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setUploadDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file) setUploadFile(file);
                      }}
                      data-testid="material-drop-zone"
                    >
                      <input
                        type="file"
                        ref={uploadFileRef}
                        className="d-none"
                        onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      />
                      {uploadFile ? (
                        <div>
                          <span className="small fw-bold">{uploadFile.name}</span>
                          <span className="small text-muted ms-2">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" className="btn btn-sm btn-link text-danger ms-2" onClick={e => { e.stopPropagation(); setUploadFile(null); }}>Remove</button>
                        </div>
                      ) : (
                        <div className="text-muted small">
                          <div className="mb-1">Drag & drop a file here, or click to browse</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-sm btn-success" disabled={!uploadFile}>Upload</button>
                </form>
              )}
              {materials.length === 0 ? (
                <p className="text-muted mb-0">No materials uploaded yet.</p>
              ) : (
                <div className="list-group">
                  {materials.map(m => (
                    <a key={m.id} href={`${API_BASE}${m.file}`} target="_blank" rel="noopener noreferrer" className="list-group-item list-group-item-action">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{m.title}</strong>
                          <span className="ms-2 badge bg-secondary">{m.material_type}</span>
                          {m.description && <p className="mb-0 small text-muted">{m.description}</p>}
                        </div>
                        <small className="text-muted">{new Date(m.uploaded_at).toLocaleDateString()}</small>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Feedback section for students */}
          {user?.user_type === 'student' && (
            <div className="card mb-3">
              <div className="card-header d-flex justify-content-between">
                <strong>Feedback</strong>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFeedback(!showFeedback)}>Leave Feedback</button>
              </div>
              <div className="card-body">
                {showFeedback && (
                  <form onSubmit={handleFeedback} className="border rounded p-3 mb-3 bg-light">
                    <div className="mb-2">
                      <label className="form-label small">Rating (1-5)</label>
                      <select className="form-select form-select-sm" value={fbRating} onChange={e => setFbRating(Number(e.target.value))}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="mb-2">
                      <textarea className="form-control form-control-sm" placeholder="Your comment..." rows={2} value={fbComment} onChange={e => setFbComment(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-sm btn-success">Submit</button>
                  </form>
                )}
                {feedbacks.map(f => (
                  <div key={f.id} className="border-bottom py-2">
                    <strong>{f.student_name}</strong>
                    {f.rating && <span className="ms-2 badge bg-warning text-dark">{f.rating}/5</span>}
                    <p className="mb-0 small">{f.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Students panel */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header"><strong>Students ({students.length})</strong></div>
            <div className="card-body">
              <input
                type="text"
                className="form-control form-control-sm mb-3"
                placeholder="Search students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {filteredStudents.length === 0 ? (
                <p className="text-muted mb-0">No students enrolled.</p>
              ) : (
                <div className="list-group">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="list-group-item">
                      <div className="d-flex align-items-center">
                        <div
                          className="rounded-circle bg-info d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                          style={{ width: 36, height: 36 }}
                        >
                          <span className="text-white fw-bold small">{s.student_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-grow-1">
                          <Link to={`/profile/${s.student_name}`} className="fw-bold">{s.student_name}</Link>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Enrolled {new Date(s.enrolled_at).toLocaleDateString()}</div>
                        </div>
                        {isOwner && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleBlock(s.student)}>Block</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
