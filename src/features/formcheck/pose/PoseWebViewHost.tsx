import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { POSE_PAGE_HTML, webViewPose } from './webViewPose';

/**
 * Invisible WebView that extracts poses on Android and iOS. Mounted only once a recording needs
 * it, then kept so the model stays loaded for the next sets.
 */
export function PoseWebViewHost() {
  const wanted = useSyncExternalStore(webViewPose.subscribe, webViewPose.isWanted);
  // A crashed WebView process is replaced by a fresh one.
  const [generation, setGeneration] = useState(0);
  if (!wanted) return null;
  const restart = () => {
    webViewPose.detach();
    setGeneration((g) => g + 1);
  };
  return (
    <View pointerEvents="none" style={styles.hidden} accessibilityElementsHidden>
      <WebView
        key={generation}
        ref={(view) => {
          if (view) webViewPose.attach((js) => view.injectJavaScript(js));
          else webViewPose.detach();
        }}
        source={{ html: POSE_PAGE_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={(event) => webViewPose.handleMessage(event.nativeEvent.data)}
        onContentProcessDidTerminate={restart}
        onRenderProcessGone={restart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: 0, top: 0 },
});
