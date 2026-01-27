let currentLocalPath = '';
let currentRemotePath = ''; // Empty string defaults to home dir on backend
let selectedServer = null;
let selectedLocalFiles = [];
let selectedRemoteFiles = [];
const helpers = globalThis.SynergyHelpers || {};

// Tracking for range selection
let lastSelectedLocalIdx = -1;
let lastSelectedRemoteIdx = -1;
let localFilesData = [];
let remoteFilesData = [];

let currentTransferController = null;
let progressEventSource = null;

async function init() {
    await loadServers();
    await loadLocalFiles('');
}

// SSE Progress Handling
function initProgressStream() {
    if (progressEventSource) return;
    progressEventSource = new EventSource('/api/progress');
    progressEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.percent !== undefined) {
            // Show file name if provided, or generic "Processing"
            if (data.file && helpers.formatTransferStatus) {
                showStatus(helpers.formatTransferStatus(data.type, data.file, data.percent));
            }
            setProgress(data.percent);
        }
    };
}

function closeProgressStream() {
    if (progressEventSource) {
        progressEventSource.close();
        progressEventSource = null;
    }
}

async function loadServers() {
    try {
        const res = await fetch('/api/servers');
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('serverSelect');
            data.data.forEach(server => {
                const option = document.createElement('option');
                option.value = server.name;
                option.textContent = server.name;
                option.title = server.user + '@' + server.host;
                select.appendChild(option);
            });
        }
    } catch (err) {
        showStatus('Failed to load servers', 'error');
    }
}

async function loadLocalFiles(path) {
    try {
        const url = path ? '/api/local?path=' + encodeURIComponent(path) : '/api/local';
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            currentLocalPath = data.data.path;
            localFilesData = data.data.files;
            document.getElementById('localPath').textContent = currentLocalPath;
            renderFiles(document.getElementById('localFiles'), localFilesData, 'local');
            selectedLocalFiles = [];
            lastSelectedLocalIdx = -1;
            updateState();
        } else {
            showStatus(data.error, 'error');
        }
    } catch (err) {
        showStatus('Local list error: ' + err.message, 'error');
    }
}

async function loadRemoteFiles(path) {
    if (!selectedServer) return;
    try {
        const res = await fetch('/api/remote?server=' + encodeURIComponent(selectedServer) + '&path=' + encodeURIComponent(path));
        const data = await res.json();

        if (data.success) {
            currentRemotePath = data.data.path;
            remoteFilesData = data.data.files;
            document.getElementById('remotePath').textContent = currentRemotePath;
            renderFiles(document.getElementById('remoteFiles'), remoteFilesData, 'remote');
            selectedRemoteFiles = [];
            lastSelectedRemoteIdx = -1;
            updateState();
            setConnectionState('success', 'Connected to ' + selectedServer);
        } else {
            showStatus(data.error, 'error');
            setConnectionState('error', 'Connection failed');
        }
    } catch (err) {
        showStatus('Remote list error', 'error');
        setConnectionState('error', 'Connection failed');
    }
}

function renderFiles(container, files, type) {
    const folderIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4H5a2 2 0 0 1-2-2V6z"/></svg>';
    const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V7h3.5L14 3.5z"/></svg>';
    container.innerHTML = '';
    if (!files || files.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: #8b949e; font-size: 12px;">Empty directory</div>';
        return;
    }

    files.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.setAttribute('draggable', true);
        div.dataset.index = index;
        div.innerHTML = '<span class="file-icon">' + (file.isDir ? folderIcon : fileIcon) + '</span>' +
            '<span class="file-name">' + file.name + '</span>';

        div.onclick = (e) => {
            e.stopPropagation();
            handleSelection(type, index, e.shiftKey, e.ctrlKey || e.metaKey);
        };

        div.ondblclick = (e) => {
            if (!file.isDir) return;
            const next = type === 'local'
                ? currentLocalPath + '/' + file.name
                : (helpers.joinRemotePath
                    ? helpers.joinRemotePath(currentRemotePath, file.name)
                    : (currentRemotePath + '/' + file.name).replace(/\/+/g, '/'));
            type === 'local' ? loadLocalFiles(next) : loadRemoteFiles(next);
        };

        div.ondragstart = (e) => {
            // Ensure the dragged file is selected if it wasn't
            const currentList = type === 'local' ? selectedLocalFiles : selectedRemoteFiles;
            if (!currentList.includes(file.name)) {
                handleSelection(type, index, false, false);
            }

            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: type,
                files: type === 'local' ? selectedLocalFiles : selectedRemoteFiles,
                sourcePath: type === 'local' ? currentLocalPath : currentRemotePath
            }));
            e.dataTransfer.effectAllowed = 'copy';
        };

        container.appendChild(div);
    });
}

