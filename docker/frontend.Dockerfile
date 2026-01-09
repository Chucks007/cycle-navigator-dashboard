# Frontend Dockerfile - Streamlit service
FROM python:3.11-slim

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download TextBlob / NLTK corpora needed for sentiment analysis
RUN python -m textblob.download_corpora

# Copy CSV data and generate top_companies.json at build time
COPY documents/constituents.csv /app/documents/constituents.csv
RUN python3 <<EOF
import pandas as pd
import json
df = pd.read_csv('documents/constituents.csv')
companies = df[['Symbol', 'Security']].rename(columns={'Symbol': 'symbol', 'Security': 'name'}).to_dict('records')
with open('top_companies.json', 'w') as f:
    json.dump(companies, f, indent=4)
EOF

# Copy application code
COPY stock_dashboard.py .
COPY backend/ ./backend/

# Expose Streamlit port
EXPOSE 8501

# Run the Streamlit frontend
CMD ["streamlit", "run", "stock_dashboard.py", "--server.port", "8501", "--server.address", "0.0.0.0"]
