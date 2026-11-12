"""
Palmora AI — Hand Landmarker Engine (MediaPipe HandMesh Integration)
Provides 21 3D hand keypoints, dynamic anatomical ROIs, and depth plane fitting.
"""

import os
import math
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("palmora.cv.landmarker")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "hand_landmarker.task")

# Landmark Index Constants
WRIST = 0
THUMB_CMC = 1
THUMB_MCP = 2
THUMB_IP = 3
THUMB_TIP = 4
INDEX_MCP = 5
INDEX_PIP = 6
INDEX_DIP = 7
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_PIP = 10
MIDDLE_DIP = 11
MIDDLE_TIP = 12
RING_MCP = 13
RING_PIP = 14
RING_DIP = 15
RING_TIP = 16
PINKY_MCP = 17
PINKY_PIP = 18
PINKY_DIP = 19
PINKY_TIP = 20


@dataclass
class DynamicROI:
    name: str
    center_px: Tuple[float, float]
    radius_px: float
    center_norm: Tuple[float, float]
    radius_norm: float
    depth_z: float
    confidence: float


@dataclass
class HandLandmarksData:
    landmarks_px: List[Tuple[float, float]]
    landmarks_norm: List[Tuple[float, float]]
    landmarks_3d: List[Tuple[float, float, float]]  # (x, y, z)
    handedness: str  # 'left' or 'right'
    handedness_confidence: float
    detection_confidence: float
    palm_center_px: Tuple[float, float]
    palm_radius_px: float
    palm_width_px: float
    hand_orientation_deg: float
    dynamic_mount_rois: Dict[str, DynamicROI]
    knuckle_arch: List[Tuple[float, float]]
    first_web_space: Tuple[float, float]
    saturn_axis_vector: Tuple[float, float]
    surface_plane_normal: Tuple[float, float, float]


_detector_instance = None


def get_hand_landmarker():
    """Lazily initializes and caches the MediaPipe HandLandmarker."""
    global _detector_instance
    if _detector_instance is not None:
        return _detector_instance

    if not os.path.exists(MODEL_PATH):
        logger.warning(f"MediaPipe hand_landmarker.task not found at {MODEL_PATH}")
        return None

    try:
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=1,
            min_hand_detection_confidence=0.35,
            min_hand_presence_confidence=0.35,
            min_tracking_confidence=0.35
        )
        _detector_instance = vision.HandLandmarker.create_from_options(options)
        logger.info("MediaPipe HandLandmarker initialized successfully.")
        return _detector_instance
    except Exception as e:
        logger.warning(f"Failed to initialize MediaPipe HandLandmarker: {e}")
        return None


