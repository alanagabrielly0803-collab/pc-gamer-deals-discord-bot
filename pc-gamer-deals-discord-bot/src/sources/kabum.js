import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.kabum.com.br/busca/teclado-gamer', 'Gaming Keyboard'],
  ['https://www.kabum.com.br/busca/mouse-gamer', 'Gaming Mouse'],
  ['https://www.kabum.com.br/busca/monitor-gamer', 'Monitor'],
  ['https://www.kabum.com.br/busca/ssd-nvme', 'SSD'],
  ['https://www.kabum.com.br/busca/placa-de-video', 'Graphics Card'],
  ['https://www.kabum.com.br/busca/notebook-gamer', 'Laptop'],
  ['https://www.kabum.com.br/busca/gabinete-gamer', 'PC Case'],
  ['https://www.kabum.com.br/busca/water-cooler', 'CPU Cooler'],
  ['https://www.kabum.com.br/busca/fonte-650w', 'Power Supply'],
  ['https://www.kabum.com.br/busca/memoria-ram-ddr5', 'RAM'],
  ['https://www.kabum.com.br/busca/controle-gamer', 'Controller'],
  ['https://www.kabum.com.br/busca/microfone-gamer', 'Gaming Accessory']
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
