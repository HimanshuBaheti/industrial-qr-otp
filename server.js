const db = require('./db');

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Basic test route
app.get('/', (req, res) => {
  res.send(`
    <h1>Industrial QR OTP Server</h1>
    <p>Server is running! Go to <a href="/lead-form">/lead-form</a> to test the lead capture page.</p>
  `);
});

// Serve lead form (we'll create this next)
app.get('/lead-form', (req, res) => {
  res.send(`
    <h2>Lead Capture Form (Coming Soon)</h2>
    <p>Lead form will be created in Step 4.</p>
  `);
});

const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// In-memory leads store (simple placeholder, replace with DB later)
const leads = {};

// Send OTP endpoint
app.post('/api/send-otp', async (req, res) => {
  const { name, phone, catalogCode} = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }

  const normalizedPhone = `+${phone.replace(/\D/g, '')}`;

  try {

    // Save lead info (in memory, optional)
leads[normalizedPhone] = { name, phone: normalizedPhone, verified: false };

// Also save in DB (if same phone exists, we can just insert another row or ignore)
db.run(
  'INSERT INTO leads (name, phone, catalog_code) VALUES (?, ?, ?)',
  [name, normalizedPhone, catalogCode || null],
  (err) => {
    if (err) {
      console.error('DB insert lead error:', err.message);
    } else {
      console.log('Lead stored in DB for', normalizedPhone);
    }
  }
);


    // Send OTP via Twilio Verify
    const verification = await twilioClient.verify.v2
      .services(process.env.VERIFY_SERVICE_SID)
      .verifications.create({
        to: normalizedPhone,
        channel: 'sms',
      });

    console.log('Twilio OTP sent:', verification.sid);

    return res.json({ success: true });
  } catch (error) {
    console.error('Send OTP error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP endpoint
app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
  }

  const normalizedPhone = `+${phone.replace(/\D/g, '')}`;

  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: normalizedPhone,
        code: otp,
      });

    console.log('Verification status:', verificationCheck.status);

    if (verificationCheck.status === 'approved') {
      if (leads[normalizedPhone]) {
        leads[normalizedPhone].verified = true;
      }
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Verify OTP error:', error.message);
    return res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

app.get('/catalog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catalog.html'));
});

app.get('/api/export-leads', (req, res) => {
  const XLSX = require('xlsx');

  db.all('SELECT id, name, phone, catalog_code, created_at FROM leads', (err, rows) => {
    if (err) {
      console.error('DB query error:', err.message);
      return res.status(500).json({ success: false, message: 'Error fetching leads' });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No leads to export' });
    }

    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // id
        { wch: 20 },  // name
        { wch: 15 },  // phone
        { wch: 20 },  // catalog_code
        { wch: 20 }   // created_at
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

      // Generate filename
      const filename = `leads_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write to response
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);
    } catch (error) {
      console.error('Export error:', error.message);
      res.status(500).json({ success: false, message: 'Error exporting leads' });
    }
  });
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});


// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📱 Lead form: http://localhost:${port}/lead-form`);
  console.log(`📥 Export leads: http://localhost:${port}/api/export-leads`);
  console.log(`📚 Catalog page : http://localhost:${port}/catalog `);
  console.log(`🔒 Privacy Policy: http://localhost:${port}/privacy-policy`);
  console.log(`📄 Terms & Conditions: http://localhost:${port}/terms`);
});
