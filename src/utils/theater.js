const cheerio = require("cheerio");
const { fetchWithPuppeteer } = require("./fetchWithPuppeteer");

const fetchData = async () => {
  const url = "https://jkt48.com/theater/schedule";
  return await fetchWithPuppeteer(url);
};

const parseData = (html) => {
  const $ = cheerio.load(html);
  const table = $(
    "body > div.container > div.row > div > div > div:nth-child(5) > div.table-responsive.table-pink__scroll table"
  );

  const scheduleData = [];
  table.find("tbody tr").each((i, el) => {
    const showInfoFull = $(el).find("td:nth-child(1)").text().trim();
    const setlist = $(el).find("td:nth-child(2)").text().trim();
    const members = $(el)
      .find("td:nth-child(3) a")
      .map((i, el) => $(el).text().trim())
      .get();
    const birthdayMembers = $(el)
      .find('a[style="color:#616D9D"]')
      .map((i, el) => $(el).text().trim())
      .get();

    if (showInfoFull.includes("Show")) {
      const showInfo = parseShowInfo(showInfoFull);
      scheduleData.push({ showInfo, setlist, birthdayMembers, members });
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
