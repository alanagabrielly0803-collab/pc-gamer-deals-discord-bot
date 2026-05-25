import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.terabyteshop.com.br/busca?str=teclado%20gamer', 'Gaming Keyboard'],
  ['https://www.terabyteshop.com.br/busca?str=mouse%20gamer', 'Gaming Mouse'],
  ['https://www.terabyteshop.com.br/busca?str=monitor%20gamer', 'Monitor'],
  ['https://www.terabyteshop.com.br/busca?str=ssd%20nvme', 'SSD'],
  ['https://www.terabyteshop.com.br/busca?str=placa%20de%20video', 'Graphics Card'],
  ['https://www.terabyteshop.com.br/busca?str=notebook%20gamer', 'Laptop'],
  ['https://www.terabyteshop.com.br/busca?str=gabinete%20gamer', 'PC Case'],
  ['https://www.terabyteshop.com.br/busca?str=water%20cooler', 'CPU Cooler'],
  ['https://www.terabyteshop.com.br/busca?str=fonte%20650w', 'Power Supply'],
  ['https://www.terabyteshop.com.br/busca?str=memoria%20ram%20ddr5', 'RAM'],
  ['https://www.terabyteshop.com.br/busca?str=controle%20gamer', 'Controller'],
  ['https://www.terabyteshop.com.br/busca?str=microfone%20gamer', 'Gaming Accessory']
];

export async function fetchTerabyteDealsExperimental() {
  if (!config.enableExperimentalScraping) return [];

  const deals = [];

  for (const [sourceUrl, category] of SEARCHES) {
    deals.push(
      ...(await scrapeProductList({
        storeName: 'TerabyteShop',
        sourceUrl,
        category
      }))
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return deals;
}
