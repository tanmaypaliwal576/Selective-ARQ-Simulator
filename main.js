// --- Core Protocol Parameters (Synced with UI) ---
let SENDER_WINDOW_SIZE,
  MAX_SEQ_NUM, // M (Calculated internally as 2*N)
  TIMEOUT_STEPS,
  PACKET_LOSS_PROBABILITY,
  TOTAL_FRAMES_TO_SEND;

// --- Scenario Control Variables ---
let FRAME_TO_LOSE_INDEX = 4; // Default value (Frame #4)
let SCENARIO_ACTIVE = true;
let isInitialLossDone = false;

// --- Simulation Timing Constant ---
const OWD_MS = 1500;
const BASE_ANIMATION_DELAY_MS = OWD_MS;
const SIMULATION_STEP_DELAY_MS = 3000;

let isProcessingStep = false;
let isAnimationPaused = false;

// *** VISUALIZATION ARRAYS ***
let frameSequenceNumbers; // The actual protocol sequence number (0 to M-1)
let frameVisualLabels; // The simple index used for display (0 to N-1)

let sender, receiver;
let simulationInterval;
let currentTime = 0;
let isAcked;

const logArea = document.getElementById("log-area");
const channelDiv = document.querySelector(".channel");
const routerVisual = document.querySelector(".router-visual");

let animationTimeouts = [];

function log(message, type = "info") {
  const entry = document.createElement("div");
  entry.textContent = `[T${currentTime}] ${message}`;
  entry.classList.add("log-entry", type);
  if (logArea.childElementCount > 30) {
    logArea.removeChild(logArea.lastChild);
  }
  logArea.prepend(entry);
  logArea.scrollTop = 0;
}

function getVisualLabel(frameIndex) {
  return frameVisualLabels[frameIndex];
}

function getSeqNum(frameIndex) {
  return frameSequenceNumbers[frameIndex];
}

// --- Pausing/Resuming Logic for Animations ---

function pauseAnimations() {
  isAnimationPaused = true;
  // Clear all protocol state timeouts
  animationTimeouts.forEach(clearTimeout);
  animationTimeouts = [];

  document.querySelectorAll(".channel .animated-packet").forEach((p) => {
    // Capture current position and freeze the visual
    const style = window.getComputedStyle(p);
    const left = style.getPropertyValue("left");
    const top = style.getPropertyValue("top");

    p.classList.add("paused");

    // Explicitly set the frozen position
    p.style.left = left;
    p.style.top = top;
  });
}

function resumeAnimations() {
  isAnimationPaused = false;
  // Cleanly remove any visually frozen packets. The simulation step will launch the next correct packet.
  document.querySelectorAll(".animated-packet").forEach((p) => p.remove());
}

// --- Selective Repeat ARQ Logic ---

class SelectiveRepeatSender {
  constructor() {
    this.sendBase = 0;
    this.nextSeqNum = 0;
    this.timers = {};
  }

  sendFrames() {
    if (isAnimationPaused) return; // Block logic if paused

    let frameIndexToSend = -1;
    let isRetransmission = false;

    // 1. Check for the *first* timed out frame (retransmission takes priority)
    for (
      let i = this.sendBase;
      i < Math.min(this.sendBase + SENDER_WINDOW_SIZE, TOTAL_FRAMES_TO_SEND);
      i++
    ) {
      if (
        this.timers[i] !== undefined &&
        currentTime - this.timers[i].time >= TIMEOUT_STEPS
      ) {
        frameIndexToSend = i;
        isRetransmission = true;
        break;
      }
    }

    // 2. Send new packet
    if (frameIndexToSend === -1) {
      if (
        this.nextSeqNum < TOTAL_FRAMES_TO_SEND &&
        this.nextSeqNum - this.sendBase < SENDER_WINDOW_SIZE
      ) {
        frameIndexToSend = this.nextSeqNum;
        isRetransmission = false;
      }
    }

    if (frameIndexToSend !== -1) {
      const seqNum = getSeqNum(frameIndexToSend);
      const visualLabel = getVisualLabel(frameIndexToSend);

      if (isRetransmission) {
        log(
          `Sender: Timer for Frame F${visualLabel} **TIMED OUT**. Retransmitting selectively (Seq ${seqNum}).`,
          "error"
        );
      } else {
        log(`Sender: Sending New Frame F${visualLabel} (Seq ${seqNum}).`);
        this.nextSeqNum++;
      }
      this._transmitFrame(frameIndexToSend, seqNum, visualLabel);
    } else {
      log(
        "Sender: Window is full or all packets sent. Waiting for ACK/Timeout.",
        "info"
      );
    }
  }

