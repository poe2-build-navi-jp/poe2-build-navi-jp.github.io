// Put the actual build choice before optional guides, samples and backup controls.
export function improveChooser(html) {
 const start=html.indexOf('<h2 class="sim-choice-title">'),end=html.indexOf('<section class="sim-explain">',start);
 if(start<0||end<0)throw Error('Simulator chooser anchors missing');
 let choice=html.slice(start,end);
 choice=choice.replace('<div class="sim-choice-tools">','<div class="sim-choice-tools"><label for="sim-build-search">ビルド名・スキル名で検索<input id="sim-build-search" type="search" placeholder="例：ツイスター、Spark" autocomplete="off"></label>');
 choice=choice.replace('</select></label></div>','</select></label><button id="sim-build-reset" type="button">絞り込みを解除</button></div><p id="sim-build-count" role="status"></p><p id="sim-build-empty" hidden>該当するビルドがありません。検索を短くするか、絞り込みを解除してください。</p><p class="sim-resume-shortcut"><a href="#sim-resume">保存した構成から続ける</a></p>');
 html=html.slice(0,start)+html.slice(end);
 html=html.replace('<div class="sim-chooser-body">','<div class="sim-chooser-body">'+choice);
 html=html.replace('<section class="sim-first-guide" aria-labelledby="sim-first-title">','<details class="sim-first-guide"><summary>使い方を3ステップで確認</summary><section class="sim-first-guide-content" aria-labelledby="sim-first-title">');
 html=html.replace('</p></section><section id="sim-resume"','</p></section></details><section id="sim-resume"');
 return html;
}
