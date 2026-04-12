# Smart Class Agentic Platform

A high-quality, responsive AI-powered learning management system featuring a Knowledge Tutor, AI Quiz Generator, and Assignment Evaluator.

## Quick Start Guide

To run the system locally, follow these steps in order using three separate terminal windows.

### 1. Start the Database (MongoDB)
Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is running on your machine.
```powershell
docker-compose up -d
```

### 2. Start the Backend API
Navigate to the backend directory, activate the virtual environment, and run the server.
```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8001
```
*The API will be available at: http://localhost:8001*

### 3. Start the Frontend Application
Navigate to the frontend directory and start the Next.js development server.
```powershell
cd frontend
npm run dev
```
*The UI will be available at: http://localhost:3000*

---

## Key Features
- **Knowledge Tutor**: An AI-powered chatbot that explains academic concepts using Markdown rendering.
- **AI Quiz Generator**: Generate dynamic quizzes based on topics, difficulty, and question counts with instant feedback and explanations.
- **Assignment Hub**: Student submissions and teacher evaluation tools.

## Environment Setup
Ensure your `backend/.env` file contains your `GOOGLE_API_KEY` for the AI features to work correctly.
