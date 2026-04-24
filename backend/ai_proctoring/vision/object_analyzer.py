from __future__ import annotations

from typing import Any

# Canonical labels we treat as suspicious exam objects.
DEFAULT_TARGETS = {
    "cell phone",
    "book",
    "laptop",
    "tv",
    "keyboard",
    "mouse",
    "tablet",
}

# Normalize model labels into one canonical class.
TARGET_LABEL_ALIASES = {
    "remote": "cell phone",
}


class ObjectAnalyzer:
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        conf: float = 0.35,
        imgsz: int = 640,
        targets: set[str] | None = None,
    ) -> None:
        from ultralytics import YOLO

        self.model = YOLO(model_path)
        self.conf = float(conf)
        self.imgsz = int(imgsz)

        model_names = {int(k): str(v) for k, v in self.model.names.items()}
        self._model_names = model_names
        model_label_values = set(model_names.values())

        canonical_targets = set(targets or DEFAULT_TARGETS)
        resolved_targets: set[str] = set()
        for label in canonical_targets:
            if label in model_label_values:
                resolved_targets.add(label)
                continue
            if any(src in model_label_values and dst == label for src, dst in TARGET_LABEL_ALIASES.items()):
                resolved_targets.add(label)

        self.targets = resolved_targets

    def analyze(self, frame: Any) -> dict[str, Any]:
        if not self.targets:
            return {"counts": {}, "detected_labels": [], "detections": []}

        results = self.model.predict(frame, conf=self.conf, imgsz=self.imgsz, verbose=False)
        if not results:
            return {"counts": {}, "detected_labels": [], "detections": []}

        result = results[0]
        if result.boxes is None or len(result.boxes) == 0:
            return {"counts": {}, "detected_labels": [], "detections": []}

        class_ids = result.boxes.cls.int().tolist()
        confidences = result.boxes.conf.tolist()
        boxes_xyxy = result.boxes.xyxy.tolist()

        counts: dict[str, int] = {}
        detections: list[dict[str, Any]] = []

        for class_id, confidence, bbox in zip(class_ids, confidences, boxes_xyxy):
            raw_name = self._model_names.get(class_id, "")
            canonical_name = TARGET_LABEL_ALIASES.get(raw_name, raw_name)
            if canonical_name not in self.targets:
                continue

            counts[canonical_name] = counts.get(canonical_name, 0) + 1
            detections.append(
                {
                    "label": canonical_name,
                    "confidence": float(confidence),
                    "bbox": [int(v) for v in bbox],
                }
            )

        return {
            "counts": counts,
            "detected_labels": sorted(counts.keys()),
            "detections": detections,
        }
