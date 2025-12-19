import scrapy


class DocumentItem(scrapy.Item):
    doc_id = scrapy.Field()
    url = scrapy.Field()
    title = scrapy.Field()
    text = scrapy.Field()
    basin = scrapy.Field()
    phi = scrapy.Field()
