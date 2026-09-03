const APP_BASE = new URL(".", import.meta.url);
const MEDIAPIPE_MODULES = [
  new URL("./vendor/vision_bundle.mjs", APP_BASE).href,
];
const MEDIAPIPE_WASM_ROOTS = [
  new URL("./vendor/wasm", APP_BASE).href,
];
const FACE_MODELS = [
  new URL("./models/face_landmarker.task", APP_BASE).href,
];

const screens = {
  start: document.querySelector("#startScreen"),
  loading: document.querySelector("#loadingScreen"),
  calibrate: document.querySelector("#calibrationScreen"),
  gameover: document.querySelector("#gameoverScreen"),
  error: document.querySelector("#errorScreen"),
};
const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d", { alpha: false });
const video = document.querySelector("#cameraFeed");
const pauseButton = document.querySelector("#pauseButton");
const muteButton = document.querySelector("#muteButton");
const enableCameraButton = document.querySelector("#enableCameraButton");
const readyButton = document.querySelector("#readyButton");
const retryButton = document.querySelector("#retryButton");
const playAgainButton = document.querySelector("#playAgainButton");
const continuePortraitButton = document.querySelector("#continuePortraitButton");
const loadingStatus = document.querySelector("#loadingStatus");
const trackingPill = document.querySelector("#trackingPill");
const trackingText = trackingPill.querySelector("b");
const cameraStatus = document.querySelector("#cameraStatus");
const cameraStatusText = cameraStatus.querySelector("span");
const scoreChip = document.querySelector("#scoreChip");
const liveScore = document.querySelector("#liveScore");
const finalScore = document.querySelector("#finalScore");
const resultMessage = document.querySelector("#resultMessage");
const errorMessage = document.querySelector("#errorMessage");
const rotateNotice = document.querySelector("#rotateNotice");

let currentScreen = "start";
let mediaStream = null;
let faceLandmarker = null;
let trackerFrame = 0;
let gameFrame = 0;
let lastDetectionTime = 0;
let faceSeenAt = 0;
let smoothHeadY = 0.5;
let neutralHeadY = 0.5;
let faceDetected = false;
let paused = false;
let muted = false;
let audioContext = null;
let pendingPortraitStart = false;
let portraitNoticeSeen = false;
let setupStage = "startup";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const isTouchPhone = () => navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 600;
const isPortrait = () => window.matchMedia("(orientation: portrait)").matches;

function activateAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") void audioContext.resume();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioContext = new AudioContextClass();
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  }
}

function beep(frequency, duration, volume = 0.05) {
  if (muted || !audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function updateTrackingUI(detected) {
  if (faceDetected === detected) return;
  faceDetected = detected;
  trackingPill.classList.toggle("detected", detected);
  trackingText.textContent = detected ? "Face detected" : "Looking for your face…";
  readyButton.disabled = !detected;
  cameraStatus.classList.toggle("online", detected);
  cameraStatusText.textContent = detected ? "Tracking" : "Re-centre";
}

function setScreen(next) {
  currentScreen = next;
  Object.entries(screens).forEach(([name, element]) => element.classList.toggle("hidden", name !== next));
  const playing = next === "playing";
  canvas.classList.toggle("visible", playing);
  pauseButton.classList.toggle("hidden", !playing);
  scoreChip.classList.toggle("hidden", !playing);
  cameraStatus.classList.toggle("hidden", !playing);
  video.classList.toggle("camera-large", next === "calibrate");
  video.classList.toggle("camera-small", playing);
  if (!playing && gameFrame) {
    cancelAnimationFrame(gameFrame);
    gameFrame = 0;
  }
}

function cameraErrorText(error) {
  if (!window.isSecureContext && location.hostname !== "localhost") return "Camera access requires an HTTPS address.";
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "Camera permission was denied. In iPhone Settings, open Safari, check Camera permission, then reload this page.";
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") return "No front camera was found on this device.";
  if (error?.name === "NotReadableError") return "The camera is being used by another app. Close that app and try again.";
  const detail = error?.message ? ` ${error.message}` : "";
  if (setupStage === "video") return `The camera was allowed, but Safari could not start its preview.${detail}`;
  if (setupStage === "tracker-code") return `The camera works, but the face-tracking code could not load.${detail}`;
  if (setupStage === "tracker-model") return `The camera works, but the face model or WebAssembly engine could not start.${detail}`;
  return error?.message || "Camera or face tracking could not be started. Check your connection and try again.";
}

async function importVisionLibrary() {
  const failures = [];
  for (const moduleUrl of MEDIAPIPE_MODULES) {
    try {
      return await import(moduleUrl);
    } catch (error) {
      failures.push(error?.message || "module unavailable");
    }
  }
  throw new Error(`All tracker sources failed (${failures.join(" | ")}).`);
}

async function createFaceTracker(vision) {
  const failures = [];
  const commonOptions = {
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  for (const wasmRoot of MEDIAPIPE_WASM_ROOTS) {
    let fileset;
    try {
      fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot);
    } catch (error) {
      failures.push(`engine: ${error?.message || "unavailable"}`);
      continue;
    }
    for (const modelAssetPath of FACE_MODELS) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          return await vision.FaceLandmarker.createFromOptions(fileset, {
            ...commonOptions,
            baseOptions: { modelAssetPath, delegate },
          });
        } catch (error) {
          failures.push(`${delegate}: ${error?.message || "initialization failed"}`);
        }
      }
    }
  }
  throw new Error(failures.slice(-4).join(" | "));
}

