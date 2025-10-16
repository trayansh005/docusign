"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
	listSignatures,
	uploadSignatureFile,
	createSignatureFromDataUrl,
	deleteSignature,
	setDefaultSignature,
} from "@/services/signatureAPI";
import { SignaturePad } from "@/components/docusign/SignaturePad";
import type { SignatureField } from "@/types/docusign";

export default function SignaturesPage() {
	// Minimal client-side signature shape
	type SignatureItem = {
		_id: string;
		owner?: string;
		filename: string;
		label?: string;
		isDefault?: boolean;
		createdAt?: string;
	};

	const [signatures, setSignatures] = useState<SignatureItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [showPad, setShowPad] = useState(false);

	const load = async () => {
		setLoading(true);
		try {
			const data = await listSignatures();
			setSignatures(Array.isArray(data) ? data : []);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		try {
			await uploadSignatureFile(f);
			await load();
		} catch (err) {
			console.error(err);
		}
	};

	const handleSignatureComplete = async (_fieldId: string, dataUrl: string) => {
		try {
			await createSignatureFromDataUrl(dataUrl);
			setShowPad(false);
			await load();
		} catch (e) {
			console.error(e);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteSignature(id);
			await load();
		} catch (e) {
			console.error(e);
		}
	};

	const handleSetDefault = async (id: string) => {
		try {
			await setDefaultSignature(id);
			await load();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold mb-4">Signatures</h1>
			<div className="mb-4">
				<input type="file" accept="image/*" onChange={onFile} />
				<button onClick={() => setShowPad(true)} className="ml-4 btn">
					Draw / Type
				</button>
			</div>
			{loading ? (
				<div>Loading...</div>
			) : (
				<div className="grid grid-cols-3 gap-4">
					{signatures.map((s) => (
						<div key={s._id} className="p-2 border rounded">
							<div className="h-24 mb-2 relative">
								<Image
									src={s.filename}
									alt={s.label || "signature"}
									fill
									style={{ objectFit: "contain" }}
								/>
							</div>
							<div className="text-sm text-gray-600">{s.label}</div>
							<div className="flex gap-2 mt-2">
								{!s.isDefault && (
									<button onClick={() => handleSetDefault(s._id)} className="btn-sm">
										Set default
									</button>
								)}
								<button onClick={() => handleDelete(s._id)} className="btn-sm btn-danger">
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{showPad && (
				<div className="fixed inset-0 flex items-center justify-center bg-black/50">
					<div className="bg-white p-6 rounded shadow-lg w-[720px]">
						<h2 className="text-xl mb-4">Draw or Type Signature</h2>
						{/* Provide minimal SignatureField shape; cast to satisfy prop typing */}
						<SignaturePad
							field={
								{ id: "tmp", recipientId: "me", type: "signature", pageNumber: 1 } as SignatureField
							}
							onSignatureComplete={(id, dataUrl) => handleSignatureComplete(id, dataUrl)}
							onClose={() => setShowPad(false)}
						/>
						<div className="mt-4 text-right">
							<button onClick={() => setShowPad(false)} className="btn">
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
