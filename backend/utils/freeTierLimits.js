// Small helper to centralize free-tier limits. Defaults allow 1 upload and 1 signed doc.
export function getFreeTierLimits() {
	const uploadLimit = Number(process.env.FREE_MAX_UPLOADS ?? 1);
	const signedLimit = Number(process.env.FREE_MAX_SIGNED ?? 1);
	return {
		uploadLimit: Number.isFinite(uploadLimit) && uploadLimit >= 0 ? uploadLimit : 1,
		signedLimit: Number.isFinite(signedLimit) && signedLimit >= 0 ? signedLimit : 1,
	};
}
