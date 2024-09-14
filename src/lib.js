const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // A-Z
const digits = '0123456789'; // 0-9
const punct = '.,:?\'-/()"=+×@';
const lcwoLessons = 'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X';
const HTML_TEMPLATE = getElement('template', HTMLElement).innerText;

/** @type {IDBDatabase | null} */
let db = null;
/** @param {() => void} callback */
function prepareDB(callback) {
    const request = indexedDB.open("morse.cat", 2);
    request.onerror = () => {
        alert("Failed to open IndexedDB; histroy won't be saved");
    }
    request.onupgradeneeded = (event) => {
        const db = request.result;
        if (event.oldVersion == 0) {
            const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
            sessionsStore.createIndex('started', 'started');
            db.createObjectStore('characters', { keyPath: 'id' });
        }
        if (event.oldVersion <= 1) {
            // @ts-ignore
            const transaction = event.target.transaction;
            const objectStore = transaction.objectStore('sessions');
            const request2 = objectStore.getAll();
            request2.onsuccess = () => {
                for (const session of request2.result) {
                    session.copiedGroups = session.copiedWords;
                    delete session["copiedWords"];
                    objectStore.put(session);
                }
            }
        }
    };
    request.onsuccess = () => {
        db = request.result;
        callback();
    }
}

/**
 * @param {import("./types").HistoryEntry} session
*/
function saveSession(session) {
    if (!db) {
        return;
    }
    const transaction = db.transaction(['sessions'], 'readwrite');
    const objectStore = transaction.objectStore('sessions');
    objectStore.add(session);
}

/**
 * @param {import("./types").TransmittedCharacter} character
*/
function saveCharacter(character) {
    if (!db) {
        return;
    }
    const transaction = db.transaction(['characters'], 'readwrite');
    const objectStore = transaction.objectStore('characters');
    if (!character.id) {
        character.id = crypto.randomUUID();
    }
    objectStore.add(character);
}

/**
 * @param {number} count
 * @param {(sessions: import("./types").HistoryEntry[]) => void} callback
*/
function getLastSessions(count, callback) {
    if (!db) {
        return;
    }
    // IndexedBD must be a joke
    const transaction = db.transaction('sessions');
    const objectStore = transaction.objectStore('sessions');
    const index = objectStore.index('started');
    const request = index.openCursor(null, 'prev');
    /** @type{import("./types").HistoryEntry[]} */
    const sessions = [];
    request.onsuccess = () => {
        const result = request.result;
        if (result) {
            sessions.push(result.value);
        }
        if (result && sessions.length < count) {
            result.continue();
        } else {
            sessions.reverse();
            callback(sessions);
        }
    }
}

/** @type{import("./types").Settings} */
const settings = (() => {
    try {
        const settings = JSON.parse(localStorage.getItem('settings') || '');
        // migrations
        if (settings.hasOwnProperty("word_length")) {
            settings.min_group_size = settings.word_length;
            settings.max_group_size = settings.word_length;
            delete settings["word_length"];
        }
        if (!settings.hasOwnProperty("session_debounce_time")) {
            settings.session_debounce_time = 1;
        }
        if (settings.hasOwnProperty("min_word_length")) {
            settings.min_group_size = settings.min_word_length;
            delete settings["min_word_length"];
        }
        if (settings.hasOwnProperty("max_word_length")) {
            settings.max_group_size = settings.max_word_length;
            delete settings["max_word_length"];
        }
        return settings;
    } catch (e) {
        return {
            wpm: 20,
            tone: 600,
            error_tone: 200,
            min_group_size: 5,
            max_group_size: 5,
            charset: lcwoLessons,
            session_debounce_time: 1,
        };
    }
})();

// @ts-ignore
const cwPlayer = new jscw();
cwPlayer.q = 13;

function pushGroup() {
    const groupLength = randint(settings.min_group_size, settings.max_group_size);
    const group = Array.from(
        { length: groupLength },
        () => settings.charset[Math.floor(Math.random() * settings.charset.length)],
    ).join('');
    cwPlayer.setText(` ${group}`);
}

