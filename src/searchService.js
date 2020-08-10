const puppeteer = require('puppeteer');
const { sleepAbout } = require('./sleep');

async function parseSearchResults(page) {
  const results = await page.evaluate(() => {
    const res = {
      entries: [],
    };

    const message = $('.entry:first p').html() || '';
    if (message.startsWith('Tämän tunnuksen hakumäärä on täyttynyt')) {
      res.error = {
        quotaExceeded: true,
        message,
      };
      return res;
    }

    $('.entry').each(function(idx, entry) {
      const header = $(entry).children('h2').html();
      if (header) {
        if (header.startsWith('Tekemääsi hakuun löytyy lisää')) {
          // there are more results
          res.hasMore = true;
        } else if (header.startsWith('Tekemääsi hakuun löytyy liikaa')) {
          // too many results, must do more specific search
          res.hasMore = true;
          res.error = { tooMany: true };
        } else if (header.startsWith('Tekemääsi hakuun ei löydy')) {
          res.error = { noResults: true };
        } else {
          // normal entry
          const obj = {
            name: header,
          };

          // is company?
          if ($(entry).find('li.dst').length) {
            obj.isCompany = true;
          }

          // phone
          obj.phone = $(entry).find('.phone-smaller a').html();

          // address
          const address = [];
          $(entry).children('.column:eq(1)').children('p')
            .each(function(i, p) {
              address.push($(p).html());
            });
          obj.address = address;

          res.entries.push(obj);
        }
      }
    });
    return res;
  });
  return results;
}

async function isLoadingResults(page) {
  const loading = await page.evaluate(() => {
    return $('#loading').is(':visible');
  });
  return loading;
}

async function search(session, searchText) {
  const { page } = session;
  await page.evaluate(({ searchText }) => {
    document.getElementById('query_free').value = searchText;
    $('#searchBtn').click();
  }, { searchText });

  // check every 1 second if loading spinner was hidden
  for (let i = 0; i < 10; i++) {
    await sleepAbout(1000, 1000);
    const loading = await isLoadingResults(page);
    if (!loading) {
      const results = await parseSearchResults(page);
      return results;
    }
  }

  // timeout
  console.error(`Timeout when searching: '${searchText}'`);
  return {
    error: {
      timeout: true,
    },
  };
}

async function startSession(username, password) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const loginPageUrl = 'https://hae.0100100.fi/?kirjaudu';
  await page.goto(loginPageUrl);

  await page.evaluate(({ username, password }) => {
    // fill credentials
    document.getElementById('query_username').value = username;
    document.getElementById('query_password').value = password;
    // use jQuery to click the login button
    $('#loginBtn').click();
  }, {
    username,
    password,
  });

  // wait for login to be processed
  await sleepAbout(5000, 12000);

  const loggedIn = await page.evaluate(() => {
    return $('#loginFailed').is(':hidden');
  });

  return {
    browser,
    page,
    loggedIn,
  };
}

async function endSession({ browser, page }) {
  // log out
  await page.evaluate(() => {
    $('#logout-link').click();
  });
  await sleepAbout(1500, 3000);
  // await page.screenshot({ path: '/tmp/example1.png' });

  await browser.close();
}

class SearchService {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.results = [];
  }

  findByPhone(phone) {
    for (let i = 0; i < this.results.length; i++) {
      if (this.results[i].phone === phone) {
        return this.results[i];
      }
    }
    return undefined;
  }

  async start() {
    if (!this.session) {
      this.session = await startSession(this.username, this.password);
    }
    return this.isLoggedIn();
  }

  isLoggedIn() {
    return this.session && this.session.loggedIn;
  }

  async search(searchText) {
    console.debug('SearchService.search():', searchText);
    if (!this.isLoggedIn()) {
      return undefined;
    }
    const response = await search(this.session, searchText);
    if (response.entries) {
      console.debug(`${response.entries.length} entries found`);
      for (let i = 0; i < response.entries.length; i++) {
        const entry = response.entries[i];
        if (this.findByPhone(entry.phone) === undefined) {
          this.results.push(entry);
        }
      }
    }
    return response;
  }

  getResults() {
    return this.results;
  }

  clearResults() {
    this.results = [];
  }

  async close() {
    if (this.session) {
      await endSession(this.session);
    }
  }
}

module.exports = SearchService;
