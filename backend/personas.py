import os
import re

class PersonaManager:
    def __init__(self, prompts_dir="SystemPrompts"):
        self.prompts = {}
        self.voice_ids = {
            "Joy": os.getenv("VOICE_ID_JOY", "rtza1NeU17DKF7sf5ZAu"),        
            "Sadness": os.getenv("VOICE_ID_SADNESS", "AZnzlk1XvdvUeBnXmlld"),    
            "Anger": os.getenv("VOICE_ID_ANGER", "PFfIjUGsWsT9uQNYM0Vr"),      
            "Fear": os.getenv("VOICE_ID_FEAR", "GbbQErkqwE6P1x11Ol4I"),       
            "Disgust": os.getenv("VOICE_ID_DISGUST", "Zbqlr4MtsuNf9UAxsv2G"),    
        }
        self.load_prompts(prompts_dir)

    def load_prompts(self, directory):
        """
        Loads prompts from text files in the specified directory.
        Filename (without extension) is used as the persona name.
        """
        try:
            # Resolve path relative to the project root (parent of backend)
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            target_path = os.path.join(base_dir, directory)
            
            if not os.path.exists(target_path):
                 print(f"Warning: Prompts directory not found at {target_path}")
                 return
            
            for filename in os.listdir(target_path):
                if filename.endswith(".txt"):
                    name = os.path.splitext(filename)[0]
                    file_path = os.path.join(target_path, filename)
                    with open(file_path, "r", encoding="utf-8") as f:
                        self.prompts[name] = f.read().strip()
                
            print(f"Loaded {len(self.prompts)} personas: {list(self.prompts.keys())}")

        except Exception as e:
            print(f"Error loading persona prompts: {e}")

    def get_prompt(self, name):
        return self.prompts.get(name, "")

    def get_voice_id(self, name):
        return self.voice_ids.get(name, "rtza1NeU17DKF7sf5ZAu") 