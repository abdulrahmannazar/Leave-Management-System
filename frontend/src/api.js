const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const IDLE_LOGOUT_MESSAGE = 'You were logged out due to 30 minutes of inactivity.';

export const clearLocalAuthState = (reasonMessage = null) => {
  localStorage.removeItem('leavecore_token');
  localStorage.removeItem('leavecore_user');
  localStorage.removeItem('leavecore_last_activity');
  if (reasonMessage) {
    sessionStorage.setItem('leavecore_logout_notice', reasonMessage);
  }
};

// Centralized fetch wrapper with Authorization header & Global 401 Interceptor
const authFetch = async (url, options = {}) => {
  const { isBackgroundPoll = false, headers = {}, ...restOptions } = options;
  const token = localStorage.getItem('leavecore_token');

  const requestHeaders = {
    ...headers
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  if (isBackgroundPoll) {
    requestHeaders['X-Background-Poll'] = 'true';
  }

  const res = await fetch(url, {
    ...restOptions,
    headers: requestHeaders
  });

  if (res.status === 401) {
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }

    const message =
      data?.code === 'SESSION_IDLE_EXPIRED'
        ? IDLE_LOGOUT_MESSAGE
        : data?.message || IDLE_LOGOUT_MESSAGE;

    clearLocalAuthState(message);
    localStorage.setItem(
      'leavecore_logout_broadcast',
      JSON.stringify({ timestamp: Date.now(), reason: message })
    );

    window.dispatchEvent(
      new CustomEvent('leavecore:unauthorized', {
        detail: {
          code: data?.code || 'SESSION_IDLE_EXPIRED',
          message
        }
      })
    );

    return {
      error: message,
      code: data?.code || 'SESSION_IDLE_EXPIRED',
      unauthorized: true
    };
  }

  if (!isBackgroundPoll && token) {
    localStorage.setItem('leavecore_last_activity', String(Date.now()));
  }

  return res.json();
};

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

export const sendHeartbeat = async () => {
  return authFetch(`${API_BASE}/auth/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
};

export const logoutUserSession = async () => {
  const token = localStorage.getItem('leavecore_token');
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch (err) {
    // Ignore network error during logout cleanup
  }
};

export const fetchEmployees = async (options = {}) => {
  return authFetch(`${API_BASE}/employees`, options);
};

export const addEmployee = async (data) => {
  return authFetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const updateRemainingLeaves = async (id, payload) => {
  return authFetch(`${API_BASE}/employees/${id}/remaining`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const incrementShortLeave = async (id, requesterRole) => {
  return authFetch(`${API_BASE}/employees/${id}/increment-short-leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterRole })
  });
};

export const markAttendance = async (id) => {
  return authFetch(`${API_BASE}/employees/${id}/attendance`, {
    method: 'POST'
  });
};

export const requestLeave = async (id, data) => {
  return authFetch(`${API_BASE}/employees/${id}/leave-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const fetchLeaveRequests = async (options = {}) => {
  return authFetch(`${API_BASE}/leave-requests`, options);
};

export const updateLeaveRequestStatus = async (reqId, payload) => {
  return authFetch(`${API_BASE}/leave-requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const requestLeaveProof = async (reqId, payload) => {
  return authFetch(`${API_BASE}/leave-requests/${reqId}/request-proof`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const uploadLeaveProof = async (reqId, payload) => {
  return authFetch(`${API_BASE}/leave-requests/${reqId}/upload-proof`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};
