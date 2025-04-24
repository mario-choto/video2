const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-lobby", (username) => {
    const user = { id: socket.id, username };
    users.push(user);
    io.emit("lobby-users", users);
  });

  socket.on("call-user", ({ to, offer, from }) => {
    io.to(to).emit("incoming-call", { from, offer, fromId: socket.id });
  });

  socket.on("answer-call", ({ to, answer }) => {
    io.to(to).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    socket.broadcast.emit("ice-candidate", candidate);
  });

  socket.on("chat-message", (data) => {
    socket.broadcast.emit("chat-message", data);
  });

  socket.on("image", (data) => {
    socket.broadcast.emit("image", data);
  });

  socket.on("disconnect", () => {
    users = users.filter(u => u.id !== socket.id);
    io.emit("lobby-users", users);
    console.log("User disconnected:", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server is running...");
});