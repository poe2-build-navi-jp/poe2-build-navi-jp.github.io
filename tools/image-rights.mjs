// Applies only to the site's generated editorial diagrams, not arbitrary image assets.
export const imageRights = (site) => ({
  creator: { '@type': 'Organization', name: site.operatorName, url: `${site.baseUrl}/about/` },
  creditText: `出典：${site.operatorName}（${site.siteName}）`,
  copyrightNotice: '図解の制作・編集：オカピ研究所。ゲーム名称・商標等の権利は各権利者に帰属します。利用時は出典表記と元記事へのリンクが必要です。詳細は利用条件を確認してください。',
  license: `${site.baseUrl}/terms/#image-usage`,
  acquireLicensePage: `${site.baseUrl}/terms/#image-permission`
});
export const imageCreditHtml = ' 制作・編集：<a href="/about/">オカピ研究所</a>。<a href="/terms/#image-usage">図解の利用について</a>。';
