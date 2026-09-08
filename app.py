import os
import io
import math
import cv2
import requests
import numpy as np
from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, HTMLResponse, JSONResponse

load_dotenv()

app = FastAPI(
    title="Landslide Detection & Hazard Assessment System",
    description="Real-time Landslide Scar Detection with Real-World Geo-Coordinates, Impact Area & Interactive Dashboard"
)

CLIENT_ID = os.getenv("SH_CLIENT_ID")
CLIENT_SECRET = os.getenv("SH_CLIENT_SECRET")

def get_auth_token():
    token_url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    res = requests.post(
        token_url,
        data={"grant_type": "client_credentials", "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="CDSE Authentication failed")
    return res.json().get("access_token")

def fetch_satellite_composite(bbox, start_date, end_date, token):
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
            "bounds": {"bbox": bbox},
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
        headers={"Authorization": f"Bearer {token}"}
    )
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=f"Sentinel API error: {res.text}")
    return np.array(Image.open(io.BytesIO(res.content)))

def pixel_to_geo(x, y, bbox, width=512, height=512):
    min_lon, min_lat, max_lon, max_lat = bbox
    lon = min_lon + (x / width) * (max_lon - min_lon)
    lat = max_lat - (y / height) * (max_lat - min_lat)
    return round(lat, 6), round(lon, 6)

def calculate_ground_resolution(bbox, width=512, height=512):
    min_lon, min_lat, max_lon, max_lat = bbox
    center_lat = (min_lat + max_lat) / 2.0
    m_per_deg_lat = 111132.954 - 559.822 * math.cos(2 * math.radians(center_lat))
    m_per_deg_lon = 111412.84 * math.cos(math.radians(center_lat))
    
    total_width_m = (max_lon - min_lon) * m_per_deg_lon
    total_height_m = (max_lat - min_lat) * m_per_deg_lat
    return (total_width_m / width) * (total_height_m / height)

def process_detection(pre_img, post_img, bbox):
    red_increase = post_img[:, :, 0].astype(float) - pre_img[:, :, 0].astype(float)
    bright_increase = post_img.astype(float).mean(axis=2) - pre_img.astype(float).mean(axis=2)
    cloud_noise = (pre_img[:, :, 0] > 180) & (pre_img[:, :, 1] > 180)

    scar_mask = (red_increase > 14) & (bright_increase > 10) & (~cloud_noise)
    mask_uint8 = np.where(scar_mask, 255, 0).astype(np.uint8)

    kernel = np.ones((7, 7), np.uint8)
    closed = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    post_rgb = post_img.copy()
    overlay = post_rgb.copy()
    overlay[cleaned > 0] = [255, 30, 30]
    blended = cv2.addWeighted(post_rgb, 0.55, overlay, 0.45, 0)

    pixel_area_m2 = calculate_ground_resolution(bbox)

    detections = []
    for cnt in contours:
        area_px = cv2.contourArea(cnt)
        if area_px > 200:
            x, y, w, h = cv2.boundingRect(cnt)
            area_m2 = round(area_px * pixel_area_m2, 2)
            area_hectares = round(area_m2 / 10000.0, 3)

            center_x = x + w / 2.0
            center_y = y + h / 2.0
            center_lat, center_lon = pixel_to_geo(center_x, center_y, bbox)

            nw_lat, nw_lon = pixel_to_geo(x, y, bbox)
            se_lat, se_lon = pixel_to_geo(x + w, y + h, bbox)

            cv2.rectangle(blended, (x, y), (x + w, y + h), (255, 230, 0), 2)
            cv2.putText(blended, f"{area_hectares} ha", (x, max(y - 6, 12)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 0), 1)

            detections.append({
                "center_gps": {"latitude": center_lat, "longitude": center_lon},
                "geo_bounds": {
                    "north_west": {"lat": nw_lat, "lon": nw_lon},
                    "south_east": {"lat": se_lat, "lon": se_lon}
                },
                "estimated_area": {
                    "square_meters": area_m2,
                    "hectares": area_hectares,
                    "pixel_count": int(area_px)
                }
            })

    return blended, detections

