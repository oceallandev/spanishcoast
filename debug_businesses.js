import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/businesses.html', {waitUntil: 'networkidle2'});
  const counts = await page.evaluate(() => {
    return {
      windowBusinessListings: window.businessListings ? window.businessListings.length : 0,
      gridChildren: document.getElementById('business-grid') ? document.getElementById('business-grid').children.length : 0,
      innerTextZero: document.body.innerText.includes('No businesses found'),
      businessTypeFilterValue: document.getElementById('business-type-filter') ? document.getElementById('business-type-filter').value : null
    };
  });
  console.log(JSON.stringify(counts));
  await browser.close();
})();
