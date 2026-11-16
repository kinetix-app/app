import {
  CHUNK_CHARS,
  createWebViewPoseSource,
  mimeFor,
  POSE_PAGE_HTML,
  WebViewPoseBridge,
} from '../pose/webViewPose';

function connected() {
  const bridge = new WebViewPoseBridge();
  const injected: string[] = [];
  bridge.attach((js) => injected.push(js));
  bridge.handleMessage(JSON.stringify({ type: 'ready' }));
  return { bridge, injected };
}

const frame = (v: number | null) => Array.from({ length: 33 }, () => [v, v]);
const series = {
  t: [0, 1 / 15],
  xy: [frame(0.5), frame(null)],
  visibility: [new Array(33).fill(0.9), new Array(33).fill(null)],
  world: [
    Array.from({ length: 33 }, () => [0, 0, 0]),
    Array.from({ length: 33 }, () => [null, null, null]),
  ],
  width: 640,
  height: 480,
};

describe('WebView pose bridge', () => {
  it('sends the recording in chunks and restores NaN in the landmarks', async () => {
    const { bridge, injected } = connected();
    const base64 = 'A'.repeat(CHUNK_CHARS * 2 + 8);
    const progress: number[] = [];
    const result = bridge.extract({
      base64,
      mime: 'video/mp4',
      onProgress: (f) => progress.push(f),
    });
    await Promise.resolve();
    expect(injected).toHaveLength(4);
    expect(injected.slice(0, 3).every((js) => js.startsWith('window.kinetixReceive(1,'))).toBe(
      true,
    );
    expect(injected[3]).toBe('window.kinetixRun(1,"video/mp4");true;');

    bridge.handleMessage(JSON.stringify({ id: 1, type: 'progress', value: 0.5 }));
    bridge.handleMessage(JSON.stringify({ id: 1, type: 'done', series }));
    const out = await result;
    expect(progress).toEqual([0.5]);
    expect(out.xy[0][0]).toEqual([0.5, 0.5]);
    expect(out.xy[1][0]).toEqual([NaN, NaN]);
    expect(out.visibility[1][0]).toBe(0);
    expect(out.world?.[1][0]).toEqual([NaN, NaN, NaN]);
  });

  it('asks for the WebView and waits for the page before sending', async () => {
    const bridge = new WebViewPoseBridge();
    const listener = jest.fn();
    bridge.subscribe(listener);
    const injected: string[] = [];
    const result = bridge.extract({ base64: 'AAAA', mime: 'video/mp4' });
    expect(bridge.isWanted()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    bridge.attach((js) => injected.push(js));
    await Promise.resolve();
    expect(injected).toHaveLength(0);
    bridge.handleMessage(JSON.stringify({ type: 'ready' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(injected).toHaveLength(2);
    bridge.handleMessage(JSON.stringify({ id: 1, type: 'error', message: 'boom' }));
    await expect(result).rejects.toThrow('boom');
  });

  it('cancels the job in the page when aborted', async () => {
    const { bridge, injected } = connected();
    const controller = new AbortController();
    const result = bridge.extract({ base64: 'AAAA', mime: 'video/mp4', signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(injected[injected.length - 1]).toBe('window.kinetixCancel(1);true;');
  });

  it('fails running jobs when the WebView goes away', async () => {
    const { bridge } = connected();
    const result = bridge.extract({ base64: 'AAAA', mime: 'video/mp4' });
    await Promise.resolve();
    bridge.detach();
    await expect(result).rejects.toThrow('stopped unexpectedly');
  });

  it('reads the recording and picks its type from the file name', async () => {
    const { bridge, injected } = connected();
    const read = jest.fn(async () => 'AAAA');
    const source = createWebViewPoseSource(bridge, read);
    const result = source.extract({ uri: 'file:///rec.mov' });
    await new Promise((r) => setTimeout(r, 0));
    expect(read).toHaveBeenCalledWith('file:///rec.mov');
    expect(injected[1]).toBe('window.kinetixRun(1,"video/quicktime");true;');
    bridge.handleMessage(JSON.stringify({ id: 1, type: 'done', series }));
    await expect(result).resolves.toMatchObject({ width: 640 });
    expect(mimeFor('a.mp4')).toBe('video/mp4');
    expect(mimeFor('a.webm')).toBe('video/webm');
  });

  it('builds a page that installs the extractor and reports ready', () => {
    expect(POSE_PAGE_HTML).toContain('window.kinetixPose = { extract: extract }');
    expect(POSE_PAGE_HTML).toContain("post({ type: 'ready' })");
    expect(POSE_PAGE_HTML).not.toMatch(/<\/script>[\s\S]*<\/script>/);
  });
});
