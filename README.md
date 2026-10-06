# SchoolSafe - Backend API Server

This is the backend service for **SchoolSafe**, built with Node.js, Express, TypeScript, Prisma ORM, and Socket.IO.

## Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod
- **Real-time:** Socket.IO
- **API Docs:** Swagger UI / OpenAPI 3.0
- **Testing:** Jest + Supertest

## Directory Structure
```text
server/
├── prisma/
│   └── schema.prisma      # PostgreSQL data models & enums
├── src/
│   ├── config/            # Env validation, Prisma singleton, Swagger config
│   ├── middleware/        # Error handlers, Request logging
│   ├── routes/            # REST API route handlers
│   ├── socket/            # Socket.IO connection and event handling
│   ├── app.ts             # Express application setup
│   └── server.ts          # Server entrypoint and lifecycle
├── tests/                 # Unit and integration test suites
├── tsconfig.json          # TypeScript compiler options
└── package.json           # Scripts and dependencies
```

## Getting Started

### 1. Copy Environment Variables
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate Prisma Client
```bash
npm run prisma:generate
```

### 4. Run Development Server
```bash
npm run dev
```

Server endpoints:
- **Base API:** `http://localhost:5000/api`
- **Swagger Documentation:** `http://localhost:5000/api/docs`
- **Health Check:** `http://localhost:5000/api/health`
