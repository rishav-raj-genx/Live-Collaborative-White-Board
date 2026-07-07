const socket = io();

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const clearBtn = document.getElementById("clearBtn");

let drawing = false;
let lastX = 0;
let lastY = 0;

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

function drawLine(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

clearCanvas();

canvas.addEventListener("mousedown", (event) => {
  const pos = getMousePos(event);
  drawing = true;
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener("mousemove", (event) => {
  if (!drawing) return;

  const pos = getMousePos(event);

  drawLine(lastX, lastY, pos.x, pos.y, colorInput.value, sizeInput.value);

  socket.emit("draw", {
    x1: lastX,
    y1: lastY,
    x2: pos.x,
    y2: pos.y,
    color: colorInput.value,
    size: sizeInput.value
  });

  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener("mouseup", () => {
  drawing = false;
});

canvas.addEventListener("mouseleave", () => {
  drawing = false;
});

socket.on("draw", (data) => {
  drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.size);
});

clearBtn.addEventListener("click", () => {
  clearCanvas();
  socket.emit("clearBoard");
});

socket.on("clearBoard", () => {
  clearCanvas();
});