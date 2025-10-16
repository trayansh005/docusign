import { Suspense } from "react";
import SignDocumentClient from "./SignDocumentClient";

export const metadata = {
	title: "Sign Document | FomiqSign",
	description: "Review and sign your document",
};

export default function SignDocumentPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SignDocumentClient />
		</Suspense>
	);
}
