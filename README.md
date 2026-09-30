# Danny E-Commerce API

A fully-functioning e-commerce REST API built with **Node.js**, **Express**, and
**PostgreSQL** — a learning/portfolio project covering the complete lifecycle of
a real backend service: authentication, role-based authorization, relational
data modeling, shopping cart logic, transactional checkout, and interactive API
documentation.

## Features

- **Authentication & Authorization** — registration and login with bcrypt
  password hashing and JWT-based sessions; role-based access control
  distinguishing regular customers from admin accounts
- **Product Catalog** — full CRUD, with write access restricted to admins
- **User Accounts** — view, update, and delete (soft-delete/anonymize) your own
  profile
- **Shopping Cart** — add, update, and remove items, with stock validation and
  automatic quantity merging for duplicate items
- **Checkout** — converts a cart into a real order using a **database
  transaction**, so a failure partway through leaves no partial or inconsistent
  data; snapshots item prices at time of purchase so historical orders are
  never affected by later price changes
- **Orders** — view order history, view a single order's details, and cancel an
  order (which restores product stock, also inside a transaction)
- **Interactive API Documentation** — every endpoint documented with Swagger/
  OpenAPI and testable directly from the browser

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js + Express | Server and routing |
| PostgreSQL + `pg` | Relational database and driver |
| bcrypt | Password hashing |
| jsonwebtoken | Stateless authentication (JWT) |
| swagger-jsdoc + swagger-ui-express | Interactive API documentation |
| dotenv | Environment-based configuration |

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL

### Setup

```bash
git clone <this-repo-url>
cd danny-ecommerce-api
npm install
```

Create a `.env` file in the project root:
```
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecommerce_db
JWT_SECRET=a_long_random_string
```

Create the database and tables (see the schema in `DEVELOPMENT_LOG.md` for the
full `CREATE TABLE` statements), then start the server:

```bash
npm start
```

The API runs on `http://localhost:3000`. Interactive documentation is available
at `http://localhost:3000/api-docs`.

## API Overview

| Resource | Endpoints |
|---|---|
| Auth | `POST /register`, `POST /login` |
| Profile | `GET /profile`, `PUT /profile`, `DELETE /profile` |
| Products | `GET /products`, `GET /products/:id`, `POST /products` *(admin)*, `PUT /products/:id` *(admin)*, `DELETE /products/:id` *(admin)* |
| Cart | `GET /cart`, `POST /cart`, `PUT /cart/:itemId`, `DELETE /cart/:itemId` |
| Checkout | `POST /checkout` |
| Orders | `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` |

Full request/response details, including example payloads, are available in the
interactive Swagger docs once the server is running.

## Design Highlights

A few decisions worth calling out, elaborated further in `DEVELOPMENT_LOG.md`:

- **Database-level integrity over application-level trust** — `CHECK` and
  `UNIQUE` constraints enforce business rules (valid roles, valid order
  statuses, one cart per user) at the database layer, not just in route code.
- **Price snapshotting** — cart items reference live product prices (still
  shopping, nothing final), while order items store a price snapshot taken at
  checkout (a completed order is a historical record and must never change
  retroactively).
- **Ownership verification via joined queries** — cart item and order routes
  join back to their owning user in the same query used to update/delete,
  preventing one user from ever modifying another user's data, even by guessing
  IDs.
- **Soft deletes** — deleting a user account anonymizes personal data rather
  than removing the row outright, preserving order history for accounting
  purposes while fulfilling a deletion request.
- **Transactional checkout and cancellation** — both operations touch multiple
  tables (orders, order items, product stock, cart) and are wrapped in database
  transactions, so a failure partway through rolls back cleanly instead of
  leaving inconsistent data.

## Project Structure

```
.
├── server.js              # Express app, all routes, Swagger config
├── src/
│   ├── db/
│   │   └── index.js       # PostgreSQL connection pool
│   └── middleware/
│       └── auth.js        # JWT verification + admin role checks
├── DEVELOPMENT_LOG.md      # Full build log: decisions, debugging, lessons learned
└── .env                    # Environment config (not committed)
```

## Notes

This project was built as a structured learning exercise, working through REST
API fundamentals, relational database design, and backend security practices
step by step. `DEVELOPMENT_LOG.md` contains a detailed session-by-session record
of the design decisions, bugs encountered, and reasoning behind the
architecture — useful context for anyone curious about the *why* behind the
code, not just the *what*.

A planned refactor (splitting `server.js` into a proper `app.js`/`server.js`
structure, moving routes into `src/routes/` and `src/controllers/`, and
extracting the Swagger configuration into its own file) is noted as a next step
once this version is considered feature-complete.
