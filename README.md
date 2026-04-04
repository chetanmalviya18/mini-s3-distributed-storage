# Mini AWS S3 (Distributed File Storage System)

## Features

- File Upload & Download
- Chunking (5MB)
- Distributed Storage Nodes
- Load Balancing (Round Robin)
- Replication (Fault Tolerance)
- Streaming Download
- Docker Support

## Tech Stack

- Node.js (TypeScript)
- Express
- PostgreSQL + Prisma
- Docker

## Architecture

Client → API Server → Storage Nodes → Database

## How to Run

docker-compose up --build
