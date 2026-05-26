import { config } from '../config.js';
import { scrapeProductList } from './genericStoreScraper.js';

const SEARCHES = [
  ['https://www.kabum.com.br/busca/teclado-gamer', 'Gaming Keyboard'],
  ['https://www.kabum.com.br/busca/mouse-gamer', 'Gaming Mouse'],
  ['https://www.kabum.com.br/busca/headset-gamer', 'Gaming Headset'],
  ['https://www.kabum.com.br/busca/mousepad-gamer', 'Mousepad'],
  ['https://www.kabum.com.br/busca/controle-gamer', 'Controller'],
  ['https://www.kabum.com.br/busca/microfone-gamer', 'Microphone'],
  ['https://www.kabum.com.br/busca/webcam', 'Webcam'],
  ['https://www.kabum.com.br/busca/monitor-gamer', 'Monitor'],
  ['https://www.kabum.com.br/busca/memoria-ram', 'RAM'],
  ['https://www.kabum.com.br/busca/water-cooler', 'CPU Cooler'],
  ['https://www.kabum.com.br/busca/hub-usb', 'USB Hub'],
  ['https://www.kabum.com.br/busca/placa-de-captura', 'Capture Card'],
  ['https://www.kabum.com.br/busca/cadeira-gamer', 'Gaming Chair'],
  ['https://www.kabum.com.br/busca/mesa-gamer', 'Gaming Accessory']
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
