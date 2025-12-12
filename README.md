<h1 align="center">Selective Repeat ARQ Simulator</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Networking-Selective%20Repeat%20ARQ-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Protocol-Simulator-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" />
</p>

<p align="center">
  <img src="https://img.icons8.com/external-flaticons-lineal-color-flat-icons/344/external-network-computer-science-flaticons-lineal-color-flat-icons.png" width="120" />
</p>

---

## 🚀 Live Demo  
**https://selectiverepeatarq.vercel.app/**

---

## 🧠 What Is Selective Repeat ARQ?

Selective Repeat ARQ is a reliable data transfer protocol used in networking to ensure that only lost or corrupted packets are retransmitted, improving efficiency over basic ARQ variants like Stop-and-Wait or Go-Back-N.

This simulator helps visualize:
- Sliding windows (Sender & Receiver)
- Packet sequencing
- Individual ACKs
- Packet loss & ACK loss
- Timer-based retransmissions
- Out-of-order buffering

---

## 🎯 Features

- 🔄 **Real-time sliding window animation**
- 📡 **Simulate packet & ACK loss**
- 🕒 **Timer-based retransmissions**
- 📥 **Receiver-side packet buffering**
- 🧩 **Out-of-order delivery visualization**
- 🎨 **Clean, interactive UI for learning**

---

## 🛠️ Tech Stack

<p align="left">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
</p>

---

## 📘 How It Works

### **Sender Window**
Displays which packets are:
- Sent  
- Acknowledged  
- Waiting for timeout  

### **Receiver Window**
Handles:
- In-order packets  
- Buffered packets  
- Delivering only when next expected packet arrives  

### **Timers & Retransmissions**
Each packet has an **individual timer**.  
If it expires → **that packet only** is resent.

### **Loss Simulation**
Toggle:
- ❌ Packet Loss  
- ❌ ACK Loss  

and observe protocol behavior in failure scenarios.

---

## 📂 Project Structure

```
/assets
  /css
  /js
index.html
README.md
``'
---

## 🤝 Contributing
Pull requests are welcome.  
Feel free to open issues or suggest improvements.

---

## 📚 License
This project is open-source under the MIT License.
