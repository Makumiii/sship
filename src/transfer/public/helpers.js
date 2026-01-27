(() => {
  function joinRemotePath(base, name) {
    const trimmedBase = (base || "").replace(/\/+$/, "");
    const combined = trimmedBase ? `${trimmedBase}/${name}` : `/${name}`;
    return combined.replace(/\/+/g, "/");
  }

  function formatTransferStatus(type, filePath, percent) {
    const label = type === "download" ? "Downloading" : "Uploading";
    const fileName = filePath ? filePath.split("/").pop() : "";
    const namePart = fileName ? `: ${fileName}` : "";
    return `${label}${namePart} (${percent}%)`;
  }

  function getConnectionState(isRefresh) {
    return {
      panelText: isRefresh ? "Refreshing connection..." : "Connecting to server...",
      statusText: isRefresh ? "Refreshing..." : "Connecting...",
    };
  }

  globalThis.SynergyHelpers = {
    joinRemotePath,
    formatTransferStatus,
    getConnectionState,
  };
})();
