# PL Head — Invoice Request API (cURL)

Base URL: `http://localhost:3000`  
Role: `PL_HEAD` (`pl:write` to create, `pl:read` to list/view)

---

## 1. Login

```bash
curl -s -c cookies.txt -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"pl@mediend.com","password":"YOUR_PASSWORD"}'
```

Use `-b cookies.txt` on all requests below.

---

## 2. Submit invoice request

**POST** `/api/pl/invoice-requests`

```bash
curl -s -b cookies.txt -X POST "http://localhost:3000/api/pl/invoice-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "YOUR_LEAD_ID",
    "requestRemarks": "Please generate invoice",
    "invoiceNumber": "INV-001",
    "invoiceAmount": 125000
  }'
```

| Field | Required |
|-------|----------|
| `leadId` | Yes |
| `requestRemarks` | No |
| `invoiceNumber` | No |
| `invoiceAmount` | No |

Response: `data.status` = `PENDING`. Finance will verify or reject.

**409** — pending request already exists for this case.

---

## 3. Check request status (optional)

**By case:**

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/pl/invoice-requests?status=PENDING&leadId=YOUR_LEAD_ID"
```

**Verified (with PDF URL + finance remarks):**

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/pl/invoice-requests?status=VERIFIED&leadId=YOUR_LEAD_ID"
```

**Single request:**

```bash
curl -s -b cookies.txt \
  "http://localhost:3000/api/pl/invoice-requests/REQUEST_ID"
```

Use `data.invoicePdfUrl` to open/download the invoice PDF when status is `VERIFIED`.
