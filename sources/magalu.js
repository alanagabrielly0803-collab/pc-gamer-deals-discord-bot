import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.magazineluiza.com.br/busca/teclado%2Bgamer/', 'Gaming Keyboard'],
  ['https://www.magazineluiza.com.br/busca/mouse%2Bgamer/', 'Gaming Mouse'],
  ['https://www.magazineluiza.com.br/busca/headset%2Bgamer/', 'Gaming Headset'],
  ['https://www.magazineluiza.com.br/busca/mousepad%2Bgamer/', 'Mousepad'],
  ['https://www.magazineluiza.com.br/busca/controle%2Bgamer/', 'Controller'],
  ['https://www.magazineluiza.com.br/busca/microfone%2Bgamer/', 'Microphone'],
  ['https://www.magazineluiza.com.br/busca/webcam/', 'Webcam'],
  ['https://www.magazineluiza.com.br/busca/hub%2Busb/', 'USB Hub'],
  ['https://www.magazineluiza.com.br/busca/placa%2Bde%2Bcaptura/', 'Capture Card'],
  ['https://www.magazineluiza.com.br/busca/cadeira%2Bgamer/', 'Gaming Chair'],
  ['https://www.magazineluiza.com.br/busca/mesa%2Bgamer/', 'Gaming Accessory']
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
