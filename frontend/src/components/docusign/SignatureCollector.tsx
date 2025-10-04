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
		if (!acc[field.recipientId]) {
			acc[field.recipientId] = [];
		}
		acc[field.recipientId].push(field);
		return acc;
	}, {} as Record<string, SignatureField[]>);

	const currentRecipient = recipients[currentRecipientIndex];
	const currentFields = currentRecipient ? fieldsByRecipient[currentRecipient.id] || [] : [];

	const handleSignatureComplete = (fieldId: string, data: string) => {
		const field = fields.find(f => f.id === fieldId);
		if (!field) return;

		const signature: CollectedSignature = {
			fieldId,
			recipientId: field.recipientId,
			data,
			type: field.type,
			pageNumber: field.pageNumber,
		};

		setCollectedSignatures(prev => [...prev.filter(s => s.fieldId !== fieldId), signature]);
		setActiveField(null);

		// Check if all signatures for current recipient are complete
		const recipientSignatures = collectedSignatures.filter(s => s.recipientId === currentRecipient.id);
		if (recipientSignatures.length + 1 >= currentFields.length) {
			// Move to next recipient or complete
			if (currentRecipientIndex < recipients.length - 1) {
				setCurrentRecipientIndex(prev => prev + 1);
			} else {
				// All signatures collected
				const signatureData: SignatureData[] = [...collectedSignatures, signature].map(sig => ({
					id: sig.fieldId,
					pageNumber: sig.pageNumber,
					recipientId: sig.recipientId,
					type: sig.type,
					dataUrl: sig.data,
				}));
				onSignaturesComplete(signatureData);
			}
		}
	};

	const getFieldIcon = (type: string) => {
		switch (type) {
			case "signature":
				return <PenTool className="w-4 h-4" />;
			case "initial":
				return <FileSignature className="w-4 h-4" />;
			case "date":
				return <Calendar className="w-4 h-4" />;
			case "text":
				return <Type className="w-4 h-4" />;
			default:
				return <PenTool className="w-4 h-4" />;
		}
	};

	const isFieldCompleted = (fieldId: string) => {
		return collectedSignatures.some(s => s.fieldId === fieldId);
	};

	if (!currentRecipient) {
		return (
			<div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
				<div className="text-center">
					<CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 mb-2">All Signatures Collected</h3>
					<p className="text-gray-600">All required signatures have been collected successfully.</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`bg-white rounded-lg shadow-lg ${className}`}>
			{/* Header */}
			<div className="p-6 border-b border-gray-200">
				<div className="flex items-center gap-3">
					<User className="w-6 h-6 text-blue-600" />
					<div>
						<h3 className="text-lg font-semibold text-gray-900">{currentRecipient.name}</h3>
						{currentRecipient.email && (
							<p className="text-sm text-gray-600">{currentRecipient.email}</p>
						)}
					</div>
				</div>
				<div className="mt-4">
					<div className="flex justify-between text-sm text-gray-600 mb-2">
						<span>Progress</span>
						<span>{collectedSignatures.filter(s => s.recipientId === currentRecipient.id).length} of {currentFields.length}</span>
					</div>
					<div className="w-full bg-gray-200 rounded-full h-2">
						<div
							className="bg-blue-600 h-2 rounded-full transition-all duration-300"
							style={{
								width: `${(collectedSignatures.filter(s => s.recipientId === currentRecipient.id).length / currentFields.length) * 100}%`
							}}
						/>
					</div>
				</div>
			</div>

			{/* Fields List */}
			<div className="p-6">
				<h4 className="text-md font-medium text-gray-900 mb-4">Required Signatures</h4>
				<div className="space-y-3">
					{currentFields.map((field) => (
						<div
							key={field.id}
							className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isFieldCompleted(field.id)
								? "bg-green-50 border-green-200"
								: "bg-gray-50 border-gray-200 hover:bg-gray-100"
								}`}
						>
							<div className="flex items-center gap-3">
								{getFieldIcon(field.type)}
								<div>
									<p className="font-medium text-gray-900 capitalize">{field.type}</p>
									<p className="text-sm text-gray-600">Page {field.pageNumber}</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{isFieldCompleted(field.id) ? (
									<CheckCircle className="w-5 h-5 text-green-500" />
								) : (
									<button
										onClick={() => setActiveField(field)}
										className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
									>
										Sign
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Signature Pad Modal */}
			{activeField && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
						<SignaturePad
							field={activeField}
							onSignatureComplete={handleSignatureComplete}
							onClose={() => setActiveField(null)}
						/>
					</div>
				</div>
			)}
		</div>
	);
};