function handleSelection(type, index, isShift, isCtrl) {
    const files = type === 'local' ? localFilesData : remoteFilesData;
    const selectedList = type === 'local' ? selectedLocalFiles : selectedRemoteFiles;
    const lastIdx = type === 'local' ? lastSelectedLocalIdx : lastSelectedRemoteIdx;

    // 1. Mutual Exclusivity: Clear OTHER selection
    if (type === 'local') {
        selectedRemoteFiles = [];
        lastSelectedRemoteIdx = -1;
        refreshUISelection('remote');
    } else {
        selectedLocalFiles = [];
        lastSelectedLocalIdx = -1;
        refreshUISelection('local');
    }

    if (isShift && lastIdx !== -1) {
        // Range selection
        const start = Math.min(lastIdx, index);
        const end = Math.max(lastIdx, index);

        if (!isCtrl) selectedList.length = 0;

        for (let i = start; i <= end; i++) {
            if (!selectedList.includes(files[i].name)) {
                selectedList.push(files[i].name);
            }
        }
    } else if (isCtrl) {
        // Individual toggle
        const name = files[index].name;
        const idx = selectedList.indexOf(name);
        if (idx > -1) selectedList.splice(idx, 1);
        else selectedList.push(name);
        if (type === 'local') lastSelectedLocalIdx = index; else lastSelectedRemoteIdx = index;
    } else {
        // Single selection
        selectedList.length = 0;
        selectedList.push(files[index].name);
        if (type === 'local') lastSelectedLocalIdx = index; else lastSelectedRemoteIdx = index;
    }

    refreshUISelection(type);
    updateState();
}

// Auto-focus logic
function updatePaneFocus() {
    const localPane = document.getElementById('localPane');
    const remotePane = document.getElementById('remotePane');

    if (selectedLocalFiles.length > 0) {
        localPane.classList.remove('inactive');
        remotePane.classList.add('inactive');
    } else if (selectedRemoteFiles.length > 0) {
        localPane.classList.add('inactive');
        remotePane.classList.remove('inactive');
    } else {
        // No selection: both active
        localPane.classList.remove('inactive');
        remotePane.classList.remove('inactive');
    }
}

function refreshUISelection(type) {
    const container = document.getElementById(type + 'Files');
    const selectedList = type === 'local' ? selectedLocalFiles : selectedRemoteFiles;
    const items = container.querySelectorAll('.file-item');

    items.forEach((item, idx) => {
        const files = type === 'local' ? localFilesData : remoteFilesData;
        if (selectedList.includes(files[idx].name)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function clearSelection(type) {
    if (type === 'local') {
        selectedLocalFiles = [];
        lastSelectedLocalIdx = -1;
    } else {
        selectedRemoteFiles = [];
        lastSelectedRemoteIdx = -1;
    }
    refreshUISelection(type);
    updateState();
}

// Drag and Drop Handlers
function handleDragOver(e, targetPane) {
    e.preventDefault();
    const pane = document.getElementById(targetPane + 'Pane');
    pane.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(e, targetPane) {
    const pane = document.getElementById(targetPane + 'Pane');
    pane.classList.remove('drag-over');
}

function handleDrop(e, targetPane) {
    e.preventDefault();
    handleDragLeave(e, targetPane);

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === targetPane) return; // Drop on same pane

        if (data.type === 'local' && targetPane === 'remote') {
            // Trigger Upload
            uploadFiles();
        } else if (data.type === 'remote' && targetPane === 'local') {
            // Trigger Download
            downloadFiles();
        }
    } catch (err) {
        console.error('Drop handling failed', err);
    }
}

function updateState() {
    updatePaneFocus();

    const btn = document.getElementById('actionBtn');
    const info = document.getElementById('actionInfo');
    const status = document.getElementById('status');

    // Default State
    btn.disabled = true;
    btn.className = '';
    btn.textContent = 'Select files to start';
    info.style.display = 'none';

    if (!selectedServer) {
        status.textContent = 'Select a server to start';
        return;
    }

    if (selectedLocalFiles.length > 0) {
        // UPLOAD MODE
        btn.disabled = false;
        btn.className = 'upload';
        btn.innerHTML = `Upload to <strong>${currentRemotePath || '/'}</strong>`;
        status.textContent = `Ready to upload ${selectedLocalFiles.length} item(s)`;

    } else if (selectedRemoteFiles.length > 0) {
        // DOWNLOAD MODE
        btn.disabled = false;
        btn.className = 'download';
        btn.innerHTML = `Download to <strong>${currentLocalPath}</strong>`;
        status.textContent = `Ready to download ${selectedRemoteFiles.length} item(s)`;

    } else {
        status.textContent = 'Browse and select files';
    }
}

function performSmartAction() {
    if (selectedLocalFiles.length > 0) {
        uploadFiles();
    } else if (selectedRemoteFiles.length > 0) {
        downloadFiles();
    }
}

function showStatus(text, type = 'info') {
    const el = document.getElementById('status');
    el.textContent = text;
    el.className = 'status-text ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
}

function setProgress(percent) {
    const container = document.getElementById('progressContainer');
    const bar = document.getElementById('progressBar');
    const spinner = document.getElementById('spinner');
    const cancelBtn = document.getElementById('cancelBtn');

    if (percent === null) {
        container.style.display = 'none';
        spinner.style.display = 'none';
        cancelBtn.style.display = 'none';
    } else {
        container.style.display = 'block';
        spinner.style.display = 'block';
        cancelBtn.style.display = 'flex';
        bar.style.width = percent + '%';
    }
}

function cancelTransfer() {
    if (currentTransferController) {
        currentTransferController.abort();
        currentTransferController = null;
        closeProgressStream();
        showStatus('Transfer canceled', 'error');
        setProgress(null);
    }
}

async function uploadFiles() {
    if (!selectedServer || selectedLocalFiles.length === 0) return;

    currentTransferController = new AbortController();
    const signal = currentTransferController.signal;

    const total = selectedLocalFiles.length;
    setProgress(0);
    initProgressStream();

    try {
        for (let i = 0; i < total; i++) {
            if (signal.aborted) throw new Error("Canceled");

            const file = selectedLocalFiles[i];
            // Initial status before SSE takes over
            showStatus('Starting upload: ' + file);

            const res = await fetch('/api/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: selectedServer,
                    direction: 'upload',
                    localPath: currentLocalPath + '/' + file,
                    remotePath: currentRemotePath
                }),
                signal: signal
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Upload failed');
        }
        showStatus('Successfully uploaded ' + total + ' files', 'success');
        setTimeout(() => loadRemoteFiles(currentRemotePath), 500);
    } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Canceled') {
            showStatus('Transfer canceled', 'error');
        } else {
            showStatus('Error: ' + err.message, 'error');
        }
    } finally {
        closeProgressStream();
        currentTransferController = null;
        setTimeout(() => setProgress(null), 2000);
    }
}

