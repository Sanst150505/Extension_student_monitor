"""
detectors/phone.py
------------------
Phone detection using YOLOv8 with:
- Brightness enhancement for dark frames
- Multi-class detection (cell phone + remote)
- Temporal smoothing to reduce flicker
"""

import cv2


def _try_import_yolo():
    try:
        from ultralytics import YOLO
        return YOLO
    except ImportError:
        print("[PhoneDetector] WARNING: ultralytics not installed. Phone detection disabled.")
        return None


class PhoneDetector:
    def __init__(self):
        YOLO = _try_import_yolo()
        # Use nano model for much faster inference (~6MB vs ~50MB)
        self.model = YOLO('yolov8n.pt') if YOLO else None

        # Temporal smoothing
        self.detect_count = 0
        self.frame_threshold = 4

        if self.model:
            import logging
            logging.getLogger("ultralytics").setLevel(logging.ERROR)

    def detect(self, frame):
        result = {"phone_detected": False, "phone_boxes": []}

        if not self.model:
            return result

        try:
            h, w, _ = frame.shape

            # Brightness boost only if frame is dark (saves CPU on bright frames)
            mean_brightness = frame.mean()
            if mean_brightness < 100:
                frame_input = cv2.convertScaleAbs(frame, alpha=1.2, beta=30)
            else:
                frame_input = frame

            # Use most of the frame (top 10% cropped to avoid ceiling/lights)
            # This catches phones held at face level AND lap level
            y_start = int(h * 0.1)
            roi = frame_input[y_start:h, :]

            # Detection
            res = self.model.predict(
                roi,
                imgsz=640,      # smaller = faster (was 960)
                conf=0.30,
                iou=0.5,
                verbose=False
            )

            if not res:
                return result

            boxes = res[0].boxes
            names = self.model.names

            y_offset = y_start

            for box in boxes:
                cls_id = int(box.cls[0].item())
                label = names[cls_id]
                conf = box.conf[0].item()

                # Only accept phone-like objects (removed "book" and "tv" — too many false positives)
                if label in ["cell phone", "remote"] and conf > 0.35:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()

                    # Adjust coordinates due to ROI crop
                    y1 += y_offset
                    y2 += y_offset

                    result["phone_boxes"].append(
                        (int(x1), int(y1), int(x2), int(y2), round(conf, 2), label)
                    )

            # Temporal smoothing — require sustained detection
            if len(result["phone_boxes"]) > 0:
                self.detect_count += 1
            else:
                self.detect_count = max(0, self.detect_count - 1)

            if self.detect_count >= self.frame_threshold:
                result["phone_detected"] = True
            else:
                result["phone_detected"] = False

        except Exception as e:
            print(f"[PhoneDetector] Error: {e}")

        return result


_detector = None

def detect_phone(frame):
    """Public API: returns {"phone_detected": bool, "phone_boxes": [...]}"""
    global _detector
    if _detector is None:
        _detector = PhoneDetector()
    return _detector.detect(frame)