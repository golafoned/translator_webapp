// src/utils/onnxWorker.ts
import { pipeline, env, type PipelineType } from "@xenova/transformers";
env.allowLocalModels = false;
class MyTranslationPipeline {
    static task: PipelineType = "translation";
    static model = "Xenova/nllb-200-distilled-600M";
    static instance: Promise<any> | null = null;

    static async getInstance(
        progress_callback: ((progress: any) => void) | null = null
    ): Promise<any> {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                progress_callback: progress_callback ?? undefined,
            });
        }
        return this.instance;
    }
}

self.addEventListener("message", async (event: MessageEvent) => {
    const { text, src_lang, tgt_lang } = event.data;
    let translator: any = await MyTranslationPipeline.getInstance(
        (progress: any) => {
            // Always send all fields for progress events
            const base = {
                file: progress.file ?? "",
                progress: progress.progress ?? 0,
                loaded: progress.loaded ?? 0,
                total: progress.total ?? 0,
                name: progress.name ?? "",
            };
            if (progress.status === "initiate") {
                console.log("[onnxWorker] INITIATE:", base);
                self.postMessage({ status: "initiate", ...base });
            } else if (progress.status === "progress") {
                self.postMessage({ status: "progress", ...base });
            } else if (progress.status === "done") {
                self.postMessage({ status: "done", ...base });
            } else {
                self.postMessage({ status: "model_loading", ...progress });
            }
        }
    );
    if (!translator) {
        self.postMessage({ status: "error", error: "Translator not loaded" });
        return;
    }
    let output = await translator(text, {
        tgt_lang,
        src_lang,
        callback_function: (x: any) => {
            self.postMessage({
                status: "update",
                output: translator.tokenizer.decode(x[0].output_token_ids, {
                    skip_special_tokens: true,
                }),
            });
        },
    });
    self.postMessage({ status: "complete", output });
});
