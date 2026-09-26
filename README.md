# SINFO

> **One platform for knowledge, people, performance, and retail analytics.**

SINFO is a modern modular corporate platform designed for the **SluhaVka retail network**.

The system brings together internal knowledge, employee testing, user management, sales analytics, data synchronization, notifications, and administration into a single ecosystem.

SINFO is initially being developed for SluhaVka, with the architecture designed to potentially evolve into a standalone SaaS product for other retail businesses.

---

## 🚀 Overview

SINFO is built around the idea of a single internal workspace where employees and managers can access everything they need without switching between multiple systems.

The platform combines:

- 📚 Knowledge management
- 🧪 Employee testing
- 👤 Employee profiles
- 📊 Sales analytics
- 🏪 Store and regional management
- 🔄 Automated data synchronization
- 🔔 Internal notifications
- 🛠️ Administration
- 🤖 AI-assisted content and testing
- 📈 Management dashboards

The system follows a **modular monolith** architecture, allowing new modules to be added without turning the project into a collection of disconnected applications.

---

# ✨ Core Modules

## 📚 Knowledge Base

The Knowledge Base combines internal instructions and working materials into one system.

It supports:

- Instructions
- Working documents
- Company policies
- Procedures
- Conditions and rules
- News and updates
- Categories
- Subcategories
- Search
- Rich content editing
- File attachments
- Images
- HTML embeds
- Comments
- Content management

The goal is to make company knowledge easy to find and maintain.

---

## 🧪 Testing

The Testing module provides standardized tests for sales employees.

### Current concept

- 20 questions per test
- 25–30 minute time limit
- 80% passing score
- Maximum 2 attempts
- Randomized questions
- Randomized answer options
- Question bank
- Multiple question types
- Deadline support
- Results displayed after completion
- Detailed answers available only to managers and administrators

Supported question types:

- Single choice
- Multiple choice
- Matching
- Numeric input
- Text input

The system is designed so that AI can eventually assist managers with generating tests from:

- Frequently asked questions
- Common employee mistakes
- Customer problems
- New company instructions
- Knowledge Base content

---

## 👤 User Profiles

Every employee has a personal profile containing:

- Full name
- Role
- Region
- City
- Store
- Account status
- Testing activity
- Learning activity
- Personal statistics
- Performance-related information available to the user

Profiles use initials instead of uploaded photos to keep the system lightweight and avoid unnecessary media storage.

The system also supports company-wide employee rankings for testing performance.

---

## 📊 Sales Analytics

Sales Analytics provides managers and administrators with centralized information about store performance.

The system is designed to work with:

- Sales plans
- Actual sales
- Mobile phone sales
- Accessories
- Services
- Warranty
- Daily performance
- Monthly performance
- Forecasts
- Efficiency metrics
- Store comparisons
- Alerts
- Management dashboards

Analytics are calculated from normalized data stored inside the SINFO database.

The frontend and Telegram bot use the same analytics layer instead of implementing separate calculation logic.

---

## 🔄 Data Synchronization

SINFO currently integrates with Google Sheets used by individual stores.

The new architecture removes hardcoded spreadsheet mappings from the application code.

Instead:

```text
Google Sheets
      ↓
Data Sync
      ↓
Mapping
      ↓
Normalization
      ↓
Validation
      ↓
Database
      ↓
Analytics
````

This allows different stores to use different spreadsheet structures without requiring changes to the source code.

### Data Sync provides:

* Google Sheets integration
* Store data sources
* Configurable mappings
* Automatic synchronization
* Manual synchronization
* Data normalization
* Validation
* Retry mechanisms
* Sync history
* Error logging
* Database storage

The long-term goal is to make the data layer extensible to other sources such as APIs, CSV, Excel, and other systems.

---

# 🏪 Organization Structure

SINFO uses a hierarchical organizational structure:

```text
Region
   ↓
City
   ↓
Store
   ↓
User
```

A store contains information such as:

* Name
* Region
* City
* Address
* Status
* Regional manager
* Brand / format
* Google Sheets ID

The system is designed to support multiple brands and store formats.

Example:

```text
Region
 └── City
      └── Store
           ├── SluhaVka
           ├── luxIT
           ├── Express
           ├── lifecell
           └── Kyivstar
```

---

# 🔐 Roles & Access Control

SINFO uses role-based and organizational access control.

Current roles include:

* Guest
* Intern
* Salesperson
* Regional Manager
* CEO
* Administrator

Access can depend on:

* Role
* Region
* Store
* Module
* Administrative permissions

The permission system is designed to be configurable through the administration panel instead of being completely hardcoded.

---

# 🛠️ Administration

The administration panel provides centralized control over the platform.

Planned administration areas include:

* Users
* Roles
* Permissions
* Regions
* Cities
* Stores
* Brands
* Knowledge Base
* Categories
* Testing
* Sales data
* Data synchronization
* Notifications
* System settings
* Audit logs

The administration system is designed to allow the platform to grow without requiring developers to manually modify basic organizational structures.

---

# 🔔 Notifications

SINFO includes an internal notification system.

Initially notifications are displayed directly inside the web application.

Possible future integration:

```text
SINFO
  ↓
Notifications
  ├── Web
  └── Telegram
