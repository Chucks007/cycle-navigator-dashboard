# Backend Dockerfile - FastAPI service (Multi-stage build)
# Reduces image size from ~1GB to ~200MB

# ============================================
# Stage 1: Builder - Install dependencies
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download TextBlob / NLTK corpora (needed for sentiment analysis)
RUN python -m textblob.download_corpora

# ============================================
# Stage 2: Data Prep - Generate static assets
# ============================================
FROM python:3.11-slim AS data-prep

WORKDIR /data

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy CSV data and generate top_companies.json at build time
COPY documents/constituents.csv /data/documents/constituents.csv
RUN python3 <<EOF
import pandas as pd
import json
df = pd.read_csv('documents/constituents.csv')
companies = df[['Symbol', 'Security']].rename(columns={'Symbol': 'symbol', 'Security': 'name'}).to_dict('records')
with open('top_companies.json', 'w') as f:
    json.dump(companies, f, indent=4)
EOF

# ============================================
# Stage 3: Runtime - Minimal production image
# ============================================
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime dependencies only (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy NLTK data from builder (for TextBlob sentiment analysis)
COPY --from=builder /root/nltk_data /home/appuser/nltk_data

# Copy generated data files
COPY --from=data-prep /data/top_companies.json ./top_companies.json

# Copy entrypoint script (before copying backend code)
COPY docker/entrypoint-backend.sh /app/entrypoint.sh

# Copy application code
COPY backend/ ./backend/

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV NLTK_DATA=/home/appuser/nltk_data

# Make entrypoint executable (before changing ownership)
RUN chmod +x /app/entrypoint.sh

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app /home/appuser

# Switch to non-root user
USER appuser

# Expose FastAPI port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
