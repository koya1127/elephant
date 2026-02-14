import { scrapeEvents } from "../src/lib/scraper";
import { hokkaidoConfig } from "../src/config/sites";

async function main() {
  console.log("Starting Hokkaido scrape...");
  try {
    const events = await scrapeEvents(hokkaidoConfig);
    console.log(`Scraped ${events.length} events.`);

    // Log first few events
    console.log("First 3 events:");
    console.log(JSON.stringify(events.slice(0, 3), null, 2));

    // Check for specific events from PDF
    const pdfEvents = events.filter(e => e.detailUrl?.endsWith(".pdf"));
    console.log(`Events from PDF (or have PDF): ${pdfEvents.length}`);
    if (pdfEvents.length > 0) {
      console.log("Sample PDF event:");
      console.log(JSON.stringify(pdfEvents[0], null, 2));
    }

  } catch (error) {
    console.error("Scrape failed:", error);
  }
}

main();
