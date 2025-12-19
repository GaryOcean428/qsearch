# qsearch

Local-first crawler + search engine built on Scrapy, with QIG-inspired geometric indexing/ranking.

## Project Structure

```
qsearch/
├── backend/          # Python FastAPI backend
│   ├── src/qsearch/  # Core library
│   ├── tests/        # Backend tests
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── railpack.json # Railway backend config
└── webapp/           # React/TypeScript frontend
    ├── src/          # Frontend source
    ├── package.json
    └── railpack.json # Railway frontend config
```

## Railway Deployment

- **Backend service**: Root Directory = `backend`
- **Frontend service**: Root Directory = `webapp`

## Local Development

### Backend

```bash
cd backend
uv sync  # or pip install -e .
uvicorn qsearch.api.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd webapp
npm install
npm run dev
```

### Crawl

```bash
cd backend
scrapy crawl geometric -a start_urls="https://example.com" -a max_depth=1
```
