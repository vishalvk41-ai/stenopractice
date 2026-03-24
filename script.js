// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3H9c9iAO-XpSWxsRs9uO-gvm-MrazQxE",
  authDomain: "stenopractice-66883.firebaseapp.com",
  projectId: "stenopractice-66883",
  storageBucket: "stenopractice-66883.firebasestorage.app",
  messagingSenderId: "112045531767",
  appId: "1:112045531767:web:0d387ccc5d0a35299b9c72",
  measurementId: "G-DFV7R5Z522"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let progressChartInstance = null;

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const progressBtn = document.getElementById('progress-btn');
const saveScoreBtn = document.getElementById('save-score-btn');
const chartContainer = document.getElementById('chart-container');
const timeFilter = document.getElementById('time-filter');

const text1 = document.getElementById('text1');
const text2 = document.getElementById('text2');
const compareBtn = document.getElementById('compare-btn');
const resultText = document.getElementById('result-text');
const timeInput = document.getElementById('time-input');
const timerDisplay = document.getElementById('timer-display');
const resetBtn = document.getElementById('reset-btn');
const statsContainer = document.getElementById('stats-container');
const audioFileInput = document.getElementById('audio-file-input');
const audioPlayer = document.getElementById('audio-player');

let timerInterval = null;
let timeRemaining = 0;
let isTyping = false;
let isFinished = false;
let latestWpm = 0;
let latestAccuracy = 0;
let latestMode = '';
let cachedScores = null; // Holds our Firebase data to save quota

// Handle Authentication State
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userInfo.textContent = `👋 Hello, ${user.displayName || user.email}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        if (isFinished) {
            saveScoreBtn.style.display = 'inline-block';
            saveScoreBtn.textContent = 'Save Score';
            saveScoreBtn.disabled = false;
        }
    } else {
        currentUser = null;
        userInfo.textContent = 'Not logged in';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        chartContainer.style.display = 'none';
        saveScoreBtn.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Login Error: ", error);
        alert(`Login failed: ${error.message}`);
    });
});
logoutBtn.addEventListener('click', () => signOut(auth));

// Format the timer text (MM:SS)
function updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update timer display when user manually changes input
timeInput.addEventListener('input', () => {
    if (!isTyping && !isFinished) {
        let minutes = parseFloat(timeInput.value) || 0;
        timeRemaining = Math.floor(minutes * 60);
        updateTimerDisplay(timeRemaining);
    }
});

// Start the timer on the first keystroke in Box 2
text2.addEventListener('input', () => {
    if (!isTyping && !isFinished && text2.innerText.trim().length > 0) {
        isTyping = true;
        let minutes = parseFloat(timeInput.value) || 0;
        timeRemaining = Math.floor(minutes * 60);
        
        if (timeRemaining > 0) {
            updateTimerDisplay(timeRemaining);
            timerInterval = setInterval(() => {
                timeRemaining--;
                updateTimerDisplay(timeRemaining);
                
                if (timeRemaining <= 0) {
                    endTest();
                }
            }, 1000);
        }
    }
});

// Handle audio file selection
audioFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL;
        audioPlayer.style.display = 'block';
        text1.value = ''; // Clear text area
        text1.disabled = true; // Disable text area to avoid confusion
        text1.placeholder = 'Audio transcription mode active.';
    }
});

function endTest() {
    clearInterval(timerInterval);
    isTyping = false;
    isFinished = true;
    text2.setAttribute('contenteditable', 'false'); // Lock typing
    runComparison();
}

resetBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    isTyping = false;
    isFinished = false;
    text2.setAttribute('contenteditable', 'true');
    text2.innerHTML = '';
    resultText.innerHTML = '';
    resultText.className = '';
    statsContainer.innerHTML = '<div class="stats-placeholder">Typing statistics will appear here after the test.</div>';
    statsContainer.classList.remove('active-stats');
    
    // Reset audio player and text area
    audioPlayer.src = '';
    audioPlayer.style.display = 'none';
    audioFileInput.value = ''; // Allows re-selecting the same file
    text1.disabled = false;
    text1.placeholder = 'Paste the first long sentence here...';

    let minutes = parseFloat(timeInput.value) || 1;
    timeRemaining = Math.floor(minutes * 60);
    updateTimerDisplay(timeRemaining);
    saveScoreBtn.style.display = 'none';
});

compareBtn.addEventListener('click', () => {
    if (!isFinished) {
        endTest(); // End early if manually triggered
    } else {
        runComparison();
    }
});

function runComparison() {
    const sentence2 = text2.innerText.trim();

    // Clear previous results and styling
    resultText.innerHTML = '';
    resultText.className = '';
    statsContainer.innerHTML = '<div class="stats-placeholder">Typing statistics will appear here after the test.</div>';
    statsContainer.classList.remove('active-stats');

    // Check if we are in audio transcription mode.
    const isAudioMode = audioPlayer.src && audioPlayer.src.startsWith('blob:');

    if (isAudioMode) {
        runAudioModeAnalysis(sentence2);
    } else {
        runTextCompareModeAnalysis(sentence2);
    }

    statsContainer.classList.add('active-stats');
}

function runAudioModeAnalysis(typedText) {
    const words2 = typedText === '' ? [] : typedText.split(/\s+/);
    const totalSecondsTaken = Math.floor(parseFloat(timeInput.value) * 60) - timeRemaining;
    const minutesTaken = totalSecondsTaken > 0 ? totalSecondsTaken / 60 : 0;
    const wpm = minutesTaken > 0 ? Math.round(words2.length / minutesTaken) : words2.length;

    statsContainer.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">Your Transcription Results</h3>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-bottom: 10px;">Typed Words: <span>${words2.length}</span></div>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #ecf0f1; font-size: 1.3rem; font-weight: bold; color: #3498db;">
            Speed: <span>${wpm} WPM</span>
        </div>
    `;
    resultText.textContent = '✅ Transcription test finished!';
    resultText.className = 'success';
    
    latestWpm = wpm;
    latestAccuracy = 0;
    latestMode = 'audio';
    if (currentUser) {
        saveScoreBtn.style.display = 'inline-block';
        saveScoreBtn.textContent = 'Save Score';
        saveScoreBtn.disabled = false;
    }
}

