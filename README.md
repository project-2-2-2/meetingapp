````markdown name=README.md
# MeetingApp: RAG+LLM Interview and Candidate Scoring Platform

MeetingApp is an AI-powered interview platform that leverages Retrieval-Augmented Generation (RAG) and LLMs to evaluate candidates during interviews, providing automated scoring and feedback.  
The application is built with a modular architecture:  
- **Backend AI:** Python (LangChain, FastAPI/Uvicorn)
- **Web Backend:** Node.js (Express)
- **Frontend:** React

---

## Features

- **Automated Interview Evaluation:** Uses LLMs and RAG for context-aware candidate assessment.
- **Candidate Scoring:** Generates scores and summaries after each interview.
- **Real-time Communication:** WebSocket or REST APIs for live interaction.
- **Modern Web Interface:** Responsive React frontend.

---

## Tech Stack

| Layer        | Technology                |
|--------------|--------------------------|
| AI Backend   | Python, LangChain, Uvicorn, FastAPI |
| Web Backend  | Node.js, Express         |
| Frontend     | React                    |

---

## Architecture Overview

```
[React Frontend] <--> [Express Web Backend] <--> [Python AI Backend (LangChain, LLM)]
```

- **React Frontend:** User interface for interviewers/candidates.
- **Express Web Backend:** API routing, user authentication, session management.
- **Python AI Backend:** Handles RAG+LLM logic, receives questions/answers, returns scores.

---

## Setup Instructions

### Prerequisites

- Node.js & npm
- Python 3.8+
- (Optional) Virtual environment for Python

---

### 1. Clone the Repository

```bash
git clone https://github.com/project-2-2-2/meetingapp.git
cd meetingapp
```

---

### 2. Backend AI Setup (Python)

1. Navigate to the backend directory:
    ```bash
    cd backend-ai
    ```
2. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3. Start the backend server:
    ```bash
    uvicorn main:app --reload
    ```
    - Ensure `main.py` contains your FastAPI app and LangChain logic.

---

### 3. Web Backend Setup (Express)

1. Navigate to the web backend directory:
    ```bash
    cd web-backend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start the Express server:
    ```bash
    npm start
    ```
    - Configure the Express server to proxy requests to the AI backend.

---

### 4. Frontend Setup (React)

1. Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start the React app:
    ```bash
    npm start
    ```

---

## Configuration

- **Environment Variables**
    - AI backend: Add your LLM API keys or model configs in `.env`
    - Web backend: Configure service endpoints and session secrets in `.env`
    - Frontend: Set API URLs in `.env`

---

## Usage

1. Access the frontend at [http://localhost:3000](http://localhost:3000).
2. Login/signup as interviewer or candidate.
3. Start an interview session.
4. After interview, view candidate scores and feedback.

---

## Folder Structure

```
meetingapp/
├── backend-ai/        # Python (LangChain, FastAPI/Uvicorn)
├── web-backend/       # Node.js (Express)
├── frontend/          # React
```

---

## Contributing

1. Fork the repo and create your feature branch (`git checkout -b feature/fooBar`)
2. Commit your changes (`git commit -am 'Add some fooBar'`)
3. Push to the branch (`git push origin feature/fooBar`)
4. Create a pull request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- [LangChain](https://langchain.com/)
- [OpenAI](https://openai.com/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)

---

## Contact

For support or collaboration, contact [project-2-2-2](https://github.com/project-2-2-2).

````
