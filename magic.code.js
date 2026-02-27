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

const transcribeAndCorrectAudio = (async function() {
    const apiKey = window.GEMINI_API_KEY || prompt("Enter your Gemini API Key:");
    window.GEMINI_API_KEY = apiKey;

    const model = 'gemini-2.5-pro';

    const knownCallsigns = "АБРАМ, АГЛАР, АЛИТРИС, АЛИТРИШ, АРБУЗ, АРТИСТ, АРЧИ, АХМАТ, АХМЕД, АХРЫЗ, БАГАБ, БАЙКАЛ, БАРАЖ, БАРАШ, БАТЫР, БАЧА, БЕТОН, БЛЭК, БОГ, БОГА, БОД, БОДУН, БОЛЬШОЙ, БОРЗЫЙ, БОРОС, БОТ, БОЧА, БРАКОНЬЕР, БУБА, БУЛАЙ, БУРАН, ВАГА, ВИКТОР, ВИХРЬ, ВИШНЯ, ВОЛГА, ВОЛНА, ВОРОБЕЙ, ГНЕЗДО, ГНОМ, ГОВЕР, ГОД, ГОНЧАР, ГОРА, ГОФЕР, ГОША, ГРИБ, ГРОМ, ГРОМКИЙ, ГРУЗИН, ГУФИК, ДЕНЧИК, ДЖАНГО, ДИНА, ДОБРЫЙ, ДОВЖИК, ДОЗОР, ДОРОГОЙ, ДРУИД, ДУТЫЙ, ДЫНЯ, ДЭНЧИК, ЕЖИК, ЕФИМ, ЖАРА, ЖЕКА, ЖИВЧИК, ЖУЖИК, ЖУЛИК, ЗАРЯ, ЗЕМА, ЗОРЯ, ИРКУТ, ИРТЫШ, ИСАУЛ, КАБАН, КАВКАЗ, КАЗАХ, КАЗБЕК, КАЛДОН, КАЛУЗИН, КАМЫШ, КАРА, КАСКАД, КАСПЕР, КАССИР, КАСТЕТ, КБ, КЕША, КИЛЯ, КИРГИЗ, КЛИМ, КОБА, КОЗАХ, КОКА, КОЛДОН, КОЛДУН, КОНЬ, КОЩЕЙ, КРЕСТ, КРЕСТИК, КРУЗ, КРЫМ, КУВАЛДА, КУЗЯ, КУЛАГА, КУЧЕР, ЛАБУС, ЛАСТИК, ЛЕГЕЗИД, ЛЕГО, ЛЕМУР, ЛИМОН, ЛИМУР, ЛИС, ЛИСТИК, ЛОБА, ЛУЧИК, ЛЫСЫЙ, ЛЮТЫЙ, МАЖОР, МАЛАЙ, МАЛОЙ, МАЛЫШ, МАМАЙ, МАМОНТ, МАРАТ, МАЯК, МЕДВЕДЬ, МЕЛОМАН, МЕХАН, МИКРОФОН, МИХАЛЫЧ, МИТРОФАН, МИХЕЙ, МОНГОЛ, МОРГАН, МОРДОР, МОРЯК, МОСКВА, МОТОРИСТ, МРАК, МУЗЫКАНТ, МУРАТ, НЕГР, НЕМЕЦ, НОСИ, ОКУНЬ, ОЛИМП, ОРЕЛ, ОСИП, ОТЕЦ, ПАК, ПРОФИ, ПРЯНИК, ПСИХ, ПУХ, ПЧЕЛА, РАТ, РАТНИК, РЕКВИЗИТ, РОН, РУС, РЫЖИЙ, САПУН, САТЕН, САФОН, СВЕТЛЫЙ, СВЯТОЙ, СЕЛИКУТА, СЕМЬ, СЕНА, СИМ СИМ, СКИВА, СМАЙЛ, СНЕГ, СОВА, СОКОЛ, СОЛОМА, СОРОКА, СОТЕН, СПАРТАК, СТАВРИК, СТАРЫЙ, СТРЕЛЕЦ, СУЕТА, СУЛТАН, СУМАТОХА, СУМРАК, СЫРКА, ТАЛАЛАЙ, ТАМЕРЛАН, ТАНЦОР, ТАТАРИН, ТОЛСТЫЙ, ТОМАС, ТОПОЛЬ, ТТ, ТУВА, ТУВИК, ТУЗИК, ТУМАН, ТУРИК, УРАЙ, УСИК, УФА, ФАРА, ФАРТОВЫЙ, ФЕНИКС, ФИЛДОН, ФИЛИН, ФИЛЯ, ФИН, ФМН, ФОКУСНИК, ХАЛЯВА, ХАН, ХАЧИК, ХИМИК, ХОДОК, ХОРА, ХРОМОЙ, ХУДРУК, ЦЕПУН, ЧАВА, ЧАУС, ЧЕВА, ЧЕЛА, ЧЕЛДОН, ЧЕРНОМОР, ЧЕХ, ЧИКА, ЧИНГИЗ, ЧОВА, ЧУБА, ЧУГУН, ЧУДАК, ЧУДО, ЧУЛА, ЧУЛДОН, ШАИАН, ШАМАН, ШАТЕН, ШЕГОЛ, ШЕЛДОН, ШИРКА, ШИФЕР, ШКАЛИК, ШМЕЛЬ, ШУГУР, ШУМИХА, ЩЕГОЛ, ЭЛЬДАР, ЯКУТ, ЯРЫЙ, ЯСЫРКА";
    const specialWords = "циркулярно,Костлявая,Старя,не прошло,повтори,180,200,300,350";

    const draftTranscript = document.querySelector("textarea").value.trim();

    console.log("🔍 Step 1: Finding audio sources...");
    const urls = Array.from(document.querySelectorAll('audio'))
        .map(audio => audio.src || (audio.querySelector('source[src]')?.src || null))
        .filter(src => src !== null);

    if (urls.length === 0) return console.error("❌ No audio sources found.");

    console.log(`📥 Step 2: Fetching ${urls.length} audio files in parallel...`);

    try {
        const filePromises = urls.map(async (url) => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => resolve({
                    inline_data: {
                        mime_type: blob.type || 'audio/mp3',
                        data: reader.result.split(',')[1]
                    }
                });
                reader.onerror = reject;
            });
        });

        const audioParts = await Promise.all(filePromises);
        console.log("🚀 Step 3: Sending single batch request to Gemini...");

        const systemInstruction = `You are a military radio intercept transcriber.

TASK:
1. Correct errors in the draft transcript using audio content
2. Output ONLY corrected dialogue in original format
3. Add brief ASSESSMENT in format: "Оцінка: [one sentence max]"
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

Respond in Ukrainian. Audio quality is poor.
`;

        const contextData = {
            callsigns: knownCallsigns.split(','),
            jargon: specialWords.split(',')
        };

        const promptPart = {
            text: `Draft Transcript:
${draftTranscript}

Reference Data:
${JSON.stringify(contextData, null, 2)}`
        };

        const contentsParts = [promptPart, ...audioParts];

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                },
                contents: [{ parts: contentsParts }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("❌ Gemini API Error:", data.error.message);
        } else {
            let rawResponse = data.candidates[0].content.parts[0].text.trim();

            // 🔧 FIX: Strip markdown code block formatting
            rawResponse = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

            // Parse JSON response
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(rawResponse);
            } catch (e) {
                console.error("❌ Failed to parse JSON response:", rawResponse);
                return;
            }

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
        }

    } catch (error) {
        console.error("❌ An error occurred:", error);
    }
});

let transcribeBtn = null;

function ensureButton() {
    const textarea = document.querySelector("textarea");
    if (!textarea || document.contains(transcribeBtn)) return;

    transcribeBtn = document.createElement('button');
    transcribeBtn.innerHTML = '🔊 Розпізнати';
    transcribeBtn.type = 'button';
    transcribeBtn.style.marginLeft = '8px';

    textarea.parentNode.insertBefore(transcribeBtn, textarea.nextSibling);
    transcribeBtn.addEventListener('click', transcribeAndCorrectAudio);
}

const observer = new MutationObserver(ensureButton);
observer.observe(document.body, { childList: true, subtree: true });

ensureButton();