  _transmitFrame(frameIndex, seqNum, visualLabel) {
    if (isAnimationPaused) return;

    // Only reset/start timer if a **new** packet or retransmission has occurred.
    this.timers[frameIndex] = { time: currentTime, seqNum: seqNum };
    animatePacket(seqNum, frameIndex, visualLabel, "data");
  }

  receiveAck(ackSeqNum, ackVisualLabel) {
    let acknowledgedIndex = -1;

    // Sender logic must find the corresponding packet based on the ACK's content (Seq Num + Visual Label)
    for (let i = this.sendBase; i < this.nextSeqNum; i++) {
      if (
        frameVisualLabels[i] === ackVisualLabel &&
        frameSequenceNumbers[i] === ackSeqNum &&
        !isAcked[i]
      ) {
        acknowledgedIndex = i;
        break;
      }
    }

    const visualLabel =
      acknowledgedIndex !== -1
        ? getVisualLabel(acknowledgedIndex)
        : ackVisualLabel;
    const seqNum =
      acknowledgedIndex !== -1 ? getSeqNum(acknowledgedIndex) : ackSeqNum;

    if (acknowledgedIndex === -1) {
      log(
        `Sender: Received duplicate or irrelevant ACK (F${visualLabel}, Seq ${seqNum}). Ignored.`,
        "info"
      );
      return;
    }

    log(
      `Sender: Received ACK for Frame F${visualLabel} (Seq ${seqNum}).`,
      "success"
    );

    isAcked[acknowledgedIndex] = true;

    // Stop timer for the acknowledged frame
    if (this.timers[acknowledgedIndex] !== undefined) {
      delete this.timers[acknowledgedIndex];
    }

    // Slide the window (only when the base packet is ACKed)
    while (this.sendBase < TOTAL_FRAMES_TO_SEND && isAcked[this.sendBase]) {
      const slideVisualLabel = getVisualLabel(this.sendBase);
      log(`Sender: Frame F${slideVisualLabel} ACKed. Sliding window.`);
      this.sendBase++;
    }
  }
}

class SelectiveRepeatReceiver {
  constructor() {
    this.receiveBase = 0;
    // Receiver buffer stores data by the visual label (index) for simple lookup
    this.buffer = {};
    this.deliveredCount = 0;
  }

  handleIncomingFrame(seqNum, visualLabel) {
    if (isAnimationPaused) return; // Block logic if paused

    // Find the frame index for the visual label
    let frameIndex = -1;
    for (let i = 0; i < TOTAL_FRAMES_TO_SEND; i++) {
      if (frameVisualLabels[i] === visualLabel) {
        frameIndex = i;
        break;
      }
    }

    // Check if frame is within the receiver's window (RcvBase to RcvBase + N - 1)
    const maxDisplayIndex = this.receiveBase + SENDER_WINDOW_SIZE;
    const isInWindow =
      frameIndex >= this.receiveBase && frameIndex < maxDisplayIndex;

    if (isInWindow) {
      if (this.buffer[visualLabel] === undefined) {
        // Store it using the visual label (index) for easy ordering/delivery
        this.buffer[visualLabel] = { seq: seqNum, label: visualLabel };
        log(`Receiver: Buffered Frame F${visualLabel} (Seq ${seqNum}).`);
      }

      // Always send an ACK for a frame that lands in the window
      log(`Receiver: Sending ACK (Seq ${seqNum}) for Frame F${visualLabel}.`);
      routerReceiveAck(seqNum, visualLabel);
    } else {
      log(
        `Receiver: Frame F${visualLabel} (Seq ${seqNum}) outside window (Expected F${getVisualLabel(
          this.receiveBase
        )}). DISCARDED.`,
        "error"
      );
    }
  }

