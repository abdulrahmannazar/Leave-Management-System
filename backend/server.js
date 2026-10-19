const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { sendLeaveBreachEmail } = require('./notification');

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const getTodayString = () => new Date().toISOString().split('T')[0];
const roundToOneDecimal = (num) => Math.round(num * 10) / 10;

// Monthly limit policy
const MONTHLY_SHORT_LEAVE_LIMIT = 2;

// Daily attendance & monthly short leave quota reset helper
const ensureDailyReset = async (emp) => {
  const today = getTodayString();
  const currentMonth = today.slice(0, 7); // 'YYYY-MM'
  const empMonth = emp.attendanceDate ? emp.attendanceDate.slice(0, 7) : currentMonth;

  const updateData = {};

  // Daily reset for attendance
  if (emp.attendanceDate !== today) {
    updateData.attendanceDate = today;
    updateData.presentToday = false;
    updateData.presentTime = null;
  }

  // Monthly reset for short leaves (new calendar month)
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

// 1. Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    let employees = await prisma.employee.findMany({ orderBy: { id: 'asc' } });
    employees = await Promise.all(employees.map(ensureDailyReset));
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Add Employee
app.post('/api/employees', async (req, res) => {
  const { name, dept, allowedAnnual, allowedCasual } = req.body;
  const annual = Math.max(0, roundToOneDecimal(parseFloat(allowedAnnual) || 0));
  const casual = Math.max(0, roundToOneDecimal(parseFloat(allowedCasual) || 0));

  try {
    const count = await prisma.employee.count();
    const id = `EMP${String(count + 1).padStart(3, '0')}`;

    const newEmp = await prisma.employee.create({
      data: {
        id,
        name,
        dept,
        allowedAnnual: annual,
        remainingAnnual: annual,
        allowedCasual: casual,
        remainingCasual: casual,
        shortLeavesTaken: 0,
        attendanceDate: getTodayString()
      }
    });
    res.status(201).json(newEmp);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// 3. Update Remaining Leaves or Short Leaves Taken directly by HR
app.patch('/api/employees/:id/remaining', async (req, res) => {
  const { id } = req.params;
  const { remainingAnnual, remainingCasual, shortLeavesTaken } = req.body;

  const data = {};
  if (remainingAnnual !== undefined) data.remainingAnnual = roundToOneDecimal(parseFloat(remainingAnnual) || 0);
  if (remainingCasual !== undefined) data.remainingCasual = roundToOneDecimal(parseFloat(remainingCasual) || 0);
  if (shortLeavesTaken !== undefined) data.shortLeavesTaken = Math.max(0, roundToOneDecimal(parseFloat(shortLeavesTaken) || 0));

  try {
    const updated = await prisma.employee.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave balance' });
  }
});

// 4. Quick Increment Short Leaves (+1 by HR)
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
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to increment short leave' });
  }
});

// 5. Mark Daily Attendance
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
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// 6. Submit Leave Request & Enforce Quotas (Annual, Casual, Short Leave)
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

    // ---------------- SHORT LEAVE EVALUATION (Max 2 per month) ----------------
    if (selectedType.includes('short')) {
      const currentTaken = emp.shortLeavesTaken;
      const remainingShort = Math.max(0, roundToOneDecimal(MONTHLY_SHORT_LEAVE_LIMIT - currentTaken));

      if (currentTaken + requestedAmount > MONTHLY_SHORT_LEAVE_LIMIT) {
        const exceededBy = roundToOneDecimal((currentTaken + requestedAmount) - MONTHLY_SHORT_LEAVE_LIMIT);

        const emailResult = await sendLeaveBreachEmail({
          employee: emp,
          leaveType: 'Short Leave (Monthly Cap: 2)',
          requestedDays: requestedAmount,
          currentRemaining: remainingShort,
          exceededBy,
          reason
        });

        return res.status(200).json({
          exceeded: true,
          employee: emp,
          exceededBy,
          requestedDays: requestedAmount,
          leaveType: 'Short Leave',
          remaining: remainingShort,
          reason,
          emailSent: emailResult.success
        });
      }

      // Within monthly quota -> increment short leaves taken
      const updated = await prisma.employee.update({
        where: { id },
        data: { shortLeavesTaken: roundToOneDecimal(currentTaken + requestedAmount) }
      });
      return res.json({ exceeded: false, employee: updated });
    }

    // ---------------- ANNUAL / CASUAL LEAVE EVALUATION ----------------
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

      return res.status(200).json({
        exceeded: true,
        employee: emp,
        exceededBy,
        requestedDays: requestedAmount,
        leaveType: leaveTypeName,
        remaining: currentRemaining,
        reason,
        emailSent: emailResult.success
      });
    }

    // Within quota
    const updated = await prisma.employee.update({
      where: { id },
      data: { [remainingField]: roundToOneDecimal(currentRemaining - requestedAmount) }
    });
    return res.json({ exceeded: false, employee: updated });

  } catch (error) {
    console.error('Error processing leave request:', error);
    return res.status(500).json({ error: 'Failed to process leave: ' + error.message });
  }
});

// 7. Force Approve Exceeded Leave (Overdraft)
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
    res.json({ success: true, employee: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply exception' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));