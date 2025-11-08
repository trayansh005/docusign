export interface PaginationData {
	current: number;
	limit: number;
	total: number;
	pages: number;
	hasNext?: boolean;
	hasPrev?: boolean;
}

export interface RecipientData {
	id: string;
	name: string;
	email: string;
	userId?: string;
	signatureStatus: "pending" | "signed" | "declined" | "waiting";
	signingOrder: number;
	signedAt?: string;
	notifiedAt?: string;
	eligibleAt?: string;
}

export interface DocuSignTemplateData {
	_id: string;
	name: string;
	type: "signature" | "document" | "form";
	status: "draft" | "active" | "final" | "archived" | "processing" | "failed";
	pdfUrl: string;
	finalPdfUrl?: string;
	numPages: number;
	signatureFields: SignatureField[];
	recipients: RecipientData[];
	metadata: TemplateMetadata;
	createdAt: string;
	updatedAt: string;
	createdBy?: {
		_id: string;
		firstName: string;
		lastName: string;
		email: string;
	};
}

export type FieldType =
	| "signature"
	| "date"
	| "initial"
	| "text"
	| "name"
	| "email"
	| "phone"
	| "address";

export interface SignatureField {
	id: string;
	type: FieldType;
	xPct: number;
	yPct: number;
	wPct: number;
	hPct: number;
	pageNumber: number;
	value?: string;
	fontId?: string;
	isPlainText?: boolean;
	recipientId?: string;
	recipientName?: string; // Display name of recipient for this field
	required?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	placeholder?: boolean;
	placeholderText?: string;
}

export interface TemplateMetadata {
	fileId: string;
	filename: string;
	fileHash: string;
	mimeType: string;
	fileSize: number;
	document?: string; // ObjectId reference to DocuSignDocument
	originalPdfPath: string;
	thumbnailUrl?: string; // PNG thumbnail of first page
	// If the original upload was a Word document, backend may set these
	originalWordFile?: string;
	convertedFromWord?: boolean;
	pageWidth?: number;
	pageHeight?: number;
}

export interface AuditEntry {
	action: "created" | "updated" | "signed" | "viewed" | "sent" | "completed";
	userId: string;
	timestamp: string;
	details: string;
	ipAddress?: string;
	location?: {
		country: string;
		city: string;
		region: string;
	};
}

export interface ActivityData {
	_id: string;
	user: {
		_id: string;
		firstName: string;
		lastName: string;
		email: string;
	};
	type: string;
	message: string;
	details?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface PaginationData {
	current: number;
	pages: number;
	total: number;
	limit: number;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
	pagination?: PaginationData;
}

export interface SignatureData {
	id: string;
	pageNumber: number;
	recipientId: string;
	type: "signature" | "date" | "initial" | "text";
	signatureImageBuffer?: Buffer;
	image?: string;
	dataUrl?: string;
	dataURL?: string;
	fontId?: string;
}

export interface ViewportData {
	[key: string]: {
		width: number;
		height: number;
	};
}

export interface RecipientRole {
	id: string;
	name: string;
	email: string;
	role: "signer" | "viewer" | "approver";
}

export interface SigningEvent {
	timestamp: string;
	ipAddress: string;
	location: {
		country: string;
		city: string;
		region: string;
	};
	details: string;
	userId: string;
}

export interface StatusHistoryData {
	templateId: string;
	currentStatus: string;
	docusignStatus?: string;
	recipients: RecipientRole[];
	auditTrail: AuditEntry[];
}

export interface SignatureTrackingData {
	templateId: string;
	templateName: string;
	signingEvents: SigningEvent[];
	totalSigningEvents: number;
}
