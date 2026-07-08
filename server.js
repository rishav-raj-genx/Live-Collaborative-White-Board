const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

let stages = [
  {
    id: 1,
    name: "Page 1",
    history: [],
    redoStack: [],
    background: "#ffffff"
  }
];

let currentStageIndex = 0;
let nextId = 2;

function broadcastState() {
  io.emit("state", {
    stages,
    currentStageIndex
  });
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.emit("state", { stages, currentStageIndex });

  socket.on("action", (action) => {
    const stage = stages[currentStageIndex];
    if (!stage) return;

    stage.history.push(action);
    stage.redoStack = [];
    broadcastState();
  });

  socket.on("undo", () => {
    const stage = stages[currentStageIndex];
    if (!stage || stage.history.length === 0) return;

    const action = stage.history.pop();
    stage.redoStack.push(action);
    broadcastState();
  });

  socket.on("redo", () => {
    const stage = stages[currentStageIndex];
    if (!stage || stage.redoStack.length === 0) return;

    const action = stage.redoStack.pop();
    stage.history.push(action);
    broadcastState();
  });

  socket.on("clearStage", () => {
    const stage = stages[currentStageIndex];
    if (!stage) return;

    const clearAction = {
      type: "clear",
      before: stage.history.slice()
    };

    stage.history.push(clearAction);
    stage.redoStack = [];
    broadcastState();
  });

  socket.on("setBackground", (color) => {
    const stage = stages[currentStageIndex];
    if (!stage) return;

    stage.background = color;
    broadcastState();
  });

  socket.on("addStage", () => {
    stages.push({
      id: nextId++,
      name: `Page ${stages.length + 1}`,
      history: [],
      redoStack: [],
      background: "#ffffff"
    });

    currentStageIndex = stages.length - 1;
    broadcastState();
  });

  socket.on("deleteStage", () => {
    if (stages.length <= 1) return;

    stages.splice(currentStageIndex, 1);

    if (currentStageIndex >= stages.length) {
      currentStageIndex = stages.length - 1;
    }

    broadcastState();
  });

  socket.on("changeStage", (index) => {
    if (index < 0 || index >= stages.length) return;

    currentStageIndex = index;
    broadcastState();
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});