@app.get("/")
def root():
    return {"status": "online", "message": "Landslide Hazard Assessment Service Ready"}

@app.get("/detect/summary")
def get_detection_summary(
    min_lon: float = 76.10, min_lat: float = 11.45,
    max_lon: float = 76.25, max_lat: float = 11.55
):
    token = get_auth_token()
    bbox = [min_lon, min_lat, max_lon, max_lat]
    pre = fetch_satellite_composite(bbox, "2024-01-15T00:00:00Z", "2024-03-30T23:59:59Z", token)
    post = fetch_satellite_composite(bbox, "2024-08-01T00:00:00Z", "2024-12-31T23:59:59Z", token)
    _, detections = process_detection(pre, post, bbox)

    total_damage_ha = round(sum(d["estimated_area"]["hectares"] for d in detections), 3)

    return {
        "status": "success",
        "bbox": bbox,
        "scars_detected": len(detections),
        "total_estimated_damage_hectares": total_damage_ha,
        "detections": detections
    }

@app.get("/detect/visualize")
def get_visual_result(
    min_lon: float = 76.10, min_lat: float = 11.45,
    max_lon: float = 76.25, max_lat: float = 11.55
):
    token = get_auth_token()
    bbox = [min_lon, min_lat, max_lon, max_lat]
    pre = fetch_satellite_composite(bbox, "2024-01-15T00:00:00Z", "2024-03-30T23:59:59Z", token)
    post = fetch_satellite_composite(bbox, "2024-08-01T00:00:00Z", "2024-12-31T23:59:59Z", token)
    blended, _ = process_detection(pre, post, bbox)

    bgr = cv2.cvtColor(blended, cv2.COLOR_RGB2BGR)
    _, encoded = cv2.imencode(".jpg", bgr)
    return Response(content=encoded.tobytes(), media_type="image/jpeg")

