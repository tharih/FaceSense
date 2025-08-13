import React, { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { Camera, Download, LogOut, UserPlus, Users, Activity, Calendar, BarChart2, Shield, Play } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

/**
 * FaceSense React + Tailwind Frontend (SPA)
 * --------------------------------------------------
 * Production-ready, single-file React app with Tailwind CSS UI.
 * Designed to integrate with a Django backend (FaceSense) for:
 * - Auth (login, role-based routing)
 * - Real-time attendance capture via webcam (frames streamed to backend)
 * - Emotion detection (performed by backend; frontend displays results)
 * - Admin user management (CRUD)
 * - CSV export
 * - Reports & emotion trends
 * 
 * Endpoints expected (customize in API_BASE):
 *  POST   /api/auth/login                 -> { token, user: {id, name, role} }
 *  GET    /api/me                         -> { id, name, role }
 *  GET    /api/users                      -> [ { id, name, email, role } ]
 *  POST   /api/users                      -> create user
 *  DELETE /api/users/:id                  -> delete user
 *  POST   /api/attendance/start           -> { sessionId }
 *  POST   /api/attendance/frame           -> { sessionId, imageBase64 } -> { status: 'ok' }
 *  POST   /api/attendance/complete        -> { sessionId } -> { userName, emotion, timestamp }
 *  GET    /api/attendance/export?range=   -> CSV file
 *  GET    /api/stats?range=               -> { daily:[{date, present, absent}], emotions:[{label,value}], timeline:[{time,emotion}] }
 * 
 * NOTE: This file lives at src/App.jsx
 */

// -------------- CONFIG --------------
const API_BASE = import.meta?.env?.VITE_API_BASE || ""; // e.g. "http://127.0.0.1:8000" (Django)

// -------------- API CLIENT --------------
async function api(path, { method = "GET", body, token, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": body instanceof FormData ? undefined : "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/csv")) return res; // caller handles download
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

// -------------- AUTH CONTEXT --------------
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("fs_token");
    if (t) {
      setToken(t);
      api("/api/me", { token: t })
        .then(setUser)
        .catch(() => { localStorage.removeItem("fs_token"); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("fs_token", data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("fs_token");
  };

  const value = useMemo(() => ({ user, token, login, logout, loading }), [user, token, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// -------------- PROTECTED ROUTES --------------
function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner label="Loading your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// -------------- LAYOUT --------------
function AppShell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">FS</span>
            <span>FaceSense</span>
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/attendance" icon={<Camera className="h-4 w-4"/>} label="Attendance"/>
            <NavLink to="/reports" icon={<BarChart2 className="h-4 w-4"/>} label="Reports"/>
            {user?.role === "Admin" && (
              <NavLink to="/admin/users" icon={<Users className="h-4 w-4"/>} label="Users"/>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 hover:bg-gray-100">
              <LogOut className="h-4 w-4"/> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-gray-500">© {new Date().getFullYear()} FaceSense</footer>
    </div>
  );
}

function NavLink({ to, icon, label }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm hover:bg-gray-100">
      {icon} {label}
    </Link>
  );
}

function FullScreenSpinner({ label = "Loading..." }) {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
}

// -------------- PAGES --------------
function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-indigo-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white text-lg font-bold">FS</span>
          <div>
            <h1 className="font-semibold">FaceSense</h1>
            <p className="text-xs text-gray-500">AI Attendance & Emotion Detection</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@facesense.app" required/>
          </div>
          <div>
            <label className="text-sm">Password</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-indigo-600 py-2.5 text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500">Use admin credentials created in Django Admin.</p>
      </div>
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();
  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Take Attendance" icon={<Camera className="h-5 w-5"/>} to="/attendance">
          Log presence with webcam. Emotion is captured automatically.
        </Card>
        <Card title="Reports" icon={<BarChart2 className="h-5 w-5"/>} to="/reports">
          View trends by day/week and emotion distribution.
        </Card>
        {user?.role === "Admin" && (
          <Card title="Manage Users" icon={<Users className="h-5 w-5"/>} to="/admin/users">
            Add new users and manage roles.
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Card({ title, icon, children, to }) {
  const Wrapper = to ? Link : "div";
  return (
    <Wrapper to={to} className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-gray-600">{children}</p>
    </Wrapper>
  );
}

// -------------- ATTENDANCE (WEBCAM) --------------
function AttendancePage() {
  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <AttendCapture />
        </div>
        <div className="md:col-span-2 space-y-4">
          <QuickActions />
          <RecentEvents />
        </div>
      </div>
    </AppShell>
  );
}

function AttendCapture() {
  const { token } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStreaming(false);
  };

  const startSession = async () => {
    setResult(null);
    setStatus("Starting session...");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
      setStreaming(true);
      const { sessionId } = await api("/api/attendance/start", { method: "POST", token });
      setSessionId(sessionId);
      setStatus("Streaming frames...");
      streamFrames(sessionId);
    } catch (e) {
      setStatus("Camera permission denied or unavailable");
    }
  };

  const streamFrames = async (sid) => {
    const frames = 20;
    for (let i = 0; i < frames; i++) {
      const img = await captureFrame();
      try {
        await api("/api/attendance/frame", { method: "POST", token, body: { sessionId: sid, imageBase64: img } });
      } catch (e) { /* ignore */ }
      await new Promise(r => setTimeout(r, 100));
    }
    await completeSession(sid);
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(99,102,241,0.9)";
    ctx.lineWidth = 3;
    const w = canvas.width * 0.6;
    const h = canvas.height * 0.6;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.strokeRect(x, y, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const completeSession = async (sid) => {
    try {
      const data = await api("/api/attendance/complete", { method: "POST", token, body: { sessionId: sid } });
      setResult(data);
      setStatus("Completed");
    } catch (e) {
      setStatus("No face detected. You can use Manual Present.");
    } finally {
      stopStream();
      setSessionId(null);
    }
  };

  const manualPresent = async () => {
    setStatus("Recording manual presence...");
    try {
      const data = await api("/api/attendance/complete", { method: "POST", token, body: { manual: true } });
      setResult(data);
      setStatus("Manual recorded");
    } catch (e) {
      setStatus("Manual record failed");
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Camera className="h-5 w-5"/></div>
        <h2 className="font-semibold">Emotion Detection & Attendance</h2>
      </div>
      <div className="grid gap-4">
        <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black/70">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={startSession} disabled={streaming} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60">
            <Play className="h-4 w-4"/> {streaming ? "Streaming..." : "Start Camera & Capture"}
          </button>
          <button onClick={manualPresent} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50">
            Present (Manual)
          </button>
          <span className="text-sm text-gray-600">Status: {status}</span>
        </div>
        {result && (
          <div className="rounded-xl border bg-gray-50 p-4">
            <p className="text-sm">Recorded for <span className="font-semibold">{result.userName}</span> at <span className="font-mono">{new Date(result.timestamp).toLocaleString()}</span></p>
            <p className="text-sm">Emotion: <span className="font-semibold">{result.emotion || "manual"}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActions() {
  const { token } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const exportCsv = async () => {
    setDownloading(true);
    try {
      const res = await api("/api/attendance/export?range=30d", { token });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Activity className="h-5 w-5"/></div>
        <h3 className="font-semibold">Quick Actions</h3>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={exportCsv} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50">
          <Download className="h-4 w-4"/> Export CSV
        </button>
        <Link to="/reports" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50">
          <Calendar className="h-4 w-4"/> View Reports
        </Link>
      </div>
    </div>
  );
}

function RecentEvents() {
  const [items, setItems] = useState([]);
  const { token } = useAuth();
  useEffect(() => {
    api("/api/stats?range=1d", { token }).then(d => setItems(d.timeline?.slice(-5) || [])).catch(()=>{});
  }, [token]);
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Shield className="h-5 w-5"/></div>
        <h3 className="font-semibold">Recent Events</h3>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-sm text-gray-500">No events yet.</li>}
        {items.map((it, idx) => (
          <li key={idx} className="rounded-xl border px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{it.userName || "User"}</span>
              <span className="text-xs text-gray-500">{new Date(it.time || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div className="text-xs text-gray-600">Emotion: {it.emotion || "—"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------- REPORTS --------------
function ReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState({ daily: [], emotions: [] });
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/stats?range=${range}`, { token })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, range]);

  return (
    <AppShell>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BarChart2 className="h-5 w-5"/></div>
            <h2 className="font-semibold">Reports & Insights</h2>
          </div>
          <select value={range} onChange={e=>setRange(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {loading ? <div className="py-12 text-center text-sm text-gray-500">Loading charts...</div> : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 text-sm font-medium">Daily Attendance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} angle={-15} height={40} dy={10} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="present" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 text-sm font-medium">Emotion Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.emotions} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// -------------- ADMIN: USERS --------------
function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Student" });

  const load = async () => {
    const list = await api("/api/users", { token });
    setUsers(list);
  };
  useEffect(() => { load(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/users", { method: "POST", token, body: form });
      setForm({ name: "", email: "", role: "Student" });
      await load();
    } finally { setBusy(false); }
  };

  const removeUser = async (id) => {
    if (!confirm("Delete this user?")) return;
    await api(`/api/users/${id}`, { method: "DELETE", token });
    await load();
  };

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Users className="h-5 w-5"/></div>
            <h2 className="font-semibold">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2 font-medium">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td className="text-right">
                      <button onClick={()=>removeUser(u.id)} className="rounded-xl border px-3 py-1 hover:bg-gray-50">Delete</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-gray-500">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><UserPlus className="h-5 w-5"/></div>
            <h2 className="font-semibold">Add User</h2>
          </div>
          <form onSubmit={addUser} className="space-y-3">
            <div>
              <label className="text-sm">Full name</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" value={form.name} onChange={e=>setForm(v=>({...v, name:e.target.value}))} required />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <input type="email" className="mt-1 w-full rounded-xl border px-3 py-2" value={form.email} onChange={e=>setForm(v=>({...v, email:e.target.value}))} required />
            </div>
            <div>
              <label className="text-sm">Role</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2" value={form.role} onChange={e=>setForm(v=>({...v, role:e.target.value}))}>
                <option>Admin</option>
                <option>Staff</option>
                <option>Student</option>
              </select>
            </div>
            <button disabled={busy} className="w-full rounded-xl bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Adding..." : "Add"}</button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

// -------------- APP --------------
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage/>} />
          <Route path="/" element={<Protected><HomePage/></Protected>} />
          <Route path="/attendance" element={<Protected><AttendancePage/></Protected>} />
          <Route path="/reports" element={<Protected><ReportsPage/></Protected>} />
          <Route path="/admin/users" element={<Protected roles={["Admin"]}><AdminUsersPage/></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
