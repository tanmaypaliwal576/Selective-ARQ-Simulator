<h1 align="center">Selective Repeat ARQ Simulator</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Networking-Selective%20Repeat%20ARQ-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Protocol-Simulator-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" />
</p>

---

## 🚀 Live Demo  
https://selectiverepeatarq.vercel.app/

---

## 🧠 What Is Selective Repeat ARQ?

Selective Repeat ARQ is a **reliable data transfer protocol** used in computer networks.  
It enhances efficiency by retransmitting **only the specific lost or corrupted packets**, instead of resending the entire window (as in Go-Back-N).

This simulator visually demonstrates:
- Sender & receiver sliding windows  
- Packet transmission  
- ACK-based acknowledgement  
- Packet loss & ACK loss  
- Timer expiration  
- Selective retransmissions  
- Out-of-order packet buffering  

---

## 📘 How the Protocol Works (Diagram Explanation)

### **1. Sender Window**
```
[ 0 ][ 1 ][ 2 ][ 3 ]       <-- Sliding Window (example: size 4)
   ↑     ↑     ↑
   |     |     |
 Sent  ACKed  Timer Running
```

### **2. Receiver Window**
```
[ 0 ][ 1 ][ 2 ][ 3 ]
   ↑
Expected Packet
```

### **3. Packet Flow**
```
Sender  --->  Packet(i)  ---> Receiver
Receiver --->    ACK(i)   ---> Sender
```

### **4. Loss Scenario Example**
```
Packet(2) Lost
Timer for Packet(2) Expires
Sender Retransmits Packet(2)
Receiver Buffers Out-of-Order Packets
```

This diagram helps learners visualize the internal logic of Selective Repeat ARQ.

---

## 🎯 Features

- Real-time sliding window animations  
- Simulated packet & ACK loss  
- Timer-driven retransmissions  
- Out-of-order packet handling  
- Receiver-side packet buffering  
- Clean UI for education & demonstrations  
- Highly interactive visualization  

---

## 📌 Use Cases

### **1. Education & Learning**
Ideal for students studying computer networks and reliability mechanisms.

### **2. Classroom Demonstrations**
Teachers can visually explain ARQ techniques.

### **3. Debugging Networking Logic**
Helps learners experiment with real-time packet behavior.

### **4. Portfolio Showcase**
Excellent project to demonstrate understanding of:
- Reliability protocols  
- Sliding window mechanisms  
- Network error handling  

### **5. Research & Experimentation**
Can be extended to compare:
- Selective Repeat ARQ  
- Go-Back-N ARQ  
- Stop-and-Wait ARQ  

---

## 🛠️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

---

## 📂 Project Structure

```
├── index.html        # Main UI layout
├── style.css         # Styling and animations
├── main.js           # Core logic and simulation handling
└── README.md         # Documentation
```

---

## 📸 Screenshots  
(Add screenshots here if you want. I can help style them.)

---

## 🤝 Contributing  
Pull requests and suggestions are welcome.  
Feel free to open an issue for discussions.

---

## 📚 License  
This project is open-source under the MIT License.
