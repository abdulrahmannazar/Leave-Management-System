const API_BASE = 'http://localhost:5000/api';

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

export const incrementShortLeave = async (id) => {
  const res = await fetch(`${API_BASE}/employees/${id}/increment-short-leave`, {
    method: 'POST'
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

export const forceApproveLeave = async (id, data) => {
  const res = await fetch(`${API_BASE}/employees/${id}/force-approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};