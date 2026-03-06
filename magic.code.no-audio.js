let draftTranscript = ``;
[
    "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-dense MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-dense MuiMenuItem-gutters RecordCard__title css-1p7vyu5",
    "MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1 MuiCard-root RecordCard RecordCard_listened css-1l3rfqz"
]
function pasteValueIntoTextarea(textarea, value) {
    // Copy value to clipboard
    navigator.clipboard.writeText(value).then(() => {
        // Focus the textarea
        textarea.focus();

        // Simulate Ctrl+V paste
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            bubbles: true,
            cancelable: true
        });

        pasteEvent.clipboardData.setData('text/plain', value);
        textarea.dispatchEvent(pasteEvent);

        // Fallback: manually set value and trigger input events
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, value);

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("✅ Pasted into textarea");
    }).catch(err => {
        console.error("❌ Clipboard paste failed:", err);
    });
}

const geminiApiKey = window.GEMINI_API_KEY || prompt("Enter your Gemini API Key:");
window.GEMINI_API_KEY = geminiApiKey;

const model = 'gemini-2.5-flash';

let knownCallsigns = "АБРАМ, АГЛАР, КРАСНЫЙ, ТОР, ПЯТЫЙ, ПЕРС, ПАУК, ТОПОЛЬ";
let specialWords = "циркулярно,Костлявая,Старя,не прошло,повтори,180,200,300,350";

const callsignsObserver = new MutationObserver(function () {
    let localCallsigns = Array.from(document.querySelectorAll("#root > div > main > div > div.recordsGrid__form > div.recordsGrid__formScroller > div > div > div > p.MuiTypography-root.MuiTypography-body1.css-9l3uo3 > span")).map(span => span.textContent);
    if (localCallsigns.length > 0) {
        knownCallsigns = localCallsigns.join("").toLocaleUpperCase();
        // console.log("Updated callsigns:", knownCallsigns);
    }
});
callsignsObserver.observe(document.body, { childList: true, subtree: true });

const correctWithGemini = (async function (){
    try {
    console.log("🔍 Step 1: Collecting data...");

    const contextData = {
        callsigns: knownCallsigns.split(','),
        jargon: specialWords.split(',')
    };
        console.log(`📥 Step 2: Preparing request ...`);

    const systemInstruction = `You are a military radio intercept corrector.
TASK:
1. Correct errors in the draft transcript
2. Output ONLY corrected dialogue in original format, Russian language
3. Add brief ASSESSMENT in format: "[one sentence max], Ukrainian language"
4. Another sentence may be added in the ASSESTMENT of an important event if such an event occurred during the interception.
5. Respond ONLY with valid JSON in this format:
{
  "transcription": "corrected dialogue here",
  "conclusion": "military assessment here"
  "callsigns": ["list", "of", "callsigns", "mentioned"]
}
ASSESSMENT rules:
- State only facts: type of communication (логістика/тактика/розвідка)
- Subject matter: what is being coordinated/reported
- Do NOT speculate, add details, or provide analysis

Example good assessments:
- "Координація доставки вантажу на позиції."
- "Доповідь про стан матеріального забезпечення."
- "Управління розміщенням військ і логістикою."

Respond in Ukrainian.
`;

    draftTranscript = document.querySelector("textarea").value.trim();
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{
                    parts: [{
                        text: `Draft Transcription: ${draftTranscript}\n\nContext: ${JSON.stringify(contextData, null, 2)}`
                    }]
                }]
            })
        }
    );

        let parsedResponse = null;
    const data = await response.json();
    let rawResponse = data.candidates[0].content.parts[0].text.trim();
    rawResponse = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    parsedResponse = JSON.parse(rawResponse);
        const correctedTranscript = parsedResponse.transcription || "";
        const conclusion = parsedResponse.conclusion || "";
        const callsigns = parsedResponse.callsigns || "";

        const textareas = document.querySelectorAll("textarea");

        if (textareas.length >= 1) {
            pasteValueIntoTextarea(textareas[0], correctedTranscript);
        }

        if (textareas.length >= 3) {
            pasteValueIntoTextarea(textareas[2], conclusion);
        }

        console.log("✅ Transcription:", correctedTranscript);
        console.log("✅ Conclusion:", conclusion);
        console.log("✅ Callsigns:", callsigns);


    }catch (error) {
        console.error("❌ An error occurred:", error);
    }
})