  deliverAndSlide() {
    let delivered = 0;

    while (this.receiveBase < TOTAL_FRAMES_TO_SEND) {
      let currentVisualLabel = frameVisualLabels[this.receiveBase];

      if (this.buffer[currentVisualLabel] === undefined) {
        break;
      }

      log(`Receiver: Delivering Frame F${currentVisualLabel} to upper layer.`);

      delete this.buffer[currentVisualLabel];

      this.receiveBase++;
      this.deliveredCount++;
      delivered++;
    }

    if (delivered > 0) {
      if (this.receiveBase < TOTAL_FRAMES_TO_SEND) {
        const nextVisualLabel = getVisualLabel(this.receiveBase);
        log(
          `Receiver: Window slid by ${delivered}. Next delivery expected Frame: F${nextVisualLabel}`
        );
      } else {
        log(`Receiver: All frames delivered.`, "success");
      }
    }
  }
}

// --- Animation and Channel Simulation ---

function animatePacket(seqNum, frameIndex, visualLabel, type) {
  if (isAnimationPaused) return;

  // UPDATED: Display only the Visual Label (F#)
  const displayText =
    type === "data" ? `F${visualLabel}` : `ACK F${visualLabel}`;

  const packet = document.createElement("div");
  packet.textContent = displayText;
  packet.classList.add(
    "animated-packet",
    type === "data" ? "data-packet" : "ack-packet"
  );

  // Restore default properties
  packet.style.width = "40px";
  packet.style.fontSize = "13px";

  // Data packets always go from right to left (Above the channel)
  if (type === "data") {
    let isLost = false;

    // ** DETERMINISTIC LOSS LOGIC **
    if (frameIndex == FRAME_TO_LOSE_INDEX && !isInitialLossDone) {
      isLost = true;
      isInitialLossDone = true;
      log(
        `*** FORCED LOSS: Frame F${visualLabel} (Seq ${seqNum}) ***`,
        "error"
      );
    } else {
      isLost = false; // Guarantee success for all other data packets
    }

    packet.style.left = `80%`;
    packet.style.top = `calc(50% - 35px)`;
    channelDiv.appendChild(packet);

    if (isLost) {
      log(
        `--- Channel: ${type.toUpperCase()} F${visualLabel} LOST in transit! ---`,
        "error"
      );
      // Use animationTimeouts to prevent state change on pause
      const timeoutId = setTimeout(() => {
        if (isAnimationPaused) return;

        packet.style.transition =
          "transform 0.5s linear, opacity 0.5s ease-out";
        packet.style.transform = `translate(-50%, -50%) scale(0)`;
        packet.style.opacity = "0";
        setTimeout(() => packet.remove(), 500);
      }, BASE_ANIMATION_DELAY_MS / 2);
      animationTimeouts.push(timeoutId);
      return;
    }

    const dataTravelTime = BASE_ANIMATION_DELAY_MS;

    // Animation start
    setTimeout(() => {
      if (isAnimationPaused) return;

      packet.style.transition = `left ${dataTravelTime / 1000}s linear, top ${
        dataTravelTime / 1000
      }s linear`;
      packet.style.left = `20%`;
      packet.style.top = `calc(50% - 35px)`;
    }, 50);

    // State change (arrival at receiver)
    const timeoutId = setTimeout(() => {
      if (isAnimationPaused) return;

      receiver.handleIncomingFrame(seqNum, visualLabel);
      packet.remove();
    }, dataTravelTime + 50);
    animationTimeouts.push(timeoutId);
  } else {
    routerReceiveAck(seqNum, visualLabel);
  }
}

