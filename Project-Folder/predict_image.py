import tensorflow as tf
import numpy as np
import cv2
import os
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model

# Define Paths
BASE_DIR = "C:/Users/shanen/Desktop/Project-Folder"
MODEL_PATH = os.path.join(BASE_DIR, "algae_classifier_model_v6.h5")

# Load the trained model
if not os.path.exists(MODEL_PATH):
    print("Error: Model file not found! Train the model first using train_model.py.")
    exit()

model = load_model(MODEL_PATH)

# Load class labels
train_dir = os.path.join(BASE_DIR, "Dataset/train")
class_labels = sorted(os.listdir(train_dir))  # Get folder names as labels

def predict_user_image():
    # Ask user to enter image path
    image_path = input("Enter the image file path: ").strip()

    # Check if the file exists
    if not os.path.exists(image_path):
        print(" Error: File not found! Please enter a valid image path.")
        return
    
    # Load and preprocess the image
    img = cv2.imread(image_path)
    img = cv2.resize(img, (150, 150))
    img = img / 255.0  # Normalize
    img = np.expand_dims(img, axis=0)  # Reshape for model input

    # Predict using the model
    prediction = model.predict(img)
    predicted_class = class_labels[np.argmax(prediction)]
    
    # Display image and prediction
    plt.imshow(cv2.cvtColor(cv2.imread(image_path), cv2.COLOR_BGR2RGB))
    plt.title(f" Predicted: {predicted_class}")
    plt.axis("off")
    plt.show()

    print(f"Predicted Class: {predicted_class}")

# Run prediction
predict_user_image()
