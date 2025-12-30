from elevenlabs import ElevenLabs
import os
from dotenv import load_dotenv

load_dotenv()

class AudioEngine:
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            print("Warning: ELEVENLABS_API_KEY not set")
        
        try:
            self.client = ElevenLabs(api_key=self.api_key)
            print("ElevenLabs Client Initialized")
        except Exception as e:
            print(f"Failed to init ElevenLabs: {e}")
            self.client = None

    def configure(self, api_key: str):
        """
        Re-configure the client with a specific API key.
        """
        try:
            os.environ["ELEVENLABS_API_KEY"] = api_key
            self.api_key = api_key
            self.client = ElevenLabs(api_key=self.api_key)
            print("ElevenLabs Client Re-Initialized via Keys")
        except Exception as e:
            print(f"Failed to re-init ElevenLabs: {e}")
            self.client = None

    def generate_speech_stream(self, text: str, voice_id: str):
        """
        Generates TTS audio stream with latency optimization.
        """
        if not self.client:
            return None
        
        try:
            # Using Flash v2.5 with optimized settings for lowest latency
            audio_stream = self.client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id="eleven_flash_v2_5", 
                output_format="mp3_22050_32",  # Lower quality = faster streaming
                optimize_streaming_latency=4   # Maximum latency optimization
            )
            return audio_stream
        except Exception as e:
            print(f"TTS Error: {e}")
            return None

    def generate_sfx(self, text: str):
        """
        Generates a sound effect with caching.
        """
        if not self.client:
            return None
            
        # create cache dir
        cache_dir = "assets/cache"
        os.makedirs(cache_dir, exist_ok=True)
        
        # simple hash for filename
        import hashlib
        filename = hashlib.md5(text.encode()).hexdigest() + ".mp3"
        filepath = os.path.join(cache_dir, filename)
        
        if os.path.exists(filepath):
            print(f"Serving cached SFX: {text}")
            with open(filepath, "rb") as f:
                return f.read() # Return bytes directly
            
        try:
            # Using sound effects endpoint
            response = self.client.text_to_sound_effects.convert(
                text=text,
                duration_seconds=None, 
                prompt_influence=0.3
            )
            
            # Consume generator to bytes
            audio_data = b""
            for chunk in response:
                if chunk:
                    audio_data += chunk
            
            # Save to cache
            with open(filepath, "wb") as f:
                f.write(audio_data)
                
            return audio_data
        except Exception as e:
            print(f"SFX Error: {e}")
            return None
