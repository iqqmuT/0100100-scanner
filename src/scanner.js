const { shuffle } = require('lodash');

const db = require('./db');
const SearchService = require('./searchService');
const getStreets = require('./streetService');
const { sleepAbout } = require('./sleep');
const { isExcludedName, readExcluded } = require('./exclude');

const state = {
  invalidAccounts: [],
  running: false,
  outOfAccounts: false,
};
const getState = () => state;

async function init() {
  await db.init();
  await readExcluded();
}

async function searchByLetters(service, city, street, nbr) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  let response;
  let i = 0;
  let errorCount = 0;

  while (state.running && errorCount < 3 && i < letters.length) {
    await sleepAbout(5000, 10000);
    const searchText = `${city}, ${street} ${nbr} ${letters[i]}`;
    response = await service.search(searchText);
    if (response.error) {
      errorCount++;
    }
    i++;
  }
}

async function searchByNumbers(service, city, street) {
  let response;
  let nbr = 0;
  let errorCount = 0;

  // Allow 10 errors or empty searches. It might be that all
  // house numbers don't have any names.
  while (state.running && errorCount < 10 && nbr < 500) {
    await sleepAbout(5000, 10000);
    nbr++;
    const searchText = `${city}, ${street} ${nbr}`;
    response = await service.search(searchText);

    // Search "Pori, Rajalantie 35" can return "Rajalantie 12 As 35"
    // which is not really what we want. Filter only those entries
    // that belong to this search.
    let entries = response.entries || [];
    entries = entries.filter(entry => entry
      .address[0].toUpperCase().startsWith(`${street.toUpperCase()} ${nbr}`)
    );
    if (entries.length > 0) {
      // reset error count so we are able to keep going on
      errorCount = 0;
    }
    // console.debug('entries', entries);

    if (response.hasMore) {
      // narrow down more
      await searchByLetters(service, city, street, nbr);
    }

    if (response.error || entries.length === 0) {
      // consider empty entries as an error
      errorCount++;
    }
  }
}

async function searchByStreet(service, city, street) {
  const searchText = `${city}, ${street}`;
  const result = await service.search(searchText);
  if (result.hasMore) {
    await searchByNumbers(service, city, street);
  }
  return result;
}

const isCompanyName = (origName) => {
  const name = origName.toUpperCase();
  return name.endsWith(' OY')
    || name.endsWith(' RY')
    || name.endsWith(' LKV')
    || name.endsWith(' KY')
    || name.endsWith(' LTD')
    || name.startsWith('TMI ')
    || name.startsWith('T:MI ')
    || name.endsWith(' TMI')
    || name.startsWith('C/O ')
    || name.startsWith('OSUUSKUNTA ')
    || name.startsWith('SUOMEN ')
    || name.startsWith('PORIN ')
    || name.endsWith(' PORI')
    || name.includes('SATAKUNNAN ')
    || name.endsWith(' KAUPUNKI');
}

const isWrongPhone = (phone) => {
  return phone.startsWith('02')
    || phone.startsWith('010')
    || phone.startsWith('020');
}

function filterInteresting(results) {
  return results.filter(result => !result.isCompany
    && !isCompanyName(result.name)
    && !isWrongPhone(result.phone)
    && !isExcludedName(result.name)
  );
}

async function getUsableAccount(accounts) {
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const isConsumed = await db.findConsumedAccount(account.username);
    if (!isConsumed && !state.invalidAccounts.includes(account.username)) {
      return account;
    }
  }
  return undefined;
}

async function runSession(accounts, zipcodes) {
   // (async() => {
  // program.parse(process.argv);

  // read excluded surname list
  // await readExcluded();
  // await db.init();

  const account = await getUsableAccount(accounts);
  if (!account) {
    console.error('I need more accounts! Or wait until next month.');
    state.outOfAccounts = true;
    // returning false means do not continue
    return false;
  }

  let doContinue = false;

  console.debug(`Using account ${account.username}`);

  const service = new SearchService(
    account.username,
    account.password,
  );

  await service.start();

  if (service.isLoggedIn()) {
    for (let z = 0; state.running && z < zipcodes.length; z++) {
      const zipcode = zipcodes[z];
      state.zipcode = zipcode;
      const scannedZipcode = await db.findScannedZipcode(zipcode);
      if (scannedZipcode) {
        // this zip code is already scanned, skip it
        continue;
      }

      // get street list by zipcode
      const streetList = await getStreets(zipcode);
      state.streets = streetList;

      // shuffle streets so we don't always scan them in the same order
      const streets = shuffle(streetList);

      // console.debug(streets);

      for (let i = 0; state.running && i < streets.length; i++) {
        const street = streets[i].street;
        const city = streets[i].city;
        const scannedStreet = await db.findScannedStreet(city, street);
        if (scannedStreet) {
          // this street is already scanned, skip it
          continue;
        }

        const result = await searchByStreet(service, city, street);
        const filtered = filterInteresting(service.getResults());
        console.log(filtered);

        for (let j = 0; j < filtered.length; j++) {
          await db.setFound(filtered[j], city, street);
        }

        if (result.error && result.error.quotaExceeded) {
          console.error(`Error: Quota exceeded for user ${account.username}: ${result.error.message}`);
          await db.setConsumedAccount(account.username);
          await db.save();
          doContinue = true;
          break;
        }

        if (state.running && (!result.error || result.error.noResults)) {
          // save results only if there was no errors
          if (i === streets.length - 1) {
            // zip code scanned completely
            await db.setScannedZipcode(zipcode);
          }
          await db.setScannedStreet(city, street);
          await db.save();
        }

        // results have been written, clear it now
        service.clearResults();

        await sleepAbout(3000, 6000);
      }
    }
  } else {
    console.error(`Login failed. Check the username and password for username ${account.username}`);
    state.invalidAccounts.push(account.username);
    doContinue = true;
  }

  await service.close();
  await db.save();
  return doContinue;
}

async function startScanner(accounts, zipcodes) {
  state.invalidAccounts = [];
  state.streets = [];
  state.running = true;
  state.zipcode = null;
  let doContinue = true;
  while (state.running && doContinue) {
    // console.log('runSession');
    doContinue = await runSession(accounts, zipcodes);
  }
  console.log('Scanning stopped.');
}

function stopScanner() {
  state.running = false;
}

// Forked process communicates with send() and on()
process.on('message', msg => {
  // Message from parent process
  if (msg.func === 'getState') {
    process.send({ state, db: db.getData() });
  } else if (msg.func === 'start') {
    startScanner(msg.accounts, msg.zipcodes);
  } else if (msg.func === 'stop') {
    stopScanner();
  } else {
    console.error('Unknown call for scanner.', msg);
  }
});

init();
