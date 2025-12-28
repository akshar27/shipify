# Shipify 🚚📦
Crowdsourced Package Delivery Platform

Shipify is a full-stack marketplace that connects travelers with users who need items delivered securely and efficiently. The platform focuses on trust, scalability, and real-world delivery constraints such as size, weight, verification, and communication.

---

## 🚀 Features

- User authentication with role-based access (Sender / Traveler / Admin)
- Identity verification & document approval workflow
- Trip-based package matching with filters (size, weight)
- Real-time in-app messaging between matched users
- Delivery lifecycle tracking (Requested → Accepted → In Transit → Delivered)
- Admin dashboard for user verification, delivery monitoring, and moderation

---

## 🧠 System Architecture

- Frontend: React + Tailwind for responsive UI
- Backend: Node.js + Express with REST APIs
- Database: PostgreSQL with Prisma ORM
- Real-Time: WebSockets for chat and delivery updates
- Auth & Security:
  - JWT-based authentication
  - Role-based access control (RBAC)
- Infrastructure:
  - Dockerized services
  - Deployed on AWS (EC2 / RDS)
  
