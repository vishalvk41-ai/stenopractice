const text1 = document.getElementById('text1');
const text2 = document.getElementById('text2');
const compareBtn = document.getElementById('compare-btn');
const resultText = document.getElementById('result-text');
const timeInput = document.getElementById('time-input');
const timerDisplay = document.getElementById('timer-display');
const resetBtn = document.getElementById('reset-btn');
const statsContainer = document.getElementById('stats-container');

let timerInterval = null;
let timeRemaining = 0;
let isTyping = false;
let isFinished = false;

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
    
    let minutes = parseFloat(timeInput.value) || 1;
    timeRemaining = Math.floor(minutes * 60);
    updateTimerDisplay(timeRemaining);
});

compareBtn.addEventListener('click', () => {
    if (!isFinished) {
        endTest(); // End early if manually triggered
    } else {
        runComparison();
    }
});

function runComparison() {
    // Get and clean the input sentences
    const sentence1 = text1.value.trim();
    const sentence2 = text2.innerText.trim();

    // Clear previous results and styling
    resultText.innerHTML = '';
    resultText.className = '';
    statsContainer.innerHTML = '<div class="stats-placeholder">Typing statistics will appear here after the test.</div>';
    statsContainer.classList.remove('active-stats');

    if (sentence1 === '' || sentence2 === '') {
        resultText.textContent = 'Please provide text in both boxes.';
        resultText.className = 'error';
        return;
    }

    // Split sentences into words using a regex for whitespace
    const words1 = sentence1 === '' ? [] : sentence1.split(/\s+/);
    const words2 = sentence2 === '' ? [] : sentence2.split(/\s+/);

    const maxLength = Math.max(words1.length, words2.length);
    let resultParts = [];
    let isPerfectMatch = true;
    let correctWordsCount = 0;

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

    // Calculate and display statistics
    const accuracy = words2.length > 0 ? ((correctWordsCount / words2.length) * 100).toFixed(2) : 0;
    const totalSecondsTaken = Math.floor(parseFloat(timeInput.value) * 60) - timeRemaining;
    const minutesTaken = totalSecondsTaken > 0 ? totalSecondsTaken / 60 : 0;
    const wpm = minutesTaken > 0 ? Math.round(words2.length / minutesTaken) : words2.length;

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
    statsContainer.classList.add('active-stats');

    // Output the formatted text directly into box 2
    text2.innerHTML = resultParts.join(' ');

    if (isPerfectMatch && words1.length === words2.length && words1.length > 0) {
        resultText.textContent = '✅ The sentences are a perfect match!';
        resultText.className = 'success';
    } else {
        resultText.textContent = '⚠️ The sentences do not match. See highlighted differences in Box 2.';
        resultText.className = 'error';
    }
}

// Initialize the display right away
let initialMinutes = parseFloat(timeInput.value) || 1;
updateTimerDisplay(Math.floor(initialMinutes * 60));