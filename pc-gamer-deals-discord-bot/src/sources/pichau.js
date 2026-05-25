import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.pichau.com.br/search?q=teclado%20gamer', 'Gaming Keyboard'],
  ['https://www.pichau.com.br/search?q=mouse%20gamer', 'Gaming Mouse'],
  ['https://www.pichau.com.br/search?q=monitor%20gamer', 'Monitor'],
  ['https://www.pichau.com.br/search?q=ssd%20nvme', 'SSD'],
  ['https://www.pichau.com.br/search?q=placa%20de%20video', 'Graphics Card'],
  ['https://www.pichau.com.br/search?q=notebook%20gamer', 'Laptop'],
  ['https://www.pichau.com.br/search?q=gabinete%20gamer', 'PC Case'],
  ['https://www.pichau.com.br/search?q=water%20cooler', 'CPU Cooler'],
  ['https://www.pichau.com.br/search?q=fonte%20650w', 'Power Supply'],
  ['https://www.pichau.com.br/search?q=memoria%20ram%20ddr5', 'RAM'],
  ['https://www.pichau.com.br/search?q=controle%20gamer', 'Controller'],
  ['https://www.pichau.com.br/search?q=microfone%20gamer', 'Gaming Accessory']
];

export async function fetchPichauDealsExperimental() {
  if (!config.enableExperimentalScraping) return [];

  const deals = [];

  for (const [sourceUrl, category] of SEARCHES) {
    deals.push(
      ...(await scrapeProductList({
        storeName: 'Pichau',
        sourceUrl,
        category
      }))
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return deals;
}
