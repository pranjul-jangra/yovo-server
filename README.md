# Yovo – Social Media Backend

Yovo is a modern social media platform. This repository contains the backend implementation, built with Node.js, Express, MongoDB, and Socket.io, providing secure APIs and real-time features for the Yovo frontend.

## Features

- 🔐 Authentication & Security
    - JWT-based authentication
    - Password hashing with bcryptjs
    - Rate limiting & cookie-based sessions
    - OTP/email verification via Nodemailer

- 👤 User Management
    - Signup, login, logout
    - Profile update (bio, avatar, links, settings)
    - Account deletion, temporary disable, email updates
    - Session record with device and location info

- 📝 Post System
    - Create, edit, delete posts
    - Image/video upload with Multer + Cloudinary
    - Like, comment, and share functionality

- 💬 Real-Time Messaging
    - One-to-one chat with Socket.io
    - Unread indicators & notifications

- 🔎 Explore & Social Features
    - Trending posts, and users
    - Follow/unfollow users
    - Activity tracking (likes, comments, follows, shares)

- 📂 File & Media Handling
    - Cloudinary integration for media storage
    - Multer for file uploads

## Tech Stack

- Runtime: Node.js
- Framework: Express.js
- Database: MongoDB + Mongoose
- Auth & Security: JWT, bcryptjs, express-rate-limit, cookie-parser, cors
- File Uploads: Multer + Cloudinary
- Email/OTP: Nodemailer
- Real-time: Socket.io
- Utilities: dotenv, ua-parser-js, axios, Firebase Admin

## Project Structure

```bash
yovo-backend/
├── config/        # DB configs
├── controllers/   # Route controllers
├── middleware/    # Multer & rate-limiters middlewares
├── models/        # Mongoose schemas
├── routes/        # API route definitions
├── utils/         # Helper functions
│
│── package.json
└── server.js      # Entry point
```

## Frontend

This backend powers the Yovo frontend app.
👉 Frontend repo: [yovo-frontend](https://github.com/pranjul-jangra/yovo)