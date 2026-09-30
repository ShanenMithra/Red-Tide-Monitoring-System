import sys
import json
import math
import numpy as np


def normalize(value, min_val, max_val):
    if value is None:
        return 0
    return max(0, min(1, (value - min_val) / (max_val - min_val)))


def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2

    return 2 * R * math.asin(math.sqrt(a))


def main():
    input_data = json.loads(sys.stdin.read())

    features = np.array(input_data["features"])
    latitudes = input_data["latitudes"]
    longitudes = input_data["longitudes"]

    num_nodes = len(features)

    # -----------------------------
    # 1️⃣ BUILD GRAPH (distance-based)
    # -----------------------------
    adjacency = [[] for _ in range(num_nodes)]

    distance_threshold = 20  # km (adjustable)

    for i in range(num_nodes):
        for j in range(num_nodes):
            if i == j:
                continue
            dist = haversine(
                latitudes[i], longitudes[i],
                latitudes[j], longitudes[j]
            )
            if dist <= distance_threshold:
                adjacency[i].append(j)

    # -----------------------------
    # 2️⃣ GRAPH SMOOTHING (GCN-like step)
    # -----------------------------
    smoothed_features = []

    for i in range(num_nodes):

        own = features[i]
        neighbors = adjacency[i]

        if len(neighbors) > 0:
            neighbor_values = np.mean(
                [features[j] for j in neighbors], axis=0
            )
            blended = 0.7 * own + 0.3 * neighbor_values
        else:
            blended = own

        smoothed_features.append(blended)

    smoothed_features = np.array(smoothed_features)

    # -----------------------------
    # 3️⃣ ECOLOGICAL RISK FORMULA
    # -----------------------------
    bloom_probs = []

    for row in smoothed_features:

        temp = row[0]
        do = row[1]
        ph = row[2]

        temp_norm = normalize(temp, 15, 35)
        do_norm = 1 - normalize(do, 0, 14)
        ph_norm = normalize(abs(ph - 8), 0, 2)

        risk = (
            0.5 * temp_norm +
            0.3 * do_norm +
            0.2 * ph_norm
        )

        risk = max(0, min(1, risk))
        bloom_probs.append(float(risk))

    print(json.dumps({
        "bloom_probabilities": bloom_probs
    }))


if __name__ == "__main__":
    main()