async function startCamera() {
  activateAudio();
  setScreen("loading");
  loadingStatus.textContent = "Requesting camera…";
  setupStage = "camera";
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access. Open the link in Safari on a recent iPhone.");
    if (!window.isSecureContext && location.hostname !== "localhost") throw new Error("Camera access requires an HTTPS address.");

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    setupStage = "video";
    video.srcObject = mediaStream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    await video.play();

    loadingStatus.textContent = "Loading face tracker…";
    setupStage = "tracker-code";
    const vision = await importVisionLibrary();
    loadingStatus.textContent = "Starting face model…";
    setupStage = "tracker-model";
    faceLandmarker = await createFaceTracker(vision);

    faceSeenAt = performance.now();
    smoothHeadY = 0.5;
    trackerFrame = requestAnimationFrame(trackFace);
    setupStage = "ready";
    setScreen("calibrate");
  } catch (error) {
    stopCamera();
    errorMessage.textContent = cameraErrorText(error);
    setScreen("error");
  }
}

function trackFace(now) {
  if (!faceLandmarker || !mediaStream) return;
  if (video.readyState >= 2 && now - lastDetectionTime >= 38) {
    lastDetectionTime = now;
    try {
      const landmarks = faceLandmarker.detectForVideo(video, now).faceLandmarks?.[0];
      if (landmarks?.[1]) {
        smoothHeadY += (landmarks[1].y - smoothHeadY) * 0.24;
        faceSeenAt = now;
        updateTrackingUI(true);
      } else if (now - faceSeenAt > 350) {
        updateTrackingUI(false);
      }
    } catch {
      updateTrackingUI(false);
    }
  }
  trackerFrame = requestAnimationFrame(trackFace);
}

function stopCamera() {
  if (trackerFrame) cancelAnimationFrame(trackerFrame);
  trackerFrame = 0;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  video.srcObject = null;
  faceLandmarker?.close?.();
  faceLandmarker = null;
}

function prepareRun() {
  if (!faceDetected) return;
  neutralHeadY = smoothHeadY;
  paused = false;
  pauseButton.textContent = "Ⅱ";
  pauseButton.setAttribute("aria-label", "Pause game");
  if (isTouchPhone() && isPortrait() && !portraitNoticeSeen) {
    pendingPortraitStart = true;
    rotateNotice.classList.remove("hidden");
    return;
  }
  beginRun();
}

function beginRun() {
  pendingPortraitStart = false;
  rotateNotice.classList.add("hidden");
  liveScore.textContent = "0";
  setScreen("playing");
  startGameLoop();
}

function startGameLoop() {
  const bird = { x: 0, y: 0, velocity: 0, radius: 17 };
  let gates = [];
  let lastTime = performance.now();
  let elapsed = 0;
  let spawnTimer = 0.8;
  let score = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    bird.x = rect.width * 0.27;
    if (!bird.y) bird.y = rect.height * 0.5;
  }
  resizeCanvas();

  function finishRun() {
    beep(120, 0.34, 0.08);
    finalScore.textContent = String(score);
    resultMessage.textContent = score === 0 ? "The first gate is waiting." : score < 5 ? "Nice first flight." : "Smooth flying!";
    setScreen("gameover");
  }

  function frame(now) {
    if (currentScreen !== "playing") return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width === 0 || Math.abs(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2) - canvas.width) > 3) resizeCanvas();
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    const trackingLost = now - faceSeenAt > 1500;
    const movementPaused = paused || trackingLost || document.hidden;

    if (!movementPaused) {
      elapsed += dt;
      spawnTimer -= dt;
      const speed = Math.min(250, 140 + elapsed * 2.0);
      const gap = Math.max(122, Math.min(height * 0.38, 190 - elapsed * 0.5));
      if (spawnTimer <= 0) {
        const margin = gap * 0.65;
        gates.push({ x: width + 60, gapY: margin + Math.random() * Math.max(10, height - margin * 2), gap, passed: false });
        spawnTimer = Math.max(1.3, 1.74 - elapsed * 0.006);
      }

      let headDelta = smoothHeadY - neutralHeadY;
      if (Math.abs(headDelta) < 0.012) headDelta = 0;
      const targetY = clamp(height * 0.5 + (headDelta / 0.16) * height * 0.36, 30, height - 30);
      bird.velocity += ((targetY - bird.y) * 15 - bird.velocity * 7) * dt;
      bird.y += bird.velocity * dt;

      gates.forEach((gate) => {
        gate.x -= speed * dt;
        if (!gate.passed && gate.x + 44 < bird.x) {
          gate.passed = true;
          score += 1;
          liveScore.textContent = String(score);
          beep(720, 0.09);
        }
      });
      gates = gates.filter((gate) => gate.x > -70);

      const hitEdge = bird.y - bird.radius <= 0 || bird.y + bird.radius >= height;
      const hitGate = gates.some((gate) => {
        const overlapsX = bird.x + bird.radius > gate.x && bird.x - bird.radius < gate.x + 44;
        return overlapsX && (bird.y - bird.radius < gate.gapY - gate.gap / 2 || bird.y + bird.radius > gate.gapY + gate.gap / 2);
      });
      if (hitEdge || hitGate) {
        finishRun();
        return;
      }
    }

    drawScene(width, height, elapsed, gates, bird);
    if (movementPaused) drawPause(width, height, trackingLost);
    gameFrame = requestAnimationFrame(frame);
  }
  gameFrame = requestAnimationFrame(frame);
}

