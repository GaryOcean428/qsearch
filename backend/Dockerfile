# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy all project files (needed for uv sync to build the package)
COPY pyproject.toml uv.lock ./
COPY src/ ./src/

# Create minimal README for setuptools
RUN echo "# qsearch" > README.md

# Install dependencies and build package
RUN uv sync --frozen --no-dev

# Expose port
EXPOSE 8000

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start with gunicorn
CMD ["uv", "run", "python", "-m", "gunicorn", "qsearch.api.main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4"]
