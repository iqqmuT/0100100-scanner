const fs = require('fs');
const readline = require('readline');

const FILENAME = './data/exclude.txt';

const surnames = {};

// Reads a text file that contains a list of names to be excluded.
async function readExcluded(filename=FILENAME) {
  const fileStream = fs.createReadStream(filename);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.startsWith('#')) {
      surnames[line.toUpperCase()] = true;
    }
  }
}

// Returns true if given name should be excluded.
function isExcludedName(name) {
  const parts = name.split(' ');
  const surname = parts[0].toUpperCase();

  // support combined Finnish surnames like LEHTO-SANTAVIRTA
  const surnameParts = surname.split('-');
  for (let i = 0; i < surnameParts.length; i++) {
    if (surnames[surnameParts[i]] === true) {
      return true;
    }
  }
  return false;
}

module.exports = {
  readExcluded,
  isExcludedName,
};
