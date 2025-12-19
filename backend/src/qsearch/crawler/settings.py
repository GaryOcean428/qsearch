BOT_NAME = "qsearch"

SPIDER_MODULES = ["qsearch.crawler.spiders"]
NEWSPIDER_MODULE = "qsearch.crawler.spiders"

ROBOTSTXT_OBEY = True

CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 0.25

ITEM_PIPELINES = {
    "qsearch.crawler.pipelines.SqlAlchemyPipeline": 300,
}

LOG_LEVEL = "INFO"
