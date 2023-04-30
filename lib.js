const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // A-Z
const digits = '0123456789'; // 0-9
const punct = '.,:?\'-/()"=+×@';
const lcwoLessons = 'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X';
/** @type{import("./types").Settings} */
const settings = (() => {
    try {
        return JSON.parse(localStorage.getItem('settings') || '');
    } catch (e) {
        return {
            wpm: 20,
            tone: 600,
            error_tone: 200,
            word_length: 5,
            charset: lcwoLessons,
        };
    }
})();
/** @type{import("./types").History} */
const sessionHistory = (() => {
    try {
        return JSON.parse(localStorage.getItem('history') || '');
    } catch (e) {
        return [];
    }
})();

const m = new jscw();

function pushWord() {
    const word = Array.from(
        { length: settings.word_length },
        () => settings.charset[Math.floor(Math.random() * settings.charset.length)],
    ).join('');
    m.setText(` ${word}`);
}

/** @type {string[]} */
const played = [];
let copiedText = '';
let inSession = false;
/** @type {Date} */
let sessionStart;
/** @type {number} */
let sessionDurationUpdater = 0;

/** Load the stats from the local storage
 *  @return { import("./types").Stats } - The stats
*/
function readStats() {
    const json = localStorage.getItem('stats');
    if (json) {
        const stats = JSON.parse(json);
        stats.updated = new Date(stats.updated);
        return stats;
    }
    return {
        updated: new Date(),
        elapsed: {
            lastSession: 0,
            bestSession: 0,
            currentDay: 0,
            bestDay: 0,
            total: 0,
        },
        copiedCharacters: {
            lastSession: 0,
            bestSession: 0,
            currentDay: 0,
            bestDay: 0,
            total: 0,
        },
        copiedWords: {
            lastSession: 0,
            bestSession: 0,
            currentDay: 0,
            bestDay: 0,
            total: 0,
        },
        score: {
            lastSession: 0,
            bestSession: 0,
            currentDay: 0,
            bestDay: 0,
            total: 0,
        },
    };
}

// stats
const stats = readStats();

/** @type {HTMLElement} */
let settingsElement;
/** @type {HTMLElement} */
let historyElement;
/** @type {HTMLElement} */
let feedbackElement;
/** @type {HTMLElement} */
let feedbacWrongCharacterElement;
/** @type {HTMLElement} */
let feedbackCharacterElement;
/** @type {HTMLElement} */
let feedbackCwElement;
/** @type {HTMLDialogElement} */
let statsElement;
/** @type {HTMLElement} */
let infoElement;

/** Provide a translation string for the given key
 *  @param {string} key - The translation key
 *  @return {string} - The translated string
*/
function t(key) {
    return key;
}

