const puppeteer = require('puppeteer');

async function getStreets(zipcode) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const url = `https://www.verkkoposti.com/e3/postinumeroluettelo?streetname=&postcodeorcommune=${zipcode}`;
  await page.goto(url);

  const result = await page.evaluate(() => {
    // This code is run inside the browser
    // Parse page so that we get array of street names and their cities
    const streets = [];
    const elem = document.getElementsByClassName('hidden-xs')[0];
    const rows = elem
      .children[0]
      .children;
    for (let i = 1; i < rows.length; i++) {
      const street = rows[i].children[0].children[0].innerText.trim();
      const city = rows[i].children[2].innerText.split(' ')[1].trim();
      streets.push({
        street: street,
        city: city,
      });
    }
    return streets;
  });

  await browser.close();
  return result;
}

module.exports = getStreets;
