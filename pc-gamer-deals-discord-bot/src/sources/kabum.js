import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.kabum.com.br/busca/teclado-gamer', 'Gaming Keyboard'],
  ['https://www.kabum.com.br/busca/mouse-gamer', 'Gaming Mouse'],
  ['https://www.kabum.com.br/busca/monitor-gamer', 'Monitor'],
  ['https://www.kabum.com.br/busca/ssd-nvme', 'SSD'],
  ['https://www.kabum.com.br/busca/placa-de-video', 'Graphics Card']
];

export async function fetchKabumDealsExperimental() {
  if (!config.enableExperimentalScraping) return [];

  const deals = [];

  for (const [sourceUrl, category] of SEARCHES) {
    deals.push(
      ...(await scrapeProductList({
        storeName: 'Kabum',
        sourceUrl,
        category
      }))
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return deals;
}