/** Get an HTML element by id and throw if it does not exist
 *  @template T
 *  @param {string} id - The element's id
 *  @param {new() => T} type - The type of HTML ELement
 *  @return {T} - The element
*/
function getElement(id, type) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Expected HTML element with id ${id} but none found`);
    }
    if (!(element instanceof type)) {
        throw new Error(`Expected ${type.name} with id ${id} but found ${element} instead`);
    }
    return element;
}

function setElements() {
    settingsElement = getElement('settings', HTMLElement);
    historyElement = getElement('history', HTMLElement);
    feedbackElement = getElement('feedback', HTMLElement);
    feedbacWrongCharacterElement = getElement('feedback_wrong_character', HTMLElement);
    feedbackCharacterElement = getElement('feedback_character', HTMLElement);
    feedbackCwElement = getElement('feedback_cw', HTMLElement);
    statsElement = getElement('stats', HTMLDialogElement);
    infoElement = getElement('info', HTMLElement);
}

function onSettingsChange() {
    stopSession();
    settings.wpm = parseFloat(getElement('settings-wpm', HTMLInputElement).value);
    settings.tone = parseFloat(getElement('settings-tone', HTMLInputElement).value);
    settings.error_tone = parseFloat(getElement('settings-error-tone', HTMLInputElement).value);
    settings.word_length = parseInt(getElement('settings-word-length', HTMLInputElement).value, 10);
    settings.charset = getElement('settings-charset', HTMLTextAreaElement).value;
    localStorage.setItem('settings', JSON.stringify(settings));
}

/** Update the current LCWO lesson depending on the characters in the charset
 *  @param {string} charset - The current charset
*/
function lcwoLessonFromCharset(charset) {
    const s = new Set(charset.toUpperCase());
    let i = 0;
    while (i < lcwoLessons.length) {
        const c = lcwoLessons[i];
        if (s.has(c)) {
            s.delete(c);
        } else {
            break;
        }
        i += 1;
    }
    return s.size === 0 && i > 0 ? i - 1 : 0;
}

function updateLCWOLessonFromCharset() {
    const lcwoLesson = lcwoLessonFromCharset(settings.charset);
    getElement('settings-lcwo-lesson', HTMLSelectElement).value = lcwoLesson.toString();
}

/** Returns true when the first set contains the second
 *  @template T
 *  @param {Set<T>} setA - First set
 *  @param {Set<T>} setB - Second set
 *  @return {boolean} - Whether the first set contains the second
*/
function contains(setA, setB) {
    return [...setB].every((x) => setA.has(x));
}

/** Returns true when the sets intersects
 *  @template T
 *  @param {Set<T>} setA - First set
 *  @param {Set<T>} setB - Second set
 *  @return {boolean} - Whether the sets intersect
*/
function intersects(setA, setB) {
    return [...setB].some((x) => setA.has(x));
}

/** Update the status of a toggle depending on the characters included in the charset
 *  @param {string} id - The element's id
 *  @param {string} chars - The characters represented by the toggle
*/
function updateToggleFromCharset(id, chars) {
    const toggleChars = new Set(chars);
    const selectedChars = new Set(settings.charset.toUpperCase());
    const element = getElement(id, HTMLInputElement);
    if (contains(selectedChars, toggleChars)) {
        element.checked = true;
        element.indeterminate = false;
    } else if (intersects(selectedChars, toggleChars)) {
        element.indeterminate = true;
    } else {
        element.checked = false;
        element.indeterminate = false;
    }
}

function updateTogglesFromCharset() {
    updateToggleFromCharset('settings-charset-latin', latin);
    updateToggleFromCharset('settings-charset-digits', digits);
    updateToggleFromCharset('settings-charset-punct', punct);
}

function onCustomCharsetInput() {
    onSettingsChange();
    updateLCWOLessonFromCharset();
    updateTogglesFromCharset();
}

function onLCWOLessonInput() {
    const lcwoLesson = parseInt(getElement('settings-lcwo-lesson', HTMLSelectElement).value, 10) || 0;
    if (lcwoLesson === 0) {
        return;
    }
    getElement('settings-charset', HTMLTextAreaElement).value = lcwoLessons.slice(0, lcwoLesson + 1);
    onSettingsChange();
    updateTogglesFromCharset();
}

/** Update the status of a toggle depending on the characters included in the charset
 *  @param {InputEvent} event - The event that changed the state of the toggle
 *  @param {string} chars - The characters represented by the toggle
*/
function onToggleChars(event, chars) {
    const s = new Set(chars);
    const charsetWithoutChars = [...settings.charset].filter((c) => !s.has(c.toUpperCase())).join('');
    const { target } = event;
    if (!target || !(target instanceof HTMLInputElement)) {
        throw new Error('Event does not contain the expected target');
    }
    if (target.checked) {
        settings.charset = chars + charsetWithoutChars;
    } else {
        settings.charset = charsetWithoutChars;
    }
    getElement('settings-charset', HTMLTextAreaElement).value = settings.charset;
    onSettingsChange();
    updateLCWOLessonFromCharset();
}

function restoreSettings() {
    getElement('settings-wpm', HTMLInputElement).value = settings.wpm.toString();
    getElement('settings-tone', HTMLInputElement).value = settings.tone.toString();
    getElement('settings-error-tone', HTMLInputElement).value = settings.error_tone.toString();
    getElement('settings-word-length', HTMLInputElement).value = settings.word_length.toString();
    getElement('settings-charset', HTMLTextAreaElement).value = settings.charset;
    updateLCWOLessonFromCharset();
    updateTogglesFromCharset();
}

function renderStats() {
    statsElement.innerHTML = `
    <h3>${t('Statistics')}</h3>
    <table>
        <thead>
            <tr>
                <th></th>
                <th>${t('Time')}</th>
                <th>${t('Characters')}</th>
                <th>${t('Words')}</th>
                <th>${t('Score')}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <th>${t('Last Session')}</th>
                <td>${stats.elapsed.lastSession} s</td>
                <td>${stats.copiedCharacters.lastSession}</td>
                <td>${stats.copiedWords.lastSession}</td>
                <td>${stats.score.lastSession}</td>
            </tr>
            <tr>
                <th>${t('Best Session')}</th>
                <td>${stats.elapsed.bestSession} s</td>
                <td>${stats.copiedCharacters.bestSession}</td>
                <td>${stats.copiedWords.bestSession}</td>
                <td>${stats.score.bestSession}</td>
            </tr>
            <tr>
                <th>${t('Current Day')}</th>
                <td>${stats.elapsed.currentDay} s</td>
                <td>${stats.copiedCharacters.currentDay}</td>
                <td>${stats.copiedWords.currentDay}</td>
                <td>${stats.score.currentDay}</td>
            </tr>
            <tr>
                <th>${t('Best Day')}</th>
                <td>${stats.elapsed.bestDay} s</td>
                <td>${stats.copiedCharacters.bestDay}</td>
                <td>${stats.copiedWords.bestDay}</td>
                <td>${stats.score.bestDay}</td>
            </tr>
            <tr>
                <th>${t('Total')}</th>
                <td>${stats.elapsed.total} s</td>
                <td>${stats.copiedCharacters.total}</td>
                <td>${stats.copiedWords.total}</td>
                <td>${stats.score.total}</td>
            </tr>
        </tbody>
    </table>
    `;
}

/** Format the current session
 *  @return {string} - The formated current session
*/
function formatCurrentSession() {
    let ret;
    if (inSession) {
        const started = sessionStart.toISOString();
        ret = `<span class="meta active"><time datetime="${started}">${started}</time>:</span> ${copiedText}…`;
    } else {
        ret = t('Press Return to start');
    }
    return `<li>${ret}<li>`;
}

/** Format an history entry
 *  @param {import("./types").HistoryEntry} entry - The entry to format
 *  @return {string} - The formated entry
*/
function formatHistoryEntry(entry) {
    let ret = `<span class="meta"><time datetime="${entry.started}">${entry.started}</time>:</span> ${entry.copiedText}`;
    if (entry.mistake) {
        const { expectedCharacter, mistakenCharacter } = entry.mistake;
        ret += `<span class="strike">${mistakenCharacter}</span>${expectedCharacter}`;
    }
    return `<li>${ret}<li>`;
}

function renderHistory() {
    const entries = sessionHistory.slice(-10);
    const formattedEntries = [...entries.map(formatHistoryEntry)];
    historyElement.innerHTML = formatCurrentSession() + formattedEntries.reverse().join('');
}

function renderSettings() {
    settingsElement.innerHTML = `
    <h3>${t('Settings')}</h3>
    <label for="settings-wpm">${t('Speed')}:</label>
    <input id="settings-wpm" oninput="onSettingsChange()" type="number" value="20" min="1" step="0.5" />
    <abbr title="${t('Words Per Minute')}">WPM</abbr>
    <br>
    <label for="settings-tone">${t('Tone')}:</label>
    <input id="settings-tone" oninput="onSettingsChange()" type="number" value="600" min="10" step="10" />
    Hz
    <br>
    <label for="settings-error-tone">${t('Error Tone')}:</label>
    <input id="settings-error-tone" oninput="onSettingsChange()" type="number" value="200" min="10" step="10" />
    Hz
    <br>
    <label for="settings-word-length">${t('Size of words')}:</label>
    <input id="settings-word-length" oninput="onSettingsChange()" type="number" value="5" min="1" />
    ${t('characters')})
    <br>
    <label for="settings-lcwo-lesson">${t('<a href="https://lcwo.net/" title="Learn CW Online">LCWO</A> Lesson')}:</label>
    <select id="settings-lcwo-lesson" oninput="onLCWOLessonInput()">
        <option value="0">-</option>
        <option value="1">1 - K, M</option>
        <option value="2">2 - U</option>
        <option value="3">3 - R</option>
        <option value="4">4 - E</option>
        <option value="5">5 - S</option>
        <option value="6">6 - N</option>
        <option value="7">7 - A</option>
        <option value="8">8 - P</option>
        <option value="9">9 - T</option>
        <option value="10">10 - L</option>
        <option value="11">11 - W</option>
        <option value="12">12 - I</option>
        <option value="13">13 - .</option>
        <option value="14">14 - J</option>
        <option value="15">15 - Z</option>
        <option value="16">16 - =</option>
        <option value="17">17 - F</option>
        <option value="18">18 - O</option>
        <option value="19">19 - Y</option>
        <option value="20">20 - ,</option>
        <option value="21">21 - V</option>
        <option value="22">22 - G</option>
        <option value="23">23 - 5</option>
        <option value="24">24 - /</option>
        <option value="25">25 - Q</option>
        <option value="26">26 - 9</option>
        <option value="27">27 - 2</option>
        <option value="28">28 - H</option>
        <option value="29">29 - 3</option>
        <option value="30">30 - 8</option>
        <option value="31">31 - B</option>
        <option value="32">32 - ?</option>
        <option value="33">33 - 4</option>
        <option value="34">34 - 7</option>
        <option value="35">35 - C</option>
        <option value="36">36 - 1</option>
        <option value="37">37 - D</option>
        <option value="38">38 - 6</option>
        <option value="39">39 - 0</option>
        <option value="40">40 - X</option>
    </select>
    <br>
    <label for="settings-charset">${t('Customize Charset')}:</label>
    <br>
    <textarea id="settings-charset" oninput="onCustomCharsetInput()"></textarea>
    <br>
    <input id="settings-charset-latin" type="checkbox" oninput="onToggleChars(event, latin)">
    <label for="settings-charset-latin"><code>A-Z</code></label>
    <input id="settings-charset-digits" type="checkbox" oninput="onToggleChars(event, digits)">
    <label for="settings-charset-digits"><code>0-9</Code></label>
    <input id="settings-charset-punct" type="checkbox" oninput="onToggleChars(event, punct)">
    <label for="settings-charset-punct"><code>.,:?'-/()"=+×@</code></label>
    `;
}

/** Refresh the stats as needed
 *  @param {boolean} [modified] - Where the stats recently modified?
*/
function refreshStats(modified) {
    // update day stats
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0);
    if (stats.updated < today) {
        // reset on new day
        stats.elapsed.currentDay = 0;
        stats.copiedCharacters.currentDay = 0;
        stats.copiedWords.currentDay = 0;
        stats.score.currentDay = 0;
        modified = true;
    }
    if (modified) {
        stats.updated = now;
        localStorage.setItem('stats', JSON.stringify(stats));
        if (statsElement.open) {
            renderStats();
        }
    }
}

/** Increase a stat by a given amount
 *  @param {import("./types").Stat} stat - The stat to be increased
 *  @param {number} amount - The amount by which the stat should be increased
*/
function increaseStat(stat, amount) {
    stat.total += amount;
    stat.lastSession += amount;
    stat.currentDay += amount;
    stat.bestSession = Math.max(stat.bestSession, stat.lastSession);
    stat.bestDay = Math.max(stat.bestDay, stat.currentDay);
}

/** Update the stats after a character was copied
 *  @param {string} c - The copied character
*/
function incrementCopiedCharacters(c) {
    copiedText += c;

    const now = new Date();
    const elapsedSinceStart = Math.round((now.getTime() - sessionStart.getTime()) / 1000);
    const newElapsed = elapsedSinceStart - stats.elapsed.lastSession;

    increaseStat(stats.elapsed, newElapsed);
    increaseStat(stats.copiedCharacters, 1);
    if (c === ' ') {
        increaseStat(stats.copiedWords, 1);
    }
    increaseStat(stats.score, stats.copiedWords.lastSession + 1);

    refreshStats(true);
}

function onFinished() {
    pushWord();
    m.play();
}

function startSession() {
    pushWord();
    played.length = 0;
    copiedText = '';
    inSession = true;
    sessionStart = new Date();
    sessionDurationUpdater = setInterval(refreshStats, 1000);
    stats.elapsed.lastSession = 0;
    stats.copiedCharacters.lastSession = 0;
    stats.copiedWords.lastSession = 0;
    stats.score.lastSession = 0;
    m.setWpm(settings.wpm);
    m.setEff(settings.wpm);
    m.setFreq(settings.tone);
    m.onFinished = onFinished;
    m.play();
    feedbackElement.classList.add('success');
    feedbackElement.classList.remove('failure');
    feedbacWrongCharacterElement.innerText = '';
    feedbackCharacterElement.innerText = '';
    feedbackCwElement.innerText = '';
    infoElement.innerText = '';
    feedbackElement.focus();
    renderStats();
    renderHistory();
}

/** End the current session
 *  @param {string} [expected] - The expected character (if any)
 *  @param {string} [userInput] - What the user copied (if any)
*/
function stopSession(expected, userInput) {
    if (!inSession) {
        return;
    }

    const session = {
        id: crypto.randomUUID(),
        started: sessionStart.toISOString(),
        finished: new Date().toISOString(),
        copiedText,
        mistake: !expected ? null : {
            expectedCharacter: expected,
            mistakenCharacter: userInput,
        },
        settings,
        elapsed: stats.elapsed.lastSession,
        copiedCharacters: stats.copiedCharacters.lastSession,
        copiedWords: stats.copiedWords.lastSession,
        score: stats.score.lastSession,
    };
    sessionHistory.push(session);
    // NOTE: in the following scenario, the session from tab B will be lost
    // - open in tab A
    // - open in tab B
    // - play session in tab B
    // - play session in tab A
    localStorage.setItem('history', JSON.stringify(sessionHistory));

    inSession = false;
    m.onFinished = undefined;
    renderStats();
    clearInterval(sessionDurationUpdater);
    sessionDurationUpdater = 0;
    m.stop();
    renderHistory();
}

/** Play a buzzer and then replay the correct character
 *  @param {string} [c] - The expected character (if any)
*/
function replayAfterMistake(c) {
    m.onFinished = () => {
        m.onFinished = undefined;
        m.setFreq(settings.tone);
        if (c !== undefined) {
            m.play(` ${c}`);
        }
    };
    m.setFreq(settings.error_tone);
    m.play('T');
}

/** Format a character for display
 *  @param {string | undefined} c - The character to format
 *  @return {string} - The formatted character
*/
function formatCharacter(c) {
    if (c === undefined) {
        return '-';
    } else if (c === ' ') {
        return 'Space';
    } else {
        return c;
    }
}

/** Interrupt a session due to an user error
 *  @param {string} [expected] - The expected character (if any)
 *  @param {string} [userInput] - What the user copied (if any)
*/
function fail(expected, userInput) {
    stopSession(expected, userInput);
    replayAfterMistake(expected);
    feedbackElement.classList.remove('success');
    feedbackElement.classList.add('failure');
    feedbacWrongCharacterElement.innerText = formatCharacter(userInput);
}

document.addEventListener('keydown', (event) => {
    const userInput = event.key.toLowerCase();

    // disable Firefox's quick search when pressing forward slash
    if (userInput === '/') {
        event.preventDefault();
    }

    // hitting space starts the keying
    if (!inSession && userInput === 'enter') {
        startSession();
    }

    // ignore other inputs when not in session
    if (!inSession) {
        return;
    }

    // stop space from scrolling the page while in session
    if (userInput === ' ') {
        event.preventDefault();
    }

    // stop when user hits Escape key
    if (userInput === 'escape') {
        stopSession();
    }

    // ignore non-copy user inputs (not in the charset, and not a space)
    if (userInput !== ' ' && settings.charset.toLowerCase().indexOf(userInput) === -1) {
        return;
    }

    // played[nextIndex] is undefined if nextIndex >= played.length
    const expected = played[stats.copiedCharacters.lastSession]?.toLowerCase();
    if (userInput === expected) {
        // correct
        incrementCopiedCharacters(expected);
        renderHistory();
    } else {
        // incorrect
        fail(expected, userInput);
    }

    feedbackCharacterElement.innerText = formatCharacter(expected);
    feedbackCwElement.innerText = m.alphabet[expected] || '';
});

/** Event handler for when a character has been fully played
 *  @param {{c: string}} c - The character played
*/
m.onCharacterPlay = (c) => {
    if (!inSession) {
        return;
    }

    // skip leading space
    if (played.length === 0 && c.c === ' ') {
        return;
    }

    // add character
    played.push(c.c);

    // detect when user has stopped copying
    if (played.length - copiedText.length > 3) {
        fail();
        infoElement.innerText = t('Too slow!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setElements();
    refreshStats();
    feedbackElement.addEventListener('blur', () => {
        if (inSession) {
            infoElement.innerText = t('Focus lost!');
            stopSession();
        }
    });
    renderSettings();
    renderStats();
    renderHistory();
    restoreSettings();
});
