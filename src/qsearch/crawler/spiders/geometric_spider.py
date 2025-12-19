from __future__ import annotations

import hashlib

import scrapy
from bs4 import BeautifulSoup
from scrapy.linkextractors import LinkExtractor

from qsearch.core.encoding import encode_text_to_basin
from qsearch.crawler.items import DocumentItem


class GeometricSpider(scrapy.Spider):
    name = "geometric"

    def __init__(self, start_urls: str | None = None, max_depth: int = 2, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = [u.strip() for u in (start_urls or "").split(",") if u.strip()]
        self.max_depth = int(max_depth)
        self.link_extractor = LinkExtractor()

    def parse(self, response, depth: int = 0):
        soup = BeautifulSoup(response.body, "lxml")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        title = (soup.title.string or "").strip() if soup.title else ""
        text = soup.get_text(separator=" ", strip=True)

        basin = encode_text_to_basin(text)

        doc_id = hashlib.sha256(response.url.encode("utf-8")).hexdigest()[:16]
        yield DocumentItem(
            doc_id=doc_id,
            url=response.url,
            title=title,
            text=text[:5000],
            basin=basin.tolist(),
            phi=0.0,
        )

        if depth >= self.max_depth:
            return

        for link in self.link_extractor.extract_links(response):
            yield response.follow(link, callback=self.parse, cb_kwargs={"depth": depth + 1})
