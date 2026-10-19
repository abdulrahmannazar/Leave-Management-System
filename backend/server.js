const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendLeaveBreachEmail } = require('./notification');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'leavecore_super_secret_jwt_key_2026';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const getTodayString = () => new Date().toISOString().split('T')[0];
const roundToOneDecimal = (num) => Math.round(num * 10) / 10;
const MONTHLY_SHORT_LEAVE_LIMIT = 2;

// Auto-seed default accounts on server boot
const seedDefaultUsers = async () => {
  try {
    const count = await prisma.employee.count();
    if (count === 0) {
      console.log('🌱 Seeding initial role-based users...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const today = getTodayString();

      const defaultUsers = [
        { id: 'HR001', name: 'Sarah Connor', email: 'hr@company.com', password: hashedPassword, role: 'HR', dept: 'Human Resources', allowedAnnual: 14, remainingAnnual: 14, allowedCasual: 7, remainingCasual: 7, shortLeavesTaken: 0, attendanceDate: today },
        { id: 'MGR001', name: 'Alex Henderson', email: 'manager@company.com', password: hashedPassword, role: 'MANAGER', dept: 'Operations', allowedAnnual: 14, remainingAnnual: 12, allowedCasual: 7, remainingCasual: 6, shortLeavesTaken: 0, attendanceDate: today },
        { id: 'SUP001', name: 'Daniel Craig', email: 'supervisor@company.com', password: hashedPassword, role: 'SUPERVISOR', dept: 'Engineering', allowedAnnual: 14, remainingAnnual: 10, allowedCasual: 7, remainingCasual: 5, shortLeavesTaken: 1, attendanceDate: today },
        { id: 'EMP001', name: 'Musharif Khan', email: 'musharif@company.com', password: hashedPassword, role: 'EMPLOYEE', dept: 'Tax & Compliance', allowedAnnual: 14, remainingAnnual: 2, allowedCasual: 7, remainingCasual: 1, shortLeavesTaken: 0, attendanceDate: today }
      ];

      for (const u of defaultUsers) {
        await prisma.employee.create({ data: u });
      }
      console.log('✅ Default users seeded successfully.');
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  }
};
seedDefaultUsers();

// Middleware: Reset daily attendance and monthly short leaves
const ensureDailyReset = async (emp) => {
  const today = getTodayString();
  const currentMonth = today.slice(0, 7);
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

// ================= AUTH ROUTES =================

// 1. User Login (Role-based)
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body; // Accepts email OR employee ID
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter both Email/Employee ID and Password.' });
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
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 2. Fetch all employees
app.get('/api/employees', async (req, res) => {
  try {
    let employees = await prisma.employee.findMany({ orderBy: { id: 'asc' } });
    employees = await Promise.all(employees.map(ensureDailyReset));
    const sanitized = employees.map(({ password, ...u }) => u);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Add Employee
app.post('/api/employees', async (req, res) => {
  const { name, email, dept, role, password, allowedAnnual, allowedCasual } = req.body;
  const annual = Math.max(0, roundToOneDecimal(parseFloat(allowedAnnual) || 0));
  const casual = Math.max(0, roundToOneDecimal(parseFloat(allowedCasual) || 0));

  try {
    const count = await prisma.employee.count();
    const prefix = role === 'HR' ? 'HR' : role === 'MANAGER' ? 'MGR' : role === 'SUPERVISOR' ? 'SUP' : 'EMP';
    const id = `${prefix}${String(count + 1).padStart(3, '0')}`;
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);

    const newEmp = await prisma.employee.create({
      data: {
        id,
        name,
        email: email ? email.trim().toLowerCase() : `${id.toLowerCase()}@company.com`,
        password: hashedPassword,
        role: role || 'EMPLOYEE',
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

// 4. Update Remaining Leaves or Short Leaves
app.patch('/api/employees/:id/remaining', async (req, res) => {
  const { id } = req.params;
  const { remainingAnnual, remainingCasual, shortLeavesTaken } = req.body;

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

// 5. Quick Increment Short Leaves
app.post('/api/employees/:id/increment-short-leave', async (req, res) => {
  const { id } = req.params;
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

// 6. Mark Daily Attendance
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
        presentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    });
    const { password: _, ...empSafe } = updated;
    res.json(empSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// 7. Submit Leave Request & Enforce Quotas
app.post('/api/employees/:id/leave-request', async (req, res) => {
  const { id } = req.params;
  const { type, days, reason } = req.body;
  const requestedAmount = roundToOneDecimal(parseFloat(days));

  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({ error: 'Requested amount must be at least 0.5.' });
  }

  try {
    let emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    emp = await ensureDailyReset(emp);
    const selectedType = String(type).toLowerCase();

    // Short Leave Evaluation
    if (selectedType.includes('short')) {
      const currentTaken = emp.shortLeavesTaken;
      const remainingShort = Math.max(0, roundToOneDecimal(MONTHLY_SHORT_LEAVE_LIMIT - currentTaken));

      if (currentTaken + requestedAmount > MONTHLY_SHORT_LEAVE_LIMIT) {
        const exceededBy = roundToOneDecimal((currentTaken + requestedAmount) - MONTHLY_SHORT_LEAVE_LIMIT);

        const emailResult = await sendLeaveBreachEmail({
          employee: emp,
          leaveType: 'Short Leave (Monthly Limit: 2)',
          requestedDays: requestedAmount,
          currentRemaining: remainingShort,
          exceededBy,
          reason
        });

        const { password: _, ...empSafe } = emp;
        return res.status(200).json({
          exceeded: true,
          employee: empSafe,
          exceededBy,
          requestedDays: requestedAmount,
          leaveType: 'Short Leave',
          remaining: remainingShort,
          reason,
          emailSent: emailResult.success
        });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: { shortLeavesTaken: roundToOneDecimal(currentTaken + requestedAmount) }
      });
      const { password: _, ...empSafe } = updated;
      return res.json({ exceeded: false, employee: empSafe });
    }

    // Annual / Casual Leave Evaluation
    const isAnnual = selectedType.includes('annual');
    const remainingField = isAnnual ? 'remainingAnnual' : 'remainingCasual';
    const leaveTypeName = isAnnual ? 'Annual Leave' : 'Casual Leave';
    const currentRemaining = emp[remainingField];

    if (requestedAmount > currentRemaining) {
      const exceededBy = roundToOneDecimal(requestedAmount - currentRemaining);

      const emailResult = await sendLeaveBreachEmail({
        employee: emp,
        leaveType: leaveTypeName,
        requestedDays: requestedAmount,
        currentRemaining,
        exceededBy,
        reason
      });

      const { password: _, ...empSafe } = emp;
      return res.status(200).json({
        exceeded: true,
        employee: empSafe,
        exceededBy,
        requestedDays: requestedAmount,
        leaveType: leaveTypeName,
        remaining: currentRemaining,
        reason,
        emailSent: emailResult.success
      });
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { [remainingField]: roundToOneDecimal(currentRemaining - requestedAmount) }
    });
    const { password: _, ...empSafe } = updated;
    return res.json({ exceeded: false, employee: empSafe });
  } catch (error) {
    console.error('Leave processing error:', error);
    return res.status(500).json({ error: 'Failed to process leave: ' + error.message });
  }
});

// 8. Force Approve Leave Overdraft
app.post('/api/employees/:id/force-approve', async (req, res) => {
  const { id } = req.params;
  const { type, days } = req.body;

  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    const selectedType = String(type).toLowerCase();
    let updateData = {};

    if (selectedType.includes('short')) {
      updateData = { shortLeavesTaken: roundToOneDecimal(emp.shortLeavesTaken + parseFloat(days)) };
    } else if (selectedType.includes('annual')) {
      updateData = { remainingAnnual: roundToOneDecimal(emp.remainingAnnual - parseFloat(days)) };
    } else {
      updateData = { remainingCasual: roundToOneDecimal(emp.remainingCasual - parseFloat(days)) };
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData
    });
    const { password: _, ...empSafe } = updated;
    res.json({ success: true, employee: empSafe });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply exception' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`LeaveCore API Server running on port ${PORT}`));