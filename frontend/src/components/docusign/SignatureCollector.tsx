"use client";

import React, { useState } from "react";
import { PenTool, CheckCircle, User, Calendar, Type, FileSignature } from "lucide-react";
import { SignaturePad } from "./SignaturePad";
import { SignatureField, SignatureData } from "@/types/docusign";

interface SignatureCollectorProps {
	fields: SignatureField[];
	recipients: Array<{ id: string; name: string; email?: string }>;
	onSignaturesComplete: (signatures: SignatureData[]) => void;
	className?: string;
}

interface CollectedSignature {
	fieldId: string;
	recipientId: string;
	data: string;
	type: "signature" | "date" | "initial" | "text";
	pageNumber: number;
}

export const SignatureCollector: React.FC<SignatureCollectorProps> = ({
	fields,
	recipients,
	onSignaturesComplete,
	className = "",
}) => {
	const [collectedSignatures, setCollectedSignatures] = useState<CollectedSignature[]>([]);
	const [activeField, setActiveField] = useState<SignatureField | null>(null);
	const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);

	// Group fields by recipient
	const fieldsByRecipient = fields.reduce((acc, field) => {
		if (!a