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

const ensureDailyReset = async (emp) => {
  const today = getTodayString();
  if (emp.attendanceDate !== today) {
    return await prisma.employee.update({
      where: { id: emp.id },
      data: { attendanceDate: today, presentToday: false, presentTime: null }
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

// 3. Update Remaining Leaves or Short Leaves Taken
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

// 4. Quick Increment Short Leaves (+1)
app.post('/api/employees/:id/increment-short-leave', async (req, res) => {
  const { id } = req.params;
  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

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

// 6. Submit Leave Request & Handle Breach
app.post('/api/employees/:id/leave-request', async (req, res) => {
  const { id } = req.params;
  const { type, days, reason } = req.body;
  const numDays = roundToOneDecimal(parseFloat(days));

  if (isNaN(numDays) || numDays <= 0) {
    return res.status(400).json({ error: 'Requested days must be at least 0.5.' });
  }

  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Robust case-insensitive check
    const isAnnual = String(type).toLowerCase().includes('annual');
    const remainingField = isAnnual ? 'remainingAnnual' : 'remainingCasual';
    const leaveTypeName = isAnnual ? 'Annual Leave' : 'Casual Leave';
    const currentRemaining = emp[remainingField];

    // QUOTA BREACH SENTINEL
    if (numDays > currentRemaining) {
      const exceededBy = roundToOneDecimal(numDays - currentRemaining);

      // Attempt email dispatch asynchronously without throwing
      const emailResult = await sendLeaveBreachEmail({
        employee: emp,
        leaveType: leaveTypeName,
        requestedDays: numDays,
        currentRemaining,
        exceededBy,
        reason
      });

      // Return breach alert to frontend so popup always triggers
      return res.status(200).json({
        exceeded: true,
        employee: emp,
        exceededBy,
        requestedDays: numDays,
        leaveType: leaveTypeName,
        remaining: currentRemaining,
        reason,
        emailSent: emailResult.success
      });
    }

    // Within quota
    const updated = await prisma.employee.update({
      where: { id },
      data: { [remainingField]: roundToOneDecimal(currentRemaining - numDays) }
    });
    return res.json({ exceeded: false, employee: updated });
  } catch (error) {
    console.error('Error processing leave request:', error);
    return res.status(500).json({ error: 'Failed to process leave: ' + error.message });
  }
});

// 7. Force Approve Exceeded Leave
app.post('/api/employees/:id/force-approve', async (req, res) => {
  const { id } = req.params;
  const { type, days } = req.body;

  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    const isAnnual = String(type).toLowerCase().includes('annual');
    const remainingField = isAnnual ? 'remainingAnnual' : 'remainingCasual';

    const updated = await prisma.employee.update({
      where: { id },
      data: { [remainingField]: roundToOneDecimal(emp[remainingField] - parseFloat(days)) }
    });
    res.json({ success: true, employee: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply exception' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));