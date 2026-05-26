import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.pichau.com.br/search?q=teclado%20gamer', 'Gaming Keyboard'],
  ['https://www.pichau.com.br/search?q=mouse%20gamer', 'Gaming Mouse'],
  ['https://www.pichau.com.br/search?q=headset%20gamer', 'Gaming Headset'],
  ['https://www.pichau.com.br/search?q=mousepad%20gamer', 'Mousepad'],
  ['https://www.pichau.com.br/search?q=controle%20gamer', 'Controller'],
  ['https://www.pichau.com.br/search?q=microfone%20gamer', 'Microphone'],
  ['https://www.pichau.com.br/search?q=webcam', 'Webcam'],
  ['https://www.pichau.com.br/search?q=hub%20usb', 'USB Hub'],
  ['https://www.pichau.com.br/search?q=placa%20de%20captura', 'Capture Card'],
  ['https://www.pichau.com.br/search?q=cadeira%20gamer', 'Gaming Chair'],
  ['https://www.pichau.com.br/search?q=mesa%20gamer', 'Gaming Accessory']
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