function setupAutoClickListener() {
    const selector = "#root > div > main > div > div.recordsGrid__playlist > div > div.FilteredPlaylist__playlist > div.FilteredPlaylist__playlistScroller > div > div > div > div > div > div > div.RecordCard__firstLine_right > button:nth-child(2)";

    let autoClickIntervalId = null;
    let isAutoClicking = false;

    // Find and attach mousedown listener to all matching buttons
    const attachListeners = () => {
        const btns = Array.from(document.querySelectorAll(selector));

        if (btns.length > 0) {
            // console.log(`🔍 Found ${btns.length} buttons`);

            btns.forEach((btn, index) => {
                // Check if listener already attached
                if (!btn.dataset.autoClickAttached) {
                    btn.addEventListener("mousedown", (evt) => {
                        // 🔧 Check if Ctrl key is pressed
                        const isCtrlPressed = evt.ctrlKey || evt.metaKey;

                        //console.log(`🖱️ Mousedown detected on button ${index} | Ctrl: ${isCtrlPressed}`);

                        // Only start auto-click if Ctrl is held
                        if (!isCtrlPressed) {
                            console.log('⏭️ Ctrl not pressed, ignoring');
                            return;
                        }

                        // Prevent duplicate intervals
                        if (isAutoClicking) {
                            console.log('⏸️ Auto-click already running');
                            return;
                        }

                        isAutoClicking = true;
                        console.log('▶️ Starting auto-click (Ctrl held)...');

                        // Auto-click all buttons every 500ms
                        autoClickIntervalId = setInterval(() => {
                            let buttons = Array.from(document.querySelectorAll(selector));

                            const idx = buttons.indexOf(btn);
                            if(idx !== -1) {
                                buttons = buttons.slice(0, idx);
                            }

                            if (buttons.length > 0) {
                                buttons.forEach((b, i) => {
                                    // console.log(`🖱️ Auto-clicking button ${i}`);
                                    b.click();
                                });
                            } else {
                                console.log('⏹️ No buttons found, stopping auto-click');
                                clearInterval(autoClickIntervalId);
                                isAutoClicking = false;
                            }
                        }, 500);
                    });

                    // 🔧 NEW: Add global keyup listener to stop on Ctrl release
                    document.addEventListener("keyup", (evt) => {
                        if ((evt.key === 'Control' || evt.key === 'Meta') && isAutoClicking) {
                            console.log('⏹️ Ctrl released, stopping auto-click');
                            clearInterval(autoClickIntervalId);
                            isAutoClicking = false;
                        }
                    });

                    btn.dataset.autoClickAttached = 'true';
                    // console.log(`✅ Listener attached to button ${index}`);
                }
            });
        }
    };

    // Attach listeners initially
    attachListeners();

    // Re-attach listeners on DOM mutations
    const observer = new MutationObserver(() => {
        attachListeners();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

setupAutoClickListener();

let transcribeBtn = null;

function ensureButton() {
    const textarea = document.querySelector("textarea");
    if (!textarea || document.contains(transcribeBtn)) return;

    transcribeBtn = document.createElement('button');
    transcribeBtn.innerHTML = '🔊 Розпізнати';
    transcribeBtn.type = 'button';
    transcribeBtn.style.marginLeft = '8px';

    textarea.parentNode.insertBefore(transcribeBtn, textarea.nextSibling);
    transcribeBtn.addEventListener('click', correctWithGemini);
}

const observer = new MutationObserver(ensureButton);
observer.observe(document.body, { childList: true, subtree: true });

ensureButton();
