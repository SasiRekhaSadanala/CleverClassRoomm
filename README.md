# CleverClassRoomm 🎓

CleverClassRoomm is an advanced, AI-powered classroom platform designed to streamline the educational experience for both teachers and students. It integrates modern web technologies with AI agents to provide automated grading, dynamic material management, and robust student performance analytics.

---

## 🚀 Key Features

### For Teachers
- **Course Management**: Create and manage multiple courses with ease.
- **Dynamic Topic Uploads**: Upload materials (PDFs, PPTs, Images) by typing a topic name. The system automatically organizes them.
- **Assignment Creator**: Design coding or theory assignments with specific due dates and test cases.
- **Evaluator Hub**: View student submissions, download uploaded documents, and provide feedback.

### For Students
- **Course Enrollment**: Join courses using a simple student ID or account.
- **Material Access**: View and download lecture notes and materials organized by topic.
- **Flexible Submissions**: Submit assignments through text, source code, or file uploads (PDF, PPT, Code, etc.).
- **Instant AI Feedback**: Receive automated initial feedback and scores for coding and theory tasks through integrated AI agents.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: FastAPI (Python), Beanie (ODM for MongoDB), Pydantic.
- **Database**: MongoDB.
- **AI Integration**: Custom agents for code understanding and grading.

---

## 📦 Installation & Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **MongoDB** (Local instance or Atlas)

### 2. Backend Setup
1. Navigate to the `backend` directory.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables in `.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017/your_db
   PUBLIC_API_BASE_URL=http://127.0.0.1:8001
   ```
5. Run the backend:
   ```bash
   python main.py
   ```
   *The API will be available at `http://localhost:8001`.*

### 3. Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (optional for local dev):
   - Ensure the API is pointing to `http://localhost:8001`.
4. Run the frontend:
   ```bash
   npm run dev
   ```
   *The application will be live at `http://localhost:3000`.*

---

## 📂 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/          # API Route definitions
│   │   ├── models/       # Database schemas (Beanie)
│   │   └── agents/       # AI logic and grading workflows
│   └── main.py           # Entry point
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # Reusable UI components
│   │   └── lib/          # API and Auth utilities
└── README.md
```

---

## 📝 License
This project is for educational purposes. 

---

**Developed with ❤️ for Modern Classrooms.**
