# EffiSync API Documentation

This document outlines the RESTful API endpoints available in the EffiSync backend. All endpoints are prefixed with `/auth` or `/api`.

## 🔐 1. Authentication

### Google OAuth Flow
- **Initiate Login**: `GET /auth/google`
  - Redirects the user to the Google Consent screen.
- **Callback**: `GET /auth/google/callback?code=...`
  - Handles the OAuth redirect, fetches the tokens, and upserts the user based on their Google profile.

### Classic Authentication
#### `POST /auth/register`
Creates a new user using email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "userId": "uuid-string"
  }
  ```

#### `POST /auth/login`
Authenticates an existing user.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "userId": "uuid-string"
  }
  ```

## 📋 2. Tasks & Gamification

#### `POST /api/tasks`
Create a new task (optionally assigned to a user).
- **Request Body:**
  ```json
  {
    "title": "Clean the kitchen",
    "description": "Scrub the counters and mop the floor.",
    "difficulty": 3,
    "householdId": "uuid-string",
    "createdById": "uuid-string",
    "assignedToId": "uuid-string", 
    "category": "CLEANING"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "task": {
      "id": "uuid-string",
      "title": "Clean the kitchen",
      "pointsValue": 30,
      "status": "IN_PROGRESS"
    }
  }
  ```

#### `GET /api/tasks?householdId=...`
Retrieve all tasks for a specific household.
- **Success Response:**
  ```json
  {
    "success": true,
    "tasks": [ ... ]
  }
  ```

#### `PUT /api/tasks/:id`
Update an existing task (e.g., reassigning it or changing the due date).
- **Request Body:**
  ```json
  {
    "assignedToId": "uuid-string"
  }
  ```

#### `DELETE /api/tasks/:id`
Delete a task from the database.

#### `POST /api/tasks/:id/accept`
Mark a task as completed. The assignee will be credited with the task's `pointsValue` and a `PointsTransaction` will be recorded.
- **Request Body:**
  ```json
  {
    "userId": "uuid-string"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "task": { ... },
    "pointsEarned": 30
  }
  ```

#### `POST /api/tasks/:id/veto`
Use a "Veto Right" to reject an assigned task.
- **Logic:** Deducts 50 points from the user's `pointsBalance`, increases the task's `refusalCount`, inflates the `pointsValue` by 1.5x (Task Bidding loop), and automatically re-assigns the task to a random available household member (triggering a real Gmail notification).
- **Request Body:**
  ```json
  {
    "userId": "uuid-string"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "task": { "pointsValue": 45, "assignedToId": "new-user-uuid", "status": "IN_PROGRESS" },
    "deducted": 50
  }
  ```

## 🤖 3. AI Chat

#### `POST /api/chat`
Interact with the AI Household Manager. The agent can create tasks, assign work based on calendar availability, and answer questions using natural language.
- **Request Body:**
  ```json
  {
    "message": "What should I do today?",
    "userId": "uuid-string"
  }
  ```
- **Success Response:**
  ```json
  {
    "reply": "You have to take out the trash.",
    "toolsUsed": ["get_household_state"]
  }
  ```

#### `GET /api/chat/history?userId=...`
Retrieve the complete AI conversation history for a given user.
- **Success Response:**
  ```json
  {
    "history": [
      {
        "id": "uuid-string",
        "role": "USER",
        "text": "What should I do today?",
        "createdAt": "2026-04-25T12:00:00.000Z"
      },
      {
        "id": "uuid-string",
        "role": "AI",
        "text": "You have to take out the trash.",
        "createdAt": "2026-04-25T12:00:05.000Z"
      }
    ]
  }
  ```

## 🏠 4. Households & Economy (Under the Hood)
- **Household Management**: Groups are created globally (each user belongs to a `Household`). Members are synchronized dynamically, and their collective data shapes the AI agent's decisions.
- **Economy (`pointsBalance` & `PointsTransaction`)**: Every time a user completes a task, an `EARNED` transaction is created. Every time they use a Veto, a `SPENT` transaction is recorded. The system uses these points as "currency" within the fairness algorithm.
