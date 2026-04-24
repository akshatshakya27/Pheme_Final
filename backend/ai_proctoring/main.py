import cv2
from vision.face_analyzer import FaceAnalyzer
from audio.audio_analyzer import AudioAnalyzer

def main():
    print("Initializing Vision Engine...")
    vision_analyzer = FaceAnalyzer(max_faces=5)
    
    print("Initializing Audio Engine...")
    # Adjust noise_tolerance here. Try 10-15 for a room with a ceiling fan.
    audio_analyzer = AudioAnalyzer(noise_tolerance=3) 
    audio_analyzer.start()
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access the webcam.")
        return

    print("System Active. Press 'q' to quit.")

    # Rule Configuration
    YAW_THRESHOLD = 20
    PITCH_THRESHOLD = 15

    try:
        while True:
            success, frame = cap.read()
            if not success:
                continue

            # --- 1. Fetch Data from Analyzers ---
            vision_results = vision_analyzer.analyze(frame)
            audio_results = audio_analyzer.get_audio_data()
            
            face_count = vision_results["face_count"]
            
            # --- 2. Default UI States ---
            status_text = "Status: Candidate Absent"
            status_color = (0, 0, 255) # Red
            vision_warning = ""
            audio_warning = ""

            # --- 3. Process Vision Rules ---
            for i, face in enumerate(vision_results["faces"]):
                bbox = face["bbox"]
                box_color = (0, 255, 0) if face_count == 1 else (0, 0, 255)
                cv2.rectangle(frame, (bbox["x_min"], bbox["y_min"]), (bbox["x_max"], bbox["y_max"]), box_color, 2)
                cv2.putText(frame, f"Person {i+1}", (bbox["x_min"], bbox["y_min"] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

            if face_count == 1:
                status_text = "Status: Presence Verified"
                status_color = (0, 255, 0)
                
                pitch = vision_results["faces"][0]["pitch"]
                yaw = vision_results["faces"][0]["yaw"]

                if yaw > YAW_THRESHOLD or yaw < -YAW_THRESHOLD:
                    vision_warning = "VISION ALERT: Looking away (Horiz)"
                    status_color = (0, 165, 255)
                elif pitch > PITCH_THRESHOLD or pitch < -PITCH_THRESHOLD:
                    vision_warning = "VISION ALERT: Looking away (Vert)"
                    status_color = (0, 165, 255)

            elif face_count > 1:
                status_text = f"ALERT: {face_count} Faces Detected!"
                status_color = (0, 0, 255)
                vision_warning = "VISION ALERT: Multiple people in frame"

            # --- 4. Process Audio Rules ---
            # --- 4. Process Audio Rules ---
            if audio_results["speech_alert"]:
                audio_warning = f"AUDIO ALERT: Human Speech! ({audio_results['speech_conf']})"
                status_color = (0, 0, 255) # Red for cheating/speaking
            elif audio_results["noise_alert"]:
                audio_warning = "AUDIO ALERT: Loud Background Noise"
                status_color = (0, 165, 255) # Orange for suspicious noise
                
            # --- 5. Draw UI Overlays ---
            # Main Status
            cv2.putText(frame, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)
            
            # Diagnostic Data (Top Right)
            cv2.putText(frame, f"Vol: {audio_results['volume']}", (450, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Base: {audio_results['baseline']}", (450, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
            cv2.putText(frame, f"Speech Prob: {audio_results['speech_conf']}", (450, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            if face_count == 1:
                 cv2.putText(frame, f"Pitch: {int(pitch)} Yaw: {int(yaw)}", (450, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # Warnings (Bottom Left)
            if vision_warning:
                cv2.putText(frame, vision_warning, (20, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            if audio_warning:
                cv2.putText(frame, audio_warning, (20, 440), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            cv2.imshow('AI Proctoring - Main Dashboard', frame)

            if cv2.waitKey(5) & 0xFF == ord('q'):
                break
                
    finally:
        # Ensure the microphone thread is killed when the app closes
        audio_analyzer.stop()
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()