import { codeToApiLang } from "./langMap";
import { env } from "@xenova/transformers";
env.allowLocalModels = false;

let onnxWorker: Worker | null = null;
function getOnnxWorker(): Worker {
    if (!onnxWorker) {
        onnxWorker = new Worker(new URL("./onnxWorker.ts", import.meta.url), {
            type: "module",
        });
    }
    return onnxWorker;
}

export interface OnnxTranslationCallbacks {
    onModelLoadingEvent?: (data: {
        status: string;
        file?: string;
        progress?: number;
        name?: string;
        loaded?: number;
        total?: number;
    }) => void;
    onModelReady?: () => void;
    onTranslationUpdate?: (output: string) => void;
    onTranslationComplete?: (output: any) => void;
    onError?: (error: any) => void;
}

export async function onnxTranslateWithCallbacks(
    text: string,
    src_lang: string,
    tgt_lang: string,
    callbacks: OnnxTranslationCallbacks
): Promise<void> {
    try {
        const worker = getOnnxWorker();
        worker.onmessage = (event: MessageEvent) => {
            const data = event.data;
            switch (data.status) {
                case "model_loading":
                case "initiate":
                case "progress":
                case "done":
                    callbacks.onModelLoadingEvent?.(data);
                    break;
                case "update":
                    callbacks.onTranslationUpdate?.(data.output);
                    break;
                case "complete":
                    callbacks.onTranslationComplete?.(data.output);
                    break;
            }
        };
        worker.onerror = (err) => {
            callbacks.onError?.(err);
        };
        // Notify model ready after first load (handled in onnxWorker if needed)
        callbacks.onModelReady?.();
        // Post translation request
        worker.postMessage({ text, src_lang, tgt_lang });
    } catch (error) {
        console.error("ONNX Translation error in utility:", error);
        callbacks.onError?.(error);
    }
}

export const llmTranslate = async (
    text: string,
    sourceLang: string,
    targetLang: string
): Promise<string> => {
    if (!text.trim()) return "";
    const apiSource = codeToApiLang[sourceLang] || sourceLang;
    const apiTarget = codeToApiLang[targetLang] || targetLang;
    try {
        const response = await fetch(
            `https://cfai.golafoned.workers.dev/?text=${encodeURIComponent(
                text
            )}&source_lang=${encodeURIComponent(
                apiSource
            )}&target_lang=${encodeURIComponent(apiTarget)}`,
            {
                method: "GET",
            }
        );
        if (!response.ok) {
            return `API error: ${response.statusText}`;
        }
        const data = await response.json();
        return (
            data.translated_text ||
            data.result ||
            data.translation ||
            JSON.stringify(data)
        );
    } catch (error) {
        console.error("LLM Translation error:", error);
        return "Error during translation.";
    }
};
