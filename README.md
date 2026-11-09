# Industrial QR OTP — Lead Capture & Product Catalogue

A Node.js application for capturing customer enquiries from industrial product QR codes. Visitors enter their details, verify their mobile number using a **Twilio Verify SMS OTP**, and are redirected to a catalogue of industrial products. The system records lead information in **SQLite** and supports exporting leads to Excel.

> **Status:** Functional prototype. The current implementation is not production-ready; see [Limitations and security considerations](#limitations-and-security-considerations).

## Features

- Responsive lead-capture form with name and phone number fields.
- SMS one-time-password sending and verification using Twilio Verify.
- SQLite lead storage, including a catalogue code and creation timestamp.
- Product catalogue for conveyor belts and precision machine parts.
- Downloadable PDF brochures and WhatsApp enquiry links.
- Excel export of stored leads.
- Privacy policy and terms and conditions pages.

## Technology stack

| Component | Technology |
| --- | --- |
| Backend | Node.js, Express 5 |
| Frontend | HTML, CSS, vanilla JavaScript |
| OTP service | Twilio Verify (SMS) |
| Database | SQLite (`sqlite3`) |
| Spreadsheet export | `xlsx` |
| Configuration | `dotenv` |
| Middleware | `cors` |

## How it works

```text
Visitor scans a QR code / opens the lead form
                    |
                    v
         Enters name and phone
                    |
                    v
       POST /api/send-otp
         |              |
         v              v
   SQLite lead       Twilio Verify
     inserted          sends SMS
                         |
                         v
              Visitor enters OTP
                         |
                         v
               POST /api/verify-otp
                         |
                         v
               Twilio approves code
                         |
                         v
                  /catalog
                   /     \
                  v       v
             Brochures  WhatsApp enquiry links
```

**Implementation detail:** A lead is inserted when an OTP is requested, not after it is verified. The OTP approval flag is held in memory and is not saved to the SQLite table.

## Getting started

### Prerequisites

- Node.js and npm
- A Twilio account with a configured Verify Service
- Valid Twilio account credentials and an enabled SMS verification setup

### 1. Clone the repository

```bash
git clone https://github.com/HimanshuBaheti/industrial-qr-otp.git
cd industrial-qr-otp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create `.env` in the project root:

```dotenv
PORT=3000
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
VERIFY_SERVICE_SID=your_twilio_verify_service_sid
```

Never commit real credentials. The repository's `.gitignore` already excludes `.env`, `node_modules`, and `data.db`.

### 4. Start the server

```bash
npm start
```

Open **http://localhost:3000/** to use the form. You can change the port in `.env`.

The SQLite database (`data.db`) and `leads` table are created automatically at startup.

### 5. Test the OTP workflow

1. Enter a name and a phone number that includes the international country code (for example, `919876543210`).
2. Click **Send OTP**. The backend inserts a lead record and requests an SMS through Twilio.
3. Enter the six-digit OTP received by SMS.
4. Click **Verify OTP**. If Twilio approves the code, the browser redirects to `/catalog`.
5. Browse the products, download brochures, or use the WhatsApp enquiry links after configuring a business number.

Twilio trial restrictions and SMS charges may apply.

## API reference

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/send-otp` | Saves lead details and requests an SMS OTP |
| `POST` | `/api/verify-otp` | Validates an OTP with Twilio Verify |
| `GET` | `/api/export-leads` | Downloads leads as an Excel workbook |
| `GET` | `/` | Working lead form (served from `public/index.html`) |
| `GET` | `/catalog` | Product catalogue |
| `GET` | `/lead-form` | Placeholder route, not the working form |
| `GET` | `/privacy-policy` | Privacy policy page |
| `GET` | `/terms` | Terms and conditions |

### Send an OTP

```bash
curl -X POST http://localhost:3000/api/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo User","phone":"919876543210","catalogCode":"CATALOG_MAIN"}'
```

Successful API response:

```json
{"success":true}
```

The server removes non-numeric phone characters and adds a leading `+`. Supply the full international dialling code.

### Verify an OTP

```bash
curl -X POST http://localhost:3000/api/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"919876543210","otp":"123456"}'
```

Replace `123456` with the actual code received by SMS. An approved verification returns `{"success":true}`; an invalid code returns HTTP 400.

### Export leads

```bash
curl -OJ http://localhost:3000/api/export-leads
```

The downloaded workbook is named `leads_YYYY-MM-DD.xlsx` and contains `id`, `name`, `phone`, `catalog_code`, and `created_at`. The API returns HTTP 400 when there are no records.

**Security warning:** `/api/export-leads` has no authentication in the current implementation. Do not expose it publicly when storing real customer data.

## Database

`db.js` creates the following table:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  catalog_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Multiple requests from the same number may produce duplicate lead rows. No verification-status column exists.

## Repository structure

```text
industrial-qr-otp/
├── db.js                         # SQLite initialization
├── server.js                     # Express routes, Twilio OTP, Excel export
├── package.json                  # Scripts and dependencies
├── package-lock.json
├── .gitignore
└── public/
    ├── index.html                # Lead form and OTP verification
    ├── catalog.html              # Industrial product catalogue
    ├── privacy.html              # Privacy policy
    ├── terms.html                # Terms and conditions
    ├── Privacy_Statement.pdf
    └── brochures/
        ├── Conveyor_Belt_Catalog.pdf
        ├── Machine_Parts_Catalog.pdf
        └── Vedant Metals Profile.pdf
```

## Limitations and security considerations

This documentation describes the code as it currently exists:

- **Catalogue access is not enforced server-side.** Anyone can open `/catalog` without completing OTP verification.
- **Verification status is not persisted.** The application only sets a `verified` property in an in-memory object; the SQLite table records lead details but not verification outcomes.
- **WhatsApp sending is not implemented.** The catalogue contains WhatsApp enquiry links, but the backend does not automatically send a WhatsApp message, despite the current UI wording.
- **WhatsApp links need configuration.** Replace the `91YOURBUSINESSNUMBER` placeholders in `public/catalog.html` with a real business number.
- **Lead export has no authentication.** Add administrator authentication and authorization before making the app publicly accessible.
- **Input validation, OTP abuse prevention and rate limiting need improvement.** Production deployment requires safeguards against duplicate requests and SMS abuse.
- **`/lead-form` is a placeholder.** The actual form is available at `/`.
- **Automated tests are not provided.** The existing `npm test` command is a placeholder that exits with an error.

## Potential enhancements

1. Save a verified status and timestamp for each lead; consider qualifying leads only after successful OTP verification.
2. Protect catalogue content using a server-side session after OTP approval.
3. Add secure admin access, pagination and filtering for lead export.
4. Implement rate limiting, robust phone-number validation, and error-handling tests.
5. Replace WhatsApp placeholders and add explicit consent-based messaging if required.
6. Add automated API tests and deployment documentation.

## Privacy

The application collects personal information including names and phone numbers. Before production use, review the privacy policy and terms, establish retention and deletion practices, ensure appropriate consent, and restrict access to exported data.

## Author

Developed by [Himanshu Baheti](https://github.com/HimanshuBaheti).

## License

`package.json` declares the `ISC` license, but there is currently no standalone `LICENSE` file in the repository. Add one to make reuse permissions explicit.
