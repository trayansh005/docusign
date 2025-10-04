"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { SignatureField } from "@/types/docusign";

interface UseSignatureFieldsProps {
	fields: SignatureField[];
	onFieldAdd?: (pageNumber: number, field: Omit<SignatureField, "id">) => void;
	onFieldUpdate?: (pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => void;
	onFieldRemove?: (pageNumber: number, fieldId: string) => void;
}

export const useSignatureFields = ({
	fields,
	onFieldAdd,
	onFieldUpdate,
	onFieldRemove,
}: UseSignatureFieldsProps) => {
	const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
	const [selectedFieldType, setSelectedFieldType] = useState<SignatureField["type"]>("signature");
	const [isAddingField, setIsAddingField] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Field type configurations
	const fieldConfigs = useMemo(() => ({
		signature: { defaultWidth: 20, defaultHeight: 6, minWidth: 8, minHeight: 3 },
		initial: { defaultWidth: 8, defaultHeight: 6, minWidth: 4, minHeight: 3 },
		date: { defaultWidth: 12, defaultHeight: 4, minWidth: 6, minHeight: 2 },
		text: { defaultWidth: 15, defaultHeight: 4, minWidth: 6, minHeight: 2 },
	}), []);

	const selectedField = selectedFieldId ? fields.find(f => f.id === selectedFieldId) || null : null;

	const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
		if (!isAddingField || !onFieldAdd || !containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;

		const config = fieldConfigs[selectedFieldType];

		// Ensure field doesn't go outside bounds
		const adjustedX = Math.max(0, Math.min(100 - config.defaultWidth, x));
		const adjustedY = Math.max(0, Math.min(100 - config.defaultHeight, y));

		const newField: Omit<SignatureField, "id"> = {
			recipientId: "recipient-1",
			type: selectedFieldType,
			pageNumber,
			xPct: adjustedX,
			yPct: adjustedY,
			wPct: config.defaultWidth,
			hPct: config.defaultHeight,
			required: false,
		};

		onFieldAdd(pageNumber, newField);
		setIsAddingField(false);
	}, [isAddingField, selectedFieldType, onFieldAdd, fieldConfigs]);

	const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<SignatureField>) => {
		const field = fields.find(f => f.id === fieldId);
		if (!field || !onFieldUpdate) return;

		onFieldUpdate(field.pageNumber, fieldId, updates);
	}, [fields, onFieldUpdate]);

	const handleFieldRemove = useCallback((fieldId: string) => {
		const field = fields.find(f => f.id === fieldId);
		if (!field || !onFieldRemove) return;

		onFieldRemove(field.pageNumber, fieldId);
		if (selectedFieldId === fieldId) {
			setSelectedFieldId(null);
		}
	}, [fields, onFieldRemove, selectedFieldId]);

	const handleFieldSelect = useCallback((fieldId: string) => {
		setSelectedFieldId(fieldId);
	}, []);

	const handleFieldDeselect = useCallback(() => {
		setSelectedFieldId(null);
	}, []);

	const startAddingField = useCallback((fieldType: SignatureField["type"]) => {
		setSelectedFieldType(fieldType);
		setIsAddingField(true);
		setSelectedFieldId(null);
	}, []);

	const stopAddingField = useCallback(() => {
		setIsAddingField(false);
	}, []);

	const duplicateField = useCallback((fieldId: string) => {
		const field = fields.find(f => f.id === fieldId);
		if (!field || !onFieldAdd) return;

		const newField: Omit<SignatureField, "id"> = {
			...field,
			xPct: Math.min(95, field.xPct + 5), // Offset slightly
			yPct: Math.min(95, field.yPct + 5),
		};

		onFieldAdd(field.pageNumber, newField);
	}, [fields, onFieldAdd]);

	const alignFields = useCallback((alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
		if (!selectedFieldId) return;

		const selectedField = fields.find(f => f.id === selectedFieldId);
		if (!selectedField) return;

		const pageFields = fields.filter(f => f.pageNumber === selectedField.pageNumber && f.id !== selectedFieldId);

		pageFields.forEach(field => {
			const updates: Partial<SignatureField> = {};

			switch (alignment) {
				case "left":
					updates.xPct = selectedField.xPct;
					break;
				case "center":
					updates.xPct = selectedField.xPct + (selectedField.wPct / 2) - (field.wPct / 2);
					break;
				case "right":
					updates.xPct = selectedField.xPct + selectedField.wPct - field.wPct;
					break;
				case "top":
					updates.yPct = selectedField.yPct;
					break;
				case "middle":
					updates.yPct = selectedField.yPct + (selectedField.hPct / 2) - (field.hPct / 2);
					break;
				case "bottom":
					updates.yPct = selectedField.yPct + selectedField.hPct - field.hPct;
					break;
			}

			handleFieldUpdate(field.id, updates);
		});
	}, [selectedFieldId, fields, handleFieldUpdate]);

	return {
		// State
		selectedField,
		selectedFieldId,
		selectedFieldType,
		isAddingField,
		containerRef,

		// Handlers
		handleCanvasClick,
		handleFieldUpdate,
		handleFieldRemove,
		handleFieldSelect,
		handleFieldDeselect,
		startAddingField,
		stopAddingField,
		duplicateField,
		alignFields,

		// Utilities
		fieldConfigs,
	};
};