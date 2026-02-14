fetch('http://localhost:3000/api/test-scrape?t=8')
  .then(res => res.text())
  .then(console.log)
  .catch(console.error);
