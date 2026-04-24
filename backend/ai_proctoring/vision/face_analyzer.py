import cv2
import numpy as np
import urllib.request
import os
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class FaceAnalyzer:
    def __init__(self, max_faces=5):
        # 1. Initialize MediaPipe (Optimized ONLY for the primary candidate's head pose)
        self.mp_model_path = self._download_file(
            'face_landmarker.task',
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        )
        base_options = python.BaseOptions(model_asset_path=self.mp_model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=True, 
            num_faces=1, # We restrict this to 1 because the DNN handles the background
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5
        )
        self.landmarker = vision.FaceLandmarker.create_from_options(options)

        # 2. Initialize OpenCV Deep Neural Network (Ultra-accurate for background faces)
        self.prototxt_path = self._download_file(
            'deploy.prototxt',
            "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
        )
        self.caffemodel_path = self._download_file(
            'res10_300x300_ssd_iter_140000.caffemodel',
            "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"
        )
        self.dnn_net = cv2.dnn.readNetFromCaffe(self.prototxt_path, self.caffemodel_path)

    def _download_file(self, filename, url):
        if not os.path.exists(filename):
            print(f"Downloading {filename}...")
            urllib.request.urlretrieve(url, filename)
        return filename

    def analyze(self, frame):
        h, w = frame.shape[:2]
        analysis_data = {"face_count": 0, "faces": []}

        # --- STEP 1: Ultra-Accurate Face Detection using OpenCV DNN ---
        # Prepare the frame for the deep learning model
        blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
        self.dnn_net.setInput(blob)
        detections = self.dnn_net.forward()

        dnn_faces = []
        for i in range(0, detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            
            # 0.5 confidence threshold is highly accurate for this specific ResNet model
            if confidence > 0.5: 
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x_min, y_min, x_max, y_max = box.astype("int")
                
                # Prevent out-of-bounds bounding boxes
                x_min, y_min = max(0, x_min), max(0, y_min)
                x_max, y_max = min(w, x_max), min(h, y_max)
                
                dnn_faces.append({
                    "bbox": {"x_min": x_min, "y_min": y_min, "x_max": x_max, "y_max": y_max},
                    "pitch": 0, "yaw": 0, "area": (x_max - x_min) * (y_max - y_min)
                })

        analysis_data["face_count"] = len(dnn_faces)

        # Sort faces by size (area) descending. The largest face is assumed to be the candidate.
        dnn_faces = sorted(dnn_faces, key=lambda x: x["area"], reverse=True)

        # --- STEP 2: Head Pose Detection using MediaPipe (Main Candidate Only) ---
        if dnn_faces:
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            result = self.landmarker.detect(mp_image)
            
            # If MediaPipe successfully extracts the 3D matrix for the main face
            if result.facial_transformation_matrixes:
                pose_matrix = result.facial_transformation_matrixes[0]
                rotation_matrix = pose_matrix[:3, :3]
                angles, _, _, _, _, _ = cv2.RQDecomp3x3(rotation_matrix)
                
                # Assign pitch and yaw ONLY to the primary candidate (index 0)
                dnn_faces[0]["pitch"] = angles[0]
                dnn_faces[0]["yaw"] = angles[1]

        analysis_data["faces"] = dnn_faces
        return analysis_data