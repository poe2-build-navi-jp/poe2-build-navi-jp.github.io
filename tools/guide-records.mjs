const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Screenshot transcriptions are plain text, never executable HTML.
export function recordTable(table) {
  if (!table) return '';
  if (!table.caption || !table.headers?.length || !table.rows?.length || table.rows.some(row => row.length !== table.headers.length)) throw new Error('Invalid guide record table');
  return `<div class="guide-record-table" role="region" aria-label="${esc(table.caption)}" tabindex="0"><table><caption>${esc(table.caption)}</caption><thead><tr>${table.headers.map(header => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Game screenshots must not inherit the site's original-diagram licensing claims.
export function recordScreenshots(images = []) {
  return images.map(image => {
    if (!image.src?.startsWith('/images/') || !image.alt || !image.caption || !(image.width > 0) || !(image.height > 0)) throw new Error('Invalid guide screenshot');
    return `<figure class="guide-record-image"><a href="${esc(image.src)}" aria-label="拡大：${esc(image.alt)}"><img src="${esc(image.src)}" alt="${esc(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"></a><figcaption>${esc(image.caption)} ゲーム内画像：Grinding Gear Games。提供画像の装備・ステータス部分を掲載。</figcaption></figure>`;
  }).join('');
}
