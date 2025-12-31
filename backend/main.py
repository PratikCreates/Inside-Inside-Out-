import os
import io
import json
import urllib.parse
import re
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
# Support both running from parent directory and from backend directory
try:
    from backend.brain import Brain
    from backend.personas import PersonaManager
    from backend.audio import AudioEngine
except ModuleNotFoundError:
    from brain import Brain
    from personas import PersonaManager
    from audio import AudioEngine

load_dotenv()

app = FastAPI(title="Inside Inside Out Console")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Response-Text", "X-Persona"],
)

# Initialize Components
brain = Brain()
personas = PersonaManager()
audio_engine = AudioEngine()

# Global conversation history for context between messages
# Stores the last N exchanges for context
conversation_history = []
MAX_HISTORY = 10  # Keep last 10 exchanges for context

@app.get("/")
def read_root():
    return {"status": "Inside Inside Out HQ is Online"}

@app.post("/api/config")
async def config_endpoint(data: dict):
    """
    Configure API keys dynamically (Judge Mode).
    """
    gemini_key = data.get("gemini_key")
    eleven_key = data.get("eleven_key")
    
    if gemini_key:
        brain.configure(gemini_key)
    
    if eleven_key:
        audio_engine.configure(eleven_key)
        
    return {"status": "configured"}


@app.get("/api/scribe-token")
async def scribe_token_endpoint():
    """
    Generate a single-use token for ElevenLabs Realtime STT (Scribe v2).
    The frontend uses this to establish a WebSocket connection directly with ElevenLabs.
    """
    import httpx
    
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
                headers={"xi-api-key": api_key}
            )
            response.raise_for_status()
            data = response.json()
            return {"token": data.get("token")}
    except Exception as e:
        print(f"Scribe token error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get scribe token")

@app.post("/api/chat")
async def chat_endpoint(data: dict):
    user_message = data.get("message")
    persona_name = data.get("persona", "Joy")
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message required")

    # 1. Auto-Detect Persona if requested
    auto_detect = data.get("auto_detect", False)
    
    if auto_detect:
        # Ask Brain who should handle this
        detected_name = brain.decide_persona(user_message)
        print(f"Router decided: {detected_name}")
        persona_name = detected_name
    else:
        # Manual override
        pass

    # 2. Get Persona Context
    system_prompt = personas.get_prompt(persona_name)
    if not system_prompt:
        # Fallback if name mismatch
        system_prompt = f"You are {persona_name}."

    # 2. Vertex AI Generation
    response_text = brain.generate_response(user_message, system_instruction=system_prompt)
    
    # 3. Audio Generation (ElevenLabs)
    voice_id = personas.get_voice_id(persona_name)
    audio_stream_iterator = audio_engine.generate_speech_stream(response_text, voice_id)

    # We return a custom response structure. 
    # Ideally, we stream audio. For simplicity in this hackathon setup:
    # Option A: Return text JSON, user requests audio separately.
    # Option B: Return multipart? Hard for simple frontend.
    # Option C: Stream the audio directly and send text in a header or separate call?
    # Let's do Option A for robustness: Return Text + "speak_url".
    # BUT user wants "Conversation". 
    # Let's return the audio blob if possible? 
    # Actually, let's stream the audio and put the text in a custom header `X-Response-Text`.
    # This makes the frontend audio player happy.
    
    if audio_stream_iterator:
        def iter_audio():
            yield from audio_stream_iterator

        # Header values must be Latin-1, so we URL-encode the text (which may have emojis)
        safe_text = urllib.parse.quote(response_text.replace("\n", " ")[:500])

        return StreamingResponse(
            iter_audio(), 
            media_type="audio/mpeg",
            headers={
                "X-Response-Text": safe_text,
                "X-Persona": persona_name
            } 
        )
    else:
        # Fallback if audio fails
        return {
            "persona": persona_name,
            "text": response_text,
            "audio": None
        }