async function downloadFiles() {
    if (!selectedServer || selectedRemoteFiles.length === 0) return;

    currentTransferController = new AbortController();
    const signal = currentTransferController.signal;

    const total = selectedRemoteFiles.length;
    setProgress(0);
    initProgressStream();

    try {
        for (let i = 0; i < total; i++) {
            if (signal.aborted) throw new Error("Canceled");

            const file = selectedRemoteFiles[i];
            showStatus('Starting download: ' + file);

            const res = await fetch('/api/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: selectedServer,
                    direction: 'download',
                    localPath: currentLocalPath,
                    remotePath: currentRemotePath + '/' + file
                }),
                signal: signal
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Download failed');
        }
        showStatus('Successfully downloaded ' + total + ' files', 'success');
        setTimeout(() => loadLocalFiles(currentLocalPath), 500);
    } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Canceled') {
            showStatus('Transfer canceled', 'error');
        } else {
            showStatus('Error: ' + err.message, 'error');
        }
    } finally {
        closeProgressStream();
        currentTransferController = null;
        setTimeout(() => setProgress(null), 2000);
    }
}

function goToLocalParent() {
    const p = currentLocalPath.split('/').filter(Boolean);
    if (p.length > 0) { p.pop(); loadLocalFiles('/' + p.join('/')); }
}

function goToRemoteParent() {
    const p = currentRemotePath.split('/').filter(Boolean);
    if (p.length > 0) { p.pop(); loadRemoteFiles('/' + p.join('/')); }
}

document.getElementById('serverSelect').addEventListener('change', e => {
    selectedServer = e.target.value;
    if (selectedServer) {
        connectToServer();
    } else {
        document.getElementById('remoteFiles').innerHTML = '<div style="padding: 20px; color: #8b949e;">Select a server to browse</div>';
        document.getElementById('remotePath').textContent = '';
        setConnectionState('idle', '');
    }
    updateState();
});

document.getElementById('refreshServerBtn').addEventListener('click', () => {
    if (!selectedServer) return;
    connectToServer(true);
});

function connectToServer(isRefresh = false) {
    const remoteList = document.getElementById('remoteFiles');
    const state = helpers.getConnectionState
        ? helpers.getConnectionState(isRefresh)
        : {
            panelText: isRefresh ? 'Refreshing connection...' : 'Connecting to server...',
            statusText: isRefresh ? 'Refreshing...' : 'Connecting...',
        };
    remoteList.innerHTML = '<div style="padding: 20px; color: #8b949e;">' +
        state.panelText +
        '</div>';
    setConnectionState('loading', state.statusText);
    const targetPath = currentRemotePath || '';
    loadRemoteFiles(targetPath);
}

function setConnectionState(state, message) {
    const serverSelect = document.getElementById('serverSelect');
    const refreshBtn = document.getElementById('refreshServerBtn');
    const status = document.getElementById('serverStatus');
    const dot = document.getElementById('serverStatusDot');

    const isLoading = state === 'loading';
    serverSelect.disabled = isLoading;
    refreshBtn.disabled = isLoading || !selectedServer;
    status.textContent = message || '';
    status.classList.toggle('loading', isLoading);

    dot.classList.remove('loading', 'success', 'error');
    if (state === 'loading') dot.classList.add('loading');
    if (state === 'success') dot.classList.add('success');
    if (state === 'error') dot.classList.add('error');
}

init();
