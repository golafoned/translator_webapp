import { codeToApiLang } from "./langMap";
// import external from
import { pipeline, env, type PipelineType } from "@xenova/transformers";
env.allowLocalModels = false;
// Helper: get ort from window (with type safety)
declare global {
    interface Window {
        ort?: any;
    }
}

class MyTranslationPipeline {
    static task = "translation";
    static model = "Xenova/nllb-200-distilled-600M";
    static instance: Promise<any> | null = null;

    static async getInstance(
        progress_callback: ((progress: any) => void) | null = null
    ) {
        if (this.instance === null) {
            this.instance = pipeline(this.task as PipelineType, this.model, {
                progress_callback: progress_callback ?? undefined,
            });
        }

        return this.instance;
    }
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
    onTranslationComplete?: (output: any) => void; // output can be the full translation object
    onError?: (error: any) => void;
}

export async function onnxTranslateWithCallbacks(
    text: string,
    src_lang: string,
    tgt_lang: string,
    callbacks: OnnxTranslationCallbacks
): Promise<void> {
    try {
        const translator = await MyTranslationPipeline.getInstance(
            (progressData) => {
                if (callbacks.onModelLoadingEvent) {
                    callbacks.onModelLoadingEvent(progressData);
                }
            }
        );

        if (callbacks.onModelReady) {
            callbacks.onModelReady();
        }

        const output = await translator(text, {
            tgt_lang: tgt_lang,
            src_lang: src_lang,
            callback_function: (x: any) => {
                if (callbacks.onTranslationUpdate) {
                    const partialOutput = translator.tokenizer.decode(
                        x[0].output_token_ids,
                        {
                            skip_special_tokens: true,
                        }
                    );
                    callbacks.onTranslationUpdate(partialOutput);
                }
            },
        });

        if (callbacks.onTranslationComplete) {
            callbacks.onTranslationComplete(output);
        }
    } catch (error) {
        console.error("ONNX Translation error in utility:", error);
        if (callbacks.onError) {
            callbacks.onError(error);
        }
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
