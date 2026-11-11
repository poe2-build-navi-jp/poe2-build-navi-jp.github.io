(() => {
 const form=document.getElementById('issue-form');
 if(!form)return;
 const output=document.getElementById('report-output'),text=document.getElementById('report-text'),status=document.getElementById('report-status');
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(form),get=k=>String(data.get(k)||'').trim()||'未記入';
  text.value=`【症状】\n${get('summary')}\n\n【環境】\n${get('platform')}\n【バージョン・リーグ】\n${get('version')}\n【発生日時・ゲートウェイ】\n${get('when')}\n\n【再現手順】\n${get('steps')}\n\n【期待した動作／実際の動作】\n${get('result')}\n\n【頻度・試した対処・エラー文】\n${get('extra')}`;
  output.hidden=false;status.textContent='報告文を作成しました。まだ送信されていません。';text.focus();
 });
 form.addEventListener('reset',()=>{output.hidden=true;text.value='';status.textContent='入力と報告文を消しました。';});
 document.getElementById('copy-report').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(text.value);status.textContent='コピーしました。公式フォーラムで内容を確認して投稿してください。';}
  catch{ text.focus();text.select();status.textContent='自動コピーできませんでした。選択された文章を手動でコピーしてください。';}
 });
})();
