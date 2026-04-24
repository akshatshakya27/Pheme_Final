from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import cv2
from vision.face_analyzer import FaceAnalyzer
from audio.audio_analyzer import AudioAnalyzer
import tempfile

app = FastAPI()

# Allow CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vision_analyzer = FaceAnalyzer(max_faces=5)
audio_analyzer = AudioAnalyzer(noise_tolerance=3)

@app.post("/analyze/frame")
async def analyze_frame(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})
    vision_results = vision_analyzer.analyze(frame)
    return vision_results

@app.post("/analyze/audio")
async def analyze_audio(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    # You may need to implement analyze_file in AudioAnalyzer for file-based analysis
    # For now, return dummy or current audio data
    audio_results = audio_analyzer.get_audio_data()  # Placeholder
    return audio_results

@app.get("/health")
def health():
    return {"status": "ok"}