@app.get("/api/music")
async def music_endpoint(emotion: str):
    """
    Generate vided-based music. 
    """
    # Simply prompt map
    vibe_prompts = {
        "Joy": "Upbeat, sunny, acoustic guitar and whistling, happy pop, 120bpm",
        "Sadness": "Melancholic, slow piano, rain sounds, minimalist, damp, 60bpm",
        "Anger": "Aggressive, distorted electric guitar, intense drums, fast punk, 160bpm",
        "Fear": "Eerie, suspenseful strings, tiptoeing xylophone, mysterious, nervous",
        "Disgust": "Quirky, staccato, pizzicato strings, judgmental harpsichord, odd timing",
    }
    
    prompt = vibe_prompts.get(emotion, "Chill lofi beats")
    
    # Note: AudioEngine currently doesn't have a distinct music method in my implementation 
    # but I can use SFX or if I implemented `trigger_music`.
    # Let's assume audio_engine has a generic generation or we treat it as an SFX with duration?
    # Actually, ElevenLabs now has `text_to_sound_effects`.
    # Let's try to use that for short loops or see if we can use the proper music endpoint.
    # I'll stick to `generate_sfx` for now as "Music Loop".
    
    sfx_response = audio_engine.generate_sfx(prompt)
    if sfx_response:
        # returns valid audio bytes/generator
        return StreamingResponse(io.BytesIO(sfx_response), media_type="audio/mpeg")
    
    return {"status": "error"}

@app.post("/api/funmode")
async def fun_mode_endpoint(data: dict):
    topic = data.get("topic", "Life")
    script = brain.generate_fun_mode_script(topic)
    return {"script": script}

@app.get("/api/sfx/{event_type}")
async def sfx_endpoint(event_type: str):
    sfx_response = audio_engine.generate_sfx(event_type)
    if sfx_response:
        return StreamingResponse(io.BytesIO(sfx_response), media_type="audio/mpeg")
    return {"status": "error"}


@app.post("/api/warroom")
async def warroom_endpoint(data: dict):
    """
    Multi-agent war room: All emotions react to the user's input,
    aware of each other's responses.
    Returns a JSON list of {persona, text} for the frontend to play sequentially.
    """
    user_message = data.get("message")
    target_persona = data.get("target_persona")

    if not user_message:
        raise HTTPException(status_code=400, detail="Message required")
    
    # Access global conversation history
    global conversation_history
    
    # Include previous exchanges for context in orchestrator
    history_summary = ""
    if conversation_history:
        history_summary = "Previous context: " + " | ".join(conversation_history[-4:])
    
    speaker_order = []
    
    # Determine speaker order based on priority:
    # 1. Mentioned via @Name
    # 2. Selected personas from UI (multi-select)
    # 3. Target persona (single override)
    # 4. Auto-orchestration (default)
    
    valid_personas = ["Joy", "Sadness", "Anger", "Fear", "Disgust"]
    speaker_order = []
    
    # Check for @Mentions
    mentions = re.findall(r"@(\w+)", user_message)
    mentioned_order = [m for m in mentions if m in valid_personas]
    unique_mentions = []
    seen = set()
    for m in mentioned_order:
        if m not in seen:
            unique_mentions.append(m)
            seen.add(m)

    ui_selection = data.get("target_personas")
    
    if unique_mentions:
        speaker_order = unique_mentions
        print(f"Priority 1 (@Mention): {speaker_order}")
    elif ui_selection and isinstance(ui_selection, list) and len(ui_selection) > 0:
        speaker_order = [p for p in ui_selection if p in valid_personas]
        print(f"Priority 2 (UI Multi-select): {speaker_order}")
    elif target_persona and target_persona in valid_personas:
        speaker_order = [target_persona]
        print(f"Priority 3 (UI Single): {speaker_order}")
    else:
        # Priority 4: Auto-orchestration
        print("Priority 4 (Auto-orchestration)")
        orchestrator_prompt = f"""
        You are the Headquarters orchestrator. {history_summary}
        
        A user just said: "{user_message}"
        
        Pick 2-3 emotions who should react to this. They will have a dynamic discussion.
        Think about who would naturally respond to this topic.
        
        Available: Joy, Sadness, Anger, Fear, Disgust.
        
        Return ONLY a comma-separated list of names in speaking order.
        Example: Fear, Disgust, Joy
        """
        
        try:
            order_response = brain.client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=orchestrator_prompt
            )
            order_text = order_response.text.strip().replace(".", "")
            speaker_order = [n.strip() for n in order_text.split(",") if n.strip() in valid_personas]
            if len(speaker_order) == 0:
                speaker_order = ["Joy"] 
        except Exception as e:
            print(f"Orchestrator error: {e}")
            speaker_order = ["Joy", "Sadness"]
    
    # Build tasks for parallel generation
    import asyncio
    
    # Context aggregation
    history_context = ""
    if conversation_history:
        history_context = "--- Previous conversation ---\n" + "\n".join(conversation_history[-6:]) + "\n---\n\n"

    tasks = []
    for persona_name in speaker_order[:4]:
        system_prompt = personas.get_prompt(persona_name)
        if not system_prompt:
            system_prompt = f"You are {persona_name}."
        
        # In parallel mode, we can't see what others say in the SAME turn easily,
        # so we tell them the speaking order so they know who else is here.
        others = [p for p in speaker_order if p != persona_name]
        others_text = f"You are speaking along with: {', '.join(others)}." if others else ""
        
        full_prompt = f"""
        {system_prompt}
        
        {history_context}
        --- Current Context ---
        User said: "{user_message}"
        {others_text}
        ---
        
        Now respond as {persona_name}. Keep it under 2 sentences. Max 30 words.
        React directly to the user's message.
        IMPORTANT: Do NOT start your response with your name or any prefix like "{persona_name}:" - just speak directly.
        """
        tasks.append(brain.generate_response_async(user_message, system_instruction=full_prompt))

    # Run everything in parallel
    results = await asyncio.gather(*tasks)
    
    responses = []
    for i, persona_name in enumerate(speaker_order[:4]):
        response_text = results[i].strip()
        
        # Cleanup
        if response_text.lower().startswith(f"{persona_name.lower()}:"):
            response_text = response_text[len(persona_name)+1:].strip()
        
        responses.append({
            "persona": persona_name,
            "text": response_text
        })
    
    # Save to history
    conversation_history.append(f"User: {user_message}")
    for r in responses:
        conversation_history.append(f"{r['persona']}: {r['text']}")
    
    if len(conversation_history) > MAX_HISTORY * 3:
        conversation_history = conversation_history[-MAX_HISTORY * 3:]
    
    return {"responses": responses}