function drawScene(width, height, elapsed, gates, bird) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#101b43"); gradient.addColorStop(0.58, "#263e7a"); gradient.addColorStop(1, "#ee7d69");
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.55;
  for (let index = 0; index < 24; index += 1) {
    const movingX = (index * 137 - elapsed * (12 + (index % 3) * 4)) % (width + 20);
    const x = movingX < 0 ? movingX + width + 20 : movingX;
    const y = 24 + ((index * 89) % Math.max(40, height * 0.55));
    context.fillStyle = index % 4 === 0 ? "#ffd66b" : "#ffffff";
    context.beginPath(); context.arc(x, y, index % 5 === 0 ? 2 : 1, 0, Math.PI * 2); context.fill();
  }
  context.globalAlpha = 1;

  gates.forEach((gate) => {
    const topHeight = gate.gapY - gate.gap / 2;
    const bottomY = gate.gapY + gate.gap / 2;
    context.shadowColor = "rgba(105,255,198,.42)"; context.shadowBlur = 16; context.fillStyle = "#54dfb1";
    context.fillRect(gate.x, 0, 44, topHeight); context.fillRect(gate.x, bottomY, 44, height - bottomY);
    context.shadowBlur = 0; context.fillStyle = "#143f52";
    context.fillRect(gate.x + 8, 0, 9, topHeight); context.fillRect(gate.x + 8, bottomY, 9, height - bottomY);
    context.fillStyle = "#7ff3ca"; context.fillRect(gate.x - 6, Math.max(0, topHeight - 18), 56, 18); context.fillRect(gate.x - 6, bottomY, 56, 18);
  });

  context.save();
  context.translate(bird.x, bird.y); context.rotate(clamp(bird.velocity / 500, -0.25, 0.3));
  context.shadowColor = "rgba(255,218,97,.6)"; context.shadowBlur = 18; context.fillStyle = "#ffd44f";
  context.beginPath(); context.arc(0, 0, bird.radius, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
  context.fillStyle = "#ff9358"; context.beginPath(); context.moveTo(13, -4); context.lineTo(30, 2); context.lineTo(13, 7); context.closePath(); context.fill();
  context.fillStyle = "#fff"; context.beginPath(); context.arc(7, -7, 5.5, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#17264f"; context.beginPath(); context.arc(9, -7, 2.2, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#f4a53a"; context.beginPath(); context.ellipse(-7, 5, 11, 6, Math.sin(elapsed * 13) * 0.22, 0, Math.PI * 2); context.fill();
  context.restore();
}

function drawPause(width, height, trackingLost) {
  context.fillStyle = "rgba(8,15,36,.7)"; context.fillRect(0, 0, width, height);
  context.textAlign = "center"; context.fillStyle = "white"; context.font = "700 24px -apple-system, system-ui";
  context.fillText(trackingLost ? "Face not detected" : "Paused", width / 2, height / 2 - 8);
  context.fillStyle = "#d8e2ff"; context.font = "500 15px -apple-system, system-ui";
  context.fillText(trackingLost ? "Return to view to continue" : "Tap resume when you’re ready", width / 2, height / 2 + 22);
}

enableCameraButton.addEventListener("click", startCamera);
retryButton.addEventListener("click", startCamera);
readyButton.addEventListener("click", prepareRun);
playAgainButton.addEventListener("click", () => {
  paused = false;
  setScreen("calibrate");
});
continuePortraitButton.addEventListener("click", () => {
  portraitNoticeSeen = true;
  beginRun();
});
pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "▶" : "Ⅱ";
  pauseButton.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  if (!paused) activateAudio();
});
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "×" : "♪";
  muteButton.setAttribute("aria-label", muted ? "Turn sound on" : "Mute sound");
  if (!muted) activateAudio();
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    if (pendingPortraitStart && !isPortrait()) beginRun();
    else if (currentScreen === "playing") {
      paused = false;
      setScreen("calibrate");
    }
  }, 250);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentScreen === "playing") {
    paused = true;
    pauseButton.textContent = "▶";
    pauseButton.setAttribute("aria-label", "Resume game");
  }
});
window.addEventListener("pagehide", stopCamera);

setScreen("start");
