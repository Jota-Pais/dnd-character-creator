package io.github.jotapais.forja;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * O que a casca faz além do Capacitor (docs/app-android.md). Para a página chamar (o site, em
 * apps/web/src/core/native/nativeShell.ts; desde o versionCode 2):
 *
 * - `saveFile`: o "Exportar" e o "Exportar todas". O WebView ignora o download do site (o link com
 *   `download` para um blob:), e o arquivo não saía. Aqui, o "Salvar como" do Android (a pasta
 *   Downloads, o Drive...) grava o texto, e a página sabe se foi salvo ou cancelado.
 * - `print`: o "Imprimir / Salvar PDF". O WebView não implementa o window.print(); aqui, a
 *   impressão do Android da página aberta, que também salva em PDF.
 *
 * Sem nada para a página chamar:
 *
 * - O "Tentar de novo" da página de erro (www/index.html), que não tem a ponte do Capacitor e não
 *   sabe o endereço do site (o da variante de teste é outro): ela navega para RETRY_PATH, e daqui o
 *   app abre o site de novo. Sem o plugin, a navegação sairia do app (o Capacitor abre no navegador
 *   todo endereço fora do site, e a página de erro está fora).
 * - O voltar na página de erro fecha o app, que tenta de novo ao ser aberto. No site, quem cuida do
 *   voltar é ele (o plugin App); a página de erro não tem quem cuide, e o voltar não faria nada.
 * - O processo do WebView que o Android encerra (falta de memória, no segundo plano) recria a tela,
 *   em vez de fechar o app com erro. As fichas estão gravadas; o site reabre o jogo aberto.
 */
@CapacitorPlugin(name = "NativeShell")
public class NativeShellPlugin extends Plugin {

    static final String RETRY_PATH = "/tentar-de-novo";

    /** Recriar de novo tão cedo é o WebView caindo ao abrir: aí o app fecha, sem repetir para sempre. */
    private static final long RECREATE_MIN_INTERVAL_MS = 10_000;
    private static long lastRecreateAt = 0;

    private OnBackPressedCallback errorPageBack;
    private WebViewListener webViewListener;

    /**
     * O ouvinte do WebView entra no início da tela, não no `load()`: o Capacitor troca a lista de
     * ouvintes depois de carregar os plugins (Bridge.Builder.create), e o do `load()` se perderia. O
     * SystemBars do Capacitor faz igual.
     */
    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        if (webViewListener != null) {
            return;
        }
        webViewListener = new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                setOnErrorPage(isErrorPage(Uri.parse(url)));
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                long now = SystemClock.elapsedRealtime();
                if (lastRecreateAt != 0 && now - lastRecreateAt < RECREATE_MIN_INTERVAL_MS) {
                    Logger.error("NativeShell", "O WebView caiu de novo logo depois de recriado: o app fecha.", null);
                    getActivity().finish();
                    return true;
                }
                lastRecreateAt = now;
                Logger.warn("NativeShell", "O processo do WebView foi encerrado: a tela é recriada.");
                getActivity().recreate();
                return true;
            }
        };
        bridge.addWebViewListener(webViewListener);
    }

    /**
     * Grava um arquivo de texto onde a pessoa escolher, pelo "Salvar como" do Android (sem pedir
     * permissão de armazenamento). Resolve `{ saved }`: false quando ela cancela.
     */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || call.getString("text") == null) {
            call.reject("saveFile pede fileName e text");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(call.getString("mimeType", "application/json"))
            .putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) {
                throw new IOException("Sem como escrever em " + uri);
            }
            out.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
            ret.put("saved", true);
            call.resolve(ret);
        } catch (IOException | SecurityException e) {
            Logger.error("NativeShell", "Não deu para gravar o arquivo escolhido.", e);
            call.reject("Não deu para gravar o arquivo", e);
        }
    }

    /**
     * A impressão do Android da página aberta (com o "Salvar como PDF"), pelo CSS de impressão do
     * site, como o window.print() do navegador. `name` vira o nome do trabalho e do PDF.
     */
    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Ficha");
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("O aparelho não tem o serviço de impressão");
                return;
            }
            printManager.print(name, bridge.getWebView().createPrintDocumentAdapter(name), new PrintAttributes.Builder().build());
            call.resolve();
        });
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (!RETRY_PATH.equals(url.getPath()) || !isOnErrorPageOrigin(url)) {
            return null;
        }
        // Com o WebView abaixo do mínimo, o site não abriria direito: a página de erro fica (ela
        // pede a atualização), como o Capacitor faz ao abrir.
        bridge.getWebView().loadUrl(bridge.isMinimumWebViewInstalled() ? bridge.getAppUrl() : bridge.getErrorUrl());
        return true;
    }

    private boolean isErrorPage(Uri url) {
        String errorUrl = bridge.getErrorUrl();
        return errorUrl != null && isOnErrorPageOrigin(url) && Uri.parse(errorUrl).getPath().equals(url.getPath());
    }

    /** A página de erro mora no servidor local do Capacitor (https://localhost), fora do site. */
    private boolean isOnErrorPageOrigin(Uri url) {
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null) {
            return false;
        }
        Uri error = Uri.parse(errorUrl);
        return error.getScheme().equals(url.getScheme()) && error.getAuthority().equals(url.getAuthority());
    }

    /** O voltar próprio da página de erro, por cima do plugin App, só enquanto ela está à vista. */
    private void setOnErrorPage(boolean onErrorPage) {
        if (onErrorPage && errorPageBack == null) {
            errorPageBack = new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    getActivity().finish();
                }
            };
            getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), errorPageBack);
        }
        if (errorPageBack != null) {
            errorPageBack.setEnabled(onErrorPage);
        }
    }
}
