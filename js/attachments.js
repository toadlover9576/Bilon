// attachments.js

// 💾 Save attachment (either as Blob or File Handle)
async function saveAttachment(file) {
  const MAX_INLINE_SIZE = 5 * 1024 * 1024; // 5 MB threshold

  const record = {
    name: file.name,
    mime: file.type,
    size: file.size,
    createdAt: new Date().toISOString()
  };

  if ("showSaveFilePicker" in window && file.size > MAX_INLINE_SIZE) {
    // Use File System Access API for large files
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: file.name,
        types: [{ description: file.type, accept: { [file.type]: [".*"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();

      record.fileHandleId = await db.attachments.add({
        ...record,
        fileHandleId: handle
      });

      console.log("File stored via File System Access API:", file.name);
      return record.fileHandleId;
    } catch (err) {
      console.error("Failed saving large file:", err);
      alert("File access denied or failed. Using blob fallback.");
    }
  }

  // Fallback: store directly as Blob
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  record.blob = blob;
  const id = await db.attachments.add(record);
  console.log("Attachment stored as blob:", file.name);
  return id;
}

// 📤 Export (download) attachment
async function exportAttachment(id) {
  const file = await db.attachments.get(id);
  if (!file) return alert("File not found.");

  if (file.fileHandleId && "showSaveFilePicker" in window) {
    try {
      const writable = await file.fileHandleId.createWritable();
      await writable.write(file.blob);
      await writable.close();
      console.log("Exported using file handle:", file.name);
      return;
    } catch (err) {
      console.error("Failed to export via handle:", err);
    }
  }

  // Fallback: trigger a normal download
  const blobUrl = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

// 📥 UI helper: select and save attachments
async function handleFileUpload() {
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: true,
      types: [{ description: "All files", accept: { "*/*": [".*"] } }]
    });

    const file = await fileHandle.getFile();
    await saveAttachment(file);
  } catch (err) {
    console.warn("File picker not supported or cancelled, using <input> fallback.");

    // fallback for browsers that don’t support showOpenFilePicker
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async e => {
      for (const f of e.target.files) {
        await saveAttachment(f);
      }
    };
    input.click();
  }
}
