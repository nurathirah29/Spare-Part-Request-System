# Spare Part Request System

A Flask-based web application for managing spare part requisition requests at the kiosk level. Employees can submit part requests via a self-service interface, while admins review, approve, and track transactions through an admin dashboard. Live stock data is pulled from an MSSQL inventory system.

---

## Features

- **Employee kiosk** — Self-service interface for browsing and requesting spare parts
- **Admin dashboard** — Review, approve, update, and cancel transactions
- **Dual database architecture** — MySQL for application data, MSSQL (`ER`) for live inventory stock levels (`on_hand_qty`)
- **Item management** — Add, update, and delete items with image upload support
- **Transaction workflow** — Submit → Pending → Approve / On Hold / Cancel
- **Email notifications** — Automated approval email sent to the relevant department upon transaction approval
- **Daily & custom reports** — Dedicated report views for transaction history
- **Image upload** — Auto-numbered item images stored locally (`static/images/`)
- **CORS enabled** — Supports cross-origin requests for frontend integration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Primary Database | MySQL (`mysql-connector-python`) |
| Inventory Database | Microsoft SQL Server (`pytds`) |
| Frontend | HTML, JavaScript |
| Email | SMTP via `smtplib` |
| File Handling | Werkzeug |
| CORS | `flask-cors` |

---

## Database Schema

The application uses two separate databases:

### MySQL — `kiosk_db`

| Table | Description |
|---|---|
| `employee` | Employee records (`emp_id`, `emp_name`, `emp_dept`) |
| `department` | Department list (`dept_id`, `dept_name`) |
| `item` | Spare part catalogue (`catalog_number`, `item_name`, `category`, `unit_uom`, `item_image`) |
| `transactions` | Request header (`transaction_id`, `emp_id`, `status`, `remark`, `transaction_date`) |
| `transaction_detail` | Request line items (`transaction_id`, `catalog_number`, `quantity`, `dept_id`, `item_status`) |

### MSSQL — `IBAS_ERLIVE`

| Table | Field Used | Description |
|---|---|---|
| `INV_INVENTORY_MASTER_FILE` | `ON_HAND_QTY` | Live stock quantity per catalog number |

---

## User Roles

| Role | Access |
|---|---|
| Employee | Submit spare part requests via kiosk (`/`) |
| Admin | Full access to transaction management, item management, and reports (`/admin`) |

---

## Transaction Workflow

```
Employee submits request
         ↓
  Status: Pending
         ↓
Admin reviews in dashboard
         ↓
  Approve → email sent to department
  On Hold → awaiting further action
  Cancel  → request voided
```

Transaction IDs are auto-generated in the format: `YYMMDD-DEPT-NNN`  
Example: `260626-AD-001`

---

## Key API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/employee/<emp_id>` | Get employee details |
| GET | `/api/items` | List items (with search, category filter, pagination, stock qty) |
| GET | `/api/item/<catalog_number>` | Get single item with live stock qty |
| PUT | `/api/item/<catalog_number>` | Update item details and image |
| DELETE | `/api/item/<catalog_number>` | Delete item |
| POST | `/add_item` | Add new item with optional image |
| POST | `/api/transaction` | Submit a new spare part request |
| GET | `/api/admin/transactions` | List all transactions (with filters and pagination) |
| GET | `/api/admin/transactions/<id>` | Get transaction detail with live stock qty |
| PUT | `/api/admin/update_transaction/<id>` | Update transaction status and line items |
| GET | `/api/admin/daily_transactions` | Get transactions for a specific date |
| GET | `/api/departments` | List all departments |
| POST | `/approve_transaction` | Manually trigger approval and email |

---

## Key Routes (Web Pages)

| Route | Description |
|---|---|
| `/` | Employee kiosk (spare part request form) |
| `/login` | Admin login |
| `/admin` | Admin dashboard |
| `/manage_item` | Item catalogue management |
| `/daily_report` | Daily transaction report view |
| `/custom_report` | Custom date range report view |
| `/routes` | Debug: list all registered routes |

---

## License

Nur Athirah