/** @type {import("./types").SentCharacter[]} */
const played = [];
let copiedText = '';
let inSession = false;
let sessionId = '';
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
        copiedGroups: {
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

const translations = {
    en: {
        languageName: 'English',
        pageTitle: 'Sharpen your claws and learn Morse code!',
        description: 'Practice Morse code with instant feedback to guide your learning. If you\'re familiar with <a href="https://lcwo.net/">LCWO</a>,, you\'ll find this tool a fun and helpful way to keep building your skills.',
        'history.started': 'Start time',
        'history.copiedText': 'Copied Text',
        'history.elapsed': 'Duration',
        'history.characters': 'Characters',
        'history.groups': 'Groups',
        'history.score': 'Score',
        'stats.title': 'Statistics',
        'stats.elapsed': 'Time',
        'stats.copiedCharacters': 'Characters',
        'stats.copiedGroups': 'Groups',
        'stats.score': 'Score',
        'stats.lastSession': 'Last Session',
        'stats.bestSession': 'Best Session',
        'stats.currentDay': 'Today',
        'stats.bestDay': 'Best Day',
        'stats.total': 'Total',
        'start': 'Start',
        'settings.title': 'Settings',
        'settings.speed.title': 'Speed',
        'settings.speed.unit': 'WPM',
        'settings.speed.details': 'Words Per Minute',
        'settings.tone.title': 'Tone',
        'settings.tone.unit': 'Hz',
        'settings.tone.details': 'Hertz',
        'settings.errorTone.title': 'Error Tone',
        'settings.errorTone.unit': 'Hz',
        'settings.errorTone.details': 'Hertz',
        'settings.minGroupSize.title': 'Min. Group Size',
        'settings.maxGroupSize.title': 'Max. Group Size',
        'settings.groupSize.unit': 'chars.',
        'settings.groupSize.details': 'characters',
        'settings.lcwo.title': '<a href="https://lcwo.net/" title="Learn CW Online">LCWO</A> Lesson',
        'settings.charset.title': 'Customize Charset',
        'settings.sessionDebounceTime.title': 'Post-Session Cooldown',
        'settings.sessionDebounceTime.unit': 's.',
        'settings.sessionDebounceTime.details': 'seconds',
        'settings.export': 'Export Data',
        'settings.import': 'Import Data',
        'settings.delete': 'Delete Data',
        'settings.delete.warning': 'Are you sure you want to delete all data? You will lose your practice history, as well as the statistics.',
        'settings.delete.cancel': 'Close',
        'acknowledgements.title': 'Acknowledgements',
        'acknowledgements.mit-license': 'MIT License',
        'acknowledgements.cc0-license': 'CC0 License',
        'acknowledgements.cc-by-license': 'CC-BY License',
        'acknowledgements.jscwlib': 'JavaScript library for Morse Code',
        'acknowledgements.cat-icon': 'Cat icon',
        'info.tooSlow': 'Too slow!',
        'info.lostFocus': 'Focus lost!',
    },
    fr: {
        languageName: 'French',
        pageTitle: 'Aiguisez vos griffes et apprenez le code Morse !',
        description: 'Entraînez-vous au code Morse avec un feedback immédiat pour vous aider à progresser. Si vous connaissez déjà <a href="https://lcwo.net/">LCWO</a>, vous trouverez cet outil amusant et pratique pour continuer à améliorer vos compétences.',
        'history.started': 'Heure de début',
        'history.copiedText': 'Texte copié',
        'history.elapsed': 'Durée',
        'history.characters': 'Caractères',
        'history.groups': 'Groupes',
        'history.score': 'Score',
        'stats.title': 'Statistiques',
        'stats.elapsed': 'Temps',
        'stats.copiedCharacters': 'Caractères',
        'stats.copiedGroups': 'Groupes',
        'stats.score': 'Score',
        'stats.lastSession': 'Dernière Session',
        'stats.bestSession': 'Meilleure Session',
        'stats.currentDay': "Aujourd'hui",
        'stats.bestDay': 'Meilleur jour',
        'stats.total': 'Total',
        'start': 'Démarrer',
        'settings.title': 'Paramètres',
        'settings.speed.title': 'Vitesse',
        'settings.speed.unit': 'MPM',
        'settings.speed.details': 'Mots Par Minute',
        'settings.tone.title': 'Ton',
        'settings.tone.unit': 'Hz',
        'settings.tone.details': 'Hertz',
        'settings.errorTone.title': "Ton d'erreur",
        'settings.errorTone.unit': 'Hz',
        'settings.errorTone.details': 'Hertz',
        'settings.minGroupSize.title': 'Taille min. des groupes',
        'settings.maxGroupSize.title': 'Taille max. des groupes',
        'settings.groupSize.unit': 'car.',
        'settings.groupSize.details': 'caractères',
        'settings.lcwo.title': 'Leçon <a href="https://lcwo.net/" title="Learn CW Online">LCWO</A>',
        'settings.charset.title': 'Choisir les caractères',
        'settings.sessionDebounceTime.title': 'Délai après session',
        'settings.sessionDebounceTime.unit': 's.',
        'settings.sessionDebounceTime.details': 'secondes',
        'settings.export': 'Exporter les données',
        'settings.import': 'Importer les données',
        'settings.delete': 'Supprimer les données',
        'settings.delete.warning': 'Êtes-vous sûr de vouloir supprimer toutes les données ? Vous perdrez votre historique de pratique ainsi que les statistiques.',
        'settings.delete.cancel': 'Fermer',
        'acknowledgements.title': 'Remerciements',
        'acknowledgements.mit-license': 'Licence MIT',
        'acknowledgements.cc0-license': 'Licence CC0',
        'acknowledgements.cc-by-license': 'Licence CC-BY',
        'acknowledgements.jscwlib': 'Bibliothèque JavaScript pour le code Morse',
        'acknowledgements.cat-icon': 'Icône de chat',
        'info.tooSlow': 'Trop lent !',
        'info.lostFocus': 'Focus perdu !',
    },
    ja: {
        languageName: '日本語',
        pageTitle: '爪とぎしてモールス信号を学びましょう！',
        description: 'モールス符号の練習をしながら、即時フィードバックで学習をサポートします。<a href="https://lcwo.net/">LCWO</a>を知っているなら、このツールは楽しく役立つ方法でスキルを伸ばすのにぴったりです。',
        'history.started': '開始時間',
        'history.copiedText': 'コピーしたテキスト',
        'history.elapsed': '期間',
        'history.characters': '文字',
        'history.groups': 'グループ',
        'history.score': 'スコア',
        'stats.title': '統計',
        'stats.elapsed': '時間',
        'stats.copiedCharacters': '文字数',
        'stats.copiedGroups': 'グループ',
        'stats.score': 'スコア',
        'stats.lastSession': '前セッション',
        'stats.bestSession': 'ベストセッション',
        'stats.currentDay': '今日',
        'stats.bestDay': 'ベスト日',
        'stats.total': '総数',
        'start': '開始する',
        'settings.title': '設定',
        'settings.speed.title': '速度',
        'settings.speed.unit': 'WPM',
        'settings.speed.details': '一分ずつ語数 (Words Per Minute)',
        'settings.tone.title': 'トーン',
        'settings.tone.unit': 'Hz',
        'settings.tone.details': 'ヘルツ',
        'settings.errorTone.title': 'エラートーン',
        'settings.errorTone.unit': 'Hz',
        'settings.errorTone.details': 'ヘルツ',
        'settings.minGroupSize.title': 'グループの最小サイズ',
        'settings.maxGroupSize.title': 'グループの最大サイズ',
        'settings.groupSize.unit': '字',
        'settings.groupSize.details': '言葉ずつの文字数',
        'settings.lcwo.title': '<a href="https://lcwo.net/" title="Learn CW Online">LCWO</A> レッスン',
        'settings.charset.title': '文字セット',
        'settings.sessionDebounceTime.title': 'セッション後のクールダウン',
        'settings.sessionDebounceTime.unit': '秒',
        'settings.sessionDebounceTime.details': '秒',
        'settings.export': 'データをエクスポートする',
        'settings.import': 'データをエクスポートする',
        'settings.delete': 'データを削除する',
        'settings.delete.warning': 'すべてのデータを削除してもよろしいですか？ 練習履歴および統計情報が失われます。',
        'settings.delete.cancel': '閉じる',
        'acknowledgements.title': '謝辞',
        'acknowledgements.mit-license': 'MIT ライセンス',
        'acknowledgements.cc0-license': 'CC0 ライセンス',
        'acknowledgements.cc-by-license': 'CC-BY ライセンス',
        'acknowledgements.jscwlib': 'モールス信号用JavaScriptライブラリ',
        'acknowledgements.cat-icon': '猫アイコン',
        'info.tooSlow': '遅すぎます！',
        'info.lostFocus': 'フォーカスが外れました！',
    },
    es: {
        languageName: 'Español',
        pageTitle: '¡Afilen sus garras y aprendan el código Morse!',
        description: 'Practica código Morse con retroalimentación instantánea para guiar tu aprendizaje. Si ya conoces <a href="https://lcwo.net/">LCWO</a>, encontrarás que esta herramienta es divertida y útil para seguir mejorando tus habilidades.',
        'history.started': 'Hora de inicio',
        'history.copiedText': 'Texto copiado',
        'history.elapsed': 'Duración',
        'history.characters': 'Caracteres',
        'history.groups': 'Grupos',
        'history.score': 'Puntuación',
        'stats.title': 'Estadísticas',
        'stats.elapsed': 'Tiempo',
        'stats.copiedCharacters': 'Caracteres',
        'stats.copiedGroups': 'Grupos',
        'stats.score': 'Puntuación',
        'stats.lastSession': 'Sesión anterior',
        'stats.bestSession': 'Mejor sesión',
        'stats.currentDay': 'Hoy',
        'stats.bestDay': 'Mejor día',
        'stats.total': 'Total',
        'start': 'Iniciar',
        'settings.title': 'Configuración',
        'settings.speed.title': 'Velocidad',
        'settings.speed.unit': 'PPM',
        'settings.speed.details': 'Palabras Per Minuto',
        'settings.tone.title': 'Tono',
        'settings.tone.unit': 'Hz',
        'settings.tone.details': 'Hertz',
        'settings.errorTone.title': 'Tono de error',
        'settings.errorTone.unit': 'Hz',
        'settings.errorTone.details': 'Hertz',
        'settings.minGroupSize.title': 'Tamaño mín. de los grupos',
        'settings.maxGroupSize.title': 'Tamaño máx. de los grupos',
        'settings.groupSize.unit': 'car.',
        'settings.groupSize.details': 'caracteres',
        'settings.lcwo.title': 'Leccíon <a href="https://lcwo.net/" title="Learn CW Online">LCWO</A>',
        'settings.charset.title': 'Seleccionar los caracteres',
        'settings.sessionDebounceTime.title': 'Enfriamiento post-sesión',
        'settings.sessionDebounceTime.unit': 's.',
        'settings.sessionDebounceTime.details': 'segundos',
        'settings.export': 'Exportar los datos',
        'settings.import': 'Exportar los datos',
        'settings.delete': 'Eliminar los datos',
        'settings.delete.warning': '¿Estás seguro de que deseas eliminar todos los datos? Perderás tu historial de práctica, así como las estadísticas.',
        'settings.delete.cancel': 'Cerrar',
        'acknowledgements.title': 'Agradecimientos',
        'acknowledgements.mit-license': 'Licencia MIT',
        'acknowledgements.cc0-license': 'Licencia CC0',
        'acknowledgements.cc-by-license': 'Licencia CC-BY',
        'acknowledgements.jscwlib': 'Biblioteca JavaScript para código Morse',
        'acknowledgements.cat-icon': 'Ícono de gato',
        'info.tooSlow': '¡Demasiado lento!',
        'info.lostFocus': '¡Se perdió el foco!',
    },
    ca: {
        languageName: 'Català',
        pageTitle: 'Esmola les urpes i aprèn codi Morse!',
        description: 'Practica codi Morse amb comentaris instantanis per guiar el teu aprenentatge. Si ja coneixes <a href="https://lcwo.net/">LCWO</a>, trobaràs que aquesta eina és divertida i útil per seguir millorant les teves habilitats.',
        'history.started': 'Hora d\'inici',
        'history.copiedText': 'Text copiat',
        'history.elapsed': 'Durada',
        'history.characters': 'Caràcters',
        'history.groups': 'Grups',
        'history.score': 'Puntuació',
        'stats.title': 'Estadístiques',
        'stats.elapsed': 'Temps',
        'stats.copiedCharacters': 'Caràcters',
        'stats.copiedGroups': 'Grups',
        'stats.score': 'Puntuació',
        'stats.lastSession': 'Sessió anterior',
        'stats.bestSession': 'Millor sesió',
        'stats.currentDay': 'Avui',
        'stats.bestDay': 'Millor dia',
        'stats.total': 'Total',
        'start': 'Iniciar',
        'settings.title': 'Configuració',
        'settings.speed.title': 'Velocitat',
        'settings.speed.unit': 'PPM',
        'settings.speed.details': 'Paraules Per Minut',
        'settings.tone.title': 'To',
        'settings.tone.unit': 'Hz',
        'settings.tone.details': 'Hertz',
        'settings.errorTone.title': "To d'error",
        'settings.errorTone.unit': 'Hz',
        'settings.errorTone.details': 'Hertz',
        'settings.minGroupSize.title': 'Mida mín. dels grups',
        'settings.maxGroupSize.title': 'Mida màx. dels grups',
        'settings.groupSize.unit': 'car.',
        'settings.groupSize.details': 'caràcters',
        'settings.lcwo.title': 'Lliçó <a href="https://lcwo.net/" title="Learn CW Online">LCWO</A>',
        'settings.charset.title': 'Seleccionar els caràcters',
        'settings.sessionDebounceTime.title': 'Refredament post-sessió',
        'settings.sessionDebounceTime.unit': 's.',
        'settings.sessionDebounceTime.details': 'segons',
        'settings.export': 'Exportar les dades',
        'settings.import': 'Exportar les dades',
        'settings.delete': 'Eliminar les dades',
        'settings.delete.warning': 'Estàs segur que vols eliminar totes les dades? Perdràs l\'historial de pràctica i també les estadístiques.',
        'settings.delete.cancel': 'Tancar',
        'acknowledgements.title': 'Agraïments',
        'acknowledgements.mit-license': 'Llicència MIT',
        'acknowledgements.cc0-license': 'Llicència CC0',
        'acknowledgements.cc-by-license': 'Llicència CC-BY',
        'acknowledgements.jscwlib': 'Biblioteca JavaScript per al codi Morse',
        'acknowledgements.cat-icon': 'Icona de gat',
        'info.tooSlow': 'Massa lent!',
        'info.lostFocus': "S'ha perdut el focus!",
    },
};

/** @type {keyof typeof translations} */
let activeLanguage = 'en';

/**
 * @param {number} min
 * @param {number} max
 * @return {number}
*/
function randrange(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * @param {number} min
 * @param {number} max
 * @return {number}
*/
function randint(min, max) {
    return randrange(min, max + 1);
}

/** Provide a translation string for the given key
 *  @param {keyof typeof translations.en} key - The translation key
 *  @return {string} - The translated string
*/
function t(key) {
    const translated = translations[activeLanguage][key];
    if (translated) {
        return translated;
    } else {
        return key;
    }
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

function onSettingsChange() {
    // eslint-disable-next-line no-use-before-define
    stopSession();
    settings.wpm = parseFloat(getElement('settings-wpm', HTMLInputElement).value);
    settings.tone = parseFloat(getElement('settings-tone', HTMLInputElement).value);
    settings.error_tone = parseFloat(getElement('settings-error-tone', HTMLInputElement).value);
    settings.min_group_size = parseInt(getElement('settings-group-length-min', HTMLInputElement).value, 10);
    settings.max_group_size = parseInt(getElement('settings-group-length-max', HTMLInputElement).value, 10);
    settings.charset = getElement('settings-charset', HTMLTextAreaElement).value;
    settings.session_debounce_time = parseFloat(getElement('settings-session-debounce-time', HTMLInputElement).value);
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
        if (c !== undefined && s.has(c)) {
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
    getElement('settings-group-length-min', HTMLInputElement).value = settings.min_group_size.toString();
    getElement('settings-group-length-max', HTMLInputElement).value = settings.max_group_size.toString();
    getElement('settings-session-debounce-time', HTMLInputElement).value = settings.session_debounce_time.toString();
    getElement('settings-charset', HTMLTextAreaElement).value = settings.charset;
    updateLCWOLessonFromCharset();
    updateTogglesFromCharset();
}

/** Format an history entry
 *  @param {import("./types").HistoryEntry} entry - The entry to format
 *  @return {string} - The formatted entry
*/
function formatHistoryEntry(entry) {
    let mistake = '';
    if (entry.mistake) {
        const { expectedCharacter, mistakenCharacter } = entry.mistake;
        // make sure the expected character is visible even when it is a space
        const visibleExpectedCharacter = expectedCharacter === ' ' ? '⎵' : expectedCharacter;
        mistake = `<span class="strike">${mistakenCharacter}</span>${visibleExpectedCharacter}`;
    }
    return `
    <tr>
        <td><time datetime="${entry.started}">${entry.started}</time></td>
        <td class="font-monospace text-uppercase">${entry.copiedText}${mistake}</td>
        <td class="text-end">${entry.elapsed} s</td>
        <td class="text-end">${entry.copiedCharacters}</td>
        <td class="text-end">${entry.copiedGroups}</td>
        <td class="text-end">${entry.score}</td>
    </tr>`;
}


/** Type assertion that lang is a language key
 *  @param {any} lang - The candidate language key
 *  @return {keyof typeof translations | null} lang - The language key or null
*/
function asLanguage(lang) {
    if (lang && translations.hasOwnProperty(lang)) {
        return lang;
    } else {
        return null;
    }
}

/** Detect the preferred language of the user
 *  @return {keyof typeof translations} lang - The preferred language
*/
function getPreferredLanguage() {
    /** @type {keyof typeof translations | null} */
    let lang = null;
    lang ||= asLanguage(new URL(document.location.href).searchParams.get('lang'));
    lang ||= asLanguage(localStorage.getItem('language'));
    lang ||= asLanguage(navigator.language.slice(0, 2));
    lang ||= 'en';
    return lang;
}

/** Set the language of the page
 *  @param {keyof typeof translations} lang - The selected language
*/
function setLanguage(lang) {
    document.documentElement.lang = lang;
    activeLanguage = lang;
    document.title = 'Morse Cat - ' + t('pageTitle');
    localStorage.setItem('language', lang);
    render();
}

/**
 *  @param {string} template
 *  @param {{[key: string]: any;}} vars
 *  @return {string}
*/
function evaluateTemplate(template, vars) {
    const f = new Function(...Object.keys(vars), 'return `' + template + '`');
    return f(...Object.values(vars))
}

function render() {
    getLastSessions(10, (sessions) => {
        getElement('root', HTMLDivElement).innerHTML = evaluateTemplate(HTML_TEMPLATE, {
            lang: activeLanguage,
            history: [...sessions.map(formatHistoryEntry)].reverse().join(''),
        });
        restoreSettings();
        getElement('language-select', HTMLSelectElement).value = activeLanguage;
        getElement('current-session', HTMLTextAreaElement).value = copiedText;

        const startButton = getElement('start-button', HTMLButtonElement);
        startButton.disabled = true;
        setTimeout(function() {
            startButton.disabled = false;
            startButton.focus();
        }, settings.session_debounce_time * 1000);
    });
}

/** Refresh the stats as needed
 *  @param {boolean} [modified] - Where the stats recently modified?
*/
function refreshStatistics(modified) {
    // migration
    if (stats.hasOwnProperty("copiedWords")) {
        // @ts-ignore
        stats.copiedGroups = stats.copiedWords;
        // @ts-ignore
        delete stats["copiedWords"];
    }
    // update day stats
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0);
    if (stats.updated < today) {
        // reset on new day
        stats.elapsed.currentDay = 0;
        stats.copiedCharacters.currentDay = 0;
        stats.copiedGroups.currentDay = 0;
        stats.score.currentDay = 0;
        modified = true;
    }
    if (modified) {
        stats.updated = now;
        localStorage.setItem('stats', JSON.stringify(stats));
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

/** Compute the duration of a character with the current settings
 *  @param {string} c - The character
 *  @param {number} [wpm] - Length of a dot in seconds
 *  @return {number} - Duration of the character, in seconds
*/
function characterDuration(c, wpm) {
    if (cwPlayer.alphabet === undefined) {
        throw new Error('characterDuration called before JSCWlib initialized');
    }
    const dotlen = wpm ? 60 / (wpm * 50) : cwPlayer.dotlen;
    let time = 0;
    const elements = cwPlayer.alphabet[c] || " ";
    for (const element of elements) {
        // add duration of dots or dits
        // NOTE: to make things slightly more regular in some cases, a space
        // will count as a regular character of length 1 dit; when adding the
        // previous and next inter-character gap, this totals a gap of 7 dits,
        // which is the actual duration of the inter-group gap
        const dits = element == "-" ? 3 : 1;
        time += dotlen * dits;
    }
    // add duration of inter-element gaps
    time += dotlen * (elements.length - 1);
    return time;
}

/** Update the stats after a character was copied
 *  @param {import("./types").SentCharacter} sent - The copied character
*/
function incrementCopiedCharacters(sent) {
    copiedText += sent.character;
    getElement('current-session', HTMLTextAreaElement).value = copiedText;

    const now = new Date();
    const elapsedSinceStart = Math.round((now.getTime() - sessionStart.getTime()) / 1000);
    const newElapsed = elapsedSinceStart - stats.elapsed.lastSession;

    const received = {
        time: now.toISOString(),
        character: sent.character,
    };

    saveCharacter({
        sessionId,
        result: "Correct",
        sent,
        received,
    });

    increaseStat(stats.elapsed, newElapsed);
    increaseStat(stats.copiedCharacters, 1);
    if (sent.character === ' ') {
        increaseStat(stats.copiedGroups, 1);
    }
    increaseStat(stats.score, stats.copiedGroups.lastSession + 1);

    refreshStatistics(true);
}

function onFinished() {
    pushGroup();
    cwPlayer.play();
}

function startSession() {
    const now = new Date();

    if (Array.from(settings.charset).filter((c) => c.trim() !== '').length === 0) {
        getElement('info', HTMLElement).innerText = 'Empty charset!';
        return;
    }
    pushGroup();
    played.length = 0;
    copiedText = '';
    getElement('current-session', HTMLTextAreaElement).value = copiedText;
    inSession = true;
    sessionId = crypto.randomUUID(),
    sessionStart = now;
    sessionDurationUpdater = setInterval(refreshStatistics, 1000);
    stats.elapsed.lastSession = 0;
    stats.copiedCharacters.lastSession = 0;
    stats.copiedGroups.lastSession = 0;
    stats.score.lastSession = 0;
    cwPlayer.setWpm(settings.wpm);
    cwPlayer.setEff(settings.wpm);
    cwPlayer.setFreq(settings.tone);
    cwPlayer.onFinished = onFinished;
    cwPlayer.play();
    getElement('info', HTMLElement).innerText = '';
    getElement('current-session', HTMLTextAreaElement).focus();
}

/** End the current session
 *  @param {import("./types").SentCharacter} [sent] - The character initially sent (if any)
 *  @param {string} [userInput] - What the user copied (if any)
*/
function stopSession(sent, userInput) {
    if (!inSession) {
        return;
    }

    const now = new Date();

    let lastReceivedIndex = stats.copiedCharacters.lastSession;
    if (userInput) {
        // save incorrectly received character
        const received = {
            time: now.toISOString(),
            character: userInput,
        };
        if (sent) {
            // should always be "Incorrect", but just in case
            const result = sent.character === received.character ? "Correct" : "Incorrect";
            saveCharacter({ sessionId, result, sent, received });
        } else {
            saveCharacter({ sessionId, result: "Extraneous", received });
        }
        lastReceivedIndex += 1;
    }
    // save characters that were sent but not received at all
    for (const sent of played.slice(lastReceivedIndex)) {
        saveCharacter({ sessionId, result: "Pending", sent })
    }

    cwPlayer.stop();
    inSession = false;
    cwPlayer.onFinished = undefined;
    clearInterval(sessionDurationUpdater);
    sessionDurationUpdater = 0;

    saveSession({
        id: sessionId,
        started: sessionStart.toISOString(),
        finished: now.toISOString(),
        copiedText,
        mistake: !sent || !userInput ? null : {
            expectedCharacter: sent.character,
            mistakenCharacter: userInput,
        },
        settings,
        elapsed: stats.elapsed.lastSession,
        copiedCharacters: stats.copiedCharacters.lastSession,
        copiedGroups: stats.copiedGroups.lastSession,
        score: stats.score.lastSession,
    });

    render();
}

/** Play a buzzer and then replay the correct character
 *  @param {string} [c] - The expected character (if any)
*/
function replayAfterMistake(c) {
    cwPlayer.onFinished = () => {
        cwPlayer.onFinished = undefined;
        cwPlayer.setFreq(settings.tone);
        if (c !== undefined) {
            cwPlayer.play(` ${c}`);
        }
    };
    cwPlayer.setFreq(settings.error_tone);
    cwPlayer.play('T');
}

/** Interrupt a session due to an user error
 *  @param {import("./types").SentCharacter} [sent] - The expected character (if any)
 *  @param {string} [userInput] - What the user copied (if any)
*/
function fail(sent, userInput) {
    stopSession(sent, userInput);
    replayAfterMistake(sent?.character);
}

/**
 *  @param {KeyboardEvent} event
*/
function onKeyDown(event) {
    const userInput = event.key.toLowerCase();

    // ignore inputs when not in session
    if (!inSession) {
        return;
    }

    // ignore modified keys, except Shift and AltGraph, that can be used to compose characters
    if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }

    // stop space from scrolling the page while in session, tab for losing the focus, etc.
    event.preventDefault();

    // stop when user hits Escape key
    if (userInput === 'escape') {
        stopSession();
    }

    // ignore non-copy user inputs (not in the charset, and not a space)
    if (userInput !== ' ' && settings.charset.toLowerCase().indexOf(userInput) === -1) {
        return;
    }

    // played[nextIndex] is undefined if nextIndex >= played.length
    const sent = played[stats.copiedCharacters.lastSession];
    const expected = sent?.character.toLowerCase();
    if (sent && userInput === expected) {
        // correct
        incrementCopiedCharacters(sent);
    } else {
        // incorrect
        // play sound, replay character, and end session
        fail(sent, userInput);
    }
}

/** Event handler for when a character has been fully played
 *  @param {{c: string}} c - The character played
*/
cwPlayer.onCharacterPlay = (c) => {
    if (!inSession) {
        return;
    }

    // skip leading space
    if (played.length === 0 && c.c === ' ') {
        return;
    }

    // add character
    played.push({
        time: new Date().toISOString(),
        character: c.c,
        duration: characterDuration(c.c),
    });

    // detect when user has stopped copying
    if (played.length - copiedText.length > 5) {
        fail();
        getElement('info', HTMLElement).innerText = t('info.tooSlow');
    }
};

// inspired from https://stackoverflow.com/a/48968694/4457767
/** Let the user save some data as a file
 *  @param {Blob} data
 *  @param {string} filename
*/
function saveFile(data, filename) {
    // @ts-ignore
    if (window.navigator.msSaveOrOpenBlob) {
        // Chrome-only
        // @ts-ignore
        window.navigator.msSaveOrOpenBlob(data, filename);
        return;
    }
    // generic
    const a = document.createElement('a');
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(data);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 0)
}

function exportData() {
    if (!db) {
        return;
    }
    const transaction = db.transaction(['sessions', 'characters']);
    /** @type {import("./types").HistoryEntry[] | null} */
    let sessions = null;
    /** @type {import("./types").TransmittedCharacter[] | null} */
    let characters = null;
    function exportAsJsonWhenReady() {
        if (!sessions || !characters) {
            return;
        }
        const data = JSON.stringify({sessions, characters});
        saveFile(new Blob([data]), "morse-cat-data.json");
    }
    {
        const objectStore = transaction.objectStore('sessions');
        const request = objectStore.getAll();
        request.onsuccess = () => { sessions = request.result; exportAsJsonWhenReady(); };
    }
    {
        const objectStore = transaction.objectStore('characters');
        const request = objectStore.getAll();
        request.onsuccess = () => { characters = request.result; exportAsJsonWhenReady(); };
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.oninput = function(event) {
        /** @type {HTMLInputElement | null} */
        // @ts-ignore
        const element = event.target;
        const file = element?.files?.[0];
        if (!file) {
            return;
        }
        if (file.type != "application/json") {
            // TODO
            console.error("no!");
            return;
        }
        file.text().then(function (data){
            if (!db) {
                return;
            }
            const j = JSON.parse(data);
            const transaction = db.transaction(['sessions', 'characters'], 'readwrite');
            {
                const objectStore = transaction.objectStore('sessions');
                for (const session of j['sessions']) {
                    objectStore.put(session);
                }
            }
            {
                const objectStore = transaction.objectStore('characters');
                for (const character of j['characters']) {
                    objectStore.put(character);
                }
            }
            transaction.oncomplete = function() {
                document.location.reload();
            };
        })
    }
    input.click();
}

function deleteData() {
    indexedDB.deleteDatabase('morse.cat');
    document.location.reload();
}

function onCurrentSessionBlur() {
    if (inSession) {
        getElement('info', HTMLElement).innerText = t('info.lostFocus');
        stopSession();
    }
}

function main() {
    cwPlayer.onLampOff = () => getElement('nose', SVGElement).style.fill = '#E75A70';
    cwPlayer.onLampOn = () => getElement('nose', SVGElement).style.fill = 'yellow';
    refreshStatistics();
    setLanguage(getPreferredLanguage());
}

let domReady = false;
let dbReady = false;
document.addEventListener('DOMContentLoaded', () => {
    if (dbReady) {
        main();
    } else {
        domReady = true;
    }
});
prepareDB(() => {
    if (domReady) {
        main();
    } else {
        dbReady = true;
    }
});
