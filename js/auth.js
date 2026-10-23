/* Google API authorization verifies the account; UI gates are not a security boundary. */
function scrub(){
  $('#editor').close();$('#dayList').replaceChildren();$('#weeklyList').replaceChildren();
  for(const id of ['editStart','editEnd','editBreak','exportTotal','accountText','syncDetail','summaryActual','summaryOvertime','summaryForecast','summaryPending']){const el=$('#'+id);if('value' in el)el.value='';else el.textContent='';}
  $('#conflictChoices').replaceChildren();$('#restoreFile').value='';
}
function connect(){
  if(busy||authBusy)return;
  if(!window.google?.accounts?.oauth2){toast('Google接続の準備ができていません。ネット接続を確認して再読み込みしてください。');return;}
  authBusy=true;renderStatus();
  const client=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,include_granted_scopes:false,callback:async result=>{
    if(result.error||!result.access_token){authBusy=false;reportError(Error('Google接続を完了できませんでした。もう一度お試しください。'));return;}
    const oldToken=token,oldExpires=expires;
    token=result.access_token;expires=Date.now()+(Number(result.expires_in)-60)*1000;
    try{
      const info=await api('about?fields=user(permissionId,emailAddress)');
      const id=info.user?.permissionId;if(!id||typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Googleアカウントを確認できませんでした。');
      if(verified&&id!==account&&!safeToLeave())throw Error('未同期の入力があります。今のGoogleアカウントで再接続して同期してから切り替えてください。');
      const same=verified&&id===account;let stored=fresh(),pref=null,exists=false,err='';
      try{pref=localStorage.getItem(prefKey(id));exists=localStorage.getItem(key(id))!==null;if(pref!=='no'&&exists)stored=read(id);}catch(e){err=e.message||'端末保存を利用できません。';}
      const next=same?combine(stored,db):stored;
      scrub();account=id;db=next;email=info.user.emailAddress||'Googleアカウント';retain=pref==='yes'||(pref===null&&exists);migration=pref===null&&exists;cacheError=err;localSaved=retain&&!err;verified=true;everLoaded=same?everLoaded:!!Object.keys(stored.ops).length;lastError='';authBusy=false;
      navigate();await sync();if(!lastError)toast('自分のGoogleドライブに接続しました 🐾');
    }catch(e){token=oldToken;expires=oldExpires;authBusy=false;reportError(e);}
  },error_callback:e=>{authBusy=false;reportError(Error(e.type==='popup_closed'?'接続画面を閉じました。':'接続画面を開けませんでした。ポップアップを許可してお試しください。'));}});
  try{client.requestAccessToken({prompt:'select_account'});}catch(e){authBusy=false;reportError(e);}
}
function logout(){
  if(busy||authBusy){toast('接続・同期の完了をお待ちください。');return;}
  if(!safeToLeave()){toast('未同期の入力があります。同期するか、端末保存を有効にしてからログアウトしてください。');return;}
  if(pending().length&&!confirm('未同期の記録はこのブラウザーに残ります。同じGoogleアカウントで再接続して同期してください。ログアウトしますか？'))return;
  clearTimeout(queueTimer);token='';expires=0;verified=false;account='guest';db=fresh();email='';retain=false;localSaved=false;migration=false;cacheError='';lastError='';everLoaded=false;scrub();location.hash='login';navigate();toast('ログアウトしました');
}
