import argparse
import json
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set

import cv2
from ultralytics import YOLO


# Canonical labels to track and report.
DEFAULT_TARGETS = {
    "cell phone",
    "book",
    "laptop",
    "tv",
    "keyboard",
    "mouse",
    "tablet",
}

# Aliases map model labels into canonical categories.
# Example requested: treat "remote" as "cell phone".
TARGET_LABEL_ALIASES = {
    "remote": "cell phone",
}


@dataclass
class ItemStats:
    times_observed: int = 0
    frames_detected: int = 0
    max_simultaneous: int = 0
    currently_present: bool = False
    absent_streak: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Live exam environment monitor using YOLO")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path or model name")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    parser.add_argument("--target-fps", type=int, default=30, help="Requested camera FPS (e.g. 30 or 60)")
    parser.add_argument("--width", type=int, default=1280, help="Requested camera frame width")
    parser.add_argument("--height", type=int, default=720, help="Requested camera frame height")
    parser.add_argument("--imgsz", type=int, default=640, help="YOLO inference image size")
    parser.add_argument(
        "--absence-frames",
        type=int,
        default=12,
        help="Frames an item must be absent before counting a new observation",
    )
    parser.add_argument(
        "--summary-json",
        default="monitor_summary.json",
        help="Path to write summary JSON on exit",
    )
    return parser.parse_args()


def update_stats(
    stats: Dict[str, ItemStats],
    present_counts: Dict[str, int],
    targets: Set[str],
    absence_frames: int,
) -> None:
    for item in targets:
        item_stats = stats[item]
        count = present_counts.get(item, 0)

        if count > 0:
            item_stats.frames_detected += 1
            item_stats.max_simultaneous = max(item_stats.max_simultaneous, count)

            if (not item_stats.currently_present) and item_stats.absent_streak >= absence_frames:
                item_stats.times_observed += 1

            item_stats.currently_present = True
            item_stats.absent_streak = 0
        else:
            item_stats.currently_present = False
            item_stats.absent_streak += 1


def draw_overlay(frame, present_counts: Dict[str, int], stats: Dict[str, ItemStats]) -> None:
    y = 24
    cv2.putText(
        frame,
        "Exam Environment Monitor | Press Q to quit",
        (12, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.62,
        (40, 240, 40),
        2,
        cv2.LINE_AA,
    )
    y += 28

    if not present_counts:
        cv2.putText(
            frame,
            "No target items currently detected",
            (12, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (220, 220, 220),
            2,
            cv2.LINE_AA,
        )
        return

    cv2.putText(
        frame,
        "Currently visible:",
        (12, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (0, 200, 255),
        2,
        cv2.LINE_AA,
    )
    y += 24

    for name, count in sorted(present_counts.items()):
        line = f"- {name}: now={count}, observed={stats[name].times_observed}"
        cv2.putText(
            frame,
            line,
            (12, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
        y += 22


def draw_target_boxes(
    frame,
    result,
    model_names: Dict[int, str],
    target_labels: Set[str],
) -> None:
    """Draw boxes only for configured target labels."""
    if result.boxes is None or len(result.boxes) == 0:
        return

    boxes_xyxy = result.boxes.xyxy.tolist()
    class_ids = result.boxes.cls.int().tolist()
    confidences = result.boxes.conf.tolist()

    for box, class_id, conf in zip(boxes_xyxy, class_ids, confidences):
        raw_name = model_names.get(class_id, "")
        canonical_name = TARGET_LABEL_ALIASES.get(raw_name, raw_name)
        if canonical_name not in target_labels:
            continue

        x1, y1, x2, y2 = [int(v) for v in box]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 255), 2)
        cv2.putText(
            frame,
            f"{canonical_name} {conf:.2f}",
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 220, 255),
            2,
            cv2.LINE_AA,
        )


def summary_dict(stats: Dict[str, ItemStats]) -> Dict[str, Dict[str, int]]:
    output: Dict[str, Dict[str, int]] = {}
    for name, data in sorted(stats.items()):
        output[name] = {
            "times_observed": data.times_observed,
            "frames_detected": data.frames_detected,
            "max_simultaneous": data.max_simultaneous,
        }
    return output


def main() -> None:
    args = parse_args()
    model = YOLO(args.model)

    if cv2.CAP_DSHOW:
        capture = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    else:
        capture = cv2.VideoCapture(args.camera)

    capture.set(cv2.CAP_PROP_FPS, float(args.target_fps))
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, float(args.width))
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, float(args.height))
    capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not capture.isOpened():
        raise RuntimeError(f"Could not open camera index {args.camera}")

    model_names = {int(k): v for k, v in model.names.items()}
    model_label_values = set(model_names.values())
    available_canonical_targets = {
        label
        for label in DEFAULT_TARGETS
        if (label in model_label_values) or (label in TARGET_LABEL_ALIASES.values())
    }

    # Keep only targets that the model can produce directly or through aliases.
    targets = set()
    for label in available_canonical_targets:
        if label in model_label_values:
            targets.add(label)
            continue
        # Canonical label provided only via alias source labels.
        if any(src in model_label_values and dst == label for src, dst in TARGET_LABEL_ALIASES.items()):
            targets.add(label)

    if not targets:
        capture.release()
        raise RuntimeError("None of the configured target classes exist in this model.")

    stats: Dict[str, ItemStats] = defaultdict(lambda: ItemStats(absent_streak=args.absence_frames))

    last_fps_time = time.time()
    frame_count = 0
    fps = 0.0

    while True:
        ok, frame = capture.read()
        if not ok:
            break

        frame_count += 1
        now = time.time()
        if now - last_fps_time >= 1.0:
            fps = frame_count / (now - last_fps_time)
            frame_count = 0
            last_fps_time = now

        results = model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)
        result = results[0]

        present_counts: Dict[str, int] = defaultdict(int)

        if result.boxes is not None and len(result.boxes) > 0:
            class_ids: List[int] = result.boxes.cls.int().tolist()
            for class_id in class_ids:
                class_name = model_names.get(class_id, "")
                canonical_name = TARGET_LABEL_ALIASES.get(class_name, class_name)
                if canonical_name in targets:
                    present_counts[canonical_name] += 1

        update_stats(stats, present_counts, targets, args.absence_frames)

        annotated = frame.copy()
        draw_target_boxes(annotated, result, model_names, targets)
        draw_overlay(annotated, present_counts, stats)
        cv2.putText(
            annotated,
            f"FPS: {fps:.1f}",
            (12, annotated.shape[0] - 16),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        cv2.imshow("Exam Environment Monitor", annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    capture.release()
    cv2.destroyAllWindows()

    summary = summary_dict(stats)
    output_path = Path(args.summary_json)
    output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    actual_fps = capture.get(cv2.CAP_PROP_FPS)
    print(f"Requested FPS: {args.target_fps} | Camera reported FPS: {actual_fps:.1f}")

    print("\nDetection summary:")
    for item, item_summary in summary.items():
        print(
            f"{item}: times_observed={item_summary['times_observed']}, "
            f"frames_detected={item_summary['frames_detected']}, "
            f"max_simultaneous={item_summary['max_simultaneous']}"
        )
    print(f"\nSummary written to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
