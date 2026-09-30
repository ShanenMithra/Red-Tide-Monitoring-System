from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np
import os

# Paths
BASE_DIR = "C:/Users/shanen/Desktop/Project-Folder"
MODEL_PATH = os.path.join(BASE_DIR, "algae_classifier_model_v6.h5")
TEST_DIR = os.path.join(BASE_DIR, "Dataset/test")

# Load the model
model = load_model(MODEL_PATH)

# Image preprocessing
IMG_SIZE = (150, 150)
BATCH_SIZE = 32

test_datagen = ImageDataGenerator(rescale=1./255)

test_generator = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    shuffle=False  # Don't shuffle for accurate evaluation
)

# Predict
pred_probs = model.predict(test_generator)
y_pred = np.argmax(pred_probs, axis=1)
y_true = test_generator.classes

# Class names
class_names = list(test_generator.class_indices.keys())

# Report
print("Classification Report:\n")
print(classification_report(y_true, y_pred, target_names=class_names))

# Confusion Matrix (optional)
print("\nConfusion Matrix:\n")
print(confusion_matrix(y_true, y_pred))