function routerReceiveAck(seqNum, visualLabel) {
  if (isAnimationPaused) return;

  // UPDATED: Display only the Visual Label (F#)
  const packet = document.createElement("div");
  packet.textContent = `ACK F${visualLabel}`;
  packet.classList.add("animated-packet", "ack-packet");

  // Restore default properties
  packet.style.width = "40px";
  packet.style.fontSize = "13px";

  packet.style.left = `20%`;
  packet.style.top = `calc(50% + 25px)`;
  channelDiv.appendChild(packet);

  const firstLegTime = BASE_ANIMATION_DELAY_MS / 3;

  // Animation start (visual move to router)
  setTimeout(() => {
    if (isAnimationPaused) return;

    packet.style.transition = `left ${firstLegTime / 1000}s linear, top ${
      firstLegTime / 1000
    }s linear`;
    packet.style.left = `calc(50% - 20px)`;
    packet.style.top = `calc(50% + 25px)`;
  }, 50);

  // State change (arrival at router)
  const timeoutId = setTimeout(() => {
    if (isAnimationPaused) return;

    let isAckLost = false;

    if (isAckLost) {
      log(
        `--- Router: ACK F${visualLabel} LOST inside the router! (ACK Loss disabled in this demo) ---`,
        "error"
      );
      packet.style.transition = "transform 0.5s linear, opacity 0.5s ease-out";
      packet.style.transform = `scale(0)`;
      packet.style.opacity = "0";
      setTimeout(() => packet.remove(), 500);
      return;
    }

    packet.remove();
    routerSendAck(seqNum, visualLabel);
  }, firstLegTime + 50);
  animationTimeouts.push(timeoutId);
}

function routerSendAck(seqNum, visualLabel) {
  if (isAnimationPaused) return;

  // UPDATED: Display only the Visual Label (F#)
  const packet = document.createElement("div");
  packet.textContent = `ACK F${visualLabel}`;
  packet.classList.add("animated-packet", "ack-packet");

  // Restore default properties
  packet.style.width = "40px";
  packet.style.fontSize = "13px";

  packet.style.left = `calc(50% - 20px)`;
  packet.style.top = `calc(50% + 25px)`;
  channelDiv.appendChild(packet);

  const secondLegTime = BASE_ANIMATION_DELAY_MS / 3;

  // Animation start (visual move to sender)
  setTimeout(() => {
    if (isAnimationPaused) return;

    packet.style.transition = `left ${secondLegTime / 1000}s linear, top ${
      secondLegTime / 1000
    }s linear`;
    packet.style.left = `80%`;
    packet.style.top = `calc(50% + 25px)`;
  }, 50);

  // State change (arrival at sender)
  const timeoutId = setTimeout(() => {
    if (isAnimationPaused) return;

    sender.receiveAck(seqNum, visualLabel);
    packet.remove();
  }, secondLegTime + 50);
  animationTimeouts.push(timeoutId);
}

// --- UI Update & Utility Functions ---

