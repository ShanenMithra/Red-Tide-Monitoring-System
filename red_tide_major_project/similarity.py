import sys
import json
import numpy as np

# Read JSON from Node
input_data = sys.stdin.read()
data = json.loads(input_data)

features = np.array(data["features"])  # shape: (N, 3)

# Normalize features (important for similarity)
norms = np.linalg.norm(features, axis=1, keepdims=True)
features_normalized = features / (norms + 1e-8)

# Use first node as reference (for now)
target_index = data.get("target_index", 0)
target_vector = features_normalized[target_index]

# Cosine similarity
similarities = features_normalized @ target_vector

# Get top 5 most similar (excluding itself)
indices = np.argsort(similarities)[::-1]
top_indices = [int(i) for i in indices if i != target_index][:5]

# Output JSON back to Node
print(json.dumps({
    "similar_indices": top_indices
}))