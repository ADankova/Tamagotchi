/** Значки игр в списке: картинка про саму игру, а не про питомца. */
const ICONS: Readonly<Record<string, string>> = {
  // Судоку: сетка с короной в одной клетке.
  queens:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#fff6e4" stroke="#3b2a1e" stroke-width="3"/>' +
    '<path d="M24 6v36M6 24h36" stroke="#3b2a1e" stroke-width="2" opacity=".45"/>' +
    '<path d="M10 22l3-8 4 5 3-7 3 7 4-5 3 8z" fill="#f4b73f" stroke="#3b2a1e" stroke-width="2" stroke-linejoin="round" transform="translate(1 2) scale(.9)"/>' +
    '<circle cx="34" cy="34" r="4" fill="#ff9fc8" stroke="#3b2a1e" stroke-width="2"/>',
  // Питомцы-блоки: падающие блоки в стакане.
  slide:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#dff1ff" stroke="#3b2a1e" stroke-width="3"/>' +
    '<rect x="11" y="12" width="10" height="10" rx="2" fill="#ff9fc8" stroke="#3b2a1e" stroke-width="2"/>' +
    '<rect x="21" y="22" width="10" height="10" rx="2" fill="#f4b73f" stroke="#3b2a1e" stroke-width="2"/>' +
    '<rect x="11" y="32" width="10" height="7" rx="2" fill="#7bc67e" stroke="#3b2a1e" stroke-width="2"/>' +
    '<rect x="31" y="32" width="7" height="7" rx="2" fill="#5aaef0" stroke="#3b2a1e" stroke-width="2"/>',
  // Питомцы-воришки: кубики мозаики и банка.
  mosaic:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#fff6e4" stroke="#3b2a1e" stroke-width="3"/>' +
    '<rect x="11" y="11" width="8" height="8" rx="2" fill="#ff9fc8"/><rect x="20" y="11" width="8" height="8" rx="2" fill="#f4b73f"/>' +
    '<rect x="29" y="11" width="8" height="8" rx="2" fill="#7bc67e"/><rect x="11" y="20" width="8" height="8" rx="2" fill="#5aaef0"/>' +
    '<rect x="29" y="20" width="8" height="8" rx="2" fill="#ff9fc8"/><rect x="20" y="29" width="8" height="8" rx="2" fill="#7bc67e"/>' +
    '<rect x="11" y="29" width="8" height="8" rx="2" fill="#f4b73f"/>',
  // Бухта питомцев: остров и кораблик на волнах.
  harbor:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#bfe6ff" stroke="#3b2a1e" stroke-width="3"/>' +
    '<path d="M10 34q4-4 7 0t7 0 7 0 7 0" fill="none" stroke="#5aaef0" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M14 28h20l-3 6H17z" fill="#c98a52" stroke="#3b2a1e" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M24 12v16" stroke="#3b2a1e" stroke-width="2.5"/><path d="M24 13l9 11H24z" fill="#fff" stroke="#3b2a1e" stroke-width="2" stroke-linejoin="round"/>',
  // Дикий лес: ёлка и костёр.
  forest:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#d9f2c9" stroke="#3b2a1e" stroke-width="3"/>' +
    '<path d="M17 10l8 11h-4l6 8H7l6-8H9z" fill="#2f8a57" stroke="#3b2a1e" stroke-width="2" stroke-linejoin="round"/><rect x="15" y="29" width="4" height="6" fill="#8a5a35" stroke="#3b2a1e" stroke-width="1.5"/>' +
    '<path d="M27 36l12-4M27 32l12 4" stroke="#6b3f22" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M29 32q0-7 4-11q4 4 4 11z" fill="#ff7a2f" stroke="#3b2a1e" stroke-width="1.8" stroke-linejoin="round"/><path d="M31.5 32q0-4 1.5-6q1.5 2 1.5 6z" fill="#ffd25e"/>',
  // Три в ряд: три одинаковых кружка в ряд и бонус-звезда.
  match3:
    '<rect x="6" y="6" width="36" height="36" rx="6" fill="#ffe9f3" stroke="#3b2a1e" stroke-width="3"/>' +
    '<circle cx="14" cy="17" r="5.5" fill="#ff9fc8" stroke="#3b2a1e" stroke-width="2"/><circle cx="24" cy="17" r="5.5" fill="#ff9fc8" stroke="#3b2a1e" stroke-width="2"/><circle cx="34" cy="17" r="5.5" fill="#ff9fc8" stroke="#3b2a1e" stroke-width="2"/>' +
    '<circle cx="14" cy="30" r="5.5" fill="#5aaef0" stroke="#3b2a1e" stroke-width="2"/><circle cx="24" cy="30" r="5.5" fill="#f4b73f" stroke="#3b2a1e" stroke-width="2"/>' +
    '<path d="M34 24l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#fff" stroke="#3b2a1e" stroke-width="1.8" stroke-linejoin="round" transform="translate(-3 0) scale(.95)"/>',
};

export function gameIcon(id: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'game-card-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[id] ?? '';
  return svg;
}
