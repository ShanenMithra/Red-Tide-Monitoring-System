from flask import Flask, request, render_template, jsonify
import tensorflow as tf
import numpy as np
import cv2
import os

app = Flask(__name__)

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "algae_classifier_model_v6.h5")

# Load the trained model
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError("Model file not found! Train the model first.")

model = tf.keras.models.load_model(MODEL_PATH)

# Load class labels
class_labels = [
    "Alexandrium_spp",
    "Gonyaulax_spp",
    "Gymnodinium_catenatum",
    "Heterosigma_akashiwo",
    "Karenia_brevis",
    "Trichodesmium_erythraeum"
]

# Algal class descriptions
class_descriptions = {
    "Karenia_brevis": "(Causes Florida Red Tide) <br><b>Prevention & Treatment:</b><br> - Limit nitrogen and phosphorus from agricultural runoff, sewage discharge, and fertilizers<br>- Use artificial aeration or mechanical mixing to prevent stratification.<br> - Clay Flocculation: Sprinkling modified clay can bind to K. brevis cells and sink them. <br> - Ozonation: Introducing ozone can break down algal toxins.",
    "Alexandrium_spp": "(Causes Paralytic Shellfish Poisoning) <br><b>Prevention & Treatment:</b><br> - Alexandrium forms cysts that settle on the seafloor. Dredging or sediment disturbance can reduce bloom initiation.<br>- Maintain moderate salinity (avoid excess freshwater runoff that can favor growth)<br> - Reducing excessive light penetration (e.g., shading techniques) may help limit photosynthesis. <br> - Bacterial Bioremediation: Certain bacteria can degrade Alexandrium toxins and inhibit bloom formation.",
    "Gymnodinium_catenatum": "(Causes Paralytic Shellfish Poisoning) <br><b>Prevention & Treatment:</b><br>- Introducing natural grazers (such as copepods) can reduce bloom density.<br> - Strong currents prevent blooms from forming in stagnant waters.<br>- Can remove toxins in aquaculture or drinking water applications.",
    "Trichodesmium_erythraeum": "(Forms Blooms in Open Oceans) <br><b>Prevention & Treatment:</b><br> - Reducing iron-rich runoff (e.g., from mining waste) can limit growth.<br> - Break up surface slicks as blooms form floating mats—physical mixing (e.g., aeration, artificial wave action) disperses them.<br> Avoid excess phosphate discharge as phosphorus availability enhances nitrogen fixation, leading to larger blooms.",
    "Heterosigma_akashiwo": "(Causes Fish-Killing Blooms in Brackish Waters) <br><b>Prevention & Treatment:</b><br> -Salinity Control is important as Heterosigma akashiwo thrives in low-salinity waters. Maintaining salinity above 25 PSU can reduce blooms.<br>- UV Treatment directly disrupts H. akashiwo cells in enclosed water bodies.<br>- Kaolinite or modified clay can remove cells from water.<br> Some naturally occurring bacteria prey on H. akashiwo and reduce blooms.",
    "Gonyaulax_spp": "(Produces Red Tides & Toxins) <br><b>Prevention & Treatment:</b><br> - Blooms thrive in waters with high organic content from sewage or decaying material. Treating wastewater properly is essential.<br> -Enhancing Zooplankton Presence can help as copepods and other grazers can help reduce *Gonyaulax* populations.<br> - Reducing salinity fluctuations and keeping temperatures stable can limit bloom growth. <br> - Hydrogen peroxide treatments have been tested to break down *Gonyaulax* toxins."
}

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/bloom')
def bloom_page():
    return render_template('bloom_predict.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Load the image and convert it for prediction
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Invalid image file'}), 400

        img = cv2.resize(img, (150, 150))
        img = img / 255.0  # Normalize
        img = np.expand_dims(img, axis=0)  # Reshape for model input

        # Predict using the model
        prediction = model.predict(img)
        predicted_class = class_labels[np.argmax(prediction)]
        description = class_descriptions.get(predicted_class, "No description available")

        return jsonify({
            'class': predicted_class,
            'description': description
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route("/predict_bloom", methods=["POST"])
def predict_bloom():
    data = request.json
    temperature = data["temperature"]
    pH = data["pH"]
    salinity = data["salinity"]
    elements = data.get("elements", [])  # get the selected elements

    # Validate pH range
    if not (0 <= pH <= 14):
        return jsonify({"bloom_likelihood": "Invalid pH value. Must be between 0 and 14."})


    # Base prediction logic
    if 20 <= temperature <= 30 and 7.5 <= pH <= 8.5 and 30 <= salinity <= 36:
        bloom_status = "Very High"
    elif 18 <= temperature <= 32 and 7.0 <= pH <= 9.0 and 28 <= salinity <= 37:
        bloom_status = "High"
    elif 15 <= temperature <= 35 and 6.5 <= pH <= 9.5 and 25 <= salinity <= 38:
        bloom_status = "Medium"
    elif 10 <= temperature <= 40:
        bloom_status = "Low"
    else:
        bloom_status = "No Bloom"

    # Boost bloom level if N or P is present
    nutrient_boosters = {"N", "P"}
    if any(elem in nutrient_boosters for elem in elements):
        if bloom_status == "Medium":
            bloom_status = "High"
        elif bloom_status == "High":
            bloom_status = "Very High"
        elif bloom_status == "Low":
            bloom_status = "Medium"
        elif bloom_status == "No Bloom":
            bloom_status = "Low"

    return jsonify({"bloom_likelihood": bloom_status})



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

