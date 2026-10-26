// Shared presentation only: never changes article facts or SEO metadata.
export function applyGuideReadingLayout(html){
 if(!/<body[^>]*class="[^"]*\bguide-reading\b/.test(html))html=html.replace(/<body([^>]*)>/,(_,attrs)=>attrs.includes('class="')?`<body${attrs.replace('class="','class="guide-reading ')}>`:`<body${attrs} class="guide-reading">`);
 if(!html.includes('/assets/guide-reading.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/guide-reading.css"></head>');
 return html;
}
