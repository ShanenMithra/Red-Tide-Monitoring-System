FROM node:20-bookworm-slim

# Install Python and system packages needed by TensorFlow/OpenCV/SQLite
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        build-essential \
        libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY red_tide_major_project/package*.json ./red_tide_major_project/
RUN cd red_tide_major_project && npm install

# Install Python dependencies
COPY Project-Folder/requirements.txt ./Project-Folder/
RUN pip3 install --break-system-packages -r Project-Folder/requirements.txt

# Copy the entire project
COPY . .

# Start Flask internally, then Node as the public server
CMD ["sh", "-c", "PORT=5000 python3 Project-Folder/app.py & cd red_tide_major_project && npm start"]