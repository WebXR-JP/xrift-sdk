import {
  XriftClient,
  getMimeType,
  parseXriftConfig,
  filterFiles,
  type XriftConfig,
  type XriftWorldConfig,
  type XriftItemConfig,
  type UploadFile,
  type UploadProgress,
  type WorldUploadOptions,
  type ItemUploadOptions,
} from '@xrift/sdk';
import './style.css';

// --- State ---
let config: XriftConfig | null = null;
let distFiles: File[] = [];
let allFiles: File[] = [];

// --- Render ---
function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <h1><span>XRift SDK</span> Browser Example</h1>

    <div class="form-group">
      <label>API トークン</label>
      <input type="password" id="token" placeholder="xrift_..." />
    </div>

    <div class="form-group">
      <label>プロジェクトディレクトリ</label>
      <button class="dir-select-btn" id="dir-select-btn">ディレクトリを選択</button>
      <input type="file" id="dir-input" webkitdirectory hidden />
      <div id="config-info" class="config-info"></div>
    </div>

    <div id="file-section" class="hidden">
      <div class="file-list" id="file-list"></div>
    </div>

    <button class="upload-btn" id="upload-btn" disabled>アップロード</button>

    <div class="progress-area" id="progress-area">
      <div class="progress-bar-container">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div class="progress-text" id="progress-text"></div>
    </div>

    <div class="result-area" id="result-area">
      <div class="result-label" id="result-label"></div>
      <pre id="result-content"></pre>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  const dirBtn = document.getElementById('dir-select-btn')!;
  const dirInput = document.getElementById('dir-input') as HTMLInputElement;

  dirBtn.addEventListener('click', () => dirInput.click());
  dirInput.addEventListener('change', () => {
    if (dirInput.files) handleDirectorySelect(dirInput.files);
  });

  document.getElementById('token')!.addEventListener('input', updateUploadBtn);
  document.getElementById('upload-btn')!.addEventListener('click', handleUpload);
}

// --- Directory handling ---
function handleDirectorySelect(fileList: FileList) {
  allFiles = Array.from(fileList);
  config = null;
  distFiles = [];

  // xrift.json を探す
  const configFile = allFiles.find((f) => {
    const parts = f.webkitRelativePath.split('/');
    return parts.length === 2 && parts[1] === 'xrift.json';
  });

  if (!configFile) {
    showConfigError('xrift.json が見つかりません');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      config = parseXriftConfig(reader.result as string);
      processConfig();
    } catch (err) {
      showConfigError(
        err instanceof Error ? err.message : 'xrift.json のパースに失敗しました',
      );
    }
  };
  reader.readAsText(configFile);
}

function processConfig() {
  if (!config) return;

  const distDir = config.distDir;

  // distDir 配下のファイルを抽出
  // webkitRelativePath: "projectRoot/path/to/file"
  const rootPrefix = allFiles[0]?.webkitRelativePath.split('/')[0];
  const distPrefix = distDir ? `${rootPrefix}/${distDir}/` : `${rootPrefix}/`;

  const candidateFiles = allFiles.filter((f) => {
    const p = f.webkitRelativePath;
    if (!p.startsWith(distPrefix)) return false;
    const relativePath = p.slice(distPrefix.length);
    return !!relativePath;
  });

  // filterFiles で ignore 適用
  const candidatePaths = candidateFiles.map(
    (f) => f.webkitRelativePath.slice(distPrefix.length),
  );
  const filteredPaths = filterFiles(candidatePaths, config.ignore);
  const filteredSet = new Set(filteredPaths);

  distFiles = candidateFiles.filter((f) =>
    filteredSet.has(f.webkitRelativePath.slice(distPrefix.length)),
  );

  showConfigInfo(distDir);
  renderFileList();
  updateUploadBtn();
}

function showConfigInfo(distDir: string) {
  if (!config) return;
  const info = document.getElementById('config-info')!;
  const title = config.name;

  info.className = 'config-info visible';
  info.innerHTML = `
    <div class="config-badge ${config.type}">${config.type === 'world' ? 'ワールド' : 'アイテム'}</div>
    <div class="config-detail"><span>タイトル:</span> ${escapeHtml(title)}</div>
    <div class="config-detail"><span>distDir:</span> ${escapeHtml(distDir || '.')}</div>
    <div class="config-detail"><span>ファイル数:</span> ${distFiles.length} 件</div>
    <div class="config-detail"><span>除外パターン:</span> ${config.ignore.length} 件</div>
  `;

  document.getElementById('file-section')!.classList.remove('hidden');
}

