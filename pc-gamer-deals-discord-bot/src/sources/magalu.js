import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.magazineluiza.com.br/busca/teclado%2Bgamer/', 'Gaming Keyboard'],
  ['https://www.magazineluiza.com.br/busca/mouse%2Bgamer/', 'Gaming Mouse'],
  ['https://www.magazineluiza.com.br/busca/monitor%2Bgamer/', 'Monitor'],
  ['https://www.magazineluiza.com.br/busca/ssd%2Bnvme/', 'SSD'],
  ['https://www.magazineluiza.com.br/busca/placa%2Bde%2Bvideo/', 'Graphics Card']
];

export async function fetchMagaluDealsExperimental() {
  if (!config.enableExperimentalScraping) return [];

  const deals = [];

  for (const [sourceUrl, category] of SEARCHES) {
    deals.push(
      ...(await scrapeProductList({
        storeName: 'Magazine Luiza',
        sourceUrl,
        category
      }))
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return deals;
}
