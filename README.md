# qsearch

Local-first crawler + search engine built on Scrapy, with QIG-inspired geometric indexing/ranking.

## Run (MVP)

- Crawl:

```bash
scrapy crawl geometric -a start_urls="https://example.com" -a max_depth=1
```

- Serve API:

```bash
uvicorn qsearch.api.main:app --host 0.0.0.0 --port 8000
```
