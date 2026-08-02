import process from "process";

const PHOTO_CHECK_URL = process.env.PHOTO_CHECK_URL || "http://localhost:8001";

export interface PhotoCheckResult {
    passed: boolean;
    reason: string;
    count?: number;
}

export async function checkPhotoHasFace(imageBytes: Uint8Array): Promise<PhotoCheckResult> {
    const formData = new FormData();
    const blob = new Blob([imageBytes]);
    formData.append("file", blob, "upload");

    try {
        const response = await fetch(`${PHOTO_CHECK_URL}/check-photo`, {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            console.error(`Photo check service returned ${response.status}`);
            return { passed: true, reason: "service_error" }; // fail-open
        }

        const payload = (await response.json()) as Partial<PhotoCheckResult>;
        const result: PhotoCheckResult = {
            passed: payload.passed === true,
            reason: payload.reason ?? "service_error",
        };
        if (typeof payload.count === "number") {
            result.count = payload.count;
        }
        if (result.count !== undefined && result.count !== 1) {
            result.passed = false;
            result.reason = "multiple_faces";
        }
        return result;
    } catch (e) {
        console.error("Photo check service unreachable:", e);
        return { passed: true, reason: "service_unavailable" }; // fail-open
    }
}