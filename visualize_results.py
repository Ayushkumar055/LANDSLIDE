import cv2
import numpy as np
import matplotlib.pyplot as plt

pre = cv2.imread("pre_event.jpg")
post = cv2.imread("post_event.jpg")
mask = cv2.imread("clean_landslide_mask.png", cv2.IMREAD_GRAYSCALE)

pre_rgb = cv2.cvtColor(pre, cv2.COLOR_BGR2RGB)
post_rgb = cv2.cvtColor(post, cv2.COLOR_BGR2RGB)

# Connect disconnected channel fragments
kernel = np.ones((7, 7), np.uint8)
closed_mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
cleaned_mask = cv2.morphologyEx(closed_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

# Overlay
overlay = post_rgb.copy()
overlay[cleaned_mask > 0] = [255, 30, 30]
blended = cv2.addWeighted(post_rgb, 0.55, overlay, 0.45, 0)

# Filter out minor noise specks (Keep only massive debris flows)
contours, _ = cv2.findContours(cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
major_scars = 0

for cnt in contours:
    area = cv2.contourArea(cnt)
    if area > 220:  # Higher threshold removes noise on top-right
        x, y, w, h = cv2.boundingRect(cnt)
        cv2.rectangle(blended, (x, y), (x + w, y + h), (255, 230, 0), 2)
        cv2.putText(blended, f"Debris Flow (Area: {int(area)})", (x, max(y - 8, 15)), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
        major_scars += 1

print(f"✅ Major Landslide Debris Flows Isolated: {major_scars}")

# Plot
fig, axes = plt.subplots(1, 3, figsize=(18, 6))

axes[0].imshow(pre_rgb)
axes[0].set_title("1. Pre-Event (Baseline Terrain)", fontsize=12, fontweight="bold")
axes[0].axis("off")

axes[1].imshow(post_rgb)
axes[1].set_title("2. Post-Event (Visible Debris Flow)", fontsize=12, fontweight="bold")
axes[1].axis("off")

axes[2].imshow(blended)
axes[2].set_title(f"3. AI Detection ({major_scars} Major Zones Confirmed)", fontsize=12, fontweight="bold", color="red")
axes[2].axis("off")

plt.tight_layout()
plt.savefig("landslide_detection_report.png", dpi=300, bbox_inches="tight")
plt.show()