function updateUI() {
  document.getElementById("currentTime").textContent = currentTime;
  document.getElementById("packetsToSendStatus").textContent =
    TOTAL_FRAMES_TO_SEND;
  document.getElementById("windowSizeStatus").textContent = SENDER_WINDOW_SIZE;
  document.getElementById("timeoutValueStatus").textContent = TIMEOUT_STEPS;
  document.getElementById("lossTargetStatus").textContent = FRAME_TO_LOSE_INDEX;

  // Sender Window Visualization
  const senderWindowDiv = document.getElementById("sender-buffer-vis");
  senderWindowDiv.innerHTML = "";

  const simulationIsComplete = receiver.deliveredCount >= TOTAL_FRAMES_TO_SEND;

  for (let i = TOTAL_FRAMES_TO_SEND - 1; i >= 0; i--) {
    const visualLabel = getVisualLabel(i);
    // UPDATED: Display only F#
    const packetDiv = document.createElement("div");
    packetDiv.textContent = `F${visualLabel}`;
    packetDiv.classList.add("packet");

    let statusClass;

    if (simulationIsComplete) {
      statusClass = "acked";
    } else if (i < sender.sendBase) {
      statusClass = "acked";
    } else if (i < sender.nextSeqNum) {
      statusClass = isAcked[i] ? "buffered" : "sent";
    } else {
      statusClass = "ready";
    }

    if (i >= sender.sendBase && i < sender.sendBase + SENDER_WINDOW_SIZE) {
      packetDiv.classList.add("window-border");
    }

    packetDiv.classList.add(statusClass);
    senderWindowDiv.appendChild(packetDiv);
  }

  // RECEIVER BUFFER VISUALIZATION (History + Active Window)
  const receiverBufferDiv = document.getElementById("receiver-buffer-vis");
  receiverBufferDiv.innerHTML = "";

  let packetsToDisplay = [];
  const R_START_INDEX = receiver.receiveBase;
  const maxDisplayIndex = receiver.receiveBase + SENDER_WINDOW_SIZE;

  // Display up to the current receiver window
  for (let i = 0; i < maxDisplayIndex; i++) {
    if (i >= TOTAL_FRAMES_TO_SEND) continue;

    const visualLabel = getVisualLabel(i);
    const seqNum = getSeqNum(i);

    let p = {
      visualLabel: visualLabel,
      seqNum: seqNum,
      isWindow: false,
      sortIndex: i,
    };

    if (i < receiver.receiveBase) {
      p.status = "acked";
    } else {
      const isInWindowRange = i >= R_START_INDEX && i < maxDisplayIndex;

      if (isInWindowRange) {
        p.isWindow = true;
        if (receiver.buffer[visualLabel] !== undefined) {
          p.status = "buffered";
        } else {
          p.status = "empty-slot";
        }
      } else {
        continue;
      }
    }

    packetsToDisplay.push(p);
  }

  // 2. Render all packets (reversed for bottom-up display)
  packetsToDisplay.sort((a, b) => a.sortIndex - b.sortIndex);

  packetsToDisplay.reverse().forEach((p) => {
    const packetDiv = document.createElement("div");
    // UPDATED: Display only F#
    packetDiv.textContent = `F${p.visualLabel}`;
    packetDiv.classList.add("packet", p.status);

    if (p.isWindow) {
      packetDiv.classList.add("window-border");
    }

    receiverBufferDiv.appendChild(packetDiv);
  });
}

// NEW: Function to read parameters from UI and set global variables
function setupParameters() {
  const windowSizeInput = document.getElementById("windowSizeInput");
  const totalFramesInput = document.getElementById("totalFramesInput");
  const lossTargetInput = document.getElementById("lossTargetInput");
  const timeoutInput = document.getElementById("timeoutInput");

  SENDER_WINDOW_SIZE = parseInt(windowSizeInput.value) || 4;
  TOTAL_FRAMES_TO_SEND = parseInt(totalFramesInput.value) || 8;
  FRAME_TO_LOSE_INDEX = parseInt(lossTargetInput.value) || 4;
  TIMEOUT_STEPS = parseInt(timeoutInput.value) || 4;

  // M is CALCULATED automatically as 2 * N
  MAX_SEQ_NUM = 2 * SENDER_WINDOW_SIZE;

  // Ensure constraints are met
  if (TOTAL_FRAMES_TO_SEND < SENDER_WINDOW_SIZE) {
    TOTAL_FRAMES_TO_SEND = SENDER_WINDOW_SIZE;
    log(
      `Frames to Send reset to N (${SENDER_WINDOW_SIZE}) to fit the window size.`,
      "error"
    );
    totalFramesInput.value = TOTAL_FRAMES_TO_SEND;
  }

  // Ensure loss target is a valid frame number (index)
  if (FRAME_TO_LOSE_INDEX >= TOTAL_FRAMES_TO_SEND) {
    FRAME_TO_LOSE_INDEX = TOTAL_FRAMES_TO_SEND - 1;
    log(
      `Loss Target reset to F${FRAME_TO_LOSE_INDEX} (max valid frame).`,
      "error"
    );
    lossTargetInput.value = FRAME_TO_LOSE_INDEX;
  }
  if (FRAME_TO_LOSE_INDEX < 0) {
    FRAME_TO_LOSE_INDEX = 0;
    log(`Loss Target reset to F0 (min valid frame).`, "error");
    lossTargetInput.value = FRAME_TO_LOSE_INDEX;
  }

  SCENARIO_ACTIVE = true;
  isInitialLossDone = false;
}

