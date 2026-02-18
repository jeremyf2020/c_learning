import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Assignment, AssignmentSubmission, QuizQuestion, Flashcard } from '../types';

export default function AssignmentView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<AssignmentSubmission[]>([]);

  // Editing state
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const [editCards, setEditCards] = useState<Flashcard[]>([]);
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const isTeacher = user?.user_type === 'teacher';
  const isOwner = isTeacher && assignment?.created_by === user?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await client.get(`/assignments/${id}/`);
        setAssignment(res.data);
        if (res.data.assignment_type === 'quiz') {
          setAnswers(new Array(res.data.content.questions?.length || 0).fill(-1));
        }
        const subRes = await client.get(`/assignment-submissions/?assignment=${id}`);
        const subs = Array.isArray(subRes.data) ? subRes.data : (subRes.data.results || []);
        if (user?.user_type === 'student') {
          if (subs.length > 0) {
            setSubmission(subs[0]);
            setAnswers(subs[0].answers);
            setSubmitted(true);
          }
        } else if (user?.user_type === 'teacher') {
          setAllSubmissions(subs);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  const handleSubmitQuiz = async () => {
    try {
      const res = await client.post('/assignment-submissions/', {
        assignment: Number(id),
        answers,
      });
      setSubmission(res.data);
      setSubmitted(true);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this assignment? This cannot be undone.')) return;
    try {
      await client.delete(`/assignments/${id}/`);
      navigate(-1);
    } catch { /* ignore */ }
  };

  const startEdit = () => {
    if (!assignment) return;
    setEditTitle(assignment.title);
    setEditQuestions(JSON.parse(JSON.stringify(assignment.content.questions || [])));
    setEditCards(JSON.parse(JSON.stringify(assignment.content.cards || [])));
    setEditDeadline(assignment.deadline ? new Date(assignment.deadline).toISOString().slice(0, 16) : '');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!assignment) return;
    setSaving(true);
    const content = assignment.assignment_type === 'quiz'
      ? { questions: editQuestions }
      : { cards: editCards };
    try {
      const res = await client.patch(`/assignments/${id}/`, {
        title: editTitle,
        content,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      setAssignment(res.data);
      setEditMode(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Quiz editing helpers
  const updateQuestion = (qi: number, field: string, value: string) => {
    const updated = [...editQuestions];
    (updated[qi] as any)[field] = value;
    setEditQuestions(updated);
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const updated = [...editQuestions];
    updated[qi].options[oi] = value;
    setEditQuestions(updated);
  };

  const setCorrectAnswer = (qi: number, oi: number) => {
    const updated = [...editQuestions];
    updated[qi].correct = oi;
    setEditQuestions(updated);
  };

  const removeQuestion = (qi: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== qi));
  };

  const addQuestion = () => {
    setEditQuestions([...editQuestions, { question: '', options: ['', '', '', ''], correct: 0 }]);
  };

  // Flashcard editing helpers
  const updateCard = (ci: number, field: 'front' | 'back', value: string) => {
    const updated = [...editCards];
    updated[ci][field] = value;
    setEditCards(updated);
  };

  const removeCard = (ci: number) => {
    setEditCards(editCards.filter((_, i) => i !== ci));
  };

  const addCard = () => {
    setEditCards([...editCards, { front: '', back: '' }]);
  };

  const toggleCard = (index: number) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (!assignment) return <div className="text-center mt-5"><h4>Assignment not found</h4></div>;

  const questions = assignment.content.questions || [];
  const cards = assignment.content.cards || [];
  const revealAnswers = submitted || (isTeacher && showAnswerKey);

  return (
    <div className="mt-3" style={{ maxWidth: 800, margin: '0 auto' }}>
      <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => navigate(-1)}>&larr; Back</button>

      {/* Title */}
      {editMode ? (
        <>
          <input className="form-control form-control-lg mb-2" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          <div className="mb-2">
            <label className="form-label small mb-0">Deadline (optional)</label>
            <input type="datetime-local" className="form-control" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="d-flex align-items-center gap-2 mb-1">
          <h4 className="mb-0">{assignment.title}</h4>
          {isOwner && (
            <>
              <button className="btn btn-sm btn-outline-secondary" onClick={startEdit}>Edit</button>
              <button className="btn btn-sm btn-outline-danger" onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>
      )}
      <p className="text-muted">
        {assignment.assignment_type === 'quiz' ? 'Quiz' : 'Flashcards'} &middot; {assignment.course_title}
      </p>
      {!editMode && assignment.deadline && (
        <p className="text-warning mb-3">
          <strong>Deadline:</strong> {new Date(assignment.deadline).toLocaleString()}
        </p>
      )}

      {/* ===== EDIT MODE: Quiz ===== */}
      {editMode && assignment.assignment_type === 'quiz' && (
        <div>
          {editQuestions.map((q, qi) => (
            <div key={qi} className="card mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>Q{qi + 1}</strong>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeQuestion(qi)}>Remove</button>
                </div>
                <input
                  className="form-control mb-2"
                  placeholder="Question text"
                  value={q.question}
                  onChange={e => updateQuestion(qi, 'question', e.target.value)}
                />
                {q.options.map((opt, oi) => (
                  <div key={oi} className="input-group mb-1">
                    <div className="input-group-text">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct === oi}
                        onChange={() => setCorrectAnswer(qi, oi)}
                        title="Mark as correct answer"
                      />
                    </div>
                    <span className="input-group-text">{String.fromCharCode(65 + oi)}</span>
                    <input
                      className="form-control"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                    />
                  </div>
                ))}
                <small className="text-muted">Select the radio button next to the correct answer</small>
              </div>
            </div>
          ))}
          <button className="btn btn-outline-primary mb-3" onClick={addQuestion}>+ Add Question</button>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-success" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== EDIT MODE: Flashcards ===== */}
      {editMode && assignment.assignment_type === 'flashcard' && (
        <div>
          {editCards.map((card, ci) => (
            <div key={ci} className="card mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>Card {ci + 1}</strong>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeCard(ci)}>Remove</button>
                </div>
                <div className="mb-2">
                  <label className="form-label small text-muted mb-0">Front (Question/Term)</label>
                  <input className="form-control" value={card.front} onChange={e => updateCard(ci, 'front', e.target.value)} />
                </div>
                <div>
                  <label className="form-label small text-muted mb-0">Back (Answer/Definition)</label>
                  <input className="form-control" value={card.back} onChange={e => updateCard(ci, 'back', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-outline-primary mb-3" onClick={addCard}>+ Add Card</button>
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-success" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== VIEW MODE: Quiz ===== */}
      {!editMode && assignment.assignment_type === 'quiz' && (
        <div>
          {isTeacher && (
            <div className="d-flex align-items-center gap-2 mb-3">
              <button
                className={`btn btn-sm ${showAnswerKey ? 'btn-warning' : 'btn-outline-warning'}`}
                onClick={() => setShowAnswerKey(!showAnswerKey)}
              >
                {showAnswerKey ? 'Hide Answer Key' : 'Show Answer Key'}
              </button>
              <span className="text-muted small">Submissions: {assignment.submission_count}</span>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} className="card mb-3">
              <div className="card-body">
                <h6>Q{qi + 1}: {q.question}</h6>
                {q.options.map((opt, oi) => {
                  let btnClass = 'btn btn-outline-secondary w-100 text-start mb-1';
                  if (revealAnswers) {
                    if (oi === q.correct) btnClass = 'btn btn-success w-100 text-start mb-1';
                    else if (submitted && oi === answers[qi] && oi !== q.correct) btnClass = 'btn btn-danger w-100 text-start mb-1';
                  } else if (answers[qi] === oi) {
                    btnClass = 'btn btn-primary w-100 text-start mb-1';
                  }
                  return (
                    <button
                      key={oi}
                      className={btnClass}
                      onClick={() => {
                        if (!submitted && !isTeacher) {
                          const newAnswers = [...answers];
                          newAnswers[qi] = oi;
                          setAnswers(newAnswers);
                        }
                      }}
                      disabled={submitted || isTeacher}
                    >
                      {String.fromCharCode(65 + oi)}. {opt.replace(/^[A-Da-d][.):\s]+/, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!isTeacher && !submitted && (
            <button
              className="btn btn-primary el-btn-gradient btn-lg w-100"
              onClick={handleSubmitQuiz}
              disabled={answers.includes(-1)}
            >
              {answers.includes(-1)
                ? `Answer all questions to submit (${answers.filter(a => a !== -1).length}/${questions.length})`
                : 'Submit Quiz'}
            </button>
          )}

          {submitted && submission && (
            <div className="alert alert-info mt-3">
              Your score: <strong>{submission.score}%</strong> ({Math.round((submission.score || 0) * questions.length / 100)}/{questions.length} correct)
            </div>
          )}

          {isTeacher && (
            <div className="card mt-3">
              <div className="card-header"><strong>Student Scores</strong></div>
              <div className="card-body p-0">
                {allSubmissions.length === 0 ? (
                  <p className="text-muted p-3 mb-0">No students have submitted yet.</p>
                ) : (
                  <table className="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Score</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubmissions.map(sub => (
                        <tr key={sub.id}>
                          <td>{sub.student_name}</td>
                          <td>
                            <span className={`badge ${(sub.score || 0) >= 70 ? 'bg-success' : (sub.score || 0) >= 50 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                              {sub.score}%
                            </span>
                          </td>
                          <td className="text-muted small">{new Date(sub.submitted_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW MODE: Flashcards ===== */}
      {!editMode && assignment.assignment_type === 'flashcard' && (
        <>
          <style>{`
            .flip-card { perspective: 800px; cursor: pointer; min-height: 180px; }
            .flip-card-inner {
              position: relative; width: 100%; height: 100%; min-height: 180px;
              transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
              transform-style: preserve-3d;
            }
            .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
            .flip-card-front, .flip-card-back {
              position: absolute; inset: 0; backface-visibility: hidden;
              border-radius: 0.375rem; display: flex; flex-direction: column;
              align-items: center; justify-content: center; padding: 1.5rem;
              text-align: center;
            }
            .flip-card-front { background: #fff; border: 1px solid #dee2e6; }
            .flip-card-back {
              background: var(--el-gradient);
              color: #fff; transform: rotateY(180deg); border: none;
            }
            .flip-card:hover .flip-card-inner { box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
          `}</style>
          <div className="row g-3">
            {cards.map((card, ci) => (
              <div key={ci} className="col-md-6">
                <div
                  className={`flip-card${flippedCards.has(ci) ? ' flipped' : ''}`}
                  onClick={() => toggleCard(ci)}
                >
                  <div className="flip-card-inner">
                    <div className="flip-card-front">
                      <small className="text-muted mb-2">Card {ci + 1}</small>
                      <h5 className="mb-2">{card.front}</h5>
                      <small className="text-muted">(click to flip)</small>
                    </div>
                    <div className="flip-card-back">
                      <small style={{ opacity: 0.8 }} className="mb-2">Answer</small>
                      <p className="mb-2" style={{ fontSize: '1.1rem' }}>{card.back}</p>
                      <small style={{ opacity: 0.7 }}>(click to flip back)</small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
