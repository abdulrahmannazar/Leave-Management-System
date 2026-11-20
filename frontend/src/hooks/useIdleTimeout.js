import { useState, useEffect, useRef, useCallback } from 'react';
import {
  sendHeartbeat,
  logoutUserSession,
  clearLocalAuthState,
  IDLE_LOGOUT_MESSAGE
} from '../api';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const WARNING_THRESHOLD_MS = 29 * 60 * 1000; // 29 minutes (60s warning before logout)
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_THROTTLE_MS = 1000; // 1 second in-memory throttle for DOM events

const STORAGE_LAST_ACTIVITY_KEY = 'leavecore_last_activity';
const STORAGE_LOGOUT_BROADCAST_KEY = 'leavecore_logout_broadcast';

export default function useIdleTimeout({ isAuthenticated, onIdleLogout }) {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  const lastActivityRef = useRef(Date.now());
  const lastThrottleWriteRef = useRef(0);
  const lastHeartbeatAtRef = useRef(Date.now());
  const hasActivitySinceHeartbeatRef = useRef(false);
  const isWarningOpenRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  const performLogout = useCallback(
    async (reasonMessage = null, shouldBroadcast = true) => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      isWarningOpenRef.current = false;
      setIsWarningOpen(false);

      await logoutUserSession();
      clearLocalAuthState(reasonMessage);

      if (shouldBroadcast) {
        localStorage.setItem(
          STORAGE_LOGOUT_BROADCAST_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            reason: reasonMessage || null
          })
        );
      }

      if (onIdleLogout) {
        onIdleLogout(reasonMessage);
      }
    },
    [onIdleLogout]
  );

  // "Stay Signed In" button action in the 1-minute warning modal
  const handleStaySignedIn = useCallback(async () => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleWriteRef.current = now;
    lastHeartbeatAtRef.current = now;
    hasActivitySinceHeartbeatRef.current = false;
    isWarningOpenRef.current = false;
    setIsWarningOpen(false);
    setRemainingSeconds(60);

    localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(now));
    try {
      await sendHeartbeat();
    } catch (err) {
      // 401 is handled globally by authFetch interceptor
    }
  }, []);

  // "Log Out Now" button action
  const handleLogoutNow = useCallback(() => {
    performLogout(null, true);
  }, [performLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsWarningOpen(false);
      isWarningOpenRef.current = false;
      isLoggingOutRef.current = false;
      return;
    }

    isLoggingOutRef.current = false;
    const now = Date.now();
    const storedLastActivity = Number(localStorage.getItem(STORAGE_LAST_ACTIVITY_KEY));

    // Check if an existing session already exceeded 30 minutes of inactivity while tab was closed
    if (storedLastActivity && !isNaN(storedLastActivity)) {
      if (now - storedLastActivity >= IDLE_TIMEOUT_MS) {
        performLogout(IDLE_LOGOUT_MESSAGE, true);
        return;
      }
      lastActivityRef.current = storedLastActivity;
    } else {
      lastActivityRef.current = now;
      localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(now));
    }

    lastHeartbeatAtRef.current = now;
    hasActivitySinceHeartbeatRef.current = false;

    // Throttled user interaction handler
    const handleUserActivity = () => {
      // Do not auto-dismiss the 1-minute warning modal on incidental mouse movement;
      // the user must explicitly click "Stay Signed In" once inside the final 60s window.
      if (isWarningOpenRef.current || isLoggingOutRef.current) return;

      const currentTime = Date.now();
      if (currentTime - lastThrottleWriteRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastThrottleWriteRef.current = currentTime;
      lastActivityRef.current = currentTime;
      hasActivitySinceHeartbeatRef.current = true;
      localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(currentTime));

      // Send throttled keep-alive heartbeat once every 5 minutes while user is actively interacting
      if (currentTime - lastHeartbeatAtRef.current >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatAtRef.current = currentTime;
        hasActivitySinceHeartbeatRef.current = false;
        sendHeartbeat().catch(() => {});
      }
    };

    // Multi-tab synchronization via storage events
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_LAST_ACTIVITY_KEY && e.newValue) {
        const updatedTime = Number(e.newValue);
        if (!isNaN(updatedTime) && updatedTime > lastActivityRef.current) {
          lastActivityRef.current = updatedTime;
          if (Date.now() - updatedTime < WARNING_THRESHOLD_MS && isWarningOpenRef.current) {
            isWarningOpenRef.current = false;
            setIsWarningOpen(false);
            setRemainingSeconds(60);
          }
        }
      } else if (e.key === STORAGE_LOGOUT_BROADCAST_KEY && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          clearLocalAuthState(payload?.reason || null);
          if (onIdleLogout) {
            onIdleLogout(payload?.reason || null);
          }
        } catch (err) {
          clearLocalAuthState(null);
          if (onIdleLogout) onIdleLogout(null);
        }
      } else if ((e.key === 'leavecore_token' || e.key === 'leavecore_user') && !e.newValue) {
        const notice = sessionStorage.getItem('leavecore_logout_notice') || null;
        if (onIdleLogout) {
          onIdleLogout(notice);
        }
      }
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });
    window.addEventListener('storage', handleStorageChange);

    // 1-second check timer for 29-minute warning, 30-minute expiration, and 5-minute active heartbeat
    const intervalId = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const currentTime = Date.now();
      const stored = Number(localStorage.getItem(STORAGE_LAST_ACTIVITY_KEY));
      if (stored && !isNaN(stored) && stored > lastActivityRef.current) {
        lastActivityRef.current = stored;
      }

      const elapsedMs = currentTime - lastActivityRef.current;

      // 1. Check 30-minute inactivity expiration
      if (elapsedMs >= IDLE_TIMEOUT_MS) {
        performLogout(IDLE_LOGOUT_MESSAGE, true);
        return;
      }

      // 2. Check 29-minute warning threshold (last 60 seconds)
      if (elapsedMs >= WARNING_THRESHOLD_MS) {
        const secondsLeft = Math.max(1, Math.ceil((IDLE_TIMEOUT_MS - elapsedMs) / 1000));
        setRemainingSeconds(secondsLeft);
        if (!isWarningOpenRef.current) {
          isWarningOpenRef.current = true;
          setIsWarningOpen(true);
        }
      } else if (isWarningOpenRef.current) {
        isWarningOpenRef.current = false;
        setIsWarningOpen(false);
        setRemainingSeconds(60);
      }

      // 3. Throttled 5-minute heartbeat (only sent if user had real activity since last heartbeat)
      if (
        hasActivitySinceHeartbeatRef.current &&
        !isWarningOpenRef.current &&
        currentTime - lastHeartbeatAtRef.current >= HEARTBEAT_INTERVAL_MS
      ) {
        lastHeartbeatAtRef.current = currentTime;
        hasActivitySinceHeartbeatRef.current = false;
        sendHeartbeat().catch(() => {});
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, onIdleLogout, performLogout]);

  return {
    isWarningOpen,
    remainingSeconds,
    handleStaySignedIn,
    handleLogoutNow
  };
}
