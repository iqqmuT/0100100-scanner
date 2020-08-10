const fs = require('fs');
const { keyBy } = require('lodash');
const DATABASE_FILE = './data/db.json';

let db = {
  consumedAccounts: [],
  found: [],
  scannedStreets: [],
  scannedZipcodes: [],
};

let foundByPhone = {};

function init() {
  try {
    const data = fs.readFileSync(DATABASE_FILE);
    db = JSON.parse(data);
  } catch (e) {
    console.error('Error when reading database file', e);
    console.warn('Starting with empty database');
  }
  foundByPhone = keyBy(db.found, 'phone');
}

async function findByPhone(phone) {
  return foundByPhone[phone];
}

async function setFound(entry, city, street) {
  const { phone } = entry;
  let obj = await findByPhone(phone);
  if (!obj) {
    obj = {};
    db.found.push(obj);
  }
  obj.name = entry.name;
  obj.phone = entry.phone;
  obj.address = entry.address;
  obj.city = city;
  obj.street = street;
  obj.modified = Date.now();

  // update found index
  foundByPhone[phone] = obj;
}

async function findConsumedAccount(username) {
  return db.consumedAccounts.find(o => o.username === username);
}

async function setConsumedAccount(username) {
  let obj = await findConsumedAccount(username);
  if (!obj) {
    obj = {};
    db.consumedAccounts.push(obj);
  }
  obj.username = username;
  obj.consumed = Date.now();
}

async function findScannedStreet(city, street) {
  for (let i = 0; i < db.scannedStreets.length; i++) {
    if (db.scannedStreets[i].city === city
      && db.scannedStreets[i].street === street) {
      return db.scannedStreets[i];
    }
  }
  return undefined;
}

async function setScannedStreet(city, street) {
  let obj = await findScannedStreet(city, street);
  if (!obj) {
    obj = {};
    db.scannedStreets.push(obj);
  }
  obj.city = city;
  obj.street = street;
  obj.scanned = Date.now();
}

async function findScannedZipcode(zipcode) {
  return db.scannedZipcodes.find(o => o.zipcode === zipcode);
}

async function setScannedZipcode(zipcode) {
  let obj = await findScannedZipcode(zipcode);
  if (!obj) {
    obj = {};
    db.scannedZipcodes.push(obj);
  }
  obj.zipcode = zipcode;
  obj.scanned = Date.now();
}

async function save() {
  fs.writeFileSync(DATABASE_FILE, JSON.stringify(db));
}

function getData() {
  return db;
}

module.exports = {
  findConsumedAccount,
  findScannedStreet,
  findScannedZipcode,
  getData,
  init,
  save,
  setFound,
  setConsumedAccount,
  setScannedStreet,
  setScannedZipcode,
};
