async function sleep(duration) {
  await new Promise(r => setTimeout(r, duration));
}

async function sleepAbout(start, end) {
  const diff = end - start;
  const duration = start + (Math.random() * diff);
  await sleep(duration);
}

module.exports = {
  sleepAbout,
};
