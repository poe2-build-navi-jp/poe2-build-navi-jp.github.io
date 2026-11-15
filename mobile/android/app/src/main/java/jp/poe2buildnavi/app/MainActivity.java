package jp.poe2buildnavi.app;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://poe2-build-navi-jp.github.io";
    private static final int SAVE = 10, IMPORT = 11, PICK = 12, LIMIT = 8 * 1024 * 1024;
    private WebView web;
    private TextView status;
    private Button refresh;
    private ValueCallback<Uri[]> chooser;
    private byte[] pendingBytes;
    private String pendingImport;
    private boolean ready = false, navigationFailed = false, updateAvailable = false;

    private boolean allowed(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme())) return false;
        String authority = uri.getEncodedAuthority();
        return "poe2-build-navi-jp.github.io".equalsIgnoreCase(authority) || "poe2-build-navi-jp.github.io:443".equalsIgnoreCase(authority);
    }
    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + .5f); }
    private Button button(String text, Runnable action) {
        Button button = new Button(this); button.setText(text); button.setTextSize(13); button.setMinHeight(dp(48)); button.setMinimumWidth(dp(48));
        button.setOnClickListener(v -> action.run()); return button;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom)); return insets;
            });
        } else root.setFitsSystemWindows(true);
        LinearLayout heading = new LinearLayout(this); heading.setGravity(Gravity.CENTER_VERTICAL);
        status = new TextView(this); status.setText("POE2ビルドナビ"); status.setPadding(dp(12), 0, 0, 0); status.setTextSize(15);
        heading.addView(status, new LinearLayout.LayoutParams(0, dp(48), 1));
        refresh = button("更新", this::refresh); heading.addView(refresh); root.addView(heading);
        web = new WebView(this); root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout toolbar = new LinearLayout(this);
        for (Button button : new Button[]{button("戻る", () -> { if (web.canGoBack()) web.goBack(); }), button("進む", () -> { if (web.canGoForward()) web.goForward(); }), button("攻略", () -> load(ORIGIN + "/")), button("シミュ", () -> load(ORIGIN + "/simulator/")), button("共有", () -> share(web.getUrl())), button("その他", this::more)}) toolbar.addView(button, new LinearLayout.LayoutParams(0, dp(52), 1));
        root.addView(toolbar); setContentView(root);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            message("Android System WebViewとChromeを最新版に更新してから、アプリを開き直してください。"); return;
        }
        Set<String> origins = Collections.singleton(ORIGIN);
        WebViewCompat.addWebMessageListener(web, "Poe2Native", origins, (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
            if (!isMainFrame || !allowed(sourceOrigin) || !allowed(Uri.parse(String.valueOf(web.getUrl())))) return;
            try { receive(new JSONObject(message.getData())); } catch (Exception error) { message("アプリへのデータを読み込めませんでした。"); }
        });
        try (InputStream input = getAssets().open("host.js")) {
            ByteArrayOutputStream source = new ByteArrayOutputStream(); byte[] chunk = new byte[8192]; int length;
            while ((length = input.read(chunk)) != -1) source.write(chunk, 0, length);
            String bridge = source.toString(StandardCharsets.UTF_8.name());
            WebViewCompat.addDocumentStartJavaScript(web, bridge, origins);
        } catch (IOException error) { message("アプリのファイルを読み込めませんでした。"); return; }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (allowed(request.getUrl())) return false;
                if (request.hasGesture() && ("https".equals(request.getUrl().getScheme()) || "mailto".equals(request.getUrl().getScheme()))) external(request.getUrl());
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                for (String blocked : new String[]{"googlesyndication.com", "doubleclick.net", "googleadservices.com", "fundingchoicesmessages.google.com", "googletagmanager.com", "google-analytics.com"}) {
                    if (host != null && (host.equals(blocked) || host.endsWith("." + blocked))) return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { ready = false; navigationFailed = false; updateAvailable = false; status.setText("読み込み中…"); }
            @Override public void onPageFinished(WebView view, String url) { if (!navigationFailed && allowed(Uri.parse(url))) { ready = true; status.setText(updateAvailable ? "最新版を反映できます" : "POE2ビルドナビ"); refresh.setText(updateAvailable ? "更新あり" : "更新"); } }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { ready = false; navigationFailed = true; status.setText("通信を確認して「更新」で再試行"); }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) { ready = false; navigationFailed = true; status.setText("ページを開けません。「更新」で再試行"); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = callback;
                try { startActivityForResult(params.createIntent(), PICK); return true; }
                catch (ActivityNotFoundException error) { chooser = null; callback.onReceiveValue(null); return false; }
            }
        });
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> { if (web.canGoBack()) web.goBack(); else finish(); });
        load(ORIGIN + "/simulator/");
    }
    private void external(Uri url) { try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (ActivityNotFoundException error) { message("対応するアプリが見つかりません。"); } }
    private void load(String address) { Uri url = Uri.parse(address); if (allowed(url)) { ready = false; web.loadUrl(address, Collections.singletonMap("Cache-Control", "no-cache")); } }
    private void run(String code) { if (ready && allowed(Uri.parse(String.valueOf(web.getUrl())))) web.evaluateJavascript(code + "; void 0", null); else message("ページの読み込みが終わってからお試しください。"); }
    private void message(String text) { if (!isFinishing()) new AlertDialog.Builder(this).setTitle("POE2ビルドナビ").setMessage(text).setPositiveButton("OK", null).show(); }
    private void refresh() {
        if (!ready) { load(allowed(Uri.parse(String.valueOf(web.getUrl()))) ? web.getUrl() : ORIGIN + "/simulator/"); return; }
        new AlertDialog.Builder(this).setTitle("最新版を読み込む").setMessage("保存済みの構成は残ります。入力途中の項目は、先にページ内の反映ボタンで保存してください。")
            .setNegativeButton("あとで", null).setPositiveButton("更新する", (dialog, which) -> web.evaluateJavascript("window.dispatchEvent(new Event('pagehide')); void 0", result -> load(web.getUrl()))).show();
    }
    private void share(String text) { if (text == null) return; Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text); startActivity(Intent.createChooser(intent, "共有")); }
    private JSONArray favorites() { try { return new JSONArray(getPreferences(MODE_PRIVATE).getString("favorites", "[]")); } catch (JSONException error) { return new JSONArray(); } }
    private void more() {
        new AlertDialog.Builder(this).setTitle("保存と共有").setItems(new String[]{"このページをお気に入りに追加", "お気に入りを開く", "全データのバックアップを書き出す", "アプリのバックアップを復元", "非公式アプリについて"}, (dialog, which) -> {
            if (which == 0) {
                if (!allowed(Uri.parse(String.valueOf(web.getUrl())))) return;
                try {
                    JSONArray values = favorites(), next = new JSONArray(); next.put(new JSONObject().put("url", web.getUrl()).put("title", web.getTitle()));
                    for (int i = 0; i < values.length() && next.length() < 50; i++) if (!web.getUrl().equals(values.getJSONObject(i).getString("url"))) next.put(values.getJSONObject(i));
                    getPreferences(MODE_PRIVATE).edit().putString("favorites", next.toString()).apply(); message("お気に入りに保存しました。");
                } catch (JSONException error) { message("保存できませんでした。"); }
            } else if (which == 1) showFavorites();
            else if (which == 2) run("window.Poe2Host.exportBackup()");
            else if (which == 3 && ready) startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE), IMPORT);
            else if (which == 4) message("Path of Exile 2の非公式ビルド支援アプリです。Grinding Gear Gamesの公式アプリではありません。\n\nWeb版とアプリの保存領域は別です。Web版の保存ファイルでも構成を移せます。");
        }).setNegativeButton("閉じる", null).show();
    }
    private void showFavorites() {
        JSONArray values = favorites(); String[] titles = new String[values.length()];
        for (int i = 0; i < titles.length; i++) titles[i] = values.optJSONObject(i).optString("title", "保存したページ");
        if (titles.length == 0) { message("お気に入りはまだありません。"); return; }
        new AlertDialog.Builder(this).setTitle("お気に入り").setItems(titles, (dialog, which) -> load(values.optJSONObject(which).optString("url"))).setNegativeButton("閉じる", null).show();
    }
    private void receive(JSONObject data) throws JSONException {
        String type = data.optString("type");
        if (type.equals("ready")) ready = true;
        else if (type.equals("update")) { updateAvailable = true; refresh.setText("更新あり"); status.setText("最新版を反映できます"); }
        else if (type.equals("error")) message(data.optString("message", "処理できませんでした。"));
        else if (type.equals("share")) share(data.optString("text"));
        else if (type.equals("file")) {
            if (pendingBytes != null) return;
            String mime = data.optString("mime"), encoded = data.optString("base64");
            if (!Arrays.asList("application/json", "image/png", "image/jpeg").contains(mime) || encoded.length() > 12 * 1024 * 1024) return;
            byte[] bytes = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
            if (bytes.length > LIMIT) return;
            String name = data.optString("name", "poe2-backup.json").replaceAll("[^a-zA-Z0-9._-]", "_");
            if (name.isEmpty() || name.equals(".") || name.equals("..")) return;
            pendingBytes = bytes;
            try { startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).putExtra(Intent.EXTRA_TITLE, name.substring(0, Math.min(100, name.length()))).addCategory(Intent.CATEGORY_OPENABLE), SAVE); }
            catch (ActivityNotFoundException error) { pendingBytes = null; message("ファイル保存に対応するアプリが見つかりません。"); }
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK) { if (chooser != null) chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); chooser = null; return; }
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == SAVE) {
            byte[] bytes = pendingBytes; pendingBytes = null;
            if (uri != null && bytes != null) try (OutputStream output = getContentResolver().openOutputStream(uri)) { if (output == null) throw new IOException(); output.write(bytes); } catch (IOException error) { message("ファイルを保存できませんでした。"); }
        } else if (request == IMPORT && uri != null && ready) {
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IOException();
                ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) { if (output.size() + count > LIMIT) throw new IOException(); output.write(buffer, 0, count); }
                String text = output.toString(StandardCharsets.UTF_8.name());
                web.evaluateJavascript("window.Poe2Host.inspectBackup(" + JSONObject.quote(text) + ")", value -> {
                    try {
                        int entries = new JSONObject(value).getInt("count"); pendingImport = text;
                        new AlertDialog.Builder(this).setTitle("バックアップを復元").setMessage(entries + "件を読み込みます。同じ構成の保存は上書きされます。必要なら先に今のデータをバックアップしてください。")
                            .setNegativeButton("やめる", (dialog, which) -> pendingImport = null).setPositiveButton("復元する", (dialog, which) -> restore()).setOnCancelListener(dialog -> pendingImport = null).show();
                    } catch (JSONException error) { message("このアプリで書き出したバックアップを選んでください。"); }
                });
            } catch (IOException error) { message("8MB以内のJSONバックアップを選んでください。"); }
        }
    }
    private void restore() {
        String text = pendingImport; pendingImport = null; if (text == null || !ready) return;
        web.evaluateJavascript("(() => {try{return {ok:true,count:window.Poe2Host.restoreBackup(" + JSONObject.quote(text) + ")};}catch(e){return {ok:false};}})()", value -> {
            try { if (new JSONObject(value).getBoolean("ok")) load(web.getUrl()); else message("復元できませんでした。バックアップを保持して、端末の空き容量を確認してください。"); }
            catch (JSONException error) { message("復元できませんでした。"); }
        });
    }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); if (ready) web.evaluateJavascript("window.Poe2Host?.checkForUpdate(); void 0", null); } }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (chooser != null) chooser.onReceiveValue(null); if (web != null) { web.stopLoading(); web.destroy(); } pendingBytes = null; super.onDestroy(); }
}
