# 0100100 Scanner

A tool to make automated searches from 0100100 service.

## Setup

 1. Install [npm](https://www.npmjs.com/get-npm)
 1. Download this repository to your computer.
 1. Run `npm install` in downloaded repository.

## Usage

Run from command line:

```bash
npm start
```

Open your browser and enter the address `http://localhost:3000`.
Enter your 0100100 account(s) and ZIP codes and click **Start**.

## Quota

Note that accounts for 0100100 have a search quota. It gets reset on the 1st day of the month.
You can reset your search results by removing the database `data/db.json` file (or better yet,
move it to another directory).

## Excluded Surnames

Names that are listed in file `data/exclude.txt` are ignored. You can modify that file.
List of Finnish surnames is publicly available here: https://www.avoindata.fi/data/fi/dataset/none
