// ── Persistent session stats (survives re-paste if already set) ──────────────
window.__geminiSession = window.__geminiSession
    || { input: 0, output: 0, thinking: 0 };
const totalSession = window.__geminiSession;

// ── CSS selectors (was orphaned array literal — now named) ───────────────────
const SELECTORS = {
    recordTitle: "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-dense " +
                 "MuiMenuItem-gutters RecordCard__title css-1p7vyu5",
    recordCard:  "MuiPaper-root MuiPaper-elevation MuiPaper-rounded " +
                 "MuiPaper-elevation1 MuiCard-root RecordCard " +
                 "RecordCard_listened css-1l3rfqz",
    transcribeBtn: "#root > div > main > div > " +
                   "div.recordsGrid__playlist > div > " +
                   "div.FilteredPlaylist__playlist > " +
                   "div.FilteredPlaylist__playlistScroller > " +
                   "div > div > div > div > div > div > " +
                   "div.RecordCard__firstLine_right > button:nth-child(2)"
};

// ── Config ───────────────────────────────────────────────────────────────────
const geminiApiKey = window.GEMINI_API_KEY
    || 'AIzaSyCHPlb6VCJaeTHiJADx9EplmU-3T9JQYMY' || prompt("Enter your Gemini API Key:");
window.GEMINI_API_KEY = geminiApiKey;


const MODELS = {
  // Серія 3.1 (Найновіша, з покращеним мисленням та агентивністю)
  GEMINI_3_1_PRO: 'gemini-3.1-pro-preview',
  GEMINI_3_1_FLASH: 'gemini-3.1-flash-preview',
  GEMINI_3_1_FLASH_LITE: 'gemini-3.1-flash-lite-preview',

  // Серія 2.5 (Стабільна середина 2025-2026)
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',

  // Серія 1.5 (Класична, досі використовується для специфічних завдань)
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
  GEMINI_1_5_FLASH: 'gemini-1.5-flash',
  GEMINI_1_5_FLASH_8B: 'gemini-1.5-flash-8b'
};

const PRICES = {
  // Моделі 3.1: Вихідні токени дорожчі через високу якість генерації
  [MODELS.GEMINI_3_1_PRO]: { input: 2.00, output: 12.00, thinking: 12.00 },
  [MODELS.GEMINI_3_1_FLASH]: { input: 0.50, output: 3.00, thinking: 3.00 },
  [MODELS.GEMINI_3_1_FLASH_LITE]: { input: 0.25, output: 1.50, thinking: 1.50 },

  // Моделі 2.5: Золотий стандарт ціна/якість
  [MODELS.GEMINI_2_5_PRO]: { input: 1.25, output: 10.00, thinking: 1.25 },
  [MODELS.GEMINI_2_5_FLASH]: { input: 0.30, output: 2.50, thinking: 0.30 },
  [MODELS.GEMINI_2_5_FLASH_LITE]: { input: 0.10, output: 0.40, thinking: 0.10 },

  // Моделі 1.5: Найбільш економні для масової обробки тексту
  [MODELS.GEMINI_1_5_PRO]: { input: 1.25, output: 5.00, thinking: 0 }, // Мислення не підтримується
  [MODELS.GEMINI_1_5_FLASH]: { input: 0.075, output: 0.30, thinking: 0 },
  [MODELS.GEMINI_1_5_FLASH_8B]: { input: 0.0375, output: 0.15, thinking: 0 }
};

const MODEL = MODELS.GEMINI_3_1_FLASH_LITE;
const PRICE = PRICES[MODEL];

let knownCallsigns = "АБРАМ, АГЛАР, КРАСНЫЙ, ТОР, ПЯТИЙ, ПЕРС, ПАУК, ТОПОЛЬ";
let specialWords   = "циркулярно,Костлявая,Старя,не прошло,повтори,180,200,300,350";

// ── Callsign observer ────────────────────────────────────────────────────────
const callsignsObserver = new MutationObserver(() => {
    const spans = Array.from(document.querySelectorAll(
        "#root > div > main > div > " +
        "div.recordsGrid__form > div.recordsGrid__formScroller > " +
        "div > div > div > p.MuiTypography-root.MuiTypography-body1.css-9l3uo3 > span"
    ));
    if (spans.length > 0) {
        knownCallsigns = spans.map(s => s.textContent)
                              .join("")
                              .toLocaleUpperCase();
    }
});
callsignsObserver.observe(document.body, { childList: true, subtree: true });

const getSeconds = (timeStr) => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
};

