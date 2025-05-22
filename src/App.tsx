import { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import LanguageSelector from "./components/LanguageSelector";
import Progress from "./components/Progress";
import useDebounce from "./hooks/useDebounce";
import { onnxTranslateWithCallbacks, llmTranslate } from "./utils/translation";
import { getInitialTheme } from "./utils/theme";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sun,
    Moon,
    Settings2,
    Languages,
    TerminalSquare,
    ArrowRightLeft,
    Loader2,
    Info,
} from "lucide-react";

const topLanguages = [
    { code: "uk", name: "Ukrainian", flag: "🇺🇦", onnxCode: "ukr_Cyrl" },
    { code: "en", name: "English", flag: "🇬🇧", onnxCode: "eng_Latn" },
    { code: "es", name: "Spanish", flag: "🇪🇸", onnxCode: "spa_Latn" },
    { code: "fr", name: "French", flag: "🇫🇷", onnxCode: "fra_Latn" },
    { code: "de", name: "German", flag: "🇩🇪", onnxCode: "deu_Latn" },
    { code: "zh", name: "Chinese", flag: "🇨🇳", onnxCode: "zho_Hans" },
    { code: "ja", name: "Japanese", flag: "🇯🇵", onnxCode: "jpn_Jpan" },
    { code: "ko", name: "Korean", flag: "🇰🇷", onnxCode: "kor_Hang" },
    { code: "it", name: "Italian", flag: "🇮🇹", onnxCode: "ita_Latn" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹", onnxCode: "por_Latn" },
];

const App = () => {
    const [theme, setTheme] = useState(getInitialTheme);
    const [translationMode, setTranslationMode] = useState("onnx");
    const [inputText, setInputText] = useState("");
    const [outputText, setOutputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sourceLang, setSourceLang] = useState("en");
    const [targetLang, setTargetLang] = useState("uk");
    const [showSettings, setShowSettings] = useState(false);
    const [onnxInfoMessage, setOnnxInfoMessage] = useState("");
    const [debounceDelay, setDebounceDelay] = useState(750);
    const [onnxReady, setOnnxReady] = useState<null | boolean>(null);
    const [onnxProgressItems, setOnnxProgressItems] = useState<any[]>([]);
    const [onnxDisabled, setOnnxDisabled] = useState(false);
    const [showOnnxLoadingIndicator, setShowOnnxLoadingIndicator] =
        useState(false);
    const onnxLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setDebounceDelay(translationMode === "llm" ? 2000 : 750);
    }, [translationMode]);

    const debouncedInputText = useDebounce(inputText, debounceDelay);

    // Effect to manage ONNX loading indicator visibility
    useEffect(() => {
        if (onnxLoadingTimerRef.current) {
            clearTimeout(onnxLoadingTimerRef.current);
            onnxLoadingTimerRef.current = null;
        }

        if (translationMode === "onnx" && onnxReady === false) {
            onnxLoadingTimerRef.current = setTimeout(() => {
                setShowOnnxLoadingIndicator(true);
            }, 5000);
        } else {
            setShowOnnxLoadingIndicator(false);
        }

        return () => {
            if (onnxLoadingTimerRef.current) {
                clearTimeout(onnxLoadingTimerRef.current);
            }
        };
    }, [translationMode, onnxReady]);

    // Apply theme when component mounts and when theme changes
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);

        // Store theme preference in localStorage
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Listen for system theme preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = (e: MediaQueryListEvent) => {
            // Only set theme based on system preference if no theme is stored in localStorage
            if (!localStorage.getItem("theme")) {
                setTheme(e.matches ? "dark" : "light");
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const toggleTheme = () => {
        setTheme((prevTheme) => {
            const newTheme = prevTheme === "light" ? "dark" : "light";
            localStorage.setItem("theme", newTheme); // Update localStorage when toggling
            return newTheme;
        });
    };

    const handleTranslate = useCallback(
        async (textToTranslate: string) => {
            if (!textToTranslate.trim()) {
                setOutputText("");
                return;
            }
            setIsLoading(true);
            setOutputText(""); // Clear previous output

            try {
                if (translationMode === "onnx") {
                    setOnnxDisabled(true);
                    const src =
                        topLanguages.find((l) => l.code === sourceLang)
                            ?.onnxCode || "ukr_Cyrl";
                    const tgt =
                        topLanguages.find((l) => l.code === targetLang)
                            ?.onnxCode || "eng_Latn";
                    await onnxTranslateWithCallbacks(
                        textToTranslate,
                        src,
                        tgt,
                        {
                            onModelLoadingEvent: (data) => {
                                console.log("[App] Model loading event:", data);
                                switch (data.status) {
                                    case "initiate":
                                        setOnnxReady(false);
                                        setOnnxProgressItems((prev) => [
                                            ...prev,
                                            data,
                                        ]);
                                        break;
                                    case "progress":
                                        setOnnxProgressItems((prev) =>
                                            prev.map((item) =>
                                                item.file === data.file
                                                    ? {
                                                          ...item,
                                                          progress:
                                                              data.progress,
                                                      }
                                                    : item
                                            )
                                        );
                                        break;
                                    case "done":
                                        setOnnxProgressItems((prev) =>
                                            prev.filter(
                                                (item) =>
                                                    item.file !== data.file
                                            )
                                        );
                                        break;
                                }
                            },
                            onModelReady: () => {
                                console.log("[App] ONNX Model ready");
                                setOnnxReady(true);
                            },
                            onTranslationUpdate: (partialOutput) => {
                                console.log(
                                    "[App] Translation update:",
                                    partialOutput
                                );
                                setOutputText(partialOutput);
                                setIsLoading(false); // Show updates as they come
                            },
                            onTranslationComplete: (finalOutput) => {
                                console.log(
                                    "[App] Translation complete:",
                                    finalOutput
                                );
                                const translatedText =
                                    Array.isArray(finalOutput) &&
                                    finalOutput.length > 0
                                        ? finalOutput[0].translation_text
                                        : JSON.stringify(finalOutput);
                                setOutputText(translatedText);
                                setOnnxDisabled(false);
                                setIsLoading(false);
                            },
                            onError: (error) => {
                                console.error(
                                    "[App] ONNX Translation error:",
                                    error
                                );
                                setOutputText("Error during ONNX translation.");
                                setOnnxDisabled(false);
                                setIsLoading(false);
                                setOnnxReady(null); // Reset ready state on error
                            },
                        }
                    );
                } else {
                    let result: string = "";
                    if (sourceLang === targetLang) {
                        result =
                            "Source and target languages cannot be the same for LLM translation.";
                    } else {
                        result = await llmTranslate(
                            textToTranslate,
                            sourceLang,
                            targetLang
                        );
                    }
                    setOutputText(result);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Translation error in handleTranslate:", error);
                setOutputText("Error during translation.");
                setIsLoading(false);
                if (translationMode === "onnx") {
                    setOnnxDisabled(false);
                }
            }
        },
        [translationMode, sourceLang, targetLang]
    );

    useEffect(() => {
        if (debouncedInputText) {
            handleTranslate(debouncedInputText);
        } else {
            setOutputText("");
        }
    }, [debouncedInputText, handleTranslate]);

    const handleSwapLanguages = () => {
        if (sourceLang === targetLang) {
            setOnnxInfoMessage(
                "Source and target languages cannot be the same."
            );
            return;
        }
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setInputText(outputText);
        setOutputText(inputText);
        if (outputText.trim()) {
            handleTranslate(outputText);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--app-bg-color)] text-[var(--app-text-color)] transition-colors duration-300 flex flex-col items-center p-2 sm:p-4 font-sans">
            <header className="w-full max-w-4xl mb-4 sm:mb-6 flex justify-between items-center px-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                    TranslateCoursework
                </h1>
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-full hover:bg-[var(--icon-hover-bg-color)] transition-colors text-[var(--icon-color)]"
                        aria-label="Settings"
                    >
                        <Settings2 size={22} />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-[var(--icon-hover-bg-color)] transition-colors text-[var(--icon-color)]"
                        aria-label="Toggle Theme"
                    >
                        {theme === "light" ? (
                            <Moon size={22} />
                        ) : (
                            <Sun size={22} />
                        )}
                    </button>
                </div>
            </header>

            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowSettings(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[var(--card-bg-color)] p-6 rounded-xl shadow-2xl w-full max-w-md text-[var(--card-text-color)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold">
                                    Settings
                                </h2>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-6 h-6"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm text-[var(--subtle-text-color)]">
                                    Translation Mode:
                                </p>
                                <div className="flex space-x-2">
                                    {["onnx", "llm"].map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => {
                                                setTranslationMode(mode);
                                                setInputText("");
                                                setOutputText("");
                                                setOnnxInfoMessage("");
                                            }}
                                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                        ${
                            translationMode === mode
                                ? "bg-blue-500 text-white shadow-md focus:ring-blue-400"
                                : "bg-[var(--button-bg-color)] hover:bg-[var(--button-hover-bg-color)] focus:ring-gray-400 text-[var(--button-text-color)]"
                        }`}
                                        >
                                            {mode === "onnx"
                                                ? "Local ONNX"
                                                : "LLM API"}
                                        </button>
                                    ))}
                                </div>
                                {translationMode === "onnx" && (
                                    <div className="mt-2 p-3 bg-[var(--info-blue-bg-color)] border border-[var(--info-blue-border-color)] rounded-lg text-sm text-[var(--info-blue-text-color)] flex items-center">
                                        <TerminalSquare
                                            size={18}
                                            className="inline mr-2 flex-shrink-0"
                                        />
                                        <span>
                                            🔏ONNX Mode: Translate locally using
                                            ONNX models. No internet required.
                                            Full privacy.
                                        </span>
                                    </div>
                                )}
                                {translationMode === "llm" && (
                                    <div className="mt-2 p-3 bg-[var(--info-green-bg-color)] border border-[var(--info-green-border-color)] rounded-lg text-sm text-[var(--info-green-text-color)] flex items-center">
                                        <Languages
                                            size={18}
                                            className="inline mr-2 flex-shrink-0"
                                        />
                                        <span>
                                            🧠LLM Mode: Translate using a
                                            cloud-based large language model.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {translationMode === "onnx" &&
                showOnnxLoadingIndicator &&
                onnxReady === false && (
                    <div className="progress-bars-container mb-4 w-full max-w-md px-2">
                        {" "}
                        <label className="block text-center text-sm text-[var(--subtle-text-color)] mb-2">
                            Loading models... (this happens once)
                        </label>
                        {onnxProgressItems.map((data) => (
                            <div
                                key={data.file}
                                className="flex items-center gap-3 mb-1"
                            >
                                {" "}
                                {/* Added key and mb-1 */}
                                <span className="flex-1 truncate font-mono text-xs sm:text-sm text-[var(--subtle-text-color)]">
                                    {data.file}
                                </span>
                                <span className="w-14 text-right font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm tabular-nums">
                                    {(data.progress ?? 0).toFixed(2)}%
                                </span>
                                <div className="w-32 sm:w-48">
                                    <Progress percentage={data.progress ?? 0} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            <main className="w-full max-w-4xl flex-1 flex flex-col bg-[var(--card-bg-color)] p-4 sm:p-6 rounded-xl shadow-xl">
                <div className="mb-1 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={translationMode}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 sm:space-x-3"
                        >
                            <>
                                <LanguageSelector
                                    selectedLang={sourceLang}
                                    onChange={(langCode: string) => {
                                        setSourceLang(langCode);
                                        if (langCode === targetLang)
                                            setTargetLang(
                                                topLanguages.find(
                                                    (l) => l.code !== langCode
                                                )?.code || ""
                                            );
                                    }}
                                    languages={topLanguages}
                                    defaultLabel="Source"
                                    disabled={false}
                                />
                                <button
                                    onClick={handleSwapLanguages}
                                    className="p-2.5 rounded-lg hover:bg-[var(--icon-hover-bg-color)] transition-colors group"
                                    aria-label="Swap languages"
                                >
                                    <ArrowRightLeft
                                        size={20}
                                        className="text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors"
                                    />
                                </button>
                                <LanguageSelector
                                    selectedLang={targetLang}
                                    onChange={setTargetLang}
                                    languages={topLanguages.filter(
                                        (l) => l.code !== sourceLang
                                    )}
                                    defaultLabel="Target"
                                    disabled={false}
                                />
                            </>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {onnxInfoMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="mb-3 p-2.5 bg-yellow-100 dark:bg-yellow-700/50 border border-yellow-300 dark:border-yellow-600 rounded-lg text-sm text-yellow-700 dark:text-yellow-200 flex items-center justify-center text-center"
                        >
                            <Info size={16} className="mr-2 flex-shrink-0" />
                            {onnxInfoMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Text Areas: Input and Output */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-1">
                    {/* Input Area */}
                    <div className="flex flex-col">
                        <label
                            htmlFor="inputText"
                            className="mb-1.5 text-sm font-medium text-[var(--subtle-text-color)]"
                        >
                            {topLanguages.find((l) => l.code === sourceLang)
                                ?.name || "Source Text"}
                        </label>
                        <textarea
                            id="inputText"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={`Enter text in ${
                                topLanguages.find((l) => l.code === sourceLang)
                                    ?.name || "source language"
                            }...`}
                            className="flex-1 w-full p-3 sm:p-4 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--input-bg-color)] text-[var(--input-text-color)] transition-shadow resize-none text-base"
                            disabled={
                                translationMode === "onnx" && onnxDisabled
                            }
                        />
                    </div>
                    {/* Output Area */}
                    <div className="flex flex-col">
                        <div className="flex justify-between items-center mb-1.5">
                            <label
                                htmlFor="outputText"
                                className="text-sm font-medium text-[var(--subtle-text-color)]"
                            >
                                {topLanguages.find((l) => l.code === targetLang)
                                    ?.name || "Translated Text"}
                            </label>
                            {isLoading && (
                                <Loader2
                                    size={18}
                                    className="animate-spin text-blue-500 dark:text-blue-400"
                                />
                            )}
                        </div>
                        <div
                            id="outputText"
                            className="flex-1 w-full p-3 sm:p-4 border border-[var(--border-color)] bg-[var(--output-bg-color)] rounded-lg overflow-y-auto min-h-[100px] sm:min-h-[150px] text-base"
                        >
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={outputText || "placeholder"}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.2 }}
                                    className={`whitespace-pre-wrap ${
                                        !outputText && !isLoading
                                            ? "text-[var(--input-placeholder-color)]"
                                            : "text-[var(--input-text-color)]"
                                    }`}
                                >
                                    {isLoading && !outputText
                                        ? "Translating..."
                                        : outputText ||
                                          "Translation will appear here."}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="w-full max-w-4xl mt-6 sm:mt-8 text-center text-xs sm:text-sm text-[var(--subtle-text-color)] px-2">
                <p>
                    &copy; {new Date().getFullYear()} All rights reserved by
                    Demian Dutka🤓
                </p>
            </footer>
        </div>
    );
};

export default App;
