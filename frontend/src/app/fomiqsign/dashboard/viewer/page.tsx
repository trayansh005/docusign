import ViewerClient from "./ViewerClient";

export const metadata = {
	title: "Document Viewer | FomiqSign",
	description: "View and edit document templates with signature fields.",
};

export const dynamic = "force-dynamic";

export default function ViewerPage() {
	return <ViewerClient />;
}