```

Telegram notifications are intentionally not part of the initial notification architecture.

---

# 🤖 AI Integration

AI is planned as an extension of the platform rather than a separate application.

Potential AI use cases include:

* Test generation
* Question generation
* Knowledge Base assistance
* Frequently asked question analysis
* Employee learning recommendations
* Content analysis
* Sales insights
* Automated management summaries
* Future sales assistant functionality

One of the planned concepts is an AI-powered assistant that can analyze common salesperson problems and create relevant learning and testing materials.

---

# 🏗️ Architecture

SINFO follows a **Modular Monolith** architecture.

The goal is to keep the system as one deployable application while maintaining clear boundaries between domains.

High-level architecture:

```text
                    ┌─────────────────────┐
                    │      Frontend       │
                    │   React / TypeScript│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Backend       │
                    │    API / Services   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
     Knowledge Base        Testing             Sales Analytics
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                               ▼
                         Core / Database
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
           Data Sync       Notifications    Integrations
                │
                ▼
          Google Sheets
```

The architecture is designed around domain boundaries rather than individual pages.

---

# 💻 Technology

The original SINFO implementation was based on Python/Flask.

The project is currently being redesigned and migrated toward a more modern architecture.

### Planned stack

**Frontend**

* React
* TypeScript
* Modern component architecture
* SCSS / CSS
* Responsive UI

**Backend**

* Modern API-based architecture
* Modular services
* Authentication & authorization
* REST / API communication

**Database**

* PostgreSQL
* SQLite for local development where appropriate

**Infrastructure**

* Docker
* Nginx
* Linux VPS
* CI/CD

**Integrations**

* Google Sheets
* Telegram Bot
* AI services

The exact technologies and versions may evolve during development.

---

# 🎨 Design

The interface takes inspiration from products such as:

* Notion
* Coda
* Confluence

The goal is to create a clean workspace rather than a traditional corporate portal.

Design principles:

* Minimalistic UI
* Clear hierarchy
* Fast navigation
* Responsive layout
* Light / dark themes
* Modular components
* Consistent design system
* Information density without visual overload

Primary brand accent:

```text
#FF6B00
```

---

# 📱 Responsive Design

SINFO is designed to work across:

* Desktop
* Laptop
* Tablet
* Mobile

The navigation system includes a responsive sidebar and mobile navigation.

---

# 📁 Project Structure

The final project structure will follow the modular architecture.

A simplified example:

```text
sinfo/
│
├── apps/
│   ├── web/
│   └── api/
│
├── modules/
│   ├── core/
│   ├── knowledge/
│   ├── testing/
│   ├── profiles/
│   ├── sales/
│   ├── data-sync/
│   ├── notifications/
│   └── admin/
│
├── infrastructure/
│
├── docs/
│
├── scripts/
│
└── README.md
```

The exact structure may change during implementation.

---

# 📖 Documentation

Project architecture and requirements are documented separately to keep the main README concise.

Current documentation includes:

* `KNOWLEDGE.md` — Knowledge Base architecture and requirements
* `TESTING.md` — Testing system
* `DATA_SYNC.md` — Data synchronization architecture
* `PROFILE.md` — User profile system
* `ADMIN.md` — Administration system

Additional documentation will be added as new modules are designed.

---

# 🗺️ Roadmap

## Phase 1 — Core

* [x] Project architecture
* [x] User model
* [x] Roles
* [x] Regions
* [x] Cities
* [x] Stores
* [ ] Permissions system
* [ ] Authentication

## Phase 2 — Knowledge Base

* [ ] Instructions
* [ ] Materials
* [ ] Categories
* [ ] Search
* [ ] Rich text editor
* [ ] File attachments
* [ ] Comments
* [ ] HTML embeds
* [ ] Content management

## Phase 3 — Testing

* [ ] Test creation
* [ ] Question bank
* [ ] Multiple question types
* [ ] Randomization
* [ ] Timer
* [ ] Attempts
* [ ] Results
* [ ] Manager analytics
* [ ] Testing rankings

## Phase 4 — Data Sync

* [ ] Google Sheets connector
* [ ] Data sources
* [ ] Configurable mappings
* [ ] Automatic synchronization
* [ ] Validation
* [ ] Sync history
* [ ] Error handling
* [ ] Database storage

## Phase 5 — Sales Analytics

* [ ] Sales dashboard
* [ ] Store performance
* [ ] Plan execution
* [ ] Efficiency
* [ ] Forecasts
* [ ] Comparisons
* [ ] Alerts
* [ ] Regional analytics

## Phase 6 — Administration

* [ ] User management
* [ ] Store management
* [ ] Role management
* [ ] Permission management
* [ ] Content management
* [ ] Testing management
* [ ] Data synchronization
* [ ] Audit logs

## Phase 7 — Integrations

* [ ] Telegram Bot integration
* [ ] AI test generation
* [ ] AI assistant
* [ ] Automated reports
* [ ] Additional data sources

---

# 🔒 Security

Security is a core part of the platform.

The system is designed around:

* Role-based access control
* Organizational access boundaries
* Secure authentication
* Server-side authorization
* Environment-based secrets
* Protected integrations
* Audit logs
* No credentials in source code

---

# 📈 Future Vision

SINFO is initially being developed for the SluhaVka retail network.

However, the long-term goal is to build the platform in a way that allows it to become a standalone product for other retail companies.

The potential product could provide:

```text
                    SINFO
                      │
       ┌──────────────┼──────────────┐
       │              │              │
 Knowledge        Employees       Analytics
       │              │              │
       └──────────────┼──────────────┘
                      │
                  Automation
                      │
                     AI
```

The platform is therefore designed not only as an internal corporate portal, but as a potential foundation for a future **retail operations SaaS platform**.

---

# 🤝 Development

SINFO is currently under active development.

The project is being redesigned from an earlier Python/Flask implementation into a modern modular architecture.

Major architectural decisions are documented before implementation to keep development consistent and maintainable.

---

# 📄 License

The project is currently private and intended for internal development.

License information will be added when the project is prepared for public distribution.

```
