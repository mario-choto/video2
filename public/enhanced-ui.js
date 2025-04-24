const socket = io(window.location.origin);
let username = "";
let localStream, peerConnection;
let currentCallFrom = null;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

document.getElementById("joinBtn").addEventListener("click", async () => {
  username = document.getElementById("username").value.trim();
  if (!username) return alert("Enter your name");
  document.getElementById("joinBtn").disabled = true;
  socket.emit("join-lobby", username);
});

socket.on("lobby-users", (users) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  users.forEach(user => {
    if (user.username !== username) {
      const div = document.createElement("div");
      div.className = "user";
      div.innerHTML = \`
        <span>\${user.username}</span>
        <button onclick="callUser('\${user.id}')">Call</button>
      \`;
      userList.appendChild(div);
    }
  });
});

window.callUser = async (userId) => {
  await setupMedia();
  createPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("call-user", { to: userId, offer, from: username });
};

socket.on("incoming-call", ({ from, offer, fromId }) => {
  currentCallFrom = { from, offer, fromId };
  document.getElementById("callFrom").textContent = \`\${from} is calling...\`;
  document.getElementById("incomingCall").style.display = "block";
});

document.getElementById("acceptBtn").addEventListener("click", async () => {
  document.getElementById("incomingCall").style.display = "none";
  await setupMedia();
  createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(currentCallFrom.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer-call", { to: currentCallFrom.fromId, answer });
});

document.getElementById("rejectBtn").addEventListener("click", () => {
  document.getElementById("incomingCall").style.display = "none";
  currentCallFrom = null;
});

socket.on("answer", (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", (candidate) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) socket.emit("ice-candidate", event.candidate);
  };

  peerConnection.ontrack = (event) => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
    document.getElementById("remoteVideo").style.display = "block";
    document.getElementById("localVideo").style.display = "block";
    document.getElementById("inCallControls").style.display = "block";
    document.getElementById("chatArea").style.display = "block";
  };
}

async function setupMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}

document.getElementById("hangupBtn").addEventListener("click", () => {
  peerConnection.close();
  peerConnection = null;
  document.getElementById("localVideo").style.display = "none";
  document.getElementById("remoteVideo").style.display = "none";
  document.getElementById("inCallControls").style.display = "none";
  document.getElementById("chatArea").style.display = "none";
});

function sendMessage() {
  const msg = document.getElementById("msgInput").value;
  if (!msg) return;
  socket.emit("chat-message", { name: username, message: msg });
  document.getElementById("msgInput").value = "";
}

socket.on("chat-message", (data) => {
  document.getElementById("messages").innerHTML += \`<div><b>\${data.name}:</b> \${data.message}</div>\`;
});

document.getElementById("imageInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit("image", { name: username, image: reader.result });
  };
  reader.readAsDataURL(file);
});

function snapPhoto() {
  const canvas = document.createElement("canvas");
  const video = document.getElementById("localVideo");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const dataURL = canvas.toDataURL("image/png");
  socket.emit("image", { name: username, image: dataURL });
}

socket.on("image", (data) => {
  document.getElementById("messages").innerHTML += \`<div><b>\${data.name}:</b><br><img src="\${data.image}" style="max-width:100%"></div>\`;
});