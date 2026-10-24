import cv2
import numpy as np
import pytest

@pytest.fixture
def synthetic_palm_image_bytes() -> bytes:
    """Generates a realistic synthetic hand/palm image with skin color and creases."""
    w, h = 600, 600
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Background: dark neutral
    img[:] = (30, 25, 20)

    # Hand shape: palm disk + fingers
    skin_bgr = (150, 180, 220)  # Typical light skin BGR

    # Draw palm center
    cv2.circle(img, (300, 350), 180, skin_bgr, -1)
    # Draw thumb protrusion
    cv2.ellipse(img, (180, 420), (70, 110), 45, 0, 360, skin_bgr, -1)
    # Draw fingers
    cv2.ellipse(img, (220, 170), (40, 110), 0, 0, 360, skin_bgr, -1)  # Index
    cv2.ellipse(img, (300, 140), (42, 130), 0, 0, 360, skin_bgr, -1)  # Middle
    cv2.ellipse(img, (380, 160), (40, 120), 0, 0, 360, skin_bgr, -1)  # Ring
    cv2.ellipse(img, (450, 210), (35, 90), 15, 0, 360, skin_bgr, -1)  # Pinky

    # Creases (darker ridges in BGR: e.g. (90, 120, 160))
    crease_color = (90, 120, 160)
    # Heart line: upper transverse curve
    pts_heart = np.array([[460, 290], [380, 300], [300, 295], [240, 270]], np.int32)
    cv2.polylines(img, [pts_heart], isClosed=False, color=crease_color, thickness=3)

    # Head line: mid transverse curve
    pts_head = np.array([[220, 330], [280, 350], [360, 370], [420, 390]], np.int32)
    cv2.polylines(img, [pts_head], isClosed=False, color=crease_color, thickness=3)

    # Life line: radial arch around thenar
    pts_life = np.array([[220, 330], [240, 390], [270, 460], [300, 510]], np.int32)
    cv2.polylines(img, [pts_life], isClosed=False, color=crease_color, thickness=3)

    # Add gentle Gaussian smoothing
    img = cv2.GaussianBlur(img, (3, 3), 0)

    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()

@pytest.fixture
def blank_image_bytes() -> bytes:
    """A blank black image with no hand."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()

@pytest.fixture
def blurry_image_bytes() -> bytes:
    """An image with extreme Gaussian blur causing low Laplacian variance."""
    img = np.full((400, 400, 3), 128, dtype=np.uint8)
    img = cv2.GaussianBlur(img, (31, 31), 20)
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()

@pytest.fixture
def invalid_bytes() -> bytes:
    """Non-image garbage bytes."""
    return b"not-a-valid-image-content-header"
