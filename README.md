# Inside Inside Out 🧠✨
> **A Real-Time Multi-Agent Conversational Voice Orchestration Console**

![Inside Inside Out Banner](public/hero-characters.png)

## Overview

**Inside Inside Out** is a real-time, voice-first conversational AI console built for the **ElevenLabs x Google Cloud AI Challenge**.

It seamlessly integrates **Google Cloud Vertex AI** (for scalable, multi-modal intelligence) and **ElevenLabs** (for ultra-low latency, human-like speech) to bring the "voices in your head" to life.

> 💡 **Inspiration**: Drawing directly from Pixar's *Inside Out*, we reimagined the "Headquarters" console as a real-time, interactive AI system where emotions act as distinct agents.

Unlike standard chatbots, this system features **Multi-Agent Orchestration**: five distinct AI personalities (Joy, Sadness, Anger, Fear, Disgust) debate, engage, and interrupt each other in real-time.

## 🏗️ Architecture

The system is built on a high-performance event-driven architecture designed for streaming and seamless voice interaction.

```mermaid
graph TD
    User((User)) -->|Voice/Text Input| Frontend[React Frontend (Console)]
    
    subgraph "Headquarters (Backend)"
        Frontend -->|API Request| API[FastAPI Server]
        
        API -->|Context & History| Brain[Orchestrator Brain]
        Brain <-->|Inference| Gemini[Google Gemini 1.5/2.0]
        
        Brain -->|Selected Persona & Script| API
        
        API -->|Text Stream| TTS[Audio Engine]
        TTS <-->|Synthesis| Eleven[ElevenLabs Turbo v2.5]
    end
    
    TTS -->|Audio Stream| Frontend
    Frontend -->|Visual Feedback| User
    
    style Brain fill:#f9f,stroke:#333,stroke-width:2px
    style Gemini fill:#4285F4,stroke:#fff,color:#fff
    style Eleven fill:#fff,stroke:#000,color:#000
```

## 🚀 Powering the Experience (The Stack)

### 🧠 Intelligence: Google Cloud Vertex AI
We utilize **Google Cloud Vertex AI** as the backbone of our "Headquarters" orchestrator.
*   **Scalable Reasoning**: Uses **Gemini Pro on Vertex AI** to handle complex emotional routing and nuanced script generation.
*   **Hybrid Architecture**: The backend (`backend/brain.py`) is designed to run natively on Google Cloud (Vertex) for production stability, while offering an API-key fallback for portable demos.
*   **Why Vertex?**: It provided the reliability and latency required to orchestrate 5 simultaneous agent personalities in real-time.

### 🗣️ Voice: ElevenLabs Agents
Each emotion is given a unique, hyper-realistic voice using **ElevenLabs**.
*   **Turbo v2.5**: integrated for critical low-latency streaming, allowing emotions to "interrupt" and banter naturally.
*   **Expressive Scribe**: We don't just generate text; we generate *performance*. The system captures sighs, shouts, and whispers.
*   **Conversational**: Users interact entirely through speech, fulfilling the challenge's vision of a truly "voice-driven" interface.

### 3. Immersive Console (The "Body")
built with **React + Vite + Framer Motion**.
*   *Glassmorphism UI*: Premium, cinematic aesthetic.
*   *Real-time Visuals*: Dynamic hero elements that scale and react to audio levels.
*   *Judge Mode*: Fully portable configuration allowing API key injection for demonstrations.

---

## ✨ Features

### 🎙️ The War Room (Call Mode)
Engage in a continuous, hands-free voice call with the entire cast of emotions. Speak naturally, and watch them debate your life choices in real-time.

### 🎭 Fun Mode
A specialized "Scenario Simulator." Throw a topic at the emotions (e.g., *"Tomorrow is Monday"*) and watch them perform a scripted, high-energy skit. 
*   **Auto-generated Scripts**: The Brain writes a screenplay on the fly.
*   **Full Performance**: All 5 agents act out the scene with perfect timing.

### 🎛️ Judge Mode (Portable Demo)
Designed for hackathons and demos. No complex cloud setup required.
1.  Click the **Lock Icon** 🔒 in the console.
2.  Paste your **Gemini** and **ElevenLabs** API keys.
3.  The system instantly reconfigures itself and goes live.

---

## 🛠️ Getting Started

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Google Gemini API Key
*   ElevenLabs API Key

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/PratikCreates/Inside-Inside-Out-.git
    cd Inside-Inside-Out-
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  **Run the Application**
    *   **Option A (Easy)**: Double-click `run_app.bat` in the root folder.
    *   **Option B (Manual)**: Access `http://localhost:5173` after starting backend/frontend manually.

## 🤝 Contributing

We welcome contributions! Whether it's adding new emotions (Anxiety? Ennui?) or optimizing the orchestration latency, feel free to open a PR.

---
*Built with ❤️ for the Hackathon*