@app.post("/api/funmode/stream")
async def fun_mode_stream_endpoint(data: dict):
    """
    Streaming Debate Mode:
    Streams lines in format: "Persona: Message"
    """
    user_message = data.get("message")
    mode = data.get("mode", "default")
    target_personas = data.get("target_personas")  # NEW: Respect selected personas
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message required")

    global conversation_history
    history_context = ""
    if conversation_history:
        history_context = "Previous Context:\n" + "\n".join(conversation_history[-6:])

    # Define constraints based on target selection or mode
    valid_personas = ["Joy", "Sadness", "Anger", "Fear", "Disgust"]
    
    if target_personas and isinstance(target_personas, list) and len(target_personas) > 0:
        # User has selected specific personas - ONLY use those
        selected = [p for p in target_personas if p in valid_personas]
        if selected:
            persona_list = ", ".join(selected)
            constraints = f"ONLY involve these emotions: {persona_list}. They are the ONLY ones who should speak. Create a dynamic discussion with {len(selected)} emotion(s) - about 3-5 turns total."
        else:
            # Fallback if invalid selection
            constraints = "Involve 3 key emotions. Quick, funny reaction (4-5 turns)."
    elif mode == "long":
        constraints = "Involve ALL 5 emotions. Create a long, complex, high-energy discussion (10-12 turns). Every emotion MUST be passionate!"
    elif mode == "medium":
        constraints = "Involve 4 emotions. Balanced high-energy discussion (7-9 turns)."
    else: 
        constraints = "Involve 3 key emotions. Quick, funny reaction (4-5 turns)."

    # Stream-friendly prompt
    script_prompt = f"""
    You are the 'Headquarters' orchestrator for a 'FUN MODE' session.
    The user wants the emotions to react to: "{user_message}"
    
    {history_context}
    
    TASK: Write a punchy, personality-driven screenplay.
    {constraints}
    
    EMOTION GUIDELINES:
    - Joy: Hyper-excited and over-the-top optimistic.
    - Sadness: Melancholic, pessimistic, buzzkill.
    - Anger: Shouting and easily triggered by trivial details.
    - Fear: Panicked, nervous, and seeing danger everywhere.
    - Disgust: Cynical, sassy, and judgmental of others.
    
    GUIDELINES:
    1. Output MUST be one line per dialogue in this EXACT format:
       Persona: Dialogue text here...
       
    2. Example Output:
       Joy: This is going to be SO MUCH FUN!
       Anger: I HATE FUN!
       Disgust: Ugh, can you two just not?
       
    3. Characters MUST interact with each other. Use names.
    4. NO bold text, NO markdown, NO JSON. Just "Name: Text".
    5. Pick a random starter.
    """

    # Sync generator for StreamingResponse (runs in threadpool)
    def stream_generator():
        try:
            # enable streaming
            response = brain.client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=script_prompt,
                stream=True,
                config={'response_mime_type': 'application/json'} # Try forcing JSON if helpful, but text is fine
            )
            
            # Use sync iterator
            for chunk in response:
                text = chunk.text
                if not text: continue
                
                # Naive buffer handling for the simple line-by-line format
                # Note: We are yielding NDJSON lines.
                # Since chunk.text might be partial lines, we should buffer.
                # BUT for simplicity in this synchronous loop, let's just yield what we have 
                # and let the frontend buffer handle the split, OR handle buffer here.
                # Let's handle buffer here to be safe.
                # actually, 'chunk.text' usually contains full tokens.
                
                # Let's just yield the raw text and let frontend split, 
                # BUT we need to format it as NDJSON "Persona: Msg" -> JSON
                # The prompt asks for "Persona: Msg".
                # We need to buffer here to verify lines.
                
                # Re-implement simple buffering
                yield from parse_and_yield_ndjson(text)
                
        except Exception as e:
            print(f"Stream error: {e}")
            yield json.dumps({"persona": "System", "text": "Connection interrupted."}) + "\n"

    # Helper to manage buffer state across chunks (cannot use closure easily in sync gen without nonlocal or class)
    # Let's use a simpler approach: Just yield chunks of text and let frontend parse? 
    # NO, the frontend expects JSON objects separated by newlines.
    # We must parse the "Persona: Text" format into JSON here.
    
    # We'll define the logic inline with a mutable buffer
    def stream_with_buffer():
        buffer = ""
        try:
            response = brain.client.models.generate_content_stream(
                model="gemini-2.5-flash-lite",
                contents=script_prompt
            )
            for chunk in response:
                if not chunk.text: continue
                buffer += chunk.text
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if ":" in line:
                         parts = line.split(":", 1)
                         name = parts[0].strip()
                         msg = parts[1].strip()
                         if name in ["Joy", "Sadness", "Anger", "Fear", "Disgust", "Headquarters"]:
                             yield json.dumps({"persona": name, "text": msg}) + "\n"
            
            # Flush
            if buffer and ":" in buffer:
                parts = buffer.split(":", 1)
                name = parts[0].strip()
                msg = parts[1].strip()
                if name in ["Joy", "Sadness", "Anger", "Fear", "Disgust", "Headquarters"]:
                    yield json.dumps({"persona": name, "text": msg}) + "\n"
        except Exception as e:
            print(f"Stream error: {e}")
            yield json.dumps({"persona": "System", "text": "Connection interrupted: " + str(e)}) + "\n"

    return StreamingResponse(stream_with_buffer(), media_type="application/x-ndjson")

@app.get("/api/warroom/audio")
@app.post("/api/warroom/audio")
async def warroom_audio_endpoint(data: dict = None, persona: str = None, text: str = None):
    """
    Generate audio for a single response. Supports both POST (JSON) and GET (Query).
    """
    if data:
        persona_name = data.get("persona", "Joy")
        text_content = data.get("text", "")
    else:
        persona_name = persona or "Joy"
        text_content = text or ""
    
    if not text_content:
        raise HTTPException(status_code=400, detail="Text required")
    
    voice_id = personas.get_voice_id(persona_name)
    audio_stream = audio_engine.generate_speech_stream(text_content, voice_id)
    
    if audio_stream:
        def iter_audio():
            yield from audio_stream
        
        safe_text = urllib.parse.quote(text_content.replace("\n", " ")[:500])
        return StreamingResponse(
            iter_audio(),
            media_type="audio/mpeg",
            headers={
                "X-Response-Text": safe_text,
                "X-Persona": persona_name
            }
        )
    
    return {"status": "error"}
