let draftTranscript = ``;
[
    "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-dense MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-dense MuiMenuItem-gutters RecordCard__title css-1p7vyu5",
    "MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1 MuiCard-root RecordCard RecordCard_listened css-1l3rfqz"
]
let totalSession = { input: 0, output: 0, thinking: 0 };

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

        const systemInstruction = `Ти — коректор військових радіоперехоплень в російсько-українській війні 2022 року, котрий воює на стороні Сил Оборони України (СОУ).
ЗАВДАННЯ ТА ОБМЕЖЕННЯ:
Виправ помилки в чорновій транскрипції.
Текст транскрипції, позивні (включно з позивними в коментаря)х мають бути виведений ТІЛЬКИ російською мовою.
Форматування діалогу: замість дефісів (-) на початку реплік використовуй імена або позивні абонентів у квадратних дужках.
Приклад:
[МИР]: РЕКА, РЕКА МИРУ.
[РЕКА]: Да, МИР, РЕКА на связи.
Якщо абонента не вдалось ідентифікувати, використовуй [Н/В] (невідомий).
Не додумуй нічого, якщо щось не зрозуміло, використовуй ... (три крапки) для позначення незрозумілих слів або фраз.
Правила встановлення зв'язку:
- База, База Чёрному: в/сл Чёрный викликає в/сл База
- Слон, Слон Базе на связь, Слон: в/сл База викликає в/сл Слон
Числа: всі числові значення (як у транскрипції, так і у висновку) повинні бути записані ВИКЛЮЧНО цифрами (наприклад, 2, 300, 15).
Позивні: всі ВІДОМІ позивні в тексті повинні бути записані ВЕЛИКИМИ ЛІТЕРАМИ (наприклад, МИР, СОКІЛ).
Додай короткий ВИСНОВОК (conclusion) українською мовою. Формат: максимум одне речення. Допускається додавання другого речення виключно у випадку, якщо під час перехоплення відбулася важлива подія.
Відповідай ТІЛЬКИ валідним JSON у такому форматі:
{
  "transcription": "corrected dialogue here",
  "conclusion": "military assessment here"
  "callsigns": ["list", "of", "callsigns", "mentioned"]
}
Правила для ВИСНОВКУ (conclusion):
Зазначай лише факти: тип зв'язку (логістика/тактика/розвідка).
Суть обговорення: що саме координується або про що доповідають.
Геолокації: Якщо в розмові згадуються назви позицій, лісосмуг або номери точок, ОБОВ'ЯЗКОВО вказуй це у висновку.
НЕ роби припущень, не додавай від себе деталей і не роби аналітичних висновків.
Приклади вдалих висновків:
"Логістика: координація доставки вантажу на позиції біля лісосмуги 4."
"Тактика: доповідь про стан забезпечення на точці 12. Відбувся артилерійський обстріл."
"Управління розміщенням військ і координація дій підрозділу."
Відповідь надавай українською.
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
        const usage = data.usageMetadata;
        const thinking = usage.totalTokenCount
            - usage.promptTokenCount
            - usage.candidatesTokenCount;

        totalSession.input += usage.promptTokenCount;
        totalSession.output += usage.candidatesTokenCount;
        totalSession.thinking += thinking;

        const sessionCost =
            (totalSession.input / 1_000_000) * 0.15 +
            (totalSession.output / 1_000_000) * 0.60 +
            (totalSession.thinking / 1_000_000) * 3.50;

        console.log(`[Session] Input: ${totalSession.input} | ` +
            `Output: ${totalSession.output} | ` +
            `Thinking: ${totalSession.thinking}`);
        console.log(`[Session] Cumulative cost: $${sessionCost.toFixed(6)}`);

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

                        let buttons = btns;

                        const idx = buttons.indexOf(btn);
                        if (idx !== -1) {
                            buttons = buttons.slice(0, idx);
                        }


                        // Auto-click all buttons every 500ms
                        autoClickIntervalId = setInterval(() => {
                            if (buttons.length > 0) {
                                // buttons.forEach((b, i) => {
                                //     // console.log(`🖱️ Auto-clicking button ${i}`);
                                //     b.click();
                                // });
                                buttons.pop().click();
                            } else {
                                console.log('⏹️ No buttons found, stopping auto-click');
                                clearInterval(autoClickIntervalId);
                                isAutoClicking = false;
                            }
                        }, 200);
                    });

                    // // 🔧 NEW: Add global keyup listener to stop on Ctrl release
                    // document.addEventListener("keyup", (evt) => {
                    //     if ((evt.key === 'Control' || evt.key === 'Meta') && isAutoClicking) {
                    //         console.log('⏹️ Ctrl released, stopping auto-click');
                    //         clearInterval(autoClickIntervalId);
                    //         isAutoClicking = false;
                    //     }
                    // });

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
