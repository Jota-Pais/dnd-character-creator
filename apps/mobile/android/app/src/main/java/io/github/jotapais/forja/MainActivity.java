package io.github.jotapais.forja;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

/**
 * A casca do APK (docs/app-android.md): o Capacitor abre o site publicado num WebView, e o site faz
 * o resto (o voltar, a tela acesa, a versão mínima; ver apps/web/src/core/native).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeShellPlugin.class);
        super.onCreate(savedInstanceState);
        // De ponta a ponta em todo Android, como o 15 já impõe: as barras transparentes, com ícones
        // claros sobre o tema escuro. Quem afasta o conteúdo delas é o SystemBars do Capacitor: com o
        // WebView 140 ou mais novo, as margens env(safe-area-inset-*) do site; no mais velho, a
        // página encolhe para dentro das barras, que mostram o fundo da janela (o do tema).
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
    }
}
