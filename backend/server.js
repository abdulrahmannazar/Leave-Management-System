const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendLeaveNotificationEmail } = require('./notification');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'leavecore_super_secret_jwt_key_2026';

// CORS configuration (compatible with Express 5)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increased JSON body limit to support supporting evidence attachments (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Local timezone configuration (Sri Lanka - UTC+5:30)
const TIMEZONE = 'Asia/Colombo';

const getTodayString = () => {
  // Returns YYYY-MM-DD in Asia/Colombo local time
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
};

const getCurrentTimeString = () => {
  // Returns actual Asia/Colombo local time (e.g., "03:39 PM")
  return new Date().toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Inclusive End Date calculator from YYYY-MM-DD startDate + requested days
const calculateEndDate = (startDateStr, days, isShortLeave) => {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) return startDateStr || getTodayString();
  if (isShortLeave) return startDateStr;

  const totalDays = Math.max(1, Math.ceil(days));
  const [year, month, day] = startDateStr.split('-').map(Number);
  const endObj = new Date(Date.UTC(year, month - 1, day + (totalDays - 1)));
  return endObj.toISOString().split('T')[0];
};

const roundToOneDecimal = (num) => Math.round(num * 10) / 10;
const MONTHLY_SHORT_LEAVE_LIMIT = 2;

// Generate unique Role-based IDs (e.g. EMP001-42, MGR002-19)
const generateEmployeeId = async (role) => {
  const prefix =
    role === 'ADMIN' ? 'ADM' :
    role === 'HR' ? 'HR' :
    role === 'MANAGER' ? 'MGR' :
    role === 'SUPERVISOR' ? 'SUP' : 'EMP';

  const count = await prisma.employee.count();
  return `${prefix}${String(count + 1).padStart(3, '0')}-${Math.floor(10 + Math.random() * 90)}`;
};

// Daily attendance & monthly short leave reset
const ensureDailyReset = async (emp) => {
  const today = getTodayString();
  const currentMonth = today.slice(0, 7); // 'YYYY-MM'
  const empMonth = emp.attendanceDate ? emp.attendanceDate.slice(0, 7) : currentMonth;
  const updateData = {};

  if (emp.attendanceDate !== today) {
    updateData.attendanceDate = today;
    updateData.presentToday = false;
    updateData.presentTime = null;
  }

  if (empMonth !== currentMonth) {
    updateData.shortLeavesTaken = 0;
  }

  if (Object.keys(updateData).length > 0) {
    return await prisma.employee.update({
      where: { id: emp.id },
      data: updateData
    });
  }
  return emp;
};

// Health Check Endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Leave Management System API is live and running' });
});

// ================= AUTHENTICATION ROUTES =================

