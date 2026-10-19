const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const registerUser = async (userData) => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return res.json();
};

export const loginUser = async (credentials) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return res.json();
};

export const fetchEmployees = async () => {
  const res = await fetch(`${API_BASE}/employees`);
  return res.json();
};

export const addEmployee = async (data) => {
  const res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateRemainingLeaves = async (id, payload) => {
  const res = await fetch(`${API_BASE}/employees/${id}/remaining`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
};

export const incrementShortLeave = async (id, requesterRole) => {
  const res = await fetch(`${API_BASE}/employees/${id}/increment-short-leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterRole })
  });
  return res.json();
};

export const markAttendance = async (id) => {
  const res = await fetch(`${API_BASE}/employees/${id}/attendance`, {
    method: 'POST'
  });
  return res.json();
};

export const requestLeave = async (id, data) => {
  const res = await fetch(`${API_BASE}/employees/${id}/leave-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const fetchLeaveRequests = async () => {
  const res = await fetch(`${API_BASE}/leave-requests`);
  return res.json();
};

export const updateLeaveRequestStatus = async (reqId, payload) => {
  const res = await fetch(`${API_BASE}/leave-requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
};