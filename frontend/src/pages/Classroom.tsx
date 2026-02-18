import React, { useState, useEffect, useRef, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ChatRoom, WhiteboardTool, WhiteboardAction } from '../types';

interface LiveChatMsg {
  id: number;
  username: string;
  message: string;
  user_type?: string;
}

export default function Classroom() {
  const { user } = useAuth();
  const isTeacher = user?.user_type === 'teacher';

  // Room state
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<LiveChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Whiteboard state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [fontSize, setFontSize] = useState(20);
  const drawingRef = useRef(false);
  const pointsRef = useRef<[number, number][]>([]);
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const actionsRef = useRef<WhiteboardAction[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Inline text input state
  const [textInput, setTextInput] = useState<{ visible: boolean; nx: number; ny: number; cssX: number; cssY: number; value: string }>({
    visible: false, nx: 0, ny: 0, cssX: 0, cssY: 0, value: ''
  });
  const textInputRef = useRef<HTMLInputElement>(null);

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);

  // Move tool state
  const movingIndexRef = useRef<number | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveTotalDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Audio streaming state
  const [micActive, setMicActive] = useState(false);
  const [teacherStreaming, setTeacherStreaming] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null;

  // Load rooms
  useEffect(() => {
    client.get('/chatrooms/').then(res => {
      setRooms(res.data);
      if (res.data.length > 0) setSelectedRoomId(res.data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // --- Canvas drawing helpers ---

  const getCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? { w: canvas.width, h: canvas.height } : { w: 1, h: 1 };
  }, []);

  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: WhiteboardAction, cw: number, ch: number) => {
    if (action.type === 'draw' || action.type === 'erase') {
      ctx.beginPath();
      ctx.strokeStyle = action.type === 'erase' ? '#ffffff' : action.color;
      ctx.lineWidth = action.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = action.points;
      if (pts.length > 0) {
        ctx.moveTo(pts[0][0] * cw, pts[0][1] * ch);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0] * cw, pts[i][1] * ch);
        }
        ctx.stroke();
      }
    } else if (action.type === 'line') {
      ctx.beginPath();
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.width;
      ctx.lineCap = 'round';
      ctx.moveTo(action.x1 * cw, action.y1 * ch);
      ctx.lineTo(action.x2 * cw, action.y2 * ch);
      ctx.stroke();
    } else if (action.type === 'text') {
      ctx.fillStyle = action.color;
      ctx.font = `${action.fontSize}px sans-serif`;
      ctx.fillText(action.content, action.x * cw, action.y * ch);
    } else if (action.type === 'clear') {
      ctx.clearRect(0, 0, cw, ch);
    }
  }, []);

  const replayAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);
    for (const action of actionsRef.current) {
      drawAction(ctx, action, w, h);
    }
  }, [drawAction, getCanvasSize]);

  // Fixed canvas resolution for consistent rendering across screens
  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    replayAll();
  }, [replayAll, selectedRoomId]);

  // --- WebSocket connection with auto-reconnect ---
  useEffect(() => {
    if (!selectedRoom) {
      setChatMessages([]);
      actionsRef.current = [];
      return;
    }

    // Load messages via REST
    client.get(`/chatrooms/${selectedRoom.id}/messages/`).then(res => {
      setChatMessages(res.data.map((m: any) => ({
        id: m.id,
        username: m.sender_name,
        message: m.content,
        user_type: m.user_type,
      })));
    }).catch(() => {});

    // WebSocket with token auth + auto-reconnect
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '').replace('/api', '') || 'localhost:8080';
    const roomName = selectedRoom.name.replace(/[^a-zA-Z0-9]/g, '_');
    const token = localStorage.getItem('auth_token') || '';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/chat/${roomName}/?token=${token}`;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          setChatMessages(prev => [...prev, {
            id: Date.now(),
            username: data.username,
            message: data.message,
            user_type: data.user_type,
          }]);
        } else if (data.type === 'whiteboard_state') {
          actionsRef.current = data.actions || [];
          replayAll();
        } else if (data.type === 'wb_draw') {
          const action: WhiteboardAction = { type: 'draw', points: data.points, color: data.color, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_line') {
          const action: WhiteboardAction = { type: 'line', x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2, color: data.color, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_text') {
          const action: WhiteboardAction = { type: 'text', x: data.x, y: data.y, content: data.content, fontSize: data.fontSize, color: data.color };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_erase') {
          const action: WhiteboardAction = { type: 'erase', points: data.points, width: data.width };
          actionsRef.current.push(action);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawAction(ctx, action, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_clear') {
          actionsRef.current = [];
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } else if (data.type === 'wb_undo') {
          actionsRef.current.pop();
          replayAll();
        } else if (data.type === 'wb_move') {
          const idx = data.index;
          const action = actionsRef.current[idx];
          if (action) {
            if (action.type === 'text') {
              action.x += data.dx;
              action.y += data.dy;
            } else if (action.type === 'line') {
              action.x1 += data.dx;
              action.y1 += data.dy;
              action.x2 += data.dx;
              action.y2 += data.dy;
            }
            replayAll();
          }
        } else if (data.type === 'user_join' || data.type === 'user_leave') {
          // Could show system messages if desired

        // --- Audio streaming (PCM via AudioContext) ---
        } else if (data.type === 'audio_start') {
          setTeacherStreaming(true);
          // Student: create AudioContext for playback
          if (user?.user_type !== 'teacher') {
            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            nextStartTimeRef.current = 0;
            // Auto-resume if browser suspends it
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
              const resumeOnClick = () => {
                ctx.resume().catch(() => {});
                document.removeEventListener('click', resumeOnClick);
              };
              document.addEventListener('click', resumeOnClick);
            }
          }
        } else if (data.type === 'audio_stop') {
          setTeacherStreaming(false);
          const ctx = audioContextRef.current;
          if (ctx) { ctx.close().catch(() => {}); }
          audioContextRef.current = null;
          nextStartTimeRef.current = 0;
        } else if (data.type === 'audio_data') {
          // Student: decode PCM Int16 → Float32 and play via AudioContext
          const ctx = audioContextRef.current;
          if (!ctx || user?.user_type === 'teacher') return;
          const binary = atob(data.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          const buffer = ctx.createBuffer(1, float32.length, 16000);
          buffer.getChannelData(0).set(float32);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          const now = ctx.currentTime;
          if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
          // Cap latency: if scheduled too far ahead, reset
          if (nextStartTimeRef.current > now + 1.0) nextStartTimeRef.current = now + 0.05;
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [selectedRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Ctrl+Z undo for teacher
  useEffect(() => {
    if (!isTeacher) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'undo' }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTeacher]);

  // --- Mouse handlers for canvas (teacher only) ---

  const getNormCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  // Hit-test: find the topmost line or text action near (nx, ny)
  const hitTestAction = (nx: number, ny: number): number | null => {
    const threshold = 0.02; // ~2% of canvas
    for (let i = actionsRef.current.length - 1; i >= 0; i--) {
      const a = actionsRef.current[i];
      if (a.type === 'text') {
        // Rough bounding box: anchor is bottom-left of text
        const textW = (a.content.length * a.fontSize * 0.6) / CANVAS_W;
        const textH = a.fontSize / CANVAS_H;
        if (nx >= a.x - threshold && nx <= a.x + textW + threshold &&
            ny >= a.y - textH - threshold && ny <= a.y + threshold) {
          return i;
        }
      } else if (a.type === 'line') {
        // Distance from point to line segment
        const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((nx - a.x1) * dx + (ny - a.y1) * dy) / lenSq));
        const px = a.x1 + t * dx, py = a.y1 + t * dy;
        const dist = Math.sqrt((nx - px) ** 2 + (ny - py) ** 2);
        if (dist < threshold) return i;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher) return;
    const [nx, ny] = getNormCoords(e);

    if (tool === 'move') {
      const idx = hitTestAction(nx, ny);
      if (idx !== null) {
        movingIndexRef.current = idx;
        moveStartRef.current = { x: nx, y: ny };
        moveTotalDeltaRef.current = { dx: 0, dy: 0 };
        drawingRef.current = true;
      }
      return;
    }

    if (tool === 'text') {
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        setTextInput({
          visible: true,
          nx, ny,
          cssX: (e.clientX - containerRect.left),
          cssY: (e.clientY - containerRect.top),
          value: ''
        });
        setTimeout(() => textInputRef.current?.focus(), 0);
      }
      return;
    }

    drawingRef.current = true;

    if (tool === 'line') {
      lineStartRef.current = { x: nx, y: ny };
    } else {
      pointsRef.current = [[nx, ny]];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.arc(nx * canvas.width, ny * canvas.height, (tool === 'eraser' ? eraserWidth : lineWidth) / 2, 0, Math.PI * 2);
          ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
          ctx.fill();
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !drawingRef.current) return;
    const [nx, ny] = getNormCoords(e);

    if (tool === 'move' && movingIndexRef.current !== null && moveStartRef.current) {
      const dx = nx - moveStartRef.current.x;
      const dy = ny - moveStartRef.current.y;
      moveTotalDeltaRef.current.dx += dx;
      moveTotalDeltaRef.current.dy += dy;
      const action = actionsRef.current[movingIndexRef.current];
      if (action) {
        if (action.type === 'text') {
          action.x += dx; action.y += dy;
        } else if (action.type === 'line') {
          action.x1 += dx; action.y1 += dy;
          action.x2 += dx; action.y2 += dy;
        }
        moveStartRef.current = { x: nx, y: ny };
        replayAll();
      }
      return;
    }

    if (tool === 'line') {
      replayAll();
      const canvas = canvasRef.current;
      if (canvas && lineStartRef.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.moveTo(lineStartRef.current.x * canvas.width, lineStartRef.current.y * canvas.height);
          ctx.lineTo(nx * canvas.width, ny * canvas.height);
          ctx.stroke();
        }
      }
    } else {
      pointsRef.current.push([nx, ny]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pts = pointsRef.current;
          if (pts.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.lineWidth = tool === 'eraser' ? eraserWidth : lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(pts[pts.length - 2][0] * canvas.width, pts[pts.length - 2][1] * canvas.height);
            ctx.lineTo(pts[pts.length - 1][0] * canvas.width, pts[pts.length - 1][1] * canvas.height);
            ctx.stroke();
          }
        }
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTeacher || !drawingRef.current) return;
    drawingRef.current = false;

    if (tool === 'move' && movingIndexRef.current !== null) {
      const { dx, dy } = moveTotalDeltaRef.current;
      if ((dx !== 0 || dy !== 0) && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'move', index: movingIndexRef.current, dx, dy
        }));
      }
      movingIndexRef.current = null;
      moveStartRef.current = null;
      return;
    }

    if (tool === 'line' && lineStartRef.current) {
      const [nx, ny] = getNormCoords(e);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'line',
          x1: lineStartRef.current.x, y1: lineStartRef.current.y,
          x2: nx, y2: ny, color, width: lineWidth
        }));
      }
      lineStartRef.current = null;
    } else if (tool === 'pen' || tool === 'eraser') {
      if (pointsRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        if (tool === 'pen') {
          wsRef.current.send(JSON.stringify({
            type: 'draw', points: pointsRef.current, color, width: lineWidth
          }));
        } else {
          wsRef.current.send(JSON.stringify({
            type: 'erase', points: pointsRef.current, width: eraserWidth
          }));
        }
      }
      pointsRef.current = [];
    }
  };

  const submitTextInput = () => {
    if (textInput.value.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text', x: textInput.nx, y: textInput.ny,
        content: textInput.value.trim(), fontSize, color
      }));
    }
    setTextInput(prev => ({ ...prev, visible: false, value: '' }));
  };

  const cancelTextInput = () => {
    setTextInput(prev => ({ ...prev, visible: false, value: '' }));
  };

  const handleClear = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  };

  // --- Audio streaming helpers (PCM via AudioContext) ---

  const cleanupAudio = useCallback(() => {
    // Close AudioContext (used by both teacher for capture and student for playback)
    const ctx = audioContextRef.current;
    if (ctx) { ctx.close().catch(() => {}); }
    audioContextRef.current = null;
    nextStartTimeRef.current = 0;
    // Stop mic tracks (teacher)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setMicActive(false);
    setTeacherStreaming(false);
  }, []);

  const handleMicToggle = useCallback(async () => {
    if (micActive) {
      // Stop broadcasting
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'audio_stop' }));
      }
      cleanupAudio();
    } else {
      // Start broadcasting: capture mic → downsample to 16kHz PCM → base64 → WS
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setMicActive(true);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio_start' }));
        }
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        // Mute local output to prevent feedback
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0;
        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const ratio = audioCtx.sampleRate / 16000;
          const outLen = Math.floor(float32.length / ratio);
          const int16 = new Int16Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const idx = Math.floor(i * ratio);
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[idx] * 32768)));
          }
          const uint8 = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          const base64 = btoa(binary);
          wsRef.current!.send(JSON.stringify({ type: 'audio_data', data: base64 }));
        };
      } catch {
        setToast('Could not access microphone. Please allow microphone access.');
        setTimeout(() => setToast(null), 4000);
      }
    }
  }, [micActive, cleanupAudio]);

  // Cleanup audio when changing rooms
  useEffect(() => {
    return () => { cleanupAudio(); };
  }, [selectedRoomId, cleanupAudio]);

  // --- Chat send ---
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', message: newMessage }));
    } else {
      client.post(`/chatrooms/${selectedRoom.id}/send/`, { content: newMessage }).then(res => {
        setChatMessages(prev => [...prev, {
          id: res.data.id,
          username: res.data.sender_name,
          message: res.data.content,
          user_type: res.data.user_type,
        }]);
      }).catch(() => {});
    }
    setNewMessage('');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await client.post('/chatrooms/', { name: newRoomName, participants: [user?.id] });
      setRooms(prev => [res.data, ...prev]);
      setSelectedRoomId(res.data.id);
      setNewRoomName('');
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar with room selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6' }}>
        <select
          className="form-select form-select-sm"
          style={{ width: 220 }}
          value={selectedRoomId ?? ''}
          onChange={e => setSelectedRoomId(Number(e.target.value))}
        >
          <option value="" disabled>Select a room...</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.participant_names?.length || 0})</option>
          ))}
        </select>
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: 4 }}>
          <input
            className="form-control form-control-sm"
            style={{ width: 140 }}
            placeholder="New room..."
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">+</button>
        </form>
        {selectedRoom && (
          <span className="text-muted small ms-auto">
            {selectedRoom.participant_names?.join(', ')}
          </span>
        )}
      </div>

      {!selectedRoom ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Select a room or create a new one</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Whiteboard — left 70% */}
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', borderRight: '1px solid #dee2e6' }}>
            {/* Teacher toolbar */}
            {isTeacher && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6', flexWrap: 'wrap' }}>
                {([
                  { id: 'pen' as WhiteboardTool, title: 'Pen', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l9.5-9.5zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z"/></svg> },
                  { id: 'line' as WhiteboardTool, title: 'Line', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0z"/></svg> },
                  { id: 'text' as WhiteboardTool, title: 'Text', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.258 3H3.747l-.082 2.46h.479c.26-1.544.758-1.783 2.693-1.845l.424-.013v7.827c0 .663-.144.82-1.3.923v.52h4.082v-.52c-1.162-.103-1.306-.26-1.306-.923V3.602l.43.013c1.935.062 2.434.3 2.694 1.845h.479L12.258 3z"/></svg> },
                  { id: 'eraser' as WhiteboardTool, title: 'Eraser', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l5.88-5.879zm2.121.707a1 1 0 0 0-1.414 0L4.16 7.547l5.293 5.293 4.633-4.633a1 1 0 0 0 0-1.414l-3.879-3.879zM8.746 13.547 3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293l.16-.16z"/></svg> },
                  { id: 'move' as WhiteboardTool, title: 'Move', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10zM.146 8.354a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L1.707 7.5H5.5a.5.5 0 0 1 0 1H1.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2zM10 8a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L14.293 8.5H10.5A.5.5 0 0 1 10 8z"/></svg> },
                ]).map(t => (
                  <button
                    key={t.id}
                    className={`btn btn-sm ${tool === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setTool(t.id)}
                    title={t.title}
                    style={{ padding: '4px 8px', lineHeight: 1 }}
                  >
                    {t.icon}
                  </button>
                ))}
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                {(tool === 'pen' || tool === 'line' || tool === 'text') && (
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 30, height: 28, border: 'none', padding: 0, cursor: 'pointer' }} title="Color" />
                )}
                {(tool === 'pen' || tool === 'line') && (
                  <select className="form-select form-select-sm" style={{ width: 70 }} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} title="Width">
                    {[1, 2, 3, 5, 8, 12].map(w => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                )}
                {tool === 'text' && (
                  <select className="form-select form-select-sm" style={{ width: 70 }} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} title="Font size">
                    {[12, 16, 20, 28, 36, 48].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                )}
                {tool === 'eraser' && (
                  <select className="form-select form-select-sm" style={{ width: 75 }} value={eraserWidth} onChange={e => setEraserWidth(Number(e.target.value))} title="Eraser size">
                    {[10, 20, 40, 60, 80].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                )}
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'undo' }));
                    }
                  }}
                  title="Undo (Ctrl+Z)"
                  style={{ padding: '4px 8px', lineHeight: 1 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={handleClear}>Clear All</button>
                <span style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />
                <button
                  className={`btn btn-sm ${micActive ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={handleMicToggle}
                  title={micActive ? 'Stop microphone' : 'Start microphone'}
                >
                  {micActive ? 'Mic ON' : 'Mic'}
                </button>
              </div>
            )}
            {/* Canvas — fixed 16:9 aspect ratio */}
            <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ecef', overflow: 'hidden', position: 'relative' }}>
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9',
                  background: '#ffffff', display: 'block',
                  cursor: (() => {
                    if (!isTeacher) return 'default';
                    if (tool === 'move') return 'grab';
                    if (tool === 'text') return 'text';
                    if (tool === 'eraser') {
                      const canvas = canvasRef.current;
                      const scale = canvas ? canvas.getBoundingClientRect().width / canvas.width : 0.5;
                      const sz = Math.max(8, Math.min(128, Math.round(eraserWidth * scale)));
                      const half = Math.round(sz / 2);
                      return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}'%3E%3Crect x='1' y='1' width='${sz - 2}' height='${sz - 2}' fill='rgba(200,200,200,0.3)' stroke='%23333' stroke-width='1.5'/%3E%3C/svg%3E") ${half} ${half}, auto`;
                    }
                    return 'crosshair';
                  })()
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  if (drawingRef.current && isTeacher) {
                    drawingRef.current = false;
                    if (tool === 'pen' || tool === 'eraser') {
                      if (pointsRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify(
                          tool === 'pen'
                            ? { type: 'draw', points: pointsRef.current, color, width: lineWidth }
                            : { type: 'erase', points: pointsRef.current, width: eraserWidth }
                        ));
                      }
                      pointsRef.current = [];
                    }
                    lineStartRef.current = null;
                  }
                }}
              />
              {/* Inline text input overlay */}
              {textInput.visible && (
                <input
                  ref={textInputRef}
                  value={textInput.value}
                  onChange={e => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitTextInput();
                    if (e.key === 'Escape') cancelTextInput();
                  }}
                  onBlur={submitTextInput}
                  placeholder="Type here..."
                  style={{
                    position: 'absolute',
                    left: textInput.cssX,
                    top: textInput.cssY - fontSize / 2,
                    fontSize: fontSize * 0.7,
                    color,
                    background: 'rgba(255,255,255,0.9)',
                    border: '1.5px solid var(--el-green)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    outline: 'none',
                    minWidth: 120,
                    zIndex: 10,
                    fontFamily: 'sans-serif',
                  }}
                />
              )}
              {!isTeacher && (
                <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 6 }}>
                  <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                    View only
                  </div>
                  {teacherStreaming && (
                    <div
                      style={{ background: 'rgba(220,53,69,0.85)', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: '0.75rem', animation: 'pulse 1.5s infinite', cursor: 'pointer' }}
                      onClick={() => {
                        const ctx = audioContextRef.current;
                        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
                      }}
                    >
                      Teacher speaking
                    </div>
                  )}
                </div>
              )}
              {/* Toast notification */}
              {toast && (
                <div style={{
                  position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                  background: '#dc3545', color: '#fff', padding: '6px 16px', borderRadius: 6,
                  fontSize: '0.85rem', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  {toast}
                </div>
              )}
            </div>
          </div>

          {/* Chat — right 30%, YouTube live chat style */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 12px', background: 'var(--el-green-50)', borderBottom: '1px solid #dee2e6', fontWeight: 600, fontSize: '0.9rem' }}>
              Live Chat
            </div>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {chatMessages.map(m => {
                const isMsgTeacher = m.user_type === 'teacher';
                const isMe = m.username === user?.username;
                return (
                  <div key={m.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.85rem', lineHeight: 1.3 }}>
                    <span style={{
                      fontWeight: 600,
                      flexShrink: 0,
                      padding: '1px 6px',
                      borderRadius: 4,
                      ...(isMsgTeacher
                        ? { background: 'var(--el-green)', color: '#fff' }
                        : isMe
                          ? { border: '1.5px solid var(--el-green)', color: 'var(--el-green-dark)' }
                          : { color: '#495057' }
                      )
                    }}>
                      {m.username}
                    </span>
                    <span style={{ color: '#212529', wordBreak: 'break-word' }}>{m.message}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <form onSubmit={handleSend} style={{ display: 'flex', padding: 8, borderTop: '1px solid #dee2e6', gap: 4 }}>
              <input
                className="form-control form-control-sm"
                placeholder="Say something..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary btn-sm">Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
