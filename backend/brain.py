import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

class Brain:
    def __init__(self, api_key=None):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = os.getenv("GOOGLE_CLOUD_LOCATION")
        self.client = None

        # Try configuring with env vars first (Vertex)
        if self.project_id and self.location:
            try:
                self.client = genai.Client(
                    vertexai=True,
                    project=self.project_id,
                    location=self.location
                )
                print(f"Brain connected to Vertex AI project: {self.project_id}")
            except Exception as e:
                print(f"Failed to connect to Vertex AI: {e}")
        
        # If Vertex failed or not configured, try API key (Env or Passed)
        if not self.client:
            key = api_key or os.getenv("GEMINI_API_KEY")
            if key:
                self.configure(key)
            else:
                print("Warning: No Vertex Project or Gemini API Key found.")

    def configure(self, api_key: str):
        """
        Re-configure the client with a specific API key (Gemini API mode).
        """
        try:
            os.environ["GEMINI_API_KEY"] = api_key # Update env for other usages checks
            self.client = genai.Client(api_key=api_key)
            print("Brain connected via Gemini API Key")
        except Exception as e:
            print(f"Failed to connect via API Key: {e}")
            self.client = None

    def generate_response(self, user_input: str, system_instruction: str = None) -> str:
        """
        Generates a response for a specific persona.
        """
        if not self.client:
            return "Error: Brain not connected."

        # User's test script used 'gemini-2.5-flash-lite', but plan said 1.5. 
        # Using what user verified works: 'gemini-2.5-flash-lite'
        model_id = "gemini-2.5-flash-lite" 
        
        config = {'system_instruction': system_instruction} if system_instruction else {}

        try:
            response = self.client.models.generate_content(
                model=model_id,
                contents=user_input,
                config=config
            )
            return response.text
        except Exception as e:
            print(f"Error generating content: {e}")
            return "Thinking..."

    def decide_persona(self, user_input: str, history: str = "") -> str:
        """
        Analyzes input and selects the best persona (Joy, Sadness, Anger, Fear, Disgust).
        """
        if not self.client:
            return "Joy" # Fallback

        prompt = f"""
        You are the 'Headquarters' of a human mind. 
        Analyze the User's input and recent history. 
        Decide which Emotion should respond.
        
        Emotions:
        - Joy: For happy, positive, excited, optimistic inputs.
        - Sadness: For gloomy, depressing, crying, pessimistic inputs.
        - Anger: For frustrating, annoying, unfair, rage-inducing inputs.
        - Fear: For scary, anxious, dangerous, worrying inputs.
        - Disgust: For gross, repulsing, sassy, cynical, judgmental, or 'ew' inputs.

        Return ONLY the name of the Emotion.
        
        User Input: "{user_input}"
        """
        
        # Using a cheaper model for routing if available, or same one.
        model_id = "gemini-2.5-flash-lite"
        
        try:
            response = self.client.models.generate_content(
                model=model_id,
                contents=prompt
            )
            decision = response.text.strip().replace(".", "")
            valid_personas = ["Joy", "Sadness", "Anger", "Fear", "Disgust"]
            
            # Simple fuzzy matching or fallback
            for p in valid_personas:
                if p.lower() in decision.lower():
                    return p
            
            return "Joy" # Default
        except Exception as e:
            print(f"Routing Error: {e}")
            return "Joy"

    def generate_fun_mode_script(self, topic: str) -> list:
        """
        Generates a high-energy, personality-driven 'Fun Mode' interaction.
        Returns a list of dicts: [{"persona": "Joy", "text": "..."}]
        """
        if not self.client:
            return []

        prompt = f"""
        Act as the 'Headquarters' of a human mind. 
        Orchestrate a 'FUN MODE' conversation where all 5 emotions (Joy, Sadness, Anger, Fear, Disgust) 
        react dynamicly and funny to the following scenario: "{topic}".
        
        GUIDELINES:
        - Joy should be hyper-optimistic and lead the energy.
        - Sadness should be a complete buzzkill.
        - Anger should find something completely trivial to get furious about.
        - Fear should be paralyzed by the 'what-ifs'.
        - Disgust should be cynical and judgmental of everyone else's opinions.
        
        CRITICAL: 
        1. EVERY emotion MUST speak at least once.
        2. Characters should interact with EACH OTHER (e.g., Anger shouting at Joy).
        3. Keep turns short and punchy.
        4. Total 8-12 turns.

        Format: Return a VALID JSON list of objects ONLY.
        Example:
        [
            {{"persona": "Joy", "text": "This is the best idea ever!"}},
            {{"persona": "Anger", "text": "JOY, YOU'RE WRONG! IT'S TERRIBLE!"}},
            {{"persona": "Disgust", "text": "Could you two keep it down? You're embarrassing me."}}
        ]
        
        Do not include markdown code blocks.
        """
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt
            )
            import json
            text = response.text.replace("```json", "").replace("```", "").strip()
            script = json.loads(text)
            return script
        except Exception as e:
            print(f"Fun Mode Script Error: {e}")
            return []

