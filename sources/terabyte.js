import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.terabyteshop.com.br/busca?str=teclado%20gamer', 'Gaming Keyboard'],
  ['https://www.terabyteshop.com.br/busca?str=mouse%20gamer', 'Gaming Mouse'],
  ['https://www.terabyteshop.com.br/busca?str=headset%20gamer', 'Gaming Headset'],
  ['https://www.terabyteshop.com.br/busca?str=mousepad%20gamer', 'Mousepad'],
  ['https://www.terabyteshop.com.br/busca?str=controle%20gamer', 'Controller'],
  ['https://www.terabyteshop.com.br/busca?str=microfone%20gamer', 'Microphone'],
  ['https://www.terabyteshop.com.br/busca?str=webcam', 'Webcam'],
  ['https://www.terabyteshop.com.br/busca?str=hub%20usb', 'USB Hub'],
  ['https://www.terabyteshop.com.br/busca?str=placa%20de%20captura', 'Capture Card'],
  ['https://www.terabyteshop.com.br/busca?str=cadeira%20gamer', 'Gaming Chair'],
  ['https://www.terabyteshop.com.br/busca?str=mesa%20gamer', 'Gaming Accessory']
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
