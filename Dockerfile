FROM python:3.11-slim

WORKDIR /app

# Copy and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Copy data directory
COPY sap-o2c-data/ /app/sap-o2c-data/

# Set environment variable for data directory
ENV DATA_DIR=/app/sap-o2c-data

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
