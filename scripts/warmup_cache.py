import requests
import time

emotions = ["Joy", "Sadness", "Anger", "Fear", "Disgust"]

print("Starting Audio Cache Warmup...")

for emotion in emotions:
    print(f"Generating Vibe for: {emotion}...")
    start = time.time()
    try:
        # Request stream (which triggers generation & cache save in backend)
        r = requests.get(f"http://localhost:8000/api/music?emotion={emotion}", stream=True)
        if r.status_code == 200:
            # Consume stream to ensure full generation
            size = 0
            for chunk in r.iter_content(chunk_size=1024):
                if chunk: size += len(chunk)
            print(f"-> Done ({size} bytes) in {time.time() - start:.2f}s")
        else:
            print(f"-> Failed: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"-> Error: {e}")

print("Warmup Complete.")
