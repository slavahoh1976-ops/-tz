package com.ledmask.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import android.provider.Settings;
import java.net.HttpURLConnection;
import java.net.URL;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * LED Pixel Mask Generator для Android: веб-версия из assets/index.html
 * внутри WebView. Файлы (PNG, ZIP с ТЗ, проекты .ledmask) сохраняются
 * через мост AndroidBridge в «Загрузки/LED Mask».
 */
public class MainActivity extends Activity {
    private static final String ACTION_INSTALL_STATUS = "com.ledmask.app.INSTALL_STATUS";
    private static final int REQ_OPEN_FILE = 41;
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final Map<String, File> pending = new HashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(i, REQ_OPEN_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    /** Результат установки обновления (PackageInstaller): подтверждение пользователя или ошибка. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { startActivity(confirm); } catch (Exception e) { jsFail("не удалось открыть установку"); }
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            jsFail(status == PackageInstaller.STATUS_FAILURE_ABORTED ? "установка отменена" : (msg != null ? msg : "установка не удалась"));
        }
    }

    private void js(final String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private void jsFail(String msg) {
        js("window.__updateFailed && window.__updateFailed(" + org.json.JSONObject.quote(msg) + ")");
    }

    /** Скачивает APK и передаёт его системному установщику (Android спросит подтверждение). */
    private void downloadAndInstall(String url) {
        HttpURLConnection c = null;
        try {
            URL u = new URL(url);
            for (int hop = 0; hop < 6; hop++) { // переходы GitHub → хранилище файлов
                c = (HttpURLConnection) u.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(20000); c.setReadTimeout(60000);
                c.setRequestProperty("User-Agent", "LED-Mask-Android");
                int code = c.getResponseCode();
                if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                    u = new URL(u, c.getHeaderField("Location")); c.disconnect(); continue;
                }
                if (code != 200) throw new Exception("сайт ответил " + code);
                break;
            }
            long total = c.getContentLengthLong();
            PackageInstaller pi = getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getPackageName());
            int sid = pi.createSession(params);
            try (PackageInstaller.Session session = pi.openSession(sid)) {
                try (OutputStream out = session.openWrite("update.apk", 0, total > 0 ? total : -1);
                     InputStream in = c.getInputStream()) {
                    byte[] buf = new byte[1 << 16];
                    long done = 0; double last = -1;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); done += n;
                        if (total > 0 && (double) done / total - last >= 0.02) {
                            last = (double) done / total;
                            js("window.__updateProgress && window.__updateProgress(" + last + ")");
                        }
                    }
                    session.fsync(out);
                }
                Intent status = new Intent(this, MainActivity.class).setAction(ACTION_INSTALL_STATUS);
                PendingIntent pending = PendingIntent.getActivity(this, 7, status, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                session.commit(pending.getIntentSender());
            }
        } catch (Exception e) {
            jsFail(e.getMessage() != null ? e.getMessage() : "ошибка загрузки");
        } finally {
            if (c != null) c.disconnect();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_OPEN_FILE) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private static String mimeFor(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".zip")) return "application/zip";
        if (n.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (n.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    /** Мост для страницы: файл передаётся кусками base64, затем пишется в «Загрузки». */
    private class Bridge {
        /** Обновление приложения: «ok» — загрузка началась, «err:…» — что мешает. */
        @JavascriptInterface
        public String update(final String url) {
            if (!getPackageManager().canRequestPackageInstalls()) {
                runOnUiThread(() -> {
                    try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); }
                    catch (Exception ignored) { }
                });
                return "err:разрешите установку из этого приложения в открывшихся настройках, вернитесь и нажмите «Проверить обновления» ещё раз";
            }
            new Thread(() -> downloadAndInstall(url)).start();
            return "ok";
        }

        @JavascriptInterface
        public String begin(String name) {
            try {
                String id = UUID.randomUUID().toString();
                File f = new File(getCacheDir(), id + ".part");
                new FileOutputStream(f).close();
                synchronized (pending) { pending.put(id, f); }
                return id;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean append(String id, String b64) {
            File f;
            synchronized (pending) { f = pending.get(id); }
            if (f == null) return false;
            try (FileOutputStream out = new FileOutputStream(f, true)) {
                out.write(Base64.decode(b64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String finish(String id, String name) {
            File f;
            synchronized (pending) { f = pending.remove(id); }
            if (f == null) return "error:нет данных";
            try {
                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mimeFor(name));
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/LED Mask");
                v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "error:не удалось создать файл";
                try (OutputStream out = cr.openOutputStream(uri); InputStream in = new FileInputStream(f)) {
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                v.clear();
                v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                cr.update(uri, v, null, null);
                final String msg = "Сохранено: Загрузки/LED Mask/" + name;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
                return "ok:" + msg;
            } catch (Exception e) {
                return "error:" + e.getMessage();
            } finally {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }
}
