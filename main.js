// Replace with your Google Apps Script web app URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz97F87hqDODu3K_9q0tujhI81ZO-7rBLPk8flXCvWxJqe6HHDPvRINqiCQv6GlEDXV1Q/exec';

// DOM elements and variables remain the same...

// Updated sendToGoogleScript function
function sendToGoogleScript(data) {
    serverResponse.textContent = "Sending to server...";
    serverResponse.className = "pending";
    
    // Create a new form data object
    const formData = new FormData();
    formData.append('qrData', data);
    
    // Use both GET and POST approaches with proper error handling
    const getUrl = `${GOOGLE_SCRIPT_URL}?qrData=${encodeURIComponent(data)}&t=${Date.now()}`;
    
    fetch(getUrl, {
        method: 'GET',
        redirect: 'follow'
    })
    .then(response => {
        if (!response.ok) {
            // If GET fails, try POST as fallback
            return fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData,
                redirect: 'follow'
            });
        }
        return response;
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.text();
    })
    .then(responseText => {
        serverResponse.textContent = responseText;
        serverResponse.className = responseText.toLowerCase().includes('ok') ? 'success' : 'error';
    })
    .catch(error => {
        serverResponse.textContent = `Error: ${error.message}`;
        serverResponse.className = 'error';
        console.error('Fetch error:', error);
        
        // Additional error logging
        fetch(`${GOOGLE_SCRIPT_URL}?errorLog=${encodeURIComponent(error.message)}&t=${Date.now()}`)
            .then(r => r.text())
            .then(console.log)
            .catch(console.error);
    });
}

// DOM elements
const video = document.getElementById('qr-video');
const canvas = document.getElementById('qr-canvas');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const scanResult = document.getElementById('scan-result');
const serverResponse = document.getElementById('server-response');

// Variables
let stream = null;
let scanningInterval = null;
let lastScannedCode = null;

// Start scanning
startButton.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        video.srcObject = stream;
        video.play();
        
        startButton.disabled = true;
        stopButton.disabled = false;
        
        scanResult.textContent = "Scanning...";
        serverResponse.textContent = "";
        
        // Start scanning for QR codes
        scanningInterval = setInterval(scanQRCode, 500);
    } catch (err) {
        console.error("Error accessing camera:", err);
        scanResult.textContent = "Error accessing camera: " + err.message;
    }
});

// Stop scanning
stopButton.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
    }
    
    startButton.disabled = false;
    stopButton.disabled = true;
    scanResult.textContent = "Scanner stopped";
});

// Scan for QR codes
function scanQRCode() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const canvasContext = canvas.getContext('2d');
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            if (code.data !== lastScannedCode) {
                lastScannedCode = code.data;
                scanResult.textContent = `Scanned: ${code.data}`;
                sendToGoogleScript(code.data);
            }
        }
    }
}

function testConnection() {
    // Test with a known valid code from your sheet
    sendToGoogleScript("TEST123"); 
    
    // Test with an invalid code
    setTimeout(() => sendToGoogleScript("INVALID_CODE"), 2000);
  }