// Replace with your Google Apps Script web app URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz97F87hqDODu3K_9q0tujhI81ZO-7rBLPk8flXCvWxJqe6HHDPvRINqiCQv6GlEDXV1Q/exec';

// Configuration
const SCAN_INTERVAL = 100; // Milliseconds between scans (faster than 500ms)
const DEBOUNCE_TIME = 2000; // Milliseconds to wait before rescanning the same code
const SCAN_ACCURACY = 0.7; // Minimum confidence threshold (0-1)

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
let lastScanTime = 0;
let isProcessing = false;

// Optimized scanning function using requestAnimationFrame
function scanQRCode() {
    if (!stream || isProcessing) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        isProcessing = true;
        
        // Use the natural video dimensions for better accuracy
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const canvasContext = canvas.getContext('2d', { willReadFrequently: true });
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
            const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
                minConfidence: SCAN_ACCURACY
            });
            
            if (code) {
                const now = Date.now();
                // Only process if it's a new code or DEBOUNCE_TIME has passed
                if (code.data !== lastScannedCode || (now - lastScanTime) > DEBOUNCE_TIME) {
                    lastScannedCode = code.data;
                    lastScanTime = now;
                    
                    scanResult.textContent = `Scanned: ${code.data}`;
                    scanResult.className = 'success';
                    
                    // Send to server without waiting (fire-and-forget)
                    sendToGoogleScript(code.data);
                }
            } else {
                scanResult.className = '';
            }
        } catch (error) {
            console.error('Scan error:', error);
        } finally {
            isProcessing = false;
        }
    }
}

// Optimized server communication with retry logic
async function sendToGoogleScript(data) {
    serverResponse.textContent = "Sending to server...";
    serverResponse.className = "pending";
    
    try {
        // First try POST with FormData
        const formData = new FormData();
        formData.append('qrData', data);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: formData,
            redirect: 'follow'
        });
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const responseText = await response.text();
        serverResponse.textContent = responseText;
        serverResponse.className = responseText.toLowerCase().includes('ok') ? 'success' : 'error';
    } catch (postError) {
        console.log('POST failed, trying GET:', postError);
        
        // Fallback to GET if POST fails
        try {
            const getUrl = `${GOOGLE_SCRIPT_URL}?qrData=${encodeURIComponent(data)}&t=${Date.now()}`;
            const getResponse = await fetch(getUrl, {
                method: 'GET',
                redirect: 'follow'
            });
            
            if (!getResponse.ok) throw new Error(`HTTP error! Status: ${getResponse.status}`);
            
            const responseText = await getResponse.text();
            serverResponse.textContent = responseText;
            serverResponse.className = responseText.toLowerCase().includes('ok') ? 'success' : 'error';
        } catch (getError) {
            console.error('Both POST and GET failed:', getError);
            serverResponse.textContent = `Error: ${getError.message}`;
            serverResponse.className = 'error';
        }
    }
}

// Start scanning with optimized camera settings
startButton.addEventListener('click', async () => {
    try {
        // Try to get the best possible camera resolution
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        video.srcObject = stream;
        video.play().then(() => {
            startButton.disabled = true;
            stopButton.disabled = false;
            
            scanResult.textContent = "Scanning...";
            serverResponse.textContent = "";
            
            // Use requestAnimationFrame for smoother scanning
            function scanLoop() {
                scanQRCode();
                if (scanningInterval !== null) {
                    requestAnimationFrame(scanLoop);
                }
            }
            
            // Clear any existing interval
            if (scanningInterval) clearInterval(scanningInterval);
            
            // Start the optimized scanning loop
            scanningInterval = true;
            scanLoop();
        }).catch(err => {
            console.error("Video play error:", err);
            scanResult.textContent = "Error starting video: " + err.message;
        });
    } catch (err) {
        console.error("Error accessing camera:", err);
        scanResult.textContent = "Error accessing camera: " + err.message;
        scanResult.className = 'error';
    }
});

// Stop scanning
stopButton.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
        stream = null;
    }
    
    scanningInterval = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    scanResult.textContent = "Scanner stopped";
    scanResult.className = '';
});

// Add a manual test function
function testScanner() {
    // Simulate scanning a test code
    lastScannedCode = "TEST123";
    scanResult.textContent = `Test scan: TEST123`;
    scanResult.className = 'success';
    sendToGoogleScript("TEST123");
}

// Add CSS for the pending state
const style = document.createElement('style');
style.textContent = `
    .pending {
        color: #FFA500;
        background-color: rgba(255, 165, 0, 0.1) !important;
        border-left-color: #FFA500 !important;
    }
`;
document.head.appendChild(style);
