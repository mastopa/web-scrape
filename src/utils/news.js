const axios = require("axios");
const cheerio = require("cheerio");

// Konfigurasi header agar menyerupai browser sungguhan
const axiosConfig = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://jkt48.com/",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
  },
};

// URL proxy lokal kamu (ganti port jika berbeda)
const PROXY_BASE = "https://proxi-web.vercel.app/fetch?url=";

// ============================================
// Fungsi untuk fetch data berita via proxy
// ============================================
const fetchNewsData = async () => {
  const targetUrl = "https://jkt48.com/news/list?lang=id";
  const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;

  try {
    const response = await axios.get(proxyUrl, axiosConfig);
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching data: ${error.message}`);
  }
};

// ============================================
// Fungsi parsing HTML berita
// ============================================
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

    const badge_div = berita_mentah.find(".entry-news__list--label");
    const badge_img = badge_div.find("img");
    if (badge_img.attr("src")) {
      model["badge_url"] = badge_img.attr("src");
    }

    const title_div = berita_mentah.find(".entry-news__list--item");

    const waktu = title_div.find("time").text().trim();
    model["waktu"] = waktu;

    const judul = title_div.find("h3").text().trim();
    model["judul"] = judul;

    const url_berita_full = title_div.find("h3").find("a").attr("href");
    if (!url_berita_full) {
      console.warn("Missing URL for a news item. Skipping.");
      return;
    }

    const url_berita_full_rplc = url_berita_full
      .replace("?lang=id", "")
      .replace("/news/detail/id/", "");
    model["berita_id"] = url_berita_full_rplc;

    data_list_berita.push(model);
  });

  return { berita: data_list_berita };
};

// ============================================
// Fungsi ambil detail berita via proxy
// ============================================
const fetchNewsDetail = async (berita_id) => {
  const targetUrl = `https://jkt48.com/news/detail/id/${berita_id}?lang=id`;
  const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;

  try {
    const response = await axios.get(proxyUrl, axiosConfig);
    const $ = cheerio.load(response.data);
    const detail = {};

    const mainContentSelector =
      "body > div.container > div.row > div.col-lg-9.order-1.order-lg-2.entry-contents__main-area > div > div > div:nth-child(4)";
    const mainContent = $(mainContentSelector);

    if (mainContent.length === 0) {
      throw new Error("Konten utama tidak ditemukan.");
    }

    // ambil deskripsi
    let deskripsi = "";
    mainContent.find("p, ul, ol, div").each((index, element) => {
      const tagName = $(element).prop("tagName").toLowerCase();
      if (tagName === "p" || tagName === "div") {
        deskripsi += $(element).text().trim() + "\n";
      } else if (tagName === "ul" || tagName === "ol") {
        $(element)
          .children()
          .each((i, child) => {
            deskripsi += "- " + $(child).text().trim() + "\n";
          });
      }
    });
    detail["deskripsi"] = deskripsi.trim();

    // ambil gambar
    const gambarList = [];
    mainContent.find("img").each((index, img) => {
      const gambar = {
        title: $(img).attr("title") || "",
        src: $(img).attr("src"),
        width: $(img).attr("width"),
        height: $(img).attr("height"),
      };
      gambarList.push(gambar);
    });
    detail["gambar"] = gambarList;

    return detail;
  } catch (error) {
    console.error(`Error fetching detail for berita_id ${berita_id}: ${error.message}`);
    return null;
  }
};

// ============================================
// Fungsi utama (fetch + parse berita via proxy)
// ============================================
const fetchAndParseNews = async () => {
  try {
    const html = await fetchNewsData();
    const parsedData = parseNewsData(html);
    return parsedData;
  } catch (error) {
    console.error(`Error fetching or parsing news data: ${error.message}`);
  }
};

module.exports = {
  fetchNewsData,
  parseNewsData,
  fetchNewsDetail,
  fetchAndParseNews,
};
