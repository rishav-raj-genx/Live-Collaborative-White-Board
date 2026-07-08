const socket = io();

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const fillColorInput = document.getElementById("fillColor");
const fillShapesCheckbox = document.getElementById("fillShapes");
const backgroundColorInput = document.getElementById("backgroundColor");

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const clearBtn = document.getElementById("clearBtn");
const addStageBtn = document.getElementById("addStageBtn");
const prevStageBtn = document.getElementById("prevStageBtn");
const nextStageBtn = document.getElementById("nextStageBtn");
const deleteStageBtn = document.getElementById("deleteStageBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pageLabel = document.getElementById("pageLabel");

const toolButtons = document.querySelectorAll(".tool-btn");

let stages = [];
let currentStageIndex = 0;
let currentTool = "pencil";
let drawing = false;
let currentAction = null;
let previewAction = null;

function getCurrentStage() {
  return stages[currentStageIndex] || {
    history: [],
    redoStack: [],
    background: "#ffffff"
  };
}

function updateStageLabel() {
  if (stages.length === 0) {
    pageLabel.textContent = "Page 0 / 0";
    return;
  }
  pageLabel.textContent = `Page ${currentStageIndex + 1} / ${stages.length}`;
}

function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function renderAction(action) {
  ctx.save();

  if (action.type === "pencil" || action.type === "eraser") {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = action.size;

    if (action.type === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = action.color;
    }

    ctx.beginPath();
    action.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  } else if (action.type === "line") {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(action.x1, action.y1);
    ctx.lineTo(action.x2, action.y2);
    ctx.stroke();
  } else if (action.type === "rect") {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;

    if (action.filled) {
      ctx.fillStyle = action.fillColor;
      ctx.fillRect(action.x1, action.y1, action.x2 - action.x1, action.y2 - action.y1);
    }

    ctx.strokeRect(action.x1, action.y1, action.x2 - action.x1, action.y2 - action.y1);
  } else if (action.type === "circle") {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;

    const centerX = (action.x1 + action.x2) / 2;
    const centerY = (action.y1 + action.y2) / 2;
    const radiusX = Math.abs(action.x2 - action.x1) / 2;
    const radiusY = Math.abs(action.y2 - action.y1) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (action.filled) {
      ctx.fillStyle = action.fillColor;
      ctx.fill();
    }

    ctx.stroke();
  } else if (action.type === "text") {
    ctx.font = `${action.size * 4}px Arial`;
    ctx.fillStyle = action.color;
    ctx.textBaseline = "top";
    ctx.fillText(action.text, action.x, action.y);
  } else if (action.type === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = action.background || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
}

function renderCanvas() {
  const stage = getCurrentStage();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = stage.background || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  (stage.history || []).forEach((action) => {
    if (action.type === "clear") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = stage.background || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      renderAction(action);
    }
  });

  if (previewAction) {
    renderAction(previewAction);
  }

  updateStageLabel();
  backgroundColorInput.value = stage.background || "#ffffff";
}

function startDrawing(event) {
  event.preventDefault();

  if (currentTool === "text") {
    const pos = getMousePos(event);
    const text = window.prompt("Enter text:");
    if (text && text.trim()) {
      const action = {
        type: "text",
        text: text.trim(),
        x: pos.x,
        y: pos.y,
        color: colorInput.value,
        size: Number(sizeInput.value)
      };

      const stage = getCurrentStage();
      stage.history.push(action);
      stage.redoStack = [];
      renderCanvas();
      socket.emit("action", action);
    }
    return;
  }

  const pos = getMousePos(event);
  drawing = true;
  canvas.setPointerCapture(event.pointerId);

  if (currentTool === "pencil" || currentTool === "eraser") {
    currentAction = {
      type: currentTool,
      color: colorInput.value,
      size: Number(sizeInput.value),
      points: [{ x: pos.x, y: pos.y }]
    };
  } else {
    currentAction = {
      type: currentTool,
      color: colorInput.value,
      size: Number(sizeInput.value),
      x1: pos.x,
      y1: pos.y,
      x2: pos.x,
      y2: pos.y,
      filled: fillShapesCheckbox.checked,
      fillColor: fillColorInput.value
    };
  }

  previewAction = null;
  renderCanvas();
}

function continueDrawing(event) {
  if (!drawing || !currentAction) return;

  const pos = getMousePos(event);

  if (currentTool === "pencil" || currentTool === "eraser") {
    currentAction.points.push({ x: pos.x, y: pos.y });
    previewAction = {
      ...currentAction,
      points: [...currentAction.points]
    };
  } else {
    currentAction.x2 = pos.x;
    currentAction.y2 = pos.y;
    previewAction = { ...currentAction };
  }

  renderCanvas();
}

function stopDrawing() {
  if (!drawing || !currentAction) return;

  const stage = getCurrentStage();

  if (currentTool === "pencil" || currentTool === "eraser") {
    if (currentAction.points.length > 1) {
      stage.history.push(currentAction);
      stage.redoStack = [];
      socket.emit("action", currentAction);
    }
  } else {
    stage.history.push(currentAction);
    stage.redoStack = [];
    socket.emit("action", currentAction);
  }

  drawing = false;
  currentAction = null;
  previewAction = null;
  renderCanvas();
}

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
  });
});

undoBtn.addEventListener("click", () => {
  socket.emit("undo");
});

redoBtn.addEventListener("click", () => {
  socket.emit("redo");
});

clearBtn.addEventListener("click", () => {
  const stage = getCurrentStage();
  const clearAction = {
    type: "clear",
    before: stage.history.slice(),
    background: stage.background || "#ffffff"
  };

  stage.history.push(clearAction);
  stage.redoStack = [];
  renderCanvas();
  socket.emit("clearStage");
});

addStageBtn.addEventListener("click", () => {
  socket.emit("addStage");
});

prevStageBtn.addEventListener("click", () => {
  if (currentStageIndex > 0) {
    socket.emit("changeStage", currentStageIndex - 1);
  }
});

nextStageBtn.addEventListener("click", () => {
  if (currentStageIndex < stages.length - 1) {
    socket.emit("changeStage", currentStageIndex + 1);
  }
});

deleteStageBtn.addEventListener("click", () => {
  socket.emit("deleteStage");
});

backgroundColorInput.addEventListener("change", () => {
  socket.emit("setBackground", backgroundColorInput.value);
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "whiteboard.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

socket.on("state", (state) => {
  stages = state.stages;
  currentStageIndex = state.currentStageIndex;
  renderCanvas();
});

renderCanvas();