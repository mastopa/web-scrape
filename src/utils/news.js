// src/utils/news.js
const cheerio = require("cheerio");
const { fetchWithPuppeteer } = require("./fetchWithPuppeteer");

/**
 * Ambil halaman list berita via Puppeteer (bypass Cloudflare)
 */
const fetchNewsData = async () => {
  const url = "https://jkt48.com/news/list?lang=id";
  // tunggu selector list berita muncul
  return await fetchWithPuppeteer(url, {
    waitForSelectors: [".entry-news__list", ".entry-news__list--item", ".news-list"],
    timeout: 60000,
  });
};

/**
 * Parse list berita (judul, waktu, badge, berita_id)
 */
const parseNewsData = (html) => {
  const $ = cheerio.load(html);
  const list_berita_mentah = $(".entry-news__list");

  if (!list_berita_mentah || list_berita_mentah.length === 0) {
    throw new Error("No news data found on the page.");
  }

  const data_list_berita = [];
  list_berita_mentah.each((index, element) => {
    const model = {};
    const berita_mentah = $(element);

    const badge_img = berita_mentah.find(".entry-news__list--label img");
    if (badge_img.attr("src")) {
      model.badge_url = badge_img.attr("src");
    }

    const title_div = berita_mentah.find(".entry-news__list--item");
    model.waktu = title_div.find("time").text().trim();
    model.judul = title_div.find("h3").text().trim();

    const url_berita_full = title_div.find("h3 a").attr("href");
    if (!url_berita_full) {
      // skip broken item
      return;
    }
    const berita_id = url_berita_full.replace("?lang=id", "").replace("/news/detail/id/", "");
    model.berita_id = berita_id;
    model.url = url_berita_full.startsWith("http") ? url_berita_full : `https://jkt48.com${url_berita_full}`;

    data_list_berita.push(model);
  });

  return { berita: data_list_berita };
};

/**
 * Ambil detail berita (deskripsi & gambar)
 */
const fetchNewsDetail = async (berita_id) => {
  const url = `https://jkt48.com/news/detail/id/${berita_id}?lang=id`;

  try {
    // tunggu selector konten artikel muncul; pakai beberapa fallback selector
    const html = await fetchWithPuppeteer(url, {
      waitForSelectors: [
        "body > div.container .entry-contents__main-area",
        ".entry-news__detail",
        ".entry-contents__main-area",
        "article",
        ".news-detail",
      ],
      timeout: 90000,
    });

    const $ = cheerio.load(html);
    const detail = {};

    // Try multiple selectors to find the main article content
    const possibleSelectors = [
      "body > div.container > div.row > div.col-lg-9.order-1.order-lg-2.entry-contents__main-area > div > div > div:nth-child(4)",
      ".entry-contents__main-area",
      ".entry-news__detail",
      "article",
      ".news-detail",
    ];

    let mainContent = null;
    for (const sel of possibleSelectors) {
      const node = $(sel);
      if (node && node.length > 0) {
        mainContent = node.first();
        break;
      }
    }

    if (!mainContent || mainContent.length === 0) {
      // last resort: use a selector that contains most article paragraphs
      mainContent = $("article, .entry-contents__main-area, .entry-news__detail").first();
    }

    if (!mainContent || mainContent.length === 0) {
      throw new Error("Konten utama tidak ditemukan (selector fallback gagal).");
    }

    // Ambil deskripsi (gabungkan p, div, list)
    let deskripsi = "";
    mainContent.find("p, div, ul, ol").each((idx, el) => {
      const tag = $(el).prop("tagName").toLowerCase();
      if (tag === "p" || tag === "div") {
        const t = $(el).text().trim();
        if (t) deskripsi += t + "\n";
      } else if (tag === "ul" || tag === "ol") {
        $(el)
          .children()
          .each((i, li) => {
            const t = $(li).text().trim();
            if (t) deskripsi += "- " + t + "\n";
          });
      }
    });
    detail.deskripsi = deskripsi.trim();

    // Ambil gambar di dalam mainContent
    const gambarList = [];
    mainContent.find("img").each((i, img) => {
      gambarList.push({
        title: $(img).attr("title") || "",
        src: $(img).attr("src") || $(img).attr("data-src") || "",
        width: $(img).attr("width") || "",
        height: $(img).attr("height") || "",
        alt: $(img).attr("alt") || "",
      });
    });
    detail.gambar = gambarList;

    return detail;
  } catch (error) {
    console.error(`Error fetching detail for berita_id ${berita_id}: ${error.message}`);
    return null;
  }
};

/**
 * Fetch + parse list + details (convenience)
 */
const fetchAndParseNews = async () => {
  try {
    const html = await fetchNewsData();
    const parsed = parseNewsData(html);

    // fetch detail in parallel but limit concurrency if you want (here full parallel)
    const newsWithDetail = await Promise.all(
      parsed.berita.map(async (item) => {
        const detail = await fetchNewsDetail(item.berita_id);
        return { ...item, detail };
      })
    );

    return newsWithDetail;
  } catch (error) {
    console.error(`Error parsing news: ${error.message}`);
    return [];
  }
};

module.exports = { fetchNewsData, parseNewsData, fetchNewsDetail, fetchAndParseNews };
