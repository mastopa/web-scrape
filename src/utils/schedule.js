const cheerio = require("cheerio");
const { fetchWithPuppeteer } = require("./fetchWithPuppeteer");

const fetchSpecificData = async () => {
  const url = "https://jkt48.com/theater/schedule?lang=id";
  return await fetchWithPuppeteer(url);
};

const parseSpecificData = (html) => {
  const $ = cheerio.load(html);
  const tableBody = $("tbody");
  const rows = tableBody.find("tr");
  const bulan_tahun = $(".entry-schedule__header--center").text().trim();

  const lists = [];
  rows.each((i, row) => {
    const model = { bulan_tahun };
    const list_td = $(row).find("td");

    const tanggal_raw = list_td.eq(0).find("h3").text();
    const tanggal_spl = tanggal_raw.replace(")", "").split("(");
    model.tanggal = tanggal_spl[0]?.trim();
    model.hari = tanggal_spl[1]?.trim();

    const events = list_td.eq(1).find("div");
    if (events.length > 0) {
      events.each((_, ev) => {
        const e = $(ev);
        const clone = { ...model };

        const badge_img = e.find("span img").attr("src");
        if (badge_img) clone.badge_url = badge_img;

        const event_name_full = e.find("p").text().trim();
        clone.event_time = event_name_full.slice(0, 5);
        clone.event_name = event_name_full.slice(6);

        const url_event = e.find("a").attr("href");
        if (url_event) {
          clone.event_id = url_event
            .replace("?lang=id", "")
            .replace("/theater/schedule/id/", "");
        }

        clone.have_event = true;
        lists.push(clone);
      });
    } else {
      model.have_event = false;
      lists.push(model);
    }
  });

  return lists;
};

module.exports = { fetchSpecificData, parseSpecificData };
