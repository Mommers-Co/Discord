# Mommers Co Discord Suite

A secure, scalable, and modular Discord Bot and Admin Panel solution built for internal use at **Mommers Co**.

This system includes:
- 🤖 A TypeScript-based Discord bot
- 🌐 A Nuxt 3-powered admin panel frontend
- 🔧 A Go-based backend API for secure bot management
- 🧠 A PostgreSQL database using Prisma ORM

---

## 🚀 Features

- Modular Discord bot with slash commands
- Full server backup & restore system
- Ticket system with panel integration
- Role-based moderation tools (ban, kick, warn, etc.)
- Reaction roles, welcome message, and verification
- Discord embed manager via web panel
- Real-time Discord console in panel
- Logging system (file, DB, and Discord)
- Server monitoring with graphs on the panel
- OAuth2-authenticated admin panel access

---

## 🧱 Directory Structure

```
mco-discord-suite/
├── apps/
│ ├── discord-bot/ # Discord bot built with TypeScript
│ │ ├── src/
│ │ │ ├── commands/ # Slash commands (tickets, moderation, etc.)
│ │ │ ├── events/ # Discord event handlers
│ │ │ ├── modules/ # Ticket manager, logger, embed updater, etc.
│ │ │ ├── utils/ # Helper functions, Prisma client
│ │ │ ├── config.ts # Bot configuration and constants
│ │ │ └── main.ts # Bot entry point
│ │ ├── prisma/
│ │ │ ├── schema.prisma # PostgreSQL schema
│ │ │ └── migrations/
│ │ ├── .env # Bot secrets
│ │ └── tsconfig.json
│
│ ├── panel/ # Nuxt 3 admin panel frontend
│ │ ├── pages/
│ │ │ ├── index.vue # Dashboard overview
│ │ │ ├── tickets.vue
│ │ │ ├── logs.vue
│ │ │ ├── embeds.vue
│ │ │ ├── console.vue
│ │ │ ├── moderation.vue
│ │ │ └── auth.vue
│ │ ├── components/ # UI components
│ │ ├── plugins/ # Axios, auth, etc.
│ │ ├── layouts/ # Authenticated layouts
│ │ └── nuxt.config.ts
│
│ └── api-server/ # Go backend API for panel
│ ├── cmd/
│ │ └── main.go # Entry point
│ ├── internal/
│ │ ├── handlers/ # HTTP route logic
│ │ ├── services/ # Embed, ticket, moderation logic
│ │ └── middleware/ # Auth, CORS, logging
│ ├── go.mod
│ └── .env
│
├── shared/ # Shared types, constants
│ ├── types/ # TS interfaces and Go DTOs
│ └── constants.ts
│
├── docker/ # Docker & Compose setup
│ ├── Dockerfiles/
│ └── docker-compose.yml
│
├── scripts/ # Init, deploy, setup scripts
│ └── init.sh
│
├── .gitignore
├── package.json
└── README.md
```


---

## ⚙ Tech Stack

| Layer         | Technology                          |
|---------------|--------------------------------------|
| Bot           | TypeScript + Discord.js             |
| Panel Frontend| Nuxt 3 + Nuxt UI + Tailwind         |
| Panel Backend | GoLang (Gin/Fiber) + JWT OAuth      |
| Database      | PostgreSQL + Prisma ORM             |
| Auth          | Discord OAuth2                      |
| Infrastructure| Docker + Docker Compose             |