# 1. GeoJSON Export (QGIS & Google Earth ready)
@app.get("/export/geojson")
def export_geojson(
    min_lon: float = 76.10, min_lat: float = 11.45,
    max_lon: float = 76.25, max_lat: float = 11.55
):
    token = get_auth_token()
    bbox = [min_lon, min_lat, max_lon, max_lat]
    pre = fetch_satellite_composite(bbox, "2024-01-15T00:00:00Z", "2024-03-30T23:59:59Z", token)
    post = fetch_satellite_composite(bbox, "2024-08-01T00:00:00Z", "2024-12-31T23:59:59Z", token)
    _, detections = process_detection(pre, post, bbox)

    features = []
    for idx, d in enumerate(detections, start=1):
        nw = d["geo_bounds"]["north_west"]
        se = d["geo_bounds"]["south_east"]
        
        # Polygon bounding coordinates [lon, lat]
        polygon_coords = [[
            [nw["lon"], nw["lat"]],
            [se["lon"], nw["lat"]],
            [se["lon"], se["lat"]],
            [nw["lon"], se["lat"]],
            [nw["lon"], nw["lat"]]
        ]]

        feature = {
            "type": "Feature",
            "properties": {
                "scar_id": idx,
                "area_hectares": d["estimated_area"]["hectares"],
                "area_sq_meters": d["estimated_area"]["square_meters"],
                "center_lat": d["center_gps"]["latitude"],
                "center_lon": d["center_gps"]["longitude"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon_coords
            }
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "name": "Landslide_Impact_Zones",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features
    }
    return JSONResponse(content=geojson)

# 2. Interactive Leaflet Web Dashboard
@app.get("/dashboard", response_class=HTMLResponse)
def get_dashboard():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Landslide AI Live Dashboard</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
            body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #111; color: #fff; }
            #header { padding: 12px 20px; background: #1e1e1e; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; }
            #header h2 { margin: 0; font-size: 18px; color: #ff4757; }
            #stats { font-size: 14px; color: #ccc; }
            #container { display: flex; height: calc(100vh - 58px); }
            #map { flex: 2; height: 100%; }
            #sidebar { flex: 1; padding: 20px; background: #181818; overflow-y: auto; border-left: 1px solid #333; }
            .card { background: #242424; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #ff4757; }
            .card h4 { margin: 0 0 8px 0; color: #ffa502; font-size: 15px; }
            .btn { display: inline-block; background: #2ed573; color: #111; padding: 8px 14px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 13px; margin-top: 10px; }
            img.preview { width: 100%; border-radius: 6px; margin-top: 10px; border: 1px solid #444; }
        </style>
    </head>
    <body>
        <div id="header">
            <h2>⚠️ Landslide Hazard Monitoring System</h2>
            <div id="stats">Analyzing Sentinel-2 Imagery...</div>
        </div>
        <div id="container">
            <div id="map"></div>
            <div id="sidebar">
                <h3>Detection Summary</h3>
                <div id="scars-list">Loading real-time ground metrics...</div>
                <hr style="border-color:#333; margin:20px 0;">
                <a class="btn" href="/export/geojson" target="_blank">📥 Export GeoJSON (GIS)</a>
                <h4 style="margin-top:20px;">AI Segmentation Output</h4>
                <img src="/detect/visualize" class="preview" alt="Satellite Overlay" />
            </div>
        </div>

       <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            // 1. Initialize map centered directly on Wayanad at zoom level 13
            var map = L.map('map').setView([11.49, 76.15], 13);

            var esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18,
                attribution: 'Tiles &copy; Esri'
            }).addTo(map);

            var labelsOverlay = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18
            }).addTo(map);

            // 2. Fetch GeoJSON Data
            fetch('/export/geojson')
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    var totalArea = 0;
                    var listHtml = '';

                    var scarLayer = L.geoJSON(data, {
                        style: {
                            color: '#ff2d55',
                            weight: 3,
                            fillColor: '#ff2d55',
                            fillOpacity: 0.45
                        },
                        onEachFeature: function(feature, layer) {
                            var p = feature.properties;
                            totalArea += p.area_hectares;

                            var popup = '<div style="color:#111; font-family:sans-serif;">' +
                                        '<h4 style="margin:0 0 5px; color:#c0392b;">Landslide Zone #' + p.scar_id + '</h4>' +
                                        '<b>Area:</b> ' + p.area_hectares + ' ha<br>' +
                                        '<b>Size:</b> ' + p.area_sq_meters.toLocaleString() + ' m²<br>' +
                                        '<b>GPS:</b> ' + p.center_lat + ', ' + p.center_lon + '</div>';

                            layer.bindPopup(popup);

                            L.circleMarker([p.center_lat, p.center_lon], {
                                radius: 8,
                                fillColor: '#f1c40f',
                                color: '#000',
                                weight: 2,
                                fillOpacity: 1
                            }).addTo(map).bindPopup(popup);

                            listHtml += '<div class="card">' +
                                        '<h4>Scar Zone #' + p.scar_id + '</h4>' +
                                        '<div><b>Area:</b> ' + p.area_hectares + ' Hectares (' + p.area_sq_meters.toLocaleString() + ' m²)</div>' +
                                        '<div><b>GPS:</b> ' + p.center_lat + ', ' + p.center_lon + '</div>' +
                                        '</div>';
                        }
                    }).addTo(map);

                    if (data.features && data.features.length > 0) {
                        map.fitBounds(scarLayer.getBounds(), { padding: [80, 80] });
                    }

                    document.getElementById('stats').innerText = 'Zones: ' + data.features.length + ' | Total Damage: ' + totalArea.toFixed(2) + ' ha';
                    document.getElementById('scars-list').innerHTML = listHtml;
                })
                .catch(function(err) {
                    console.error("GeoJSON error:", err);
                });

            // Handle map resize rendering
            setTimeout(function() {
                map.invalidateSize();
            }, 300);
        </script>
    </body>
    </html>
    """