const axios = require("axios");
const cheerio = require("cheerio");

// Gunakan proxy agar tidak kena 403
const PROXY_BASE = "https://proxi-web.vercel.app/fetch?url=";

const fetchData = async () => {
  const targetUrl = "https://jkt48.com/theater/schedule";
  const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;

  try {
    const result = await axios.get(proxyUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://jkt48.com/",
        "Connection": "keep-alive",
      },
    });
    return result.data;
  } catch (error) {
    throw new Error(`Error fetching data: ${error.message}`);
  }
};

const parseData = (html) => {
  const $ = cheerio.load(html);

  const table = $(
    "body > div.container > div.row > div > div > div:nth-child(5) > div.table-responsive.table-pink__scroll table"
  );

  const scheduleData = [];

  table.find("tbody tr").each((index, element) => {
    const showInfoFull = $(element).find("td:nth-child(1)").text().trim();
    const setlist = $(element).find("td:nth-child(2)").text().trim();
    const members = $(element)
      .find("td:nth-child(3) a")
      .map((i, el) => $(el).text().trim())
      .get();
    const birthdayMembers = $(element)
      .find('a[style="color:#616D9D"]')
      .map((i, el) => $(el).text().trim())
      .get();

    if (showInfoFull.includes("Show")) {
      const showInfo = parseShowInfo(showInfoFull);
      scheduleData.push({
        showInfo,
        setlist,
        birthdayMembers,
        members,
      });
    } else {
      scheduleData.push({
        showInfo: showInfoFull,
        setlist,
        birthdayMembers,
        members: [],
      });
    }
  });

  return scheduleData;
};

const parseShowInfo = (showInfoFull) => {
  const regex = /(\w+), (\d{1,2}\.\d{1,2}\.\d{4})Show (\d{1,2}:\d{2})/;
  const match = showInfoFull.match(regex);
  if (match) {
    const day = match[1];
    const date = match[2];
    const time = match[3];
    return `${day}, ${date} ${time}`;
  }
  return showInfoFull;
};

module.exports = { fetchData, parseData, parseShowInfo };