// 1. Register a Management User (Employees cannot self-register)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, dept, allowedAnnual, allowedCasual } = req.body;

  if (!name || !email || !password || !role || !dept) {
    return res.status(400).json({ error: 'All fields (Name, Email, Password, Role, Department) are required.' });
  }

  if (role === 'EMPLOYEE') {
    return res.status(403).json({
      error: 'Employees cannot self-register. Please ask your Supervisor, Department Manager, or HR to create your credentials.'
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existingEmail = await prisma.employee.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Rule: Each department can only have 1 Manager
    if (role === 'MANAGER') {
      const existingManager = await prisma.employee.findFirst({
        where: { dept, role: 'MANAGER' }
      });
      if (existingManager) {
        return res.status(400).json({
          error: `The ${dept} department already has a Manager (${existingManager.name}). Only 1 Manager is allowed per department.`
        });
      }
    }

    const id = await generateEmployeeId(role);
    const hashedPassword = await bcrypt.hash(password, 10);
    const annual = Math.max(0, roundToOneDecimal(parseFloat(allowedAnnual ?? 14)));
    const casual = Math.max(0, roundToOneDecimal(parseFloat(allowedCasual ?? 7)));

    const newUser = await prisma.employee.create({
      data: {
        id,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role,
        dept,
        allowedAnnual: annual,
        remainingAnnual: annual,
        allowedCasual: casual,
        remainingCasual: casual,
        shortLeavesTaken: 0,
        attendanceDate: getTodayString()
      }
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, dept: newUser.dept, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userSafe } = newUser;
    res.status(201).json({ token, user: userSafe });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// 2. Login User (Supports Email or Employee ID)
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter both Email/ID and Password.' });
  }

  try {
    const user = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: identifier.trim().toLowerCase() },
          { id: identifier.trim().toUpperCase() }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please check your credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, dept: user.dept, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ================= EMPLOYEE & HIERARCHY ROUTES =================

// 3. Get All Employees
app.get('/api/employees', async (req, res) => {
  try {
    let employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
    employees = await Promise.all(employees.map(ensureDailyReset));
    const sanitized = employees.map(({ password, ...u }) => u);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. Add Staff Credentials (By HR, Managers, Supervisors, or Admin)
app.post('/api/employees', async (req, res) => {
  const { name, email, password, role, dept, allowedAnnual, allowedCasual, creatorRole, creatorDept } = req.body;

  if (!name || !email || !password || !role || !dept) {
    return res.status(400).json({ error: 'Name, Email, Password, Role, and Department are required.' });
  }

  // Enforce hierarchy permissions when adding staff
  if (creatorRole === 'SUPERVISOR' && (dept !== creatorDept || role !== 'EMPLOYEE')) {
    return res.status(403).json({ error: 'Supervisors can only add Employees to their own department.' });
  }
  if (creatorRole === 'MANAGER' && (dept !== creatorDept || !['SUPERVISOR', 'EMPLOYEE'].includes(role))) {
    return res.status(403).json({ error: 'Managers can only add Supervisors or Employees to their own department.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.employee.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'An employee with this email already exists.' });
    }

    // Rule: Only 1 Manager per department
    if (role === 'MANAGER') {
      const existingManager = await prisma.employee.findFirst({
        where: { dept, role: 'MANAGER' }
      });
      if (existingManager) {
        return res.status(400).json({
          error: `The ${dept} department already has a Manager (${existingManager.name}).`
        });
      }
    }

    const id = await generateEmployeeId(role);
    const hashedPassword = await bcrypt.hash(password, 10);
    const annual = Math.max(0, roundToOneDecimal(parseFloat(allowedAnnual ?? 14)));
    const casual = Math.max(0, roundToOneDecimal(parseFloat(allowedCasual ?? 7)));

    const newEmp = await prisma.employee.create({
      data: {
        id,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role,
        dept,
        allowedAnnual: annual,
        remainingAnnual: annual,
        allowedCasual: casual,
        remainingCasual: casual,
        shortLeavesTaken: 0,
        attendanceDate: getTodayString()
      }
    });

    const { password: _, ...empSafe } = newEmp;
    res.status(201).json(empSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee: ' + error.message });
  }
});

// 5. HR ONLY: Reduce/Update Remaining Leave Counts
app.patch('/api/employees/:id/remaining', async (req, res) => {
  const { id } = req.params;
  const { remainingAnnual, remainingCasual, shortLeavesTaken, requesterRole } = req.body;

  if (requesterRole !== 'HR') {
    return res.status(403).json({ error: 'Only HR is authorized to adjust remaining leave counts.' });
  }

  const data = {};
  if (remainingAnnual !== undefined) data.remainingAnnual = roundToOneDecimal(parseFloat(remainingAnnual) || 0);
  if (remainingCasual !== undefined) data.remainingCasual = roundToOneDecimal(parseFloat(remainingCasual) || 0);
  if (shortLeavesTaken !== undefined) data.shortLeavesTaken = Math.max(0, roundToOneDecimal(parseFloat(shortLeavesTaken) || 0));

  try {
    const updated = await prisma.employee.update({ where: { id }, data });
    const { password: _, ...empSafe } = updated;
    res.json(empSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave balance' });
  }
});

// 6. HR ONLY: Quick Increment Short Leaves (+1)
app.post('/api/employees/:id/increment-short-leave', async (req, res) => {
  const { id } = req.params;
  const { requesterRole } = req.body;

  if (requesterRole !== 'HR') {
    return res.status(403).json({ error: 'Only HR is authorized to increment short leaves.' });
  }

  try {
    let emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    emp = await ensureDailyReset(emp);
    const updated = await prisma.employee.update({
      where: { id },
      data: { shortLeavesTaken: roundToOneDecimal(emp.shortLeavesTaken + 1) }
    });
    const { password: _, ...empSafe } = updated;
    res.json(empSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to increment short leave' });
  }
});

// 7. Mark Daily Attendance (Uses actual Asia/Colombo local time)
app.post('/api/employees/:id/attendance', async (req, res) => {
  const { id } = req.params;
  try {
    let emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    emp = await ensureDailyReset(emp);
    if (emp.presentToday) return res.status(400).json({ error: 'Already marked present today' });

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        presentToday: true,
        presentTime: getCurrentTimeString()
      }
    });
    const { password: _, ...empSafe } = updated;
    res.json(empSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// ================= LEAVE REQUEST & APPROVAL ROUTES =================

// 8. Submit Leave Request (Creates PENDING request with Dates + Supporting Evidence & notifies HR)
app.post('/api/employees/:id/leave-request', async (req, res) => {
  const { id } = req.params;
  const { type, days, startDate, endDate, reason, attachmentName, attachmentData } = req.body;
  const requestedAmount = roundToOneDecimal(parseFloat(days));

  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({ error: 'Requested amount must be at least 0.5.' });
  }

  if (!startDate) {
    return res.status(400).json({ error: 'Please select a leave start date.' });
  }

  try {
    let emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    emp = await ensureDailyReset(emp);
    const selectedType = String(type).toLowerCase();
    const isShort = selectedType.includes('short');

    const computedEndDate = endDate || calculateEndDate(startDate, requestedAmount, isShort);

    let leaveTypeName = 'Annual Leave';
    let currentRemaining = emp.remainingAnnual;
    let exceedsQuota = false;
    let exceededBy = 0;

    if (isShort) {
      leaveTypeName = 'Short Leave';
      currentRemaining = Math.max(0, roundToOneDecimal(MONTHLY_SHORT_LEAVE_LIMIT - emp.shortLeavesTaken));
      if (emp.shortLeavesTaken + requestedAmount > MONTHLY_SHORT_LEAVE_LIMIT) {
        exceedsQuota = true;
        exceededBy = roundToOneDecimal((emp.shortLeavesTaken + requestedAmount) - MONTHLY_SHORT_LEAVE_LIMIT);
      }
    } else if (selectedType.includes('casual')) {
      leaveTypeName = 'Casual Leave';
      currentRemaining = emp.remainingCasual;
      if (requestedAmount > currentRemaining) {
        exceedsQuota = true;
        exceededBy = roundToOneDecimal(requestedAmount - currentRemaining);
      }
    } else {
      leaveTypeName = 'Annual Leave';
      currentRemaining = emp.remainingAnnual;
      if (requestedAmount > currentRemaining) {
        exceedsQuota = true;
        exceededBy = roundToOneDecimal(requestedAmount - currentRemaining);
      }
    }

    // Create Pending Leave Request (HR reduces balance manually)
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        leaveType: leaveTypeName,
        days: requestedAmount,
        startDate,
        endDate: computedEndDate,
        reason: reason || 'No reason provided',
        attachmentName: attachmentName || null,
        attachmentData: attachmentData || null,
        status: 'PENDING',
        exceedsQuota,
        exceededBy
      }
    });

    // Notify HR via Email for every leave requested (including supporting attachment if any)
    const emailResult = await sendLeaveNotificationEmail({
      eventType: 'LEAVE_REQUESTED',
      employee: emp,
      leaveType: leaveTypeName,
      requestedDays: requestedAmount,
      startDate,
      endDate: computedEndDate,
      currentRemaining,
      exceedsQuota,
      exceededBy,
      reason,
      attachmentName,
      attachmentData
    });

    const { password: _, ...empSafe } = emp;
    return res.status(201).json({
      request: leaveRequest,
      exceeded: exceedsQuota,
      employee: empSafe,
      exceededBy,
      requestedDays: requestedAmount,
      startDate,
      endDate: computedEndDate,
      leaveType: leaveTypeName,
      remaining: currentRemaining,
      reason,
      attachmentName: attachmentName || null,
      emailSent: emailResult.success
    });
  } catch (error) {
    console.error('Leave submission error:', error);
    return res.status(500).json({ error: 'Failed to submit leave request: ' + error.message });
  }
});

// 9. Get All Leave Requests (with Employee details)
app.get('/api/leave-requests', async (req, res) => {
  try {
    const requests = await prisma.leaveRequest.findMany({
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            dept: true,
            remainingAnnual: true,
            remainingCasual: true,
            shortLeavesTaken: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// 10. Approve or Reject Leave Request (Supervisors, Managers, Admin) & Notify HR
app.patch('/api/leave-requests/:reqId/status', async (req, res) => {
  const { reqId } = req.params;
  const { status, approverName, approverRole, approverDept } = req.body; // 'APPROVED' | 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const leaveReq = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(reqId, 10) },
      include: { employee: true }
    });

    if (!leaveReq) return res.status(404).json({ error: 'Leave request not found' });

    // Enforce departmental approval hierarchy
    if (['SUPERVISOR', 'MANAGER'].includes(approverRole)) {
      if (leaveReq.employee.dept !== approverDept) {
        return res.status(403).json({ error: 'You can only approve/reject leave requests for your own department.' });
      }
      if (approverRole === 'SUPERVISOR' && leaveReq.employee.role !== 'EMPLOYEE') {
        return res.status(403).json({ error: 'Supervisors can only approve/reject requests from department Employees.' });
      }
    } else if (approverRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Supervisors, Department Managers, or Admin can approve/reject requests.' });
    }

    const updatedReq = await prisma.leaveRequest.update({
      where: { id: parseInt(reqId, 10) },
      data: {
        status,
        approvedBy: `${approverName} (${approverRole})`
      },
      include: { employee: true }
    });

    // Notify HR when approved so HR can manually reduce the employee's remaining balance
    if (status === 'APPROVED') {
      const emp = updatedReq.employee;
      const currentRemaining =
        updatedReq.leaveType === 'Annual Leave' ? emp.remainingAnnual :
        updatedReq.leaveType === 'Casual Leave' ? emp.remainingCasual :
        Math.max(0, MONTHLY_SHORT_LEAVE_LIMIT - emp.shortLeavesTaken);

      await sendLeaveNotificationEmail({
        eventType: 'LEAVE_APPROVED',
        employee: emp,
        leaveType: updatedReq.leaveType,
        requestedDays: updatedReq.days,
        startDate: updatedReq.startDate,
        endDate: updatedReq.endDate,
        currentRemaining,
        exceedsQuota: updatedReq.exceedsQuota,
        exceededBy: updatedReq.exceededBy,
        reason: updatedReq.reason,
        attachmentName: updatedReq.attachmentName,
        attachmentData: updatedReq.attachmentData,
        approvedBy: `${approverName} (${approverRole})`
      });
    }

    res.json(updatedReq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave request status: ' + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Leave Management System API running on port ${PORT}`));