function resetSimulation(logMessage = true) {
  clearInterval(simulationInterval);
  simulationInterval = null;
  logArea.innerHTML = "";

  setupParameters(); // Load dynamic parameters

  // 1. SEQUENCE NUMBERS (PROTOCOL LOGIC: wraps from 0 to M-1)
  frameSequenceNumbers = Array.from(
    { length: TOTAL_FRAMES_TO_SEND },
    (_, i) => i % MAX_SEQ_NUM
  );

  // 2. VISUAL LABELS (DISPLAY ONLY: 0, 1, 2, ..., N-1)
  frameVisualLabels = Array.from({ length: TOTAL_FRAMES_TO_SEND }, (_, i) => i);

  isAcked = new Array(TOTAL_FRAMES_TO_SEND).fill(false);

  sender = new SelectiveRepeatSender();
  receiver = new SelectiveRepeatReceiver();
  currentTime = 0;
  isProcessingStep = false;
  isInitialLossDone = false;

  // --- ANIMATION/PAUSE RESET ---
  animationTimeouts.forEach(clearTimeout);
  animationTimeouts = [];
  document.querySelectorAll(".animated-packet").forEach((p) => p.remove());
  isAnimationPaused = false;

  // Update controls to initial state (PLAY icon)
  document.getElementById("toggle-icon").innerHTML =
    '<path d="M8 5v14l11-7z"/>';

  const targetVisualLabel = FRAME_TO_LOSE_INDEX;
  const targetSeqNum = getSeqNum(FRAME_TO_LOSE_INDEX);

  if (logMessage) {
    log(
      `Simulation Reset. Total Frames: ${TOTAL_FRAMES_TO_SEND}, Window: ${SENDER_WINDOW_SIZE}. Frame F${targetVisualLabel} (Seq ${targetSeqNum}) is the target for loss. Timeout: ${TIMEOUT_STEPS} steps. (M=${MAX_SEQ_NUM})`,
      "error"
    );
  }

  updateUI();
}

function simulationStep() {
  if (isProcessingStep || isAnimationPaused) return;

  if (receiver.deliveredCount >= TOTAL_FRAMES_TO_SEND) {
    log("All frames delivered. Simulation finished.", "success");
    if (simulationInterval) toggleSimulation();
    return;
  }

  isProcessingStep = true;

  // CORE LOGIC EXECUTION
  sender.sendFrames();
  receiver.deliverAndSlide();

  updateUI();
  currentTime++;

  // Block re-entry only for a moment to prevent skipping steps
  setTimeout(() => {
    isProcessingStep = false;
  }, 100);
}

function toggleSimulation() {
  const toggleIcon = document.getElementById("toggle-icon");

  if (simulationInterval) {
    // STOP/PAUSE Logic
    clearInterval(simulationInterval);
    simulationInterval = null;
    isProcessingStep = false;

    pauseAnimations(); // Freeze animations and logic timers

    // Switch icon to PLAY (M8 5v14l11-7z)
    toggleIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    log("Simulation Paused (Animations Frozen).");
  } else {
    // START/PLAY Logic
    // Reset if we're at the end or haven't started
    if (
      !sender ||
      receiver.deliveredCount >= TOTAL_FRAMES_TO_SEND ||
      currentTime === 0
    ) {
      resetSimulation(false); // Reset with current parameters
    }

    resumeAnimations(); // Clear mid-flight and prepare for next launch

    // Switch icon to PAUSE (M6 19h4V5H6v14zm8-14v14h4V5h-4z)
    toggleIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

    const intervalTime = SIMULATION_STEP_DELAY_MS;
    simulationInterval = setInterval(simulationStep, intervalTime);
    log("Simulation Started (Auto Play, Animations Resumed).");
  }
}

// Initial setup on load
window.onload = resetSimulation;
