# Frontend Dockerfile - Streamlit service
FROM python:3.11-slim

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY stock_dashboard.py .
COPY backend/ ./backend/

# Expose Streamlit port
EXPOSE 8501

# Run the Streamlit frontend
CMD ["streamlit", "run", "stock_dashboard.py", "--server.port", "8501", "--server.address", "0.0.0.0"]