def detect_hand_landmarks(bgr_image: np.ndarray) -> Optional[HandLandmarksData]:
    """
    Runs MediaPipe HandMesh on the provided BGR image.
    Extracts 21 3D landmarks, calculates depth plane, and builds dynamic anatomical ROIs.
    Returns None if detection fails, allowing fallback to contour morphology.
    """
    detector = get_hand_landmarker()
    if detector is None:
        return None

    h, w = bgr_image.shape[:2]
    try:
        import mediapipe as mp
        rgb_img = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
        res = detector.detect(mp_img)

        if not res.hand_landmarks or len(res.hand_landmarks) == 0:
            return None

        lms = res.hand_landmarks[0]
        handedness_info = res.handedness[0][0] if res.handedness else None
        
        # Note: MediaPipe mirrors handedness for palm-facing camera
        mp_label = handedness_info.category_name.lower() if handedness_info else "right"
        hand_side = "left" if mp_label == "right" else "right"
        hand_conf = float(handedness_info.score) if handedness_info else 0.85

        landmarks_px = [(float(lm.x * w), float(lm.y * h)) for lm in lms]
        landmarks_norm = [(float(lm.x), float(lm.y)) for lm in lms]
        landmarks_3d = [(float(lm.x), float(lm.y), float(lm.z)) for lm in lms]

        # 1. Palm Center & Radius from landmark geometry
        # Palm center is centroid of wrist and MCP knuckles [0, 5, 9, 13, 17]
        mcp_pts = np.array([landmarks_px[i] for i in [INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP, WRIST]])
        palm_cx = float(np.mean(mcp_pts[:, 0]))
        palm_cy = float(np.mean(mcp_pts[:, 1]))
        
        # Palm width: distance between INDEX_MCP and PINKY_MCP
        palm_width_px = float(math.hypot(
            landmarks_px[INDEX_MCP][0] - landmarks_px[PINKY_MCP][0],
            landmarks_px[INDEX_MCP][1] - landmarks_px[PINKY_MCP][1]
        ))
        palm_radius_px = max(15.0, palm_width_px * 0.52)

        # 2. Hand Orientation Angle: Vector from WRIST (0) to MIDDLE_MCP (9)
        vx = landmarks_px[MIDDLE_MCP][0] - landmarks_px[WRIST][0]
        vy = landmarks_px[MIDDLE_MCP][1] - landmarks_px[WRIST][1]
        raw_angle = math.degrees(math.atan2(vy, vx))
        orientation_deg = (raw_angle + 90.0) % 360.0
        if orientation_deg > 180.0:
            orientation_deg -= 360.0

        # 3. Reference Surface Plane Fitting for Depth
        # Fit plane across WRIST (0), INDEX_MCP (5), PINKY_MCP (17) in 3D
        p0 = np.array(landmarks_3d[WRIST])
        p5 = np.array(landmarks_3d[INDEX_MCP])
        p17 = np.array(landmarks_3d[PINKY_MCP])
        v1 = p5 - p0
        v2 = p17 - p0
        norm_vec = np.cross(v1, v2)
        norm_len = np.linalg.norm(norm_vec)
        if norm_len > 1e-6:
            surface_normal = tuple(norm_vec / norm_len)
        else:
            surface_normal = (0.0, 0.0, 1.0)

        # 4. Knuckle Arch Polyline
        knuckle_arch = [landmarks_px[INDEX_MCP], landmarks_px[MIDDLE_MCP], landmarks_px[RING_MCP], landmarks_px[PINKY_MCP]]

        # 5. First Web Space Cleft (Radial Anchor)
        # Midpoint between Thumb MCP (2) and Index MCP (5)
        first_web_x = (landmarks_px[THUMB_MCP][0] + landmarks_px[INDEX_MCP][0]) / 2.0
        first_web_y = (landmarks_px[THUMB_MCP][1] + landmarks_px[INDEX_MCP][1]) / 2.0
        first_web_space = (first_web_x, first_web_y)

        # 6. Saturn Axis Vector (Direction for Fate Line)
        saturn_dx = landmarks_px[MIDDLE_MCP][0] - landmarks_px[WRIST][0]
        saturn_dy = landmarks_px[MIDDLE_MCP][1] - landmarks_px[WRIST][1]
        saturn_len = max(math.hypot(saturn_dx, saturn_dy), 1.0)
        saturn_axis = (saturn_dx / saturn_len, saturn_dy / saturn_len)

        # 7. Dynamic Mount ROIs directly anchored to landmarks:
        # Distance between adjacent knuckles gives scale
        inter_knuckle = max(10.0, palm_width_px / 3.2)
        sub_digital_radius = inter_knuckle * 0.52

        # Sub-digital mounts sit immediately proximal to (beneath) their respective MCP knuckle
        # We step downwards along the wrist-to-MCP vector
        def get_sub_digital_center(mcp_idx: int) -> Tuple[float, float, float]:
            mcp_x, mcp_y = landmarks_px[mcp_idx]
            wrist_x, wrist_y = landmarks_px[WRIST]
            dx = wrist_x - mcp_x
            dy = wrist_y - mcp_y
            dist = max(math.hypot(dx, dy), 1.0)
            step = inter_knuckle * 0.40
            cx = mcp_x + (dx / dist) * step
            cy = mcp_y + (dy / dist) * step
            z = landmarks_3d[mcp_idx][2]
            return cx, cy, z

        j_cx, j_cy, j_z = get_sub_digital_center(INDEX_MCP)
        s_cx, s_cy, s_z = get_sub_digital_center(MIDDLE_MCP)
        a_cx, a_cy, a_z = get_sub_digital_center(RING_MCP)
        m_cx, m_cy, m_z = get_sub_digital_center(PINKY_MCP)

        # Mount of Venus: Center of Thenar pad between WRIST (0), THUMB_CMC (1), and THUMB_MCP (2)
        v_pts = np.array([landmarks_px[WRIST], landmarks_px[THUMB_CMC], landmarks_px[THUMB_MCP], (palm_cx, palm_cy)])
        venus_cx = float(np.mean(v_pts[:, 0]))
        venus_cy = float(np.mean(v_pts[:, 1]))
        venus_rad = inter_knuckle * 1.05
        venus_z = float(landmarks_3d[THUMB_CMC][2] + landmarks_3d[THUMB_MCP][2]) / 2.0

        # Mount of Moon: Hypothenar cushion opposite to Venus (ulnar side near wrist)
        moon_pts = np.array([landmarks_px[WRIST], landmarks_px[PINKY_MCP], (palm_cx, palm_cy)])
        moon_cx = float(np.mean(moon_pts[:, 0]))
        moon_cy = float(np.mean(moon_pts[:, 1]))
        moon_rad = inter_knuckle * 0.88
        moon_z = float(landmarks_3d[PINKY_MCP][2] + landmarks_3d[WRIST][2]) / 2.0

        dynamic_mounts = {
            "jupiter": DynamicROI("Mount of Jupiter", (j_cx, j_cy), sub_digital_radius, (j_cx / w, j_cy / h), sub_digital_radius / w, j_z, 0.94),
            "saturn": DynamicROI("Mount of Saturn", (s_cx, s_cy), sub_digital_radius, (s_cx / w, s_cy / h), sub_digital_radius / w, s_z, 0.94),
            "apollo": DynamicROI("Mount of Apollo (Sun)", (a_cx, a_cy), sub_digital_radius, (a_cx / w, a_cy / h), sub_digital_radius / w, a_z, 0.94),
            "mercury": DynamicROI("Mount of Mercury", (m_cx, m_cy), sub_digital_radius, (m_cx / w, m_cy / h), sub_digital_radius / w, m_z, 0.94),
            "venus": DynamicROI("Mount of Venus (Thenar)", (venus_cx, venus_cy), venus_rad, (venus_cx / w, venus_cy / h), venus_rad / w, venus_z, 0.96),
            "moon": DynamicROI("Mount of Moon (Hypothenar)", (moon_cx, moon_cy), moon_rad, (moon_cx / w, moon_cy / h), moon_rad / w, moon_z, 0.92),
        }

        return HandLandmarksData(
            landmarks_px=landmarks_px,
            landmarks_norm=landmarks_norm,
            landmarks_3d=landmarks_3d,
            handedness=hand_side,
            handedness_confidence=hand_conf,
            detection_confidence=0.95,
            palm_center_px=(palm_cx, palm_cy),
            palm_radius_px=palm_radius_px,
            palm_width_px=palm_width_px,
            hand_orientation_deg=orientation_deg,
            dynamic_mount_rois=dynamic_mounts,
            knuckle_arch=knuckle_arch,
            first_web_space=first_web_space,
            saturn_axis_vector=saturn_axis,
            surface_plane_normal=surface_normal
        )
    except Exception as e:
        logger.warning(f"Hand landmarking pipeline encountered an issue: {e}")
        return None
