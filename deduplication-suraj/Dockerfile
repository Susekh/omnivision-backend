# Use official Python image as base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

#expose posrt
EXPOSE 9000

# Create necessary directories for config files
RUN mkdir -p /app/config

# # Set environment variables for configuration
# ENV MONGO_URI=mongodb://host.docker.internal:27017
# ENV RABBITMQ_HOST=host.docker.internal
# ENV MINIO_URL=http://host.docker.internal:9000
# ENV MINIO_ACCESS_KEY=ROOTUSER
# ENV MINIO_SECRET_KEY=CHANGEME123

# Make sure the script is executable
RUN chmod +x /app/test_consumer2.py

# Command to run the application
CMD ["python", "test_consumer2.py"]