// ── React-safe textarea value setter ────────────────────────────────────────
function setReactTextarea(textarea, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(textarea, value);
    textarea.dispatchEvent(new Event('input',  { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `Ти — коректор військових радіоперехоплень в російсько-українській війні 2022 року, котрий воює на стороні Сил Оборони України (СОУ).
ЗАВДАННЯ ТА ОБМЕЖЕННЯ:
Виправ помилки в чорновій транскрипції.
Текст транскрипції, позивні (включно з позивними в коментарях) мають бути виведені ТІЛЬКИ російською мовою.
Не додумуй нічого, якщо щось не зрозуміло, використовуй ... (три крапки) для позначення незрозумілих слів або фраз.
Правила встановлення зв'язку:
- База, База Чёрному: військовослужбовець (в/сл) Чёрный викликає в/сл База
- Слон, Слон Базе на связь, Слон: в/сл База викликає в/сл Слон
Числа: всі числові значення повинні бути записані виключно цифрами. Текст - зберігаючи граматику української мови, 
позивні: всі ВІДОМІ позивні в тексті повинні бути записані ВЕЛИКИМИ ЛІТЕРАМИ, невідомі - просто в Великої Букви.
Додай короткий ВИСНОВОК українською мовою. Формат: максимум одне речення.
Скорочення: в/сл (військовослужбовець); о/с (особовий склад); Старая, Костлявая, Яга, Баба Яга (вангажне БпЛА СОУ), ждун (БпЛА, що знаходиться на землі в режимі очікування), опта (БпЛА на оптоволокні); борт (БпЛА йм. РОВ); союзы (союзні підрозділи РОВ); фипик, фипка, одноразка, камикадзе (БпЛА типу FPV); малый (хвилина, наприклад 15 малых - 15 хвилин), большой - година (через 2 большых - через 2 години); осдаки (вогневий вплив СОУ); В КОНТЕКСТІ ОБСТРІЛУ: слон, хобот (танк СОУ); рубль 20 (міномет 120мм). В КОНТЕКСТІ ЗАСОБІВ ЗВ'ЯЗКУ: тутка (радіостанція TYT), хитера (радіостанція Hytera), мотор (радіостанція Motorolla), бафик (радіостанція Baofeng);
Відповідай ТІЛЬКИ валідним JSON:
{
  "transcription": "corrected dialogue here",
  "conclusion": "military assessment here",
  "callsigns": ["list", "of", "callsigns"]
}
Правила для ВИСНОВКУ:
Не вживай "ворожий", "ворог", "противник". Ти воюєш на стороні СОУ та слухаєш переговори РОВ (Російський Окупаційних Військ). Коли вонни згадують про нас, вживай "СОУ".
Суть обговорення: що саме координується або про що доповідають.
Геолокації: якщо згадуються назви позицій, лісосмуг або номери точок — ОБОВ'ЯЗКОВО вказуй у висновку.
НЕ роби припущень і не додавай аналітичних висновків.`;

// ── Audio batching to prevent duplicate requests ──────────────────────────────
const audioBatches = {};

const processAudioBatch = function(audioUrl, contextData) {
    if (!audioBatches[audioUrl]) {
        audioBatches[audioUrl] = {
            contexts: [],
            timer: null
        };
    }

    const batch = audioBatches[audioUrl];
    batch.contexts.push(contextData);

    // Clear existing timer
    if (batch.timer) {
        clearTimeout(batch.timer);
    }

    // Debounce: wait 2 seconds for more requests with same audioUrl
    batch.timer = setTimeout(() => {
        const mergedContext = mergeBatchContexts(batch.contexts);
        correctWithGemini(audioUrl, mergedContext);
        delete audioBatches[audioUrl];
    }, 2000);
};

const mergeBatchContexts = function(contexts) {
    if (contexts.length === 1) {
        return contexts[0];
    }

    return {
        timestamp: contexts[0].timestamp,
        frequency: contexts[0].frequency,
        source: contexts[0].source,
        draft: contexts.map(c => c.draft).join('\n\n---\n\n')
    };
};


// ── Main transcription function ───────────────────────────────────────────────
const correctWithGemini = async function () {
    try {
        console.log("🔍 Step 1: Collecting data...");

        const textarea = document.querySelector("textarea");
        if (!textarea) {
            console.error("❌ No textarea found on page");
            return;
        }

        const draftTranscript = textarea.value.trim();
        if (!draftTranscript) {
            console.warn("⚠️ Textarea is empty — nothing to transcribe");
            return;
        }

        const contextData = {
            callsigns: knownCallsigns.split(',').map(s => s.trim()),
            jargon:    specialWords.split(',').map(s => s.trim())
        };

        console.log("📥 Step 2: Sending to Gemini...");

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }]
                    },
                    contents: [{
                        parts: [{
                            text: `Draft Transcription: ${draftTranscript}\n\n` +
                                  `Context: ${JSON.stringify(contextData, null, 2)}`
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${err}`);
        }

        const data = await response.json();

        // ── Token usage & cost tracking ───────────────────────────────────
        const usage    = data.usageMetadata;
        const thinking = usage.totalTokenCount
                       - usage.promptTokenCount
                       - usage.candidatesTokenCount;

        totalSession.input    += usage.promptTokenCount;
        totalSession.output   += usage.candidatesTokenCount;
        totalSession.thinking += thinking;

        const sessionCost =
            (totalSession.input    / 1_000_000) * PRICE.input    +
            (totalSession.output   / 1_000_000) * PRICE.output   +
            (totalSession.thinking / 1_000_000) * PRICE.thinking;

        console.log(
            `[Tokens] Input: ${usage.promptTokenCount} | ` +
            `Output: ${usage.candidatesTokenCount} | ` +
                `Thinking: ${thinking}`
        );
        console.log(
            `[Session] Input: ${totalSession.input} | ` +
            `Output: ${totalSession.output} | ` +
            `Thinking: ${totalSession.thinking}`
        );
        console.log(`[Session] Cumulative cost: $${sessionCost.toFixed(6)}`);

        // ── Parse JSON response ───────────────────────────────────────────
        let rawResponse = data.candidates[0].content.parts[0].text.trim();
        rawResponse = rawResponse
            .replace(/^```(?:json)?\n?/, '')
            .replace(/\n?```$/, '');

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(rawResponse);
        } catch (parseErr) {
            console.error("❌ JSON parse failed. Raw response:", rawResponse);
            throw parseErr;
        }

        const correctedTranscript = parsedResponse.transcription || "";
        const conclusion          = parsedResponse.conclusion     || "";
        const callsigns           = parsedResponse.callsigns      || [];  // fix: array

        // ── Write to textareas ────────────────────────────────────────────
        const textareas = document.querySelectorAll("textarea");
        if (textareas[0]) setReactTextarea(textareas[0], correctedTranscript);
        if (textareas[2]) setReactTextarea(textareas[2], conclusion);

        console.log("✅ Transcription:", correctedTranscript);
        console.log("✅ Conclusion:",    conclusion);
        console.log("✅ Callsigns:",     callsigns);

    } catch (error) {
        console.error("❌ An error occurred:", error);
    }
};

let isCtrlPressed = false;
document.addEventListener('keydown',  function(e) {
    if (e.ctrlKey || e.metaKey) isCtrlPressed = true;
});
document.addEventListener('keyup',  function(e) {
    if (!e.ctrlKey && !e.metaKey) isCtrlPressed = false;
});

// ── Auto-click listener (Ctrl+click to batch-process) ────────────────────────
function setupAutoClickListener() {
    let autoClickIntervalId = null;
    let isAutoClicking = false;

    document.body.addEventListener("mousedown", (evt) => {
        // Перевіряємо, чи клік був по потрібній кнопці
        const btn = evt.target.closest(SELECTORS.transcribeBtn);
        if (!btn) return;
        if (!isCtrlPressed) return;
        if (isAutoClicking) return; // Вже виконується авто-клік

        isAutoClicking = true;
        console.log('▶️ Starting auto-click (Ctrl held)...');

        const allBtns = Array.from(
            document.querySelectorAll(SELECTORS.transcribeBtn)
        );
        const idx = allBtns.indexOf(btn);
        Const buttons = idx !== -1
            ? allBtns.slice(0, idx)
            : allBtns;
        const queue = [...buttons];

        autoClickIntervalId = setInterval(() => {
            if (!isCtrlPressed){
                clearInterval(autoClickIntervalId);
                isAutoClicking = false;
            } else {
                if (queue.length > 0) {
                    queue.pop().click();
                } else {
                    console.log('⏹️ Auto-click complete');
                    clearInterval(autoClickIntervalId);
                    isAutoClicking = false;
                }
            }
        }, 200);
    }, true);

    console.log('Auto-click listener attached to document.body');
}

setupAutoClickListener();
// ── Inject transcribe button next to textarea ─────────────────────────────────
let transcribeBtn = null;

function ensureButton() {
    const textarea = document.querySelector("textarea");
    if (!textarea || document.contains(transcribeBtn)) return;

    transcribeBtn             = document.createElement('button');
    transcribeBtn.innerHTML   = '🔊 Розпізнати';
    transcribeBtn.type        = 'button';
    transcribeBtn.style.cssText = 'margin-left:8px;cursor:pointer;';

    textarea.parentNode.insertBefore(transcribeBtn, textarea.nextSibling);
    transcribeBtn.addEventListener('click', correctWithGemini);
}

const btnObserver = new MutationObserver(ensureButton);
btnObserver.observe(document.body, { childList: true, subtree: true });
ensureButton();


(function(){
    const map = {
        'alt+с': '#root > div > main > div > div.recordsGrid__player > div > div.rhap_main.rhap_horizontal-reverse > div.rhap_controls-section > div.rhap_additional-controls > div > span:nth-child(7) > button',
        'alt+ч': '#root > div > main > div > div.recordsGrid__player > div > div.rhap_main.rhap_horizontal-reverse > div.rhap_controls-section > div.rhap_main-controls > button.rhap_button-clear.rhap_main-controls-button.rhap_play-pause-button'
    };

    document.body.addEventListener('keydown', e => {
        const k = [e.ctrlKey&&'ctrl', e.altKey&&'alt', e.shiftKey&&'shift', e.key.toLowerCase()].filter(Boolean).join('+');
        if (map[k]) {
            e.preventDefault();
            const el = document.querySelector(map[k]);
            if (el) el.click();
        }
    }, true);

    console.log('Keyboard shortcuts activated!');
})();
