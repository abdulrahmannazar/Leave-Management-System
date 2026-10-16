const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const app = express();
const prisma = new PrismaClient();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

const getTodayString = () => new Date().toISOString().split('T')[0];
const roundToOneDecimal = (num) => Math.round(num * 10) / 10;

// Setup Mailer for Breach Notifications
let transporter;
nodemailer.createTestAccount().then((account) => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('Automated Notification Mailer is active');
});

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

// 2. Add Employee (Allowed leaves locked at onboarding, shortLeavesTaken starts at 0)
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

// 3. Update Remaining Leaves or Short Leaves Taken directly
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

// 6. Submit Leave Request & Dispatch Alert on Limit Breach
app.post('/api/employees/:id/leave-request', async (req, res) => {
  const { id } = req.params;
  const { type, days, reason } = req.body; // 'annual' | 'casual'
  const numDays = roundToOneDecimal(parseFloat(days));

  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const isAnnual = type === 'annual';
    const remainingField = isAnnual ? 'remainingAnnual' : 'remainingCasual';
    const leaveTypeName = isAnnual ? 'Annual Leave' : 'Casual Leave';
    const currentRemaining = emp[remainingField];

    // QUOTA BREACH SENTINEL: Triggers Email & Popup Flag
    if (numDays > currentRemaining) {
      const exceededBy = roundToOneDecimal(numDays - currentRemaining);

      const mailOptions = {
        from: '"LeaveCore Alert System" <no-reply@company.com>',
        to: 'hr@company.com, admin@company.com',
        subject: `🚨 URGENT: Leave Quota Exceeded by ${emp.name} (${emp.id})`,
        text: `Employee Alert:
Employee: ${emp.name} (${emp.id}) - ${emp.dept}
Leave Type: ${leaveTypeName}
Requested: ${numDays}
Remaining Balance: ${currentRemaining}
Exceeded By: ${exceededBy}
Reason: ${reason || 'None provided'}

An automated popup alert has also been displayed on the portal.`
      };

      if (transporter) {
        const info = await transporter.sendMail(mailOptions);
        console.log('Breach email dispatched to HR & Admin! Preview:', nodemailer.getTestMessageUrl(info));
      }

      return res.status(200).json({
        exceeded: true,
        employee: emp,
        exceededBy,
        requestedDays: numDays,
        leaveType: leaveTypeName,
        remaining: currentRemaining,
        reason
      });
    }

    // Within quota
    const updated = await prisma.employee.update({
      where: { id },
      data: { [remainingField]: roundToOneDecimal(currentRemaining - numDays) }
    });
    res.json({ exceeded: false, employee: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process leave request' });
  }
});

// 7. Force Approve Exceeded Leave
app.post('/api/employees/:id/force-approve', async (req, res) => {
  const { id } = req.params;
  const { type, days } = req.body;

  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    const remainingField = type.toLowerCase().includes('annual') ? 'remainingAnnual' : 'remainingCasual';

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