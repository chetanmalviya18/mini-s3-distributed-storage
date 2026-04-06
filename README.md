# 🚀 Mini S3 - Distributed File Storage (Backend)

## 🧠 Overview

This backend system implements a **Distributed File Storage System** inspired by cloud platforms like AWS S3.

It supports:

- Chunk-based file upload
- Replication for fault tolerance
- Distributed storage nodes
- Load balancing
- Streaming-based file download

---

## 🏗️ Architecture

Client → Main Server → Storage Nodes

- Main Server: Handles API, chunking, replication
- Storage Nodes: Store file chunks
- Database: Stores metadata

---

## ⚙️ Features

- 📦 Chunking (5MB per chunk)
- 🔁 Replication (multi-node storage)
- ⚖️ Load balancing (round-robin)
- 🛡️ Fault tolerance (node failure handling)
- ⚡ Streaming download
- 📊 Live logs support

---

## 🧪 Tech Stack

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Docker

---

## Frontend Repo

https://github.com/chetanmalviya18/mini-s3-distributed-storage-frontend

## 📁 Project Structure

```
main-server/
storage-node/
docker-compose.yml
```

---

## 🐳 Running with Docker

Before starting, ensure you have Docker installed and running on your machine.

### 1. Clone repo

```bash
git clone <repo-url>
cd project
```

---

### 2. Start system

```bash
docker compose up --build
```

---

### 3. Services

- Main Server → http://localhost:2000
- Storage Nodes → ports 4001, 4002, 4003
- PostgreSQL → port 5432

---

## 📤 API Endpoints

### Upload File

```
POST /api/files/upload
```

---

### Get Files

```
GET /api/files
```

---

### Download File

```
GET /api/files/download/:id
```

---

### Logs

```
GET /api/logs
```

---

## 🔁 Workflow

### Upload

1. Receive file
2. Split into chunks
3. Distribute chunks across nodes
4. Replicate chunks
5. Save metadata in DB

---

### Download

1. Fetch chunk metadata
2. Retrieve chunks from nodes
3. Failover if node fails
4. Stream combined file

---

## 🛡️ Fault Tolerance

- Each chunk stored in multiple nodes
- If one node fails, system uses replica
- Ensures high availability

---

## 🧠 Key Concepts

- Chunking
- Replication
- Load balancing
- Distributed systems

---

## 🎯 Future Improvements

- WebSocket-based real-time logs
- Auto-scaling nodes
- Authentication

---

## 👨‍💻 Author

Chetan Malviya