function showConfigError(message: string) {
  const info = document.getElementById('config-info')!;
  info.className = 'config-info visible error';
  info.textContent = message;

  document.getElementById('file-section')!.classList.add('hidden');
  distFiles = [];
  updateUploadBtn();
}

function renderFileList() {
  const list = document.getElementById('file-list')!;
  if (distFiles.length === 0) {
    list.innerHTML = '<div class="hint">distDir 内にファイルがありません</div>';
    return;
  }

  const prefix = getDistPrefix();

  list.innerHTML = distFiles
    .map((f) => {
      const relativePath = f.webkitRelativePath.slice(prefix.length);
      return `
    <div class="file-item">
      <span class="name">${escapeHtml(relativePath)}</span>
      <span class="size">${formatSize(f.size)}</span>
    </div>`;
    })
    .join('');
}

function updateUploadBtn() {
  const token = (document.getElementById('token') as HTMLInputElement).value.trim();
  const btn = document.getElementById('upload-btn') as HTMLButtonElement;
  btn.disabled = !token || !config || distFiles.length === 0;
}

// --- Upload ---
async function handleUpload() {
  const token = (document.getElementById('token') as HTMLInputElement).value.trim();
  if (!config) return;

  const prefix = getDistPrefix();

  const btn = document.getElementById('upload-btn') as HTMLButtonElement;
  const progressArea = document.getElementById('progress-area')!;
  const progressBar = document.getElementById('progress-bar')!;
  const progressText = document.getElementById('progress-text')!;
  const resultArea = document.getElementById('result-area')!;

  btn.disabled = true;
  resultArea.classList.remove('visible', 'error', 'success');
  progressArea.classList.add('visible');
  progressBar.style.width = '0%';
  progressText.textContent = 'ファイルを準備中...';

  try {
    const uploadFiles: UploadFile[] = await Promise.all(
      distFiles.map(async (file) => {
        const data = await file.arrayBuffer();
        const remotePath = file.webkitRelativePath.slice(prefix.length);
        return {
          remotePath,
          size: file.size,
          contentType: getMimeType(remotePath),
          data,
        };
      }),
    );

    const onProgress = (progress: UploadProgress) => {
      const pct = Math.round((progress.completed / progress.total) * 100);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `${progress.currentFile} (${progress.completed}/${progress.total})`;
    };

    const client = new XriftClient({ token });

    let result: unknown;
    if (config.type === 'world') {
      const wc = config as XriftWorldConfig;
      const options: WorldUploadOptions = {
        name: wc.name,
        description: wc.description,
        thumbnailPath: wc.thumbnailPath,
        physics: wc.physics,
        camera: wc.camera,
        permissions: wc.permissions,
        outputBufferType: wc.outputBufferType,
        onProgress,
      };
      result = await client.worlds.upload(uploadFiles, options);
    } else {
      const ic = config as XriftItemConfig;
      const options: ItemUploadOptions = {
        name: ic.name,
        description: ic.description,
        thumbnailPath: ic.thumbnailPath,
        permissions: ic.permissions,
        onProgress,
      };
      result = await client.items.upload(uploadFiles, options);
    }

    progressBar.style.width = '100%';
    progressText.textContent = '完了';
    showResult(result, false);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showResult(message, true);
  } finally {
    btn.disabled = false;
  }
}

function showResult(data: unknown, isError: boolean) {
  const resultArea = document.getElementById('result-area')!;
  const resultLabel = document.getElementById('result-label')!;
  const resultContent = document.getElementById('result-content')!;

  resultArea.classList.add('visible');
  resultArea.classList.toggle('error', isError);
  resultArea.classList.toggle('success', !isError);

  resultLabel.textContent = isError ? 'エラー' : 'アップロード成功';
  resultContent.textContent = isError ? String(data) : JSON.stringify(data, null, 2);
}

// --- Path helpers ---
function getDistPrefix(): string {
  if (!config) return '';
  const distDir = config.distDir;
  const rootPrefix = allFiles[0]?.webkitRelativePath.split('/')[0];
  return distDir ? `${rootPrefix}/${distDir}/` : `${rootPrefix}/`;
}

// --- Utils ---
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Init ---
render();
