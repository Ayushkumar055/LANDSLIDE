import os
import requests
import numpy as np
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("SH_CLIENT_ID")
CLIENT_SECRET = os.getenv("SH_CLIENT_SECRET")

# 1. Token Endpoint
token_res = requests.post(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    data={"grant_type": "client_credentials", "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = token_res.json().get("access_token")

# 2. Fetch RGB Image with Mosaicking
def fetch_rgb(start_date, end_date, filename):
    evalscript = """//VERSION=3
    function setup() {
      return { input: ["B02", "B03", "B04"], output: { bands: 3 } };
    }
    function evaluatePixel(sample) {
      return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
    }
    """
    payload = {
        "input": {
            "bounds": {"bbox": [76.10, 11.45, 76.25, 11.55]},
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": {"from": start_date, "to": end_date},
                    "maxCloudCoverage": 50,
                    "mosaickingOrder": "leastCC"
                }
            }]
        },
        "output": {
            "width": 512,
            "height": 512,
            "responses": [{"identifier": "default", "format": {"type": "image/jpeg"}}]
        },
        "evalscript": evalscript
    }
    res = requests.post(
        "https://sh.dataspace.copernicus.eu/api/v1/process",
        json=payload,
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if res.status_code == 200:
        with open(filename, "wb") as f:
            f.write(res.content)
        return np.array(Image.open(BytesIO(res.content)))
    return None

print("Fetching pre/post composites...")
pre_img = fetch_rgb("2024-01-15T00:00:00Z", "2024-03-30T23:59:59Z", "pre_event.jpg")
post_img = fetch_rgb("2024-08-01T00:00:00Z", "2024-12-31T23:59:59Z", "post_event.jpg")

if pre_img is not None and post_img is not None:
    red_increase = post_img[:, :, 0].astype(float) - pre_img[:, :, 0].astype(float)
    bright_increase = post_img.astype(float).mean(axis=2) - pre_img.astype(float).mean(axis=2)
    cloud_noise = (pre_img[:, :, 0] > 180) & (pre_img[:, :, 1] > 180)

    scar_mask = (red_increase > 14) & (bright_increase > 10) & (~cloud_noise)
    mask_uint8 = np.where(scar_mask, 255, 0).astype(np.uint8)
    
    Image.fromarray(mask_uint8).save("clean_landslide_mask.png")
    print("✅ clean_landslide_mask.png generated!")