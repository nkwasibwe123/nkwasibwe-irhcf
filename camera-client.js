"use strict";
(() => {
  const cameraButton = document.getElementById("cameraButton");
  const fileInput = document.getElementById("fileInput");
  if (!cameraButton || !fileInput) return;
  let stream = null, recorder = null, chunks = [], recordingTimer = null;
  let modal, video, status, captureButton, recordButton;
  function setStatus(message) { if (status) status.textContent = message; }
  function stopTracks() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) video.srcObject = null;
  }
  function closeCamera() {
    if (recordingTimer) clearTimeout(recordingTimer);
    recordingTimer = null;
    if (recorder && recorder.state !== "inactive") { recorder.onstop = () => stopTracks(); recorder.stop(); }
    else stopTracks();
    if (modal) modal.hidden = true;
    if (captureButton) captureButton.disabled = false;
    if (recordButton) { recordButton.disabled = false; recordButton.textContent = "● Record video"; }
  }
  function ensureModal() {
    if (modal) return;
    modal = document.createElement("div"); modal.className = "irhcf-camera-modal"; modal.hidden = true;
    modal.innerHTML = '<section class="irhcf-camera-panel" role="dialog" aria-modal="true" aria-labelledby="irhcfCameraTitle"><header class="irhcf-camera-header"><h2 id="irhcfCameraTitle">Live camera · IRHCF</h2><button type="button" class="irhcf-camera-close" aria-label="Close camera">×</button></header><video class="irhcf-camera-preview" autoplay playsinline muted></video><p class="irhcf-camera-status" role="status" aria-live="polite">Preparing camera…</p><div class="irhcf-camera-actions"><button type="button" class="irhcf-camera-primary irhcf-camera-capture">📷 Take photo</button><button type="button" class="irhcf-camera-danger irhcf-camera-record">● Record video</button><button type="button" class="irhcf-camera-switch">Switch camera</button></div></section>';
    document.body.appendChild(modal);
    video = modal.querySelector("video"); status = modal.querySelector(".irhcf-camera-status");
    captureButton = modal.querySelector(".irhcf-camera-capture"); recordButton = modal.querySelector(".irhcf-camera-record");
    modal.querySelector(".irhcf-camera-close").addEventListener("click", closeCamera);
    modal.addEventListener("click", e => { if (e.target === modal) closeCamera(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeCamera(); });
    captureButton.addEventListener("click", capturePhoto); recordButton.addEventListener("click", toggleVideoRecording);
    modal.querySelector(".irhcf-camera-switch").addEventListener("click", async () => {
      const current = stream && stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings().facingMode;
      await startCamera(current === "environment" ? "user" : "environment");
    });
  }
  async function startCamera(facingMode) {
    stopTracks();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Live camera requires HTTPS and a modern browser.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: { ideal: facingMode || "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      video.srcObject = stream; await video.play();
      setStatus("Camera ready. Take a photo or record a video (up to 60 seconds).");
    } catch (error) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode || "environment" } }, audio: false });
        video.srcObject = stream; await video.play();
        setStatus("Camera ready. Audio permission was not granted; video may be silent.");
      } catch (fallbackError) { stopTracks(); setStatus((fallbackError && fallbackError.message) || error.message || "Could not open camera. Check browser permissions."); }
    }
  }
  async function openCamera() { ensureModal(); modal.hidden = false; await startCamera("environment"); }
  function attachBlob(blob, filename) {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream", lastModified: Date.now() });
    try {
      const transfer = new DataTransfer(); transfer.items.add(file);
      fileInput.dataset.transcribeAudio = "false"; fileInput.dataset.videoReference = "false";
      fileInput.removeAttribute("capture");
      fileInput.accept = "image/*,video/*,audio/*,application/pdf,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileInput.files = transfer.files; fileInput.dispatchEvent(new Event("change", { bubbles: true })); closeCamera();
    } catch (_) { setStatus("Could not attach captured file. Use Add File to select it."); }
  }
  function capturePhoto() {
    if (!video || !video.videoWidth || !video.videoHeight) { setStatus("Wait until camera preview is ready."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0); captureButton.disabled = true;
    canvas.toBlob(blob => { captureButton.disabled = false; if (!blob) { setStatus("Photo capture failed. Try again."); return; } attachBlob(blob, "irhcf-photo-" + Date.now() + ".jpg"); }, "image/jpeg", 0.92);
  }
  function toggleVideoRecording() {
    if (recorder && recorder.state === "recording") { recorder.stop(); return; }
    if (!stream || !window.MediaRecorder) { setStatus("Video recording is not supported by this browser."); return; }
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
    try {
      chunks = []; recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onerror = () => setStatus("Video recording failed. Try again.");
      recorder.onstop = () => {
        if (recordingTimer) clearTimeout(recordingTimer); recordingTimer = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        if (!blob.size) { setStatus("No video data was captured."); recordButton.textContent = "● Record video"; captureButton.disabled = false; return; }
        attachBlob(blob, "irhcf-video-" + Date.now() + (blob.type.includes("mp4") ? ".mp4" : ".webm"));
      };
      recorder.start(500); recordButton.textContent = "■ Stop & attach video"; captureButton.disabled = true;
      setStatus("Recording video… Tap Stop & attach video. Maximum 60 seconds.");
      recordingTimer = setTimeout(() => { if (recorder && recorder.state === "recording") recorder.stop(); }, 60000);
    } catch (error) { setStatus(error.message || "Could not start video recording."); }
  }
  window.addEventListener("irhcf:open-live-camera", openCamera);
  window.addEventListener("beforeunload", () => { try { closeCamera(); } catch (_) {} });
})();