function runTextCompareModeAnalysis(typedText) {
    const sentence1 = text1.value.trim();

    if (sentence1 === '' || typedText === '') {
        resultText.textContent = 'Please provide text in both boxes.';
        resultText.className = 'error';
        return;
    }

    const words1 = sentence1.split(/\s+/);
    const words2 = typedText.split(/\s+/);

    const maxLength = Math.max(words1.length, words2.length);
    let resultParts = [];
    let isPerfectMatch = true;
    let correctWordsCount = 0;

    const totalSecondsTaken = Math.floor(parseFloat(timeInput.value) * 60) - timeRemaining;
    const minutesTaken = totalSecondsTaken > 0 ? totalSecondsTaken / 60 : 0;
    const wpm = minutesTaken > 0 ? Math.round(words2.length / minutesTaken) : words2.length;

    for (let i = 0; i < maxLength; i++) {
        const w1 = words1[i];
        const w2 = words2[i];

        if (w1 === w2 && w1 !== undefined) {
            resultParts.push(`<span>${w1}</span>`);
            correctWordsCount++;
        } else {
            isPerfectMatch = false;
            let part = '';
            if (w2 !== undefined) part += `<span class="wrong-word">${w2}</span>`;
            if (w1 !== undefined) part += (part ? ' ' : '') + `<span class="right-word">${w1}</span>`;
            resultParts.push(part);
        }
    }

    const accuracy = words2.length > 0 ? ((correctWordsCount / words2.length) * 100).toFixed(2) : 0;

    statsContainer.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">Your Results</h3>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-bottom: 10px;">Target Words: <span>${words1.length}</span></div>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-bottom: 10px;">Typed Words: <span>${words2.length}</span></div>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-bottom: 10px;">Correct Words: <span style="color: #27ae60;">${correctWordsCount}</span></div>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-bottom: 10px;">Accuracy: <span>${accuracy}%</span></div>
        <div style="display: flex; justify-content: space-between; max-width: 250px; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #ecf0f1; font-size: 1.3rem; font-weight: bold; color: #3498db;">
            Speed: <span>${wpm} WPM</span>
        </div>
    `;
    
    latestWpm = wpm;
    latestAccuracy = accuracy;
    latestMode = 'text';
    if (currentUser) {
        saveScoreBtn.style.display = 'inline-block';
        saveScoreBtn.textContent = 'Save Score';
        saveScoreBtn.disabled = false;
    }

    text2.innerHTML = resultParts.join(' ');

    if (isPerfectMatch && words1.length === words2.length && words1.length > 0) {
        resultText.textContent = '✅ The sentences are a perfect match!';
        resultText.className = 'success';
    } else {
        resultText.textContent = '⚠️ The sentences do not match. See highlighted differences in Box 2.';
        resultText.className = 'error';
    }
}

// Save stats to Firestore database
async function saveStatsToFirebase(wpm, accuracy, mode) {
    if (!currentUser) return; // Only save if user is logged in
    
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const docData = {
            userId: currentUser.uid,
            wpm: wpm,
            accuracy: parseFloat(accuracy),
            mode: mode,
            timestamp: serverTimestamp(),
            dateStr: dateStr
        };
        await addDoc(collection(db, "stenopractice"), docData);
        console.log("Stats successfully saved to database!");
        
        // Return a local copy of the data (replacing serverTimestamp with a local Date for caching)
        return { ...docData, timestamp: now };
    } catch (e) {
        console.error("Error saving stats: ", e);
        return null;
    }
}

// Handle manual score saving
saveScoreBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    saveScoreBtn.textContent = 'Saving...';
    saveScoreBtn.disabled = true;
    const savedData = await saveStatsToFirebase(latestWpm, latestAccuracy, latestMode);
    
    // If we have cached data, inject the new score directly to save a database read!
    if (savedData && cachedScores) {
        cachedScores.push(savedData);
    }
    saveScoreBtn.textContent = 'Saved!';
    
    // Refresh graph automatically if it's currently open
    if (chartContainer.style.display === 'block') {
        loadProgressData();
    }
});

async function loadProgressData() {
    const rawDataContent = document.getElementById('raw-data-content');
    rawDataContent.innerHTML = 'Preparing data...';

    try {
        if (!cachedScores) {
            rawDataContent.innerHTML = 'Fetching data from Firebase...';
            // Fetch ALL data from Firestore exactly once
            const q = query(collection(db, "stenopractice"), orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(q);
            
            cachedScores = [];
            querySnapshot.forEach((doc) => {
                cachedScores.push(doc.data());
            });
        } else {
            console.log("Using cached data, saved Firebase reads!");
        }

        // Apply time filters locally instead of querying Firebase
        let filteredData = cachedScores;
        if (timeFilter.value !== 'all') {
            const days = parseInt(timeFilter.value);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            filteredData = cachedScores.filter(data => {
                if (!data.timestamp) return false;
                // Convert Firebase timestamp to JavaScript Date for comparison
                const recordDate = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                return recordDate >= cutoffDate;
            });
        }

        const labels = [];
        const wpmData = [];
        const accData = [];
        let rawHtml = '';

        if (filteredData.length === 0) {
            rawDataContent.innerHTML = 'No progress data found for this time period. Save a score first!';
        } else {
            filteredData.forEach((data) => {
                labels.push(data.dateStr || 'N/A');
                wpmData.push(data.wpm);
                accData.push(data.accuracy);
                rawHtml += `<div>[${data.dateStr || 'N/A'}] - Mode: <span style="color:#f1c40f;">${data.mode}</span> | WPM: <span style="color:#2ecc71;">${data.wpm}</span> | Accuracy: <span style="color:#3498db;">${data.accuracy}%</span></div>`;
            });
            rawDataContent.innerHTML = rawHtml;
        }

        // Draw Chart using Chart.js
        if (progressChartInstance) progressChartInstance.destroy(); // Clear old chart

        // Calculate dynamic width to enable scrolling for large datasets
        const chartScrollArea = document.getElementById('chart-scroll-area');
        const minWidthPerPoint = 50; // Guarantee at least 50px width per test score
        const requiredWidth = labels.length * minWidthPerPoint;
        chartScrollArea.style.width = requiredWidth > chartScrollArea.parentElement.clientWidth ? `${requiredWidth}px` : '100%';

    const ctx = document.getElementById('progressChart').getContext('2d');
    progressChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Typing Speed (WPM)',
                    data: wpmData,
                    type: 'line', // Changed to line chart
                    backgroundColor: 'rgba(52, 152, 219, 1)',
                    borderColor: 'rgba(41, 128, 185, 1)',
                    borderWidth: 3
                },
                {
                    label: 'Accuracy (%)',
                    data: accData,
                    // Defaults to 'bar' (box) based on the main chart type
                    backgroundColor: 'rgba(39, 174, 96, 0.7)',
                    borderColor: 'rgba(39, 174, 96, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    maxBarThickness: 30 // This makes the bars noticeably thinner!
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'WPM' } },
                y1: { beginAtZero: true, position: 'right', max: 100, title: { display: true, text: 'Accuracy %' } }
            }
        }
    });

    } catch (error) {
        console.error("Error fetching data:", error);
        rawDataContent.innerHTML = `<span style="color: #e74c3c;">Error fetching data: ${error.message}</span>`;
    }
}

// Button logic to display the UI and load the graph
progressBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert("Please login with Google first to view and save your progress!");
        return;
    }

    // Toggle chart visibility
    chartContainer.style.display = chartContainer.style.display === 'none' ? 'block' : 'none';
    if (chartContainer.style.display === 'block') {
        loadProgressData();
    }
});

// Automatically refresh the graph when you change the dropdown filter
timeFilter.addEventListener('change', () => {
    if (chartContainer.style.display === 'block') {
        loadProgressData();
    }
});

// Initialize the display right away
let initialMinutes = parseFloat(timeInput.value) || 1;
updateTimerDisplay(Math.floor(initialMinutes * 60));