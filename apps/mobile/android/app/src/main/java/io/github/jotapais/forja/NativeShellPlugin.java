package io.github.jotapais.forja;

import android.net.Uri;
import android.os.SystemClock;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * O que a casca faz além do Capacitor, sem nada para a página chamar (docs/app-android.md):
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
